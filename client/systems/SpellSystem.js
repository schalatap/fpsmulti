/**
 * Sistema de Magias para o cliente
 */

import { SPELLS, SPELL_TYPES, SPELL_VISUALS } from '../../shared/constants/SpellConstants.js';
import { SpellComponent, SpellCasterComponent, ManaComponent } from '../../shared/components/SpellComponent.js';
import { Vector3 } from 'three';

export class SpellSystem {
  /**
   * Cria um novo sistema de magias
   * @param {Object} ecs - Referência ao sistema ECS
   * @param {Object} eventSystem - Sistema de eventos para comunicação
   * @param {Object} renderSystem - Sistema de renderização para visualizações
   * @param {Object} networkSystem - Sistema de rede para comunicação com servidor
   */
  constructor(ecs, eventSystem, renderSystem, networkSystem) {
    this.ecs = ecs;
    this.eventSystem = eventSystem;
    this.renderSystem = renderSystem;
    this.networkSystem = networkSystem;
    
    this.activeSpells = new Map(); // Magias ativas no mundo
    this.localPlayerId = null; // ID do jogador local
    
    this.setupEventListeners();
  }
  
  /**
   * Inicializa o sistema de magias
   * @param {string} localPlayerId - ID do jogador local
   */
  initialize(localPlayerId) {
    console.log('Inicializando SpellSystem para o cliente');
    this.localPlayerId = localPlayerId;
  }
  
  /**
   * Configura ouvintes de eventos
   */
  setupEventListeners() {
    // Escuta eventos de entrada do jogador
    this.eventSystem.subscribe('input:cast', this.handleCastInput.bind(this));
    
    // Escuta eventos de rede
    this.eventSystem.subscribe('spell:cast', this.handleRemoteSpellCast.bind(this));
    this.eventSystem.subscribe('spell:effect', this.handleSpellEffect.bind(this));
    this.eventSystem.subscribe('spell:remove', this.handleSpellRemove.bind(this));
    
    // Escuta eventos locais do jogo
    this.eventSystem.subscribe('player:death', this.handlePlayerDeath.bind(this));
  }
  
  /**
   * Processa entrada para lançamento de magia
   * @param {Object} data - Dados da entrada
   */
  handleCastInput(data) {
    const { spellId, targetId, targetPosition } = data;
    
    if (!this.localPlayerId) return;
    
    const casterEntity = this.ecs.getEntityByTag(`player_${this.localPlayerId}`);
    if (!casterEntity) return;
    
    const casterComponent = casterEntity.getComponent(SpellCasterComponent);
    if (!casterComponent) return;
    
    const manaComponent = casterEntity.getComponent(ManaComponent);
    if (!manaComponent) return;
    
    const positionComponent = casterEntity.getComponent('PositionComponent');
    if (!positionComponent) return;
    
    // Verificar se o jogador conhece a magia
    if (!casterComponent.knowsSpell(spellId)) {
      console.warn(`Jogador não conhece a magia: ${spellId}`);
      return;
    }
    
    // Verificar cooldown
    if (casterComponent.isOnCooldown(spellId)) {
      const remainingCooldown = casterComponent.getCooldownRemaining(spellId) / 1000;
      console.log(`Magia em cooldown: ${remainingCooldown.toFixed(1)}s restantes`);
      // Feedback visual de cooldown
      this.renderSystem.showCooldownFeedback(spellId, remainingCooldown);
      return;
    }
    
    // Obter informações da magia
    const spellInfo = SPELLS[spellId.toUpperCase()];
    if (!spellInfo) {
      console.error(`Magia não encontrada: ${spellId}`);
      return;
    }
    
    // Verificar mana
    if (!manaComponent.hasSufficientMana(spellInfo.manaCost)) {
      console.log(`Mana insuficiente para lançar ${spellInfo.name}`);
      // Feedback visual de mana insuficiente
      this.renderSystem.showInsufficientManaFeedback();
      return;
    }
    
    // Verificar se já está lançando uma magia
    if (casterComponent.isCasting()) {
      console.log(`Já está lançando uma magia`);
      return;
    }
    
    // Iniciar o lançamento
    const currentTime = Date.now();
    const castingEndTime = currentTime + (spellInfo.castTime * 1000);
    
    // Atualizar componente de lançamento
    casterComponent.castingSpell = spellId;
    casterComponent.castingStartTime = currentTime;
    casterComponent.castingEndTime = castingEndTime;
    casterComponent.castingProgress = 0;
    casterComponent.castingTarget = targetId;
    casterComponent.castingPosition = targetPosition;
    
    // Iniciar animação de lançamento
    this.renderSystem.startCastingAnimation(this.localPlayerId, spellId, spellInfo.castTime);
    
    // Enviar evento para a rede
    this.networkSystem.sendToServer('player:castSpell', {
      playerId: this.localPlayerId,
      spellId,
      targetId,
      targetPosition,
      castingStartTime: currentTime,
      position: {
        x: positionComponent.x,
        y: positionComponent.y,
        z: positionComponent.z
      },
      rotation: {
        x: positionComponent.rotationX,
        y: positionComponent.rotationY,
        z: positionComponent.rotationZ
      }
    });
  }
  
  /**
   * Processa o lançamento de magia de um jogador remoto
   * @param {Object} data - Dados do lançamento
   */
  handleRemoteSpellCast(data) {
    const { playerId, spellId, targetId, targetPosition, position, rotation } = data;
    
    // Não processar se for o jogador local
    if (playerId === this.localPlayerId) return;
    
    // Obter entidade do jogador
    const casterEntity = this.ecs.getEntityByTag(`player_${playerId}`);
    if (!casterEntity) return;
    
    // Obter informações da magia
    const spellInfo = SPELLS[spellId.toUpperCase()];
    if (!spellInfo) return;
    
    // Iniciar animação de lançamento para o jogador remoto
    this.renderSystem.startCastingAnimation(playerId, spellId, spellInfo.castTime);
    
    // Adicionar efeitos visuais de preparação
    const casterPosition = new Vector3(position.x, position.y, position.z);
    this.renderSystem.createPreCastEffect(spellId, casterPosition, spellInfo.element);
  }
  
  /**
   * Processa o efeito de uma magia (criação da magia no mundo)
   * @param {Object} data - Dados do efeito
   */
  handleSpellEffect(data) {
    const { spellId, spellEntityId, casterId, targetId, targetPosition, origin, direction } = data;
    
    // Obter informações da magia
    const spellInfo = SPELLS[spellId.toUpperCase()];
    if (!spellInfo) return;
    
    // Criar entidade para a magia
    const spellEntity = this.ecs.createEntity();
    spellEntity.addTag(`spell_${spellEntityId}`);
    
    // Adicionar componente de posição
    const positionComponent = this.ecs.createComponent('PositionComponent', {
      x: origin.x,
      y: origin.y,
      z: origin.z,
      rotationX: direction ? Math.atan2(direction.y, Math.sqrt(direction.x * direction.x + direction.z * direction.z)) : 0,
      rotationY: direction ? Math.atan2(direction.x, direction.z) : 0,
      rotationZ: 0
    });
    spellEntity.addComponent(positionComponent);
    
    // Adicionar componente de magia
    const spellComponent = new SpellComponent({
      spellId,
      casterId,
      targetId,
      targetPosition,
      element: spellInfo.element,
      damage: spellInfo.damage,
      radius: spellInfo.radius,
      duration: spellInfo.duration,
      lifetime: spellInfo.lifetime,
      speed: spellInfo.speed,
      creationTime: Date.now(),
      effects: spellInfo.effects
    });
    spellEntity.addComponent(spellComponent);
    
    // Adicionar componente de renderização específico para a magia
    const renderComponent = this.ecs.createComponent('RenderComponent', {
      modelType: 'spell',
      visible: true,
      spellVisuals: SPELL_VISUALS[spellId.toUpperCase()]
    });
    spellEntity.addComponent(renderComponent);
    
    // Para magias do tipo projétil, adicionar componente de velocidade
    if (spellInfo.type === SPELL_TYPES.PROJECTILE && direction) {
      const velocityComponent = this.ecs.createComponent('VelocityComponent', {
        x: direction.x * spellInfo.speed,
        y: direction.y * spellInfo.speed,
        z: direction.z * spellInfo.speed,
        speed: spellInfo.speed
      });
      spellEntity.addComponent(velocityComponent);
    }
    
    // Adicionar à lista de magias ativas
    this.activeSpells.set(spellEntityId, spellEntity);
    
    // Renderizar o efeito visual da magia
    this.renderSystem.createSpellEffect(spellId, origin, direction, targetPosition, spellInfo);
    
    // Reproduzir som da magia
    this.renderSystem.playSpellSound(spellId, origin);
  }
  
  /**
   * Processa a remoção de uma magia do mundo
   * @param {Object} data - Dados da remoção
   */
  handleSpellRemove(data) {
    const { spellEntityId, hitPosition, hitNormal, hitEntityId } = data;
    
    // Obter entidade da magia
    const spellEntity = this.activeSpells.get(spellEntityId);
    if (!spellEntity) return;
    
    // Obter componente de magia
    const spellComponent = spellEntity.getComponent(SpellComponent);
    if (!spellComponent) return;
    
    // Obter informações da magia
    const spellInfo = SPELLS[spellComponent.spellId.toUpperCase()];
    if (!spellInfo) return;
    
    // Criar efeito de impacto
    if (hitPosition && hitNormal) {
      this.renderSystem.createSpellImpactEffect(
        spellComponent.spellId,
        hitPosition,
        hitNormal,
        spellInfo.element,
        hitEntityId ? true : false
      );
      
      // Reproduzir som de impacto
      this.renderSystem.playSpellImpactSound(spellComponent.spellId, hitPosition, hitEntityId);
    }
    
    // Remover entidade da magia
    this.ecs.removeEntity(spellEntity.id);
    this.activeSpells.delete(spellEntityId);
  }
  
  /**
   * Processa a morte de um jogador
   * @param {Object} data - Dados da morte
   */
  handlePlayerDeath(data) {
    const { playerId } = data;
    
    // Se for o jogador local, cancelar qualquer lançamento em andamento
    if (playerId === this.localPlayerId) {
      const playerEntity = this.ecs.getEntityByTag(`player_${playerId}`);
      if (!playerEntity) return;
      
      const casterComponent = playerEntity.getComponent(SpellCasterComponent);
      if (casterComponent && casterComponent.isCasting()) {
        casterComponent.castingSpell = null;
        casterComponent.castingStartTime = 0;
        casterComponent.castingEndTime = 0;
        
        // Interromper animação de lançamento
        this.renderSystem.stopCastingAnimation(playerId);
      }
    }
  }
  
  /**
   * Atualiza o sistema de magias
   * @param {number} deltaTime - Tempo desde o último frame em segundos
   */
  update(deltaTime) {
    this.updateCasting(deltaTime);
    this.updateSpellVisuals(deltaTime);
    this.updateManaRegeneration(deltaTime);
  }
  
  /**
   * Atualiza o processo de lançamento de magias
   * @param {number} deltaTime - Tempo desde o último frame em segundos
   */
  updateCasting(deltaTime) {
    // Se não houver jogador local, retornar
    if (!this.localPlayerId) return;
    
    const playerEntity = this.ecs.getEntityByTag(`player_${this.localPlayerId}`);
    if (!playerEntity) return;
    
    const casterComponent = playerEntity.getComponent(SpellCasterComponent);
    if (!casterComponent) return;
    
    // Se estiver lançando uma magia
    if (casterComponent.isCasting()) {
      const currentTime = Date.now();
      const elapsedTime = currentTime - casterComponent.castingStartTime;
      const totalCastTime = casterComponent.castingEndTime - casterComponent.castingStartTime;
      
      // Atualizar progresso
      casterComponent.castingProgress = Math.min(elapsedTime / totalCastTime, 1);
      
      // Atualizar visualização do lançamento
      this.renderSystem.updateCastingAnimation(
        this.localPlayerId,
        casterComponent.castingSpell,
        casterComponent.castingProgress
      );
      
      // Se o lançamento foi concluído
      if (currentTime >= casterComponent.castingEndTime) {
        // Obter informações da magia
        const spellInfo = SPELLS[casterComponent.castingSpell.toUpperCase()];
        if (!spellInfo) return;
        
        // Tentar usar mana
        const manaComponent = playerEntity.getComponent(ManaComponent);
        if (!manaComponent || !manaComponent.useMana(spellInfo.manaCost)) {
          // Falha na hora de usar mana (raro, mas pode acontecer se perder mana durante o cast)
          console.log(`Mana insuficiente para concluir o lançamento`);
          this.renderSystem.showInsufficientManaFeedback();
          
          // Resetar estado de lançamento
          casterComponent.castingSpell = null;
          casterComponent.castingStartTime = 0;
          casterComponent.castingEndTime = 0;
          casterComponent.castingProgress = 0;
          
          // Parar animação
          this.renderSystem.stopCastingAnimation(this.localPlayerId);
          return;
        }
        
        // Aplicar cooldown
        casterComponent.cooldowns[casterComponent.castingSpell] = currentTime + (spellInfo.cooldown * 1000);
        
        // Finalizar animação
        this.renderSystem.finishCastingAnimation(this.localPlayerId, casterComponent.castingSpell);
        
        // Resetar estado de lançamento
        casterComponent.castingSpell = null;
        casterComponent.castingStartTime = 0;
        casterComponent.castingEndTime = 0;
        casterComponent.castingProgress = 0;
        
        // A criação real da magia no mundo é feita pelo servidor e enviada via eventos de rede
      }
    }
  }
  
  /**
   * Atualiza os visuais das magias ativas
   * @param {number} deltaTime - Tempo desde o último frame em segundos
   */
  updateSpellVisuals(deltaTime) {
    for (const [spellId, spellEntity] of this.activeSpells) {
      const spellComponent = spellEntity.getComponent(SpellComponent);
      if (!spellComponent) continue;
      
      const positionComponent = spellEntity.getComponent('PositionComponent');
      if (!positionComponent) continue;
      
      const renderComponent = spellEntity.getComponent('RenderComponent');
      if (!renderComponent) continue;
      
      // Verificar tempo de vida
      const elapsedTime = (Date.now() - spellComponent.creationTime) / 1000;
      if (elapsedTime >= spellComponent.lifetime) {
        // Magia expirou, remover (normalmente o servidor deve fazer isso)
        console.log(`Magia expirou localmente: ${spellId}`);
        this.ecs.removeEntity(spellEntity.id);
        this.activeSpells.delete(spellId);
        continue;
      }
      
      // Atualizar visualização da magia
      this.renderSystem.updateSpellEffect(
        spellId,
        positionComponent,
        elapsedTime,
        spellComponent
      );
    }
  }
  
  /**
   * Atualiza a regeneração de mana para o jogador local
   * @param {number} deltaTime - Tempo desde o último frame em segundos
   */
  updateManaRegeneration(deltaTime) {
    // Se não houver jogador local, retornar
    if (!this.localPlayerId) return;
    
    const playerEntity = this.ecs.getEntityByTag(`player_${this.localPlayerId}`);
    if (!playerEntity) return;
    
    const manaComponent = playerEntity.getComponent(ManaComponent);
    if (!manaComponent) return;
    
    // Verificar se deve regenerar mana
    const currentTime = Date.now();
    if (currentTime - manaComponent.lastUsageTime < manaComponent.regenDelay) {
      return;
    }
    
    // Regenerar mana
    const regenAmount = manaComponent.regeneration * deltaTime;
    if (manaComponent.currentMana < manaComponent.maxMana) {
      manaComponent.currentMana = Math.min(
        manaComponent.currentMana + regenAmount,
        manaComponent.maxMana
      );
      
      // Atualizar UI
      this.eventSystem.emit('player:manaChanged', {
        playerId: this.localPlayerId,
        currentMana: manaComponent.currentMana,
        maxMana: manaComponent.maxMana
      });
    }
  }
  
  /**
   * Adiciona uma entidade ao sistema
   * @param {Object} entity - Entidade a ser adicionada
   */
  addEntity(entity) {
    // Não é necessário fazer nada especial aqui, as entidades são acessadas pelo ID conforme necessário
  }
  
  /**
   * Remove uma entidade do sistema
   * @param {string} entityId - ID da entidade a ser removida
   */
  removeEntity(entityId) {
    // Limpar magias ativas se necessário
    for (const [spellId, spellEntity] of this.activeSpells) {
      if (spellEntity.id === entityId) {
        this.activeSpells.delete(spellId);
        break;
      }
    }
  }
  
  /**
   * Libera recursos do sistema
   */
  dispose() {
    // Remover todas as entidades de magia
    for (const [spellId, spellEntity] of this.activeSpells) {
      this.ecs.removeEntity(spellEntity.id);
    }
    this.activeSpells.clear();
    
    // Remover listeners de eventos
    this.eventSystem.unsubscribeAll('input:cast');
    this.eventSystem.unsubscribeAll('spell:cast');
    this.eventSystem.unsubscribeAll('spell:effect');
    this.eventSystem.unsubscribeAll('spell:remove');
    this.eventSystem.unsubscribeAll('player:death');
  }
}