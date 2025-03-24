/**
 * Sistema de entrada do usuário
 * Responsável por capturar entrada do teclado e mouse e mapeá-las para ações no jogo
 */
import { EventEmitter } from '../../shared/utils/EventEmitter.js';

class InputSystem {
  constructor() {
    // Estado das teclas pressionadas
    this.keys = {};
    
    // Estado dos botões do mouse
    this.mouseButtons = {
      left: false,
      right: false,
      middle: false
    };
    
    // Ponteiro bloqueado
    this.isPointerLocked = false;
    
    // Movimento do mouse
    this.mouseMovement = {
      x: 0,
      y: 0
    };
    
    // Vetores de movimento
    this.movementVector = {
      x: 0,
      z: 0
    };
    
    // Sensibilidade do mouse
    this.sensitivity = 0.5;
    
    // Mapeamento de teclas padrão
    this.keyMap = {
      KeyW: 'forward',
      KeyS: 'backward',
      KeyA: 'left',
      KeyD: 'right',
      Space: 'jump',
      ShiftLeft: 'sprint',
      ControlLeft: 'crouch',
      KeyR: 'reload',
      KeyE: 'use',
      KeyQ: 'ability1',
      KeyF: 'ability2',
      KeyV: 'ability3',
      KeyG: 'ability4',
      Tab: 'scoreboard',
      Digit1: 'weapon1',
      Digit2: 'weapon2',
      Digit3: 'weapon3',
      Digit4: 'weapon4',
      Digit5: 'weapon5',
      Escape: 'menu',
      Enter: 'chat',
      KeyT: 'chatTeam'
    };
    
    // Eventos
    this.events = new EventEmitter();
    
    // Estado de input
    this.inputState = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
      sprint: false,
      crouch: false,
      reload: false,
      use: false,
      ability1: false,
      ability2: false,
      ability3: false,
      ability4: false,
      scoreboard: false,
      menu: false
    };
    
    // Flag para indicar se o sistema está inicializado
    this.isInitialized = false;
    
    // Referência para o elemento DOM que recebe os eventos
    this.domElement = null;
    
    // Timestamp do último pulo para evitar spam
    this.lastJumpTime = 0;
    
    // Cooldown do pulo em ms
    this.jumpCooldown = 300;
    
    // Binds para os handlers
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handlePointerLockChange = this.handlePointerLockChange.bind(this);
    this.handlePointerLockError = this.handlePointerLockError.bind(this);
    this.handleClick = this.handleClick.bind(this);
    this.handleWheel = this.handleWheel.bind(this);
    this.handleContextMenu = this.handleContextMenu.bind(this);
  }

  /**
   * Inicializa o sistema de entrada
   * @param {HTMLElement} domElement - Elemento DOM para capturar eventos
   */
  initialize(domElement) {
    if (this.isInitialized) {
      console.warn('InputSystem já inicializado');
      return;
    }
    
    this.domElement = domElement;
    
    // Adiciona event listeners para teclado
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    
    // Adiciona event listeners para mouse
    domElement.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mouseup', this.handleMouseUp);
    document.addEventListener('mousemove', this.handleMouseMove);
    
    // Event listeners para pointer lock
    document.addEventListener('pointerlockchange', this.handlePointerLockChange);
    document.addEventListener('pointerlockerror', this.handlePointerLockError);
    
    // Adiciona event listener para click para solicitar pointer lock
    domElement.addEventListener('click', this.handleClick);
    
    // Previne comportamento padrão de roda do mouse e menu de contexto
    domElement.addEventListener('wheel', this.handleWheel);
    domElement.addEventListener('contextmenu', this.handleContextMenu);
    
    this.isInitialized = true;
    console.log('InputSystem inicializado');
  }

  /**
   * Atualiza o sistema de entrada
   * @param {number} deltaTime - Tempo em segundos desde a última atualização
   */
  update(deltaTime) {
    if (!this.isInitialized) return;
    
    // Reseta o vetor de movimento
    this.movementVector.x = 0;
    this.movementVector.z = 0;
    
    // Calcula o vetor de movimento com base nas teclas pressionadas
    if (this.inputState.forward) this.movementVector.z -= 1;
    if (this.inputState.backward) this.movementVector.z += 1;
    if (this.inputState.left) this.movementVector.x -= 1;
    if (this.inputState.right) this.movementVector.x += 1;
    
    // Normalização do vetor de movimento (para evitar movimento mais rápido na diagonal)
    const length = Math.sqrt(this.movementVector.x * this.movementVector.x + this.movementVector.z * this.movementVector.z);
    if (length > 0) {
      this.movementVector.x /= length;
      this.movementVector.z /= length;
    }
    
    // Modifica velocidade com base no sprint ou crouch
    const speedModifier = this.inputState.sprint ? 1.5 : (this.inputState.crouch ? 0.5 : 1.0);
    this.movementVector.x *= speedModifier;
    this.movementVector.z *= speedModifier;
    
    // Emite evento de movimento se houver alteração na posição
    if (this.movementVector.x !== 0 || this.movementVector.z !== 0) {
      this.events.emit('input:move', {
        x: this.movementVector.x,
        z: this.movementVector.z,
        sprint: this.inputState.sprint,
        crouch: this.inputState.crouch
      });
    }
    
    // Reseta movimento do mouse após emitir o evento
    if (this.mouseMovement.x !== 0 || this.mouseMovement.y !== 0) {
      this.events.emit('input:look', {
        x: this.mouseMovement.x * this.sensitivity,
        y: this.mouseMovement.y * this.sensitivity
      });
      
      this.mouseMovement.x = 0;
      this.mouseMovement.y = 0;
    }
  }

  /**
   * Retorna o vetor de movimento atual
   * @returns {Object} Vetor de movimento {x, z}
   */
  getMovementVector() {
    return { ...this.movementVector };
  }

  /**
   * Verifica se uma tecla está pressionada
   * @param {string} key - Código da tecla
   * @returns {boolean} true se a tecla estiver pressionada
   */
  isKeyPressed(key) {
    return this.keys[key] === true;
  }

  /**
   * Manipula evento de tecla pressionada
   * @param {KeyboardEvent} event - Evento de tecla pressionada
   */
  handleKeyDown(event) {
    if (!this.isInitialized) return;
    
    // Não processa eventos se o pointer não estiver bloqueado (exceto ESC para menu)
    if (!this.isPointerLocked && event.code !== 'Escape' && event.code !== 'Enter' && event.code !== 'KeyT') {
      return;
    }
    
    // Atualiza estado da tecla
    this.keys[event.code] = true;
    
    // Mapeia tecla para ação
    const action = this.keyMap[event.code];
    if (action) {
      this.inputState[action] = true;
      
      // Ações especiais que precisam emitir eventos imediatamente
      switch (action) {
        case 'jump':
          const now = Date.now();
          if (now - this.lastJumpTime > this.jumpCooldown) {
            this.events.emit('input:jump', {});
            this.lastJumpTime = now;
          }
          break;
          
        case 'reload':
          this.events.emit('input:reload', {});
          break;
          
        case 'weapon1':
        case 'weapon2':
        case 'weapon3':
        case 'weapon4':
        case 'weapon5':
          this.events.emit('input:switch', { weaponIndex: parseInt(action.slice(-1)) - 1 });
          break;
          
        case 'menu':
          this.events.emit('input:menu', {});
          break;
          
        case 'chat':
        case 'chatTeam':
          this.events.emit('input:chat', { team: action === 'chatTeam' });
          break;
      }
    }
    
    // Previne comportamento padrão de teclas de jogo
    if (this.isGameKey(event.code)) {
      event.preventDefault();
    }
  }

  /**
   * Manipula evento de tecla liberada
   * @param {KeyboardEvent} event - Evento de tecla liberada
   */
  handleKeyUp(event) {
    if (!this.isInitialized) return;
    
    // Atualiza estado da tecla
    this.keys[event.code] = false;
    
    // Mapeia tecla para ação
    const action = this.keyMap[event.code];
    if (action) {
      this.inputState[action] = false;
    }
    
    // Previne comportamento padrão de teclas de jogo
    if (this.isGameKey(event.code)) {
      event.preventDefault();
    }
  }

  /**
   * Manipula evento de botão do mouse pressionado
   * @param {MouseEvent} event - Evento de mouse
   */
  handleMouseDown(event) {
    if (!this.isInitialized || !this.isPointerLocked) return;
    
    // Atualiza estado do botão do mouse
    switch (event.button) {
      case 0: // Botão esquerdo
        this.mouseButtons.left = true;
        this.events.emit('input:fire', { timestamp: Date.now() });
        break;
        
      case 1: // Botão do meio
        this.mouseButtons.middle = true;
        break;
        
      case 2: // Botão direito
        this.mouseButtons.right = true;
        this.events.emit('input:aim', { aiming: true });
        break;
    }
    
    event.preventDefault();
  }

  /**
   * Manipula evento de botão do mouse liberado
   * @param {MouseEvent} event - Evento de mouse
   */
  handleMouseUp(event) {
    if (!this.isInitialized) return;
    
    // Atualiza estado do botão do mouse
    switch (event.button) {
      case 0: // Botão esquerdo
        this.mouseButtons.left = false;
        break;
        
      case 1: // Botão do meio
        this.mouseButtons.middle = false;
        break;
        
      case 2: // Botão direito
        this.mouseButtons.right = false;
        this.events.emit('input:aim', { aiming: false });
        break;
    }
    
    event.preventDefault();
  }

  /**
   * Manipula evento de movimento do mouse
   * @param {MouseEvent} event - Evento de mouse
   */
  handleMouseMove(event) {
    if (!this.isInitialized || !this.isPointerLocked) return;
    
    // Acumula movimento do mouse
    this.mouseMovement.x += event.movementX || 0;
    this.mouseMovement.y += event.movementY || 0;
  }

  /**
   * Manipula alteração do estado de bloqueio do ponteiro
   */
  handlePointerLockChange() {
    this.isPointerLocked = document.pointerLockElement === this.domElement;
    
    // Reseta todos os estados se o ponteiro não estiver bloqueado
    if (!this.isPointerLocked) {
      this.resetAllInputStates();
    }
    
    // Emite evento de mudança de bloqueio do ponteiro
    this.events.emit('input:pointerLockChange', { locked: this.isPointerLocked });
  }

  /**
   * Manipula erros no bloqueio do ponteiro
   */
  handlePointerLockError() {
    console.error('Error attempting to lock pointer.');
    this.events.emit('input:pointerLockError', {});
  }

  /**
   * Manipula evento de clique no elemento DOM
   */
  handleClick() {
    if (!this.isInitialized || this.isPointerLocked) return;
    
    // Solicita bloqueio do ponteiro
    this.domElement.requestPointerLock();
  }

  /**
   * Manipula evento de roda do mouse
   * @param {WheelEvent} event - Evento de roda do mouse
   */
  handleWheel(event) {
    if (!this.isInitialized || !this.isPointerLocked) return;
    
    // Emite evento para trocar arma baseado na direção da roda
    const direction = event.deltaY > 0 ? 1 : -1;
    this.events.emit('input:cycleWeapon', { direction });
    
    event.preventDefault();
  }

  /**
   * Manipula evento de menu de contexto
   * @param {MouseEvent} event - Evento de menu de contexto
   */
  handleContextMenu(event) {
    if (this.isInitialized) {
      event.preventDefault();
    }
  }

  /**
   * Atualiza estado de uma tecla
   * @param {string} code - Código da tecla
   * @param {boolean} isPressed - Se a tecla está pressionada
   */
  updateKeyState(code, isPressed) {
    this.keys[code] = isPressed;
    
    const action = this.keyMap[code];
    if (action) {
      this.inputState[action] = isPressed;
    }
  }

  /**
   * Verifica se uma tecla é usada para o jogo
   * @param {string} code - Código da tecla
   * @returns {boolean} true se a tecla é usada para o jogo
   */
  isGameKey(code) {
    return Object.keys(this.keyMap).includes(code);
  }

  /**
   * Define o mapeamento de teclas
   * @param {Object} newKeyMap - Novo mapeamento de teclas
   */
  setKeyMap(newKeyMap) {
    this.keyMap = { ...newKeyMap };
  }

  /**
   * Define a sensibilidade do mouse
   * @param {number} value - Valor de sensibilidade
   */
  setSensitivity(value) {
    this.sensitivity = value;
  }

  /**
   * Reseta todos os estados de entrada
   */
  resetAllInputStates() {
    // Reseta estado das teclas
    this.keys = {};
    
    // Reseta estado dos botões do mouse
    this.mouseButtons.left = false;
    this.mouseButtons.right = false;
    this.mouseButtons.middle = false;
    
    // Reseta movimento do mouse
    this.mouseMovement.x = 0;
    this.mouseMovement.y = 0;
    
    // Reseta vetor de movimento
    this.movementVector.x = 0;
    this.movementVector.z = 0;
    
    // Reseta estados de input
    for (const key in this.inputState) {
      this.inputState[key] = false;
    }
  }

  /**
   * Solicita bloqueio do ponteiro
   */
  requestPointerLock() {
    if (!this.isInitialized || this.isPointerLocked) return;
    
    this.domElement.requestPointerLock();
  }

  /**
   * Libera o bloqueio do ponteiro
   */
  exitPointerLock() {
    if (!this.isInitialized || !this.isPointerLocked) return;
    
    document.exitPointerLock();
  }

  /**
   * Assina um evento
   * @param {string} eventType - Tipo de evento
   * @param {function} callback - Função de callback
   * @returns {function} Função para cancelar a assinatura
   */
  subscribe(eventType, callback) {
    return this.events.subscribe(eventType, callback);
  }

  /**
   * Libera recursos do sistema
   */
  dispose() {
    if (!this.isInitialized) return;
    
    // Remove event listeners para teclado
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    
    // Remove event listeners para mouse
    if (this.domElement) {
      this.domElement.removeEventListener('mousedown', this.handleMouseDown);
      this.domElement.removeEventListener('click', this.handleClick);
      this.domElement.removeEventListener('wheel', this.handleWheel);
      this.domElement.removeEventListener('contextmenu', this.handleContextMenu);
    }
    
    window.removeEventListener('mouseup', this.handleMouseUp);
    document.removeEventListener('mousemove', this.handleMouseMove);
    
    // Remove event listeners para pointer lock
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
    document.removeEventListener('pointerlockerror', this.handlePointerLockError);
    
    // Libera bloqueio do ponteiro se necessário
    if (this.isPointerLocked) {
      document.exitPointerLock();
    }
    
    // Reseta estado
    this.resetAllInputStates();
    this.isInitialized = false;
    this.domElement = null;
    
    console.log('InputSystem disposto');
  }
}

// Exporta um singleton
export const inputSystem = new InputSystem();
export default inputSystem;