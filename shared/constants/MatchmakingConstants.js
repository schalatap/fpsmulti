/**
 * Constantes para o sistema de matchmaking
 * @module constants/MatchmakingConstants
 */

/**
 * Estados possíveis para uma sala de matchmaking
 * @enum {string}
 */
export const MATCHMAKING_ROOM_STATES = {
    WAITING: 'waiting',   // Aguardando jogadores
    STARTING: 'starting', // Contagem regressiva para início
    ACTIVE: 'active',     // Partida em andamento
    ENDING: 'ending'      // Partida finalizando
  };
  
  /**
   * Tipos de partida disponíveis
   * @enum {string}
   */
  export const MATCH_TYPES = {
    CASUAL: 'casual',         // Partida casual
    COMPETITIVE: 'competitive',  // Partida competitiva
    CUSTOM: 'custom'          // Partida personalizada
  };
  
  /**
   * Modos de jogo disponíveis
   * @enum {string}
   */
  export const GAME_MODES = {
    DEATHMATCH: 'deathmatch',           // Todos contra todos
    TEAM_DEATHMATCH: 'team_deathmatch', // Equipe contra equipe
    CAPTURE_FLAG: 'capture_flag',       // Capturar a bandeira
    DOMINATION: 'domination'            // Dominação de pontos
  };
  
  /**
   * Configurações de matchmaking para diferentes modos de jogo
   * @const {Object}
   */
  export const MATCHMAKING_CONFIG = {
    [GAME_MODES.DEATHMATCH]: {
      minPlayers: 4,
      maxPlayers: 12,
      teamSize: 1,
      scoreLimit: 50,
      timeLimit: 600, // 10 minutos
      startCountdown: 20,
      endingTime: 10
    },
    [GAME_MODES.TEAM_DEATHMATCH]: {
      minPlayers: 4,
      maxPlayers: 16,
      teamSize: 8,
      scoreLimit: 100,
      timeLimit: 900, // 15 minutos
      startCountdown: 30,
      endingTime: 10
    },
    [GAME_MODES.CAPTURE_FLAG]: {
      minPlayers: 6,
      maxPlayers: 16,
      teamSize: 8,
      scoreLimit: 5,
      timeLimit: 1200, // 20 minutos
      startCountdown: 30,
      endingTime: 10
    },
    [GAME_MODES.DOMINATION]: {
      minPlayers: 6,
      maxPlayers: 16,
      teamSize: 8,
      scoreLimit: 200,
      timeLimit: 1200, // 20 minutos
      startCountdown: 30,
      endingTime: 10
    }
  };
  
  /**
   * Configurações de balanceamento de equipes
   * @const {Object}
   */
  export const TEAM_BALANCING = {
    skillWeight: 0.7,      // Peso da habilidade para balanceamento
    levelWeight: 0.3,      // Peso do nível para balanceamento
    maxSkillDifference: 300, // Diferença máxima de habilidade entre equipes
    forceBalanceThreshold: 0.2 // Limiar para forçar o rebalanceamento (20% de diferença)
  };
  
  /**
   * Constantes para sistemas de classificação (ranking)
   * @const {Object}
   */
  export const RANKING_CONSTANTS = {
    initialRating: 1000,    // Classificação inicial
    kFactor: 32,            // Fator K para ajustes de ELO
    minRatingChange: 1,     // Mudança mínima de classificação
    maxRatingChange: 50,    // Mudança máxima de classificação
    inactivityPeriod: 604800000, // 7 dias em ms
    inactivityPenalty: 5,   // Penalidade por inatividade (pontos por dia)
    placementMatches: 10,   // Número de partidas de colocação
    seasonDuration: 7776000000 // 90 dias em ms
  };
  
  /**
   * Limites de espera para matchmaking
   * @const {Object}
   */
  export const QUEUE_TIMEOUTS = {
    initialSearchRange: 100,    // Intervalo inicial de busca (pontos de habilidade)
    expandSearchAfter: 30000,   // Expandir busca após 30 segundos (ms)
    expandSearchStep: 50,       // Incremento do intervalo de busca
    maxSearchRange: 500,        // Intervalo máximo de busca
    maxWaitTime: 300000,        // Tempo máximo de espera (5 minutos)
    backfillTimeout: 60000      // Tempo máximo para preenchimento automático (1 minuto)
  };
  
  /**
   * Penalidades para abandono de partidas
   * @const {Object}
   */
  export const ABANDONMENT_PENALTIES = {
    casual: {
      timeout: 300000, // 5 minutos
      ratingPenalty: 0
    },
    competitive: {
      firstOffense: {
        timeout: 900000, // 15 minutos
        ratingPenalty: 50
      },
      secondOffense: {
        timeout: 3600000, // 1 hora
        ratingPenalty: 100
      },
      thirdOffense: {
        timeout: 86400000, // 24 horas
        ratingPenalty: 150
      },
      resetAfter: 604800000 // 7 dias
    }
  };
  
  /**
   * Tempos de espera para reconexão
   * @const {Object}
   */
  export const RECONNECT_TIMEOUTS = {
    casual: 120000,      // 2 minutos
    competitive: 180000  // 3 minutos
  };
  
  /**
   * Mapeamento de mapas por modo de jogo
   * @const {Object}
   */
  export const MAPS_BY_GAMEMODE = {
    [GAME_MODES.DEATHMATCH]: ['arena', 'temple', 'ruins', 'tower'],
    [GAME_MODES.TEAM_DEATHMATCH]: ['castle', 'forest', 'city', 'dungeon'],
    [GAME_MODES.CAPTURE_FLAG]: ['valley', 'fortress', 'canyon', 'village'],
    [GAME_MODES.DOMINATION]: ['nexus', 'academy', 'sanctuary', 'harbor']
  };
  
  /**
   * Definições de equipes
   * @const {Object}
   */
  export const TEAMS = {
    RED: {
      id: 'red',
      color: '#ff4444',
      name: 'Fire Mages'
    },
    BLUE: {
      id: 'blue',
      color: '#4444ff',
      name: 'Water Wizards'
    },
    GREEN: {
      id: 'green',
      color: '#44ff44',
      name: 'Earth Druids'
    },
    PURPLE: {
      id: 'purple',
      color: '#aa44ff',
      name: 'Storm Sorcerers'
    }
  };