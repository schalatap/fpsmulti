/**
 * @fileoverview Sistema de UI (Interface do Usuário) para o cliente
 * Responsável por gerenciar a interface do jogo, mostrando informações
 * do jogador, menus, e feedbacks visuais.
 */

import { EventSystem } from '../../shared/utils/EventSystem.js';

class UISystem {
  /**
   * Construtor do sistema de UI
   */
  constructor() {
    this.elements = {};
    this.menus = {};
    this.isInitialized = false;
    this.localPlayerId = null;
    this.feedMessages = [];
    this.chatMessages = [];
    this.maxChatMessages = 50;
    this.maxFeedMessages = 5;
    this.feedMessageDuration = 5000; // 5 segundos
    this.overlays = {
      damage: null,
      healing: null,
      effect: null
    };
    this.hudData = {
      health: 100,
      maxHealth: 100,
      mana: 100,
      maxMana: 100,
      currentAmmo: 0,
      maxAmmo: 0,
      reserveAmmo: 0,
      weaponType: 'none',
      kills: 0,
      deaths: 0,
      score: 0
    };
  }

  /**
   * Inicializa o sistema de UI
   * @param {string} containerId - ID do elemento HTML que conterá a UI
   * @param {string} localPlayerId - ID do jogador local
   */
  initialize(containerId, localPlayerId) {
    if (this.isInitialized) {
      console.warn('UISystem já inicializado');
      return;
    }

    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error(`Elemento com ID ${containerId} não encontrado`);
      return;
    }

    this.localPlayerId = localPlayerId;
    this.createUIElements();
    this.setupEventListeners();
    this.isInitialized = true;

    console.log('UISystem inicializado');
  }

  /**
   * Cria os elementos da UI
   */
  createUIElements() {
    // Container principal da HUD
    this.elements.hud = document.createElement('div');
    this.elements.hud.className = 'hud';
    
    // Container de informações do jogador (saúde, mana, munição)
    this.elements.playerInfo = document.createElement('div');
    this.elements.playerInfo.className = 'player-info';
    
    // Barra de saúde
    this.elements.healthContainer = document.createElement('div');
    this.elements.healthContainer.className = 'health-container';
    this.elements.healthLabel = document.createElement('div');
    this.elements.healthLabel.className = 'info-label';
    this.elements.healthLabel.textContent = 'SAÚDE';
    this.elements.healthBar = document.createElement('div');
    this.elements.healthBar.className = 'health-bar';
    this.elements.healthValue = document.createElement('div');
    this.elements.healthValue.className = 'health-value';
    this.elements.healthValue.textContent = '100/100';
    this.elements.healthContainer.appendChild(this.elements.healthLabel);
    this.elements.healthContainer.appendChild(this.elements.healthBar);
    this.elements.healthContainer.appendChild(this.elements.healthValue);
    
    // Barra de mana
    this.elements.manaContainer = document.createElement('div');
    this.elements.manaContainer.className = 'mana-container';
    this.elements.manaLabel = document.createElement('div');
    this.elements.manaLabel.className = 'info-label';
    this.elements.manaLabel.textContent = 'MANA';
    this.elements.manaBar = document.createElement('div');
    this.elements.manaBar.className = 'mana-bar';
    this.elements.manaValue = document.createElement('div');
    this.elements.manaValue.className = 'mana-value';
    this.elements.manaValue.textContent = '100/100';
    this.elements.manaContainer.appendChild(this.elements.manaLabel);
    this.elements.manaContainer.appendChild(this.elements.manaBar);
    this.elements.manaContainer.appendChild(this.elements.manaValue);
    
    // Informação de arma e munição
    this.elements.weaponInfo = document.createElement('div');
    this.elements.weaponInfo.className = 'weapon-info';
    this.elements.weaponName = document.createElement('div');
    this.elements.weaponName.className = 'weapon-name';
    this.elements.weaponName.textContent = 'Nenhuma Arma';
    this.elements.ammoInfo = document.createElement('div');
    this.elements.ammoInfo.className = 'ammo-info';
    this.elements.ammoInfo.textContent = '0/0';
    this.elements.weaponInfo.appendChild(this.elements.weaponName);
    this.elements.weaponInfo.appendChild(this.elements.ammoInfo);
    
    // Adiciona os elementos de informação do jogador
    this.elements.playerInfo.appendChild(this.elements.healthContainer);
    this.elements.playerInfo.appendChild(this.elements.manaContainer);
    this.elements.playerInfo.appendChild(this.elements.weaponInfo);
    
    // Container de score
    this.elements.scoreInfo = document.createElement('div');
    this.elements.scoreInfo.className = 'score-info';
    this.elements.kills = document.createElement('div');
    this.elements.kills.className = 'kills';
    this.elements.kills.textContent = 'Abates: 0';
    this.elements.deaths = document.createElement('div');
    this.elements.deaths.className = 'deaths';
    this.elements.deaths.textContent = 'Mortes: 0';
    this.elements.score = document.createElement('div');
    this.elements.score.className = 'score';
    this.elements.score.textContent = 'Pontos: 0';
    this.elements.scoreInfo.appendChild(this.elements.kills);
    this.elements.scoreInfo.appendChild(this.elements.deaths);
    this.elements.scoreInfo.appendChild(this.elements.score);
    
    // Feed de abates
    this.elements.killFeed = document.createElement('div');
    this.elements.killFeed.className = 'kill-feed';
    
    // Indicador de crosshair
    this.elements.crosshair = document.createElement('div');
    this.elements.crosshair.className = 'crosshair';
    
    // Indicadores de dano
    this.elements.damageIndicators = document.createElement('div');
    this.elements.damageIndicators.className = 'damage-indicators';
    
    // Chat
    this.elements.chatContainer = document.createElement('div');
    this.elements.chatContainer.className = 'chat-container';
    this.elements.chatMessages = document.createElement('div');
    this.elements.chatMessages.className = 'chat-messages';
    this.elements.chatInput = document.createElement('input');
    this.elements.chatInput.type = 'text';
    this.elements.chatInput.className = 'chat-input';
    this.elements.chatInput.placeholder = 'Pressione Enter para chat...';
    this.elements.chatInput.style.display = 'none';
    this.elements.chatContainer.appendChild(this.elements.chatMessages);
    this.elements.chatContainer.appendChild(this.elements.chatInput);
    
    // Adiciona os elementos à HUD
    this.elements.hud.appendChild(this.elements.playerInfo);
    this.elements.hud.appendChild(this.elements.scoreInfo);
    this.elements.hud.appendChild(this.elements.killFeed);
    this.elements.hud.appendChild(this.elements.crosshair);
    this.elements.hud.appendChild(this.elements.damageIndicators);
    this.elements.hud.appendChild(this.elements.chatContainer);
    
    // Overlays (tela de morte, menu de pausa, fim de partida)
    this.createOverlays();
    
    // Adiciona a HUD ao container
    this.container.appendChild(this.elements.hud);
    
    this.createStyle();
  }

  /**
   * Cria os overlays da UI (menus, tela de morte)
   */
  createOverlays() {
    // Overlay de morte
    this.menus.deathScreen = document.createElement('div');
    this.menus.deathScreen.className = 'overlay death-screen';
    this.menus.deathScreen.style.display = 'none';
    const deathTitle = document.createElement('h2');
    deathTitle.textContent = 'VOCÊ MORREU';
    this.menus.deathRespawnTimer = document.createElement('div');
    this.menus.deathRespawnTimer.className = 'respawn-timer';
    this.menus.deathRespawnTimer.textContent = 'Renascendo em 5...';
    this.menus.deathScreen.appendChild(deathTitle);
    this.menus.deathScreen.appendChild(this.menus.deathRespawnTimer);
    
    // Menu de pausa
    this.menus.pauseMenu = document.createElement('div');
    this.menus.pauseMenu.className = 'overlay pause-menu';
    this.menus.pauseMenu.style.display = 'none';
    const pauseTitle = document.createElement('h2');
    pauseTitle.textContent = 'PAUSADO';
    const resumeButton = document.createElement('button');
    resumeButton.textContent = 'Continuar';
    resumeButton.addEventListener('click', () => this.hideMenu('pauseMenu'));
    const optionsButton = document.createElement('button');
    optionsButton.textContent = 'Opções';
    const quitButton = document.createElement('button');
    quitButton.textContent = 'Sair';
    this.menus.pauseMenu.appendChild(pauseTitle);
    this.menus.pauseMenu.appendChild(resumeButton);
    this.menus.pauseMenu.appendChild(optionsButton);
    this.menus.pauseMenu.appendChild(quitButton);
    
    // Menu de fim de partida
    this.menus.matchEndScreen = document.createElement('div');
    this.menus.matchEndScreen.className = 'overlay match-end-screen';
    this.menus.matchEndScreen.style.display = 'none';
    const matchEndTitle = document.createElement('h2');
    matchEndTitle.textContent = 'FIM DE PARTIDA';
    this.menus.matchResults = document.createElement('div');
    this.menus.matchResults.className = 'match-results';
    const newMatchButton = document.createElement('button');
    newMatchButton.textContent = 'Nova Partida';
    this.menus.matchEndScreen.appendChild(matchEndTitle);
    this.menus.matchEndScreen.appendChild(this.menus.matchResults);
    this.menus.matchEndScreen.appendChild(newMatchButton);
    
    // Overlay de dano
    this.overlays.damage = document.createElement('div');
    this.overlays.damage.className = 'damage-overlay';
    
    // Overlay de cura
    this.overlays.healing = document.createElement('div');
    this.overlays.healing.className = 'healing-overlay';
    
    // Overlay de efeito (debuff, etc)
    this.overlays.effect = document.createElement('div');
    this.overlays.effect.className = 'effect-overlay';
    
    // Adiciona os overlays à HUD
    this.elements.hud.appendChild(this.menus.deathScreen);
    this.elements.hud.appendChild(this.menus.pauseMenu);
    this.elements.hud.appendChild(this.menus.matchEndScreen);
    this.elements.hud.appendChild(this.overlays.damage);
    this.elements.hud.appendChild(this.overlays.healing);
    this.elements.hud.appendChild(this.overlays.effect);
  }

  /**
   * Cria o CSS para estilizar a UI
   */
  createStyle() {
    const style = document.createElement('style');
    style.textContent = `
      .hud {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        font-family: 'Arial', sans-serif;
      }
      
      .player-info {
        position: absolute;
        bottom: 20px;
        left: 20px;
        background-color: rgba(0, 0, 0, 0.5);
        padding: 10px;
        border-radius: 5px;
        color: white;
      }
      
      .info-label {
        font-size: 12px;
        opacity: 0.7;
      }
      
      .health-container, .mana-container {
        margin-bottom: 5px;
      }
      
      .health-bar, .mana-bar {
        height: 10px;
        width: 200px;
        background-color: #333;
        border-radius: 3px;
        overflow: hidden;
        margin: 3px 0;
        position: relative;
      }
      
      .health-bar::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        height: 100%;
        width: 100%;
        background-color: #ff3333;
        transition: width 0.3s;
      }
      
      .mana-bar::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        height: 100%;
        width: 100%;
        background-color: #3388ff;
        transition: width 0.3s;
      }
      
      .health-value, .mana-value {
        font-size: 14px;
      }
      
      .weapon-info {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 10px;
      }
      
      .weapon-name {
        font-size: 16px;
        font-weight: bold;
      }
      
      .ammo-info {
        font-size: 18px;
        font-weight: bold;
      }
      
      .score-info {
        position: absolute;
        top: 20px;
        right: 20px;
        background-color: rgba(0, 0, 0, 0.5);
        padding: 10px;
        border-radius: 5px;
        color: white;
        text-align: right;
      }
      
      .crosshair {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 10px;
        height: 10px;
        background-color: rgba(255, 255, 255, 0.7);
        border-radius: 50%;
      }
      
      .kill-feed {
        position: absolute;
        top: 20px;
        left: 20px;
        max-width: 400px;
      }
      
      .kill-feed-item {
        background-color: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 5px 10px;
        border-radius: 3px;
        margin-bottom: 5px;
        animation: fadeOut 5s forwards;
      }
      
      .damage-indicators {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
      }
      
      .damage-indicator {
        position: absolute;
        width: 30px;
        height: 30px;
        background-color: rgba(255, 0, 0, 0.5);
        border-radius: 50%;
        animation: pulse 1s forwards;
      }
      
      .chat-container {
        position: absolute;
        left: 20px;
        bottom: 150px;
        width: 300px;
      }
      
      .chat-messages {
        max-height: 150px;
        overflow-y: auto;
        background-color: rgba(0, 0, 0, 0.5);
        border-radius: 5px;
        margin-bottom: 5px;
      }
      
      .chat-message {
        color: white;
        padding: 3px 10px;
        word-wrap: break-word;
      }
      
      .chat-input {
        width: 100%;
        padding: 5px;
        background-color: rgba(0, 0, 0, 0.7);
        border: 1px solid #555;
        border-radius: 3px;
        color: white;
        pointer-events: auto;
        display: none;
      }
      
      .overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        background-color: rgba(0, 0, 0, 0.7);
        color: white;
        pointer-events: auto;
      }
      
      .overlay h2 {
        font-size: 36px;
        margin-bottom: 20px;
      }
      
      .overlay button {
        background-color: #3388ff;
        color: white;
        border: none;
        padding: 10px 20px;
        margin: 10px;
        border-radius: 5px;
        font-size: 16px;
        cursor: pointer;
        transition: background-color 0.3s;
      }
      
      .overlay button:hover {
        background-color: #4499ff;
      }
      
      .death-screen {
        color: #ff3333;
      }
      
      .respawn-timer {
        font-size: 24px;
        margin-top: 20px;
      }
      
      .match-results {
        margin: 20px 0;
        max-height: 300px;
        overflow-y: auto;
        width: 80%;
        max-width: 600px;
      }
      
      .damage-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        background-color: rgba(255, 0, 0, 0);
        transition: background-color 0.1s;
      }
      
      .healing-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        background-color: rgba(0, 255, 0, 0);
        transition: background-color 0.1s;
      }
      
      .effect-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        background-color: rgba(128, 0, 255, 0);
        transition: background-color 0.1s;
      }
      
      @keyframes fadeOut {
        0% { opacity: 1; }
        80% { opacity: 1; }
        100% { opacity: 0; }
      }
      
      @keyframes pulse {
        0% { transform: scale(0.5); opacity: 1; }
        100% { transform: scale(1.5); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Configura os ouvintes de eventos
   */
  setupEventListeners() {
    // Eventos de jogador
    EventSystem.subscribe('player:damage', (data) => {
      if (data.playerId === this.localPlayerId) {
        this.updateHUD({ health: data.currentHealth });
        this.showDamageIndicator(data.attackerId);
        this.pulseBloodOverlay(data.damage / this.hudData.maxHealth);
      }
    });

    EventSystem.subscribe('player:heal', (data) => {
      if (data.playerId === this.localPlayerId) {
        this.updateHUD({ health: data.currentHealth });
        this.pulseHealOverlay(data.amount / this.hudData.maxHealth);
      }
    });

    EventSystem.subscribe('player:death', (data) => {
      if (data.playerId === this.localPlayerId) {
        this.showMenu('deathScreen');
        this.startRespawnTimer(data.respawnTime || 5);
      }
      this.showKillFeed(data.killerId, data.playerId, data.weaponType);
    });

    EventSystem.subscribe('player:respawn', (data) => {
      if (data.playerId === this.localPlayerId) {
        this.hideMenu('deathScreen');
      }
    });

    EventSystem.subscribe('player:manaChanged', (data) => {
      if (data.playerId === this.localPlayerId) {
        this.updateHUD({ mana: data.currentMana });
      }
    });

    // Eventos de arma
    EventSystem.subscribe('player:reload', (data) => {
      if (data.playerId === this.localPlayerId) {
        // A munição será atualizada quando o reload for concluído
      }
    });

    EventSystem.subscribe('player:switchWeapon', (data) => {
      if (data.playerId === this.localPlayerId) {
        this.updateHUD({
          weaponType: data.weaponType,
          currentAmmo: data.currentAmmo,
          maxAmmo: data.maxAmmo,
          reserveAmmo: data.reserveAmmo
        });
      }
    });

    // Eventos de magia
    EventSystem.subscribe('effect:applied', (data) => {
      if (data.targetId === this.localPlayerId) {
        this.showEffectAppliedIndicator(data.effectType);
      }
    });

    EventSystem.subscribe('effect:removed', (data) => {
      if (data.targetId === this.localPlayerId) {
        this.showEffectRemovedIndicator(data.effectType);
      }
    });

    // Eventos de jogo
    EventSystem.subscribe('match:start', (data) => {
      this.hideMenu('matchEndScreen');
      this.resetKillFeed();
    });

    EventSystem.subscribe('match:end', (data) => {
      this.showMatchResults(data);
    });

    EventSystem.subscribe('chat:message', (data) => {
      this.addChatMessage(data.playerName, data.message);
    });

    // Eventos da UI
    EventSystem.subscribe('ui:showDeathScreen', () => {
      this.showMenu('deathScreen');
    });

    EventSystem.subscribe('ui:showKillConfirmation', (data) => {
      this.showKillConfirmation(data.targetId, data.isHeadshot);
    });

    // Eventos de teclado para chat e menu
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        if (this.elements.chatInput.style.display === 'none') {
          this.openChat();
        } else {
          this.sendChatMessage();
        }
      }
      if (e.key === 'Escape') {
        if (this.elements.chatInput.style.display !== 'none') {
          this.closeChat();
        } else if (this.menus.pauseMenu.style.display === 'none') {
          this.showMenu('pauseMenu');
        } else {
          this.hideMenu('pauseMenu');
        }
      }
    });
  }

  /**
   * Atualiza o HUD com novos dados do jogador
   * @param {Object} playerData - Dados atualizados do jogador
   */
  updateHUD(playerData) {
    // Atualiza os dados do HUD
    Object.assign(this.hudData, playerData);
    
    // Atualiza a saúde
    if (playerData.health !== undefined || playerData.maxHealth !== undefined) {
      const healthPercentage = (this.hudData.health / this.hudData.maxHealth) * 100;
      this.elements.healthBar.style.setProperty('--health-percentage', `${healthPercentage}%`);
      this.elements.healthValue.textContent = `${Math.floor(this.hudData.health)}/${this.hudData.maxHealth}`;
      this.elements.healthBar.querySelector('::before').style.width = `${healthPercentage}%`;
    }
    
    // Atualiza a mana
    if (playerData.mana !== undefined || playerData.maxMana !== undefined) {
      const manaPercentage = (this.hudData.mana / this.hudData.maxMana) * 100;
      this.elements.manaBar.style.setProperty('--mana-percentage', `${manaPercentage}%`);
      this.elements.manaValue.textContent = `${Math.floor(this.hudData.mana)}/${this.hudData.maxMana}`;
      this.elements.manaBar.querySelector('::before').style.width = `${manaPercentage}%`;
    }
    
    // Atualiza a arma e munição
    if (playerData.weaponType !== undefined) {
      this.elements.weaponName.textContent = this.getWeaponDisplayName(playerData.weaponType);
    }
    
    if (playerData.currentAmmo !== undefined || playerData.maxAmmo !== undefined || playerData.reserveAmmo !== undefined) {
      this.elements.ammoInfo.textContent = `${this.hudData.currentAmmo}/${this.hudData.maxAmmo} | ${this.hudData.reserveAmmo}`;
    }
    
    // Atualiza a pontuação
    if (playerData.kills !== undefined) {
      this.elements.kills.textContent = `Abates: ${playerData.kills}`;
    }
    
    if (playerData.deaths !== undefined) {
      this.elements.deaths.textContent = `Mortes: ${playerData.deaths}`;
    }
    
    if (playerData.score !== undefined) {
      this.elements.score.textContent = `Pontos: ${playerData.score}`;
    }
  }

  /**
   * Mostra um menu específico
   * @param {string} menuType - Tipo de menu a ser mostrado
   */
  showMenu(menuType) {
    if (this.menus[menuType]) {
      this.menus[menuType].style.display = 'flex';
      
      // Pausa o jogo se o menu de pausa for aberto
      if (menuType === 'pauseMenu') {
        EventSystem.publish('game:pause', {});
      }
      
      // Desbloqueia o mouse
      document.exitPointerLock();
    }
  }

  /**
   * Esconde um menu específico
   * @param {string} menuType - Tipo de menu a ser escondido
   */
  hideMenu(menuType) {
    if (this.menus[menuType]) {
      this.menus[menuType].style.display = 'none';
      
      // Retoma o jogo se o menu de pausa for fechado
      if (menuType === 'pauseMenu') {
        EventSystem.publish('game:resume', {});
        // Bloqueia o mouse novamente
        this.container.requestPointerLock();
      }
    }
  }

  /**
   * Mostra um indicador de dano baseado na direção do atacante
   * @param {string} attackerId - ID do atacante
   */
  showDamageIndicator(attackerId) {
    // Obtém as posições do jogador e do atacante
    const attackerPosition = this.getEntityPosition(attackerId);
    if (!attackerPosition) return;
    
    const playerPosition = this.getLocalPlayerPosition();
    if (!playerPosition) return;
    
    // Calcula a direção do ataque
    const direction = {
      x: attackerPosition.x - playerPosition.x,
      z: attackerPosition.z - playerPosition.z
    };
    
    // Normaliza a direção
    const length = Math.sqrt(direction.x * direction.x + direction.z * direction.z);
    direction.x /= length;
    direction.z /= length;
    
    // Cria o indicador de dano
    const indicator = document.createElement('div');
    indicator.className = 'damage-indicator';
    
    // Posiciona o indicador na borda da tela
    const angle = Math.atan2(direction.z, direction.x);
    const centerX = this.container.clientWidth / 2;
    const centerY = this.container.clientHeight / 2;
    const radius = Math.min(centerX, centerY) - 20;
    
    indicator.style.left = `${centerX + radius * Math.cos(angle) - 15}px`;
    indicator.style.top = `${centerY + radius * Math.sin(angle) - 15}px`;
    
    this.elements.damageIndicators.appendChild(indicator);
    
    // Remove o indicador após a animação
    setTimeout(() => {
      if (indicator.parentNode) {
        indicator.parentNode.removeChild(indicator);
      }
    }, 1000);
  }

  /**
   * Pulsa o overlay de sangue baseado no dano recebido
   * @param {number} damageRatio - Razão do dano em relação à vida máxima (0-1)
   */
  pulseBloodOverlay(damageRatio) {
    // Limita a opacidade máxima baseada no dano
    const opacity = Math.min(0.8, damageRatio * 2);
    
    this.overlays.damage.style.backgroundColor = `rgba(255, 0, 0, ${opacity})`;
    
    // Limpa qualquer timeout existente
    if (this.bloodOverlayTimeout) {
      clearTimeout(this.bloodOverlayTimeout);
    }
    
    // Agenda a remoção do overlay
    this.bloodOverlayTimeout = setTimeout(() => {
      this.overlays.damage.style.backgroundColor = 'rgba(255, 0, 0, 0)';
    }, 300);
  }

  /**
   * Pulsa o overlay de cura baseado na quantidade curada
   * @param {number} healRatio - Razão da cura em relação à vida máxima (0-1)
   */
  pulseHealOverlay(healRatio) {
    // Limita a opacidade máxima baseada na cura
    const opacity = Math.min(0.6, healRatio * 1.5);
    
    this.overlays.healing.style.backgroundColor = `rgba(0, 255, 0, ${opacity})`;
    
    // Limpa qualquer timeout existente
    if (this.healOverlayTimeout) {
      clearTimeout(this.healOverlayTimeout);
    }
    
    // Agenda a remoção do overlay
    this.healOverlayTimeout = setTimeout(() => {
      this.overlays.healing.style.backgroundColor = 'rgba(0, 255, 0, 0)';
    }, 300);
  }

  /**
   * Pulsa o overlay de efeito baseado no tipo
   * @param {string} effectType - Tipo de efeito aplicado
   */
  pulseEffectOverlay(effectType) {
    let color;
    switch (effectType) {
      case 'fire':
        color = 'rgba(255, 100, 0, 0.3)';
        break;
      case 'ice':
        color = 'rgba(0, 200, 255, 0.3)';
        break;
      case 'poison':
        color = 'rgba(0, 180, 0, 0.3)';
        break;
      case 'arcane':
        color = 'rgba(180, 0, 255, 0.3)';
        break;
      default:
        color = 'rgba(128, 0, 255, 0.3)';
    }
    
    this.overlays.effect.style.backgroundColor = color;
    
    // Limpa qualquer timeout existente
    if (this.effectOverlayTimeout) {
      clearTimeout(this.effectOverlayTimeout);
    }
    
    // Agenda a remoção do overlay
    this.effectOverlayTimeout = setTimeout(() => {
      this.overlays.effect.style.backgroundColor = 'rgba(128, 0, 255, 0)';
    }, 500);
  }

  /**
   * Mostra o feed de abates
   * @param {string} killerId - ID do jogador que abateu
   * @param {string} victimId - ID do jogador abatido
   * @param {string} weaponType - Tipo de arma usada
   */
  showKillFeed(killerId, victimId, weaponType) {
    const killerName = this.getPlayerName(killerId) || 'Desconhecido';
    const victimName = this.getPlayerName(victimId) || 'Desconhecido';
    const weaponName = this.getWeaponDisplayName(weaponType) || 'Desconhecido';
    
    const item = document.createElement('div');
    item.className = 'kill-feed-item';
    
    // Destaca o nome se for o jogador local
    const isLocalKiller = killerId === this.localPlayerId;
    const isLocalVictim = victimId === this.localPlayerId;
    
    // Constrói a mensagem de abate
    let message;
    if (killerId === victimId) {
      // Suicídio
      message = `${isLocalVictim ? '<span class="self">Você</span>' : victimName} se matou`;
    } else {
      message = `${isLocalKiller ? '<span class="self">Você</span>' : killerName} abateu ${isLocalVictim ? '<span class="self">Você</span>' : victimName} com ${weaponName}`;
    }
    
    item.innerHTML = message;
    
    // Adiciona ao feed
    this.elements.killFeed.appendChild(item);
    
    // Limite de mensagens no feed
    this.feedMessages.push({
      element: item,
      timestamp: Date.now()
    });
    
    // Remove mensagens antigas
    while (this.feedMessages.length > this.maxFeedMessages) {
      const oldMessage = this.feedMessages.shift();
      if (oldMessage.element.parentNode) {
        oldMessage.element.parentNode.removeChild(oldMessage.element);
      }
    }
    
    // Remove automaticamente após o tempo definido
    setTimeout(() => {
      if (item.parentNode) {
        item.parentNode.removeChild(item);
      }
      const index = this.feedMessages.findIndex(m => m.element === item);
      if (index !== -1) {
        this.feedMessages.splice(index, 1);
      }
    }, this.feedMessageDuration);
    
    // Reproduz som de abate se o jogador local foi o matador
    if (isLocalKiller) {
      this.showKillConfirmation(victimId);
    }
  }

  /**
   * Mostra uma confirmação de abate para o jogador local
   * @param {string} victimId - ID do jogador abatido
   * @param {boolean} isHeadshot - Flag indicando se foi tiro na cabeça
   */
  showKillConfirmation(victimId, isHeadshot = false) {
    const confirmation = document.createElement('div');
    confirmation.className = 'kill-confirmation';
    confirmation.textContent = isHeadshot ? 'HEADSHOT!' : 'ABATE!';
    
    // Posiciona no centro da tela
    confirmation.style.position = 'absolute';
    confirmation.style.top = '40%';
    confirmation.style.left = '50%';
    confirmation.style.transform = 'translate(-50%, -50%)';
    confirmation.style.color = isHeadshot ? '#ff5500' : '#ffffff';
    confirmation.style.fontSize = isHeadshot ? '32px' : '24px';
    confirmation.style.fontWeight = 'bold';
    confirmation.style.textShadow = '0 0 10px rgba(255, 0, 0, 0.7)';
    confirmation.style.animation = 'confirmationFadeOut 1.5s forwards';
    
    this.elements.hud.appendChild(confirmation);
    
    // Remove após a animação
    setTimeout(() => {
      if (confirmation.parentNode) {
        confirmation.parentNode.removeChild(confirmation);
      }
    }, 1500);
    
    // Adiciona keyframe para animação se ainda não existir
    if (!document.querySelector('style#kill-confirmation-style')) {
      const style = document.createElement('style');
      style.id = 'kill-confirmation-style';
      style.textContent = `
        @keyframes confirmationFadeOut {
          0% { transform: translate(-50%, -50%) scale(0.8); opacity: 0; }
          20% { transform: translate(-50%, -50%) scale(1.2); opacity: 1; }
          80% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(1.1); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }
  }

  /**
   * Mostra indicador de efeito aplicado
   * @param {string} effectType - Tipo de efeito
   */
  showEffectAppliedIndicator(effectType) {
    // Pulsa o overlay
    this.pulseEffectOverlay(effectType);
    
    // Cria um texto de notificação
    const effectName = this.getEffectDisplayName(effectType);
    const notification = document.createElement('div');
    notification.className = 'effect-notification';
    notification.textContent = `${effectName} aplicado`;
    notification.style.position = 'absolute';
    notification.style.bottom = '200px';
    notification.style.left = '50%';
    notification.style.transform = 'translateX(-50%)';
    notification.style.color = 'white';
    notification.style.background = 'rgba(0, 0, 0, 0.7)';
    notification.style.padding = '5px 10px';
    notification.style.borderRadius = '3px';
    notification.style.animation = 'fadeUp 2s forwards';
    
    this.elements.hud.appendChild(notification);
    
    // Remove após a animação
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 2000);
    
    // Adiciona keyframe para animação se ainda não existir
    if (!document.querySelector('style#effect-notification-style')) {
      const style = document.createElement('style');
      style.id = 'effect-notification-style';
      style.textContent = `
        @keyframes fadeUp {
          0% { transform: translate(-50%, 20px); opacity: 0; }
          20% { transform: translate(-50%, 0); opacity: 1; }
          80% { transform: translate(-50%, 0); opacity: 1; }
          100% { transform: translate(-50%, -20px); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }
  }

  /**
   * Mostra indicador de efeito removido
   * @param {string} effectType - Tipo de efeito
   */
  showEffectRemovedIndicator(effectType) {
    // Cria um texto de notificação
    const effectName = this.getEffectDisplayName(effectType);
    const notification = document.createElement('div');
    notification.className = 'effect-notification';
    notification.textContent = `${effectName} removido`;
    notification.style.position = 'absolute';
    notification.style.bottom = '200px';
    notification.style.left = '50%';
    notification.style.transform = 'translateX(-50%)';
    notification.style.color = 'white';
    notification.style.background = 'rgba(0, 0, 0, 0.7)';
    notification.style.padding = '5px 10px';
    notification.style.borderRadius = '3px';
    notification.style.animation = 'fadeUp 2s forwards';
    
    this.elements.hud.appendChild(notification);
    
    // Remove após a animação
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 2000);
  }

  /**
   * Inicia o temporizador de respawn
   * @param {number} time - Tempo de respawn em segundos
   */
  startRespawnTimer(time) {
    let remaining = time;
    this.menus.deathRespawnTimer.textContent = `Renascendo em ${remaining}...`;
    
    if (this.respawnInterval) {
      clearInterval(this.respawnInterval);
    }
    
    this.respawnInterval = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(this.respawnInterval);
        this.respawnInterval = null;
      } else {
        this.menus.deathRespawnTimer.textContent = `Renascendo em ${remaining}...`;
      }
    }, 1000);
  }

  /**
   * Mostra os resultados da partida
   * @param {Object} data - Dados do fim da partida
   */
  showMatchResults(data) {
    // Limpa resultados anteriores
    this.menus.matchResults.innerHTML = '';
    
    // Título do vencedor
    const winnerTitle = document.createElement('h3');
    if (data.winningTeam) {
      winnerTitle.textContent = `Time Vencedor: ${data.winningTeam}`;
    } else {
      winnerTitle.textContent = 'Fim da Partida';
    }
    this.menus.matchResults.appendChild(winnerTitle);
    
    // Tabela de jogadores
    const table = document.createElement('table');
    table.className = 'results-table';
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.color = 'white';
    
    // Cabeçalho
    const headerRow = document.createElement('tr');
    const headers = ['Jogador', 'Abates', 'Mortes', 'K/D', 'Pontos'];
    
    headers.forEach(header => {
      const th = document.createElement('th');
      th.textContent = header;
      th.style.padding = '8px';
      th.style.textAlign = 'left';
      th.style.borderBottom = '1px solid #444';
      headerRow.appendChild(th);
    });
    
    table.appendChild(headerRow);
    
    // Ordenar jogadores por pontuação
    const players = data.players.sort((a, b) => b.score - a.score);
    
    // Linhas de jogadores
    players.forEach(player => {
      const row = document.createElement('tr');
      
      // Destaca o jogador local
      if (player.id === this.localPlayerId) {
        row.style.backgroundColor = 'rgba(255, 255, 0, 0.2)';
      }
      
      // Nome do jogador
      const nameCell = document.createElement('td');
      nameCell.textContent = player.name;
      nameCell.style.padding = '8px';
      nameCell.style.borderBottom = '1px solid #333';
      row.appendChild(nameCell);
      
      // Abates
      const killsCell = document.createElement('td');
      killsCell.textContent = player.kills;
      killsCell.style.padding = '8px';
      killsCell.style.borderBottom = '1px solid #333';
      row.appendChild(killsCell);
      
      // Mortes
      const deathsCell = document.createElement('td');
      deathsCell.textContent = player.deaths;
      deathsCell.style.padding = '8px';
      deathsCell.style.borderBottom = '1px solid #333';
      row.appendChild(deathsCell);
      
      // K/D
      const kdCell = document.createElement('td');
      const kd = player.deaths === 0 ? player.kills : (player.kills / player.deaths).toFixed(2);
      kdCell.textContent = kd;
      kdCell.style.padding = '8px';
      kdCell.style.borderBottom = '1px solid #333';
      row.appendChild(kdCell);
      
      // Pontos
      const scoreCell = document.createElement('td');
      scoreCell.textContent = player.score;
      scoreCell.style.padding = '8px';
      scoreCell.style.borderBottom = '1px solid #333';
      row.appendChild(scoreCell);
      
      table.appendChild(row);
    });
    
    this.menus.matchResults.appendChild(table);
    this.showMenu('matchEndScreen');
  }

  /**
   * Adiciona uma mensagem ao chat
   * @param {string} playerName - Nome do jogador
   * @param {string} message - Mensagem enviada
   */
  addChatMessage(playerName, message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message';
    messageDiv.innerHTML = `<span class="chat-name">${playerName}:</span> ${message}`;
    
    this.elements.chatMessages.appendChild(messageDiv);
    this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
    
    // Limita o número de mensagens
    this.chatMessages.push(messageDiv);
    
    while (this.chatMessages.length > this.maxChatMessages) {
      const oldMessage = this.chatMessages.shift();
      if (oldMessage.parentNode) {
        oldMessage.parentNode.removeChild(oldMessage);
      }
    }
  }

  /**
   * Abre o chat
   */
  openChat() {
    this.elements.chatInput.style.display = 'block';
    this.elements.chatInput.focus();
    
    // Notifica o sistema de entrada para parar de capturar teclas de jogo
    EventSystem.publish('ui:chatOpen', {});
  }

  /**
   * Fecha o chat
   */
  closeChat() {
    this.elements.chatInput.style.display = 'none';
    this.elements.chatInput.value = '';
    
    // Notifica o sistema de entrada para voltar a capturar teclas de jogo
    EventSystem.publish('ui:chatClose', {});
  }

  /**
   * Envia uma mensagem de chat
   */
  sendChatMessage() {
    const message = this.elements.chatInput.value.trim();
    
    if (message) {
      // Envia a mensagem para o servidor
      EventSystem.publish('player:chatMessage', {
        message
      });
    }
    
    this.closeChat();
  }

  /**
   * Limpa o feed de abates
   */
  resetKillFeed() {
    this.elements.killFeed.innerHTML = '';
    this.feedMessages = [];
  }

  /**
   * Atualiza o estado do jogo na UI
   * @param {Object} data - Dados do estado do jogo
   */
  updateGameState(data) {
    // Atualiza informações do jogador local
    const localPlayer = data.players.find(p => p.id === this.localPlayerId);
    
    if (localPlayer) {
      this.updateHUD({
        health: localPlayer.health,
        maxHealth: localPlayer.maxHealth,
        mana: localPlayer.mana,
        maxMana: localPlayer.maxMana,
        kills: localPlayer.kills,
        deaths: localPlayer.deaths,
        score: localPlayer.score
      });
    }
    
    // Outras atualizações de estado do jogo podem ser adicionadas aqui
  }

  /**
   * Obtém o nome de exibição para uma arma
   * @param {string} weaponType - Tipo de arma
   * @returns {string} Nome de exibição da arma
   */
  getWeaponDisplayName(weaponType) {
    const weaponNames = {
      'pistol': 'Pistola',
      'rifle': 'Rifle',
      'shotgun': 'Escopeta',
      'sniper': 'Sniper',
      'smg': 'Submetralhadora',
      'rocket': 'Lança-Foguetes',
      'magicstaff': 'Cajado Mágico',
      'firewand': 'Varinha de Fogo',
      'iceblade': 'Lâmina de Gelo',
      'arcanebow': 'Arco Arcano'
    };
    
    return weaponNames[weaponType] || weaponType;
  }

  /**
   * Obtém o nome de exibição para um efeito
   * @param {string} effectType - Tipo de efeito
   * @returns {string} Nome de exibição do efeito
   */
  getEffectDisplayName(effectType) {
    const effectNames = {
      'fire': 'Queimadura',
      'ice': 'Congelamento',
      'poison': 'Veneno',
      'arcane': 'Arcano',
      'shield': 'Escudo',
      'speedboost': 'Aceleração',
      'healthboost': 'Regeneração',
      'manaboost': 'Fluxo de Mana',
      'weakness': 'Fraqueza',
      'silence': 'Silêncio',
      'stun': 'Atordoamento'
    };
    
    return effectNames[effectType] || effectType;
  }

  /**
   * Obtém o nome do jogador pelo ID
   * @param {string} playerId - ID do jogador
   * @returns {string|null} Nome do jogador ou null se não encontrado
   */
  getPlayerName(playerId) {
    // Esta é uma implementação simplificada
    // Em um sistema real, buscaria o nome de uma lista de jogadores
    if (playerId === this.localPlayerId) {
      return 'Você';
    }
    
    // Aqui deveria haver lógica para buscar o nome em um registro de jogadores
    // Por enquanto, retorna um valor padrão
    return `Jogador ${playerId.substring(0, 4)}`;
  }

  /**
   * Obtém a posição do jogador local
   * @returns {Object|null} Posição do jogador local ou null se não disponível
   */
  getLocalPlayerPosition() {
    // Esta função deveria buscar a posição do jogador local em um sistema de entidades
    // Por enquanto, é um stub
    return { x: 0, y: 0, z: 0 };
  }

  /**
   * Obtém a posição de uma entidade pelo ID
   * @param {string} entityId - ID da entidade
   * @returns {Object|null} Posição da entidade ou null se não encontrada
   */
  getEntityPosition(entityId) {
    // Esta função deveria buscar a posição de uma entidade em um sistema de entidades
    // Por enquanto, é um stub
    return { x: 0, y: 0, z: 0 };
  }

  /**
   * Atualiza o sistema de UI
   * @param {number} deltaTime - Tempo desde a última atualização em segundos
   */
  update(deltaTime) {
    // Processa eventos temporais, como remoção de mensagens antigas do feed
    const now = Date.now();
    
    // Remove mensagens de feed antigas
    for (let i = this.feedMessages.length - 1; i >= 0; i--) {
      const message = this.feedMessages[i];
      if (now - message.timestamp > this.feedMessageDuration) {
        if (message.element.parentNode) {
          message.element.parentNode.removeChild(message.element);
        }
        this.feedMessages.splice(i, 1);
      }
    }
    
    // Outras atualizações podem ser adicionadas aqui
  }

  /**
   * Libera recursos do sistema de UI
   */
  dispose() {
    // Remove todos os listeners de eventos
    EventSystem.unsubscribeAll(this);
    
    // Limpa intervalos
    if (this.respawnInterval) {
      clearInterval(this.respawnInterval);
      this.respawnInterval = null;
    }
    
    // Limpa timeouts
    if (this.bloodOverlayTimeout) {
      clearTimeout(this.bloodOverlayTimeout);
      this.bloodOverlayTimeout = null;
    }
    
    if (this.healOverlayTimeout) {
      clearTimeout(this.healOverlayTimeout);
      this.healOverlayTimeout = null;
    }
    
    if (this.effectOverlayTimeout) {
      clearTimeout(this.effectOverlayTimeout);
      this.effectOverlayTimeout = null;
    }
    
    console.log('UISystem liberado');
  }
}

export default UISystem;