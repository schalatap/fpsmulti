// client/systems/CoreSystem.js
import { EventEmitter } from '../../shared/utils/EventEmitter.js';
import { RenderSystem } from './RenderSystem.js';
import { InputSystem } from './InputSystem.js';
import { PhysicsSystem } from './PhysicsSystem.js';
import { NetworkSystem } from './NetworkSystem.js';
import { UISystem } from './UISystem.js';
import { WeaponSystem } from './WeaponSystem.js';
import { BallisticsSystem } from './BallisticsSystem.js';
import { CombatSystem } from './CombatSystem.js';
import { SpellSystem } from './SpellSystem.js';

/**
 * Sistema principal do cliente que orquestra todos os outros sistemas
 */
export class CoreSystem {
  constructor() {
    this.eventEmitter = new EventEmitter();
    this.systems = {};
    this.isRunning = false;
    this.lastTime = 0;
    this.entityId = null;
    this.playerName = '';
    this.initialized = false;
  }

  /**
   * Inicializa o sistema principal do cliente e todos os subsistemas
   * @param {Object} config Configuração inicial
   */
  async initialize(config = {}) {
    if (this.initialized) return;
    this.initialized = true;

    // Recuperar configurações
    const { 
      container = document.body,
      serverUrl = window.location.origin,
      playerName = 'Player_' + Math.floor(Math.random() * 1000) 
    } = config;

    this.playerName = playerName;
    
    // Criar sistemas na ordem correta
    this.systems.network = new NetworkSystem();
    this.systems.render = new RenderSystem();
    this.systems.input = new InputSystem();
    this.systems.physics = new PhysicsSystem();
    this.systems.ui = new UISystem();
    this.systems.weapon = new WeaponSystem();
    this.systems.ballistics = new BallisticsSystem();
    this.systems.combat = new CombatSystem();
    this.systems.spell = new SpellSystem();

    // Inicializar cada sistema
    console.log('Inicializando Core System...');
    
    // 1. Primeiro inicializar renderização
    await this.systems.render.initialize(container);
    console.log('Sistema de renderização inicializado');
    
    // 2. Inicializar UI
    this.systems.ui.initialize('ui-container', null);
    console.log('Sistema de UI inicializado');
    
    // 3. Inicializar input
    this.systems.input.initialize(this.systems.render.getRenderer().domElement);
    console.log('Sistema de input inicializado');
    
    // 4. Inicializar física
    await this.systems.physics.initialize();
    console.log('Sistema de física inicializado');
    
    // 5. Inicializar rede
    await this.systems.network.initialize(serverUrl);
    console.log('Sistema de rede inicializado');
    
    // 6. Configurar sistemas dependentes após rede
    this.systems.weapon.initialize(this.systems.render);
    this.systems.ballistics.initialize();
    this.systems.combat.initialize();
    
    // Configurar ouvintes de eventos
    this.setupEventListeners();

    // Iniciar o loop de atualização
    this.lastTime = performance.now();
    this.isRunning = true;
    requestAnimationFrame(this.update.bind(this));
    
    console.log('Core System inicializado com sucesso');
    return true;
  }

  /**
   * Configura os ouvintes de eventos para comunicação entre sistemas
   */
  setupEventListeners() {
    // Eventos de rede
    this.systems.network.subscribeToEvent('network:connected', () => {
      console.log('Conectado ao servidor');
      this.systems.ui.showMessage('Conectado ao servidor');
      this.joinGame();
    });

    this.systems.network.subscribeToEvent('network:disconnected', () => {
      console.log('Desconectado do servidor');
      this.systems.ui.showMessage('Desconectado do servidor. Tentando reconectar...');
    });

    this.systems.network.subscribeToEvent('player:joinConfirmed', (data) => {
      console.log('Entrada no jogo confirmada:', data);
      this.entityId = data.entityId;
      this.systems.ui.updatePlayerInfo({ id: data.playerId, name: this.playerName });
      this.systems.spell.initialize(data.playerId);
      this.systems.combat.initialize(data.playerId);
      this.systems.render.setPlayerEntity(data.entityId);
      this.systems.ui.hideMenu('login');
      this.systems.ui.showMenu('hud');
    });

    // Eventos de input para rede
    this.systems.input.subscribe('input:move', (data) => {
      if (this.entityId) {
        this.systems.network.sendToServer('player:move', {
          ...data,
          timestamp: performance.now()
        });
      }
    });

    this.systems.input.subscribe('input:jump', () => {
      if (this.entityId) {
        this.systems.network.sendToServer('player:jump', {
          timestamp: performance.now()
        });
      }
    });

    this.systems.input.subscribe('input:fire', () => {
      if (this.entityId) {
        this.systems.weapon.handleFireInput();
      }
    });

    this.systems.input.subscribe('input:reload', () => {
      if (this.entityId) {
        this.systems.weapon.handleReloadInput();
      }
    });

    this.systems.input.subscribe('input:switch', (data) => {
      if (this.entityId) {
        this.systems.weapon.handleSwitchInput(data);
      }
    });

    // Eventos de jogadores remotos
    this.systems.network.subscribeToEvent('player:join', (data) => {
      console.log('Novo jogador entrou:', data);
      // Criar entidade para jogador remoto
      this.createRemotePlayerEntity(data);
    });

    this.systems.network.subscribeToEvent('player:leave', (data) => {
      console.log('Jogador saiu:', data);
      // Remover entidade do jogador remoto
      this.removeRemotePlayerEntity(data);
    });

    // Eventos de posição
    this.systems.network.subscribeToEvent('player:move', (data) => {
      // Atualizar posição de jogador remoto
      this.updateRemotePlayerPosition(data);
    });

    // Eventos de combate
    this.systems.network.subscribeToEvent('player:damage', (data) => {
      this.systems.combat.handlePlayerDamage(data);
    });

    this.systems.network.subscribeToEvent('player:death', (data) => {
      this.systems.combat.handlePlayerDeath(data);
    });

    // Eventos de armas
    this.systems.network.subscribeToEvent('player:shoot', (data) => {
      this.systems.weapon.handleRemotePlayerShoot(data);
    });

    this.systems.network.subscribeToEvent('player:reload', (data) => {
      this.systems.weapon.handleRemotePlayerReload(data);
    });

    this.systems.network.subscribeToEvent('player:switchWeapon', (data) => {
      this.systems.weapon.handleRemotePlayerSwitch(data);
    });

    // Eventos de projéteis
    this.systems.network.subscribeToEvent('projectile:hit', (data) => {
      this.systems.ballistics.handleProjectileHit(data);
    });

    // Eventos de magias
    this.systems.network.subscribeToEvent('spell:effect', (data) => {
      this.systems.spell.handleSpellEffect(data);
    });

    this.systems.network.subscribeToEvent('spell:remove', (data) => {
      this.systems.spell.handleSpellRemove(data);
    });

    // Eventos de partida
    this.systems.network.subscribeToEvent('match:start', (data) => {
      console.log('Partida iniciada:', data);
      this.systems.ui.updateGameState(data);
    });

    this.systems.network.subscribeToEvent('match:end', (data) => {
      console.log('Partida finalizada:', data);
      this.systems.ui.showMatchResults(data);
    });

    // Eventos de UI
    this.systems.ui.on('ui:chatOpen', () => {
      this.systems.input.resetAllInputStates();
      this.systems.input.exitPointerLock();
    });

    this.systems.ui.on('ui:chatClose', () => {
      this.systems.input.requestPointerLock();
    });

    this.systems.ui.on('player:chatMessage', (message) => {
      this.systems.network.sendToServer('chat:message', { message });
    });

    // Eventos de chat
    this.systems.network.subscribeToEvent('chat:message', (data) => {
      this.systems.ui.addChatMessage(data.playerName, data.message);
    });
  }

  /**
   * Solicita entrada no jogo
   */
  joinGame() {
    const teamPreference = Math.random() > 0.5 ? 'red' : 'blue';
    this.systems.network.sendToServer('player:join', {
      name: this.playerName,
      team: teamPreference
    });
  }

  /**
   * Cria uma entidade para um jogador remoto
   * @param {Object} data Dados do jogador remoto
   */
  createRemotePlayerEntity(data) {
    // Implementação simples para criar uma entidade visual para o jogador remoto
    const entityId = data.entityId;
    
    // Registrar no sistema de rede
    this.systems.network.registerRemotePlayer(data.playerId, entityId);
    
    // Criar componentes visuais e físicos básicos
    const playerColor = data.team === 'red' ? 0xff0000 : 0x0000ff;
    
    // Adicionar ao sistema de renderização
    const renderComponent = {
      modelType: 'player',
      color: playerColor,
      visible: true
    };
    
    this.systems.render.createPlayerModel(renderComponent);
    this.systems.render.addEntity({ id: entityId, components: { render: renderComponent, position: data.position } });
  }

  /**
   * Remove a entidade de um jogador remoto
   * @param {Object} data Dados do jogador que saiu
   */
  removeRemotePlayerEntity(data) {
    const entityId = this.systems.network.getRemotePlayerEntityId(data.playerId);
    if (entityId) {
      this.systems.render.removeEntity(entityId);
      this.systems.network.unregisterRemotePlayer(data.playerId);
    }
  }

  /**
   * Atualiza a posição de um jogador remoto
   * @param {Object} data Dados de movimento
   */
  updateRemotePlayerPosition(data) {
    if (data.playerId === this.playerId) return; // Ignorar próprio jogador
    
    const entityId = this.systems.network.getRemotePlayerEntityId(data.playerId);
    if (entityId) {
      // Atualizar posição na renderização
      this.systems.render.updateEntityPosition(entityId, data.position, data.rotation);
    }
  }

  /**
   * Loop de atualização principal
   * @param {number} timestamp Tempo atual
   */
  update(timestamp) {
    if (!this.isRunning) return;
    
    // Calcular delta time em segundos
    const deltaTime = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;
    
    // Limitar delta para evitar problemas com tabs inativos
    const clampedDelta = Math.min(deltaTime, 0.1);
    
    // Atualizar todos os sistemas
    this.systems.input.update(clampedDelta);
    this.systems.physics.update(clampedDelta);
    this.systems.weapon.update(clampedDelta);
    this.systems.ballistics.update(clampedDelta);
    this.systems.combat.update(clampedDelta);
    this.systems.spell.update(clampedDelta);
    this.systems.network.update(clampedDelta);
    this.systems.ui.update(clampedDelta);
    
    // A renderização é atualizada automaticamente pelo seu próprio loop interno
    
    // Continuar o loop
    requestAnimationFrame(this.update.bind(this));
  }

  /**
   * Para o sistema e libera recursos
   */
  dispose() {
    this.isRunning = false;
    
    // Desligar sistemas na ordem inversa
    Object.values(this.systems).reverse().forEach(system => {
      if (system && typeof system.dispose === 'function') {
        system.dispose();
      }
    });
    
    this.systems = {};
    this.initialized = false;
    console.log('Core System desligado');
  }
}