/**
 * Sistema de Magias para o servidor
 */

import { SPELLS, SPELL_TYPES, SPELL_EFFECTS, SPELL_BALANCE } from '../../shared/constants/SpellConstants.js';
import { SpellComponent, SpellCasterComponent, ManaComponent } from '../../shared/components/SpellComponent.js';
import { Vector3 } from 'three';

export class SpellSystem {
  /**
   * Cria um novo sistema de magias para o servidor
   * @param {Object} ecs - Referência ao sistema ECS
   * @param {Object} eventSystem - Sistema de eventos para comunicação
   * @param {Object} physicsSystem - Sistema de física para detecção de colisão
   * @param {Object} networkSystem - Sistema de rede para comunicação com clientes
   * @param {Object} gameSystem - Sistema de jogo para acesso a entidades
   */
  constructor(ecs, eventSystem, physicsSystem, networkSystem, gameSystem) {
    this.ecs = ecs;
    this.eventSystem = eventSystem;
    this.physicsSystem = physicsSystem;
    this.networkSystem = networkSystem;
    this.gameSystem = gameSystem;
    
    this.activeSpells = new Map(); // Mapeia IDs de entidades para as magias ativas
    this.nextSpellId = 1; // Contador para IDs únicos de magias
    this.activeEffects = new Map(); // Efeitos ativos por entidade
    this.pendingSpells = []; // Fila de magias pendentes após o cast time
    
    this.setupEventListeners();
  }
  
  /**
   * Inicializa o sistema de magias
   */
  initialize() {
    console.log('Inicializando SpellSystem para o servidor');
  }
  
  /**
   * Configura ouvintes de eventos
   */
  setupEventListeners() {
    // Escuta eventos de rede de jogadores
    this.eventSystem.subscribe('player:castSpell', this.handlePlayerCastSpell.bind(this));
    
    // Escuta eventos do jogo
    this.eventSystem.subscribe('player:death', this.handlePlayerDeath.bind(this));
    this.eventSystem.subscribe('player:respawn', this.handlePlayerRespawn.bind(this));
    this.eventSystem.subscribe('match:end', this.handleMatchEnd.bind(this));
  }
  
  /**
   * Processa solicitação de lançamento de magia de um jogador
   * @param {Object} data - Dados do lançamento
   */
  handlePlayerCastSpell(data) {
    const { playerId, spellId, targetId, targetPosition, castingStartTime, position, rotation } = data;
    
    // Obter entidade do jogador
    const playerEntity = this.ecs.getEntityByTag(`player_${playerId}`);
    if (!playerEntity) {
      console.warn(`Entidade do jogador não encontrada: ${playerId}`);
      return;
    }
    
    // Obter componentes necessários
    const casterComponent = playerEntity.getComponent(SpellCasterComponent);
    if (!casterComponent) {
      console.warn(`Jogador não possui componente SpellCasterComponent: ${playerId}`);
      return;
    }
    
    const manaComponent = playerEntity.getComponent(ManaComponent);
    if (!manaComponent) {
      console.warn(`Jogador não possui componente ManaComponent: ${playerId}`);
      return;
    }
    
    // Verificar se o jogador conhece a magia
    if (!casterComponent.knowsSpell(spellId)) {
      console.warn(`Jogador tentou lançar magia desconhecida: ${spellId}`);
      return;
    }
    
    // Verificar cooldown
    if (casterComponent.isOnCooldown(spellId)) {
      console.warn(`Jogador tentou lançar magia em cooldown: ${spellId}`);
      return;
    }
    
    // Obter informações da magia
    const spellInfo = SPELLS[spellId.toUpperCase()];
    if (!spellInfo) {
      console.error(`Informações da magia não encontradas: ${spellId}`);
      return;
    }
    
    // Verificar mana
    const manaCost = this.calculateManaCost(spellInfo);
    if (!manaComponent.hasSufficientMana(manaCost)) {
      console.warn(`Jogador não tem mana suficiente para lançar: ${spellId}`);
      return;
    }
    
    // Verificar se já está lançando uma magia
    if (casterComponent.isCasting()) {
      console.warn(`Jogador já está lançando uma magia: ${playerId}`);
      return;
    }
    
    // Iniciar o lançamento
    const currentTime = Date.now();
    const castTime = spellInfo.castTime * 1000; // Converter para ms
    const castingEndTime = currentTime + castTime;
    
    // Atualizar componente de lançamento
    casterComponent.castingSpell = spellId;
    casterComponent.castingStartTime = currentTime;
    casterComponent.castingEndTime = castingEndTime;
    casterComponent.castingTarget = targetId;
    casterComponent.castingPosition = targetPosition;
    
    // Transmitir evento para todos os clientes (inclusive o lançador para confirmação)
    this.networkSystem.broadcastToAll('spell:cast', {
      playerId,
      spellId,
      targetId,
      targetPosition,
      castTime: spellInfo.castTime,
      position,
      rotation
    });
    
    // Adicionar à fila de magias pendentes
    this.pendingSpells.push({
      playerId,
      entityId: playerEntity.id,
      spellId,
      targetId,
      targetPosition,
      castingEndTime,
      position,
      rotation
    });
  }
  
  /**
   * Processa a morte de um jogador
   * @param {Object} data - Dados da morte
   */
  handlePlayerDeath(data) {
    const { playerId, killerId } = data;
    
    // Obter entidade do jogador
    const playerEntity = this.ecs.getEntityByTag(`player_${playerId}`);
    if (!playerEntity) return;
    
    // Cancelar qualquer lançamento em andamento
    const casterComponent = playerEntity.getComponent(SpellCasterComponent);
    if (casterComponent && casterComponent.isCasting()) {
      casterComponent.castingSpell = null;
      casterComponent.castingStartTime = 0;
      casterComponent.castingEndTime = 0;
      
      // Remover da fila de magias pendentes
      this.pendingSpells = this.pendingSpells.filter(
        spell => spell.playerId !== playerId
      );
      
      // Transmitir cancelamento para todos os clientes
      this.networkSystem.broadcastToAll('spell:castCancelled', {
        playerId
      });
    }
    
    // Remover todos os efeitos ativos do jogador
    this.removeAllEffectsFromEntity(playerEntity.id);
  }
  
  /**
   * Processa o respawn de um jogador
   * @param {Object} data - Dados do respawn
   */
  handlePlayerRespawn(data) {
    const { playerId } = data;
    
    // Obter entidade do jogador
    const playerEntity = this.ecs.getEntityByTag(`player_${playerId}`);
    if (!playerEntity) return;
    
    // Resetar mana
    const manaComponent = playerEntity.getComponent(ManaComponent);
    if (manaComponent) {
      manaComponent.currentMana = manaComponent.maxMana;
      
      // Notificar clientes
      this.networkSystem.broadcastToAll('player:manaChanged', {
        playerId,
        currentMana: manaComponent.currentMana,
        maxMana: manaComponent.maxMana
      });
    }
  }
  
  /**
   * Processa o fim da partida
   */
  handleMatchEnd() {
    // Limpar todas as magias ativas
    for (const [spellEntityId, spellEntity] of this.activeSpells) {
      this.ecs.removeEntity(spellEntity.id);
      
      // Notificar clientes
      this.networkSystem.broadcastToAll('spell:remove', {
        spellEntityId
      });
    }
    
    // Limpar cache
    this.activeSpells.clear();
    this.pendingSpells = [];
    
    // Limpar todos os efeitos ativos
    this.clearAllEffects();
  }
  
  /**
   * Dispara uma magia no mundo após o tempo de lançamento
   * @param {Object} pendingSpell - Dados da magia pendente
   */
  castSpell(pendingSpell) {
    const { playerId, entityId, spellId, targetId, targetPosition, position, rotation } = pendingSpell;
    
    // Obter entidade do jogador
    const playerEntity = this.ecs.getEntityByTag(`player_${playerId}`);
    if (!playerEntity) {
      console.warn(`Entidade do jogador não encontrada ao finalizar cast: ${playerId}`);
      return;
    }
    
    // Obter componentes necessários
    const casterComponent = playerEntity.getComponent(SpellCasterComponent);
    if (!casterComponent) return;
    
    const manaComponent = playerEntity.getComponent(ManaComponent);
    if (!manaComponent) return;
    
    // Obter informações da magia
    const spellInfo = SPELLS[spellId.toUpperCase()];
    if (!spellInfo) return;
    
    // Consumir mana
    const manaCost = this.calculateManaCost(spellInfo);
    if (!manaComponent.useMana(manaCost)) {
      // Falha ao usar mana (raro, mas possível se perder mana durante o cast)
      console.warn(`Mana insuficiente ao finalizar cast: ${playerId}`);
      return;
    }
    
    // Aplicar cooldown
    const cooldownTime = this.calculateCooldown(spellInfo);
    casterComponent.cooldowns[spellId] = Date.now() + cooldownTime;
    
    // Resetar estado de lançamento
    casterComponent.castingSpell = null;
    casterComponent.castingStartTime = 0;
    casterComponent.castingEndTime = 0;
    
    // Criar o efeito da magia no mundo baseado no tipo
    switch (spellInfo.type) {
      case SPELL_TYPES.PROJECTILE:
        this.createProjectileSpell(playerId, spellId, position, rotation, spellInfo);
        break;
      case SPELL_TYPES.AREA:
        this.createAreaSpell(playerId, spellId, targetPosition, spellInfo);
        break;
      case SPELL_TYPES.BUFF:
        this.createBuffSpell(playerId, spellId, spellInfo);
        break;
      case SPELL_TYPES.DEBUFF:
        this.createDebuffSpell(playerId, spellId, targetId, targetPosition, spellInfo);
        break;
      case SPELL_TYPES.UTILITY:
        this.createUtilitySpell(playerId, spellId, targetPosition, spellInfo);
        break;
      case SPELL_TYPES.SUMMON:
        this.createSummonSpell(playerId, spellId, targetPosition, spellInfo);
        break;
      default:
        console.warn(`Tipo de magia não implementado: ${spellInfo.type}`);
    }
    
    // Notificar clientes sobre uso de mana
    this.networkSystem.broadcastToAll('player:manaChanged', {
      playerId,
      currentMana: manaComponent.currentMana,
      maxMana: manaComponent.maxMana
    });
  }
  
  /**
   * Cria uma magia do tipo projétil
   * @param {string} playerId - ID do jogador que lançou a magia
   * @param {string} spellId - ID da magia
   * @param {Object} position - Posição inicial do projétil
   * @param {Object} rotation - Rotação inicial do projétil
   * @param {Object} spellInfo - Informações da magia
   */
  createProjectileSpell(playerId, spellId, position, rotation, spellInfo) {
    // Criar ID único para a magia
    const spellEntityId = `spell_${this.nextSpellId++}`;
    
    // Calcular direção com base na rotação
    const direction = new Vector3(0, 0, -1);
    direction.applyAxisAngle(new Vector3(1, 0, 0), rotation.x);
    direction.applyAxisAngle(new Vector3(0, 1, 0), rotation.y);
    direction.normalize();
    
    // Ajustar posição inicial (um pouco à frente do jogador)
    const origin = new Vector3(position.x, position.y, position.z);
    origin.add(direction.clone().multiplyScalar(1.0)); // 1 metro à frente
    
    // Criar entidade para o projétil
    const spellEntity = this.ecs.createEntity();
    spellEntity.addTag(spellEntityId);
    
    // Adicionar componente de posição
    const positionComponent = this.ecs.createComponent('PositionComponent', {
      x: origin.x,
      y: origin.y,
      z: origin.z,
      rotationX: rotation.x,
      rotationY: rotation.y,
      rotationZ: rotation.z
    });
    spellEntity.addComponent(positionComponent);
    
    // Adicionar componente de magia
    const spellComponent = new SpellComponent({
      spellId,
      casterId: playerId,
      element: spellInfo.element,
      damage: this.calculateSpellDamage(spellInfo),
      radius: spellInfo.radius,
      duration: spellInfo.duration,
      lifetime: spellInfo.lifetime,
      speed: spellInfo.speed,
      creationTime: Date.now(),
      effects: spellInfo.effects
    });
    spellEntity.addComponent(spellComponent);
    
    // Adicionar componente de velocidade
    const velocityComponent = this.ecs.createComponent('VelocityComponent', {
      x: direction.x * spellInfo.speed,
      y: direction.y * spellInfo.speed,
      z: direction.z * spellInfo.speed,
      speed: spellInfo.speed
    });
    spellEntity.addComponent(velocityComponent);
    
    // Adicionar componente de colisão
    const collisionComponent = this.ecs.createComponent('CollisionComponent', {
      shape: 'sphere',
      radius: 0.3, // Raio de colisão do projétil
      isTrigger: true,
      collisionGroup: 'spell',
      collisionMask: ['player', 'world']
    });
    spellEntity.addComponent(collisionComponent);
    
    // Adicionar ao sistema de física
    this.physicsSystem.addRigidBody(spellEntity);
    
    // Adicionar à lista de magias ativas
    this.activeSpells.set(spellEntityId, spellEntity);
    
    // Notificar clientes sobre a criação do projétil
    this.networkSystem.broadcastToAll('spell:effect', {
      spellEntityId,
      spellId,
      casterId: playerId,
      origin: {
        x: origin.x,
        y: origin.y,
        z: origin.z
      },
      direction: {
        x: direction.x,
        y: direction.y,
        z: direction.z
      }
    });
    
    return spellEntity;
  }
  
  /**
   * Cria uma magia de área
   * @param {string} playerId - ID do jogador que lançou a magia
   * @param {string} spellId - ID da magia
   * @param {Object} targetPosition - Posição alvo da magia
   * @param {Object} spellInfo - Informações da magia
   */
  createAreaSpell(playerId, spellId, targetPosition, spellInfo) {
    // Criar ID único para a magia
    const spellEntityId = `spell_${this.nextSpellId++}`;
    
    // Criar entidade para a magia de área
    const spellEntity = this.ecs.createEntity();
    spellEntity.addTag(spellEntityId);
    
    // Adicionar componente de posição
    const positionComponent = this.ecs.createComponent('PositionComponent', {
      x: targetPosition.x,
      y: targetPosition.y,
      z: targetPosition.z,
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0
    });
    spellEntity.addComponent(positionComponent);
    
    // Adicionar componente de magia
    const spellComponent = new SpellComponent({
      spellId,
      casterId: playerId,
      targetPosition,
      element: spellInfo.element,
      damage: this.calculateSpellDamage(spellInfo),
      radius: spellInfo.radius || 3, // Raio padrão se não especificado
      duration: spellInfo.duration,
      lifetime: spellInfo.duration || 5, // Tempo de vida igual à duração se não especificado
      creationTime: Date.now(),
      effects: spellInfo.effects
    });
    spellEntity.addComponent(spellComponent);
    
    // Adicionar componente de colisão
    const collisionComponent = this.ecs.createComponent('CollisionComponent', {
      shape: 'sphere',
      radius: spellInfo.radius || 3,
      isTrigger: true,
      collisionGroup: 'spell',
      collisionMask: ['player']
    });
    spellEntity.addComponent(collisionComponent);
    
    // Adicionar ao sistema de física
    this.physicsSystem.addRigidBody(spellEntity);
    
    // Adicionar à lista de magias ativas
    this.activeSpells.set(spellEntityId, spellEntity);
    
    // Notificar clientes sobre a criação da área
    this.networkSystem.broadcastToAll('spell:effect', {
      spellEntityId,
      spellId,
      casterId: playerId,
      targetPosition: {
        x: targetPosition.x,
        y: targetPosition.y,
        z: targetPosition.z
      },
      radius: spellInfo.radius || 3
    });
    
    return spellEntity;
  }
  
  /**
   * Cria uma magia de buff (aplicada no próprio jogador)
   * @param {string} playerId - ID do jogador que lançou a magia
   * @param {string} spellId - ID da magia
   * @param {Object} spellInfo - Informações da magia
   */
  createBuffSpell(playerId, spellId, spellInfo) {
    // Obter entidade do jogador
    const playerEntity = this.ecs.getEntityByTag(`player_${playerId}`);
    if (!playerEntity) return null;
    
    // Aplicar efeitos ao jogador
    for (const effect of spellInfo.effects) {
      this.applyEffectToEntity(playerEntity.id, effect, spellId, playerId, spellInfo.duration);
    }
    
    // Notificar clientes sobre o buff aplicado
    this.networkSystem.broadcastToAll('spell:buff', {
      playerId,
      spellId,
      duration: spellInfo.duration,
      effects: spellInfo.effects
    });
    
    return true;
  }
  
  /**
   * Cria uma magia de debuff (aplicada em inimigos)
   * @param {string} playerId - ID do jogador que lançou a magia
   * @param {string} spellId - ID da magia
   * @param {string} targetId - ID do alvo (opcional)
   * @param {Object} targetPosition - Posição alvo para debuffs de área
   * @param {Object} spellInfo - Informações da magia
   */
  createDebuffSpell(playerId, spellId, targetId, targetPosition, spellInfo) {
    // Se for debuff direcionado a um alvo específico
    if (targetId) {
      const targetEntity = this.ecs.getEntityByTag(`player_${targetId}`);
      if (!targetEntity) return null;
      
      // Aplicar efeitos ao alvo
      for (const effect of spellInfo.effects) {
        this.applyEffectToEntity(targetEntity.id, effect, spellId, playerId, spellInfo.duration);
      }
      
      // Notificar clientes sobre o debuff aplicado
      this.networkSystem.broadcastToAll('spell:debuff', {
        playerId,
        targetId,
        spellId,
        duration: spellInfo.duration,
        effects: spellInfo.effects
      });
      
      return true;
    }
    // Se for debuff de área
    else if (targetPosition && spellInfo.radius) {
      // Criar uma magia de área que aplica debuffs
      return this.createAreaSpell(playerId, spellId, targetPosition, spellInfo);
    }
    
    return null;
  }
  
  /**
   * Cria uma magia de utilidade (como teleporte)
   * @param {string} playerId - ID do jogador que lançou a magia
   * @param {string} spellId - ID da magia
   * @param {Object} targetPosition - Posição alvo da magia
   * @param {Object} spellInfo - Informações da magia
   */
  createUtilitySpell(playerId, spellId, targetPosition, spellInfo) {
    // Obter entidade do jogador
    const playerEntity = this.ecs.getEntityByTag(`player_${playerId}`);
    if (!playerEntity) return null;
    
    // Obter componente de posição do jogador
    const positionComponent = playerEntity.getComponent('PositionComponent');
    if (!positionComponent) return null;
    
    // Processar diferente dependendo da magia específica
    if (spellId === 'teleport') {
      // Verificar distância máxima de teleporte
      const playerPos = new Vector3(positionComponent.x, positionComponent.y, positionComponent.z);
      const targetPos = new Vector3(targetPosition.x, targetPosition.y, targetPosition.z);
      const distance = playerPos.distanceTo(targetPos);
      
      if (distance > spellInfo.maxDistance) {
        // Limitar à distância máxima na mesma direção
        const direction = targetPos.clone().sub(playerPos).normalize();
        targetPos.copy(playerPos).add(direction.multiplyScalar(spellInfo.maxDistance));
      }
      
      // Verificar colisão no destino
      const canTeleport = this.physicsSystem.checkPositionValid(targetPos.x, targetPos.y, targetPos.z);
      if (!canTeleport) {
        console.log(`Teleporte bloqueado por colisão: ${playerId}`);
        return null;
      }
      
      // Atualizar posição do jogador
      positionComponent.x = targetPos.x;
      positionComponent.y = targetPos.y;
      positionComponent.z = targetPos.z;
      
      // Notificar clientes sobre o teleporte
      this.networkSystem.broadcastToAll('player:teleport', {
        playerId,
        spellId,
        position: {
          x: targetPos.x,
          y: targetPos.y,
          z: targetPos.z
        }
      });
      
      return true;
    }
    
    return null;
  }
  
  /**
   * Cria uma magia de invocação
   * @param {string} playerId - ID do jogador que lançou a magia
   * @param {string} spellId - ID da magia
   * @param {Object} targetPosition - Posição alvo da invocação
   * @param {Object} spellInfo - Informações da magia
   */
  createSummonSpell(playerId, spellId, targetPosition, spellInfo) {
    // Criar entidade para a invocação
    const summonEntity = this.ecs.createEntity();
    const summonId = `summon_${this.nextSpellId++}`;
    summonEntity.addTag(summonId);
    summonEntity.addTag(`owned_by_${playerId}`);
    
    // Adicionar componente de posição
    const positionComponent = this.ecs.createComponent('PositionComponent', {
      x: targetPosition.x,
      y: targetPosition.y,
      z: targetPosition.z,
      rotationX: 0,
      rotationY: Math.random() * Math.PI * 2, // Rotação aleatória
      rotationZ: 0
    });
    summonEntity.addComponent(positionComponent);
    
    // Adicionar componente de saúde
    const healthComponent = this.ecs.createComponent('HealthComponent', {
      currentHealth: spellInfo.health,
      maxHealth: spellInfo.health,
      regeneration: 0
    });
    summonEntity.addComponent(healthComponent);
    
    // Adicionar componente de física
    const physicsComponent = this.ecs.createComponent('PhysicsComponent', {
      mass: 80,
      friction: 0.5,
      restitution: 0.2,
      linearDamping: 0.1,
      angularDamping: 0.1,
      collisionGroup: 'summon',
      collisionMask: ['player', 'world', 'projectile']
    });
    summonEntity.addComponent(physicsComponent);
    
    // Adicionar componente de colisão
    const collisionComponent = this.ecs.createComponent('CollisionComponent', {
      shape: 'capsule',
      radius: 0.5,
      height: 2.0,
      isTrigger: false
    });
    summonEntity.addComponent(collisionComponent);
    
    // Adicionar componente de IA (simplificado)
    const aiComponent = this.ecs.createComponent('AIComponent', {
      type: 'summon',
      ownerId: playerId,
      attackDamage: spellInfo.damage,
      attackRange: 2.0,
      sightRange: 15.0,
      patrolRadius: 5.0,
      aggression: 0.8,
      expirationTime: Date.now() + (spellInfo.duration * 1000)
    });
    summonEntity.addComponent(aiComponent);
    
    // Adicionar ao sistema de física
    this.physicsSystem.addRigidBody(summonEntity);
    
    // Notificar clientes sobre a invocação
    this.networkSystem.broadcastToAll('spell:summon', {
      summonId,
      playerId,
      spellId,
      position: {
        x: targetPosition.x,
        y: targetPosition.y,
        z: targetPosition.z
      },
      rotation: {
        y: positionComponent.rotationY
      },
      health: spellInfo.health,
      duration: spellInfo.duration
    });
    
    return summonEntity;
  }
  
  /**
   * Processa colisão de um projétil mágico
   * @param {Object} spellEntity - Entidade da magia
   * @param {Object} collision - Dados da colisão
   */
  handleSpellCollision(spellEntity, collision) {
    const spellComponent = spellEntity.getComponent(SpellComponent);
    if (!spellComponent) return;
    
    const { entityId: hitEntityId, point: hitPosition, normal: hitNormal } = collision;
    
    // Obter informações da magia
    const spellInfo = SPELLS[spellComponent.spellId.toUpperCase()];
    if (!spellInfo) return;
    
    let isPlayerHit = false;
    let hitPlayerId = null;
    
    // Verificar se atingiu um jogador
    if (hitEntityId) {
      const hitEntity = this.ecs.getEntity(hitEntityId);
      if (hitEntity) {
        // Extrair ID do jogador da tag
        const playerTag = Array.from(hitEntity.tags).find(tag => tag.startsWith('player_'));
        if (playerTag) {
          hitPlayerId = playerTag.replace('player_', '');
          isPlayerHit = true;
          
          // Não causar dano ao próprio lançador
          if (hitPlayerId !== spellComponent.casterId) {
            this.applySpellDamage(
              hitPlayerId,
              spellComponent.casterId,
              spellComponent.spellId,
              spellComponent.damage,
              spellInfo
            );
          }
        }
      }
    }
    
    // Notificar clientes sobre a colisão/remoção do projétil
    this.networkSystem.broadcastToAll('spell:remove', {
      spellEntityId: Array.from(spellEntity.tags)[0],
      hitPosition: hitPosition ? {
        x: hitPosition.x,
        y: hitPosition.y,
        z: hitPosition.z
      } : null,
      hitNormal: hitNormal ? {
        x: hitNormal.x,
        y: hitNormal.y,
        z: hitNormal.z
      } : null,
      hitEntityId: isPlayerHit ? hitPlayerId : null
    });
    
    // Remover a entidade da magia
    this.ecs.removeEntity(spellEntity.id);
    this.activeSpells.delete(Array.from(spellEntity.tags)[0]);
  }
  
  /**
   * Aplica dano de magia a um jogador
   * @param {string} targetId - ID do jogador alvo
   * @param {string} casterId - ID do jogador que lançou a magia
   * @param {string} spellId - ID da magia
   * @param {number} damage - Dano base da magia
   * @param {Object} spellInfo - Informações da magia
   */
  applySpellDamage(targetId, casterId, spellId, damage, spellInfo) {
    // Obter entidade do alvo
    const targetEntity = this.ecs.getEntityByTag(`player_${targetId}`);
    if (!targetEntity) return;
    
    // Obter componente de saúde
    const healthComponent = targetEntity.getComponent('HealthComponent');
    if (!healthComponent) return;
    
    // Calcular dano final
    let finalDamage = damage;
    
    // Verificar modificadores ativos no alvo
    const effectComponent = targetEntity.getComponent('EffectComponent');
    if (effectComponent) {
      // Aplicar modificadores de dano baseados em efeitos ativos
      finalDamage = this.applyDamageModifiers(finalDamage, spellInfo.element, effectComponent);
    }
    
    // Aplicar dano
    healthComponent.currentHealth -= finalDamage;
    
    // Verificar morte
    if (healthComponent.currentHealth <= 0) {
      // Emitir evento de morte
      this.eventSystem.emit('player:death', {
        playerId: targetId,
        killerId: casterId,
        damageType: 'spell',
        spellId
      });
    } else {
      // Aplicar efeitos adicionais da magia
      if (spellInfo.effects && spellInfo.effects.length > 0) {
        for (const effect of spellInfo.effects) {
          this.applyEffectToEntity(targetEntity.id, effect, spellId, casterId);
        }
      }
      
      // Notificar clientes sobre o dano
      this.networkSystem.broadcastToAll('player:damage', {
        playerId: targetId,
        attackerId: casterId,
        damage: finalDamage,
        currentHealth: healthComponent.currentHealth,
        maxHealth: healthComponent.maxHealth,
        damageType: 'spell',
        spellId
      });
    }
    
    return finalDamage;
  }
  
  /**
   * Aplica um efeito a uma entidade
   * @param {string} entityId - ID da entidade
   * @param {Object} effect - Dados do efeito
   * @param {string} spellId - ID da magia que causou o efeito
   * @param {string} sourceId - ID da entidade que causou o efeito
   * @param {number} duration - Duração do efeito em segundos (opcional)
   */
  applyEffectToEntity(entityId, effect, spellId, sourceId, duration) {
    // Obter entidade
    const entity = this.ecs.getEntity(entityId);
    if (!entity) return;
    
    // Obter ou criar componente de efeitos
    let effectComponent = entity.getComponent('EffectComponent');
    if (!effectComponent) {
      effectComponent = this.ecs.createComponent('EffectComponent', {
        activeEffects: []
      });
      entity.addComponent(effectComponent);
    }
    
    // Verificar se a entidade é imune ao efeito
    if (effectComponent.immunities && effectComponent.immunities.includes(effect.type)) {
      return false;
    }
    
    // Verificar se o efeito já está ativo
    const existingEffectIndex = effectComponent.activeEffects.findIndex(
      e => e.type === effect.type
    );
    
    // Usar a duração fornecida ou a do efeito
    const effectDuration = duration || effect.duration;
    
    // Dados do efeito
    const effectData = {
      id: `${effect.type}_${Date.now()}`,
      type: effect.type,
      sourceId,
      spellId,
      startTime: Date.now(),
      endTime: Date.now() + (effectDuration * 1000),
      duration: effectDuration,
      ...effect // Copiar parâmetros adicionais
    };
    
    // Se o efeito já existe
    if (existingEffectIndex >= 0) {
      const existingEffect = effectComponent.activeEffects[existingEffectIndex];
      
      // Verificar se o efeito é acumulável
      const effectInfo = SPELL_EFFECTS[effect.type.toUpperCase()];
      
      if (effectInfo && effectInfo.stackable) {
        // Se for acumulável, aumentar a força ou duração
        if (existingEffect.stacks < (effectInfo.maxStacks || 3)) {
          existingEffect.stacks = (existingEffect.stacks || 1) + 1;
          
          // Aumentar parâmetros baseados em stacks
          if (effect.damagePerTick) {
            existingEffect.damagePerTick = effect.damagePerTick * existingEffect.stacks;
          }
          
          if (effect.slowFactor) {
            existingEffect.slowFactor = Math.min(0.9, effect.slowFactor * existingEffect.stacks);
          }
          
          // Estender a duração
          existingEffect.endTime = Math.max(
            existingEffect.endTime,
            Date.now() + (effectDuration * 1000)
          );
        }
      } else {
        // Se não for acumulável, substituir o efeito anterior
        effectComponent.activeEffects[existingEffectIndex] = effectData;
      }
    } else {
      // Adicionar novo efeito
      effectData.stacks = 1;
      effectComponent.activeEffects.push(effectData);
    }
    
    // Aplicar efeitos imediatos
    this.applyEffectImmediateEffects(entity, effectData);
    
    // Notificar clientes sobre o efeito aplicado
    this.networkSystem.broadcastToAll('effect:applied', {
      entityId,
      effect: {
        type: effect.type,
        duration: effectDuration,
        sourceId,
        spellId,
        ...effect
      }
    });
    
    return true;
  }
  
  /**
   * Aplica efeitos imediatos de um efeito
   * @param {Object} entity - Entidade afetada
   * @param {Object} effect - Dados do efeito
   */
  applyEffectImmediateEffects(entity, effect) {
    // Aplicar modificadores imediatos baseados no tipo de efeito
    switch (effect.type) {
      case 'slow':
        // Modificar velocidade do jogador
        const velocityComponent = entity.getComponent('VelocityComponent');
        if (velocityComponent && effect.slowFactor) {
          // Salvar velocidade original se não existir
          if (velocityComponent.originalSpeed === undefined) {
            velocityComponent.originalSpeed = velocityComponent.speed;
          }
          velocityComponent.speed = velocityComponent.originalSpeed * (1 - effect.slowFactor);
        }
        break;
        
      case 'stun':
        // Marcar jogador como atordoado
        const playerComponent = entity.getComponent('PlayerComponent');
        if (playerComponent) {
          playerComponent.isStunned = true;
          playerComponent.stunEndTime = effect.endTime;
        }
        break;
        
      case 'armor_increase':
        // Aumentar armadura do jogador
        const combatComponent = entity.getComponent('CombatComponent');
        if (combatComponent && effect.amount) {
          // Salvar armadura original se não existir
          if (combatComponent.originalArmor === undefined) {
            combatComponent.originalArmor = combatComponent.armor;
          }
          combatComponent.armor = combatComponent.originalArmor + effect.amount;
        }
        break;
        
      // Outros tipos de efeitos...
    }
  }
  
  /**
   * Remove um efeito de uma entidade
   * @param {string} entityId - ID da entidade
   * @param {string} effectId - ID do efeito
   */
  removeEffectFromEntity(entityId, effectId) {
    // Obter entidade
    const entity = this.ecs.getEntity(entityId);
    if (!entity) return;
    
    // Obter componente de efeitos
    const effectComponent = entity.getComponent('EffectComponent');
    if (!effectComponent || !effectComponent.activeEffects) return;
    
    // Encontrar o efeito
    const effectIndex = effectComponent.activeEffects.findIndex(
      effect => effect.id === effectId
    );
    
    if (effectIndex >= 0) {
      const effect = effectComponent.activeEffects[effectIndex];
      
      // Remover efeitos imediatos
      this.removeEffectImmediateEffects(entity, effect);
      
      // Remover o efeito
      effectComponent.activeEffects.splice(effectIndex, 1);
      
      // Notificar clientes
      this.networkSystem.broadcastToAll('effect:removed', {
        entityId,
        effectType: effect.type
      });
    }
  }
  
  /**
   * Remove os efeitos imediatos de um efeito
   * @param {Object} entity - Entidade afetada
   * @param {Object} effect - Dados do efeito
   */
  removeEffectImmediateEffects(entity, effect) {
    // Remover modificadores baseados no tipo de efeito
    switch (effect.type) {
      case 'slow':
        // Restaurar velocidade original
        const velocityComponent = entity.getComponent('VelocityComponent');
        if (velocityComponent && velocityComponent.originalSpeed !== undefined) {
          velocityComponent.speed = velocityComponent.originalSpeed;
          delete velocityComponent.originalSpeed;
        }
        break;
        
      case 'stun':
        // Remover marca de atordoado
        const playerComponent = entity.getComponent('PlayerComponent');
        if (playerComponent) {
          playerComponent.isStunned = false;
          delete playerComponent.stunEndTime;
        }
        break;
        
      case 'armor_increase':
        // Restaurar armadura original
        const combatComponent = entity.getComponent('CombatComponent');
        if (combatComponent && combatComponent.originalArmor !== undefined) {
          combatComponent.armor = combatComponent.originalArmor;
          delete combatComponent.originalArmor;
        }
        break;
        
      // Outros tipos de efeitos...
    }
  }
  
  /**
   * Remove todos os efeitos de uma entidade
   * @param {string} entityId - ID da entidade
   */
  removeAllEffectsFromEntity(entityId) {
    // Obter entidade
    const entity = this.ecs.getEntity(entityId);
    if (!entity) return;
    
    // Obter componente de efeitos
    const effectComponent = entity.getComponent('EffectComponent');
    if (!effectComponent || !effectComponent.activeEffects) return;
    
    // Remover cada efeito
    for (const effect of effectComponent.activeEffects) {
      this.removeEffectImmediateEffects(entity, effect);
      
      // Notificar clientes
      this.networkSystem.broadcastToAll('effect:removed', {
        entityId,
        effectType: effect.type
      });
    }
    
    // Limpar array de efeitos
    effectComponent.activeEffects = [];
  }
  
  /**
   * Limpa todos os efeitos ativos
   */
  clearAllEffects() {
    // Obter todas as entidades com componente de efeito
    const entities = this.ecs.getEntitiesWithComponent('EffectComponent');
    
    // Remover todos os efeitos de cada entidade
    for (const entity of entities) {
      this.removeAllEffectsFromEntity(entity.id);
    }
  }
  
  /**
   * Aplica modificadores de dano com base em efeitos ativos
   * @param {number} damage - Dano base
   * @param {string} element - Elemento do dano
   * @param {Object} effectComponent - Componente de efeitos
   * @returns {number} Dano modificado
   */
  applyDamageModifiers(damage, element, effectComponent) {
    let modifiedDamage = damage;
    
    // Se não houver componente de efeitos, retornar dano original
    if (!effectComponent || !effectComponent.activeEffects) {
      return modifiedDamage;
    }
    
    // Aplicar modificadores de dano de cada efeito
    for (const effect of effectComponent.activeEffects) {
      switch (effect.type) {
        case 'damage_reduction':
          modifiedDamage *= (1 - (effect.factor || 0.5));
          break;
          
        case 'armor_increase':
          // Redução de dano baseada em armadura
          const reductionFactor = effect.amount / (effect.amount + 100);
          modifiedDamage *= (1 - reductionFactor);
          break;
          
        case 'vulnerability':
          // Aumenta dano recebido
          if (element === effect.element || !effect.element) {
            modifiedDamage *= (1 + (effect.factor || 0.5));
          }
          break;
          
        case 'resistance':
          // Reduz dano de elemento específico
          if (element === effect.element) {
            modifiedDamage *= (1 - (effect.factor || 0.5));
          }
          break;
      }
    }
    
    return Math.max(1, Math.round(modifiedDamage));
  }
  
  /**
   * Calcula o custo de mana modificado para uma magia
   * @param {Object} spellInfo - Informações da magia
   * @returns {number} Custo de mana modificado
   */
  calculateManaCost(spellInfo) {
    let manaCost = spellInfo.manaCost;
    
    // Aplicar modificador global
    manaCost *= SPELL_BALANCE.GLOBAL_MANA_COST_MULTIPLIER;
    
    // Aplicar modificador por tipo
    if (SPELL_BALANCE.TYPE_MODIFIERS[spellInfo.type]) {
      manaCost *= SPELL_BALANCE.TYPE_MODIFIERS[spellInfo.type].manaCostModifier;
    }
    
    // Aplicar modificador por elemento
    if (SPELL_BALANCE.ELEMENT_MODIFIERS[spellInfo.element]) {
      manaCost *= SPELL_BALANCE.ELEMENT_MODIFIERS[spellInfo.element].manaCostModifier;
    }
    
    return Math.max(1, Math.round(manaCost));
  }
  
  /**
   * Calcula o dano modificado para uma magia
   * @param {Object} spellInfo - Informações da magia
   * @returns {number} Dano modificado
   */
  calculateSpellDamage(spellInfo) {
    if (!spellInfo.damage) return 0;
    
    let damage = spellInfo.damage;
    
    // Aplicar modificador global
    damage *= SPELL_BALANCE.GLOBAL_DAMAGE_MULTIPLIER;
    
    // Aplicar modificador por tipo
    if (SPELL_BALANCE.TYPE_MODIFIERS[spellInfo.type]) {
      damage *= SPELL_BALANCE.TYPE_MODIFIERS[spellInfo.type].damageModifier;
    }
    
    // Aplicar modificador por elemento
    if (SPELL_BALANCE.ELEMENT_MODIFIERS[spellInfo.element]) {
      damage *= SPELL_BALANCE.ELEMENT_MODIFIERS[spellInfo.element].damageModifier;
    }
    
    return Math.max(1, Math.round(damage));
  }
  
  /**
   * Calcula o cooldown modificado para uma magia
   * @param {Object} spellInfo - Informações da magia
   * @returns {number} Cooldown modificado em ms
   */
  calculateCooldown(spellInfo) {
    let cooldown = spellInfo.cooldown;
    
    // Aplicar modificador global
    cooldown *= SPELL_BALANCE.GLOBAL_COOLDOWN_MULTIPLIER;
    
    // Aplicar modificador por tipo
    if (SPELL_BALANCE.TYPE_MODIFIERS[spellInfo.type]) {
      cooldown *= SPELL_BALANCE.TYPE_MODIFIERS[spellInfo.type].cooldownModifier;
    }
    
    // Aplicar modificador por elemento
    if (SPELL_BALANCE.ELEMENT_MODIFIERS[spellInfo.element]) {
      cooldown *= SPELL_BALANCE.ELEMENT_MODIFIERS[spellInfo.element].cooldownModifier;
    }
    
    return Math.round(cooldown * 1000); // Converter para ms
  }
  
  /**
   * Atualiza o sistema de magias
   * @param {number} deltaTime - Tempo desde o último frame em segundos
   */
  update(deltaTime) {
    this.processPendingSpells();
    this.updateActiveSpells(deltaTime);
    this.processActiveEffects(deltaTime);
  }
  
  /**
   * Processa magias pendentes após tempo de lançamento
   */
  processPendingSpells() {
    const currentTime = Date.now();
    const completedSpells = [];
    
    // Encontrar magias com tempo de lançamento concluído
    for (let i = 0; i < this.pendingSpells.length; i++) {
      const pendingSpell = this.pendingSpells[i];
      
      if (currentTime >= pendingSpell.castingEndTime) {
        // Lançar a magia
        this.castSpell(pendingSpell);
        completedSpells.push(i);
      }
    }
    
    // Remover magias concluídas (do maior índice para o menor)
    for (let i = completedSpells.length - 1; i >= 0; i--) {
      this.pendingSpells.splice(completedSpells[i], 1);
    }
  }
  
  /**
   * Atualiza magias ativas
   * @param {number} deltaTime - Tempo desde o último frame em segundos
   */
  updateActiveSpells(deltaTime) {
    const currentTime = Date.now();
    const expiredSpells = [];
    
    // Atualizar cada magia ativa
    for (const [spellEntityId, spellEntity] of this.activeSpells) {
      const spellComponent = spellEntity.getComponent(SpellComponent);
      if (!spellComponent) {
        // Componente inválido, remover
        expiredSpells.push(spellEntityId);
        continue;
      }
      
      // Verificar tempo de vida
      const elapsedTime = (currentTime - spellComponent.creationTime) / 1000;
      if (elapsedTime >= spellComponent.lifetime) {
        expiredSpells.push(spellEntityId);
        continue;
      }
      
      // Processar comportamento específico por tipo
      const spellInfo = SPELLS[spellComponent.spellId.toUpperCase()];
      if (spellInfo) {
        switch (spellInfo.type) {
          case SPELL_TYPES.AREA:
            // Processar dano em área periódico
            this.processAreaEffect(spellEntity, spellComponent, deltaTime);
            break;
          
          case SPELL_TYPES.PROJECTILE:
            // Verificar colisões
            const collision = this.physicsSystem.checkEntityCollision(spellEntity.id);
            if (collision) {
              this.handleSpellCollision(spellEntity, collision);
              // Já removido pelo handler de colisão
              continue;
            }
            break;
        }
      }
    }
    
    // Remover magias expiradas
    for (const spellEntityId of expiredSpells) {
      const spellEntity = this.activeSpells.get(spellEntityId);
      if (spellEntity) {
        // Notificar clientes
        this.networkSystem.broadcastToAll('spell:remove', {
          spellEntityId
        });
        
        // Remover do ECS
        this.ecs.removeEntity(spellEntity.id);
        this.activeSpells.delete(spellEntityId);
      }
    }
  }
  
  /**
   * Processa efeito de área de uma magia
   * @param {Object} spellEntity - Entidade da magia
   * @param {Object} spellComponent - Componente da magia
   * @param {number} deltaTime - Tempo desde o último frame em segundos
   */
  processAreaEffect(spellEntity, spellComponent, deltaTime) {
    const spellInfo = SPELLS[spellComponent.spellId.toUpperCase()];
    if (!spellInfo) return;
    
    // Calcular intervalo entre danos (padrão: 1 segundo)
    const damageInterval = spellInfo.damageInterval || 1.0;
    
    // Verificar se é hora de causar dano
    const elapsedTime = (Date.now() - spellComponent.creationTime) / 1000;
    const lastDamageTick = Math.floor((elapsedTime - deltaTime) / damageInterval);
    const currentDamageTick = Math.floor(elapsedTime / damageInterval);
    
    // Se estivermos em um novo tick de dano
    if (currentDamageTick > lastDamageTick) {
      // Obter posição da magia de área
      const positionComponent = spellEntity.getComponent('PositionComponent');
      if (!positionComponent) return;
      
      // Encontrar jogadores dentro da área de efeito
      const position = new Vector3(positionComponent.x, positionComponent.y, positionComponent.z);
      const playersInRange = this.findPlayersInRange(position, spellComponent.radius);
      
      // Aplicar dano e efeitos a cada jogador na área
      for (const playerId of playersInRange) {
        // Não aplicar a quem lançou a magia
        if (playerId === spellComponent.casterId) continue;
        
        // Aplicar dano
        if (spellComponent.damage > 0) {
          this.applySpellDamage(
            playerId,
            spellComponent.casterId,
            spellComponent.spellId,
            spellComponent.damage * damageInterval, // Dano proporcional ao intervalo
            spellInfo
          );
        }
        
        // Aplicar efeitos
        if (spellInfo.effects && spellInfo.effects.length > 0) {
          const targetEntity = this.ecs.getEntityByTag(`player_${playerId}`);
          if (targetEntity) {
            for (const effect of spellInfo.effects) {
              this.applyEffectToEntity(
                targetEntity.id,
                effect,
                spellComponent.spellId,
                spellComponent.casterId
              );
            }
          }
        }
      }
    }
  }
  
  /**
   * Encontra jogadores dentro de um raio específico
   * @param {Vector3} position - Posição central
   * @param {number} radius - Raio de busca
   * @returns {Array<string>} Array com IDs dos jogadores dentro do raio
   */
  findPlayersInRange(position, radius) {
    const playersInRange = [];
    const playerEntities = this.ecs.getEntitiesWithTag(/^player_/);
    
    for (const entity of playerEntities) {
      const positionComponent = entity.getComponent('PositionComponent');
      if (!positionComponent) continue;
      
      const playerPosition = new Vector3(
        positionComponent.x,
        positionComponent.y,
        positionComponent.z
      );
      
      const distance = position.distanceTo(playerPosition);
      if (distance <= radius) {
        // Extrair ID do jogador da tag
        const playerTag = Array.from(entity.tags).find(tag => tag.startsWith('player_'));
        if (playerTag) {
          const playerId = playerTag.replace('player_', '');
          playersInRange.push(playerId);
        }
      }
    }
    
    return playersInRange;
  }
  
  /**
   * Processa efeitos ativos em entidades
   * @param {number} deltaTime - Tempo desde o último frame em segundos
   */
  processActiveEffects(deltaTime) {
    const currentTime = Date.now();
    const entities = this.ecs.getEntitiesWithComponent('EffectComponent');
    
    for (const entity of entities) {
      const effectComponent = entity.getComponent('EffectComponent');
      if (!effectComponent || !effectComponent.activeEffects) continue;
      
      const expiredEffects = [];
      
      // Processar cada efeito ativo
      for (let i = 0; i < effectComponent.activeEffects.length; i++) {
        const effect = effectComponent.activeEffects[i];
        
        // Verificar se o efeito expirou
        if (currentTime >= effect.endTime) {
          expiredEffects.push(effect.id);
          continue;
        }
        
        // Processar efeitos periódicos
        if (effect.tickRate && effect.damagePerTick) {
          const elapsedTime = (currentTime - effect.startTime) / 1000;
          const lastTick = Math.floor((elapsedTime - deltaTime) * effect.tickRate);
          const currentTick = Math.floor(elapsedTime * effect.tickRate);
          
          // Se estivermos em um novo tick
          if (currentTick > lastTick) {
            // Extrair ID do jogador da tag
            const playerTag = Array.from(entity.tags).find(tag => tag.startsWith('player_'));
            if (playerTag) {
              const playerId = playerTag.replace('player_', '');
              
              // Aplicar dano ao longo do tempo
              const healthComponent = entity.getComponent('HealthComponent');
              if (healthComponent) {
                // Aplicar dano
                healthComponent.currentHealth -= effect.damagePerTick;
                
                // Notificar clientes sobre o dano
                this.networkSystem.broadcastToAll('player:damage', {
                  playerId,
                  attackerId: effect.sourceId,
                  damage: effect.damagePerTick,
                  currentHealth: healthComponent.currentHealth,
                  maxHealth: healthComponent.maxHealth,
                  damageType: 'effect',
                  effectType: effect.type
                });
                
                // Verificar morte
                if (healthComponent.currentHealth <= 0) {
                  this.eventSystem.emit('player:death', {
                    playerId,
                    killerId: effect.sourceId,
                    damageType: 'effect',
                    effectType: effect.type
                  });
                  
                  // Não processar mais esse efeito, o jogador já está morto
                  break;
                }
              }
            }
          }
        }
        
        // Processar outros tipos de efeitos periódicos
        if (effect.type === 'mana_drain' && effect.amountPerTick && effect.tickRate) {
          const elapsedTime = (currentTime - effect.startTime) / 1000;
          const lastTick = Math.floor((elapsedTime - deltaTime) * effect.tickRate);
          const currentTick = Math.floor(elapsedTime * effect.tickRate);
          
          // Se estivermos em um novo tick
          if (currentTick > lastTick) {
            const manaComponent = entity.getComponent('ManaComponent');
            if (manaComponent) {
              // Drenar mana
              const drainAmount = Math.min(effect.amountPerTick, manaComponent.currentMana);
              manaComponent.currentMana -= drainAmount;
              
              // Extrair ID do jogador da tag
              const playerTag = Array.from(entity.tags).find(tag => tag.startsWith('player_'));
              if (playerTag) {
                const playerId = playerTag.replace('player_', '');
                
                // Notificar clientes sobre a mudança de mana
                this.networkSystem.broadcastToAll('player:manaChanged', {
                  playerId,
                  currentMana: manaComponent.currentMana,
                  maxMana: manaComponent.maxMana,
                  drainedBy: effect.sourceId
                });
              }
            }
          }
        }
      }
      
      // Remover efeitos expirados
      for (const effectId of expiredEffects) {
        this.removeEffectFromEntity(entity.id, effectId);
      }
    }
  }
  
  /**
   * Adiciona uma entidade ao sistema
   * @param {Object} entity - Entidade a ser adicionada
   */
  addEntity(entity) {
    // Verificar se é uma entidade de magia
    if (entity.hasComponent(SpellComponent)) {
      // Adicionar às magias ativas se tiver uma tag de magia
      const spellTag = Array.from(entity.tags).find(tag => tag.startsWith('spell_'));
      if (spellTag) {
        this.activeSpells.set(spellTag, entity);
      }
    }
  }
  
  /**
   * Remove uma entidade do sistema
   * @param {string} entityId - ID da entidade a ser removida
   */
  removeEntity(entityId) {
    // Remover das magias ativas
    for (const [spellEntityId, spellEntity] of this.activeSpells) {
      if (spellEntity.id === entityId) {
        this.activeSpells.delete(spellEntityId);
        break;
      }
    }
    
    // Remover quaisquer efeitos que a entidade estava causando
    this.clearEffectsBySource(entityId);
  }
  
  /**
   * Remove todos os efeitos causados por uma entidade específica
   * @param {string} sourceId - ID da entidade fonte
   */
  clearEffectsBySource(sourceId) {
    const entities = this.ecs.getEntitiesWithComponent('EffectComponent');
    
    for (const entity of entities) {
      const effectComponent = entity.getComponent('EffectComponent');
      if (!effectComponent || !effectComponent.activeEffects) continue;
      
      const effectsToRemove = effectComponent.activeEffects
        .filter(effect => effect.sourceId === sourceId)
        .map(effect => effect.id);
      
      for (const effectId of effectsToRemove) {
        this.removeEffectFromEntity(entity.id, effectId);
      }
    }
  }
  
  /**
   * Libera recursos do sistema
   */
  dispose() {
    // Remover todas as entidades de magia
    for (const [spellEntityId, spellEntity] of this.activeSpells) {
      this.ecs.removeEntity(spellEntity.id);
    }
    this.activeSpells.clear();
    
    // Limpar todos os efeitos
    this.clearAllEffects();
    
    // Limpar magias pendentes
    this.pendingSpells = [];
    
    // Remover listeners de eventos
    this.eventSystem.unsubscribeAll('player:castSpell');
    this.eventSystem.unsubscribeAll('player:death');
    this.eventSystem.unsubscribeAll('player:respawn');
    this.eventSystem.unsubscribeAll('match:end');
  }
}