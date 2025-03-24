// shared/constants/WeaponConstants.js

// Tipos de armas disponíveis
const WEAPON_TYPES = {
    PISTOL: 'pistol',
    RIFLE: 'rifle',
    SHOTGUN: 'shotgun',
    SNIPER: 'sniper'
  };
  
  // Propriedades padrão das armas por tipo
  const WEAPON_DEFAULTS = {
    [WEAPON_TYPES.PISTOL]: {
      damage: 20,
      fireRate: 2,
      reloadTime: 1.5,
      accuracy: 0.9,
      recoil: 0.2,
      maxAmmo: 12,
      reserveAmmo: 36,
      range: 50
    },
    [WEAPON_TYPES.RIFLE]: {
      damage: 30,
      fireRate: 8,
      reloadTime: 2.5,
      accuracy: 0.8,
      recoil: 0.4,
      maxAmmo: 30,
      reserveAmmo: 90,
      range: 100
    },
    [WEAPON_TYPES.SHOTGUN]: {
      damage: 80,
      fireRate: 1,
      reloadTime: 3,
      accuracy: 0.7,
      recoil: 0.8,
      maxAmmo: 8,
      reserveAmmo: 24,
      range: 30
    },
    [WEAPON_TYPES.SNIPER]: {
      damage: 100,
      fireRate: 0.5,
      reloadTime: 3.5,
      accuracy: 0.98,
      recoil: 0.6,
      maxAmmo: 5,
      reserveAmmo: 15,
      range: 200
    }
  };
  
  // Exportar constantes
  module.exports = {
    WEAPON_TYPES,
    WEAPON_DEFAULTS
  };