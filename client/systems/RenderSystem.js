/**
 * RenderSystem.js
 * Sistema responsável pela renderização 3D do jogo utilizando Three.js.
 * Gerencia câmera, luzes, materiais e modelos.
 */

import * as THREE from 'three';

class RenderSystem {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.clock = null;
    this.entities = new Map();
    this.playerEntity = null;
    this.lights = new Map();
    this.models = new Map();
    this.effects = new Set();
    this.voxelCache = new Map();
    this.containerElement = null;
    this.isInitialized = false;
    this.lastTimestamp = 0;
  }

  /**
   * Inicializa o sistema de renderização
   * @param {HTMLElement} container - Elemento HTML que conterá o canvas do Three.js
   * @returns {boolean} - Sucesso da inicialização
   */
  initialize(container) {
    if (this.isInitialized) {
      console.warn('RenderSystem já inicializado');
      return false;
    }

    try {
      this.containerElement = container;
      
      // Configuração da cena
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x87CEEB); // Céu azul claro
      this.scene.fog = new THREE.Fog(0x87CEEB, 50, 100);
      
      // Configuração da câmera
      const { width, height } = container.getBoundingClientRect();
      this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
      this.camera.position.set(0, 1.8, 0); // Altura padrão humana
      
      // Configuração do renderer
      this.renderer = new THREE.WebGLRenderer({ antialias: true });
      this.renderer.setSize(width, height);
      this.renderer.setPixelRatio(window.devicePixelRatio);
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      container.appendChild(this.renderer.domElement);
      
      // Configuração de luzes
      this.setupLights();
      
      // Configuração do chão padrão
      this.createFloor();
      
      // Configuração do relógio para delta time
      this.clock = new THREE.Clock();
      
      // Configuração de event listeners
      window.addEventListener('resize', this.handleResize.bind(this));
      
      this.isInitialized = true;
      this.lastTimestamp = performance.now();
      this.animate();
      
      return true;
    } catch (error) {
      console.error('Falha ao inicializar RenderSystem:', error);
      return false;
    }
  }

  /**
   * Configura as luzes básicas da cena
   */
  setupLights() {
    // Luz ambiente
    const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    this.scene.add(ambientLight);
    this.lights.set('ambient', ambientLight);

    // Luz direcional (sol)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(100, 100, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.camera.left = -100;
    directionalLight.shadow.camera.right = 100;
    directionalLight.shadow.camera.top = 100;
    directionalLight.shadow.camera.bottom = -100;
    this.scene.add(directionalLight);
    this.lights.set('directional', directionalLight);

    // Luz hemisférica (céu)
    const hemisphereLight = new THREE.HemisphereLight(0x87CEEB, 0x444444, 0.4);
    this.scene.add(hemisphereLight);
    this.lights.set('hemisphere', hemisphereLight);
  }

  /**
   * Cria o chão básico da cena
   */
  createFloor() {
    const floorGeometry = new THREE.PlaneGeometry(100, 100);
    const floorMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x555555,
      roughness: 0.8,
      metalness: 0.2
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2; // Rotacionar para servir como chão
    floor.receiveShadow = true;
    this.scene.add(floor);
  }

  /**
   * Adiciona uma entidade para renderização
   * @param {Object} entity - Entidade com componentes para renderização
   * @returns {boolean} - Sucesso da adição
   */
  addEntity(entity) {
    if (!entity.id || !entity.components) {
      console.error('Entidade inválida:', entity);
      return false;
    }

    if (!entity.components.renderComponent) {
      console.warn('Entidade sem RenderComponent:', entity.id);
      return false;
    }

    if (this.entities.has(entity.id)) {
      console.warn('Entidade já registrada:', entity.id);
      return false;
    }

    const model = this.createModel(entity.components.renderComponent);
    
    if (!model) {
      console.error('Falha ao criar modelo para entidade:', entity.id);
      return false;
    }

    // Aplica posição inicial se disponível
    if (entity.components.positionComponent) {
      const pos = entity.components.positionComponent;
      model.position.set(pos.x || 0, pos.y || 0, pos.z || 0);
      
      if (pos.rotationX !== undefined && pos.rotationY !== undefined && pos.rotationZ !== undefined) {
        model.rotation.set(pos.rotationX, pos.rotationY, pos.rotationZ);
      }
    }

    // Adiciona objeto 3D à cena
    this.scene.add(model);
    
    // Guarda referência ao objeto 3D e à entidade
    this.entities.set(entity.id, {
      entity,
      model
    });

    // Verifica se é uma entidade de jogador
    if (entity.components.firstPersonComponent) {
      if (entity.components.playerComponent?.isLocalPlayer) {
        this.setPlayerEntity(entity);
      }
    }

    return true;
  }

  /**
   * Remove uma entidade da renderização
   * @param {string} entityId - ID da entidade a ser removida
   * @returns {boolean} - Sucesso da remoção
   */
  removeEntity(entityId) {
    const entityData = this.entities.get(entityId);
    
    if (!entityData) {
      console.warn('Entidade não encontrada para remoção:', entityId);
      return false;
    }

    // Remove modelo da cena
    this.scene.remove(entityData.model);
    
    // Remove referência à entidade
    this.entities.delete(entityId);
    
    // Se era a entidade do jogador, limpa referência
    if (this.playerEntity && this.playerEntity.id === entityId) {
      this.playerEntity = null;
    }

    return true;
  }

  /**
   * Define a entidade do jogador local para controle da câmera
   * @param {Object} entity - Entidade do jogador
   */
  setPlayerEntity(entity) {
    this.playerEntity = entity;
    
    // Esconde modelo visual do jogador em primeira pessoa
    const entityData = this.entities.get(entity.id);
    if (entityData && entityData.model) {
      entityData.model.visible = false;
    }
  }

  /**
   * Cria um modelo 3D baseado no componente de renderização
   * @param {Object} renderComponent - Componente com informações de renderização
   * @returns {THREE.Object3D} - Objeto 3D criado
   */
  createModel(renderComponent) {
    const { modelType, color, shape, voxelData } = renderComponent;
    
    // Verifica cache para modelos pré-gerados
    const cacheKey = `${modelType}_${color}_${shape}`;
    if (this.models.has(cacheKey)) {
      return this.models.get(cacheKey).clone();
    }

    let model;

    switch (modelType) {
      case 'player':
        model = this.createPlayerModel(color);
        break;
      case 'weapon':
        model = this.createWeaponModel(renderComponent);
        break;
      case 'projectile':
        model = this.createProjectileModel(renderComponent);
        break;
      case 'obstacle':
        model = this.createObstacleModel(renderComponent);
        break;
      case 'spell':
        model = this.createSpellModel(renderComponent);
        break;
      case 'voxel':
        model = this.createVoxelModel(voxelData, color);
        break;
      default:
        // Modelo básico baseado na forma
        model = this.createBasicModel(shape, color);
    }

    if (model) {
      // Configura sombras
      model.traverse(object => {
        if (object instanceof THREE.Mesh) {
          object.castShadow = true;
          object.receiveShadow = true;
        }
      });
      
      // Guarda no cache se não for um voxel específico
      if (modelType !== 'voxel' && !voxelData) {
        this.models.set(cacheKey, model.clone());
      }
    }

    return model;
  }

  /**
   * Cria um modelo de jogador básico em estilo voxel/low-poly
   * @param {string} color - Cor do jogador em formato hexadecimal
   * @returns {THREE.Group} - Grupo contendo o modelo do jogador
   */
  createPlayerModel(color) {
    const group = new THREE.Group();
    const playerColor = new THREE.Color(color || 0x0000ff);
    
    // Corpo
    const bodyGeometry = new THREE.BoxGeometry(0.6, 1, 0.6);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: playerColor });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.5;
    group.add(body);
    
    // Cabeça
    const headGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const headMaterial = new THREE.MeshStandardMaterial({ color: 0xffdbac });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 1.25;
    group.add(head);
    
    // Pernas
    const legGeometry = new THREE.BoxGeometry(0.2, 0.6, 0.2);
    const legMaterial = new THREE.MeshStandardMaterial({ color: 0x222222 });
    
    const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
    leftLeg.position.set(-0.2, -0.3, 0);
    group.add(leftLeg);
    
    const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
    rightLeg.position.set(0.2, -0.3, 0);
    group.add(rightLeg);
    
    // Braços
    const armGeometry = new THREE.BoxGeometry(0.2, 0.6, 0.2);
    const armMaterial = new THREE.MeshStandardMaterial({ color: playerColor });
    
    const leftArm = new THREE.Mesh(armGeometry, armMaterial);
    leftArm.position.set(-0.4, 0.5, 0);
    group.add(leftArm);
    
    const rightArm = new THREE.Mesh(armGeometry, armMaterial);
    rightArm.position.set(0.4, 0.5, 0);
    group.add(rightArm);
    
    return group;
  }

  /**
   * Cria um modelo de arma básico em estilo voxel/low-poly
   * @param {Object} renderComponent - Componente com informações de renderização
   * @returns {THREE.Group} - Grupo contendo o modelo da arma
   */
  createWeaponModel(renderComponent) {
    const weaponType = renderComponent.weaponType || 'rifle';
    const color = renderComponent.color || 0x333333;
    const group = new THREE.Group();
    
    switch (weaponType) {
      case 'pistol':
        // Corpo da pistola
        const handle = new THREE.Mesh(
          new THREE.BoxGeometry(0.1, 0.2, 0.05),
          new THREE.MeshStandardMaterial({ color: 0x8B4513 })
        );
        handle.position.y = -0.1;
        group.add(handle);
        
        const barrel = new THREE.Mesh(
          new THREE.BoxGeometry(0.05, 0.05, 0.2),
          new THREE.MeshStandardMaterial({ color })
        );
        barrel.position.z = 0.1;
        group.add(barrel);
        break;
        
      case 'rifle':
        // Corpo do rifle
        const body = new THREE.Mesh(
          new THREE.BoxGeometry(0.1, 0.1, 0.5),
          new THREE.MeshStandardMaterial({ color })
        );
        body.position.z = 0.1;
        group.add(body);
        
        const handle2 = new THREE.Mesh(
          new THREE.BoxGeometry(0.1, 0.2, 0.05),
          new THREE.MeshStandardMaterial({ color: 0x8B4513 })
        );
        handle2.position.y = -0.15;
        handle2.position.z = -0.1;
        group.add(handle2);
        
        const scope = new THREE.Mesh(
          new THREE.CylinderGeometry(0.03, 0.03, 0.1, 8),
          new THREE.MeshStandardMaterial({ color: 0x111111 })
        );
        scope.rotation.x = Math.PI / 2;
        scope.position.y = 0.08;
        scope.position.z = 0.1;
        group.add(scope);
        break;
        
      case 'shotgun':
        // Corpo da shotgun
        const barrelSG = new THREE.Mesh(
          new THREE.BoxGeometry(0.15, 0.1, 0.6),
          new THREE.MeshStandardMaterial({ color })
        );
        barrelSG.position.z = 0.2;
        group.add(barrelSG);
        
        const handleSG = new THREE.Mesh(
          new THREE.BoxGeometry(0.1, 0.2, 0.15),
          new THREE.MeshStandardMaterial({ color: 0x8B4513 })
        );
        handleSG.position.y = -0.15;
        handleSG.position.z = -0.15;
        group.add(handleSG);
        
        const pumpSG = new THREE.Mesh(
          new THREE.BoxGeometry(0.12, 0.08, 0.2),
          new THREE.MeshStandardMaterial({ color: 0x8B4513 })
        );
        pumpSG.position.z = 0.05;
        group.add(pumpSG);
        break;
        
      case 'wand':
        // Modelo de varinha mágica
        const wandBody = new THREE.Mesh(
          new THREE.CylinderGeometry(0.01, 0.02, 0.3, 8),
          new THREE.MeshStandardMaterial({ color: 0x8B4513 })
        );
        wandBody.rotation.x = Math.PI / 2;
        wandBody.position.z = 0.15;
        group.add(wandBody);
        
        const wandTip = new THREE.Mesh(
          new THREE.SphereGeometry(0.02, 8, 8),
          new THREE.MeshStandardMaterial({ 
            color: 0x00ffff, 
            emissive: 0x00ffff,
            emissiveIntensity: 0.5
          })
        );
        wandTip.position.z = 0.3;
        group.add(wandTip);
        
        // Adiciona luz na ponta da varinha
        const wandLight = new THREE.PointLight(0x00ffff, 0.5, 1);
        wandLight.position.z = 0.3;
        group.add(wandLight);
        break;
        
      case 'staff':
        // Modelo de cajado mágico
        const staffBody = new THREE.Mesh(
          new THREE.CylinderGeometry(0.02, 0.03, 0.6, 8),
          new THREE.MeshStandardMaterial({ color: 0x8B4513 })
        );
        staffBody.rotation.x = Math.PI / 2;
        staffBody.position.z = 0.3;
        group.add(staffBody);
        
        const staffOrb = new THREE.Mesh(
          new THREE.SphereGeometry(0.06, 8, 8),
          new THREE.MeshStandardMaterial({ 
            color: 0xff00ff, 
            emissive: 0xff00ff,
            emissiveIntensity: 0.5,
            transparent: true,
            opacity: 0.8
          })
        );
        staffOrb.position.z = 0.6;
        group.add(staffOrb);
        
        // Adiciona luz no orbe do cajado
        const staffLight = new THREE.PointLight(0xff00ff, 0.7, 2);
        staffLight.position.z = 0.6;
        group.add(staffLight);
        break;
        
      default:
        // Arma genérica
        const genericWeapon = new THREE.Mesh(
          new THREE.BoxGeometry(0.1, 0.1, 0.3),
          new THREE.MeshStandardMaterial({ color })
        );
        genericWeapon.position.z = 0.15;
        group.add(genericWeapon);
    }
    
    return group;
  }

  /**
   * Cria um modelo de projétil baseado no tipo de arma
   * @param {Object} renderComponent - Componente com informações de renderização
   * @returns {THREE.Object3D} - Objeto 3D do projétil
   */
  createProjectileModel(renderComponent) {
    const weaponType = renderComponent.weaponType || 'bullet';
    const color = renderComponent.color || 0xffff00;
    
    switch (weaponType) {
      case 'bullet':
      case 'pistol':
      case 'rifle':
        // Projétil básico de bala
        const bulletGeometry = new THREE.CylinderGeometry(0.01, 0.01, 0.05, 8);
        const bulletMaterial = new THREE.MeshStandardMaterial({ 
          color,
          emissive: color,
          emissiveIntensity: 0.5
        });
        const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
        bullet.rotation.x = Math.PI / 2;
        return bullet;
        
      case 'shotgun':
        // Grupo de pequenas esferas para shotgun
        const pelletGroup = new THREE.Group();
        const pelletGeometry = new THREE.SphereGeometry(0.01, 4, 4);
        const pelletMaterial = new THREE.MeshStandardMaterial({ color });
        
        for (let i = 0; i < 5; i++) {
          const pellet = new THREE.Mesh(pelletGeometry, pelletMaterial);
          pellet.position.set(
            (Math.random() - 0.5) * 0.05,
            (Math.random() - 0.5) * 0.05,
            (Math.random() - 0.5) * 0.02
          );
          pelletGroup.add(pellet);
        }
        return pelletGroup;
        
      case 'fireball':
        // Projétil de bola de fogo
        const fireballGeometry = new THREE.SphereGeometry(0.1, 8, 8);
        const fireballMaterial = new THREE.MeshStandardMaterial({ 
          color: 0xff5500,
          emissive: 0xff3300,
          emissiveIntensity: 0.7
        });
        const fireball = new THREE.Mesh(fireballGeometry, fireballMaterial);
        
        // Adiciona luz à bola de fogo
        const fireLight = new THREE.PointLight(0xff5500, 1, 2);
        fireball.add(fireLight);
        
        return fireball;
        
      case 'icespike':
        // Projétil de fragmento de gelo
        const icespikeGeometry = new THREE.ConeGeometry(0.05, 0.2, 6);
        const icespikeMaterial = new THREE.MeshStandardMaterial({ 
          color: 0x88ccff,
          emissive: 0x88ccff,
          emissiveIntensity: 0.3,
          transparent: true,
          opacity: 0.8
        });
        const icespike = new THREE.Mesh(icespikeGeometry, icespikeMaterial);
        icespike.rotation.x = Math.PI / 2;
        
        return icespike;
        
      default:
        // Projétil genérico
        const genericGeometry = new THREE.SphereGeometry(0.05, 8, 8);
        const genericMaterial = new THREE.MeshStandardMaterial({ color });
        return new THREE.Mesh(genericGeometry, genericMaterial);
    }
  }

  /**
   * Cria um modelo de obstáculo básico em estilo voxel/low-poly
   * @param {Object} renderComponent - Componente com informações de renderização
   * @returns {THREE.Mesh} - Objeto 3D do obstáculo
   */
  createObstacleModel(renderComponent) {
    const { shape, color } = renderComponent;
    
    switch (shape) {
      case 'box':
        const boxGeometry = new THREE.BoxGeometry(
          renderComponent.width || 1, 
          renderComponent.height || 1, 
          renderComponent.depth || 1
        );
        const boxMaterial = new THREE.MeshStandardMaterial({ 
          color: color || 0x888888,
          roughness: 0.7,
          metalness: 0.2
        });
        return new THREE.Mesh(boxGeometry, boxMaterial);
        
      case 'cylinder':
        const cylinderGeometry = new THREE.CylinderGeometry(
          renderComponent.radius || 0.5,
          renderComponent.radius || 0.5,
          renderComponent.height || 1,
          8
        );
        const cylinderMaterial = new THREE.MeshStandardMaterial({ 
          color: color || 0x888888,
          roughness: 0.7,
          metalness: 0.2
        });
        return new THREE.Mesh(cylinderGeometry, cylinderMaterial);
        
      case 'sphere':
        const sphereGeometry = new THREE.SphereGeometry(
          renderComponent.radius || 0.5,
          8,
          8
        );
        const sphereMaterial = new THREE.MeshStandardMaterial({ 
          color: color || 0x888888,
          roughness: 0.7,
          metalness: 0.2
        });
        return new THREE.Mesh(sphereGeometry, sphereMaterial);
        
      default:
        return this.createBasicModel('box', color || 0x888888);
    }
  }

  /**
   * Cria um modelo de efeito de magia
   * @param {Object} renderComponent - Componente com informações de renderização
   * @returns {THREE.Object3D} - Objeto 3D do efeito de magia
   */
  createSpellModel(renderComponent) {
    const { spellType, color, size } = renderComponent;
    const spellSize = size || 1;
    const spellColor = new THREE.Color(color || 0x00ffff);
    
    switch (spellType) {
      case 'aura':
        // Aura mágica semi-transparente
        const auraGeometry = new THREE.SphereGeometry(spellSize, 16, 16);
        const auraMaterial = new THREE.MeshStandardMaterial({ 
          color: spellColor,
          emissive: spellColor,
          emissiveIntensity: 0.5,
          transparent: true,
          opacity: 0.3
        });
        const aura = new THREE.Mesh(auraGeometry, auraMaterial);
        
        // Adiciona luz interna
        const auraLight = new THREE.PointLight(spellColor, 1, spellSize * 2);
        aura.add(auraLight);
        
        return aura;
        
      case 'beam':
        // Raio mágico
        const beamGeometry = new THREE.CylinderGeometry(0.1, 0.1, spellSize, 8);
        const beamMaterial = new THREE.MeshStandardMaterial({ 
          color: spellColor,
          emissive: spellColor,
          emissiveIntensity: 0.7,
          transparent: true,
          opacity: 0.7
        });
        const beam = new THREE.Mesh(beamGeometry, beamMaterial);
        beam.rotation.x = Math.PI / 2;
        
        return beam;
        
      case 'vortex':
        // Vórtice mágico (grupo de anéis)
        const vortexGroup = new THREE.Group();
        
        for (let i = 0; i < 5; i++) {
          const ringGeometry = new THREE.TorusGeometry(spellSize * 0.3 * (i + 1), 0.05, 8, 16);
          const ringMaterial = new THREE.MeshStandardMaterial({ 
            color: spellColor,
            emissive: spellColor,
            emissiveIntensity: 0.5 - (i * 0.1),
            transparent: true,
            opacity: 0.8 - (i * 0.1)
          });
          const ring = new THREE.Mesh(ringGeometry, ringMaterial);
          ring.rotation.x = Math.PI / 2;
          vortexGroup.add(ring);
        }
        
        return vortexGroup;
        
      case 'shield':
        // Escudo mágico semi-esférico
        const shieldGeometry = new THREE.SphereGeometry(spellSize, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
        const shieldMaterial = new THREE.MeshStandardMaterial({ 
          color: spellColor,
          emissive: spellColor,
          emissiveIntensity: 0.3,
          transparent: true,
          opacity: 0.4,
          side: THREE.DoubleSide
        });
        return new THREE.Mesh(shieldGeometry, shieldMaterial);
        
      default:
        // Efeito genérico (partículas)
        const particleGroup = new THREE.Group();
        
        for (let i = 0; i < 10; i++) {
          const particleGeometry = new THREE.SphereGeometry(0.05, 4, 4);
          const particleMaterial = new THREE.MeshStandardMaterial({ 
            color: spellColor,
            emissive: spellColor,
            emissiveIntensity: 0.7
          });
          const particle = new THREE.Mesh(particleGeometry, particleMaterial);
          
          // Posição aleatória dentro de um raio
          const radius = Math.random() * spellSize;
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.random() * Math.PI;
          
          particle.position.set(
            radius * Math.sin(phi) * Math.cos(theta),
            radius * Math.sin(phi) * Math.sin(theta),
            radius * Math.cos(phi)
          );
          
          particleGroup.add(particle);
        }
        
        return particleGroup;
    }
  }

/**
   * Cria um modelo voxel baseado em dados de voxel
   * @param {Array} voxelData - Array de dados de voxels
   * @param {string} defaultColor - Cor padrão para voxels sem cor especificada
   * @returns {THREE.Group} - Grupo contendo o modelo voxel
   */
createVoxelModel(voxelData, defaultColor) {
    if (!voxelData || !Array.isArray(voxelData) || voxelData.length === 0) {
      console.warn('Dados de voxel inválidos');
      return this.createBasicModel('box', defaultColor);
    }
    
    const group = new THREE.Group();
    const cubeSize = 0.1; // Tamanho de cada voxel
    
    // Criar um único buffer de geometria para todos os cubos da mesma cor
    const geometryBuffers = new Map();
    const meshes = new Map();
    
    voxelData.forEach(voxel => {
      const { x, y, z, color } = voxel;
      const voxelColor = color || defaultColor || 0xffffff;
      
      if (!geometryBuffers.has(voxelColor)) {
        geometryBuffers.set(voxelColor, []);
      }
      
      // Adiciona posição do voxel ao buffer correspondente à sua cor
      geometryBuffers.get(voxelColor).push({
        x: x * cubeSize,
        y: y * cubeSize,
        z: z * cubeSize
      });
    });
    
    // Cria uma geometria instanciada para cada cor
    geometryBuffers.forEach((positions, color) => {
      // Cria geometria base para o voxel
      const geometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
      const material = new THREE.MeshStandardMaterial({ 
        color: parseInt(color),
        roughness: 0.7,
        metalness: 0.3
      });
      
      // Cria uma malha para cada posição
      positions.forEach(pos => {
        const cube = new THREE.Mesh(geometry, material);
        cube.position.set(pos.x, pos.y, pos.z);
        group.add(cube);
      });
    });
    
    // Armazena o modelo no cache usando uma hash dos dados
    const dataHash = JSON.stringify(voxelData).hashCode; // Método hashCode deve ser implementado
    if (dataHash) {
      this.voxelCache.set(dataHash, group.clone());
    }
    
    return group;
  }

  /**
   * Cria modelo 3D básico com forma geométrica simples
   * @param {string} shape - Tipo de forma ('box', 'sphere', 'cylinder')
   * @param {number} color - Cor em formato hexadecimal
   * @returns {THREE.Mesh} - Objeto 3D do modelo básico
   */
  createBasicModel(shape, color) {
    let geometry;
    
    switch (shape) {
      case 'sphere':
        geometry = new THREE.SphereGeometry(0.5, 8, 8);
        break;
      case 'cylinder':
        geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
        break;
      case 'cone':
        geometry = new THREE.ConeGeometry(0.5, 1, 8);
        break;
      case 'box':
      default:
        geometry = new THREE.BoxGeometry(1, 1, 1);
    }
    
    const material = new THREE.MeshStandardMaterial({
      color: color || 0xffffff,
      roughness: 0.7,
      metalness: 0.3
    });
    
    return new THREE.Mesh(geometry, material);
  }

  /**
   * Cria efeito visual para magia
   * @param {string} type - Tipo de magia
   * @param {Object} position - Posição do efeito {x, y, z}
   * @param {Object} params - Parâmetros adicionais (cor, tamanho, duração)
   * @returns {Object} - ID do efeito para referência
   */
  createSpellEffect(type, position, params = {}) {
    const effectId = `effect_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const color = params.color || this.getDefaultSpellColor(type);
    const size = params.size || 1;
    const duration = params.duration || 2; // segundos
    
    let effect;
    
    switch (type) {
      case 'explosion':
        effect = this.createExplosionEffect(position, color, size);
        break;
      case 'lightning':
        effect = this.createLightningEffect(position, color, size);
        break;
      case 'portal':
        effect = this.createPortalEffect(position, color, size);
        break;
      case 'aura':
        effect = this.createAuraEffect(position, color, size);
        break;
      case 'projectile':
        effect = this.createProjectileEffect(position, color, size, params.direction);
        // Projéteis não têm duração automática, são gerenciados pelo sistema de balística
        this.effects.add({id: effectId, effect, type, position, createdAt: Date.now(), duration: -1});
        return effectId;
      default:
        effect = this.createGenericEffect(position, color, size);
    }
    
    this.scene.add(effect);
    
    // Registra efeito para gerenciamento de ciclo de vida
    this.effects.add({
      id: effectId,
      effect,
      type,
      position,
      createdAt: Date.now(),
      duration
    });
    
    return effectId;
  }

  /**
   * Obtém cor padrão para tipo de magia
   * @param {string} type - Tipo de magia
   * @returns {number} - Cor em formato hexadecimal
   */
  getDefaultSpellColor(type) {
    const spellColors = {
      fire: 0xff4400,
      ice: 0x88ccff,
      lightning: 0xffff00,
      poison: 0x00ff00,
      arcane: 0xff00ff,
      holy: 0xffffcc,
      shadow: 0x442244,
      explosion: 0xff6600,
      healing: 0x00ff88,
      generic: 0x0088ff
    };
    
    return spellColors[type] || spellColors.generic;
  }

  /**
   * Cria efeito de explosão
   * @param {Object} position - Posição da explosão
   * @param {number} color - Cor da explosão
   * @param {number} size - Tamanho da explosão
   * @returns {THREE.Group} - Grupo contendo efeito de explosão
   */
  createExplosionEffect(position, color, size) {
    const group = new THREE.Group();
    
    // Esfera central brilhante
    const sphereGeometry = new THREE.SphereGeometry(size * 0.5, 16, 16);
    const sphereMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.8
    });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    group.add(sphere);
    
    // Luz pontual no centro da explosão
    const light = new THREE.PointLight(color, 1, size * 4);
    group.add(light);
    
    // Partículas ao redor (representadas por pequenas esferas)
    for (let i = 0; i < 20; i++) {
      const particleSize = Math.random() * size * 0.2;
      const particleGeometry = new THREE.SphereGeometry(particleSize, 4, 4);
      const particleMaterial = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.6
      });
      const particle = new THREE.Mesh(particleGeometry, particleMaterial);
      
      // Posicionar partícula aleatoriamente em torno do centro
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const radius = Math.random() * size;
      
      particle.position.set(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi)
      );
      
      group.add(particle);
    }
    
    // Posicionar o grupo na posição especificada
    group.position.set(position.x, position.y, position.z);
    
    return group;
  }

  /**
   * Cria efeito de relâmpago
   * @param {Object} position - Posição do relâmpago
   * @param {number} color - Cor do relâmpago
   * @param {number} size - Tamanho do relâmpago
   * @returns {THREE.Group} - Grupo contendo efeito de relâmpago
   */
  createLightningEffect(position, color, size) {
    const group = new THREE.Group();
    
    // Criar raios usando linhas
    const numBolts = 5;
    
    for (let i = 0; i < numBolts; i++) {
      const points = [];
      const numSegments = 10;
      const maxOffset = size * 0.2;
      
      // Ponto inicial
      points.push(new THREE.Vector3(0, 0, 0));
      
      // Pontos intermediários com desvios aleatórios
      for (let j = 1; j < numSegments; j++) {
        const t = j / numSegments;
        points.push(new THREE.Vector3(
          (Math.random() - 0.5) * maxOffset,
          -t * size,
          (Math.random() - 0.5) * maxOffset
        ));
      }
      
      // Criar geometria de linha para o raio
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({ 
        color, 
        linewidth: 3,
        transparent: true,
        opacity: 0.8
      });
      
      const bolt = new THREE.Line(geometry, material);
      group.add(bolt);
    }
    
    // Adicionar luz do relâmpago
    const light = new THREE.PointLight(color, 1, size * 3);
    group.add(light);
    
    // Posicionar o grupo na posição especificada
    group.position.set(position.x, position.y, position.z);
    
    return group;
  }

  /**
   * Cria efeito de portal
   * @param {Object} position - Posição do portal
   * @param {number} color - Cor do portal
   * @param {number} size - Tamanho do portal
   * @returns {THREE.Group} - Grupo contendo efeito de portal
   */
  createPortalEffect(position, color, size) {
    const group = new THREE.Group();
    
    // Círculo principal do portal
    const ringGeometry = new THREE.TorusGeometry(size * 0.8, size * 0.1, 16, 32);
    const ringMaterial = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.9
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    group.add(ring);
    
    // Círculo interno (como um véu)
    const discGeometry = new THREE.CircleGeometry(size * 0.75, 32);
    const discMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide
    });
    const disc = new THREE.Mesh(discGeometry, discMaterial);
    group.add(disc);
    
    // Luz do portal
    const light = new THREE.PointLight(color, 0.7, size * 3);
    group.add(light);
    
    // Posicionar o grupo na posição especificada
    group.position.set(position.x, position.y, position.z);
    
    return group;
  }

  /**
   * Cria efeito de aura
   * @param {Object} position - Posição da aura
   * @param {number} color - Cor da aura
   * @param {number} size - Tamanho da aura
   * @returns {THREE.Group} - Grupo contendo efeito de aura
   */
  createAuraEffect(position, color, size) {
    const group = new THREE.Group();
    
    // Esfera semi-transparente
    const sphereGeometry = new THREE.SphereGeometry(size, 16, 16);
    const sphereMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide
    });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    group.add(sphere);
    
    // Partículas dentro da aura
    for (let i = 0; i < 15; i++) {
      const particleSize = Math.random() * size * 0.1 + size * 0.05;
      const particleGeometry = new THREE.SphereGeometry(particleSize, 4, 4);
      const particleMaterial = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.7
      });
      const particle = new THREE.Mesh(particleGeometry, particleMaterial);
      
      // Posicionar partícula aleatoriamente dentro da aura
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const radius = Math.random() * size * 0.9;
      
      particle.position.set(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi)
      );
      
      group.add(particle);
    }
    
    // Luz da aura
    const light = new THREE.PointLight(color, 0.5, size * 2);
    group.add(light);
    
    // Posicionar o grupo na posição especificada
    group.position.set(position.x, position.y, position.z);
    
    return group;
  }

  /**
   * Cria efeito de projétil
   * @param {Object} position - Posição inicial do projétil
   * @param {number} color - Cor do projétil
   * @param {number} size - Tamanho do projétil
   * @param {Object} direction - Direção do projétil {x, y, z}
   * @returns {THREE.Group} - Grupo contendo efeito de projétil
   */
  createProjectileEffect(position, color, size, direction) {
    const group = new THREE.Group();
    
    // Núcleo do projétil
    const coreGeometry = new THREE.SphereGeometry(size * 0.3, 8, 8);
    const coreMaterial = new THREE.MeshBasicMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.8
    });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    group.add(core);
    
    // Rastro do projétil
    const trailGeometry = new THREE.ConeGeometry(size * 0.2, size, 8);
    const trailMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.6
    });
    const trail = new THREE.Mesh(trailGeometry, trailMaterial);
    trail.position.z = -size * 0.6;
    trail.rotation.x = Math.PI; // Rotacionar para apontar para trás
    group.add(trail);
    
    // Luz do projétil
    const light = new THREE.PointLight(color, 1, size * 3);
    group.add(light);
    
    // Posicionar o grupo na posição especificada
    group.position.set(position.x, position.y, position.z);
    
    // Orientar na direção especificada se fornecida
    if (direction) {
      // Calcular rotação para apontar na direção
      const targetVector = new THREE.Vector3(direction.x, direction.y, direction.z).normalize();
      
      // Vetor padrão para frente (z)
      const defaultForward = new THREE.Vector3(0, 0, 1);
      
      // Calcular quaternion para rotação
      const quaternion = new THREE.Quaternion().setFromUnitVectors(defaultForward, targetVector);
      group.setRotationFromQuaternion(quaternion);
    }
    
    return group;
  }

  /**
   * Cria efeito genérico (útil para efeitos não específicos)
   * @param {Object} position - Posição do efeito
   * @param {number} color - Cor do efeito
   * @param {number} size - Tamanho do efeito
   * @returns {THREE.Group} - Grupo contendo efeito genérico
   */
  createGenericEffect(position, color, size) {
    const group = new THREE.Group();
    
    // Esfera principal
    const sphereGeometry = new THREE.SphereGeometry(size * 0.3, 8, 8);
    const sphereMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.7
    });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    group.add(sphere);
    
    // Anéis em torno
    for (let i = 0; i < 3; i++) {
      const ringGeometry = new THREE.TorusGeometry(size * (0.4 + i * 0.2), size * 0.05, 8, 16);
      const ringMaterial = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.5 - i * 0.1
      });
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      
      // Rotacionar os anéis em diferentes eixos
      ring.rotation.x = Math.PI / 2 * i;
      ring.rotation.y = Math.PI / 4 * i;
      
      group.add(ring);
    }
    
    // Luz do efeito
    const light = new THREE.PointLight(color, 0.7, size * 2);
    group.add(light);
    
    // Posicionar o grupo na posição especificada
    group.position.set(position.x, position.y, position.z);
    
    return group;
  }

  /**
   * Remove um efeito visual
   * @param {string} effectId - ID do efeito a ser removido
   * @returns {boolean} - Sucesso da remoção
   */
  removeSpellEffect(effectId) {
    for (const effectData of this.effects) {
      if (effectData.id === effectId) {
        this.scene.remove(effectData.effect);
        this.effects.delete(effectData);
        return true;
      }
    }
    
    console.warn(`Efeito não encontrado para remoção: ${effectId}`);
    return false;
  }

  /**
   * Atualiza a posição de um efeito
   * @param {string} effectId - ID do efeito a ser atualizado
   * @param {Object} position - Nova posição {x, y, z}
   * @returns {boolean} - Sucesso da atualização
   */
  updateSpellEffectPosition(effectId, position) {
    for (const effectData of this.effects) {
      if (effectData.id === effectId) {
        effectData.effect.position.set(position.x, position.y, position.z);
        return true;
      }
    }
    
    console.warn(`Efeito não encontrado para atualização: ${effectId}`);
    return false;
  }

  /**
   * Atualiza as entidades na cena usando dados de componentes
   * @param {number} deltaTime - Tempo decorrido desde a última atualização em segundos
   */
  update(deltaTime) {
    // Atualiza posições e rotações de entidades
    this.entities.forEach((entityData, entityId) => {
      const { entity, model } = entityData;
      
      if (entity.components.positionComponent) {
        const pos = entity.components.positionComponent;
        
        model.position.set(pos.x || 0, pos.y || 0, pos.z || 0);
        
        if (pos.rotationX !== undefined && pos.rotationY !== undefined && pos.rotationZ !== undefined) {
          model.rotation.set(pos.rotationX, pos.rotationY, pos.rotationZ);
        }
      }
      
      // Se a entidade for do jogador, atualiza posição da câmera
      if (entity === this.playerEntity && entity.components.firstPersonComponent) {
        this.updateCameraPosition();
      }
    });
    
    // Atualiza efeitos visuais (tempo de vida, animações)
    this.updateEffects(deltaTime);
  }

  /**
   * Atualiza efeitos visuais, removendo os que expiraram e animando os ativos
   * @param {number} deltaTime - Tempo decorrido desde a última atualização em segundos
   */
  updateEffects(deltaTime) {
    const now = Date.now();
    const effectsToRemove = [];
    
    this.effects.forEach(effectData => {
      // Pular efeitos sem duração automática (como projéteis)
      if (effectData.duration < 0) return;
      
      const elapsed = (now - effectData.createdAt) / 1000; // Tempo decorrido em segundos
      
      // Verificar se o efeito expirou
      if (elapsed > effectData.duration) {
        effectsToRemove.push(effectData.id);
        return;
      }
      
      // Animar efeito baseado no tempo de vida
      const lifeRatio = elapsed / effectData.duration;
      
      // Aplicar animações específicas por tipo de efeito
      switch (effectData.type) {
        case 'explosion':
          this.animateExplosionEffect(effectData.effect, lifeRatio);
          break;
        case 'aura':
          this.animateAuraEffect(effectData.effect, lifeRatio);
          break;
        case 'portal':
          this.animatePortalEffect(effectData.effect, lifeRatio);
          break;
        case 'lightning':
          this.animateLightningEffect(effectData.effect, lifeRatio);
          break;
        default:
          this.animateGenericEffect(effectData.effect, lifeRatio);
      }
    });
    
    // Remover efeitos expirados
    effectsToRemove.forEach(effectId => {
      this.removeSpellEffect(effectId);
    });
  }

  /**
   * Anima efeito de explosão
   * @param {THREE.Group} effect - Grupo contendo efeito
   * @param {number} lifeRatio - Razão da vida do efeito (0-1)
   */
  animateExplosionEffect(effect, lifeRatio) {
    const scale = 1 + lifeRatio;
    effect.scale.set(scale, scale, scale);
    
    // Diminuir opacidade ao final da vida
    effect.traverse(child => {
      if (child.material && child.material.opacity) {
        child.material.opacity = Math.max(0, 1 - lifeRatio * 1.5);
      }
    });
    
    // Diminuir intensidade da luz
    effect.children.forEach(child => {
      if (child instanceof THREE.PointLight) {
        child.intensity = Math.max(0, 1 - lifeRatio);
      }
    });
  }

  /**
   * Anima efeito de aura
   * @param {THREE.Group} effect - Grupo contendo efeito
   * @param {number} lifeRatio - Razão da vida do efeito (0-1)
   */
  animateAuraEffect(effect, lifeRatio) {
    // Pulsar o tamanho da aura
    const pulse = 1 + Math.sin(lifeRatio * Math.PI * 8) * 0.1;
    effect.scale.set(pulse, pulse, pulse);
    
    // Rotacionar suavemente
    effect.rotation.y += 0.01;
    
    // Para auras longas, manter opacidade constante até perto do fim
    if (lifeRatio > 0.8) {
      const fadeOut = (lifeRatio - 0.8) * 5; // 0-1 nos últimos 20% da vida
      effect.traverse(child => {
        if (child.material && child.material.opacity !== undefined) {
          child.material.opacity = Math.max(0, child.material.opacity - fadeOut * 0.05);
        }
      });
    }
  }

  /**
   * Anima efeito de portal
   * @param {THREE.Group} effect - Grupo contendo efeito
   * @param {number} lifeRatio - Razão da vida do efeito (0-1)
   */
  animatePortalEffect(effect, lifeRatio) {
    // Rotacionar continuamente
    effect.rotation.z += 0.02;
    
    // Pulsar tamanho do portal
    const pulse = 1 + Math.sin(lifeRatio * Math.PI * 6) * 0.05;
    effect.scale.set(pulse, pulse, pulse);
    
    // Efeito de aparecimento no início e desaparecimento no final
    let opacity;
    if (lifeRatio < 0.2) {
      // Fade in nos primeiros 20%
      opacity = lifeRatio * 5;
    } else if (lifeRatio > 0.8) {
      // Fade out nos últimos 20%
      opacity = 1 - (lifeRatio - 0.8) * 5;
    } else {
      // Opacidade completa no meio
      opacity = 1;
    }
    
    effect.traverse(child => {
      if (child.material && child.material.opacity !== undefined) {
        // Manter opacidade relativa
        const baseOpacity = child.material.opacity / (child.userData.baseOpacity || 1);
        child.material.opacity = baseOpacity * opacity;
        
        // Armazenar opacidade base na primeira passagem
        if (!child.userData.baseOpacity) {
          child.userData.baseOpacity = child.material.opacity;
        }
      }
    });
  }

  /**
   * Anima efeito de relâmpago
   * @param {THREE.Group} effect - Grupo contendo efeito
   * @param {number} lifeRatio - Razão da vida do efeito (0-1)
   */
  animateLightningEffect(effect, lifeRatio) {
    // Piscar aleatoriamente
    const flash = Math.random() > 0.7 ? 1 : 0.3;
    
    effect.traverse(child => {
      if (child instanceof THREE.Line) {
        // Reposicionar pontos da linha para criar efeito de movimento
        const positions = child.geometry.attributes.position.array;
        
        for (let i = 3; i < positions.length; i += 3) {
          // Manter y constante (progressão vertical)
          const y = positions[i + 1];
          // Modificar x e z com ruído
          positions[i] = (Math.random() - 0.5) * 0.4;
          positions[i + 2] = (Math.random() - 0.5) * 0.4;
        }
        
        child.geometry.attributes.position.needsUpdate = true;
        
        // Aplicar efeito de piscada
        if (child.material) {
          child.material.opacity = (1 - lifeRatio * 0.5) * flash;
        }
      }
      
      if (child instanceof THREE.PointLight) {
        child.intensity = (1 - lifeRatio) * flash;
      }
    });
  }

  /**
   * Anima efeito genérico
   * @param {THREE.Group} effect - Grupo contendo efeito
   * @param {number} lifeRatio - Razão da vida do efeito (0-1)
   */
  animateGenericEffect(effect, lifeRatio) {
    // Rotacionar suavemente
    effect.rotation.y += 0.01;
    effect.rotation.x += 0.005;
    
    // Desvanecer no final da vida
    if (lifeRatio > 0.7) {
      const fadeOut = (lifeRatio - 0.7) / 0.3; // 0-1 nos últimos 30% da vida
      
      effect.traverse(child => {
        if (child.material && child.material.opacity !== undefined) {
          child.material.opacity = Math.max(0, 1 - fadeOut);
        }
        
        if (child instanceof THREE.PointLight) {
          child.intensity = Math.max(0, 1 - fadeOut);
        }
      });
    }
  }

  /**
   * Atualiza a posição da câmera baseada na entidade do jogador
   */
  updateCameraPosition() {
    if (!this.playerEntity || !this.camera) return;
    
    const pos = this.playerEntity.components.positionComponent;
    const fpsComp = this.playerEntity.components.firstPersonComponent;
    
    if (!pos) return;
    
    // Altura da câmera (olhos do jogador)
    const cameraHeight = fpsComp?.cameraHeight || 1.8;
    
    // Posicionar a câmera na posição do jogador com a altura correta
    this.camera.position.set(pos.x, pos.y + cameraHeight, pos.z);
    
    // Orientar câmera na direção que o jogador está olhando
    if (pos.rotationX !== undefined && pos.rotationY !== undefined) {
        this.camera.rotation.x = pos.rotationX;
        this.camera.rotation.y = pos.rotationY;
        this.camera.rotation.z = pos.rotationZ || 0;
      }
    }
    
    /**
     * Lida com o redimensionamento da janela
     */
    handleResize() {
      if (!this.containerElement || !this.camera || !this.renderer) return;
      
      const { width, height } = this.containerElement.getBoundingClientRect();
      
      // Atualiza a razão de aspecto da câmera
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      
      // Atualiza o tamanho do renderizador
      this.renderer.setSize(width, height);
    }

    /**
     * Retorna a entidade do jogador local
     * @returns {Object} - Entidade do jogador local
     */
    getPlayerEntity() {
        return this.playerEntity;
    }
    
    /**
     * Retorna a câmera usada para renderização
     * @returns {THREE.Camera} - Câmera atual
     */
    getCamera() {
        return this.camera;
    }
    
    /**
     * Retorna o renderer Three.js
     * @returns {THREE.WebGLRenderer} - Renderer atual
     */
    getRenderer() {
        return this.renderer;
    }
    
    /**
     * Retorna a cena Three.js
     * @returns {THREE.Scene} - Cena atual
     */
    getScene() {
        return this.scene;
    }
    
    /**
     * Define a visibilidade de uma entidade
     * @param {string} entityId - ID da entidade
     * @param {boolean} isVisible - Flag de visibilidade
     * @returns {boolean} - Sucesso da operação
     */
    setEntityVisibility(entityId, isVisible) {
        const entityData = this.entities.get(entityId);
        
        if (!entityData) {
        console.warn('Entidade não encontrada para alteração de visibilidade:', entityId);
        return false;
        }
        
        entityData.model.visible = isVisible;
        return true;
    }
    
    /**
     * Cria um efeito de hit/impacto na posição específica
     * @param {Object} position - Posição do impacto {x, y, z}
     * @param {Object} normal - Normal da superfície {x, y, z}
     * @param {string} type - Tipo de impacto (bullet, magic, explosion)
     * @returns {string} - ID do efeito criado
     */
    createHitEffect(position, normal, type = 'bullet') {
        // Determinar cor e tamanho baseado no tipo
        let color, size;
        
        switch (type) {
        case 'magic':
            color = 0x00ffff;
            size = 0.5;
            return this.createSpellEffect('explosion', position, { color, size, duration: 0.5 });
            
        case 'explosion':
            color = 0xff5500;
            size = 1.0;
            return this.createSpellEffect('explosion', position, { color, size, duration: 1.0 });
            
        case 'bullet':
        default:
            // Efeito simples de impacto de bala
            const effectId = `hit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const group = new THREE.Group();
            
            // Criar marcas de impacto alinhadas com a superfície
            const decalGeometry = new THREE.CircleGeometry(0.05, 8);
            const decalMaterial = new THREE.MeshBasicMaterial({
            color: 0x333333,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
            });
            
            const decal = new THREE.Mesh(decalGeometry, decalMaterial);
            
            // Alinhar com a normal da superfície
            if (normal) {
            const normalVector = new THREE.Vector3(normal.x, normal.y, normal.z).normalize();
            decal.lookAt(normalVector);
            }
            
            group.add(decal);
            
            // Adicionar pequenas partículas
            for (let i = 0; i < 5; i++) {
            const particleGeometry = new THREE.SphereGeometry(0.01, 4, 4);
            const particleMaterial = new THREE.MeshBasicMaterial({
                color: 0x888888,
                transparent: true,
                opacity: 0.7
            });
            
            const particle = new THREE.Mesh(particleGeometry, particleMaterial);
            
            // Distribuir partículas ao redor do ponto de impacto
            particle.position.set(
                (Math.random() - 0.5) * 0.1,
                (Math.random() - 0.5) * 0.1,
                (Math.random() - 0.5) * 0.1
            );
            
            group.add(particle);
            }
            
            // Posicionar o grupo na posição do impacto
            group.position.set(position.x, position.y, position.z);
            this.scene.add(group);
            
            // Registrar efeito com duração curta
            this.effects.add({
            id: effectId,
            effect: group,
            type: 'hit',
            position,
            createdAt: Date.now(),
            duration: 1.0
            });
            
            return effectId;
        }
    }
    
    /**
     * Loop de animação principal
     */
    animate() {
      if (!this.isInitialized) return;
      
      requestAnimationFrame(this.animate.bind(this));
      
      // Calcular delta time
      const now = performance.now();
      const deltaTime = (now - this.lastTimestamp) / 1000; // em segundos
      this.lastTimestamp = now;
      
      // Atualizar entidades (posições, rotações, etc.)
      this.update(deltaTime);
      
      // Renderizar a cena
      this.renderer.render(this.scene, this.camera);
    }
    
    /**
     * Libera recursos do sistema de renderização
     */
    dispose() {
      // Remover event listeners
      window.removeEventListener('resize', this.handleResize.bind(this));
      
      // Parar o loop de animação (não há método direto, depende do cancelAnimationFrame)
      this.isInitialized = false;
      
      // Limpar entidades
      this.entities.forEach((entityData, entityId) => {
        this.removeEntity(entityId);
      });
      
      // Limpar efeitos
      this.effects.forEach(effectData => {
        this.scene.remove(effectData.effect);
      });
      
      // Limpar cena
      while(this.scene.children.length > 0) { 
        this.scene.remove(this.scene.children[0]); 
      }
      
      // Remover canvas do container
      if (this.renderer && this.containerElement) {
        this.containerElement.removeChild(this.renderer.domElement);
      }
      
      // Liberar WebGL
      if (this.renderer) {
        this.renderer.dispose();
      }
      
      // Limpar referências
      this.scene = null;
      this.camera = null;
      this.renderer = null;
      this.entities.clear();
      this.lights.clear();
      this.models.clear();
      this.effects.clear();
      this.voxelCache.clear();
      this.playerEntity = null;
      this.containerElement = null;
    }
  }
  
  export default RenderSystem;