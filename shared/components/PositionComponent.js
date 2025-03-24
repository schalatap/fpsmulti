/**
 * Componente que armazena informações de posição e rotação de uma entidade
 */
class PositionComponent {
    /**
     * @param {Object} options - Opções para o componente
     * @param {number} [options.x=0] - Coordenada X
     * @param {number} [options.y=0] - Coordenada Y
     * @param {number} [options.z=0] - Coordenada Z
     * @param {number} [options.rotationX=0] - Rotação no eixo X (pitch)
     * @param {number} [options.rotationY=0] - Rotação no eixo Y (yaw)
     * @param {number} [options.rotationZ=0] - Rotação no eixo Z (roll)
     */
    constructor(options = {}) {
      this.x = options.x || 0;
      this.y = options.y || 0;
      this.z = options.z || 0;
      this.rotationX = options.rotationX || 0;
      this.rotationY = options.rotationY || 0;
      this.rotationZ = options.rotationZ || 0;
    }
  }
  
  module.exports = PositionComponent;