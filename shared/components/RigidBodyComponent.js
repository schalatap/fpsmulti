/**
 * @fileoverview Componente que representa um corpo rígido para simulação física.
 * Usado pelo PhysicsSystem para integração com Ammo.js.
 */

class RigidBodyComponent {
    /**
     * Cria um novo componente de corpo rígido para física
     * @param {Object} options - Opções de inicialização
     * @param {Object} [options.body=null] - Referência ao corpo rígido Ammo.js (preenchido pelo PhysicsSystem)
     * @param {string} [options.shape='box'] - Forma da colisão ('box', 'sphere', 'capsule', 'cylinder', 'mesh')
     * @param {boolean} [options.isStatic=false] - Se o corpo é estático (imóvel)
     * @param {boolean} [options.isTrigger=false] - Se é apenas um trigger (sem colisão física)
     * @param {number} [options.mass=1] - Massa do corpo (kg)
     * @param {number} [options.friction=0.5] - Coeficiente de fricção (0-1)
     * @param {number} [options.restitution=0.1] - Coeficiente de restituição/elasticidade (0-1)
     * @param {number} [options.linearDamping=0.01] - Amortecimento linear (0-1)
     * @param {number} [options.angularDamping=0.01] - Amortecimento angular (0-1)
     * @param {boolean} [options.kinematic=false] - Se o corpo é cinemático (movido programaticamente)
     * @param {Array<number>} [options.dimensions] - Dimensões da forma [x, y, z]
     * @param {number} [options.radius=0.5] - Raio para formas esféricas ou cilíndricas
     * @param {number} [options.height=1] - Altura para formas cilíndricas ou capsulares
     * @param {number} [options.collisionGroup=1] - Grupo de colisão para filtragem
     * @param {number} [options.collisionMask=0xFFFF] - Máscara de colisão para filtragem
     * @param {boolean} [options.allowSleep=true] - Permite que o corpo "adormeça" quando inativo
     * @param {boolean} [options.canRotate=true] - Se o corpo pode rotacionar
     * @param {boolean} [options.lockAxisX=false] - Travar rotação no eixo X
     * @param {boolean} [options.lockAxisY=false] - Travar rotação no eixo Y
     * @param {boolean} [options.lockAxisZ=false] - Travar rotação no eixo Z
     * @param {Object} [options.userData={}] - Dados personalizados para callbacks de colisão
     */
    constructor(options = {}) {
        // Referência ao corpo rígido Ammo.js (preenchido pelo PhysicsSystem)
        this.body = options.body || null;
        
        // Propriedades básicas
        this.shape = options.shape || 'box';
        this.isStatic = options.isStatic || false;
        this.isTrigger = options.isTrigger || false;
        this.mass = this.isStatic ? 0 : (options.mass || 1);
        this.friction = options.friction !== undefined ? options.friction : 0.5;
        this.restitution = options.restitution !== undefined ? options.restitution : 0.1;
        this.linearDamping = options.linearDamping !== undefined ? options.linearDamping : 0.01;
        this.angularDamping = options.angularDamping !== undefined ? options.angularDamping : 0.01;
        this.kinematic = options.kinematic || false;
        
        // Dimensões e formas
        this.dimensions = options.dimensions || [1, 1, 1];
        this.radius = options.radius || 0.5;
        this.height = options.height || 1;
        
        // Filtragem de colisão
        this.collisionGroup = options.collisionGroup || 1;
        this.collisionMask = options.collisionMask !== undefined ? options.collisionMask : 0xFFFF;
        
        // Comportamento do corpo
        this.allowSleep = options.allowSleep !== undefined ? options.allowSleep : true;
        this.canRotate = options.canRotate !== undefined ? options.canRotate : true;
        this.lockAxisX = options.lockAxisX || false;
        this.lockAxisY = options.lockAxisY || false;
        this.lockAxisZ = options.lockAxisZ || false;
        
        // Dados personalizados para callbacks de colisão
        this.userData = options.userData || {};
        
        // Raios para detecção do "grounded" state
        this.groundedRayLength = 0.05; // Comprimento do raio para verificar se está no chão
        
        // Estado atual
        this.isGrounded = false; // Se o objeto está no chão
        this.lastGroundedTime = 0; // Timestamp da última vez que estava no chão
        this.collisions = []; // Lista de colisões atuais
    }

    /**
     * Define se o corpo é estático (massa infinita, imóvel)
     * @param {boolean} isStatic - Se o corpo é estático
     */
    setStatic(isStatic) {
        this.isStatic = isStatic;
        this.mass = isStatic ? 0 : this.mass || 1;
        // A aplicação real no Ammo.js deve ser feita pelo PhysicsSystem
    }

    /**
     * Define se o corpo é apenas um trigger (sem resposta física)
     * @param {boolean} isTrigger - Se é um trigger
     */
    setTrigger(isTrigger) {
        this.isTrigger = isTrigger;
        // A aplicação real no Ammo.js deve ser feita pelo PhysicsSystem
    }

    /**
     * Define a massa do corpo
     * @param {number} mass - Massa em kg
     */
    setMass(mass) {
        if (this.isStatic) return; // Corpos estáticos têm massa 0
        this.mass = mass;
        // A aplicação real no Ammo.js deve ser feita pelo PhysicsSystem
    }

    /**
     * Define o coeficiente de atrito do corpo
     * @param {number} friction - Coeficiente de atrito (0-1)
     */
    setFriction(friction) {
        this.friction = Math.max(0, Math.min(1, friction));
        // A aplicação real no Ammo.js deve ser feita pelo PhysicsSystem
    }

    /**
     * Define o coeficiente de restituição (quão "quicante" é)
     * @param {number} restitution - Coeficiente (0-1)
     */
    setRestitution(restitution) {
        this.restitution = Math.max(0, Math.min(1, restitution));
        // A aplicação real no Ammo.js deve ser feita pelo PhysicsSystem
    }

    /**
     * Define o amortecimento linear (resistência ao movimento)
     * @param {number} damping - Coeficiente de amortecimento (0-1)
     */
    setLinearDamping(damping) {
        this.linearDamping = Math.max(0, Math.min(1, damping));
        // A aplicação real no Ammo.js deve ser feita pelo PhysicsSystem
    }

    /**
     * Define o amortecimento angular (resistência à rotação)
     * @param {number} damping - Coeficiente de amortecimento (0-1)
     */
    setAngularDamping(damping) {
        this.angularDamping = Math.max(0, Math.min(1, damping));
        // A aplicação real no Ammo.js deve ser feita pelo PhysicsSystem
    }

    /**
     * Configura as dimensões para formas de caixa
     * @param {number} width - Largura
     * @param {number} height - Altura
     * @param {number} depth - Profundidade
     */
    setBoxDimensions(width, height, depth) {
        this.dimensions = [width, height, depth];
        // A atualização da forma no Ammo.js deve ser feita pelo PhysicsSystem
    }

    /**
     * Configura o raio para formas esféricas
     * @param {number} radius - Raio da esfera
     */
    setSphereRadius(radius) {
        this.radius = radius;
        // A atualização da forma no Ammo.js deve ser feita pelo PhysicsSystem
    }

    /**
     * Configura as dimensões para formas cilíndricas ou capsulares
     * @param {number} radius - Raio do cilindro/cápsula
     * @param {number} height - Altura do cilindro/cápsula
     */
    setCylinderDimensions(radius, height) {
        this.radius = radius;
        this.height = height;
        // A atualização da forma no Ammo.js deve ser feita pelo PhysicsSystem
    }

    /**
     * Define o grupo de colisão e a máscara para filtragem
     * @param {number} group - Grupo de colisão
     * @param {number} mask - Máscara de colisão
     */
    setCollisionFiltering(group, mask) {
        this.collisionGroup = group;
        this.collisionMask = mask;
        // A aplicação real no Ammo.js deve ser feita pelo PhysicsSystem
    }

    /**
     * Define se o corpo pode adormecer quando inativo
     * @param {boolean} allow - Se pode adormecer
     */
    setAllowSleep(allow) {
        this.allowSleep = allow;
        // A aplicação real no Ammo.js deve ser feita pelo PhysicsSystem
    }

    /**
     * Define se o corpo pode rotacionar e quais eixos são travados
     * @param {boolean} canRotate - Se pode rotacionar em geral
     * @param {boolean} lockX - Travar rotação no eixo X
     * @param {boolean} lockY - Travar rotação no eixo Y
     * @param {boolean} lockZ - Travar rotação no eixo Z
     */
    setRotationConstraints(canRotate, lockX, lockY, lockZ) {
        this.canRotate = canRotate;
        this.lockAxisX = lockX;
        this.lockAxisY = lockY;
        this.lockAxisZ = lockZ;
        // A aplicação real no Ammo.js deve ser feita pelo PhysicsSystem
    }

    /**
     * Atualiza o estado "grounded" (se está no chão)
     * @param {boolean} isGrounded - Se o objeto está no chão
     */
    updateGroundedState(isGrounded) {
        const wasGrounded = this.isGrounded;
        this.isGrounded = isGrounded;
        
        if (isGrounded) {
            this.lastGroundedTime = Date.now();
        }
        
        // Retorna se houve mudança de estado
        return wasGrounded !== isGrounded;
    }

    /**
     * Verifica se o objeto esteve no chão recentemente
     * @param {number} timeThreshold - Tempo máximo em ms desde o último contato com o chão
     * @returns {boolean} - Se o objeto esteve no chão dentro do limite de tempo
     */
    wasRecentlyGrounded(timeThreshold = 100) {
        if (this.isGrounded) return true;
        return Date.now() - this.lastGroundedTime < timeThreshold;
    }

    /**
     * Registra uma colisão
     * @param {number} otherEntityId - ID da entidade com a qual houve colisão
     * @param {Object} contactPoint - Ponto de contato
     */
    addCollision(otherEntityId, contactPoint) {
        // Evitar duplicatas
        if (!this.collisions.some(c => c.entityId === otherEntityId)) {
            this.collisions.push({
                entityId: otherEntityId,
                contactPoint: contactPoint,
                time: Date.now()
            });
        }
    }

    /**
     * Remove uma colisão
     * @param {number} otherEntityId - ID da entidade com a qual terminou a colisão
     */
    removeCollision(otherEntityId) {
        this.collisions = this.collisions.filter(c => c.entityId !== otherEntityId);
    }

    /**
     * Limpa todas as colisões
     */
    clearCollisions() {
        this.collisions = [];
    }

    /**
     * Verifica se está colidindo com uma entidade específica
     * @param {number} entityId - ID da entidade
     * @returns {boolean} - Se está colidindo com a entidade
     */
    isCollidingWith(entityId) {
        return this.collisions.some(c => c.entityId === entityId);
    }

    /**
     * Serializa o componente para transmissão pela rede
     * @returns {Object} Representação serializada
     */
    serialize() {
        return {
            shape: this.shape,
            isStatic: this.isStatic,
            isTrigger: this.isTrigger,
            mass: this.mass,
            friction: this.friction,
            restitution: this.restitution,
            dimensions: this.dimensions,
            radius: this.radius,
            height: this.height,
            collisionGroup: this.collisionGroup,
            collisionMask: this.collisionMask,
            kinematic: this.kinematic,
            isGrounded: this.isGrounded
        };
    }

    /**
     * Deserializa dados da rede para atualizar o componente
     * @param {Object} data - Dados recebidos da rede
     */
    deserialize(data) {
        if (data.shape) this.shape = data.shape;
        if (data.isStatic !== undefined) this.isStatic = data.isStatic;
        if (data.isTrigger !== undefined) this.isTrigger = data.isTrigger;
        if (data.mass !== undefined) this.mass = data.mass;
        if (data.friction !== undefined) this.friction = data.friction;
        if (data.restitution !== undefined) this.restitution = data.restitution;
        if (data.dimensions) this.dimensions = data.dimensions;
        if (data.radius !== undefined) this.radius = data.radius;
        if (data.height !== undefined) this.height = data.height;
        if (data.collisionGroup !== undefined) this.collisionGroup = data.collisionGroup;
        if (data.collisionMask !== undefined) this.collisionMask = data.collisionMask;
        if (data.kinematic !== undefined) this.kinematic = data.kinematic;
        if (data.isGrounded !== undefined) this.isGrounded = data.isGrounded;
    }

    /**
     * Cria uma cópia independente deste componente
     * @returns {RigidBodyComponent} Nova instância com os mesmos valores
     */
    clone() {
        return new RigidBodyComponent({
            shape: this.shape,
            isStatic: this.isStatic,
            isTrigger: this.isTrigger,
            mass: this.mass,
            friction: this.friction,
            restitution: this.restitution,
            linearDamping: this.linearDamping,
            angularDamping: this.angularDamping,
            kinematic: this.kinematic,
            dimensions: [...this.dimensions],
            radius: this.radius,
            height: this.height,
            collisionGroup: this.collisionGroup,
            collisionMask: this.collisionMask,
            allowSleep: this.allowSleep,
            canRotate: this.canRotate,
            lockAxisX: this.lockAxisX,
            lockAxisY: this.lockAxisY,
            lockAxisZ: this.lockAxisZ,
            userData: {...this.userData}
        });
    }
}

// Exportar o componente
export default RigidBodyComponent;