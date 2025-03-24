// client/systems/PhysicsSystem.js - Corrigido para seguir o padrão dos outros arquivos client-side
import * as THREE from 'three';
import { System } from '../../shared/utils/ECS';
import { eventSystem } from '../../shared/utils/EventSystem';
import { PositionComponent, PhysicsComponent, RigidBodyComponent } from '../../shared/components/CoreComponents';

class PhysicsSystem extends System {
    constructor() {
        this.bodies = new Map(); // entityId -> ammoBody
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

        console.log('PhysicsSystem initialized');
    }

    update(deltaTime) {
        if (!this.world) return;

        // Step the physics simulation
        this.world.stepSimulation(deltaTime, 10);

        // Update position of all entities based on physics
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
            return true;
        }
        return false;
    }

    applyForce(entityId, force) {
        const body = this.bodies.get(entityId);
        if (!body) return false;

        this.tempVector3_1.setValue(force.x, force.y, force.z);
        body.applyCentralForce(this.tempVector3_1);
        return true;
    }

    applyImpulse(entityId, impulse) {
        const body = this.bodies.get(entityId);
        if (!body) return false;

        this.tempVector3_1.setValue(impulse.x, impulse.y, impulse.z);
        body.applyCentralImpulse(this.tempVector3_1);
        return true;
    }

    setLinearVelocity(entityId, velocity) {
        const body = this.bodies.get(entityId);
        if (!body) return false;

        this.tempVector3_1.setValue(velocity.x, velocity.y, velocity.z);
        body.setLinearVelocity(this.tempVector3_1);
        return true;
    }

    raycast(origin, direction, maxDistance = 1000) {
        if (!this.world) return null;

        // Set up the ray
        this.tempVector3_1.setValue(origin.x, origin.y, origin.z);
        this.tempVector3_2.setValue(
            origin.x + direction.x * maxDistance,
            origin.y + direction.y * maxDistance,
            origin.z + direction.z * maxDistance
        );

        // Reset the callback
        this.rayResultCallback.set_m_closestHitFraction(1);
        this.rayResultCallback.set_m_collisionObject(null);

        // Perform raycast
        this.world.rayTest(this.tempVector3_1, this.tempVector3_2, this.rayResultCallback);

        if (this.rayResultCallback.hasHit()) {
            const collisionObject = Ammo.castObject(this.rayResultCallback.get_m_collisionObject(), Ammo.btRigidBody);
            
            // Find the entity ID from the collision object
            let hitEntityId = null;
            this.bodies.forEach((body, entityId) => {
                if (body.ptr === collisionObject.ptr) {
                    hitEntityId = entityId;
                }
            });

            // Get hit point
            const hitFraction = this.rayResultCallback.get_m_closestHitFraction();
            const hitPoint = {
                x: origin.x + direction.x * maxDistance * hitFraction,
                y: origin.y + direction.y * maxDistance * hitFraction,
                z: origin.z + direction.z * maxDistance * hitFraction
            };

            // Get normal
            const normalVector = this.rayResultCallback.get_m_hitNormalWorld();
            const normal = {
                x: normalVector.x(),
                y: normalVector.y(),
                z: normalVector.z()
            };

            return {
                entityId: hitEntityId,
                distance: maxDistance * hitFraction,
                point: hitPoint,
                normal
            };
        }
        
        return null;
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

    dispose() {
        if (this.world) {
            // Remove all bodies
            this.bodies.forEach((body) => {
                this.world.removeRigidBody(body);
            });
            this.bodies.clear();

            // Clean up Ammo.js resources
            Ammo.destroy(this.world);
            Ammo.destroy(this.solver);
            Ammo.destroy(this.broadphase);
            Ammo.destroy(this.dispatcher);
            Ammo.destroy(this.collisionConfiguration);
            Ammo.destroy(this.tmpTransform);
            Ammo.destroy(this.rayResultCallback);
            Ammo.destroy(this.tempVector3_1);
            Ammo.destroy(this.tempVector3_2);

            this.world = null;
        }
    }
}

export default PhysicsSystem;