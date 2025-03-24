/**
 * Componente que armazena propriedades físicas de uma entidade
 */
class PhysicsComponent {
    /**
     * @param {Object} options - Opções para o componente
     * @param {number} [options.mass=1] - Massa da entidade
     * @param {number} [options.friction=0.5] - Coeficiente de fricção
     * @param {number} [options.restitution=0.2] - Coeficiente de restituição (quicar)
     * @param {number} [options.linearDamping=0.1] - Amortecimento linear
     * @param {number} [options.angularDamping=0.1] - Amortecimento angular
     * @param {number} [options.collisionGroup=1] - Grupo de colisão
     * @param {number} [options.collisionMask=-1] - Máscara de colisão
     */
    constructor(options = {}) {
      this.mass = options.mass || 1;
      this.friction = options.friction !== undefined ? options.friction : 0.5;
      this.restitution = options.restitution !== undefined ? options.restitution : 0.2;
      this.linearDamping = options.linearDamping !== undefined ? options.linearDamping : 0.1;
      this.angularDamping = options.angularDamping !== undefined ? options.angularDamping : 0.1;
      this.collisionGroup = options.collisionGroup || 1;
      this.collisionMask = options.collisionMask !== undefined ? options.collisionMask : -1; // -1 = colide com tudo
    }
  }
  
  module.exports = PhysicsComponent;