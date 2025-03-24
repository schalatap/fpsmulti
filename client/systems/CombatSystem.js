import { EventSystem } from '../../shared/utils/EventSystem';
import { DAMAGE_TYPES, BODY_PARTS, EFFECT_TYPES } from '../../shared/constants/CombatConstants';

class CombatSystem {
    constructor(ecs, renderSystem, audioSystem) {
        this.ecs = ecs;
        this.renderSystem = renderSystem;
        this.audioSystem = audioSystem;
        this.eventSystem = EventSystem.getInstance();
        
        // Cache de elementos visuais para efeitos de dano
        this.damageIndicators = new Map();
        
        // Configurações visuais
        this.damageIndicatorDuration = 1000; // ms
        this.bloodOverlayDuration = 3000; // ms
        this.currentBloodOverlayOpacity = 0;
        
        // Rastreamento de saúde local
        this.localPlayerHealth = 100;
        this.localPlayerMaxHealth = 100;
        
        this.setupEventListeners();
    }
    
    initialize() {
        console.log('CombatSystem Client initialized');
        this.createBloodOverlay();
    }
    
    setupEventListeners() {
        // Escuta eventos de dano para visualizar
        this.eventSystem.subscribe('player:damage', this.handlePlayerDamage.bind(this));
        
        // Escuta eventos de morte para visualizar
        this.eventSystem.subscribe('player:death', this.handlePlayerDeath.bind(this));
        
        // Escuta eventos de cura para visualizar
        this.eventSystem.subscribe('player:heal', this.handlePlayerHeal.bind(this));
        
        // Escuta eventos de aplicação de efeitos
        this.eventSystem.subscribe('effect:applied', this.handleEffectApplied.bind(this));
        
        // Escuta eventos de remoção de efeitos
        this.eventSystem.subscribe('effect:removed', this.handleEffectRemoved.bind(this));
    }
    
    createBloodOverlay() {
        // Cria overlay de sangue para feedback visual de dano
        const overlay = document.createElement('div');
        overlay.className = 'blood-overlay';
        overlay.style.position = 'absolute';
        overlay.style.top = 0;
        overlay.style.left = 0;
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.pointerEvents = 'none';
        overlay.style.backgroundColor = 'rgba(255, 0, 0, 0)';
        overlay.style.transition = 'background-color 0.3s ease-out';
        overlay.style.zIndex = 1000;
        
        document.body.appendChild(overlay);
        this.bloodOverlay = overlay;
    }
    
    handlePlayerDamage(data) {
        const { playerId, damage, attackerId, damageType, isCritical, hitPart } = data;
        
        // Verificar se o dano foi no jogador local
        const isLocalPlayer = this.isLocalPlayer(playerId);
        
        if (isLocalPlayer) {
            // Atualiza contadores locais
            this.localPlayerHealth = Math.max(0, this.localPlayerHealth - damage);
            
            // Feedback visual
            this.showDamageIndicator(attackerId);
            this.pulseBloodOverlay(damage / this.localPlayerMaxHealth);
            
            // Feedback sonoro
            this.playDamageSound(damageType, damage);
            
            // Feedback de câmera (shake)
            if (isCritical) {
                this.renderSystem.cameraShake(0.3, 200);
            } else {
                this.renderSystem.cameraShake(0.1, 100);
            }
        } else {
            // Visualização de dano em outros jogadores
            this.createDamageNumber(playerId, damage, isCritical);
            this.createBloodEffect(playerId, hitPart);
        }
    }
    
    handlePlayerDeath(data) {
        const { playerId, killerId, weaponType, damageType, isHeadshot } = data;
        
        // Verifica se é o jogador local
        const isLocalPlayer = this.isLocalPlayer(playerId);
        
        if (isLocalPlayer) {
            // Feedback visual para morte do jogador local
            this.showDeathScreen();
            this.renderSystem.fadeToBlack(1.5);
            
            // Feedback sonoro
            this.audioSystem.playSound('death');
        } else {
            // Visualização de morte para outros jogadores
            this.createDeathEffect(playerId, damageType);
            
            // Se o jogador local for o assassino
            if (this.isLocalPlayer(killerId)) {
                this.showKillConfirmation(playerId, isHeadshot);
                
                // Som de confirmação de abate
                const sound = isHeadshot ? 'headshot_kill' : 'kill';
                this.audioSystem.playSound(sound);
            }
        }
    }
    
    handlePlayerHeal(data) {
        const { playerId, amount } = data;
        
        // Verificar se a cura foi no jogador local
        const isLocalPlayer = this.isLocalPlayer(playerId);
        
        if (isLocalPlayer) {
            // Atualiza contadores locais
            this.localPlayerHealth = Math.min(this.localPlayerMaxHealth, this.localPlayerHealth + amount);
            
            // Feedback visual
            this.showHealEffect();
            
            // Feedback sonoro
            this.audioSystem.playSound('heal');
        } else {
            // Visualização de cura em outros jogadores
            this.createHealEffect(playerId, amount);
        }
    }
    
    handleEffectApplied(data) {
        const { targetId, sourceId, effect } = data;
        
        // Verifica se é no jogador local
        const isLocalPlayer = this.isLocalPlayer(targetId);
        
        // Cria efeito visual baseado no tipo
        this.createStatusEffect(targetId, effect.type, effect.duration);
        
        if (isLocalPlayer) {
            // Feedback visual de aplicação de efeito
            this.showEffectAppliedIndicator(effect.type);
            
            // Feedback sonoro
            this.audioSystem.playSound(`effect_${effect.type}`);
        }
    }
    
    handleEffectRemoved(data) {
        const { targetId, effectType } = data;
        
        // Remove efeito visual
        this.removeStatusEffect(targetId, effectType);
        
        // Verifica se é o jogador local
        if (this.isLocalPlayer(targetId)) {
            // Feedback visual de remoção de efeito
            this.showEffectRemovedIndicator(effectType);
        }
    }
    
    isLocalPlayer(playerId) {
        // Implementação dependerá do sistema de gerenciamento de entidades do cliente
        const localPlayerEntity = this.ecs.getLocalPlayerEntity();
        return localPlayerEntity && localPlayerEntity.id === playerId;
    }
    
    showDamageIndicator(attackerId) {
        if (!attackerId) return;
        
        // Calcula a direção do atacante em relação ao jogador
        const playerPosition = this.getLocalPlayerPosition();
        const attackerPosition = this.getEntityPosition(attackerId);
        
        if (!playerPosition || !attackerPosition) return;
        
        // Calcula ângulo de ataque
        const dx = attackerPosition.x - playerPosition.x;
        const dz = attackerPosition.z - playerPosition.z;
        const angle = Math.atan2(dz, dx) * (180 / Math.PI);
        
        // Cria ou reutiliza indicador
        let indicator = document.getElementById('damage-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'damage-indicator';
            indicator.style.position = 'absolute';
            indicator.style.width = '100%';
            indicator.style.height = '100%';
            indicator.style.top = 0;
            indicator.style.left = 0;
            indicator.style.pointerEvents = 'none';
            indicator.style.zIndex = 1001;
            document.body.appendChild(indicator);
        }
        
        // Cria elemento de seta
        const arrow = document.createElement('div');
        arrow.className = 'damage-arrow';
        arrow.style.position = 'absolute';
        arrow.style.width = '30px';
        arrow.style.height = '100px';
        arrow.style.top = '50%';
        arrow.style.left = '50%';
        arrow.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;
        arrow.style.backgroundImage = 'url(../assets/damage_indicator.svg)';
        arrow.style.backgroundSize = 'contain';
        arrow.style.backgroundRepeat = 'no-repeat';
        arrow.style.opacity = '0.8';
        arrow.style.transition = 'opacity 0.5s ease-out';
        
        indicator.appendChild(arrow);
        
        // Remove após um tempo
        setTimeout(() => {
            arrow.style.opacity = '0';
            setTimeout(() => {
                if (arrow.parentNode) {
                    arrow.parentNode.removeChild(arrow);
                }
            }, 500);
        }, this.damageIndicatorDuration);
    }
    
    pulseBloodOverlay(damageRatio) {
        // Calcula opacidade baseada no dano (mais dano = mais vermelho)
        const intensity = Math.min(0.7, this.currentBloodOverlayOpacity + damageRatio * 0.5);
        this.currentBloodOverlayOpacity = intensity;
        
        // Aplica efeito visual
        this.bloodOverlay.style.backgroundColor = `rgba(255, 0, 0, ${intensity})`;
        
        // Limpa timeout anterior se existir
        if (this.bloodOverlayTimeout) {
            clearTimeout(this.bloodOverlayTimeout);
        }
        
        // Configura fade out
        this.bloodOverlayTimeout = setTimeout(() => {
            this.currentBloodOverlayOpacity = 0;
            this.bloodOverlay.style.backgroundColor = 'rgba(255, 0, 0, 0)';
        }, this.bloodOverlayDuration);
    }
    
    playDamageSound(damageType, damage) {
        let sound = 'hit_small';
        
        if (damage > 50) {
            sound = 'hit_large';
        } else if (damage > 25) {
            sound = 'hit_medium';
        }
        
        // Modifica som baseado no tipo de dano
        if (damageType === DAMAGE_TYPES.FIRE) {
            sound = 'burn';
        } else if (damageType === DAMAGE_TYPES.ELECTRIC) {
            sound = 'shock';
        } else if (damageType === DAMAGE_TYPES.EXPLOSIVE) {
            sound = 'explosion';
        }
        
        this.audioSystem.playSound(sound);
    }
    
    createDamageNumber(targetId, damage, isCritical) {
        // Obtém posição do alvo no mundo
        const position = this.getEntityPosition(targetId);
        if (!position) return;
        
        // Cria elemento 3D para números de dano
        const color = isCritical ? 0xFF0000 : 0xFFFFFF;
        const scale = isCritical ? 1.5 : 1.0;
        
        this.renderSystem.createFloatingText({
            text: damage.toString(),
            position: {
                x: position.x,
                y: position.y + 2, // Ligeiramente acima da cabeça
                z: position.z
            },
            color,
            scale,
            duration: 1000,
            rise: true
        });
    }
    
    createBloodEffect(targetId, hitPart) {
        // Obtém posição do alvo no mundo
        const position = this.getEntityPosition(targetId);
        if (!position) return;
        
        // Ajusta posição baseado na parte do corpo
        let offsetY = 0;
        switch (hitPart) {
            case BODY_PARTS.HEAD:
                offsetY = 1.7;
                break;
            case BODY_PARTS.CHEST:
                offsetY = 1.3;
                break;
            case BODY_PARTS.TORSO:
                offsetY = 1.0;
                break;
            case BODY_PARTS.LEGS:
                offsetY = 0.5;
                break;
            case BODY_PARTS.FEET:
                offsetY = 0.1;
                break;
            default:
                offsetY = 1.0;
                break;
        }
        
        this.renderSystem.createParticleEffect({
            type: 'blood',
            position: {
                x: position.x,
                y: position.y + offsetY,
                z: position.z
            },
            count: hitPart === BODY_PARTS.HEAD ? 20 : 10,
            duration: 500
        });
    }
    
    createDeathEffect(targetId, damageType) {
        // Obtém posição do alvo no mundo
        const position = this.getEntityPosition(targetId);
        if (!position) return;
        
        // Diferentes efeitos baseados no tipo de dano
        let effectType = 'death_normal';
        
        if (damageType === DAMAGE_TYPES.FIRE) {
            effectType = 'death_fire';
        } else if (damageType === DAMAGE_TYPES.ELECTRIC) {
            effectType = 'death_electric';
        } else if (damageType === DAMAGE_TYPES.EXPLOSIVE) {
            effectType = 'death_explosion';
        } else if (damageType === DAMAGE_TYPES.MAGICAL) {
            effectType = 'death_magical';
        }
        
        this.renderSystem.createParticleEffect({
            type: effectType,
            position,
            count: 30,
            duration: 2000,
            size: 2.0
        });
    }
    
    createHealEffect(targetId, amount) {
        // Obtém posição do alvo no mundo
        const position = this.getEntityPosition(targetId);
        if (!position) return;
        
        // Cria números de cura
        this.renderSystem.createFloatingText({
            text: `+${amount}`,
            position: {
                x: position.x,
                y: position.y + 2.2,
                z: position.z
            },
            color: 0x00FF00,
            scale: 1.0,
            duration: 1000,
            rise: true
        });
        
        // Cria partículas de cura
        this.renderSystem.createParticleEffect({
            type: 'heal',
            position: {
                x: position.x,
                y: position.y + 1,
                z: position.z
            },
            count: 15,
            duration: 1000
        });
    }
    
    createStatusEffect(targetId, effectType, duration) {
        // Obtém posição do alvo no mundo
        const position = this.getEntityPosition(targetId);
        if (!position) return;
        
        // Cria efeito visual baseado no tipo
        let visualType = 'effect_generic';
        let effectColor = 0xFFFFFF;
        
        switch (effectType) {
            case EFFECT_TYPES.DAMAGE_OVER_TIME:
                visualType = 'effect_dot';
                effectColor = 0xFF5500;
                break;
            case EFFECT_TYPES.HEAL_OVER_TIME:
                visualType = 'effect_hot';
                effectColor = 0x00FF00;
                break;
            case EFFECT_TYPES.SLOW:
                visualType = 'effect_slow';
                effectColor = 0x0066FF;
                break;
            case EFFECT_TYPES.STUN:
                visualType = 'effect_stun';
                effectColor = 0xFFFF00;
                break;
            case EFFECT_TYPES.INVULNERABILITY:
                visualType = 'effect_shield';
                effectColor = 0x66FFFF;
                break;
            case EFFECT_TYPES.DAMAGE_AMPLIFICATION:
                visualType = 'effect_amp';
                effectColor = 0xFF0000;
                break;
            case EFFECT_TYPES.DAMAGE_RESISTANCE:
                visualType = 'effect_resist';
                effectColor = 0x0000FF;
                break;
        }
        
        // Cria efeito persistente
        const effectId = this.renderSystem.createPersistentEffect({
            type: visualType,
            targetId,
            position: {
                x: position.x,
                y: position.y + 1,
                z: position.z
            },
            color: effectColor,
            duration: duration * 1000 // Converte para ms
        });
        
        // Armazena referência do efeito
        if (!this.damageIndicators.has(targetId)) {
            this.damageIndicators.set(targetId, new Map());
        }
        this.damageIndicators.get(targetId).set(effectType, effectId);
    }
    
    removeStatusEffect(targetId, effectType) {
        if (this.damageIndicators.has(targetId)) {
            const effects = this.damageIndicators.get(targetId);
            if (effects.has(effectType)) {
                const effectId = effects.get(effectType);
                this.renderSystem.removePersistentEffect(effectId);
                effects.delete(effectType);
            }
        }
    }
    
    showDeathScreen() {
        // Implementação específica da UI
        this.eventSystem.emit('ui:showDeathScreen');
    }
    
    showKillConfirmation(targetId, isHeadshot) {
        // Implementação específica da UI
        this.eventSystem.emit('ui:showKillConfirmation', {
            targetId,
            isHeadshot
        });
    }
    
    showEffectAppliedIndicator(effectType) {
        // Implementação específica da UI
        this.eventSystem.emit('ui:showEffectIndicator', {
            effectType,
            isActive: true
        });
    }
    
    showEffectRemovedIndicator(effectType) {
        // Implementação específica da UI
        this.eventSystem.emit('ui:showEffectIndicator', {
            effectType,
            isActive: false
        });
    }
    
    showHealEffect() {
        // Implementação específica da UI
        this.eventSystem.emit('ui:showHealEffect');
    }
    
    getLocalPlayerPosition() {
        const localPlayerEntity = this.ecs.getLocalPlayerEntity();
        if (!localPlayerEntity) return null;
        
        const positionComponent = this.ecs.getComponent(localPlayerEntity.id, 'PositionComponent');
        if (!positionComponent) return null;
        
        return {
            x: positionComponent.x,
            y: positionComponent.y,
            z: positionComponent.z
        };
    }
    
    getEntityPosition(entityId) {
        const positionComponent = this.ecs.getComponent(entityId, 'PositionComponent');
        if (!positionComponent) return null;
        
        return {
            x: positionComponent.x,
            y: positionComponent.y,
            z: positionComponent.z
        };
    }
    
    update(deltaTime) {
        // Nada a fazer aqui - a maior parte da lógica é orientada a eventos
    }
    
    dispose() {
        // Remove elementos visuais
        if (this.bloodOverlay && this.bloodOverlay.parentNode) {
            this.bloodOverlay.parentNode.removeChild(this.bloodOverlay);
        }
        
        const damageIndicator = document.getElementById('damage-indicator');
        if (damageIndicator && damageIndicator.parentNode) {
            damageIndicator.parentNode.removeChild(damageIndicator);
        }
        
        // Limpa timeouts
        if (this.bloodOverlayTimeout) {
            clearTimeout(this.bloodOverlayTimeout);
        }
        
        // Remove todos os efeitos persistentes
        this.damageIndicators.forEach((effects, targetId) => {
            effects.forEach((effectId, effectType) => {
                this.renderSystem.removePersistentEffect(effectId);
            });
        });
        
        this.damageIndicators.clear();
        
        // Desinscreve de todos os eventos
        this.eventSystem.unsubscribeAll(this);
    }
}

export default CombatSystem;