// server/systems/PhysicsSystem.js 
const Ammo = require('ammo.js');
const { eventSystem } = require('../../shared/utils/EventSystem');

class PhysicsSystem {
  constructor() {
    this.bodies = new Map(); // entityId -> ammoBody
    this.playerBodies = new Map(); // playerId -> entityId
    this.world = null;
        this.collisionConfiguration = null;
        this.dispatcher = null;
        this.broadphase = null;
        this.solver = null;
        this.tmpTransform = null;
        this.rayResultCallback = null;
        this.tempVector3_1 = null;
        this.tempVector3_2 = null;
        this.eventSystem = EventSystem.getInstance();
    }

    async initialize() {
        // Initialize Ammo.js
        if (typeof Ammo === 'function') {
            await new Promise(resolve => {
                Ammo().then(ammo => {
                    Ammo = ammo;
                    resolve();
                });
            });
        }

        // Set up physics world
        this.collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
        this.dispatcher = new Ammo.btCollisionDispatcher(this.collisionConfiguration);
        this.broadphase = new Ammo.btDbvtBroadphase();
        this.solver = new Ammo.btSequentialImpulseConstraintSolver();
        this.world = new Ammo.btDiscreteDynamicsWorld(
            this.dispatcher,
            this.broadphase,
            this.solver,
            this.collisionConfiguration
        );
        this.world.setGravity(new Ammo.btVector3(0, -9.81, 0));

        // Temp variables for reuse
        this.tmpTransform = new Ammo.btTransform();
        this.rayResultCallback = new Ammo.ClosestRayResultCallback();
        this.tempVector3_1 = new Ammo.btVector3();
        this.tempVector3_2 = new Ammo.btVector3();

        // Subscribe to relevant events
        this.eventSystem.subscribe('player:move', this.handlePlayerMove.bind(this));
        this.eventSystem.subscribe('player:jump', this.handlePlayerJump.bind(this));
        
        console.log('Server PhysicsSystem initialized');
    }

    update(deltaTime) {
        if (!this.world) return;

        // Step the physics simulation
        this.world.stepSimulation(deltaTime, 10);

        // Update positions of all entities based on physics
        this.bodies.forEach((body, entityId) => {
            if (!body.isActive()) return;

            const motionState = body.getMotionState();
            if (motionState) {
                motionState.getWorldTransform(this.tmpTransform);
                const pos = this.tmpTransform.getOrigin();
                const rot = this.tmpTransform.getRotation();

                // Emit position update event
                this.eventSystem.emit('physics:positionUpdated', {
                    entityId,
                    position: {
                        x: pos.x(),
                        y: pos.y(),
                        z: pos.z()
                    },
                    rotation: {
                        x: rot.x(),
                        y: rot.y(),
                        z: rot.z(),
                        w: rot.w()
                    }
                });
            }
        });

        // Check for collisions
        this.checkCollisions();
    }

    addRigidBody(entity) {
        const { physicsComponent, positionComponent } = entity.components;
        if (!physicsComponent || !positionComponent) {
            console.warn('Entity missing required components for physics');
            return;
        }

        // Create collision shape based on entity type
        let shape;
        if (physicsComponent.shape === 'box') {
            const size = physicsComponent.size || { x: 1, y: 1, z: 1 };
            shape = new Ammo.btBoxShape(new Ammo.btVector3(size.x / 2, size.y / 2, size.z / 2));
        } else if (physicsComponent.shape === 'sphere') {
            const radius = physicsComponent.radius || 0.5;
            shape = new Ammo.btSphereShape(radius);
        } else if (physicsComponent.shape === 'capsule') {
            const radius = physicsComponent.radius || 0.5;
            const height = physicsComponent.height || 2;
            shape = new Ammo.btCapsuleShape(radius, height - 2 * radius);
        } else {
            console.warn('Unsupported physics shape:', physicsComponent.shape);
            return;
        }

        // Calculate local inertia
        const mass = physicsComponent.isStatic ? 0 : (physicsComponent.mass || 1);
        const localInertia = new Ammo.btVector3(0, 0, 0);
        if (mass > 0) {
            shape.calculateLocalInertia(mass, localInertia);
        }

        // Create transform
        const transform = new Ammo.btTransform();
        transform.setIdentity();
        transform.setOrigin(new Ammo.btVector3(
            positionComponent.x,
            positionComponent.y,
            positionComponent.z
        ));
        if (positionComponent.rotationQuaternion) {
            transform.setRotation(new Ammo.btQuaternion(
                positionComponent.rotationQuaternion.x,
                positionComponent.rotationQuaternion.y,
                positionComponent.rotationQuaternion.z,
                positionComponent.rotationQuaternion.w
            ));
        }

        // Create motion state
        const motionState = new Ammo.btDefaultMotionState(transform);

        // Create rigid body info
        const rbInfo = new Ammo.btRigidBodyConstructionInfo(
            mass,
            motionState,
            shape,
            localInertia
        );

        // Set additional properties
        rbInfo.set_m_friction(physicsComponent.friction || 0.5);
        rbInfo.set_m_restitution(physicsComponent.restitution || 0.2);
        rbInfo.set_m_linearDamping(physicsComponent.linearDamping || 0.1);
        rbInfo.set_m_angularDamping(physicsComponent.angularDamping || 0.1);

        // Create rigid body
        const body = new Ammo.btRigidBody(rbInfo);

        // Set collision flags
        if (physicsComponent.isStatic) {
            body.setCollisionFlags(body.getCollisionFlags() | Ammo.CollisionFlags.CF_STATIC_OBJECT);
        }
        if (physicsComponent.isTrigger) {
            body.setCollisionFlags(body.getCollisionFlags() | Ammo.CollisionFlags.CF_NO_CONTACT_RESPONSE);
        }

        // Set collision filtering
        this.world.addRigidBody(
            body,
            physicsComponent.collisionGroup || 1,
            physicsComponent.collisionMask || -1
        );

        // Store the body
        this.bodies.set(entity.id, body);

        // If this is a player entity, store the mapping
        if (entity.components.playerComponent) {
            this.playerBodies.set(entity.components.playerComponent.id, entity.id);
        }

        // Update the physics component with the Ammo.js body reference
        physicsComponent.body = body;

        // Clean up
        Ammo.destroy(rbInfo);

        return body;
    }

    removeRigidBody(entityId) {
        const body = this.bodies.get(entityId);
        if (body) {
            this.world.removeRigidBody(body);
            this.bodies.delete(entityId);
            
            // Remove from playerBodies if it's a player
            this.playerBodies.forEach((eid, playerId) => {
                if (eid === entityId) {
                    this.playerBodies.delete(playerId);
                }
            });
            
            return true;
        }
        return false;
    }

    handlePlayerMove(data) {
        const { playerId, position, velocity, rotation, timestamp } = data;
        const entityId = this.playerBodies.get(playerId);
        
        if (!entityId) {
            console.warn(`No entity found for player ${playerId}`);
            return;
        }
        
        const body = this.bodies.get(entityId);
        if (!body) {
            console.warn(`No physics body found for entity ${entityId}`);
            return;
        }
        
        // Validate the movement
        const validatedPosition = this.validateMovement(playerId, position, velocity);
        
        // Apply the validated position
        this.tmpTransform.setIdentity();
        this.tmpTransform.setOrigin(new Ammo.btVector3(
            validatedPosition.x,
            validatedPosition.y,
            validatedPosition.z
        ));
        
        // Apply rotation if provided
        if (rotation) {
            this.tmpTransform.setRotation(new Ammo.btQuaternion(
                rotation.x || 0,
                rotation.y || 0,
                rotation.z || 0,
                rotation.w || 1
            ));
        }
        
        body.setWorldTransform(this.tmpTransform);
        
        // Apply velocity if provided
        if (velocity) {
            this.tempVector3_1.setValue(velocity.x || 0, velocity.y || 0, velocity.z || 0);
            body.setLinearVelocity(this.tempVector3_1);
        }
        
        // Activate the body
        body.activate();
        
        // If position was adjusted, notify the client
        if (validatedPosition.x !== position.x || 
            validatedPosition.y !== position.y || 
            validatedPosition.z !== position.z) {
            
            this.eventSystem.emit('physics:positionCorrected', {
                playerId,
                position: validatedPosition,
                timestamp
            });
        }
    }

    handlePlayerJump(data) {
        const { playerId, timestamp } = data;
        const entityId = this.playerBodies.get(playerId);
        
        if (!entityId) return;
        
        const body = this.bodies.get(entityId);
        if (!body) return;
        
        // Check if player is grounded before allowing jump
        if (this.isPlayerGrounded(entityId)) {
            // Apply jump impulse
            this.tempVector3_1.setValue(0, 5, 0); // Jump force, could be configurable
            body.applyCentralImpulse(this.tempVector3_1);
            body.activate();
        }
    }

    isPlayerGrounded(entityId) {
        const body = this.bodies.get(entityId);
        if (!body) return false;
        
        // Get player position
        const transform = body.getWorldTransform();
        const origin = transform.getOrigin();
        
        // Cast a ray downward from the player's feet
        this.tempVector3_1.setValue(origin.x(), origin.y(), origin.z());
        this.tempVector3_2.setValue(origin.x(), origin.y() - 1.1, origin.z()); // Check 1.1 units below
        
        // Reset the callback
        this.rayResultCallback.set_m_closestHitFraction(1);
        this.rayResultCallback.set_m_collisionObject(null);
        
        // Perform raycast
        this.world.rayTest(this.tempVector3_1, this.tempVector3_2, this.rayResultCallback);
        
        return this.rayResultCallback.hasHit();
    }

    validateMovement(playerId, position, velocity) {
        const entityId = this.playerBodies.get(playerId);
        if (!entityId) return position;
        
        const body = this.bodies.get(entityId);
        if (!body) return position;
        
        // Get current position
        body.getMotionState().getWorldTransform(this.tmpTransform);
        const currentPos = this.tmpTransform.getOrigin();
        
        // Calculate max allowed movement distance (based on velocity and time)
        const maxDistance = 5; // Arbitrary limit, can be refined based on game mechanics
        
        // Calculate distance between current and requested position
        const dx = position.x - currentPos.x();
        const dy = position.y - currentPos.y();
        const dz = position.z - currentPos.z();
        const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
        
        // If distance is within limits, allow the move
        if (distance <= maxDistance) {
            return position;
        }
        
        // Otherwise, clamp the movement
        const factor = maxDistance / distance;
        return {
            x: currentPos.x() + dx * factor,
            y: currentPos.y() + dy * factor,
            z: currentPos.z() + dz * factor
        };
    }

    simulateProjectile(data) {
        const { origin, direction, speed, weaponType, shooterId } = data;
        
        // Create a temporary rigid body for the projectile
        const shape = new Ammo.btSphereShape(0.05); // Small bullet shape
        
        const transform = new Ammo.btTransform();
        transform.setIdentity();
        transform.setOrigin(new Ammo.btVector3(origin.x, origin.y, origin.z));
        
        const motionState = new Ammo.btDefaultMotionState(transform);
        
        const mass = 0.1; // Bullet mass
        const localInertia = new Ammo.btVector3(0, 0, 0);
        shape.calculateLocalInertia(mass, localInertia);
        
        const rbInfo = new Ammo.btRigidBodyConstructionInfo(
            mass,
            motionState,
            shape,
            localInertia
        );
        
        const body = new Ammo.btRigidBody(rbInfo);
        
        // Set velocity based on direction and speed
        const velocity = new Ammo.btVector3(
            direction.x * speed,
            direction.y * speed,
            direction.z * speed
        );
        body.setLinearVelocity(velocity);
        
        // Add to world temporarily
        this.world.addRigidBody(body);
        
        // Perform step simulation to see where it goes
        this.world.stepSimulation(0.1, 10); // Simulate 100ms ahead
        
        // Get final position
        const finalTransform = new Ammo.btTransform();
        body.getMotionState().getWorldTransform(finalTransform);
        const finalPos = finalTransform.getOrigin();
        
        // Check if it hit anything during simulation
        const startVec = new Ammo.btVector3(origin.x, origin.y, origin.z);
        const endVec = new Ammo.btVector3(finalPos.x(), finalPos.y(), finalPos.z());
        
        this.rayResultCallback.set_m_closestHitFraction(1);
        this.rayResultCallback.set_m_collisionObject(null);
        
        this.world.rayTest(startVec, endVec, this.rayResultCallback);
        
        let hitResult = null;
        
        if (this.rayResultCallback.hasHit()) {
            const hitObject = Ammo.castObject(this.rayResultCallback.get_m_collisionObject(), Ammo.btRigidBody);
            
            // Find the entity ID from the collision object
            let hitEntityId = null;
            this.bodies.forEach((rb, eid) => {
                if (rb.ptr === hitObject.ptr) {
                    hitEntityId = eid;
                }
            });
            
            // Get hit point
            const hitFraction = this.rayResultCallback.get_m_closestHitFraction();
            const hitPos = {
                x: origin.x + (finalPos.x() - origin.x) * hitFraction,
                y: origin.y + (finalPos.y() - origin.y) * hitFraction,
                z: origin.z + (finalPos.z() - origin.z) * hitFraction
            };
            
            // Get normal
            const normalVector = this.rayResultCallback.get_m_hitNormalWorld();
            const normal = {
                x: normalVector.x(),
                y: normalVector.y(),
                z: normalVector.z()
            };
            
            hitResult = {
                entityId: hitEntityId,
                position: hitPos,
                normal,
                shooterId,
                weaponType
            };
        }
        
        // Clean up temporary objects
        this.world.removeRigidBody(body);
        Ammo.destroy(body);
        Ammo.destroy(rbInfo);
        Ammo.destroy(velocity);
        Ammo.destroy(shape);
        Ammo.destroy(localInertia);
        Ammo.destroy(motionState);
        Ammo.destroy(transform);
        Ammo.destroy(finalTransform);
        Ammo.destroy(startVec);
        Ammo.destroy(endVec);
        
        return {
            finalPosition: {
                x: finalPos.x(),
                y: finalPos.y(),
                z: finalPos.z()
            },
            hit: hitResult
        };
    }

    checkCollisions() {
        const numManifolds = this.dispatcher.getNumManifolds();
        
        for (let i = 0; i < numManifolds; i++) {
            const contactManifold = this.dispatcher.getManifoldByIndexInternal(i);
            const numContacts = contactManifold.getNumContacts();
            
            if (numContacts > 0) {
                const body0 = Ammo.castObject(contactManifold.getBody0(), Ammo.btRigidBody);
                const body1 = Ammo.castObject(contactManifold.getBody1(), Ammo.btRigidBody);
                
                // Find entity IDs
                let entity0Id = null;
                let entity1Id = null;
                
                this.bodies.forEach((body, entityId) => {
                    if (body.ptr === body0.ptr) entity0Id = entityId;
                    if (body.ptr === body1.ptr) entity1Id = entityId;
                });
                
                if (entity0Id && entity1Id) {
                    const contact = contactManifold.getContactPoint(0);
                    const point = contact.getPositionWorldOnA();
                    const normal = contact.getNormalWorldOnB();
                    const impulse = contact.getAppliedImpulse();
                    
                    // Emit collision event
                    this.eventSystem.emit('physics:collision', {
                        entities: [entity0Id, entity1Id],
                        point: { x: point.x(), y: point.y(), z: point.z() },
                        normal: { x: normal.x(), y: normal.y(), z: normal.z() },
                        impulse
                    });
                }
            }
        }
    }
}

module.exports = PhysicsSystem;