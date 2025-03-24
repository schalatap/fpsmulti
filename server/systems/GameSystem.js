const { v4: uuidv4 } = require('uuid');
const PositionComponent = require('../../shared/components/PositionComponent');
const PlayerComponent = require('../../shared/components/PlayerComponent');
const HealthComponent = require('../../shared/components/HealthComponent');
const PhysicsComponent = require('../../shared/components/PhysicsComponent');
const EventEmitter = require('../../shared/utils/EventEmitter');
const GameConfig = require('../../shared/constants/GameConfig');

/**
 * Sistema responsável pela lógica central do jogo e gerenciamento de partidas
 */
class GameSystem {
  /**
   * @param {Object} options - Opções para o sistema
   * @param {Object} options.entityManager - Gerenciador de entidades
   * @param {Object} options.networkSystem - Sistema de rede para comunicação
   * @param {Object} options.physicsSystem - Sistema de física
   */
  constructor(options = {}) {
    this.entityManager = options.entityManager;
    this.networkSystem = options.networkSystem;
    this.physicsSystem = options.physicsSystem;
    
    this.players = new Map(); // playerId -> entityId
    this.playerTeams = new Map(); // playerId -> team
    this.scores = { blue: 0, red: 0 };
    this.gameStatus = 'waiting'; // waiting, starting, active, ended
    this.matchTime = 0;
    this.maxMatchTime = GameConfig.MATCH_TIME;
    this.roundStartTime = 0;
    this.respawnQueue = [];
    this.respawnTime = GameConfig.RESPAWN_TIME;
    this.mapEntities = new Set();
    this.mapId = 'default';
    this.events = new EventEmitter();

    this.setupEventListeners();
  }

  /**
   * Inicializa o sistema de jogo
   * @returns {void}
   */
  initialize() {
    console.log('GameSystem initialized');
    this.createInitialMap();
  }

  /**
   * Configura os ouvintes de eventos
   * @private
   * @returns {void}
   */
  setupEventListeners() {
    // Pode adicionar eventos específicos conforme necessário
  }

  /**
   * Cria o mapa inicial com paredes e obstáculos
   * @returns {void}
   */
  createInitialMap() {
    // Cria chão
    const floorId = this.entityManager.createEntity();
    this.entityManager.addComponent(floorId, new PositionComponent({ x: 0, y: -0.5, z: 0 }));
    this.entityManager.addComponent(floorId, new PhysicsComponent({
      mass: 0, // massa 0 = estático
      friction: 0.5,
      restitution: 0.2,
    }));
    // Adiciona componente visual que será criado pelo sistema de renderização do cliente
    this.entityManager.addComponent(floorId, {
      type: 'RenderComponent',
      modelType: 'floor',
      shape: 'box',
      width: 100,
      height: 1,
      depth: 100,
      color: '#555555'
    });
    this.mapEntities.add(floorId);

    // Cria paredes e obstáculos
    this.createWall(-50, 0, 0, 1, 10, 100);
    this.createWall(50, 0, 0, 1, 10, 100);
    this.createWall(0, 0, -50, 100, 10, 1);
    this.createWall(0, 0, 50, 100, 10, 1);

    // Adiciona alguns obstáculos para cover
    this.createObstacle(-20, 0, -15);
    this.createObstacle(10, 0, 25);
    this.createObstacle(-5, 0, 5);
    this.createObstacle(20, 0, -20);
    this.createObstacle(-30, 0, 30);

    console.log('Initial map created with', this.mapEntities.size, 'entities');
  }

  /**
   * Cria uma parede no mapa
   * @param {number} x - Posição X
   * @param {number} y - Posição Y
   * @param {number} z - Posição Z
   * @param {number} width - Largura
   * @param {number} height - Altura
   * @param {number} depth - Profundidade
   * @returns {string} ID da entidade criada
   */
  createWall(x, y, z, width, height, depth) {
    const wallId = this.entityManager.createEntity();
    this.entityManager.addComponent(wallId, new PositionComponent({ x, y, z }));
    this.entityManager.addComponent(wallId, new PhysicsComponent({
      mass: 0,
      friction: 0.3,
      restitution: 0.1,
    }));
    // Adiciona componente visual que será criado pelo sistema de renderização do cliente
    this.entityManager.addComponent(wallId, {
      type: 'RenderComponent',
      modelType: 'wall',
      shape: 'box',
      width,
      height,
      depth,
      color: '#888888'
    });
    this.mapEntities.add(wallId);
    return wallId;
  }

  /**
   * Cria um obstáculo no mapa
   * @param {number} x - Posição X
   * @param {number} y - Posição Y
   * @param {number} z - Posição Z
   * @returns {string} ID da entidade criada
   */
  createObstacle(x, y, z) {
    const obstacleId = this.entityManager.createEntity();
    this.entityManager.addComponent(obstacleId, new PositionComponent({ x, y, z }));
    this.entityManager.addComponent(obstacleId, new PhysicsComponent({
      mass: 0,
      friction: 0.4,
      restitution: 0.1,
    }));
    
    // Randomiza o tamanho e tipo do obstáculo
    const types = ['box', 'cylinder'];
    const type = types[Math.floor(Math.random() * types.length)];
    const size = 2 + Math.random() * 3;
    const height = 2 + Math.random() * 4;
    
    // Adiciona componente visual que será criado pelo sistema de renderização do cliente
    this.entityManager.addComponent(obstacleId, {
      type: 'RenderComponent',
      modelType: 'obstacle',
      shape: type,
      width: size,
      height: height,
      depth: size,
      radius: size / 2,
      color: '#777777'
    });
    
    this.mapEntities.add(obstacleId);
    return obstacleId;
  }

  /**
   * Adiciona um novo jogador ao jogo
   * @param {string} socketId - ID do socket do jogador
   * @param {string} playerName - Nome do jogador
   * @returns {Object} Dados do jogador criado
   */
  addPlayer(socketId, playerName) {
    // Determina a equipe com menos jogadores
    const blueCount = Array.from(this.playerTeams.values()).filter(team => team === 'blue').length;
    const redCount = Array.from(this.playerTeams.values()).filter(team => team === 'red').length;
    const team = blueCount <= redCount ? 'blue' : 'red';
    
    // Cria uma entidade para o jogador
    const entityId = this.entityManager.createEntity();
    
    // Determina posição inicial baseada na equipe
    let x, z;
    if (team === 'blue') {
      x = -30 + Math.random() * 10;
      z = -30 + Math.random() * 10;
    } else {
      x = 30 - Math.random() * 10;
      z = 30 - Math.random() * 10;
    }
    
    // Adiciona componentes ao jogador
    this.entityManager.addComponent(entityId, new PositionComponent({ x, y: 1, z }));
    this.entityManager.addComponent(entityId, new PlayerComponent({
      id: socketId,
      name: playerName,
      team,
      isAlive: true,
      kills: 0,
      deaths: 0,
      score: 0
    }));
    this.entityManager.addComponent(entityId, new HealthComponent({
      currentHealth: 100,
      maxHealth: 100,
      regeneration: 1
    }));
    this.entityManager.addComponent(entityId, new PhysicsComponent({
      mass: 70, // massa de um humano médio em kg
      friction: 0.2,
      restitution: 0.1,
      collisionGroup: 2, // grupo de jogadores
    }));
    
    // Registra o jogador nas maps
    this.players.set(socketId, entityId);
    this.playerTeams.set(socketId, team);
    
    // Se o jogo estiver em espera e houver jogadores suficientes, inicia a partida
    if (this.gameStatus === 'waiting' && this.players.size >= GameConfig.MIN_PLAYERS) {
      this.startGame();
    }
    
    console.log(`Player ${playerName} (${socketId}) added to team ${team}`);
    
    // Cria armas iniciais para o jogador via WeaponSystem
    if (this.entityManager.getSystem('WeaponSystem')) {
      this.entityManager.getSystem('WeaponSystem').createWeaponForPlayer(socketId, 'pistol');
      this.entityManager.getSystem('WeaponSystem').createWeaponForPlayer(socketId, 'rifle');
    }
    
    // Retorna dados para notificar o cliente
    return {
      entityId,
      playerId: socketId,
      name: playerName,
      team,
      position: { x, y: 1, z },
      rotation: { x: 0, y: 0, z: 0 }
    };
  }

  /**
   * Remove um jogador do jogo
   * @param {string} socketId - ID do socket do jogador
   * @returns {boolean} Sucesso da operação
   */
  removePlayer(socketId) {
    if (!this.players.has(socketId)) {
      return false;
    }
    
    const entityId = this.players.get(socketId);
    
    // Remove entidade do gerenciador
    this.entityManager.removeEntity(entityId);
    
    // Remove das maps
    this.players.delete(socketId);
    this.playerTeams.delete(socketId);
    
    // Remove da fila de respawn se estiver presente
    this.respawnQueue = this.respawnQueue.filter(item => item.playerId !== socketId);
    
    // Se não houver jogadores suficientes, encerra a partida
    if (this.gameStatus === 'active' && this.players.size < GameConfig.MIN_PLAYERS) {
      this.endGame();
    }
    
    console.log(`Player ${socketId} removed`);
    return true;
  }

  /**
   * Processa a morte de um jogador
   * @param {string} playerId - ID do jogador que morreu
   * @param {string} killerId - ID do jogador que matou
   * @returns {void}
   */
  playerDeath(playerId, killerId) {
    if (!this.players.has(playerId)) {
      return;
    }
    
    const entityId = this.players.get(playerId);
    const playerComp = this.entityManager.getComponent(entityId, 'PlayerComponent');
    
    if (!playerComp || !playerComp.isAlive) {
      return; // Já está morto
    }
    
    // Atualiza o estado do jogador
    playerComp.isAlive = false;
    playerComp.deaths++;
    
    // Adiciona pontos para o assassino
    if (killerId && this.players.has(killerId) && killerId !== playerId) {
      const killerEntityId = this.players.get(killerId);
      const killerComp = this.entityManager.getComponent(killerEntityId, 'PlayerComponent');
      
      if (killerComp) {
        killerComp.kills++;
        killerComp.score += GameConfig.KILL_SCORE;
        
        // Adiciona pontos para a equipe
        const killerTeam = this.playerTeams.get(killerId);
        if (killerTeam) {
          this.scores[killerTeam]++;
        }
      }
    }
    
    // Agenda respawn
    this.respawnQueue.push({
      playerId,
      respawnTime: Date.now() + (this.respawnTime * 1000)
    });
    
    // Notifica os clientes sobre a morte
    if (this.networkSystem) {
      this.networkSystem.broadcastToAll('player:death', {
        playerId,
        killerId,
        timestamp: Date.now()
      });
    }
    
    // Verifica se a partida deve terminar
    this.checkGameEnd();
    
    console.log(`Player ${playerId} died, killed by ${killerId || 'world'}`);
  }

  /**
   * Processa o respawn de um jogador
   * @param {string} playerId - ID do jogador para respawn
   * @returns {boolean} Sucesso da operação
   */
  respawnPlayer(playerId) {
    if (!this.players.has(playerId)) {
      return false;
    }
    
    const entityId = this.players.get(playerId);
    const playerComp = this.entityManager.getComponent(entityId, 'PlayerComponent');
    const posComp = this.entityManager.getComponent(entityId, 'PositionComponent');
    const healthComp = this.entityManager.getComponent(entityId, 'HealthComponent');
    
    if (!playerComp || !posComp || !healthComp) {
      return false;
    }
    
    // Determina posição de respawn baseada na equipe
    const team = this.playerTeams.get(playerId);
    let x, z;
    
    if (team === 'blue') {
      x = -30 + Math.random() * 10;
      z = -30 + Math.random() * 10;
    } else {
      x = 30 - Math.random() * 10;
      z = 30 - Math.random() * 10;
    }
    
    // Atualiza componentes
    posComp.x = x;
    posComp.y = 1;
    posComp.z = z;
    posComp.rotationX = 0;
    posComp.rotationY = 0;
    posComp.rotationZ = 0;
    
    playerComp.isAlive = true;
    playerComp.respawnTime = 0;
    
    healthComp.currentHealth = healthComp.maxHealth;
    
    // Notifica os clientes sobre o respawn
    if (this.networkSystem) {
      this.networkSystem.broadcastToAll('player:respawn', {
        playerId,
        position: { x, y: 1, z },
        rotation: { x: 0, y: 0, z: 0 },
        timestamp: Date.now()
      });
    }
    
    console.log(`Player ${playerId} respawned at position ${x}, ${z}`);
    return true;
  }

  /**
   * Verifica se a partida deve terminar
   * @returns {boolean} Verdadeiro se a partida terminou
   */
  checkGameEnd() {
    // Verifica se o tempo acabou
    if (this.gameStatus === 'active' && Date.now() - this.roundStartTime >= this.maxMatchTime * 1000) {
      this.endGame();
      return true;
    }
    
    // Verifica se uma equipe atingiu a pontuação máxima
    if (this.gameStatus === 'active' && 
       (this.scores.blue >= GameConfig.SCORE_LIMIT || 
        this.scores.red >= GameConfig.SCORE_LIMIT)) {
      this.endGame();
      return true;
    }
    
    // Verifica se uma equipe não tem mais jogadores
    if (this.gameStatus === 'active') {
      const bluePlayers = Array.from(this.playerTeams.entries())
        .filter(([_, team]) => team === 'blue')
        .map(([id, _]) => id);
        
      const redPlayers = Array.from(this.playerTeams.entries())
        .filter(([_, team]) => team === 'red')
        .map(([id, _]) => id);
      
      if (bluePlayers.length === 0 || redPlayers.length === 0) {
        this.endGame();
        return true;
      }
    }
    
    return false;
  }

  /**
   * Finaliza a partida atual
   * @returns {void}
   */
  endGame() {
    if (this.gameStatus !== 'active') {
      return;
    }
    
    this.gameStatus = 'ended';
    const matchDuration = Math.floor((Date.now() - this.roundStartTime) / 1000);
    
    // Determina a equipe vencedora
    let winningTeam = 'draw';
    if (this.scores.blue > this.scores.red) {
      winningTeam = 'blue';
    } else if (this.scores.red > this.scores.blue) {
      winningTeam = 'red';
    }
    
    // Prepara resultados da partida
    const playerResults = [];
    for (const [playerId, entityId] of this.players.entries()) {
      const playerComp = this.entityManager.getComponent(entityId, 'PlayerComponent');
      if (playerComp) {
        playerResults.push({
          id: playerId,
          name: playerComp.name,
          team: playerComp.team,
          kills: playerComp.kills,
          deaths: playerComp.deaths,
          score: playerComp.score
        });
      }
    }
    
    // Ordena por pontuação
    playerResults.sort((a, b) => b.score - a.score);
    
    // Notifica os clientes sobre o fim da partida
    if (this.networkSystem) {
      this.networkSystem.broadcastToAll('match:end', {
        winningTeam,
        scores: this.scores,
        matchDuration,
        players: playerResults
      });
    }
    
    console.log(`Match ended. Winner: ${winningTeam}. Blue: ${this.scores.blue}, Red: ${this.scores.red}`);
    
    // Agenda reinício da partida
    setTimeout(() => {
      this.resetGame();
      this.startGame();
    }, GameConfig.MATCH_RESTART_DELAY * 1000);
  }

  /**
   * Reinicia o estado do jogo
   * @returns {void}
   */
  resetGame() {
    this.gameStatus = 'waiting';
    this.scores = { blue: 0, red: 0 };
    this.matchTime = 0;
    this.roundStartTime = 0;
    this.respawnQueue = [];
    
    // Reseta os jogadores
    for (const [playerId, entityId] of this.players.entries()) {
      const playerComp = this.entityManager.getComponent(entityId, 'PlayerComponent');
      const healthComp = this.entityManager.getComponent(entityId, 'HealthComponent');
      
      if (playerComp) {
        playerComp.isAlive = true;
        playerComp.kills = 0;
        playerComp.deaths = 0;
        playerComp.score = 0;
      }
      
      if (healthComp) {
        healthComp.currentHealth = healthComp.maxHealth;
      }
      
      // Força respawn para posição inicial
      this.respawnPlayer(playerId);
    }
    
    console.log('Game reset');
  }

  /**
   * Inicia uma nova partida
   * @returns {boolean} Sucesso da operação
   */
  startGame() {
    if (this.gameStatus !== 'waiting' || this.players.size < GameConfig.MIN_PLAYERS) {
      return false;
    }
    
    this.gameStatus = 'starting';
    
    // Notifica clientes sobre início da contagem regressiva
    if (this.networkSystem) {
      this.networkSystem.broadcastToAll('match:starting', {
        countdown: GameConfig.MATCH_START_COUNTDOWN,
        timestamp: Date.now()
      });
    }
    
    // Aguarda a contagem regressiva e inicia a partida
    setTimeout(() => {
      this.gameStatus = 'active';
      this.roundStartTime = Date.now();
      
      // Notifica clientes sobre início da partida
      if (this.networkSystem) {
        const blueTeam = Array.from(this.playerTeams.entries())
          .filter(([_, team]) => team === 'blue')
          .map(([id, _]) => id);
          
        const redTeam = Array.from(this.playerTeams.entries())
          .filter(([_, team]) => team === 'red')
          .map(([id, _]) => id);
        
        this.networkSystem.broadcastToAll('match:start', {
          mapId: this.mapId,
          matchTime: this.maxMatchTime,
          teams: {
            blue: blueTeam,
            red: redTeam
          },
          timestamp: Date.now()
        });
      }
      
      console.log('Match started');
    }, GameConfig.MATCH_START_COUNTDOWN * 1000);
    
    return true;
  }

  /**
   * Obtém o estado atual do jogo
   * @returns {Object} Estado do jogo
   */
  getGameState() {
    const players = [];
    
    for (const [playerId, entityId] of this.players.entries()) {
      const playerComp = this.entityManager.getComponent(entityId, 'PlayerComponent');
      const posComp = this.entityManager.getComponent(entityId, 'PositionComponent');
      const healthComp = this.entityManager.getComponent(entityId, 'HealthComponent');
      
      if (playerComp && posComp && healthComp) {
        players.push({
          id: playerId,
          entityId,
          name: playerComp.name,
          team: playerComp.team,
          isAlive: playerComp.isAlive,
          kills: playerComp.kills,
          deaths: playerComp.deaths,
          score: playerComp.score,
          position: {
            x: posComp.x,
            y: posComp.y,
            z: posComp.z
          },
          rotation: {
            x: posComp.rotationX,
            y: posComp.rotationY,
            z: posComp.rotationZ
          },
          health: {
            current: healthComp.currentHealth,
            max: healthComp.maxHealth
          }
        });
      }
    }
    
    return {
      status: this.gameStatus,
      scores: this.scores,
      matchTime: this.maxMatchTime,
      elapsedTime: this.gameStatus === 'active' ? Math.floor((Date.now() - this.roundStartTime) / 1000) : 0,
      players,
      mapId: this.mapId
    };
  }

  /**
   * Atualiza o sistema de jogo
   * @param {number} deltaTime - Tempo decorrido desde a última atualização em segundos
   * @returns {void}
   */
  update(deltaTime) {
    // Processa a fila de respawn
    const now = Date.now();
    const respawned = [];
    
    for (const item of this.respawnQueue) {
      if (now >= item.respawnTime) {
        this.respawnPlayer(item.playerId);
        respawned.push(item);
      }
    }
    
    // Remove jogadores que já deram respawn da fila
    this.respawnQueue = this.respawnQueue.filter(item => !respawned.includes(item));
    
    // Atualiza o tempo de partida
    if (this.gameStatus === 'active') {
      this.matchTime = Math.floor((now - this.roundStartTime) / 1000);
      
      // Verifica se o tempo acabou
      if (this.matchTime >= this.maxMatchTime) {
        this.checkGameEnd();
      }
    }
    
    // Envia estado do jogo regularmente
    if (this.networkSystem && this.gameStatus !== 'waiting') {
      // Enviamos o estado do jogo a cada segundo
      this.networkSystem.broadcastGameState();
    }
  }
}

module.exports = GameSystem;