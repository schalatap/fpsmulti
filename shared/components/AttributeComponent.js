/**
 * @fileoverview Componente que gerencia os atributos do jogador que afetam
 * seus stats, habilidades e evolução durante o jogo.
 */

class AttributeComponent {
    /**
     * Cria um novo componente de atributos
     * @param {Object} options - Opções de inicialização
     * @param {number} [options.strength=1] - Força (aumenta dano físico)
     * @param {number} [options.dexterity=1] - Destreza (aumenta precisão e velocidade)
     * @param {number} [options.intelligence=1] - Inteligência (aumenta dano mágico e mana)
     * @param {number} [options.vitality=1] - Vitalidade (aumenta vida)
     * @param {number} [options.availablePoints=0] - Pontos disponíveis para distribuir
     * @param {number} [options.level=1] - Nível do jogador
     * @param {number} [options.experience=0] - Experiência atual
     * @param {number} [options.experienceToNextLevel=100] - Experiência necessária para o próximo nível
     * @param {number} [options.maxAttributeValue=10] - Valor máximo para cada atributo
     * @param {number} [options.attributePointsPerLevel=1] - Pontos de atributo ganhos por nível
     */
    constructor(options = {}) {
        // Atributos base
        this.strength = options.strength || 1;
        this.dexterity = options.dexterity || 1;
        this.intelligence = options.intelligence || 1;
        this.vitality = options.vitality || 1;
        
        // Sistema de progressão
        this.availablePoints = options.availablePoints || 0;
        this.level = options.level || 1;
        this.experience = options.experience || 0;
        this.experienceToNextLevel = options.experienceToNextLevel || 100;
        
        // Limites
        this.maxAttributeValue = options.maxAttributeValue || 10;
        this.attributePointsPerLevel = options.attributePointsPerLevel || 1;
        
        // Modificadores temporários (buffs/debuffs)
        this.temporaryModifiers = {
            strength: 0,
            dexterity: 0,
            intelligence: 0,
            vitality: 0
        };
    }

    /**
     * Adiciona pontos a um atributo
     * @param {string} attribute - Nome do atributo ('strength', 'dexterity', 'intelligence', 'vitality')
     * @param {number} points - Quantidade de pontos a adicionar
     * @returns {boolean} - Se a operação foi bem-sucedida
     */
    addPoints(attribute, points) {
        // Verificar se o atributo existe
        if (!this.hasOwnProperty(attribute)) {
            return false;
        }
        
        // Verificar se há pontos disponíveis
        if (this.availablePoints < points || points <= 0) {
            return false;
        }
        
        // Verificar se não excede o máximo
        if (this[attribute] + points > this.maxAttributeValue) {
            return false;
        }
        
        // Adicionar pontos
        this[attribute] += points;
        this.availablePoints -= points;
        
        return true;
    }

    /**
     * Adiciona um modificador temporário a um atributo
     * @param {string} attribute - Nome do atributo
     * @param {number} value - Valor do modificador
     */
    addTemporaryModifier(attribute, value) {
        if (this.temporaryModifiers.hasOwnProperty(attribute)) {
            this.temporaryModifiers[attribute] += value;
        }
    }

    /**
     * Remove um modificador temporário de um atributo
     * @param {string} attribute - Nome do atributo
     * @param {number} value - Valor do modificador a remover
     */
    removeTemporaryModifier(attribute, value) {
        if (this.temporaryModifiers.hasOwnProperty(attribute)) {
            this.temporaryModifiers[attribute] -= value;
        }
    }

    /**
     * Limpa todos os modificadores temporários
     */
    clearTemporaryModifiers() {
        for (const attr in this.temporaryModifiers) {
            this.temporaryModifiers[attr] = 0;
        }
    }

    /**
     * Obtém o valor total de um atributo (base + modificadores)
     * @param {string} attribute - Nome do atributo
     * @returns {number} - Valor total do atributo
     */
    getTotalAttribute(attribute) {
        if (!this.hasOwnProperty(attribute) || !this.temporaryModifiers.hasOwnProperty(attribute)) {
            return 0;
        }
        
        return Math.max(0, this[attribute] + this.temporaryModifiers[attribute]);
    }

    /**
     * Adiciona experiência e verifica se subiu de nível
     * @param {number} amount - Quantidade de experiência a adicionar
     * @returns {number} - Número de níveis ganhos (0 se não houver)
     */
    addExperience(amount) {
        if (amount <= 0) return 0;
        
        this.experience += amount;
        let levelsGained = 0;
        
        // Verificar se subiu de nível
        while (this.experience >= this.experienceToNextLevel) {
            this.experience -= this.experienceToNextLevel;
            this.level++;
            levelsGained++;
            
            // Adicionar pontos por nível
            this.availablePoints += this.attributePointsPerLevel;
            
            // Aumentar experiência necessária para o próximo nível
            // Formula típica de progressão: expNext = baseExp * (levelMultiplier ^ level)
            this.experienceToNextLevel = Math.floor(this.experienceToNextLevel * 1.5);
        }
        
        return levelsGained;
    }

    /**
     * Obtém os bônus derivados dos atributos
     * @returns {Object} - Bônus de atributos
     */
    getAttributeBonuses() {
        return {
            // Bônus de força (dano físico, capacidade de carregar peso)
            physicalDamageBonus: 0.1 * this.getTotalAttribute('strength'),
            carryWeightBonus: 5 * this.getTotalAttribute('strength'),
            
            // Bônus de destreza (precisão, velocidade, chance de crítico)
            accuracyBonus: 0.05 * this.getTotalAttribute('dexterity'),
            moveSpeedBonus: 0.02 * this.getTotalAttribute('dexterity'),
            criticalChanceBonus: 0.01 * this.getTotalAttribute('dexterity'),
            
            // Bônus de inteligência (dano mágico, mana, velocidade de conjuração)
            magicalDamageBonus: 0.1 * this.getTotalAttribute('intelligence'),
            maxManaBonus: 10 * this.getTotalAttribute('intelligence'),
            castingSpeedBonus: 0.05 * this.getTotalAttribute('intelligence'),
            
            // Bônus de vitalidade (vida, resistência, regeneração)
            maxHealthBonus: 10 * this.getTotalAttribute('vitality'),
            damageResistanceBonus: 0.02 * this.getTotalAttribute('vitality'),
            healthRegenBonus: 0.1 * this.getTotalAttribute('vitality')
        };
    }

    /**
     * Cria um novo componente com atributos para um jogador de nível específico
     * @param {number} level - Nível do jogador
     * @returns {AttributeComponent} - Novo componente de atributos
     */
    static createForLevel(level) {
        // Calcular pontos base e disponíveis
        const basePoints = 1;
        const totalPoints = basePoints + (level - 1);
        const availablePoints = level - 1;
        
        // Experiência para o próximo nível baseada no nível atual
        let expToNext = 100;
        for (let i = 1; i < level; i++) {
            expToNext = Math.floor(expToNext * 1.5);
        }
        
        return new AttributeComponent({
            strength: basePoints,
            dexterity: basePoints,
            intelligence: basePoints,
            vitality: basePoints,
            availablePoints: availablePoints,
            level: level,
            experience: 0,
            experienceToNextLevel: expToNext
        });
    }

    /**
     * Serializa o componente para transmissão pela rede
     * @returns {Object} Representação serializada
     */
    serialize() {
        return {
            strength: this.strength,
            dexterity: this.dexterity,
            intelligence: this.intelligence,
            vitality: this.vitality,
            availablePoints: this.availablePoints,
            level: this.level,
            experience: this.experience,
            experienceToNextLevel: this.experienceToNextLevel,
            temporaryModifiers: {...this.temporaryModifiers}
        };
    }

    /**
     * Deserializa dados da rede para atualizar o componente
     * @param {Object} data - Dados recebidos da rede
     */
    deserialize(data) {
        if (data.strength !== undefined) this.strength = data.strength;
        if (data.dexterity !== undefined) this.dexterity = data.dexterity;
        if (data.intelligence !== undefined) this.intelligence = data.intelligence;
        if (data.vitality !== undefined) this.vitality = data.vitality;
        if (data.availablePoints !== undefined) this.availablePoints = data.availablePoints;
        if (data.level !== undefined) this.level = data.level;
        if (data.experience !== undefined) this.experience = data.experience;
        if (data.experienceToNextLevel !== undefined) this.experienceToNextLevel = data.experienceToNextLevel;
        if (data.temporaryModifiers) this.temporaryModifiers = {...data.temporaryModifiers};
    }

    /**
     * Cria uma cópia independente deste componente
     * @returns {AttributeComponent} Nova instância com os mesmos valores
     */
    clone() {
        const clone = new AttributeComponent({
            strength: this.strength,
            dexterity: this.dexterity,
            intelligence: this.intelligence,
            vitality: this.vitality,
            availablePoints: this.availablePoints,
            level: this.level,
            experience: this.experience,
            experienceToNextLevel: this.experienceToNextLevel,
            maxAttributeValue: this.maxAttributeValue,
            attributePointsPerLevel: this.attributePointsPerLevel
        });
        
        clone.temporaryModifiers = {...this.temporaryModifiers};
        
        return clone;
    }
}

// Exportar o componente
export default AttributeComponent;