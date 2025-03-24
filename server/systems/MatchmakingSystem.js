/**
 * Sistema de Matchmaking - Responsável por gerenciar filas de jogadores, criar e balancear partidas
 * @module systems/MatchmakingSystem
 */

import { EventEmitter } from '../../shared/utils/EventEmitter.js';
import {
  MATCHMAKING_ROOM_STATES,
  MATCH_TYPES,
  GAME_MODES,
  MATCHMAKING_CONFIG,
  TEAM_BALANCING,
  RANKING_CONSTANTS,
  QUEUE_TIMEOUTS,
  ABANDONMENT_PENALTIES,
  RECONNECT_TIMEOUTS,
  MAPS_BY_GAMEMODE,
  TEAMS
} from '../../shared/constants/MatchmakingConstants.js';

/**
 * Sistema de matchmaking para gerenciar filas, partidas e balanceamento
 */
export class MatchmakingSystem {
  /**
   * Cria uma instância do sistema de matchmaking
   * @param {Object} options - Opções do sistema de matchmaking
   * @param {NetworkSystem} options.networkSystem - Sistema de rede
   * @param {GameSystem} options.gameSystem - Sistema de jogo
   */
  constructor(options) {
    this.networkSystem = options.networkSystem;
    this.gameSystem = options.gameSystem;
    this.eventEmitter = new EventEmitter();
    
    this.rooms = new Map(); // Map<roomId, Room>
    this.queues = {}; // Filas por modo de jogo e tipo de partida
    this.playerRatings = new Map(); // Map<playerId, rating>
    this.playerQueues = new Map(); // Map<playerId, {queueId, joinTime}>
    this.disconnectedPlayers = new Map(); // Map<playerId, {roomId, disconnectTime, timeout}>
    this.playerPenalties = new Map(); // Map<playerId, {count, timeout, expiry}>
    
    this.initializeQueues();
    this.setupEventListeners();
  }

  /**
   * Inicializa o sistema de matchmaking
   */
  initialize() {
    console.log('MatchmakingSystem initialized');
    this.startMatchmakingLoop();
  }

  /**
   * Configura os ouvintes de eventos
   */
  setupEventListeners() {
    // Evento de conexão de jogador
    this.networkSystem.on('player:connect', (playerId) => {
      this.handlePlayerConnect(playerId);
    });

    // Evento de desconexão de jogador
    this.networkSystem.on('player:disconnect', (playerId) => {
      this.handlePlayerDisconnect(playerId);
    });

    // Evento de jogador entrando na fila
    this.networkSystem.on('matchmaking:joinQueue', (data) => {
      this.joinQueue(data.playerId, data.gameMode, data.matchType);
    });

    // Evento de jogador saindo da fila
    this.networkSystem.on('matchmaking:leaveQueue', (data) => {
      this.leaveQueue(data.playerId);
    });

    // Evento de partida finalizada
    this.gameSystem.on('match:end', (data) => {
      this.handleMatchEnd(data.roomId, data.stats);
    });

    // Evento de criação de sala personalizada
    this.networkSystem.on('matchmaking:createCustomRoom', (data) => {
      this.createCustomRoom(data.playerId, data.settings);
    });

    // Evento de entrada em sala personalizada
    this.networkSystem.on('matchmaking:joinCustomRoom', (data) => {
      this.joinCustomRoom(data.playerId, data.roomId);
    });

    // Evento de saída de sala personalizada
    this.networkSystem.on('matchmaking:leaveCustomRoom', (data) => {
      this.leaveCustomRoom(data.playerId, data.roomId);
    });

    // Evento de início de sala personalizada
    this.networkSystem.on('matchmaking:startCustomRoom', (data) => {
      this.startCustomRoom(data.playerId, data.roomId);
    });
  }

  /**
   * Inicializa as filas para cada modo de jogo e tipo de partida
   */
  initializeQueues() {
    Object.values(GAME_MODES).forEach(gameMode => {
      Object.values(MATCH_TYPES).forEach(matchType => {
        if (matchType !== MATCH_TYPES.CUSTOM) {
          const queueId = `${gameMode}_${matchType}`;
          this.queues[queueId] = {
            players: [],
            gameMode,
            matchType,
            lastProcessTime: Date.now()
          };
        }
      });
    });
  }

  /**
   * Inicia o loop de processamento de matchmaking
   */
  startMatchmakingLoop() {
    const processInterval = 5000; // Processar filas a cada 5 segundos
    
    this.matchmakingInterval = setInterval(() => {
      this.processQueues();
      this.processRooms();
      this.processDisconnectedPlayers();
      this.processPlayerPenalties();
    }, processInterval);
  }

  /**
   * Processa todas as filas de matchmaking
   */
  processQueues() {
    const now = Date.now();
    
    Object.keys(this.queues).forEach(queueId => {
      const queue = this.queues[queueId];
      
      // Atualizar tempo da última verificação
      queue.lastProcessTime = now;
      
      if (queue.players.length === 0) return;
      
      // Para partidas casuais, criar partida assim que tiver jogadores suficientes
      if (queue.matchType === MATCH_TYPES.CASUAL) {
        this.processCasualQueue(queueId, queue);
      } 
      // Para partidas competitivas, usar matchmaking baseado em habilidade
      else if (queue.matchType === MATCH_TYPES.COMPETITIVE) {
        this.processCompetitiveQueue(queueId, queue);
      }
    });
  }

  /**
   * Processa fila de partidas casuais
   * @param {string} queueId - ID da fila
   * @param {Object} queue - Objeto da fila
   */
  processCasualQueue(queueId, queue) {
    const config = MATCHMAKING_CONFIG[queue.gameMode];
    
    // Se tiver jogadores suficientes para iniciar
    if (queue.players.length >= config.minPlayers) {
      // Coletar jogadores para esta partida (até o máximo configurado)
      const matchPlayers = queue.players.slice(0, config.maxPlayers);
      
      // Remover jogadores da fila
      queue.players = queue.players.slice(matchPlayers.length);
      
      // Criar nova sala de jogo
      this.createRoom(queueId, matchPlayers, false);
    }
  }

  /**
   * Processa fila de partidas competitivas
   * @param {string} queueId - ID da fila
   * @param {Object} queue - Objeto da fila
   */
  processCompetitiveQueue(queueId, queue) {
    const config = MATCHMAKING_CONFIG[queue.gameMode];
    const now = Date.now();
    
    // Ordenar jogadores por rating para facilitar o matchmaking
    queue.players.sort((a, b) => {
      const ratingA = this.getPlayerRating(a.playerId);
      const ratingB = this.getPlayerRating(b.playerId);
      return ratingA - ratingB;
    });
    
    const matchedPlayers = [];
    const processedPlayers = new Set();
    
    // Para cada jogador na fila, encontrar um match adequado
    for (let i = 0; i < queue.players.length; i++) {
      const player = queue.players[i];
      
      // Pular jogadores já processados
      if (processedPlayers.has(player.playerId)) continue;
      
      const playerRating = this.getPlayerRating(player.playerId);
      const waitTime = now - player.joinTime;
      
      // Calcular intervalo de busca de rating baseado no tempo de espera
      let searchRange = QUEUE_TIMEOUTS.initialSearchRange;
      
      if (waitTime > QUEUE_TIMEOUTS.expandSearchAfter) {
        const expansions = Math.floor((waitTime - QUEUE_TIMEOUTS.expandSearchAfter) / QUEUE_TIMEOUTS.expandSearchAfter);
        searchRange += expansions * QUEUE_TIMEOUTS.expandSearchStep;
        searchRange = Math.min(searchRange, QUEUE_TIMEOUTS.maxSearchRange);
      }
      
      // Encontrar jogadores com rating similar
      const potentialMatches = [];
      
      for (let j = 0; j < queue.players.length; j++) {
        const otherPlayer = queue.players[j];
        
        // Não combinar com o mesmo jogador ou já processados
        if (otherPlayer.playerId === player.playerId || processedPlayers.has(otherPlayer.playerId)) {
          continue;
        }
        
        const otherRating = this.getPlayerRating(otherPlayer.playerId);
        const ratingDiff = Math.abs(playerRating - otherRating);
        
        // Se o rating estiver dentro do intervalo de busca
        if (ratingDiff <= searchRange) {
          potentialMatches.push(otherPlayer);
        }
      }
      
      // Se encontrou jogadores suficientes, criar match
      if (potentialMatches.length >= config.minPlayers - 1) {
        // Adicionar o jogador atual
        const currentMatch = [player];
        processedPlayers.add(player.playerId);
        
        // Adicionar outros jogadores até atingir o tamanho necessário
        let neededPlayers = Math.min(config.maxPlayers - 1, potentialMatches.length);
        
        for (let j = 0; j < neededPlayers; j++) {
          const matchedPlayer = potentialMatches[j];
          currentMatch.push(matchedPlayer);
          processedPlayers.add(matchedPlayer.playerId);
        }
        
        matchedPlayers.push(...currentMatch);
        
        // Se temos jogadores suficientes para uma partida completa
        if (matchedPlayers.length >= config.maxPlayers) {
          // Criar partida com os jogadores matcheados
          const roomPlayers = matchedPlayers.splice(0, config.maxPlayers);
          this.createRoom(queueId, roomPlayers, true);
        }
      }
    }
    
    // Se ainda temos jogadores matcheados suficientes para uma partida
    if (matchedPlayers.length >= config.minPlayers) {
      this.createRoom(queueId, matchedPlayers, true);
      matchedPlayers.length = 0;
    }
    
    // Atualizar a fila removendo jogadores matcheados
    queue.players = queue.players.filter(player => !processedPlayers.has(player.playerId));
  }

  /**
   * Processa salas de jogo
   */
  processRooms() {
    for (const [roomId, room] of this.rooms.entries()) {
      const now = Date.now();
      
      switch (room.state) {
        case MATCHMAKING_ROOM_STATES.WAITING:
          // Verificar se temos jogadores suficientes para iniciar
          if (this.countActivePlayers(room) >= MATCHMAKING_CONFIG[room.gameMode].minPlayers) {
            this.transitionRoomState(roomId, MATCHMAKING_ROOM_STATES.STARTING);
          }
          break;
          
        case MATCHMAKING_ROOM_STATES.STARTING:
          // Verificar se o período de contagem regressiva acabou
          if (now >= room.stateTransitionTime + (MATCHMAKING_CONFIG[room.gameMode].startCountdown * 1000)) {
            this.startMatch(roomId);
          }
          break;
          
        case MATCHMAKING_ROOM_STATES.ACTIVE:
          // Verificar se não há jogadores ativos o suficiente
          if (this.countActivePlayers(room) < MATCHMAKING_CONFIG[room.gameMode].minPlayers / 2) {
            this.endMatchDueToPlayerShortage(roomId);
          }
          break;
          
        case MATCHMAKING_ROOM_STATES.ENDING:
          // Verificar se o período de encerramento acabou
          if (now >= room.stateTransitionTime + (MATCHMAKING_CONFIG[room.gameMode].endingTime * 1000)) {
            this.cleanupRoom(roomId);
          }
          break;
      }
    }
  }

  /**
   * Processa jogadores desconectados
   */
  processDisconnectedPlayers() {
    const now = Date.now();
    
    for (const [playerId, data] of this.disconnectedPlayers.entries()) {
      const { roomId, disconnectTime, matchType } = data;
      const reconnectTimeout = RECONNECT_TIMEOUTS[matchType] || RECONNECT_TIMEOUTS.casual;
      
      // Se o tempo de reconexão expirou
      if (now >= disconnectTime + reconnectTimeout) {
        // Remover jogador da sala
        this.handlePlayerAbandon(playerId, roomId);
        this.disconnectedPlayers.delete(playerId);
      }
    }
  }

  /**
   * Processa penalidades de jogadores
   */
  processPlayerPenalties() {
    const now = Date.now();
    
    for (const [playerId, penalty] of this.playerPenalties.entries()) {
      if (penalty.expiry <= now) {
        this.playerPenalties.delete(playerId);
      }
    }
  }

  /**
   * Cria uma nova sala de jogo
   * @param {string} queueId - ID da fila
   * @param {Array} players - Lista de jogadores
   * @param {boolean} isRanked - Se a partida é ranqueada
   * @returns {string} ID da sala criada
   */
  createRoom(queueId, players, isRanked) {
    const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const [gameMode, matchType] = queueId.split('_');
    
    // Selecionar um mapa aleatório para o modo de jogo
    const availableMaps = MAPS_BY_GAMEMODE[gameMode];
    const mapId = availableMaps[Math.floor(Math.random() * availableMaps.length)];
    
    const room = {
      id: roomId,
      gameMode,
      matchType,
      mapId,
      isRanked,
      players: players.map(p => ({
        playerId: p.playerId,
        team: null, // Será definido pelo balanceador
        isActive: true,
        isReady: false,
        joinTime: Date.now()
      })),
      state: MATCHMAKING_ROOM_STATES.WAITING,
      stateTransitionTime: Date.now(),
      teams: {},
      startTime: null,
      endTime: null,
      result: null
    };
    
    this.rooms.set(roomId, room);
    
    // Notificar jogadores sobre a criação da sala
    players.forEach(player => {
      this.playerQueues.delete(player.playerId);
      this.networkSystem.sendToPlayer(player.playerId, 'matchmaking:roomCreated', {
        roomId,
        gameMode,
        matchType,
        mapId
      });
    });
    
    // Balancear equipes
    this.balanceTeams(roomId);
    
    return roomId;
  }

  /**
   * Cria uma sala personalizada
   * @param {string} hostPlayerId - ID do jogador host
   * @param {Object} settings - Configurações da sala
   * @returns {string} ID da sala criada
   */
  createCustomRoom(hostPlayerId, settings) {
    // Validar configurações
    const gameMode = settings.gameMode || GAME_MODES.TEAM_DEATHMATCH;
    const mapId = settings.mapId || MAPS_BY_GAMEMODE[gameMode][0];
    const maxPlayers = Math.min(
      settings.maxPlayers || MATCHMAKING_CONFIG[gameMode].maxPlayers,
      MATCHMAKING_CONFIG[gameMode].maxPlayers
    );
    
    const roomId = `custom_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    const room = {
      id: roomId,
      gameMode,
      matchType: MATCH_TYPES.CUSTOM,
      mapId,
      isRanked: false,
      players: [{
        playerId: hostPlayerId,
        team: null,
        isActive: true,
        isReady: false,
        joinTime: Date.now(),
        isHost: true
      }],
      state: MATCHMAKING_ROOM_STATES.WAITING,
      stateTransitionTime: Date.now(),
      teams: {},
      startTime: null,
      endTime: null,
      result: null,
      settings: {
        ...settings,
        gameMode,
        mapId,
        maxPlayers
      }
    };
    
    this.rooms.set(roomId, room);
    
    // Notificar host sobre a criação da sala
    this.networkSystem.sendToPlayer(hostPlayerId, 'matchmaking:customRoomCreated', {
      roomId,
      settings: room.settings
    });
    
    return roomId;
  }

  /**
   * Entra em uma sala personalizada
   * @param {string} playerId - ID do jogador
   * @param {string} roomId - ID da sala
   * @returns {boolean} Sucesso da operação
   */
  joinCustomRoom(playerId, roomId) {
    const room = this.rooms.get(roomId);
    
    if (!room || room.matchType !== MATCH_TYPES.CUSTOM || room.state !== MATCHMAKING_ROOM_STATES.WAITING) {
      this.networkSystem.sendToPlayer(playerId, 'matchmaking:joinCustomRoomFailed', {
        reason: 'Room not available'
      });
      return false;
    }
    
    // Verificar se a sala está cheia
    if (room.players.length >= room.settings.maxPlayers) {
      this.networkSystem.sendToPlayer(playerId, 'matchmaking:joinCustomRoomFailed', {
        reason: 'Room is full'
      });
      return false;
    }
    
    // Verificar se o jogador já está na sala
    if (room.players.some(p => p.playerId === playerId)) {
      this.networkSystem.sendToPlayer(playerId, 'matchmaking:joinCustomRoomFailed', {
        reason: 'Already in room'
      });
      return false;
    }
    
    // Adicionar jogador à sala
    room.players.push({
      playerId,
      team: null,
      isActive: true,
      isReady: false,
      joinTime: Date.now(),
      isHost: false
    });
    
    // Notificar jogador sobre entrada na sala
    this.networkSystem.sendToPlayer(playerId, 'matchmaking:joinedCustomRoom', {
      roomId,
      settings: room.settings,
      players: room.players.map(p => ({
        playerId: p.playerId,
        team: p.team,
        isHost: p.isHost,
        isReady: p.isReady
      }))
    });
    
    // Notificar outros jogadores na sala
    room.players.forEach(p => {
      if (p.playerId !== playerId) {
        this.networkSystem.sendToPlayer(p.playerId, 'matchmaking:playerJoinedRoom', {
          playerId,
          isHost: false,
          isReady: false
        });
      }
    });
    
    // Se for o segundo jogador, reatribuir automaticamente as equipes
    if (room.players.length === 2) {
      this.balanceTeams(roomId);
    }
    
    return true;
  }

  /**
   * Sai de uma sala personalizada
   * @param {string} playerId - ID do jogador
   * @param {string} roomId - ID da sala
   * @returns {boolean} Sucesso da operação
   */
  leaveCustomRoom(playerId, roomId) {
    const room = this.rooms.get(roomId);
    
    if (!room || room.matchType !== MATCH_TYPES.CUSTOM) {
      return false;
    }
    
    const playerIndex = room.players.findIndex(p => p.playerId === playerId);
    
    if (playerIndex === -1) {
      return false;
    }
    
    const isHost = room.players[playerIndex].isHost;
    
    // Remover jogador da sala
    room.players.splice(playerIndex, 1);
    
    // Notificar jogador que saiu
    this.networkSystem.sendToPlayer(playerId, 'matchmaking:leftCustomRoom', {
      roomId
    });
    
    // Se não restarem jogadores, remover a sala
    if (room.players.length === 0) {
      this.rooms.delete(roomId);
      return true;
    }
    
    // Notificar outros jogadores na sala
    room.players.forEach(p => {
      this.networkSystem.sendToPlayer(p.playerId, 'matchmaking:playerLeftRoom', {
        playerId
      });
    });
    
    // Se o host saiu, designar novo host
    if (isHost && room.players.length > 0) {
      room.players[0].isHost = true;
      
      this.networkSystem.sendToPlayer(room.players[0].playerId, 'matchmaking:promotedToHost', {
        roomId
      });
      
      // Notificar outros jogadores sobre o novo host
      for (let i = 1; i < room.players.length; i++) {
        this.networkSystem.sendToPlayer(room.players[i].playerId, 'matchmaking:hostChanged', {
          newHostId: room.players[0].playerId
        });
      }
    }
    
    // Rebalancear equipes se necessário
    if (room.players.length >= 2) {
      this.balanceTeams(roomId);
    }
    
    return true;
  }

  /**
   * Inicia uma sala personalizada
   * @param {string} playerId - ID do jogador (deve ser o host)
   * @param {string} roomId - ID da sala
   * @returns {boolean} Sucesso da operação
   */
  startCustomRoom(playerId, roomId) {
    const room = this.rooms.get(roomId);
    
    if (!room || room.matchType !== MATCH_TYPES.CUSTOM || room.state !== MATCHMAKING_ROOM_STATES.WAITING) {
      return false;
    }
    
    // Verificar se o jogador é o host
    const player = room.players.find(p => p.playerId === playerId);
    
    if (!player || !player.isHost) {
      this.networkSystem.sendToPlayer(playerId, 'matchmaking:startCustomRoomFailed', {
        reason: 'Not authorized'
      });
      return false;
    }
    
    // Verificar se há jogadores suficientes
    if (room.players.length < 2) {
      this.networkSystem.sendToPlayer(playerId, 'matchmaking:startCustomRoomFailed', {
        reason: 'Not enough players'
      });
      return false;
    }
    
    // Verificar se todos os jogadores estão prontos (exceto host)
    const unreadyPlayers = room.players.filter(p => !p.isHost && !p.isReady);
    
    if (unreadyPlayers.length > 0) {
      this.networkSystem.sendToPlayer(playerId, 'matchmaking:startCustomRoomFailed', {
        reason: 'Not all players are ready',
        unreadyPlayers: unreadyPlayers.map(p => p.playerId)
      });
      return false;
    }
    
    // Transicionar para o estado de início
    this.transitionRoomState(roomId, MATCHMAKING_ROOM_STATES.STARTING);
    
    return true;
  }

  /**
   * Marca um jogador como pronto em uma sala personalizada
   * @param {string} playerId - ID do jogador
   * @param {string} roomId - ID da sala
   * @returns {boolean} Sucesso da operação
   */
  setPlayerReady(playerId, roomId, isReady) {
    const room = this.rooms.get(roomId);
    
    if (!room || room.matchType !== MATCH_TYPES.CUSTOM || room.state !== MATCHMAKING_ROOM_STATES.WAITING) {
      return false;
    }
    
    const player = room.players.find(p => p.playerId === playerId);
    
    if (!player) {
      return false;
    }
    
    player.isReady = isReady;
    
    // Notificar todos os jogadores na sala
    room.players.forEach(p => {
      this.networkSystem.sendToPlayer(p.playerId, 'matchmaking:playerReadyChanged', {
        playerId,
        isReady
      });
    });
    
    return true;
  }

  /**
   * Define o time de um jogador em uma sala personalizada
   * @param {string} playerId - ID do jogador
   * @param {string} roomId - ID da sala
   * @param {string} teamId - ID do time
   * @returns {boolean} Sucesso da operação
   */
  setPlayerTeam(playerId, roomId, teamId) {
    const room = this.rooms.get(roomId);
    
    if (!room || room.matchType !== MATCH_TYPES.CUSTOM || room.state !== MATCHMAKING_ROOM_STATES.WAITING) {
      return false;
    }
    
    // Verificar se o jogador existe na sala
    const playerIndex = room.players.findIndex(p => p.playerId === playerId);
    
    if (playerIndex === -1) {
      return false;
    }
    
    // Verificar se o time é válido
    if (!TEAMS[teamId.toUpperCase()]) {
      return false;
    }
    
    // Atualizar o time do jogador
    const oldTeam = room.players[playerIndex].team;
    room.players[playerIndex].team = teamId;
    
    // Atualizar contagem de jogadores por time
    if (oldTeam && room.teams[oldTeam]) {
      room.teams[oldTeam]--;
      if (room.teams[oldTeam] === 0) {
        delete room.teams[oldTeam];
      }
    }
    
    if (!room.teams[teamId]) {
      room.teams[teamId] = 0;
    }
    room.teams[teamId]++;
    
    // Notificar todos os jogadores na sala
    room.players.forEach(p => {
      this.networkSystem.sendToPlayer(p.playerId, 'matchmaking:playerTeamChanged', {
        playerId,
        teamId
      });
    });
    
    return true;
  }

  /**
   * Transfere a propriedade da sala para outro jogador
   * @param {string} hostId - ID do host atual
   * @param {string} roomId - ID da sala
   * @param {string} newHostId - ID do novo host
   * @returns {boolean} Sucesso da operação
   */
  transferRoomOwnership(hostId, roomId, newHostId) {
    const room = this.rooms.get(roomId);
    
    if (!room || room.matchType !== MATCH_TYPES.CUSTOM || room.state !== MATCHMAKING_ROOM_STATES.WAITING) {
      return false;
    }
    
    // Verificar se o jogador atual é o host
    const currentHost = room.players.find(p => p.playerId === hostId);
    if (!currentHost || !currentHost.isHost) {
      return false;
    }
    
    // Verificar se o novo host está na sala
    const newHost = room.players.find(p => p.playerId === newHostId);
    if (!newHost) {
      return false;
    }
    
    // Transferir propriedade
    currentHost.isHost = false;
    newHost.isHost = true;
    
    // Notificar todos os jogadores na sala
    room.players.forEach(p => {
      this.networkSystem.sendToPlayer(p.playerId, 'matchmaking:hostChanged', {
        previousHostId: hostId,
        newHostId
      });
    });
    
    return true;
  }

  /**
   * Entra em uma fila de matchmaking
   * @param {string} playerId - ID do jogador
   * @param {string} gameMode - Modo de jogo
   * @param {string} matchType - Tipo de partida
   * @returns {boolean} Sucesso da operação
   */
  joinQueue(playerId, gameMode, matchType) {
    // Verificar se o jogador já está em uma fila
    if (this.playerQueues.has(playerId)) {
      this.networkSystem.sendToPlayer(playerId, 'matchmaking:joinQueueFailed', {
        reason: 'Already in queue'
      });
      return false;
    }
    
    // Verificar se o jogador tem uma penalidade ativa
    if (this.playerPenalties.has(playerId)) {
      const penalty = this.playerPenalties.get(playerId);
      const remainingTime = Math.max(0, penalty.expiry - Date.now());
      
      this.networkSystem.sendToPlayer(playerId, 'matchmaking:joinQueueFailed', {
        reason: 'Penalty active',
        remainingTime
      });
      return false;
    }
    
    const queueId = `${gameMode}_${matchType}`;
    
    if (!this.queues[queueId]) {
      this.networkSystem.sendToPlayer(playerId, 'matchmaking:joinQueueFailed', {
        reason: 'Invalid queue'
      });
      return false;
    }
    
    // Adicionar jogador à fila
    this.queues[queueId].players.push({
      playerId,
      joinTime: Date.now()
    });
    
    // Registrar jogador na fila
    this.playerQueues.set(playerId, {
      queueId,
      joinTime: Date.now()
    });
    
    // Notificar jogador
    this.networkSystem.sendToPlayer(playerId, 'matchmaking:joinedQueue', {
      queueId,
      position: this.queues[queueId].players.length,
      estimatedWaitTime: this.estimateWaitTime(queueId, playerId)
    });
    
    return true;
  }

  /**
   * Sai de uma fila de matchmaking
   * @param {string} playerId - ID do jogador
   * @returns {boolean} Sucesso da operação
   */
  leaveQueue(playerId) {
    // Verificar se o jogador está em uma fila
    if (!this.playerQueues.has(playerId)) {
      return false;
    }
    
    const { queueId } = this.playerQueues.get(playerId);
    
    // Remover jogador da fila
    this.queues[queueId].players = this.queues[queueId].players.filter(p => p.playerId !== playerId);
    
    // Remover registro
    this.playerQueues.delete(playerId);
    
    // Notificar jogador
    this.networkSystem.sendToPlayer(playerId, 'matchmaking:leftQueue', {
      queueId
    });
    
    return true;
  }

  /**
   * Estimar tempo de espera para um jogador
   * @param {string} queueId - ID da fila
   * @param {string} playerId - ID do jogador
   * @returns {number} Tempo estimado em segundos
   */
  estimateWaitTime(queueId, playerId) {
    const queue = this.queues[queueId];
    const config = MATCHMAKING_CONFIG[queue.gameMode];
    
    if (queue.matchType === MATCH_TYPES.CASUAL) {
      // Para partidas casuais, estimativa baseada em quantos jogadores faltam
      const position = queue.players.findIndex(p => p.playerId === playerId);
      const playersAhead = position;
      const playersNeeded = Math.max(0, config.minPlayers - queue.players.length);
      
      // Estimativa simples: 30 segundos base + 10 segundos por jogador na frente + 20 segundos por jogador faltando
      return 30 + (playersAhead * 10) + (playersNeeded * 20);
    } else {
      // Para partidas competitivas, incluir fator de rating
      const playerRating = this.getPlayerRating(playerId);
      
      // Contar jogadores com rating similar
      const ratingRange = QUEUE_TIMEOUTS.initialSearchRange;
      const similarPlayers = queue.players.filter(p => {
        if (p.playerId === playerId) return false;
        const rating = this.getPlayerRating(p.playerId);
        return Math.abs(rating - playerRating) <= ratingRange;
      }).length;
      
      // Estimar baseado em jogadores similares e faltantes
      const playersNeeded = Math.max(0, config.minPlayers - 1 - similarPlayers);
      
      // Base: 45 segundos + 30 segundos por jogador faltante
      let estimate = 45 + (playersNeeded * 30);
      
      // Adicionar tempo baseado na raridade do rating (ratings extremos esperam mais)
      const avgRating = RANKING_CONSTANTS.initialRating;
      const ratingDiff = Math.abs(playerRating - avgRating);
      
      // A cada 100 pontos de diferença do rating médio, adicionar 15 segundos
      estimate += Math.floor(ratingDiff / 100) * 15;
      
      return estimate;
    }
  }

  /**
   * Obter o rating de um jogador
   * @param {string} playerId - ID do jogador
   * @returns {number} Rating do jogador
   */
  getPlayerRating(playerId) {
    return this.playerRatings.get(playerId) || RANKING_CONSTANTS.initialRating;
  }

  /**
   * Atualizar o rating de um jogador
   * @param {string} playerId - ID do jogador
   * @param {number} newRating - Novo rating
   */
  updatePlayerRating(playerId, newRating) {
    this.playerRatings.set(playerId, newRating);
  }

  /**
   * Lidar com a conexão de um jogador
   * @param {string} playerId - ID do jogador
   */
  handlePlayerConnect(playerId) {
    // Verificar se o jogador estava em uma sala
    if (this.disconnectedPlayers.has(playerId)) {
      const { roomId } = this.disconnectedPlayers.get(playerId);
      this.handlePlayerReconnect(playerId, roomId);
    }
  }

  /**
   * Lidar com a desconexão de um jogador
   * @param {string} playerId - ID do jogador
   */
  handlePlayerDisconnect(playerId) {
    // Verificar se o jogador está em uma fila
    if (this.playerQueues.has(playerId)) {
      this.leaveQueue(playerId);
    }
    
    // Verificar se o jogador está em uma sala
    for (const [roomId, room] of this.rooms.entries()) {
      const playerIndex = room.players.findIndex(p => p.playerId === playerId);
      
      if (playerIndex !== -1) {
        // Se a partida está ativa, marcar como desconectado
        if (room.state === MATCHMAKING_ROOM_STATES.ACTIVE) {
          room.players[playerIndex].isActive = false;
          
          // Registrar para possível reconexão
          this.disconnectedPlayers.set(playerId, {
            roomId,
            disconnectTime: Date.now(),
            matchType: room.matchType
          });
          
          // Notificar outros jogadores na sala
          room.players.forEach(p => {
            if (p.playerId !== playerId && p.isActive) {
              this.networkSystem.sendToPlayer(p.playerId, 'matchmaking:playerDisconnected', {
                playerId
              });
            }
          });
        } 
        // Se a partida não iniciou, remover jogador
        else if (room.state === MATCHMAKING_ROOM_STATES.WAITING || room.state === MATCHMAKING_ROOM_STATES.STARTING) {
          this.leaveCustomRoom(playerId, roomId);
        }
        
        break;
      }
    }
  }

  /**
   * Lidar com a reconexão de um jogador
   * @param {string} playerId - ID do jogador
   * @param {string} roomId - ID da sala
   */
  handlePlayerReconnect(playerId, roomId) {
    const room = this.rooms.get(roomId);
    
    if (!room || room.state !== MATCHMAKING_ROOM_STATES.ACTIVE) {
      this.disconnectedPlayers.delete(playerId);
      return;
    }
    
    const playerIndex = room.players.findIndex(p => p.playerId === playerId);
    
    if (playerIndex === -1) {
      this.disconnectedPlayers.delete(playerId);
      return;
    }
    
    // Reativar jogador
    room.players[playerIndex].isActive = true;
    
    // Remover da lista de desconectados
    this.disconnectedPlayers.delete(playerId);
    
    // Notificar jogador sobre o estado atual do jogo
    this.networkSystem.sendToPlayer(playerId, 'matchmaking:reconnected', {
      roomId,
      gameMode: room.gameMode,
      matchType: room.matchType,
      mapId: room.mapId,
      players: room.players.map(p => ({
        playerId: p.playerId,
        team: p.team,
        isActive: p.isActive
      }))
    });
    
    // Solicitar ao sistema de jogo para sincronizar o estado para este jogador
    this.gameSystem.syncStateForPlayer(playerId, roomId);
    
    // Notificar outros jogadores na sala
    room.players.forEach(p => {
      if (p.playerId !== playerId && p.isActive) {
        this.networkSystem.sendToPlayer(p.playerId, 'matchmaking:playerReconnected', {
          playerId
        });
      }
    });
  }

  /**
   * Lidar com o abandono de um jogador
   * @param {string} playerId - ID do jogador
   * @param {string} roomId - ID da sala
   */
  handlePlayerAbandon(playerId, roomId) {
    const room = this.rooms.get(roomId);
    
    if (!room) return;
    
    const playerIndex = room.players.findIndex(p => p.playerId === playerId);
    
    if (playerIndex === -1) return;
    
    // Remover jogador da sala
    room.players.splice(playerIndex, 1);
    
    // Aplicar penalidade se for competitiva
    if (room.matchType === MATCH_TYPES.COMPETITIVE) {
      this.applyAbandonmentPenalty(playerId, MATCH_TYPES.COMPETITIVE);
    } else if (room.matchType === MATCH_TYPES.CASUAL) {
      this.applyAbandonmentPenalty(playerId, MATCH_TYPES.CASUAL);
    }
    
    // Notificar outros jogadores na sala
    room.players.forEach(p => {
      if (p.isActive) {
        this.networkSystem.sendToPlayer(p.playerId, 'matchmaking:playerAbandoned', {
          playerId
        });
      }
    });
    
    // Verificar se há jogadores suficientes para continuar
    if (this.countActivePlayers(room) < MATCHMAKING_CONFIG[room.gameMode].minPlayers / 2) {
      this.endMatchDueToPlayerShortage(roomId);
    }
  }

  /**
   * Aplicar penalidade por abandono
   * @param {string} playerId - ID do jogador
   * @param {string} matchType - Tipo de partida
   */
  applyAbandonmentPenalty(playerId, matchType) {
    let penalty;
    
    if (matchType === MATCH_TYPES.COMPETITIVE) {
      // Verificar histórico de penalidades para competitivo
      const existingPenalty = this.playerPenalties.get(playerId);
      let offenseLevel = 'firstOffense';
      
      if (existingPenalty) {
        if (existingPenalty.count === 1) {
          offenseLevel = 'secondOffense';
        } else if (existingPenalty.count >= 2) {
          offenseLevel = 'thirdOffense';
        }
      }
      
      const penaltyDetails = ABANDONMENT_PENALTIES.competitive[offenseLevel];
      
      penalty = {
        count: (existingPenalty ? existingPenalty.count : 0) + 1,
        timeout: penaltyDetails.timeout,
        ratingPenalty: penaltyDetails.ratingPenalty,
        expiry: Date.now() + penaltyDetails.timeout,
        resetExpiry: Date.now() + ABANDONMENT_PENALTIES.competitive.resetAfter
      };
      
      // Aplicar penalidade de rating
      if (penaltyDetails.ratingPenalty > 0) {
        const currentRating = this.getPlayerRating(playerId);
        this.updatePlayerRating(playerId, Math.max(0, currentRating - penaltyDetails.ratingPenalty));
      }
    } else {
      // Penalidade para casual
      penalty = {
        count: 1,
        timeout: ABANDONMENT_PENALTIES.casual.timeout,
        ratingPenalty: ABANDONMENT_PENALTIES.casual.ratingPenalty,
        expiry: Date.now() + ABANDONMENT_PENALTIES.casual.timeout,
        resetExpiry: Date.now() + 3600000 // 1 hora
      };
    }
    
    this.playerPenalties.set(playerId, penalty);
    
    // Notificar jogador sobre a penalidade
    this.networkSystem.sendToPlayer(playerId, 'matchmaking:penaltyApplied', {
      timeout: penalty.timeout,
      ratingPenalty: penalty.ratingPenalty,
      expiry: penalty.expiry
    });
  }

  /**
   * Finalizar uma partida devido à falta de jogadores
   * @param {string} roomId - ID da sala
   */
  endMatchDueToPlayerShortage(roomId) {
    const room = this.rooms.get(roomId);
    
    if (!room || room.state !== MATCHMAKING_ROOM_STATES.ACTIVE) {
      return;
    }
    
    // Transicionar para o estado final
    this.transitionRoomState(roomId, MATCHMAKING_ROOM_STATES.ENDING);
    
    // Definir resultado como cancelado
    room.result = {
      status: 'cancelled',
      reason: 'insufficient_players'
    };
    
    // Notificar jogadores ativos
    room.players.forEach(p => {
      if (p.isActive) {
        this.networkSystem.sendToPlayer(p.playerId, 'matchmaking:matchCancelled', {
          reason: 'insufficient_players'
        });
      }
    });
    
    // Solicitar ao sistema de jogo para encerrar a partida
    this.gameSystem.endMatch(roomId, {
      status: 'cancelled',
      reason: 'insufficient_players'
    });
  }

  /**
   * Contar jogadores ativos em uma sala
   * @param {Object} room - Objeto da sala
   * @returns {number} Número de jogadores ativos
   */
  countActivePlayers(room) {
    return room.players.filter(p => p.isActive).length;
  }

  /**
   * Iniciar uma partida
   * @param {string} roomId - ID da sala
   */
  startMatch(roomId) {
    const room = this.rooms.get(roomId);
    
    if (!room || room.state !== MATCHMAKING_ROOM_STATES.STARTING) {
      return;
    }
    
    // Transicionar para o estado ativo
    this.transitionRoomState(roomId, MATCHMAKING_ROOM_STATES.ACTIVE);
    
    // Definir tempo de início
    room.startTime = Date.now();
    
    // Notificar jogadores
    room.players.forEach(p => {
      if (p.isActive) {
        this.networkSystem.sendToPlayer(p.playerId, 'matchmaking:matchStarted', {
          roomId,
          mapId: room.mapId,
          gameMode: room.gameMode,
          teams: room.teams,
          players: room.players.filter(player => player.isActive).map(player => ({
            playerId: player.playerId,
            team: player.team
          }))
        });
      }
    });
    
    // Iniciar partida no sistema de jogo
    this.gameSystem.startMatch(roomId, {
      mapId: room.mapId,
      gameMode: room.gameMode,
      teams: room.teams,
      players: room.players.filter(p => p.isActive).map(p => ({
        playerId: p.playerId,
        team: p.team
      })),
      settings: room.settings
    });
  }

  /**
   * Transicionar o estado de uma sala
   * @param {string} roomId - ID da sala
   * @param {string} newState - Novo estado
   */
  transitionRoomState(roomId, newState) {
    const room = this.rooms.get(roomId);
    
    if (!room) {
      return;
    }
    
    const oldState = room.state;
    room.state = newState;
    room.stateTransitionTime = Date.now();
    
    // Enviar notificação para jogadores ativos dependendo do novo estado
    if (newState === MATCHMAKING_ROOM_STATES.STARTING) {
      const countdownTime = MATCHMAKING_CONFIG[room.gameMode].startCountdown;
      
      room.players.forEach(p => {
        if (p.isActive) {
          this.networkSystem.sendToPlayer(p.playerId, 'matchmaking:matchStarting', {
            roomId,
            countdownTime,
            startTime: room.stateTransitionTime + (countdownTime * 1000)
          });
        }
      });
    }
    else if (newState === MATCHMAKING_ROOM_STATES.ENDING) {
      const endingTime = MATCHMAKING_CONFIG[room.gameMode].endingTime;
      
      room.players.forEach(p => {
        if (p.isActive) {
          this.networkSystem.sendToPlayer(p.playerId, 'matchmaking:matchEnding', {
            roomId,
            endingTime,
            endTime: room.stateTransitionTime + (endingTime * 1000)
          });
        }
      });
    }
    
    this.eventEmitter.emit('roomStateChanged', {
      roomId,
      oldState,
      newState,
      timestamp: room.stateTransitionTime
    });
  }

  /**
   * Lidar com o fim de uma partida
   * @param {string} roomId - ID da sala
   * @param {Object} stats - Estatísticas da partida
   */
  handleMatchEnd(roomId, stats) {
    const room = this.rooms.get(roomId);
    
    if (!room || room.state !== MATCHMAKING_ROOM_STATES.ACTIVE) {
      return;
    }
    
    // Transicionar para o estado final
    this.transitionRoomState(roomId, MATCHMAKING_ROOM_STATES.ENDING);
    
    // Definir tempo de fim e resultado
    room.endTime = Date.now();
    room.result = stats;
    
    // Se for uma partida ranqueada, atualizar ratings
    if (room.isRanked) {
      this.updateRatings(roomId, stats);
    }
    
    // Notificar jogadores ativos
    room.players.forEach(p => {
      if (p.isActive) {
        this.networkSystem.sendToPlayer(p.playerId, 'matchmaking:matchEnded', {
          stats,
          newRating: this.playerRatings.get(p.playerId)
        });
      }
    });
  }

  /**
   * Atualizar ratings dos jogadores após uma partida
   * @param {string} roomId - ID da sala
   * @param {Object} stats - Estatísticas da partida
   */
  updateRatings(roomId, stats) {
    const room = this.rooms.get(roomId);
    
    if (!room || !room.isRanked) {
      return;
    }
    
    // Implementação simples de algoritmo ELO para partidas por equipe
    if (room.gameMode === GAME_MODES.TEAM_DEATHMATCH || 
        room.gameMode === GAME_MODES.CAPTURE_FLAG || 
        room.gameMode === GAME_MODES.DOMINATION) {
      
      // Calcular rating médio por equipe
      const teamRatings = {};
      const teamPlayers = {};
      
      room.players.forEach(p => {
        if (!p.isActive) return;
        
        const team = p.team;
        const rating = this.getPlayerRating(p.playerId);
        
        if (!teamRatings[team]) {
          teamRatings[team] = 0;
          teamPlayers[team] = [];
        }
        
        teamRatings[team] += rating;
        teamPlayers[team].push(p.playerId);
      });
      
      // Calcular média por equipe
      Object.keys(teamRatings).forEach(team => {
        teamRatings[team] = teamRatings[team] / teamPlayers[team].length;
      });
      
      // Determinar equipe vencedora
      const winningTeam = stats.winningTeam;
      
      if (!winningTeam || !teamPlayers[winningTeam]) {
        return; // Partida sem vencedor claro
      }
      
      // Atualizar ratings
      Object.keys(teamPlayers).forEach(team => {
        // Calcular expectativa de vitória
        const expectedScore = {};
        
        Object.keys(teamRatings).forEach(otherTeam => {
          if (team === otherTeam) return;
          
          const ratingDiff = teamRatings[otherTeam] - teamRatings[team];
          expectedScore[otherTeam] = 1 / (1 + Math.pow(10, ratingDiff / 400));
        });
        
        // Calcular pontuação real
        const actualScore = team === winningTeam ? 1 : 0;
        
        // Calcular ajuste de rating
        const avgExpectedScore = Object.values(expectedScore).reduce((sum, val) => sum + val, 0) / Object.keys(expectedScore).length;
        const ratingChange = Math.round(RANKING_CONSTANTS.kFactor * (actualScore - avgExpectedScore));
        
        // Aplicar ajuste de rating a todos os jogadores da equipe
        teamPlayers[team].forEach(playerId => {
          const oldRating = this.getPlayerRating(playerId);
          const newRating = Math.max(0, oldRating + ratingChange);
          this.updatePlayerRating(playerId, newRating);
        });
      });
    }
    // Para partidas individuais (Deathmatch)
    else if (room.gameMode === GAME_MODES.DEATHMATCH) {
      // Ordenar jogadores por pontuação
      const rankedPlayers = room.players
        .filter(p => p.isActive)
        .sort((a, b) => {
          const scoreA = stats.playerStats[a.playerId]?.score || 0;
          const scoreB = stats.playerStats[b.playerId]?.score || 0;
          return scoreB - scoreA; // Ordem decrescente
        });
      
      // Calcular ratings
      for (let i = 0; i < rankedPlayers.length; i++) {
        const player = rankedPlayers[i];
        const playerRating = this.getPlayerRating(player.playerId);
        let ratingChange = 0;
        
        // Comparar com cada outro jogador
        for (let j = 0; j < rankedPlayers.length; j++) {
          if (i === j) continue;
          
          const opponent = rankedPlayers[j];
          const opponentRating = this.getPlayerRating(opponent.playerId);
          
          // Posição relativa: ganhou (i < j) ou perdeu (i > j)
          const actualScore = i < j ? 1 : 0;
          
          // Expectativa baseada em rating
          const ratingDiff = opponentRating - playerRating;
          const expectedScore = 1 / (1 + Math.pow(10, ratingDiff / 400));
          
          // Calcular mudança parcial
          const partialChange = RANKING_CONSTANTS.kFactor * (actualScore - expectedScore) / (rankedPlayers.length - 1);
          ratingChange += partialChange;
        }
        
        // Aplicar mudança limitada
        ratingChange = Math.max(RANKING_CONSTANTS.minRatingChange, Math.min(RANKING_CONSTANTS.maxRatingChange, ratingChange));
        
        // Atualizar rating
        const newRating = Math.max(0, playerRating + Math.round(ratingChange));
        this.updatePlayerRating(player.playerId, newRating);
      }
    }
  }

  /**
   * Limpar recursos da sala após o fim
   * @param {string} roomId - ID da sala
   */
  cleanupRoom(roomId) {
    const room = this.rooms.get(roomId);
    
    if (!room || room.state !== MATCHMAKING_ROOM_STATES.ENDING) {
      return;
    }
    
    // Remover a sala
    this.rooms.delete(roomId);
    
    // Notificar sistema de jogo para limpar recursos
    this.gameSystem.cleanupMatch(roomId);
  }

  /**
   * Balancear equipes em uma sala
   * @param {string} roomId - ID da sala
   */
  balanceTeams(roomId) {
    const room = this.rooms.get(roomId);
    
    if (!room) {
      return;
    }
    
    const gameMode = room.gameMode;
    
    // Não precisa balancear para deathmatch (todos contra todos)
    if (gameMode === GAME_MODES.DEATHMATCH) {
      return;
    }
    
    // Para partidas personalizadas, respeitar as escolhas manuais
    if (room.matchType === MATCH_TYPES.CUSTOM) {
      // Se nem todos os jogadores estão em uma equipe, distribuir os restantes
      const unassignedPlayers = room.players.filter(p => !p.team);
      
      if (unassignedPlayers.length === 0) {
        return;
      }
      
      // Obter equipes disponíveis
      let availableTeams = Object.keys(TEAMS).map(key => TEAMS[key].id);
      
      // Limitar a 2 equipes para a maioria dos modos
      if (gameMode !== GAME_MODES.DOMINATION) {
        availableTeams = availableTeams.slice(0, 2);
      }
      
      // Contagem atual por equipe
      const teamCounts = {};
      availableTeams.forEach(team => {
        teamCounts[team] = room.players.filter(p => p.team === team).length;
      });
      
      // Distribuir jogadores não atribuídos
      unassignedPlayers.forEach(player => {
        // Encontrar equipe com menos jogadores
        const teamsSorted = availableTeams.sort((a, b) => teamCounts[a] - teamCounts[b]);
        const targetTeam = teamsSorted[0];
        
        // Atribuir jogador à equipe
        const playerIndex = room.players.findIndex(p => p.playerId === player.playerId);
        room.players[playerIndex].team = targetTeam;
        
        // Atualizar contagem
        teamCounts[targetTeam]++;
        
        // Atualizar equipes na sala
        if (!room.teams[targetTeam]) {
          room.teams[targetTeam] = 0;
        }
        room.teams[targetTeam]++;
      });
      
      // Notificar jogadores sobre atribuições de equipe
      room.players.forEach(p => {
        this.networkSystem.sendToPlayer(p.playerId, 'matchmaking:teamAssignments', {
          assignments: room.players.map(player => ({
            playerId: player.playerId,
            team: player.team
          }))
        });
      });
      
      return;
    }
    
    // Para partidas competitivas e casuais, balancear baseado em habilidade
    
    // Ordenar jogadores por rating
    const sortedPlayers = [...room.players].sort((a, b) => {
      return this.getPlayerRating(b.playerId) - this.getPlayerRating(a.playerId);
    });
    
    // Determinar número de equipes
    let numTeams = 2; // Padrão para maioria dos modos
    if (gameMode === GAME_MODES.DOMINATION) {
      numTeams = Math.min(4, Math.ceil(sortedPlayers.length / 3)); // Até 4 equipes para dominação
    }
    
    // Obter equipes disponíveis
    const availableTeams = Object.keys(TEAMS).map(key => TEAMS[key].id).slice(0, numTeams);
    
    // Reiniciar contagem de equipes
    room.teams = {};
    availableTeams.forEach(team => {
      room.teams[team] = 0;
    });
    
    // Distribuir jogadores usando método serpentino para maximizar balanceamento
    // Exemplo com 4 jogadores e 2 equipes: [1, 3] para equipe A, [2, 4] para equipe B
    for (let i = 0; i < sortedPlayers.length; i++) {
      // Calcular índice da equipe
      let teamIndex;
      
      // Primeira metade da distribuição: 0, 1, 2, ..., n-1
      // Segunda metade da distribuição: n-1, n-2, ..., 0
      const fullCycles = Math.floor(i / numTeams);
      const position = i % numTeams;
      
      if (fullCycles % 2 === 0) {
        teamIndex = position;
      } else {
        teamIndex = numTeams - 1 - position;
      }
      
      const targetTeam = availableTeams[teamIndex];
      
      // Atribuir jogador à equipe
      const playerIndex = room.players.findIndex(p => p.playerId === sortedPlayers[i].playerId);
      
      if (playerIndex !== -1) {
        room.players[playerIndex].team = targetTeam;
        
        // Atualizar contagem
        room.teams[targetTeam]++;
      }
    }
    
    // Notificar jogadores sobre atribuições de equipe
    room.players.forEach(p => {
      this.networkSystem.sendToPlayer(p.playerId, 'matchmaking:teamAssignments', {
        assignments: room.players.map(player => ({
          playerId: player.playerId,
          team: player.team
        }))
      });
    });
  }

  /**
   * Verificar se um jogador está em uma partida
   * @param {string} playerId - ID do jogador
   * @returns {Object|null} Informações da sala ou null
   */
  getPlayerActiveMatch(playerId) {
    for (const [roomId, room] of this.rooms.entries()) {
      const playerInRoom = room.players.find(p => p.playerId === playerId);
      
      if (playerInRoom) {
        return {
          roomId,
          state: room.state,
          gameMode: room.gameMode,
          matchType: room.matchType
        };
      }
    }
    
    return null;
  }

  /**
   * Obter estatísticas do sistema de matchmaking
   * @returns {Object} Estatísticas
   */
  getStats() {
    const queueStats = {};
    
    Object.keys(this.queues).forEach(queueId => {
      queueStats[queueId] = {
        playersCount: this.queues[queueId].players.length,
        averageWaitTime: this.calculateAverageWaitTime(queueId)
      };
    });
    
    return {
      activeRooms: this.rooms.size,
      playersInQueue: this.playerQueues.size,
      disconnectedPlayers: this.disconnectedPlayers.size,
      penalizedPlayers: this.playerPenalties.size,
      queues: queueStats
    };
  }

  /**
   * Calcular tempo médio de espera em uma fila
   * @param {string} queueId - ID da fila
   * @returns {number} Tempo médio em segundos
   */
  calculateAverageWaitTime(queueId) {
    const queue = this.queues[queueId];
    
    if (!queue || queue.players.length === 0) {
      return 0;
    }
    
    const now = Date.now();
    const totalWaitTime = queue.players.reduce((sum, player) => {
      return sum + (now - player.joinTime);
    }, 0);
    
    return Math.round(totalWaitTime / queue.players.length / 1000);
  }

  /**
   * Liberar recursos do sistema
   */
  dispose() {
    if (this.matchmakingInterval) {
      clearInterval(this.matchmakingInterval);
      this.matchmakingInterval = null;
    }
    
    // Limpar eventos
    this.eventEmitter.clearAllEvents();
  }
}

export default MatchmakingSystem;