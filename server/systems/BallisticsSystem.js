// server/systems/BallisticsSystem.js
import { EventEmitter } from '../../shared/utils/EventEmitter.js';
import { WEAPON_BALLISTICS, MATERIAL_RESISTANCE, HIT_LOCATION_MULTIPLIERS, PENETRATION_FACTORS } from '../../shared/constants/BallisticsConstants.js';

// Importação assíncrona do Ammo.js
let Ammo;
const initializeAmmo = async () => {
  Ammo = await import('ammo.js');
  return Ammo();  // Ammo.js retorna uma promessa que resolve para o módulo
};

export class BallisticsSystem {
    constructor(world, physicsSystem, networkSystem) {
        this.world = world;
        this.physicsSystem = physicsSystem;
        this.networkSystem = networkSystem;
        this.projectiles = new Map();
        this.events = new EventEmitter(); // Usando EventEmitter ao invés de EventSystem
        
        // Bind event listeners
        this.events.subscribe('player:shoot', this.handlePlayerShoot.bind(this));
    }
    
    async initialize() { // Tornar método async
        this.ammo = await initializeAmmo();
        console.log('Initializing server BallisticsSystem...');
    }
    
    update(deltaTime) {
        // Update all active projectiles
        for (const [projectileId, projectile] of this.projectiles.entries()) {
            // Check if projectile lifetime has expired
            if (Date.now() - projectile.creationTime > projectile.lifetime * 1000) {
                this.removeProjectile(projectileId);
                continue;
            }
            
            // Update projectile position based on velocity and time
            projectile.position.x += projectile.velocity.x * deltaTime;
            projectile.position.y += projectile.velocity.y * deltaTime;
            projectile.position.z += projectile.velocity.z * deltaTime;
            
            // Apply gravity if needed
            if (this.isAffectedByGravity(projectile.weaponType)) {
                projectile.velocity.y -= 9.8 * deltaTime;
            }
            
            // Perform raycast to check for collisions
            const origin = new this.ammo.btVector3(
                projectile.previousPosition.x, 
                projectile.previousPosition.y, 
                projectile.previousPosition.z
            );
            const target = new this.ammo.btVector3(
                projectile.position.x,
                projectile.position.y,
                projectile.position.z
            );
            
            const hitResult = this.physicsSystem.raycast(origin, target);
            if (hitResult.hit) {
                this.handleProjectileHit(projectileId, hitResult);
            } else {
                // Store current position as previous for next frame
                projectile.previousPosition = { ...projectile.position };
            }
        }
    }
    
    fireProjectile(playerId, weaponType, origin, direction, initialVelocity = null) {
        const projectileId = `projectile_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const speed = this.getProjectileSpeed(weaponType);
        
        // Create velocity if not provided
        const velocity = initialVelocity || {
            x: direction.x * speed,
            y: direction.y * speed,
            z: direction.z * speed
        };
        
        // Create projectile data
        const projectile = {
            id: projectileId,
            shooterId: playerId,
            weaponType,
            position: { ...origin },
            previousPosition: { ...origin },
            velocity,
            direction: {
                x: direction.x,
                y: direction.y,
                z: direction.z
            },
            creationTime: Date.now(),
            lifetime: this.getProjectileLifetime(weaponType),
            damage: this.getProjectileDamage(weaponType),
            penetration: this.getProjectilePenetration(weaponType)
        };
        
        // Store projectile
        this.projectiles.set(projectileId, projectile);
        
        // Calculate trajectory
        const trajectory = this.calculateTrajectory(projectile);
        
        // Broadcast projectile creation to clients
        this.networkSystem.broadcastToAll('projectile:create', {
            id: projectileId,
            shooterId: playerId,
            origin,
            direction,
            weaponType,
            velocity
        });
        
        return projectileId;
    }
    
    calculateTrajectory(projectileData) {
        const trajectoryPoints = [];
        const gravity = { x: 0, y: -9.8, z: 0 };
        const position = { ...projectileData.position };
        const velocity = { ...projectileData.velocity };
        const timeStep = 1/60; // Simulate at 60fps
        let time = 0;
        
        // Simulate up to the projectile's maximum lifetime
        while (time < projectileData.lifetime) {
            // Store current position
            trajectoryPoints.push({ ...position });
            
            // Apply gravity (if weapon is affected by gravity)
            if (this.isAffectedByGravity(projectileData.weaponType)) {
                velocity.y += gravity.y * timeStep;
            }
            
            // Update position based on velocity
            position.x += velocity.x * timeStep;
            position.y += velocity.y * timeStep;
            position.z += velocity.z * timeStep;
            
            // Increment time
            time += timeStep;
            
            // Check for potential collisions using simplified raycast
            const origin = new this.ammo.btVector3(
                position.x - velocity.x * timeStep,
                position.y - velocity.y * timeStep,
                position.z - velocity.z * timeStep
            );
            const target = new this.ammo.btVector3(position.x, position.y, position.z);
            
            const hitResult = this.physicsSystem.raycast(origin, target);
            if (hitResult.hit) {
                // Add final hit position and break
                trajectoryPoints.push({
                    x: hitResult.position.x,
                    y: hitResult.position.y,
                    z: hitResult.position.z
                });
                break;
            }
        }
        
        return trajectoryPoints;
    }
    
    calculateDamage(projectile, hitInfo) {
        // Base damage from projectile
        let damage = projectile.damage;
        
        // Distance falloff
        const distanceTraveled = this.calculateDistance(
            projectile.position,
            projectile.previousPosition
        );
        const maxEffectiveRange = this.getMaxEffectiveRange(projectile.weaponType);
        const distanceFactor = Math.max(0, 1 - (distanceTraveled / maxEffectiveRange));
        damage *= distanceFactor;
        
        // Hit location multiplier (headshot, etc.)
        if (hitInfo.hitLocation === 'head') {
            damage *= HIT_LOCATION_MULTIPLIERS.HEAD;
        } else if (hitInfo.hitLocation === 'limb') {
            damage *= HIT_LOCATION_MULTIPLIERS.LIMB;
        }
        
        // Material penetration
        if (hitInfo.material) {
            const penetrationFactor = Math.min(1, projectile.penetration / hitInfo.material.resistance);
            damage *= penetrationFactor;
        }
        
        return Math.max(1, Math.round(damage));
    }
    
    calculateRecoil(weaponType) {
        // Get base recoil pattern for weapon
        const baseRecoil = this.getBaseRecoil(weaponType);
        
        // Add some randomness
        const randomFactor = 0.2; // 20% randomness
        const randomX = (Math.random() * 2 - 1) * randomFactor * baseRecoil.x;
        const randomY = Math.random() * randomFactor * baseRecoil.y;
        
        return {
            x: baseRecoil.x + randomX,
            y: baseRecoil.y + randomY,
            time: baseRecoil.time
        };
    }
    
    handlePlayerShoot(data) {
        const { playerId, weaponId, position, direction, timestamp } = data;
        
        // Validate the shot (check weapon cooldown, ammo, etc.)
        const playerEntity = this.world.getEntityByPlayerId(playerId);
        if (!playerEntity) return;
        
        // Get weapon component
        const weaponComponent = this.world.getComponent(weaponId, 'WeaponComponent');
        if (!weaponComponent) return;
        
        // Check if player is alive
        const healthComponent = this.world.getComponent(playerEntity, 'HealthComponent');
        if (!healthComponent || healthComponent.currentHealth <= 0) return;
        
        // Fire projectile
        this.fireProjectile(playerId, weaponComponent.weaponType, position, direction);
    }
    
    handleProjectileHit(projectileId, hitResult) {
        const projectile = this.projectiles.get(projectileId);
        if (!projectile) return;
        
        // Calculate damage based on hit information
        const damage = this.calculateDamage(projectile, hitResult);
        
        // Emit projectile hit event
        this.events.emit('projectile:hit', {
            projectileId,
            shooterId: projectile.shooterId,
            targetId: hitResult.entityId,
            position: hitResult.position,
            normal: hitResult.normal,
            damage,
            weaponType: projectile.weaponType
        });
        
        // Broadcast hit to clients
        this.networkSystem.broadcastToAll('projectile:hit', {
            projectileId,
            position: hitResult.position,
            normal: hitResult.normal,
            targetId: hitResult.entityId
        });
        
        // Apply damage if target is a player or destructible object
        if (hitResult.entityId) {
            const entity = this.world.getEntity(hitResult.entityId);
            const healthComponent = entity ? this.world.getComponent(entity, 'HealthComponent') : null;
            
            if (healthComponent) {
                // Apply damage to entity
                this.events.emit('player:damage', {
                    playerId: hitResult.entityId,
                    damage,
                    attackerId: projectile.shooterId,
                    weaponType: projectile.weaponType,
                    hitLocation: hitResult.hitLocation
                });
            }
        }
        
        // Handle penetration
        if (this.canPenetrate(projectile, hitResult)) {
            // Reduce damage and penetration values for the continuing projectile
            projectile.damage *= PENETRATION_FACTORS.CONTINUE;
            projectile.penetration *= PENETRATION_FACTORS.PENETRATION_REDUCTION;
            
            // Adjust position slightly beyond the hit point
            const penetrationDistance = 0.1;
            projectile.position = {
                x: hitResult.position.x + projectile.direction.x * penetrationDistance,
                y: hitResult.position.y + projectile.direction.y * penetrationDistance,
                z: hitResult.position.z + projectile.direction.z * penetrationDistance
            };
            projectile.previousPosition = { ...hitResult.position };
            
            // Adjust velocity (slow down after penetration)
            const slowdownFactor = 0.8;
            projectile.velocity.x *= slowdownFactor;
            projectile.velocity.y *= slowdownFactor;
            projectile.velocity.z *= slowdownFactor;
        } else {
            // Remove projectile if it cannot penetrate
            this.removeProjectile(projectileId);
        }
    }
    
    canPenetrate(projectile, hitResult) {
        // Check if projectile has enough penetration power left
        if (projectile.penetration < 0.1) return false;
        
        // Check if material can be penetrated
        const materialResistance = hitResult.material ? hitResult.material.resistance : 1.0;
        return projectile.penetration > materialResistance;
    }
    
    removeProjectile(projectileId) {
        // Remove from projectiles map
        this.projectiles.delete(projectileId);
        
        // Broadcast removal to clients
        this.networkSystem.broadcastToAll('projectile:remove', {
            projectileId
        });
    }
    
    // Helper methods to get projectile parameters based on weapon type
    getProjectileSpeed(weaponType) {
        return WEAPON_BALLISTICS[weaponType.toUpperCase()]?.speed || 100;
    }
    
    getProjectileLifetime(weaponType) {
        return WEAPON_BALLISTICS[weaponType.toUpperCase()]?.lifetime || 3;
    }
    
    getProjectileDamage(weaponType) {
        return WEAPON_BALLISTICS[weaponType.toUpperCase()]?.damage || 20;
    }
    
    getProjectilePenetration(weaponType) {
        return WEAPON_BALLISTICS[weaponType.toUpperCase()]?.penetration || 0.3;
    }
    
    getMaxEffectiveRange(weaponType) {
        return WEAPON_BALLISTICS[weaponType.toUpperCase()]?.effectiveRange || 50;
    }
    
    isAffectedByGravity(weaponType) {
        return WEAPON_BALLISTICS[weaponType.toUpperCase()]?.affectedByGravity || false;
    }
    
    getBaseRecoil(weaponType) {
        return WEAPON_BALLISTICS[weaponType.toUpperCase()]?.recoil || { x: 1.0, y: 2.0, time: 0.3 };
    }
    
    calculateDistance(point1, point2) {
        return Math.sqrt(
            Math.pow(point2.x - point1.x, 2) +
            Math.pow(point2.y - point1.y, 2) +
            Math.pow(point2.z - point1.z, 2)
        );
    }
    
    dispose() {
        // Clean up resources
        this.projectiles.clear();
        
        // Unsubscribe from events
        this.events.unsubscribe('player:shoot', this.handlePlayerShoot);
    }
}