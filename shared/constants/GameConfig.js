/**
 * Configurações e constantes para o jogo
 */
const GameConfig = {
    // Configurações de partida
    MATCH_TIME: 600, // Duração da partida em segundos (10 minutos)
    SCORE_LIMIT: 30, // Pontuação para vencer a partida
    MIN_PLAYERS: 2, // Mínimo de jogadores para iniciar uma partida
    MAX_PLAYERS: 16, // Máximo de jogadores por partida
    MATCH_START_COUNTDOWN: 5, // Contagem regressiva antes de iniciar a partida
    MATCH_RESTART_DELAY: 10, // Tempo de espera após o fim da partida para reiniciar
    
    // Configurações de jogador
    RESPAWN_TIME: 5, // Tempo de respawn em segundos
    INITIAL_HEALTH: 100, // Saúde inicial
    WALK_SPEED: 5, // Velocidade de caminhada em unidades/segundo
    RUN_SPEED: 8, // Velocidade de corrida em unidades/segundo
    JUMP_FORCE: 8, // Força do pulo
    
    // Pontuação
    KILL_SCORE: 100, // Pontos por abate
    HEADSHOT_BONUS: 50, // Bônus por headshot
    ASSIST_SCORE: 25, // Pontos por assistência
    TEAM_OBJECTIVE_SCORE: 200, // Pontos por completar objetivo da equipe
    
    // Dano
    FALL_DAMAGE_THRESHOLD: 10, // Altura mínima para tomar dano de queda
    FALL_DAMAGE_FACTOR: 5, // Multiplicador de dano por queda
    
    // Equipes
    TEAM_COLORS: {
      blue: '#0066ff',
      red: '#ff3333',
      spectator: '#aaaaaa'
    }
  };
  
  module.exports = GameConfig;