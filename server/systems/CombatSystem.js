const { EventSystem } = require('../../shared/utils/EventSystem');
const HealthComponent = require('../../shared/components/HealthComponent');
const PlayerComponent = require('../../shared/components/PlayerComponent');
const EffectComponent = require('../../shared/components/EffectComponent');
const { DAMAGE_TYPES, BODY_PARTS, EFFECT_TYPES } = require('../../shared/constants/CombatConstants');

class CombatSystem {
    constructor(ecs, gameSystem, networkSystem) {
        this.ecs = ecs;
        this.gameSystem = gameSystem;
        this.networkSystem = networkSystem;
        this.eventSystem = EventSystem.getInstance();
        
        // Cache para otimizar consultas do sistema
        this.healthEntities = new Map();
        this.damageLogs = new Map();
        this.deathQueue = [];
        
        // Timer para processar efeitos periódicos (dano ao longo do tempo, etc.)
        this.effectTimer = null;
        this.effectInterval = 250; // ms
        
        this.setupEventListeners();
    }
    
    initialize() {
        console.log('CombatSystem initialized');
        this.startEffectTimer();
    }
    
    setupEventListeners() {
        // Escuta eventos de hits de projéteis
        this.eventSystem.subscribe('projectile:hit', this.handleProjectileHit.bind(this));
        
        // Escuta eventos de aplicação de magias
        this.eventSystem.subscribe('spell:effect', this.handleSpellEffect.bind(this));
        
        // Escuta eventos de dano de área
        this.eventSystem.subscribe('aoe:damage', this.handleAreaDamage.bind(this));
    }
    
    startEffectTimer() {
        this.effectTimer = setInterval(() => {
            this.processActiveEffects();
        }, this.effectInterval);
    }
    
    stopEffectTimer() {
        if (this.effectTimer) {
            clearInterval(this.effectTimer);
            this.effectTimer = null;
        }
    }
    
    registerEntity(entity) {
        const healthComponent = this.ecs.getComponent(entity.id, 'HealthComponent');
        if (healthComponent) {
            this.healthEntities.set(entity.id, entity);
        }
    }
    
    unregisterEntity(entityId) {
        this.healthEntities.delete(entityId);
        this.damageLogs.delete(entityId);
    }
    
    handleProjectileHit(data) {
        // Extrai dados do projétil
        const { projectileId, targetId, position, normal, weaponType, shooterId } = data;
        
        if (!targetId) return; // Hit em superfície, não em entidade
        
        // Calcula qual parte do corpo foi atingida
        const hitPart = this.calculateHitPart(position, targetId);
        
        // Obtém informações da arma
        const weaponInfo = this.getWeaponInfo(weaponType);
        
        // Calcula o dano baseado na arma, distância, e parte do corpo
        const damageInfo = this.calculateDamage({
            weaponType,
            hitPart,
            distance: this.calculateDistance(data.origin, position),
            weaponInfo
        });
        
        // Aplica o dano
        this.applyDamage(targetId, damageInfo, shooterId);
    }
    
    handleSpellEffect(data) {
        const { spellId, targetIds, caster, spellInfo } = data;
        
        // Para cada alvo afetado
        targetIds.forEach(targetId => {
            // Calcula o dano da magia (se houver)
            if (spellInfo.damage > 0) {
                const damageInfo = {
                    amount: spellInfo.damage,
                    type: spellInfo.damageType || DAMAGE_TYPES.MAGICAL,
                    critical: false,
                    source: 'spell',
                    spellId
                };
                
                this.applyDamage(targetId, damageInfo, caster);
            }
            
            // Aplica efeitos da magia (se houver)
            if (spellInfo.effects && spellInfo.effects.length > 0) {
                spellInfo.effects.forEach(effect => {
                    this.applyEffect(targetId, effect, caster);
                });
            }
        });
    }
    
    handleAreaDamage(data) {
        const { origin, radius, damage, damageType, falloff, sourceId, sourceType } = data;
        
        // Encontra todas as entidades com saúde na área
        this.healthEntities.forEach((entity, entityId) => {
            // Ignora a fonte do dano de área
            if (entityId === sourceId) return;
            
            // Obtém a posição da entidade
            const position = this.ecs.getComponent(entityId, 'PositionComponent');
            if (!position) return;
            
            // Calcula a distância entre a entidade e a origem do efeito
            const distance = this.calculateDistance(
                { x: position.x, y: position.y, z: position.z },
                origin
            );
            
            // Verifica se a entidade está dentro do raio
            if (distance <= radius) {
                // Calcula atenuação de dano baseado na distância (opcional)
                let finalDamage = damage;
                if (falloff) {
                    const distanceFactor = 1 - (distance / radius);
                    finalDamage = damage * distanceFactor;
                }
                
                // Aplica o dano
                const damageInfo = {
                    amount: finalDamage,
                    type: damageType || DAMAGE_TYPES.EXPLOSIVE,
                    critical: false,
                    source: sourceType,
                    areaEffect: true
                };
                
                this.applyDamage(entityId, damageInfo, sourceId);
            }
        });
    }
    
    applyDamage(targetId, damageInfo, attackerId) {
        // Obtém o componente de saúde do alvo
        const healthComponent = this.ecs.getComponent(targetId, 'HealthComponent');
        if (!healthComponent) return;
        
        // Obtém o componente de efeitos do alvo (se existir)
        const effectComponent = this.ecs.getComponent(targetId, 'EffectComponent');
        
        // Verifica se o alvo está imune ao dano (invulnerabilidade temporária, etc.)
        if (effectComponent && this.isImmuneToDamage(effectComponent, damageInfo.type)) {
            return;
        }
        
        // Obtém o componente do jogador para informações adicionais
        const playerComponent = this.ecs.getComponent(targetId, 'PlayerComponent');
        
        // Aplica modificadores de dano baseados em efeitos ativos
        const finalDamage = this.applyDamageModifiers(damageInfo.amount, damageInfo.type, effectComponent);
        
        // Aplica o dano ao componente de saúde
        healthComponent.currentHealth -= finalDamage;
        healthComponent.lastDamageTime = Date.now();
        
        // Registra o dano para estatísticas e killcam
        this.logDamage(targetId, attackerId, finalDamage, damageInfo);
        
        // Emite evento de dano para atualizar UI e outros sistemas
        this.eventSystem.emit('player:damage', {
            playerId: targetId,
            damage: finalDamage,
            attackerId,
            damageType: damageInfo.type,
            isCritical: damageInfo.critical,
            hitPart: damageInfo.hitPart
        });
        
        // Envia o evento de dano pela rede para os clientes
        this.networkSystem.broadcastToRoom(
            playerComponent?.team || 'global',
            'player:damage',
            {
                playerId: targetId,
                attackerId,
                damage: finalDamage,
                position: damageInfo.position || null,
                isCritical: damageInfo.critical || false
            }
        );
        
        // Verifica se o jogador morreu
        if (healthComponent.currentHealth <= 0) {
            this.handlePlayerDeath(targetId, attackerId, damageInfo);
        }
    }
    
    handlePlayerDeath(targetId, killerId, damageInfo) {
        // Adiciona à fila de mortes para processar no final do frame
        // (previne problemas com múltiplos danos simultâneos)
        this.deathQueue.push({
            targetId,
            killerId,
            damageInfo,
            timestamp: Date.now()
        });
    }
    
    processDeathQueue() {
        while (this.deathQueue.length > 0) {
            const { targetId, killerId, damageInfo, timestamp } = this.deathQueue.shift();
            
            // Obtém componentes necessários
            const playerComponent = this.ecs.getComponent(targetId, 'PlayerComponent');
            if (!playerComponent) continue;
            
            // Marca o jogador como morto
            playerComponent.isAlive = false;
            playerComponent.deathTime = timestamp;
            playerComponent.respawnTime = timestamp + this.gameSystem.getRespawnTime(targetId);
            
            // Incrementa estatísticas
            playerComponent.deaths++;
            
            // Se houver um assassino, incrementa seus abates
            if (killerId) {
                const killerPlayerComponent = this.ecs.getComponent(killerId, 'PlayerComponent');
                if (killerPlayerComponent) {
                    killerPlayerComponent.kills++;
                    
                    // Atribui pontos de score baseado no tipo de morte
                    const scoreValue = this.calculateScoreValue(damageInfo);
                    killerPlayerComponent.score += scoreValue;
                }
            }
            
            // Emite evento de morte para atualizar UI e outros sistemas
            this.eventSystem.emit('player:death', {
                playerId: targetId,
                killerId,
                weaponId: damageInfo.weaponId,
                damageType: damageInfo.type,
                timestamp,
                isCritical: damageInfo.critical || false,
                isHeadshot: damageInfo.hitPart === BODY_PARTS.HEAD
            });
            
            // Envia o evento de morte pela rede para os clientes
            this.networkSystem.broadcastToAll('player:death', {
                playerId: targetId,
                killerId,
                weaponType: damageInfo.weaponType,
                damageType: damageInfo.type,
                isHeadshot: damageInfo.hitPart === BODY_PARTS.HEAD
            });
            
            // Notifica o Game System sobre a morte do jogador
            this.gameSystem.playerDeath(targetId, killerId);
        }
    }
    
    applyEffect(targetId, effect, sourceId) {
        // Obtém o componente de efeitos do alvo
        let effectComponent = this.ecs.getComponent(targetId, 'EffectComponent');
        
        // Se o alvo não tiver um componente de efeitos, cria um
        if (!effectComponent) {
            effectComponent = new EffectComponent();
            this.ecs.addComponent(targetId, 'EffectComponent', effectComponent);
        }
        
        // Verifica se o alvo é imune ao efeito
        if (effectComponent.immunities.includes(effect.type)) {
            return false;
        }
        
        // Verifica se o efeito já está ativo e atualiza sua duração se necessário
        const existingEffect = effectComponent.activeEffects.find(e => e.type === effect.type);
        if (existingEffect) {
            // Se o novo efeito for mais forte, substitui
            if (effect.power > existingEffect.power) {
                existingEffect.power = effect.power;
                existingEffect.duration = effect.duration;
                existingEffect.startTime = Date.now();
                existingEffect.sourceId = sourceId;
            } 
            // Se a duração for maior, estende
            else if (effect.duration > (existingEffect.duration - (Date.now() - existingEffect.startTime) / 1000)) {
                existingEffect.duration = effect.duration;
                existingEffect.startTime = Date.now();
            }
        } else {
            // Adiciona o novo efeito
            effectComponent.activeEffects.push({
                ...effect,
                startTime: Date.now(),
                sourceId
            });
        }
        
        // Emite evento de efeito aplicado
        this.eventSystem.emit('effect:applied', {
            targetId,
            sourceId,
            effect
        });
        
        // Envia o evento de efeito aplicado pela rede para os clientes
        this.networkSystem.broadcastToRoom(
            'global',
            'effect:applied',
            {
                targetId,
                sourceId,
                effectType: effect.type,
                duration: effect.duration
            }
        );
        
        return true;
    }
    
    removeEffect(targetId, effectType) {
        const effectComponent = this.ecs.getComponent(targetId, 'EffectComponent');
        if (!effectComponent) return;
        
        // Remove o efeito da lista de efeitos ativos
        const effectIndex = effectComponent.activeEffects.findIndex(e => e.type === effectType);
        if (effectIndex !== -1) {
            effectComponent.activeEffects.splice(effectIndex, 1);
            
            // Emite evento de efeito removido
            this.eventSystem.emit('effect:removed', {
                targetId,
                effectType
            });
            
            // Envia o evento de efeito removido pela rede para os clientes
            this.networkSystem.broadcastToRoom(
                'global',
                'effect:removed',
                {
                    targetId,
                    effectType
                }
            );
        }
    }
    
    processActiveEffects() {
        // Itera sobre todas as entidades com componente de efeito
        this.ecs.getEntitiesWithComponent('EffectComponent').forEach(entity => {
            const effectComponent = this.ecs.getComponent(entity.id, 'EffectComponent');
            const now = Date.now();
            
            // Processa cada efeito ativo
            const expiredEffects = [];
            
            effectComponent.activeEffects.forEach(effect => {
                // Verifica se o efeito expirou
                const elapsedSeconds = (now - effect.startTime) / 1000;
                if (elapsedSeconds >= effect.duration) {
                    expiredEffects.push(effect.type);
                    return;
                }
                
                // Aplica efeitos periódicos (DOT, HOT, etc.)
                if (effect.tickRate && (now - (effect.lastTickTime || effect.startTime)) >= effect.tickRate) {
                    effect.lastTickTime = now;
                    
                    // Aplica efeito de cura ao longo do tempo
                    if (effect.type === EFFECT_TYPES.HEAL_OVER_TIME) {
                        this.applyHealing(entity.id, effect.power, effect.sourceId);
                    }
                    
                    // Aplica efeito de dano ao longo do tempo
                    if (effect.type === EFFECT_TYPES.DAMAGE_OVER_TIME) {
                        const damageInfo = {
                            amount: effect.power,
                            type: effect.damageType || DAMAGE_TYPES.MAGICAL,
                            critical: false,
                            source: 'effect',
                            effectType: effect.type
                        };
                        
                        this.applyDamage(entity.id, damageInfo, effect.sourceId);
                    }
                }
            });
            
            // Remove efeitos expirados
            expiredEffects.forEach(effectType => {
                this.removeEffect(entity.id, effectType);
            });
        });
    }
    
    applyHealing(targetId, amount, sourceId) {
        const healthComponent = this.ecs.getComponent(targetId, 'HealthComponent');
        if (!healthComponent) return;
        
        // Limita a cura à saúde máxima
        const healAmount = Math.min(amount, healthComponent.maxHealth - healthComponent.currentHealth);
        
        if (healAmount <= 0) return;
        
        // Aplica a cura
        healthComponent.currentHealth += healAmount;
        
        // Emite evento de cura
        this.eventSystem.emit('player:heal', {
            playerId: targetId,
            amount: healAmount,
            sourceId
        });
        
        // Envia o evento de cura pela rede para os clientes
        this.networkSystem.broadcastToRoom(
            'global',
            'player:heal',
            {
                playerId: targetId,
                amount: healAmount,
                sourceId
            }
        );
    }
    
    isImmuneToDamage(effectComponent, damageType) {
        if (!effectComponent) return false;
        
        // Verifica se há um efeito de invulnerabilidade
        const invulnerabilityEffect = effectComponent.activeEffects.find(
            e => e.type === EFFECT_TYPES.INVULNERABILITY
        );
        
        if (invulnerabilityEffect) return true;
        
        // Verifica se há resistência específica ao tipo de dano
        const resistanceEffect = effectComponent.activeEffects.find(
            e => e.type === EFFECT_TYPES.DAMAGE_RESISTANCE && e.damageType === damageType
        );
        
        if (resistanceEffect && resistanceEffect.power >= 1) return true;
        
        return false;
    }
    
    applyDamageModifiers(damage, damageType, effectComponent) {
        if (!effectComponent) return damage;
        
        let finalDamage = damage;
        
        // Aplica modificadores de todos os efeitos ativos relevantes
        effectComponent.activeEffects.forEach(effect => {
            // Resistência ao dano
            if (effect.type === EFFECT_TYPES.DAMAGE_RESISTANCE && 
                (!effect.damageType || effect.damageType === damageType)) {
                finalDamage *= (1 - Math.min(0.9, effect.power)); // Limita redução a 90%
            }
            
            // Amplificação de dano
            if (effect.type === EFFECT_TYPES.DAMAGE_AMPLIFICATION && 
                (!effect.damageType || effect.damageType === damageType)) {
                finalDamage *= (1 + effect.power);
            }
        });
        
        return Math.max(1, Math.round(finalDamage)); // Mínimo de 1 de dano
    }
    
    calculateDistance(pointA, pointB) {
        return Math.sqrt(
            Math.pow(pointB.x - pointA.x, 2) +
            Math.pow(pointB.y - pointA.y, 2) +
            Math.pow(pointB.z - pointA.z, 2)
        );
    }
    
    calculateHitPart(hitPosition, targetId) {
        // Obtém a posição e altura da entidade alvo
        const positionComponent = this.ecs.getComponent(targetId, 'PositionComponent');
        if (!positionComponent) return BODY_PARTS.TORSO;
        
        // Altura relativa do hit em relação ao centro da entidade
        const relativeHeight = hitPosition.y - positionComponent.y;
        
        // Determina a parte do corpo com base na altura relativa
        // Valores são aproximados e podem ser ajustados
        if (relativeHeight > 1.5) {
            return BODY_PARTS.HEAD;
        } else if (relativeHeight > 0.5) {
            return BODY_PARTS.CHEST;
        } else if (relativeHeight > -0.5) {
            return BODY_PARTS.TORSO;
        } else if (relativeHeight > -1.0) {
            return BODY_PARTS.LEGS;
        } else {
            return BODY_PARTS.FEET;
        }
    }
    
    getWeaponInfo(weaponType) {
        // Este método seria implementado para buscar informações sobre a arma
        // de uma constante ou sistema de armas
        return {
            baseDamage: 25, // Valor padrão
            headshotMultiplier: 2.5,
            chestMultiplier: 1.2,
            torsoMultiplier: 1.0,
            legsMultiplier: 0.7,
            feetMultiplier: 0.5,
            maxDistance: 100,
            falloffStart: 30,
            falloffEnd: 80
        };
    }
    
    calculateDamage({ weaponType, hitPart, distance, weaponInfo }) {
        // Base damage
        let damage = weaponInfo.baseDamage;
        
        // Apply body part multiplier
        let multiplier = 1.0;
        let isCritical = false;
        
        switch (hitPart) {
            case BODY_PARTS.HEAD:
                multiplier = weaponInfo.headshotMultiplier;
                isCritical = true;
                break;
            case BODY_PARTS.CHEST:
                multiplier = weaponInfo.chestMultiplier;
                break;
            case BODY_PARTS.TORSO:
                multiplier = weaponInfo.torsoMultiplier;
                break;
            case BODY_PARTS.LEGS:
                multiplier = weaponInfo.legsMultiplier;
                break;
            case BODY_PARTS.FEET:
                multiplier = weaponInfo.feetMultiplier;
                break;
        }
        
        damage *= multiplier;
        
        // Apply distance falloff
        if (distance > weaponInfo.falloffStart) {
            const falloffRange = weaponInfo.falloffEnd - weaponInfo.falloffStart;
            const falloffFactor = Math.max(0, 1 - (distance - weaponInfo.falloffStart) / falloffRange);
            damage *= falloffFactor;
        }
        
        // Round damage to an integer
        damage = Math.max(1, Math.round(damage));
        
        return {
            amount: damage,
            type: DAMAGE_TYPES.PHYSICAL,
            critical: isCritical,
            hitPart,
            weaponType,
            source: 'weapon'
        };
    }
    
    logDamage(targetId, attackerId, damage, damageInfo) {
        if (!this.damageLogs.has(targetId)) {
            this.damageLogs.set(targetId, []);
        }
        
        const damageLog = this.damageLogs.get(targetId);
        damageLog.push({
            attackerId,
            damage,
            timestamp: Date.now(),
            ...damageInfo
        });
        
        // Limita o tamanho do log (apenas últimos 20 hits)
        if (damageLog.length > 20) {
            damageLog.shift();
        }
    }
    
    calculateScoreValue(damageInfo) {
        // Pontuação base
        let score = 10;
        
        // Bônus para headshots
        if (damageInfo.hitPart === BODY_PARTS.HEAD) {
            score += 5;
        }
        
        // Bônus para tiros críticos
        if (damageInfo.critical) {
            score += 3;
        }
        
        return score;
    }
    
    update(deltaTime) {
        // Processa fila de mortes
        this.processDeathQueue();
        
        // Atualiza regeneração de vida para entidades com HealthComponent
        this.healthEntities.forEach((entity, entityId) => {
            const healthComponent = this.ecs.getComponent(entityId, 'HealthComponent');
            if (!healthComponent || healthComponent.currentHealth <= 0) return;
            
            // Verifica se passou tempo suficiente desde o último dano
            const timeSinceLastDamage = Date.now() - healthComponent.lastDamageTime;
            if (timeSinceLastDamage > 5000 && healthComponent.regeneration > 0) {
                const regenAmount = (healthComponent.regeneration * deltaTime) / 1000;
                healthComponent.currentHealth = Math.min(
                    healthComponent.maxHealth,
                    healthComponent.currentHealth + regenAmount
                );
            }
        });
    }
    
    dispose() {
        this.stopEffectTimer();
        this.eventSystem.unsubscribeAll(this);
        this.healthEntities.clear();
        this.damageLogs.clear();
        this.deathQueue = [];
    }
}

module.exports = CombatSystem;