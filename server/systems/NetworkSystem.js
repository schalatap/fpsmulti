// server/systems/NetworkSystem.js
const socketIO = require('socket.io');
const { EventEmitter } = require('../../shared/utils/EventEmitter.js');

class NetworkSystem {
  constructor(server, gameSystem) {
    this.io = null;
    this.eventEmitter = new EventEmitter();
    this.gameSystem = gameSystem;
    this.server = server;
    this.players = new Map(); // socketId -> player
    this.rooms = new Map(); // roomId -> set of socketIds
    this.chatFilter = new Set(['badword1', 'badword2']); // palavras a serem filtradas
    this.playerPings = new Map(); // socketId -> ping
    this.clientServerTimeDiff = new Map(); // socketId -> time difference
    this.lastGameStateUpdate = 0;
    this.gameStateUpdateInterval = 100; // 10 atualizações por segundo
    this.maxNameLength = 16;
  }

  initialize() {
    // Configurar Socket.IO com o servidor HTTP
    this.io = socketIO(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    
    // Evento de conexão de socket
    this.io.on('connection', (socket) => this.handleConnection(socket));
    
    // Iniciar intervalos para atualização de estado do jogo
    setInterval(() => this.broadcastGameState(), this.gameStateUpdateInterval);
    
    console.log('NetworkSystem initialized on server');
    return this;
  }

  handleConnection(socket) {
    console.log(`New connection: ${socket.id}`);
    
    // Configurar eventos para este cliente
    this.setupClientEvents(socket);
    
    // Enviar mensagem de boas-vindas para o novo cliente
    socket.emit('network:welcome', {
      message: 'Welcome to FPS Mágico Multiplayer',
      socketId: socket.id,
      serverTime: Date.now()
    });
  }

  setupClientEvents(socket) {
    // Manipular desconexão
    socket.on('disconnect', () => this.handleDisconnect(socket));
    
    // Eventos específicos do jogo
    socket.on('player:join', (data) => this.handlePlayerJoin(socket, data));
    socket.on('player:move', (data) => this.handlePlayerMove(socket, data));
    socket.on('player:shoot', (data) => this.handlePlayerShoot(socket, data));
    socket.on('player:jump', (data) => this.handlePlayerJump(socket, data));
    socket.on('player:reload', (data) => this.handlePlayerReload(socket, data));
    socket.on('player:switchWeapon', (data) => this.handlePlayerSwitchWeapon(socket, data));
    socket.on('player:castSpell', (data) => this.handlePlayerCastSpell(socket, data));
    socket.on('chat:message', (data) => this.handleChatMessage(socket, data));
    
    // Ping/pong para medir latência
    socket.on('ping', (clientTime) => {
      socket.emit('pong', Date.now());
      
      // Calcular e armazenar ping se clientTime estiver disponível
      if (clientTime) {
        const ping = Date.now() - clientTime;
        this.playerPings.set(socket.id, ping);
      }
    });
    
    // Sincronização de tempo
    socket.on('time:sync', (clientTime) => {
      const serverTime = Date.now();
      socket.emit('time:sync', serverTime);
      
      // Armazenar diferença de tempo entre cliente e servidor
      if (clientTime) {
        this.clientServerTimeDiff.set(socket.id, serverTime - clientTime);
      }
    });
  }

  handleDisconnect(socket) {
    console.log(`Client disconnected: ${socket.id}`);
    
    // Remover jogador do jogo se estiver ativo
    if (this.players.has(socket.id)) {
      const player = this.players.get(socket.id);
      const roomId = player.roomId;
      
      // Remover jogador do jogo
      this.gameSystem.removePlayer(socket.id);
      
      // Informar outros jogadores
      this.broadcastToRoomExcept(roomId, socket.id, 'player:leave', {
        playerId: socket.id,
        reason: 'disconnected'
      });
      
      // Remover jogador da sala
      if (this.rooms.has(roomId)) {
        this.rooms.get(roomId).delete(socket.id);
        // Se a sala ficar vazia, removê-la
        if (this.rooms.get(roomId).size === 0) {
          this.rooms.delete(roomId);
          console.log(`Room ${roomId} removed (empty)`);
        }
      }
      
      // Remover jogador da lista
      this.players.delete(socket.id);
      this.playerPings.delete(socket.id);
      this.clientServerTimeDiff.delete(socket.id);
      
      console.log(`Player ${player.name} (${socket.id}) removed from game`);
    }
  }

  handlePlayerJoin(socket, data) {
    console.log(`Player join request: ${socket.id}`, data);
    
    // Validar dados
    if (!data.name || typeof data.name !== 'string') {
      socket.emit('player:joinRejected', {
        reason: 'Invalid player name'
      });
      return;
    }
    
    // Limitar tamanho do nome
    let playerName = data.name.trim().substring(0, this.maxNameLength);
    
    // Se o nome ficar vazio após trim, gerar um nome
    if (playerName.length === 0) {
      playerName = `Player${Math.floor(Math.random() * 10000)}`;
    }
    
    // Verificar se o jogador já está em jogo
    if (this.players.has(socket.id)) {
      socket.emit('player:joinRejected', {
        reason: 'Already joined'
      });
      return;
    }
    
    // Determinar sala (por enquanto, uma sala única - implementar matchmaking depois)
    const roomId = 'mainRoom';
    
    // Adicionar jogador à sala
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }
    this.rooms.get(roomId).add(socket.id);
    
    // Adicionar jogador ao sistema de jogo
    const entityId = this.gameSystem.addPlayer(socket.id, playerName);
    if (!entityId) {
      socket.emit('player:joinRejected', {
        reason: 'Game system error'
      });
      return;
    }
    
    // Armazenar informações do jogador
    this.players.set(socket.id, {
      id: socket.id,
      name: playerName,
      entityId: entityId,
      roomId: roomId,
      team: data.team || null,
      joinTime: Date.now()
    });
    
    // Entrar na sala Socket.IO
    socket.join(roomId);
    
    // Confirmar entrada no jogo para o jogador
    socket.emit('player:joinConfirmed', {
      playerId: socket.id,
      entityId: entityId,
      name: playerName,
      team: data.team || null,
      roomId: roomId,
      serverTime: Date.now()
    });
    
    // Enviar listagem de outros jogadores já na sala
    const otherPlayers = [];
    this.rooms.get(roomId).forEach(pid => {
      if (pid !== socket.id && this.players.has(pid)) {
        const p = this.players.get(pid);
        otherPlayers.push({
          playerId: pid,
          entityId: p.entityId,
          name: p.name,
          team: p.team
        });
      }
    });
    
    socket.emit('player:otherPlayers', {
      players: otherPlayers
    });
    
    // Informar outros jogadores sobre o novo jogador
    this.broadcastToRoomExcept(roomId, socket.id, 'player:join', {
      playerId: socket.id,
      entityId: entityId,
      name: playerName,
      team: data.team || null
    });
    
    console.log(`Player ${playerName} (${socket.id}) joined room ${roomId}`);
  }

  handlePlayerMove(socket, data) {
    if (!this.validatePlayer(socket.id)) return;
    
    // Validar dados
    if (!data.position || !data.rotation) return;
    
    // Validar movimento através do sistema de física
    const isValid = this.gameSystem.validatePlayerMovement(
      socket.id, 
      data.position, 
      data.velocity || { x: 0, y: 0, z: 0 }
    );
    
    if (!isValid) {
      // Se inválido, enviar correção
      const correctedPosition = this.gameSystem.getPlayerPosition(socket.id);
      socket.emit('physics:positionCorrected', {
        position: correctedPosition
      });
      return;
    }
    
    // Atualizar posição do jogador no gameSystem
    this.gameSystem.updatePlayerPosition(socket.id, data.position, data.rotation, data.velocity);
    
    // Transmitir movimento para outros jogadores na sala
    const player = this.players.get(socket.id);
    this.broadcastToRoomExcept(player.roomId, socket.id, 'player:move', {
      playerId: socket.id,
      position: data.position,
      rotation: data.rotation,
      velocity: data.velocity || { x: 0, y: 0, z: 0 },
      timestamp: Date.now()
    });
  }

  handlePlayerShoot(socket, data) {
    if (!this.validatePlayer(socket.id)) return;
    
    // Validar dados
    if (!data.position || !data.direction || data.weaponId === undefined) return;
    
    // Processar tiro através do sistema de armas/balística
    const shootResult = this.gameSystem.handlePlayerShoot(socket.id, data);
    
    if (shootResult.valid) {
      // Transmitir tiro para todos os jogadores na sala (incluindo o atirador para efeitos visuais)
      const player = this.players.get(socket.id);
      this.broadcastToRoom(player.roomId, 'player:shoot', {
        playerId: socket.id,
        weaponId: data.weaponId,
        position: data.position,
        direction: data.direction,
        timestamp: Date.now()
      });
    }
  }

  handlePlayerJump(socket, data) {
    if (!this.validatePlayer(socket.id)) return;
    
    // Validar se o jogador pode pular (está no chão)
    const canJump = this.gameSystem.canPlayerJump(socket.id);
    
    if (canJump) {
      // Processar pulo
      this.gameSystem.playerJump(socket.id);
      
      // Transmitir evento de pulo para outros jogadores
      const player = this.players.get(socket.id);
      this.broadcastToRoom(player.roomId, 'player:jump', {
        playerId: socket.id,
        timestamp: Date.now()
      });
    }
  }

  handlePlayerReload(socket, data) {
    if (!this.validatePlayer(socket.id)) return;
    
    // Validar dados
    if (data.weaponId === undefined) return;
    
    // Processar recarga
    const reloadResult = this.gameSystem.handlePlayerReload(socket.id, data.weaponId);
    
    if (reloadResult.valid) {
      // Transmitir recarga para todos na sala
      const player = this.players.get(socket.id);
      this.broadcastToRoom(player.roomId, 'player:reload', {
        playerId: socket.id,
        weaponId: data.weaponId,
        timestamp: Date.now()
      });
    }
  }

  handlePlayerSwitchWeapon(socket, data) {
    if (!this.validatePlayer(socket.id)) return;
    
    // Validar dados
    if (data.weaponId === undefined) return;
    
    // Processar troca de arma
    const switchResult = this.gameSystem.handlePlayerSwitchWeapon(socket.id, data.weaponId);
    
    if (switchResult.valid) {
      // Transmitir troca para todos na sala
      const player = this.players.get(socket.id);
      this.broadcastToRoom(player.roomId, 'player:switchWeapon', {
        playerId: socket.id,
        weaponId: data.weaponId,
        timestamp: Date.now()
      });
    }
  }

  handlePlayerCastSpell(socket, data) {
    if (!this.validatePlayer(socket.id)) return;
    
    // Validar dados
    if (!data.spellId || !data.position) return;
    
    // Processar lançamento de magia
    const castResult = this.gameSystem.handlePlayerCastSpell(socket.id, data);
    
    if (castResult.valid) {
      // Transmitir lançamento para todos na sala
      const player = this.players.get(socket.id);
      this.broadcastToRoom(player.roomId, 'player:castSpell', {
        playerId: socket.id,
        spellId: data.spellId,
        position: data.position,
        direction: data.direction,
        targetId: data.targetId,
        targetPosition: data.targetPosition,
        timestamp: Date.now()
      });
    }
  }

  handleChatMessage(socket, data) {
    if (!this.validatePlayer(socket.id)) return;
    
    // Validar dados
    if (!data.message || typeof data.message !== 'string' || data.message.trim().length === 0) return;
    
    const player = this.players.get(socket.id);
    const filteredMessage = this.filterChatMessage(data.message.substring(0, 200)); // Limitar tamanho
    
    // Preparar mensagem
    const chatMessage = {
      playerId: socket.id,
      playerName: player.name,
      message: filteredMessage,
      team: player.team,
      timestamp: Date.now()
    };
    
    // Determinar escopo da mensagem (equipe ou global)
    if (data.teamOnly && player.team) {
      // Mensagem de equipe
      this.broadcastToTeam(player.roomId, player.team, 'chat:message', chatMessage);
    } else {
      // Mensagem global
      this.broadcastToRoom(player.roomId, 'chat:message', chatMessage);
    }
  }

  filterChatMessage(message) {
    // Filtro simples para palavras inapropriadas
    let filtered = message;
    this.chatFilter.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      filtered = filtered.replace(regex, '*'.repeat(word.length));
    });
    return filtered;
  }

  validatePlayer(socketId) {
    // Verificar se o jogador existe e está em uma sala
    if (!this.players.has(socketId)) {
      console.warn(`Invalid player: ${socketId}`);
      return false;
    }
    return true;
  }

  sendToPlayer(playerId, eventType, data) {
    if (this.io) {
      this.io.to(playerId).emit(eventType, data);
    }
  }

  broadcastToRoom(roomId, eventType, data) {
    if (this.io) {
      this.io.to(roomId).emit(eventType, data);
    }
  }

  broadcastToRoomExcept(roomId, exceptPlayerId, eventType, data) {
    if (this.io) {
      this.io.to(roomId).except(exceptPlayerId).emit(eventType, data);
    }
  }

  broadcastToTeam(roomId, team, eventType, data) {
    if (!this.io || !this.rooms.has(roomId)) return;
    
    // Enviar apenas para jogadores da mesma equipe
    this.rooms.get(roomId).forEach(socketId => {
      const player = this.players.get(socketId);
      if (player && player.team === team) {
        this.sendToPlayer(socketId, eventType, data);
      }
    });
  }

  broadcastToAll(eventType, data) {
    if (this.io) {
      this.io.emit(eventType, data);
    }
  }

  broadcastGameState() {
    const now = Date.now();
    if (now - this.lastGameStateUpdate < this.gameStateUpdateInterval) return;
    this.lastGameStateUpdate = now;
    
    // Para cada sala, enviar o estado atual do jogo
    this.rooms.forEach((players, roomId) => {
      // Obter estado do jogo para esta sala
      const gameState = this.gameSystem.getGameState(roomId);
      
      // Adicionar informações de ping
      const playerStates = gameState.players.map(player => {
        return {
          ...player,
          ping: this.playerPings.get(player.id) || 0
        };
      });
      
      // Enviar estado atualizado para todos na sala
      this.broadcastToRoom(roomId, 'game:state', {
        ...gameState,
        players: playerStates,
        timestamp: now
      });
    });
  }

  getPlayerCount() {
    return this.players.size;
  }

  getRoomCount() {
    return this.rooms.size;
  }

  getPlayersInRoom(roomId) {
    if (!this.rooms.has(roomId)) return [];
    
    const players = [];
    this.rooms.get(roomId).forEach(socketId => {
      if (this.players.has(socketId)) {
        players.push(this.players.get(socketId));
      }
    });
    
    return players;
  }

  getPlayerName(playerId) {
    if (this.players.has(playerId)) {
      return this.players.get(playerId).name;
    }
    return null;
  }

  dispose() {
    if (this.io) {
      this.io.disconnectSockets(true);
      // Note: Socket.IO não tem um método dispose() ou close() para o objeto io
      // A limpeza completa depende do servidor HTTP subjacente
    }
    
    this.players.clear();
    this.rooms.clear();
    this.playerPings.clear();
    this.clientServerTimeDiff.clear();
    this.eventEmitter.clearAllEvents();
    
    console.log('NetworkSystem disposed');
  }
}

module.exports = NetworkSystem;