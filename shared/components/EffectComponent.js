/**
 * @fileoverview Componente que gerencia efeitos de status (buffs/debuffs)
 * aplicados a uma entidade.
 */

class EffectComponent {
    /**
     * Cria um novo componente de efeitos
     * @param {Object} options - Opções de inicialização
     * @param {Array} [options.activeEffects=[]] - Lista inicial de efeitos ativos
     * @param {Array} [options.immunities=[]] - Lista de tipos de efeitos aos quais a entidade é imune
     */
    constructor(options = {}) {
        // Lista de efeitos ativos
        this.activeEffects = options.activeEffects || [];
        
        // Lista de imunidades
        this.immunities = options.immunities || [];
    }

    /**
     * Adiciona um efeito ativo
     * @param {Object} effect - Efeito a ser adicionado
     * @param {string} effect.id - Identificador único do efeito
     * @param {string} effect.type - Tipo do efeito (burn, poison, slow, stun, etc.)
     * @param {number} effect.duration - Duração em milissegundos
     * @param {number} effect.strength - Potência do efeito
     * @param {string} effect.source - ID da entidade que aplicou o efeito
     * @param {number} effect.startTime - Timestamp de início do efeito
     * @param {Object} [effect.params={}] - Parâmetros específicos do efeito
     * @param {boolean} [effect.isStackable=false] - Se o efeito pode acumular
     * @param {number} [effect.maxStacks=1] - Número máximo de acúmulos
     * @param {boolean} [effect.isPeriodic=false] - Se o efeito aplica dano/cura periódica
     * @param {number} [effect.tickInterval=1000] - Intervalo de ticks em ms (para efeitos periódicos)
     * @param {number} [effect.lastTickTime=0] - Timestamp do último tick
     * @param {string} [effect.category='debuff'] - Categoria do efeito ('buff', 'debuff', 'cc')
     * @param {boolean} [effect.showEffect=true] - Se o efeito deve ter visualização
     * @param {boolean} [effect.isCleansable=true] - Se o efeito pode ser removido por limpeza (ex: poções)
     * @returns {boolean} - Se o efeito foi adicionado com sucesso
     */
    addEffect(effect) {
        // Verificar se é imune a este tipo de efeito
        if (this.isImmuneTo(effect.type)) {
            return false;
        }
        
        // Verificar se já existe um efeito do mesmo tipo
        const existingIndex = this.activeEffects.findIndex(e => e.type === effect.type);
        
        if (existingIndex !== -1) {
            const existing = this.activeEffects[existingIndex];
            
            // Se é acumulável, incrementar stacks
            if (effect.isStackable) {
                const currentStacks = existing.stacks || 1;
                
                // Verificar se já está no máximo de stacks
                if (currentStacks < (effect.maxStacks || 1)) {
                    // Incrementar stacks
                    existing.stacks = currentStacks + 1;
                    
                    // Atualizar potência baseada em stacks
                    existing.strength = Math.min(existing.strength + effect.strength, existing.strength * 2);
                    
                    // Estender duração
                    existing.duration = Math.max(existing.duration, effect.duration);
                    
                    // Atualizar tempo de início
                    existing.startTime = Date.now();
                    
                    return true;
                }
            }
            
            // Substituir efeito existente se o novo for mais forte
            if (effect.strength > existing.strength) {
                this.activeEffects[existingIndex] = {
                    ...effect,
                    startTime: Date.now(),
                    stacks: 1
                };
                return true;
            }
            
            // Estender duração se não for acumulável
            if (effect.strength === existing.strength) {
                existing.duration = Math.max(existing.duration, effect.duration);
                existing.startTime = Date.now();
                return true;
            }
            
            return false;
        }
        
        // Adicionar novo efeito
        this.activeEffects.push({
            ...effect,
            startTime: Date.now(),
            stacks: 1
        });
        
        return true;
    }

    /**
     * Remove um efeito pelo ID
     * @param {string} effectId - ID do efeito a remover
     * @returns {boolean} - Se o efeito foi removido com sucesso
     */
    removeEffectById(effectId) {
        const initialLength = this.activeEffects.length;
        this.activeEffects = this.activeEffects.filter(effect => effect.id !== effectId);
        return initialLength !== this.activeEffects.length;
    }

    /**
     * Remove todos os efeitos de um determinado tipo
     * @param {string} effectType - Tipo de efeito a remover
     * @returns {number} - Número de efeitos removidos
     */
    removeEffectsByType(effectType) {
        const initialLength = this.activeEffects.length;
        this.activeEffects = this.activeEffects.filter(effect => effect.type !== effectType);
        return initialLength - this.activeEffects.length;
    }

    /**
     * Remove todos os efeitos limpáveis (cleansable)
     * @param {string} [category] - Categoria opcional para remover (buff, debuff, cc)
     * @returns {number} - Número de efeitos removidos
     */
    cleanse(category) {
        const initialLength = this.activeEffects.length;
        
        this.activeEffects = this.activeEffects.filter(effect => {
            // Se uma categoria foi especificada, remover apenas dessa categoria
            if (category && effect.category !== category) {
                return true;
            }
            
            // Manter efeitos que não são limpáveis
            return effect.isCleansable === false;
        });
        
        return initialLength - this.activeEffects.length;
    }

    /**
     * Remove um stack de um efeito
     * @param {string} effectId - ID do efeito
     * @returns {boolean} - Se um stack foi removido
     */
    removeStack(effectId) {
        const effect = this.activeEffects.find(e => e.id === effectId);
        
        if (!effect || !effect.isStackable) {
            return false;
        }
        
        if (effect.stacks > 1) {
            effect.stacks--;
            
            // Reduzir potência proporcionalmente
            effect.strength = effect.strength * (effect.stacks / (effect.stacks + 1));
            
            return true;
        }
        
        // Se for o último stack, remover o efeito
        return this.removeEffectById(effectId);
    }

    /**
     * Atualiza todos os efeitos ativos, removendo os expirados
     * @param {number} timestamp - Timestamp atual
     * @returns {Array} - Efeitos que expiraram nesta atualização
     */
    updateEffects(timestamp = Date.now()) {
        const expiredEffects = [];
        const stillActive = [];
        
        for (const effect of this.activeEffects) {
            // Verificar se o efeito expirou
            if (timestamp - effect.startTime >= effect.duration) {
                expiredEffects.push({...effect});
            } else {
                stillActive.push(effect);
            }
        }
        
        this.activeEffects = stillActive;
        return expiredEffects;
    }

    /**
     * Processa os ticks de efeitos periódicos
     * @param {number} timestamp - Timestamp atual
     * @returns {Array} - Efeitos que tiveram ticks nesta atualização
     */
    processPeriodicEffects(timestamp = Date.now()) {
        const tickedEffects = [];
        
        for (const effect of this.activeEffects) {
            if (effect.isPeriodic && effect.tickInterval) {
                // Inicializar lastTickTime se for o primeiro tick
                if (!effect.lastTickTime) {
                    effect.lastTickTime = effect.startTime;
                }
                
                // Verificar se é hora de um novo tick
                if (timestamp - effect.lastTickTime >= effect.tickInterval) {
                    // Calcular quantos ticks ocorreram
                    const ticksPassed = Math.floor((timestamp - effect.lastTickTime) / effect.tickInterval);
                    
                    // Atualizar o tempo do último tick
                    effect.lastTickTime += ticksPassed * effect.tickInterval;
                    
                    // Adicionar à lista de efeitos que tiveram ticks
                    tickedEffects.push({
                        ...effect,
                        ticks: ticksPassed
                    });
                }
            }
        }
        
        return tickedEffects;
    }

    /**
     * Verifica se a entidade tem um efeito específico ativo
     * @param {string} effectType - Tipo de efeito a verificar
     * @returns {boolean} - Se o efeito está ativo
     */
    hasEffect(effectType) {
        return this.activeEffects.some(effect => effect.type === effectType);
    }

    /**
     * Obtém um efeito ativo pelo tipo
     * @param {string} effectType - Tipo de efeito
     * @returns {Object|null} - O efeito, ou null se não existir
     */
    getEffect(effectType) {
        return this.activeEffects.find(effect => effect.type === effectType) || null;
    }

    /**
     * Obtém a potência total de um tipo de efeito (soma se houver múltiplos)
     * @param {string} effectType - Tipo de efeito
     * @returns {number} - Potência total
     */
    getEffectStrength(effectType) {
        return this.activeEffects
            .filter(effect => effect.type === effectType)
            .reduce((total, effect) => total + effect.strength * (effect.stacks || 1), 0);
    }

    /**
     * Adiciona uma imunidade a um tipo de efeito
     * @param {string} effectType - Tipo de efeito
     */
    addImmunity(effectType) {
        if (!this.immunities.includes(effectType)) {
            this.immunities.push(effectType);
        }
    }

    /**
     * Remove uma imunidade
     * @param {string} effectType - Tipo de efeito
     */
    removeImmunity(effectType) {
        this.immunities = this.immunities.filter(type => type !== effectType);
    }

    /**
     * Verifica se a entidade é imune a um efeito
     * @param {string} effectType - Tipo de efeito
     * @returns {boolean} - Se é imune
     */
    isImmuneTo(effectType) {
        return this.immunities.includes(effectType);
    }

    /**
     * Remove todos os efeitos ativos
     */
    clearAllEffects() {
        this.activeEffects = [];
    }

    /**
     * Remove todos os efeitos aplicados por uma fonte específica
     * @param {string} sourceId - ID da fonte (entidade que aplicou)
     * @returns {number} - Número de efeitos removidos
     */
    removeEffectsBySource(sourceId) {
        const initialLength = this.activeEffects.length;
        this.activeEffects = this.activeEffects.filter(effect => effect.source !== sourceId);
        return initialLength - this.activeEffects.length;
    }

    /**
     * Obtém modificadores de atributos baseados nos efeitos ativos
     * @returns {Object} - Modificadores por atributo
     */
    getAttributeModifiers() {
        const modifiers = {
            strength: 0,
            dexterity: 0,
            intelligence: 0,
            vitality: 0,
            moveSpeed: 0,
            attackSpeed: 0,
            castSpeed: 0,
            damageReduction: 0,
            damageTaken: 0,
            damageDealt: 0
        };
        
        // Processar cada efeito ativo
        for (const effect of this.activeEffects) {
            // Exemplo de efeitos que modificam atributos
            switch (effect.type) {
                case 'strengthen':
                    modifiers.strength += effect.strength * (effect.stacks || 1);
                    break;
                case 'weaken':
                    modifiers.strength -= effect.strength * (effect.stacks || 1);
                    break;
                case 'haste':
                    modifiers.moveSpeed += effect.strength * 0.1 * (effect.stacks || 1);
                    modifiers.attackSpeed += effect.strength * 0.1 * (effect.stacks || 1);
                    break;
                case 'slow':
                    modifiers.moveSpeed -= effect.strength * 0.1 * (effect.stacks || 1);
                    break;
                case 'protect':
                    modifiers.damageReduction += effect.strength * 0.05 * (effect.stacks || 1);
                    break;
                case 'vulnerable':
                    modifiers.damageTaken += effect.strength * 0.1 * (effect.stacks || 1);
                    break;
                case 'empower':
                    modifiers.damageDealt += effect.strength * 0.1 * (effect.stacks || 1);
                    break;
                // Outros tipos de efeitos...
            }
            
            // Aplicar modificadores específicos do efeito, se houver
            if (effect.params && effect.params.modifiers) {
                for (const [attribute, value] of Object.entries(effect.params.modifiers)) {
                    if (modifiers.hasOwnProperty(attribute)) {
                        modifiers[attribute] += value * (effect.stacks || 1);
                    }
                }
            }
        }
        
        return modifiers;
    }

    /**
     * Verifica se há algum efeito que impeça ações (stun, freeze, etc.)
     * @returns {boolean} - Se está incapacitado
     */
    isIncapacitated() {
        return this.hasEffect('stun') || 
               this.hasEffect('freeze') || 
               this.hasEffect('sleep') || 
               this.hasEffect('paralysis');
    }

    /**
     * Serializa o componente para transmissão pela rede
     * @returns {Object} Representação serializada
     */
    serialize() {
        return {
            activeEffects: this.activeEffects.map(effect => ({
                id: effect.id,
                type: effect.type,
                strength: effect.strength,
                duration: effect.duration,
                startTime: effect.startTime,
                stacks: effect.stacks || 1,
                source: effect.source,
                category: effect.category
            })),
            immunities: [...this.immunities]
        };
    }

    /**
     * Deserializa dados da rede para atualizar o componente
     * @param {Object} data - Dados recebidos da rede
     */
    deserialize(data) {
        if (data.activeEffects) {
            this.activeEffects = data.activeEffects.map(effect => ({
                ...effect,
                params: effect.params || {},
                isStackable: effect.stacks > 1,
                isPeriodic: Boolean(effect.tickInterval),
                isCleansable: effect.isCleansable !== false,
                showEffect: effect.showEffect !== false
            }));
        }
        
        if (data.immunities) {
            this.immunities = [...data.immunities];
        }
    }

    /**
     * Cria uma cópia independente deste componente
     * @returns {EffectComponent} Nova instância com os mesmos valores
     */
    clone() {
        return new EffectComponent({
            activeEffects: this.activeEffects.map(effect => ({...effect})),
            immunities: [...this.immunities]
        });
    }
}

// Exportar o componente
export default EffectComponent;