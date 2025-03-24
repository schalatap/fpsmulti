// client/systems/WeaponSystem.js

import { System } from '../../shared/utils/ECS';
import { eventSystem } from '../../shared/utils/EventSystem';
import { WeaponComponent, PlayerComponent } from '../../shared/components/CoreComponents';
import { WEAPON_TYPES } from '../../shared/constants/WeaponConstants';

class WeaponSystem extends System {
  constructor() {
    super();
    this.requiredComponents = [WeaponComponent];
    this.weapons = new Map(); // Mapeia entityId -> arma
    this.playerWeapons = new Map(); // Mapeia playerId -> array de entityIds de armas
    this.activeWeapons = new Map(); // Mapeia playerId -> entityId da arma ativa
    this.lastShotTime = new Map(); // Mapeia playerId -> timestamp do último tiro
    this.reloadTimers = new Map(); // Mapeia entityId -> timer de recarga
    this.renderSystem = null; // Referência ao sistema de renderização
  }

  initialize(renderSystem) {
    this.renderSystem = renderSystem;
    
    // Assinar eventos relevantes
    eventSystem.on('input:fire', () => this.handleFireInput());
    eventSystem.on('input:reload', () => this.handleReloadInput());
    eventSystem.on('input:switch', (data) => this.handleSwitchInput(data));
    
    // Eventos de rede
    eventSystem.on('player:shoot', (data) => this.handleRemotePlayerShoot(data));
    eventSystem.on('player:reload', (data) => this.handleRemotePlayerReload(data));
    eventSystem.on('player:switchWeapon', (data) => this.handleRemotePlayerSwitch(data));
    
    console.log('Weapon system initialized');
  }

  addEntity(entity) {
    if (!this.canProcessEntity(entity)) return;
    
    const weaponComponent = entity.getComponent(WeaponComponent);
    
    // Adiciona ao sistema
    this.weapons.set(entity.id, weaponComponent);
    
    // Se a entidade tem um componente de jogador, associa a arma ao jogador
    if (entity.hasComponent(PlayerComponent)) {
      const playerComponent = entity.getComponent(PlayerComponent);
      
      if (!this.playerWeapons.has(playerComponent.id)) {
        this.playerWeapons.set(playerComponent.id, []);
      }
      
      this.playerWeapons.get(playerComponent.id).push(entity.id);
      
      // Define como arma ativa se for a primeira
      if (!this.activeWeapons.has(playerComponent.id)) {
        this.activeWeapons.set(playerComponent.id, entity.id);
      }
    }
    
    super.addEntity(entity);
  }

  removeEntity(entityId) {
    // Remove do mapa de armas
    if (this.weapons.has(entityId)) {
      const weaponComponent = this.weapons.get(entityId);
      this.weapons.delete(entityId);
      
      // Remove da lista de armas do jogador
      this.playerWeapons.forEach((weapons, playerId) => {
        const index = weapons.indexOf(entityId);
        if (index !== -1) {
          weapons.splice(index, 1);
          
          // Se era a arma ativa, troca para outra
          if (this.activeWeapons.get(playerId) === entityId) {
            if (weapons.length > 0) {
              this.activeWeapons.set(playerId, weapons[0]);
            } else {
              this.activeWeapons.delete(playerId);
            }
          }
        }
      });
    }
    
    // Limpa temporizadores de recarga
    if (this.reloadTimers.has(entityId)) {
      clearTimeout(this.reloadTimers.get(entityId));
      this.reloadTimers.delete(entityId);
    }
    
    super.removeEntity(entityId);
  }

  // Lida com entrada de tiro do jogador local
  handleFireInput() {
    const localPlayerId = window.gameClient.playerId;
    if (!localPlayerId) return;
    
    const activeWeaponId = this.activeWeapons.get(localPlayerId);
    if (!activeWeaponId) return;
    
    this.fireWeapon(localPlayerId, activeWeaponId);
  }

  // Lida com entrada de recarga do jogador local
  handleReloadInput() {
    const localPlayerId = window.gameClient.playerId;
    if (!localPlayerId) return;
    
    const activeWeaponId = this.activeWeapons.get(localPlayerId);
    if (!activeWeaponId) return;
    
    this.reloadWeapon(localPlayerId, activeWeaponId);
  }

  // Lida com entrada de troca de arma do jogador local
  handleSwitchInput(data) {
    const localPlayerId = window.gameClient.playerId;
    if (!localPlayerId) return;
    
    const weapons = this.playerWeapons.get(localPlayerId);
    if (!weapons || weapons.length <= data.weaponId) return;
    
    const targetWeaponId = weapons[data.weaponId];
    this.switchWeapon(localPlayerId, targetWeaponId);
  }

  // Processa o disparo de arma remoto (de outro jogador)
  handleRemotePlayerShoot(data) {
    const { playerId, weaponId, position, direction } = data;
    
    // Não processa tiros do jogador local, já tratados pela entrada
    if (playerId === window.gameClient.playerId) return;
    
    // Encontra a arma do jogador remoto
    const playerEntityId = window.gameClient.networkSystem.getRemotePlayerEntityId(playerId);
    if (!playerEntityId) return;
    
    // Reproduz efeito visual de tiro
    this.playShootEffects(position, direction, data.weaponType);
  }

  // Processa a recarga remota
  handleRemotePlayerReload(data) {
    const { playerId, weaponId } = data;
    
    // Não processa recargas do jogador local
    if (playerId === window.gameClient.playerId) return;
    
    // Reproduz efeito de recarga
    this.playReloadEffects(playerId);
  }

  // Processa a troca de arma remota
  handleRemotePlayerSwitch(data) {
    const { playerId, weaponId } = data;
    
    // Não processa trocas do jogador local
    if (playerId === window.gameClient.playerId) return;
    
    // Reproduz efeito visual de troca
    this.playSwitchWeaponEffects(playerId, data.weaponType);
  }

  // Dispara uma arma
  fireWeapon(playerId, weaponId) {
    // Verifica se a arma está no sistema
    if (!this.weapons.has(weaponId)) return false;
    
    const weaponComponent = this.weapons.get(weaponId);
    
    // Verifica cooldown de disparo
    const now = Date.now();
    const lastShot = this.lastShotTime.get(playerId) || 0;
    const cooldown = 1000 / weaponComponent.fireRate;
    
    if (now - lastShot < cooldown) return false;
    
    // Verifica se está recarregando
    if (weaponComponent.isReloading) return false;
    
    // Verifica munição
    if (weaponComponent.currentAmmo <= 0) {
      // Auto-recarga quando sem munição
      this.reloadWeapon(playerId, weaponId);
      return false;
    }
    
    // Atualiza estado da arma
    weaponComponent.currentAmmo--;
    weaponComponent.lastFireTime = now;
    this.lastShotTime.set(playerId, now);
    
    // Obtém posição e direção do jogador para o tiro
    const playerEntityId = playerId === window.gameClient.playerId ? 
      window.gameClient.playerEntityId : 
      window.gameClient.networkSystem.getRemotePlayerEntityId(playerId);
    
    if (!playerEntityId) return false;
    
    const playerEntity = window.gameClient.ecs.entityManager.getEntity(playerEntityId);
    if (!playerEntity) return false;
    
    const positionComponent = playerEntity.getComponent('PositionComponent');
    if (!positionComponent) return false;
    
    // Calcula direção do tiro (para frente do jogador)
    const direction = {
      x: -Math.sin(positionComponent.rotationY) * Math.cos(positionComponent.rotationX),
      y: Math.sin(positionComponent.rotationX),
      z: -Math.cos(positionComponent.rotationY) * Math.cos(positionComponent.rotationX)
    };
    
    // Para o jogador local, envia evento de tiro para o servidor
    if (playerId === window.gameClient.playerId) {
      // Adiciona alguma dispersão baseada na precisão da arma
      const accuracy = weaponComponent.accuracy;
      const spread = (1 - accuracy) * 0.1;
      
      if (spread > 0) {
        direction.x += (Math.random() * 2 - 1) * spread;
        direction.y += (Math.random() * 2 - 1) * spread;
        direction.z += (Math.random() * 2 - 1) * spread;
        
        // Normaliza o vetor de direção
        const length = Math.sqrt(direction.x * direction.x + direction.y * direction.y + direction.z * direction.z);
        direction.x /= length;
        direction.y /= length;
        direction.z /= length;
      }
      
      // Aplica recuo
      const recoil = this.calculateRecoil(weaponComponent);
      
      // Aplica o recuo à rotação do jogador
      positionComponent.rotationX -= recoil.vertical;
      positionComponent.rotationY += recoil.horizontal;
      
      // Limita o recuo vertical
      positionComponent.rotationX = Math.max(-Math.PI/2, Math.min(Math.PI/2, positionComponent.rotationX));
      
      // Notifica o servidor
      window.gameClient.socket.emit('player:shoot', {
        position: {
          x: positionComponent.x,
          y: positionComponent.y + 1.7, // Altura da câmera
          z: positionComponent.z
        },
        direction: direction,
        weaponId: weaponId,
        weaponType: weaponComponent.weaponType
      });
    }
    
    // Reproduz efeitos visuais e sonoros do tiro
    const cameraPosition = {
      x: positionComponent.x,
      y: positionComponent.y + 1.7, // Altura da câmera
      z: positionComponent.z
    };
    
    this.playShootEffects(cameraPosition, direction, weaponComponent.weaponType);
    
    return true;
  }

  // Recarrega uma arma
  reloadWeapon(playerId, weaponId) {
    // Verifica se a arma está no sistema
    if (!this.weapons.has(weaponId)) return false;
    
    const weaponComponent = this.weapons.get(weaponId);
    
    // Verifica se já está recarregando
    if (weaponComponent.isReloading) return false;
    
    // Verifica se precisa recarregar
    if (weaponComponent.currentAmmo >= weaponComponent.maxAmmo) return false;
    
    // Verifica se tem munição reserva
    if (weaponComponent.reserveAmmo <= 0) return false;
    
    // Inicia recarga
    weaponComponent.isReloading = true;
    
    // Para o jogador local, envia evento de recarga para o servidor
    if (playerId === window.gameClient.playerId) {
      window.gameClient.socket.emit('player:reload', {
        weaponId: weaponId,
        weaponType: weaponComponent.weaponType
      });
    }
    
    // Reproduz efeitos de recarga
    this.playReloadEffects(playerId);
    
    // Configura timer para completar a recarga
    const reloadTimer = setTimeout(() => {
      // Calcula quantidade a recarregar
      const neededAmmo = weaponComponent.maxAmmo - weaponComponent.currentAmmo;
      const reloadAmount = Math.min(neededAmmo, weaponComponent.reserveAmmo);
      
      // Atualiza munição
      weaponComponent.currentAmmo += reloadAmount;
      weaponComponent.reserveAmmo -= reloadAmount;
      weaponComponent.isReloading = false;
      
      this.reloadTimers.delete(weaponId);
    }, weaponComponent.reloadTime * 1000);
    
    this.reloadTimers.set(weaponId, reloadTimer);
    
    return true;
  }

  // Troca para outra arma
  switchWeapon(playerId, weaponId) {
    // Verifica se a arma está no sistema
    if (!this.weapons.has(weaponId)) return false;
    
    // Verifica se já é a arma ativa
    if (this.activeWeapons.get(playerId) === weaponId) return false;
    
    // Troca para a nova arma
    this.activeWeapons.set(playerId, weaponId);
    
    // Para o jogador local, envia evento de troca para o servidor
    if (playerId === window.gameClient.playerId) {
      const weaponComponent = this.weapons.get(weaponId);
      
      window.gameClient.socket.emit('player:switchWeapon', {
        weaponId: weaponId,
        weaponType: weaponComponent.weaponType
      });
    }
    
    // Reproduz efeitos de troca
    const weaponComponent = this.weapons.get(weaponId);
    this.playSwitchWeaponEffects(playerId, weaponComponent.weaponType);
    
    return true;
  }

  // Obtém estatísticas de uma arma
  getWeaponStats(weaponId) {
    if (!this.weapons.has(weaponId)) return null;
    
    return this.weapons.get(weaponId);
  }
  
  // Calcula o recuo baseado nas características da arma
  calculateRecoil(weaponComponent) {
    const baseRecoil = weaponComponent.recoil;
    
    // Recuo vertical é maior que o horizontal
    const verticalRecoil = baseRecoil * 0.03 * (0.5 + Math.random());
    
    // Recuo horizontal é aleatório para esquerda ou direita
    const horizontalRecoil = baseRecoil * 0.01 * (Math.random() * 2 - 1);
    
    return {
      vertical: verticalRecoil,
      horizontal: horizontalRecoil
    };
  }
  
  // Reproduz efeitos visuais de tiro
  playShootEffects(position, direction, weaponType) {
    if (!this.renderSystem) return;
    
    // Efeito de disparo (flash)
    const muzzlePosition = {
      x: position.x + direction.x * 0.5,
      y: position.y + direction.y * 0.5,
      z: position.z + direction.z * 0.5
    };
    
    // Efeito de traçador (linha do tiro)
    const endpoint = {
      x: position.x + direction.x * 100,
      y: position.y + direction.y * 100,
      z: position.z + direction.z * 100
    };
    
    // Cria o efeito visual
    const effectType = weaponType === 'rifle' ? 'rifleShot' : 'pistolShot';
    this.renderSystem.createWeaponEffect(effectType, muzzlePosition, endpoint);
    
    // Na vida real também adicionaríamos efeitos sonoros aqui
  }
  
  // Reproduz efeitos de recarga
  playReloadEffects(playerId) {
    // Aqui seria efeito visual de recarga e som
    // Para simplificar, não implementaremos completamente
  }
  
  // Reproduz efeitos de troca de arma
  playSwitchWeaponEffects(playerId, weaponType) {
    // Aqui seria efeito visual de troca e som
    // Para simplificar, não implementaremos completamente
  }

  // Atualiza o sistema de armas
  update(deltaTime) {
    // Não há muito para atualizar aqui, a lógica é principalmente baseada em eventos
  }
}

export default WeaponSystem;