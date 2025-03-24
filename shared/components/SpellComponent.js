/**
 * Componentes relacionados a magias
 */

/**
 * SpellComponent - Representa uma magia no mundo do jogo
 */
export class SpellComponent {
    /**
     * Cria um novo componente de magia
     * @param {Object} data - Dados da magia
     */
    constructor(data = {}) {
      this.spellId = data.spellId || null;        // ID da magia
      this.casterId = data.casterId || null;      // ID da entidade que lançou a magia
      this.targetId = data.targetId || null;      // ID da entidade alvo (se aplicável)
      this.targetPosition = data.targetPosition || null; // Posição alvo para magias de área
      this.element = data.element || null;        // Elemento da magia
      this.damage = data.damage || 0;             // Dano base
      this.radius = data.radius || 0;             // Raio de efeito (para magias de área)
      this.duration = data.duration || 0;         // Duração do efeito
      this.lifetime = data.lifetime || 5;         // Tempo de vida da magia (projéteis, áreas)
      this.speed = data.speed || 0;               // Velocidade (para projéteis)
      this.creationTime = data.creationTime || Date.now(); // Timestamp de criação
      this.effects = data.effects || [];          // Efeitos adicionais
    }
  }
  
  /**
   * SpellCasterComponent - Representa a capacidade de uma entidade lançar magias
   */
  export class SpellCasterComponent {
    /**
     * Cria um novo componente de lançador de magias
     * @param {Object} data - Dados do lançador
     */
    constructor(data = {}) {
      this.knownSpells = data.knownSpells || [];  // Lista de IDs de magias conhecidas
      this.cooldowns = data.cooldowns || {};      // Objeto com cooldowns atuais por magia
      this.castingSpell = data.castingSpell || null; // ID da magia sendo lançada
      this.castingStartTime = data.castingStartTime || 0; // Timestamp de início do lançamento
      this.castingEndTime = data.castingEndTime || 0; // Timestamp previsto de término
      this.castingProgress = data.castingProgress || 0; // Progresso atual (0-1)
      this.castingTarget = data.castingTarget || null; // Alvo do lançamento
      this.castingPosition = data.castingPosition || null; // Posição alvo do lançamento
      this.canCastWhileMoving = data.canCastWhileMoving || false; // Pode lançar enquanto se move
    }
    
    /**
     * Verifica se a magia está em cooldown
     * @param {string} spellId - ID da magia
     * @returns {boolean} True se estiver em cooldown
     */
    isOnCooldown(spellId) {
      return this.cooldowns[spellId] && this.cooldowns[spellId] > Date.now();
    }
    
    /**
     * Obtém o tempo restante de cooldown de uma magia
     * @param {string} spellId - ID da magia
     * @returns {number} Tempo restante em ms, ou 0 se não estiver em cooldown
     */
    getCooldownRemaining(spellId) {
      if (!this.isOnCooldown(spellId)) return 0;
      return this.cooldowns[spellId] - Date.now();
    }
    
    /**
     * Verifica se a entidade está lançando uma magia
     * @returns {boolean} True se estiver lançando uma magia
     */
    isCasting() {
      return this.castingSpell !== null && this.castingEndTime > Date.now();
    }
    
    /**
     * Verifica se a entidade conhece uma determinada magia
     * @param {string} spellId - ID da magia
     * @returns {boolean} True se conhecer a magia
     */
    knowsSpell(spellId) {
      return this.knownSpells.includes(spellId);
    }
  }
  
  /**
   * ManaComponent - Gerencia o recurso de mana de uma entidade
   */
  export class ManaComponent {
    /**
     * Cria um novo componente de mana
     * @param {Object} data - Dados de mana
     */
    constructor(data = {}) {
      this.currentMana = data.currentMana !== undefined ? data.currentMana : 100;
      this.maxMana = data.maxMana || 100;
      this.regeneration = data.regeneration || 5; // Por segundo
      this.lastUsageTime = data.lastUsageTime || 0;
      this.regenDelay = data.regenDelay || 3000; // Atraso para iniciar regeneração após uso
    }
    
    /**
     * Verifica se há mana suficiente
     * @param {number} amount - Quantidade necessária
     * @returns {boolean} True se tiver mana suficiente
     */
    hasSufficientMana(amount) {
      return this.currentMana >= amount;
    }
    
    /**
     * Usa uma quantidade de mana
     * @param {number} amount - Quantidade a ser usada
     * @returns {boolean} True se conseguir usar a mana
     */
    useMana(amount) {
      if (!this.hasSufficientMana(amount)) return false;
      
      this.currentMana -= amount;
      this.lastUsageTime = Date.now();
      return true;
    }
    
    /**
     * Restaura uma quantidade de mana
     * @param {number} amount - Quantidade a ser restaurada
     */
    restoreMana(amount) {
      this.currentMana = Math.min(this.currentMana + amount, this.maxMana);
    }
  }