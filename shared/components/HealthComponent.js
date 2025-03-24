/**
 * Componente que armazena informações de saúde de uma entidade
 */
class HealthComponent {
    /**
     * @param {Object} options - Opções para o componente
     * @param {number} [options.currentHealth=100] - Saúde atual
     * @param {number} [options.maxHealth=100] - Saúde máxima
     * @param {number} [options.lastDamageTime=0] - Timestamp do último dano recebido
     * @param {number} [options.regeneration=0] - Taxa de regeneração por segundo
     */
    constructor(options = {}) {
      this.currentHealth = options.currentHealth !== undefined ? options.currentHealth : 100;
      this.maxHealth = options.maxHealth || 100;
      this.lastDamageTime = options.lastDamageTime || 0;
      this.regeneration = options.regeneration || 0;
    }
  }
  
  module.exports = HealthComponent;