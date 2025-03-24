import * as THREE from 'three';
import { EventSystem } from '../../shared/utils/EventSystem';
import { WEAPON_BALLISTICS, HIT_LOCATION_MULTIPLIERS } from '../../shared/constants/BallisticsConstants';

export class BallisticsSystem {
    constructor(world, renderSystem, physicsSystem) {
        this.world = world;
        this.renderSystem = renderSystem;
        this.physicsSystem = physicsSystem;
        this.projectiles = new Map();
        this.events = EventSystem.getInstance();
        
        // Bind event listeners
        this.events.subscribe('player:shoot', this.handlePlayerShoot.bind(this));
    }
    
    initialize() {
        console.log('Initializing BallisticsSystem...');
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
            const origin = new THREE.Vector3(
                projectile.previousPosition.x, 
                projectile.previousPosition.y, 
                projectile.previousPosition.z
            );
            const direction = new THREE.Vector3(
                projectile.position.x - projectile.previousPosition.x,
                projectile.position.y - projectile.previousPosition.y,
                projectile.position.z - projectile.previousPosition.z
            ).normalize();
            const distance = projectile.position.distanceTo(projectile.previousPosition);
            
            const hitResult = this.physicsSystem.raycast(origin, direction, distance);
            if (hitResult.hit) {
                this.handleProjectileHit(projectileId, hitResult);
            } else {
                // Update visual representation
                if (projectile.mesh) {
                    projectile.mesh.position.copy(projectile.position);
                }
                
                // Store current position as previous for next frame
                projectile.previousPosition.copy(projectile.position);
            }
        }
    }
    
    fireProjectile(weaponType, origin, direction, initialVelocity) {
        const projectileId = `projectile_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const speed = this.getProjectileSpeed(weaponType);
        
        // Create projectile data
        const projectile = {
            id: projectileId,
            weaponType,
            position: new THREE.Vector3(origin.x, origin.y, origin.z),
            previousPosition: new THREE.Vector3(origin.x, origin.y, origin.z),
            velocity: new THREE.Vector3(
                direction.x * speed,
                direction.y * speed,
                direction.z * speed
            ),
            direction: new THREE.Vector3(direction.x, direction.y, direction.z).normalize(),
            creationTime: Date.now(),
            lifetime: this.getProjectileLifetime(weaponType),
            damage: this.getProjectileDamage(weaponType),
            penetration: this.getProjectilePenetration(weaponType)
        };
        
        // Create visual representation
        projectile.mesh = this.createProjectileMesh(weaponType);
        projectile.mesh.position.copy(projectile.position);
        this.renderSystem.scene.add(projectile.mesh);
        
        // Store projectile
        this.projectiles.set(projectileId, projectile);
        
        // Calculate full trajectory for prediction
        this.calculateTrajectory(projectile);
        
        return projectileId;
    }
    
    calculateTrajectory(projectileData) {
        const trajectoryPoints = [];
        const gravity = new THREE.Vector3(0, -9.8, 0);
        const position = new THREE.Vector3().copy(projectileData.position);
        const velocity = new THREE.Vector3().copy(projectileData.velocity);
        const timeStep = 1/60; // Simulate at 60fps
        let time = 0;
        
        // Simulate up to the projectile's maximum lifetime
        while (time < projectileData.lifetime) {
            // Store current position
            trajectoryPoints.push(new THREE.Vector3().copy(position));
            
            // Apply gravity (if weapon is affected by gravity)
            if (this.isAffectedByGravity(projectileData.weaponType)) {
                velocity.add(gravity.clone().multiplyScalar(timeStep));
            }
            
            // Update position based on velocity
            position.add(velocity.clone().multiplyScalar(timeStep));
            
            // Increment time
            time += timeStep;
        }
        
        return trajectoryPoints;
    }
    
    calculateDamage(projectile, hitInfo) {
        // Base damage from projectile
        let damage = projectile.damage;
        
        // Distance falloff
        const distanceTraveled = projectile.position.distanceTo(projectile.previousPosition);
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
        
        // Create origin and direction vectors
        const origin = new THREE.Vector3(position.x, position.y, position.z);
        const dir = new THREE.Vector3(direction.x, direction.y, direction.z).normalize();
        
        // Get weapon type from provided weaponId
        const weaponType = this.world.getComponent(weaponId, 'WeaponComponent').weaponType;
        
        // Fire projectile
        this.fireProjectile(weaponType, origin, dir);
    }
    
    handleProjectileHit(projectileId, hitResult) {
        const projectile = this.projectiles.get(projectileId);
        if (!projectile) return;
        
        // Calculate final hit position
        const hitPosition = new THREE.Vector3().copy(projectile.previousPosition)
            .add(projectile.direction.clone().multiplyScalar(hitResult.distance));
        
        // Calculate damage based on hit information
        const damage = this.calculateDamage(projectile, hitResult);
        
        // Emit projectile hit event
        this.events.emit('projectile:hit', {
            projectileId,
            targetId: hitResult.entityId,
            position: {
                x: hitPosition.x,
                y: hitPosition.y,
                z: hitPosition.z
            },
            normal: hitResult.normal,
            damage
        });
        
        // Create hit effect
        this.createHitEffect(hitPosition, hitResult.normal, projectile.weaponType);
        
        // Remove projectile
        this.removeProjectile(projectileId);
    }
    
    removeProjectile(projectileId) {
        const projectile = this.projectiles.get(projectileId);
        if (projectile) {
            // Remove visual representation
            if (projectile.mesh) {
                this.renderSystem.scene.remove(projectile.mesh);
                if (projectile.mesh.geometry) projectile.mesh.geometry.dispose();
                if (projectile.mesh.material) projectile.mesh.material.dispose();
            }
            
            // Remove from projectiles map
            this.projectiles.delete(projectileId);
        }
    }
    
    createProjectileMesh(weaponType) {
        let geometry, material;
        
        // Create different projectile visuals based on weapon type
        switch (weaponType) {
            case 'pistol':
            case 'rifle':
            case 'smg':
                geometry = new THREE.SphereGeometry(0.05, 8, 8);
                material = new THREE.MeshBasicMaterial({ color: 0xffff00 });
                break;
            case 'sniper':
                geometry = new THREE.SphereGeometry(0.08, 8, 8);
                material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
                break;
            case 'shotgun':
                geometry = new THREE.SphereGeometry(0.03, 8, 8);
                material = new THREE.MeshBasicMaterial({ color: 0xffa500 });
                break;
            default:
                geometry = new THREE.SphereGeometry(0.05, 8, 8);
                material = new THREE.MeshBasicMaterial({ color: 0xffffff });
        }
        
        return new THREE.Mesh(geometry, material);
    }
    
    createHitEffect(position, normal, weaponType) {
        // Create a simple hit effect - particle system or decal
        const hitMark = new THREE.Mesh(
            new THREE.PlaneGeometry(0.2, 0.2),
            new THREE.MeshBasicMaterial({ 
                color: 0xff0000, 
                transparent: true, 
                opacity: 0.8,
                side: THREE.DoubleSide
            })
        );
        
        // Orient hit mark along surface normal
        if (normal) {
            hitMark.lookAt(
                position.x + normal.x,
                position.y + normal.y,
                position.z + normal.z
            );
        }
        
        // Position slightly above surface to prevent z-fighting
        hitMark.position.copy(position);
        hitMark.position.x += normal.x * 0.01;
        hitMark.position.y += normal.y * 0.01;
        hitMark.position.z += normal.z * 0.01;
        
        // Add to scene
        this.renderSystem.scene.add(hitMark);
        
        // Remove after delay
        setTimeout(() => {
            this.renderSystem.scene.remove(hitMark);
            hitMark.geometry.dispose();
            hitMark.material.dispose();
        }, 1000);
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
    
    dispose() {
        // Clean up resources
        for (const [projectileId, _] of this.projectiles.entries()) {
            this.removeProjectile(projectileId);
        }
        
        // Unsubscribe from events
        this.events.unsubscribe('player:shoot', this.handlePlayerShoot);
    }
}