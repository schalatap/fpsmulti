export const MATERIAL_RESISTANCE = {
    WOOD: 0.3,
    METAL: 0.8,
    CONCRETE: 1.0,
    GLASS: 0.1,
    FLESH: 0.0
};

export const HIT_LOCATION_MULTIPLIERS = {
    HEAD: 2.5,
    TORSO: 1.0,
    LIMB: 0.7
};

export const WEAPON_BALLISTICS = {
    PISTOL: {
        speed: 80,
        lifetime: 2,
        damage: 15,
        penetration: 0.2,
        effectiveRange: 30,
        affectedByGravity: false,
        recoil: { x: 0.5, y: 2.0, time: 0.2 }
    },
    RIFLE: {
        speed: 120,
        lifetime: 3,
        damage: 25,
        penetration: 0.5,
        effectiveRange: 80,
        affectedByGravity: true,
        recoil: { x: 1.0, y: 3.0, time: 0.3 }
    },
    SMG: {
        speed: 100,
        lifetime: 2,
        damage: 18,
        penetration: 0.3,
        effectiveRange: 40,
        affectedByGravity: false,
        recoil: { x: 1.2, y: 2.0, time: 0.15 }
    },
    SNIPER: {
        speed: 200,
        lifetime: 5,
        damage: 80,
        penetration: 0.8,
        effectiveRange: 150,
        affectedByGravity: true,
        recoil: { x: 0.5, y: 5.0, time: 0.5 }
    },
    SHOTGUN: {
        speed: 80,
        lifetime: 1,
        damage: 12, // Per pellet
        penetration: 0.1,
        effectiveRange: 20,
        affectedByGravity: false,
        recoil: { x: 1.5, y: 5.0, time: 0.4 }
    }
};

export const PENETRATION_FACTORS = {
    CONTINUE: 0.7, // Damage multiplier when continuing after penetration
    PENETRATION_REDUCTION: 0.5 // Penetration value reduction after going through material
};