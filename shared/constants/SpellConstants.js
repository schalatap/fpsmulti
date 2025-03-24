/**
 * Constantes para o sistema de magias
 */

// Tipos de magia
export const SPELL_TYPES = {
    PROJECTILE: 'projectile',   // Projétil mágico
    AREA: 'area',               // Dano em área
    BUFF: 'buff',               // Efeito positivo 
    DEBUFF: 'debuff',           // Efeito negativo
    UTILITY: 'utility',         // Utilidade (teleporte, etc)
    SUMMON: 'summon'            // Invocação de entidades
  };
  
  // Elementos das magias
  export const SPELL_ELEMENTS = {
    FIRE: 'fire',               // Fogo (dano ao longo do tempo)
    ICE: 'ice',                 // Gelo (redução de movimento)
    LIGHTNING: 'lightning',     // Raio (dano instantâneo)
    EARTH: 'earth',             // Terra (armadura, escudos)
    ARCANE: 'arcane',           // Arcano (efeitos especiais)
    VOID: 'void'                // Vazio (dreno de recursos)
  };
  
  // Definições de magias específicas
  export const SPELLS = {
    FIREBALL: {
      id: 'fireball',
      name: 'Bola de Fogo',
      type: SPELL_TYPES.PROJECTILE,
      element: SPELL_ELEMENTS.FIRE,
      manaCost: 25,
      damage: 30,
      radius: 2,
      speed: 20,
      lifetime: 3,
      cooldown: 4,
      castTime: 0.5,
      effects: [
        { type: 'burn', duration: 3, damagePerTick: 5, tickRate: 1 }
      ],
      description: 'Lança uma bola de fogo que causa dano de área e queimadura.'
    },
    ICE_SPIKE: {
      id: 'ice_spike',
      name: 'Estaca de Gelo',
      type: SPELL_TYPES.PROJECTILE,
      element: SPELL_ELEMENTS.ICE,
      manaCost: 20,
      damage: 25,
      speed: 30,
      lifetime: 2,
      cooldown: 3,
      castTime: 0.3,
      effects: [
        { type: 'slow', duration: 2, slowFactor: 0.5 }
      ],
      description: 'Lança uma estaca de gelo que causa dano e reduz a velocidade do alvo.'
    },
    LIGHTNING_BOLT: {
      id: 'lightning_bolt',
      name: 'Raio',
      type: SPELL_TYPES.PROJECTILE,
      element: SPELL_ELEMENTS.LIGHTNING,
      manaCost: 30,
      damage: 40,
      speed: 100, // Instantâneo
      cooldown: 5,
      castTime: 0.7,
      effects: [],
      description: 'Invoca um raio que causa alto dano instantâneo.'
    },
    ARCANE_SHIELD: {
      id: 'arcane_shield',
      name: 'Escudo Arcano',
      type: SPELL_TYPES.BUFF,
      element: SPELL_ELEMENTS.ARCANE,
      manaCost: 35,
      duration: 10,
      cooldown: 15,
      castTime: 1,
      effects: [
        { type: 'damage_reduction', duration: 10, factor: 0.5 }
      ],
      description: 'Cria um escudo arcano que reduz o dano recebido pela metade.'
    },
    EARTHEN_ARMOR: {
      id: 'earthen_armor',
      name: 'Armadura de Terra',
      type: SPELL_TYPES.BUFF,
      element: SPELL_ELEMENTS.EARTH,
      manaCost: 30,
      duration: 8,
      cooldown: 12,
      castTime: 0.8,
      effects: [
        { type: 'armor_increase', duration: 8, amount: 30 },
        { type: 'movement_penalty', duration: 8, factor: 0.8 }
      ],
      description: 'Cria uma armadura de pedra que reduz o dano físico mas também reduz a mobilidade.'
    },
    VOID_DRAIN: {
      id: 'void_drain',
      name: 'Dreno do Vazio',
      type: SPELL_TYPES.DEBUFF,
      element: SPELL_ELEMENTS.VOID,
      manaCost: 40,
      duration: 5,
      cooldown: 10,
      castTime: 1.2,
      radius: 5,
      effects: [
        { type: 'mana_drain', duration: 5, amountPerTick: 5, tickRate: 1 }
      ],
      description: 'Drena mana dos inimigos em uma área ao redor do conjurador.'
    },
    TELEPORT: {
      id: 'teleport',
      name: 'Teleporte',
      type: SPELL_TYPES.UTILITY,
      element: SPELL_ELEMENTS.ARCANE,
      manaCost: 50,
      cooldown: 20,
      castTime: 0.3,
      maxDistance: 20,
      description: 'Teleporta instantaneamente para o ponto visado, dentro de um alcance máximo.'
    },
    FIRE_WALL: {
      id: 'fire_wall',
      name: 'Parede de Fogo',
      type: SPELL_TYPES.AREA,
      element: SPELL_ELEMENTS.FIRE,
      manaCost: 45,
      damage: 10, // Dano por segundo
      duration: 6,
      width: 5,
      height: 3,
      cooldown: 12,
      castTime: 1,
      effects: [
        { type: 'burn', duration: 3, damagePerTick: 5, tickRate: 1 }
      ],
      description: 'Cria uma parede de fogo que causa dano e queimadura a quem passar por ela.'
    },
    SUMMON_GOLEM: {
      id: 'summon_golem',
      name: 'Invocar Golem',
      type: SPELL_TYPES.SUMMON,
      element: SPELL_ELEMENTS.EARTH,
      manaCost: 60,
      health: 100,
      damage: 15,
      duration: 15,
      cooldown: 25,
      castTime: 2,
      description: 'Invoca um golem de pedra que ataca inimigos próximos.'
    }
  };
  
  // Efeitos de status que as magias podem aplicar
  export const SPELL_EFFECTS = {
    BURN: {
      id: 'burn',
      name: 'Queimadura',
      type: 'damage_over_time',
      element: SPELL_ELEMENTS.FIRE,
      stackable: true,
      maxStacks: 3
    },
    SLOW: {
      id: 'slow',
      name: 'Lentidão',
      type: 'movement_impair',
      element: SPELL_ELEMENTS.ICE,
      stackable: false
    },
    STUN: {
      id: 'stun',
      name: 'Atordoamento',
      type: 'control_impair',
      element: SPELL_ELEMENTS.LIGHTNING,
      stackable: false
    },
    ARMOR_INCREASE: {
      id: 'armor_increase',
      name: 'Armadura Aumentada',
      type: 'defensive_buff',
      element: SPELL_ELEMENTS.EARTH,
      stackable: false
    },
    DAMAGE_REDUCTION: {
      id: 'damage_reduction',
      name: 'Redução de Dano',
      type: 'defensive_buff',
      element: SPELL_ELEMENTS.ARCANE,
      stackable: false
    },
    MANA_DRAIN: {
      id: 'mana_drain',
      name: 'Dreno de Mana',
      type: 'resource_drain',
      element: SPELL_ELEMENTS.VOID,
      stackable: false
    },
    SPEED_BOOST: {
      id: 'speed_boost',
      name: 'Aumento de Velocidade',
      type: 'movement_buff',
      element: SPELL_ELEMENTS.LIGHTNING,
      stackable: false
    }
  };
  
  // Definições visuais para efeitos de magia
  export const SPELL_VISUALS = {
    FIREBALL: {
      color: 0xff4400,
      particleCount: 30,
      coreSize: 0.5,
      glowIntensity: 1.5,
      trailLength: 2
    },
    ICE_SPIKE: {
      color: 0x88ccff,
      particleCount: 15,
      coreSize: 0.4,
      glowIntensity: 1.0,
      trailLength: 1
    },
    LIGHTNING_BOLT: {
      color: 0xffff00,
      segmentCount: 5,
      thickness: 0.2,
      branchChance: 0.3,
      branchFactor: 0.5
    },
    ARCANE_SHIELD: {
      color: 0xaa44ff,
      opacity: 0.6,
      pulseRate: 1.5,
      particleCount: 50
    },
    EARTHEN_ARMOR: {
      color: 0x885522,
      chunks: 8,
      floatFactor: 0.1,
      rotationSpeed: 0.5
    },
    VOID_DRAIN: {
      color: 0x440044,
      particleCount: 60,
      particleSize: 0.2,
      spiralFactor: 2
    },
    TELEPORT: {
      color: 0x22ffff,
      burstCount: 20,
      fadeTime: 0.5
    },
    FIRE_WALL: {
      color: 0xff2200,
      particleCount: 100,
      particleSize: 0.3,
      riseSpeed: 1
    }
  };
  
  // Ajustes de equilíbrio para magias
  export const SPELL_BALANCE = {
    // Fatores que afetam todas as magias
    GLOBAL_DAMAGE_MULTIPLIER: 1.0,
    GLOBAL_COOLDOWN_MULTIPLIER: 1.0,
    GLOBAL_MANA_COST_MULTIPLIER: 1.0,
    
    // Fatores por tipo de magia
    TYPE_MODIFIERS: {
      [SPELL_TYPES.PROJECTILE]: {
        damageModifier: 1.0,
        cooldownModifier: 1.0,
        manaCostModifier: 1.0
      },
      [SPELL_TYPES.AREA]: {
        damageModifier: 0.8,  // Dano reduzido pois afeta múltiplos alvos
        cooldownModifier: 1.2, // Cooldown aumentado pelo poder
        manaCostModifier: 1.2  // Custo aumentado pelo poder
      }
      // Outros tipos...
    },
    
    // Fatores por elemento 
    ELEMENT_MODIFIERS: {
      [SPELL_ELEMENTS.FIRE]: {
        damageModifier: 1.1,  // Fogo causa mais dano
        cooldownModifier: 1.0,
        manaCostModifier: 1.0
      },
      [SPELL_ELEMENTS.ICE]: {
        damageModifier: 0.9,  // Gelo causa menos dano mas tem efeitos de controle
        cooldownModifier: 0.9, // Cooldown menor
        manaCostModifier: 0.9  // Custo menor
      }
      // Outros elementos...
    }
  };