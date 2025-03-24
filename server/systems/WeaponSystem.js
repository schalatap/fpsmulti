// server/systems/WeaponSystem.js

const { eventSystem } = require('../../shared/utils/EventSystem');
const { WeaponComponent, PlayerComponent } = require('../../shared/components/CoreComponents');

class WeaponSystem {
  constructor(ecs, ballisticsSystem) {
    this.ecs = ecs;
    this.ballisticsSystem = ballisticsSystem;
    this.weapons = new Map(); // Mapeia entityId -> arma
    this.playerWeapons = new Map(); // Mapeia playerId -> array de entityIds de armas
    this.activeWeapons = new Map(); // Mapeia playerId -> entityId da arma ativa
    this.lastShotTime = new Map(); // Mapeia playerId -> timestamp do último tiro
    this.reloadTimers = new Map(); // Mapeia entityId -> timer de recarga
  }

  initialize() {
    // Registrar tratadores de eventos relevantes
    eventSystem.on('player:shoot', (data) => this.handlePlayerShoot(data));
    eventSystem.on('player:reload', (data) => this.handlePlayerReload(data));
    eventSystem.on('player:switchWeapon', (data) => this.handlePlayerSwitchWeapon(data));
    
    console.log('Server Weapon system initialized');
  }

  // Registra uma nova arma no sistema
  registerWeapon(entity) {
    if (!entity.components.weaponComponent) return;
    
    const weaponComponent = entity.components.weaponComponent;
    
    // Adiciona ao sistema
    this.weapons.set(entity.id, weaponComponent);
    
    // Se a entidade tem um componente de jogador, associa a arma ao jogador
    if (entity.components.playerComponent) {
      const playerComponent = entity.components.playerComponent;
      
      if (!this.playerWeapons.has(playerComponent.id)) {
        this.playerWeapons.set(playerComponent.id, []);
      }
      
      this.playerWeapons.get(playerComponent.id).push(entity.id);
      
      // Define como arma ativa se for a primeira
      if (!this.activeWeapons.has(playerComponent.id)) {
        this.activeWeapons.set(playerComponent.id, entity.id);
      }
    }
  }

  // Remove uma arma do sistema
  removeWeapon(entityId) {
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
  }

  // Processa o disparo de um jogador
  handlePlayerShoot(data) {
    const { playerId, position, direction, weaponId, weaponType } = data;
    
    // Verifica a arma ativa do jogador
    const activeWeaponId = this.activeWeapons.get(playerId);
    if (!activeWeaponId) return;
    
    const weaponComponent = this.weapons.get(activeWeaponId);
    if (!weaponComponent) return;
    
    // Verifica cooldown de disparo
    const now = Date.now();
    const lastShot = this.lastShotTime.get(playerId) || 0;
    const cooldown = 1000 / weaponComponent.fireRate;
    
    if (now - lastShot < cooldown) {
      console.log(`Rate limiting shot from player ${playerId}`);
      return;
    }
    
    // Verifica se está recarregando
    if (weaponComponent.isReloading) return;
    
    // Verifica munição
    if (weaponComponent.currentAmmo <= 0) return;
    
    // Atualiza estado da arma
    weaponComponent.currentAmmo--;
    weaponComponent.lastFireTime = now;
    this.lastShotTime.set(playerId, now);
    
    // Valida a posição e direção do tiro
    // Este é um ponto crítico para prevenção de trapaças
    // Pode-se implementar lógica de validação mais detalhada aqui
    
    // Simula a balística do projétil
    let hitResult = null;
    if (this.ballisticsSystem) {
      const projectileData = {
        origin: position,
        direction: direction,
        speed: 500, // Velocidade do projétil
        weaponType: weaponType,
        shooterId: playerId
      };
      
      hitResult = this.ballisticsSystem.simulateProjectile(projectileData);
    }
    
    // Processa o resultado do tiro
    if (hitResult && hitResult.hit) {
      // Calcula dano baseado nas características da arma e do impacto
      const damage = this.calculateDamage(weaponComponent, hitResult.hit);
      
      // Aplica dano se atingiu um jogador
      if (hitResult.hit.entityId) {
        const entity = this.ecs.entityManager.getEntity(hitResult.hit.entityId);
        
        if (entity && entity.components.playerComponent && entity.components.healthComponent) {
          const targetPlayerId = entity.components.playerComponent.id;
          
          // Não causa dano em si mesmo (a menos que seja fogo amigo)
          if (targetPlayerId !== playerId) {
            this.applyDamage(targetPlayerId, damage, playerId, weaponId);
          }
        }
      }
      
      // Notifica clientes sobre o impacto
      eventSystem.emit('projectile:hit', {
        projectileId: Date.now(), // ID temporário
        targetId: hitResult.hit.entityId,
        position: hitResult.hit.position,
        normal: hitResult.hit.normal,
        playerId: playerId
      });
    }
    
    // Propaga o evento de tiro para todos os clientes
    // Isso fará com que todos mostrem os efeitos visuais do tiro
    eventSystem.emit('player:shoot', {
      playerId: playerId,
      position: position,
      direction: direction,
      weaponId: weaponId,
      weaponType: weaponType
    });
  }

  // Processa a recarga de uma arma
  handlePlayerReload(data) {
    const { playerId, weaponId } = data;
    
    // Verifica a arma ativa do jogador
    const activeWeaponId = this.activeWeapons.get(playerId);
    if (!activeWeaponId) return;
    
    // Inicia o processo de recarga
    this.reloadWeapon(playerId, activeWeaponId);
    
    // Propaga o evento de recarga para todos os clientes
    eventSystem.emit('player:reload', {
      playerId: playerId,
      weaponId: activeWeaponId
    });
  }

  // Processa a troca de arma
  handlePlayerSwitchWeapon(data) {
    const { playerId, weaponId } = data;
    
    // Verifica se o jogador tem esta arma
    const playerWeapons = this.playerWeapons.get(playerId);
    if (!playerWeapons || !playerWeapons.includes(weaponId)) return;
    
    // Realiza a troca
    this.activeWeapons.set(playerId, weaponId);
    
    // Propaga o evento de troca para todos os clientes
    eventSystem.emit('player:switchWeapon', {
      playerId: playerId,
      weaponId: weaponId
    });
  }

  // Dispara uma arma
  fireWeapon(playerId, weaponId) {
    // Esta é a versão do servidor de fireWeapon
    // Geralmente não é chamada diretamente, mas através de handlePlayerShoot
    
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
    
    return true;
  }

  // Obtém estatísticas de uma arma
  getWeaponStats(weaponId) {
    if (!this.weapons.has(weaponId)) return null;
    
    return this.weapons.get(weaponId);
  }
  
  // Calcula dano baseado nas características da arma e do impacto
  calculateDamage(weaponComponent, hitInfo) {
    // Dano base da arma
    let damage = weaponComponent.damage;
    
    // Fatores de modificação
    // - Distância (dano diminui com a distância)
    const distance = hitInfo.distance || 0;
    const falloffStart = 20; // Começa a perder dano após essa distância
    const falloffEnd = 100; // Distância máxima onde o dano é mínimo
    
    if (distance > falloffStart) {
      const falloffFactor = 1 - Math.min(1, (distance - falloffStart) / (falloffEnd - falloffStart));
      damage *= Math.max(0.2, falloffFactor); // No mínimo 20% do dano original
    }
    
    // - Parte do corpo (headshot = mais dano)
    // Simplificado: não implementamos detecção de partes do corpo
    
    // - Penetração de materiais
    // Simplificado: não implementamos penetração de materiais
    
    return Math.floor(damage);
  }
  
  // Aplica dano a um jogador
  applyDamage(targetPlayerId, damage, attackerId, weaponId) {
    // Encontra a entidade do jogador alvo
    const entities = this.ecs.entityManager.getAllEntities();
    let targetEntity = null;
    
    for (const entity of entities) {
      if (entity.components.playerComponent && 
          entity.components.playerComponent.id === targetPlayerId) {
        targetEntity = entity;
        break;
      }
    }
    
    if (!targetEntity || !targetEntity.components.healthComponent) return;
    
    const healthComponent = targetEntity.components.healthComponent;
    
    // Aplica o dano
    healthComponent.currentHealth -= damage;
    healthComponent.lastDamageTime = Date.now();
    
    // Emite evento de dano
    eventSystem.emit('player:damage', {
      playerId: targetPlayerId,
      damage: damage,
      attackerId: attackerId,
      weaponId: weaponId
    });
    
    // Verifica se o jogador morreu
    if (healthComponent.currentHealth <= 0) {
      healthComponent.currentHealth = 0;
      
      // Emite evento de morte
      eventSystem.emit('player:death', {
        playerId: targetPlayerId,
        killerId: attackerId,
        weaponId: weaponId
      });
    }
  }
  
  // Cria uma nova arma para um jogador
  createWeaponForPlayer(playerId, weaponType) {
    // Cria uma entidade para a arma
    const weaponEntity = this.ecs.entityManager.createEntity();
    
    // Cria o componente de arma com base no tipo
    const weaponComponent = this.createWeaponComponent(weaponType);
    
    // Adiciona o componente à entidade
    this.ecs.addComponent(weaponEntity.id, weaponComponent);
    
    // Registra a arma no sistema
    this.registerWeapon(weaponEntity);
    
    // Associa a arma ao jogador
    if (!this.playerWeapons.has(playerId)) {
      this.playerWeapons.set(playerId, []);
    }
    
    this.playerWeapons.get(playerId).push(weaponEntity.id);
    
    // Se for a primeira arma, torna-a ativa
    if (this.playerWeapons.get(playerId).length === 1) {
      this.activeWeapons.set(playerId, weaponEntity.id);
    }
    
    return weaponEntity;
  }
  
  // Cria um componente de arma baseado no tipo
  createWeaponComponent(type) {
    const weaponComponent = new WeaponComponent(type);
    
    // Configura características da arma baseado no tipo
    switch (type) {
      case 'pistol':
        weaponComponent.damage = 20;
        weaponComponent.fireRate = 2;
        weaponComponent.reloadTime = 1.5;
        weaponComponent.accuracy = 0.9;
        weaponComponent.recoil = 0.2;
        weaponComponent.currentAmmo = 12;
        weaponComponent.maxAmmo = 12;
        weaponComponent.reserveAmmo = 36;
        weaponComponent.range = 50;
        break;
        
      case 'rifle':
        weaponComponent.damage = 30;
        weaponComponent.fireRate = 8;
        weaponComponent.reloadTime = 2.5;
        weaponComponent.accuracy = 0.8;
        weaponComponent.recoil = 0.4;
        weaponComponent.currentAmmo = 30;
        weaponComponent.maxAmmo = 30;
        weaponComponent.reserveAmmo = 90;
        weaponComponent.range = 100;
        break;
        
      case 'shotgun':
        weaponComponent.damage = 80;
        weaponComponent.fireRate = 1;
        weaponComponent.reloadTime = 3;
        weaponComponent.accuracy = 0.7;
        weaponComponent.recoil = 0.8;
        weaponComponent.currentAmmo = 8;
        weaponComponent.maxAmmo = 8;
        weaponComponent.reserveAmmo = 24;
        weaponComponent.range = 30;
        break;
        
      case 'sniper':
        weaponComponent.damage = 100;
        weaponComponent.fireRate = 0.5;
        weaponComponent.reloadTime = 3.5;
        weaponComponent.accuracy = 0.98;
        weaponComponent.recoil = 0.6;
        weaponComponent.currentAmmo = 5;
        weaponComponent.maxAmmo = 5;
        weaponComponent.reserveAmmo = 15;
        weaponComponent.range = 200;
        break;
        
      default:
        // Configuração padrão é uma pistola
        weaponComponent.damage = 20;
        weaponComponent.fireRate = 2;
        weaponComponent.reloadTime = 1.5;
        weaponComponent.accuracy = 0.9;
        weaponComponent.recoil = 0.2;
        weaponComponent.currentAmmo = 12;
        weaponComponent.maxAmmo = 12;
        weaponComponent.reserveAmmo = 36;
        weaponComponent.range = 50;
    }
    
    return weaponComponent;
  }

  // Limpa recursos ao desligar o sistema
  dispose() {
    // Limpa todos os temporizadores de recarga
    for (const timer of this.reloadTimers.values()) {
      clearTimeout(timer);
    }
    
    this.reloadTimers.clear();
  }
}

module.exports = WeaponSystem;