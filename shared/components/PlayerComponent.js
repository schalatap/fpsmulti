/**
 * Componente que armazena informações específicas de jogadores
 */
class PlayerComponent {
    /**
     * @param {Object} options - Opções para o componente
     * @param {string} options.id - ID único do jogador
     * @param {string} options.name - Nome do jogador
     * @param {string} options.team - Equipe do jogador
     * @param {boolean} [options.isAlive=true] - Estado de vida do jogador
     * @param {number} [options.respawnTime=0] - Tempo até o respawn
     * @param {number} [options.kills=0] - Número de abates
     * @param {number} [options.deaths=0] - Número de mortes
     * @param {number} [options.score=0] - Pontuação total
     */
    constructor(options = {}) {
      this.id = options.id || "";
      this.name = options.name || "Player";
      this.team = options.team || "spectator";
      this.isAlive = options.isAlive !== undefined ? options.isAlive : true;
      this.respawnTime = options.respawnTime || 0;
      this.kills = options.kills || 0;
      this.deaths = options.deaths || 0;
      this.score = options.score || 0;
    }
  }
  
  module.exports = PlayerComponent;