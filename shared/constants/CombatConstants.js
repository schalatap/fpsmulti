// Tipos de dano
const DAMAGE_TYPES = {
    PHYSICAL: 'physical',
    MAGICAL: 'magical',
    FIRE: 'fire',
    ICE: 'ice',
    ELECTRIC: 'electric',
    POISON: 'poison',
    EXPLOSIVE: 'explosive'
};

// Partes do corpo para hit detection
const BODY_PARTS = {
    HEAD: 'head',
    CHEST: 'chest',
    TORSO: 'torso',
    LEGS: 'legs',
    FEET: 'feet'
};

// Tipos de efeitos (buffs/debuffs)
const EFFECT_TYPES = {
    DAMAGE_OVER_TIME: 'dot',
    HEAL_OVER_TIME: 'hot',
    SLOW: 'slow',
    STUN: 'stun',
    INVULNERABILITY: 'invulnerability',
    DAMAGE_AMPLIFICATION: 'damage_amp',
    DAMAGE_RESISTANCE: 'damage_resist',
    SPEED_BOOST: 'speed_boost',
    INVISIBILITY: 'invisibility',
    SILENCE: 'silence', // Impede uso de magias
    DISARM: 'disarm',   // Impede uso de armas
    BLEED: 'bleed',     // Sangramento (DOT físico)
    BURN: 'burn',       // Queimadura (DOT fogo)
    FREEZE: 'freeze',   // Congelamento (slow + DOT gelo)
    SHOCK: 'shock',     // Choque (DOT elétrico + stun curto)
    POISON: 'poison'    // Envenenamento (DOT veneno)
};

// Matriz de vulnerabilidades (multiplicadores de dano)
const DAMAGE_VULNERABILITIES = {
    [EFFECT_TYPES.BURN]: {
        [DAMAGE_TYPES.ICE]: 1.5,    // Queimadura toma mais dano de gelo
        [DAMAGE_TYPES.WATER]: 1.5   // Queimadura toma mais dano de água
    },
    [EFFECT_TYPES.FREEZE]: {
        [DAMAGE_TYPES.FIRE]: 1.5    // Congelamento toma mais dano de fogo
    },
    [EFFECT_TYPES.SHOCK]: {
        [DAMAGE_TYPES.EXPLOSIVE]: 1.25  // Choque toma mais dano de explosão
    }
};

// Matriz de resistências (multiplicadores de dano)
const DAMAGE_RESISTANCES = {
    [EFFECT_TYPES.BURN]: {
        [DAMAGE_TYPES.FIRE]: 0.5    // Queimadura tem resistência a mais fogo
    },
    [EFFECT_TYPES.FREEZE]: {
        [DAMAGE_TYPES.ICE]: 0.5     // Congelamento tem resistência a mais gelo
    },
    [EFFECT_TYPES.POISON]: {
        [DAMAGE_TYPES.POISON]: 0.5  // Envenenamento tem resistência a mais veneno
    }
};

// Configurações de efeitos
const EFFECT_SETTINGS = {
    [EFFECT_TYPES.DAMAGE_OVER_TIME]: {
        stackable: true,             // Se múltiplas instâncias podem existir
        maxStacks: 3,                // Número máximo de stacks
        refreshOnReapply: true,      // Refresca duração ao reaplicar
        tickRate: 1000               // Intervalo (ms) para aplicar dano
    },
    [EFFECT_TYPES.HEAL_OVER_TIME]: {
        stackable: true,
        maxStacks: 2,
        refreshOnReapply: true,
        tickRate: 1000
    },
    [EFFECT_TYPES.STUN]: {
        stackable: false,
        refreshOnReapply: false      // Reaplica apenas se duração maior
    },
    [EFFECT_TYPES.SLOW]: {
        stackable: true,
        maxStacks: 4,
        refreshOnReapply: true
    },
    // Outras configurações para outros efeitos...
};

module.exports = {
    DAMAGE_TYPES,
    BODY_PARTS,
    EFFECT_TYPES,
    DAMAGE_VULNERABILITIES,
    DAMAGE_RESISTANCES,
    EFFECT_SETTINGS
};