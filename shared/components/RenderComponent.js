/**
 * @fileoverview Componente que contém informações para renderização visual de uma entidade.
 * Usado pelo RenderSystem para criar e gerenciar representações visuais.
 */

class RenderComponent {
    /**
     * Cria um novo componente de renderização
     * @param {Object} options - Opções de inicialização
     * @param {string} [options.modelType='basic'] - Tipo do modelo ('player', 'weapon', 'projectile', 'spell', 'obstacle', 'basic')
     * @param {string} [options.color='#ffffff'] - Cor principal no formato hexadecimal
     * @param {string} [options.shape='cube'] - Forma básica ('cube', 'sphere', 'cylinder', 'cone', 'custom')
     * @param {Object} [options.voxelData=null] - Dados para geração do modelo voxel
     * @param {boolean} [options.visible=true] - Flag de visibilidade
     * @param {Object} [options.dimensions] - Dimensões para formas básicas
     * @param {number} [options.dimensions.width=1] - Largura
     * @param {number} [options.dimensions.height=1] - Altura
     * @param {number} [options.dimensions.depth=1] - Profundidade
     * @param {number} [options.dimensions.radius=0.5] - Raio (para esferas e cilindros)
     * @param {Object} [options.material] - Propriedades do material
     * @param {boolean} [options.material.wireframe=false] - Renderizar como wireframe
     * @param {number} [options.material.opacity=1] - Opacidade (0-1)
     * @param {boolean} [options.material.transparent=false] - Material transparente
     * @param {boolean} [options.material.emissive=false] - Material emite luz própria
     * @param {string} [options.material.emissiveColor='#000000'] - Cor da emissão
     * @param {number} [options.material.emissiveIntensity=1] - Intensidade da emissão
     * @param {Object} [options.effects] - Efeitos visuais adicionais
     * @param {boolean} [options.effects.trail=false] - Efeito de rastro
     * @param {string} [options.effects.trailColor='#ffffff'] - Cor do rastro
     * @param {number} [options.effects.trailLength=20] - Comprimento do rastro
     * @param {boolean} [options.effects.glow=false] - Efeito de brilho
     * @param {string} [options.effects.glowColor='#ffffff'] - Cor do brilho
     * @param {number} [options.effects.glowIntensity=1] - Intensidade do brilho
     * @param {Object} [options.animation] - Informações de animação
     * @param {string} [options.animation.type='none'] - Tipo de animação ('none', 'rotate', 'pulse', 'bounce')
     * @param {number} [options.animation.speed=1] - Velocidade da animação
     * @param {boolean} [options.castShadow=false] - Se o objeto projeta sombras
     * @param {boolean} [options.receiveShadow=false] - Se o objeto recebe sombras
     * @param {string} [options.team=''] - Equipe para coloração específica (vazio, 'red', 'blue')
     */
    constructor(options = {}) {
        // Propriedades básicas
        this.modelType = options.modelType || 'basic';
        this.color = options.color || '#ffffff';
        this.shape = options.shape || 'cube';
        this.voxelData = options.voxelData || null;
        this.visible = options.visible !== undefined ? options.visible : true;

        // Dimensões
        this.dimensions = {
            width: options.dimensions?.width || 1,
            height: options.dimensions?.height || 1,
            depth: options.dimensions?.depth || 1,
            radius: options.dimensions?.radius || 0.5
        };

        // Propriedades do material
        this.material = {
            wireframe: options.material?.wireframe || false,
            opacity: options.material?.opacity || 1,
            transparent: options.material?.transparent || false,
            emissive: options.material?.emissive || false,
            emissiveColor: options.material?.emissiveColor || '#000000',
            emissiveIntensity: options.material?.emissiveIntensity || 1
        };

        // Efeitos visuais
        this.effects = {
            trail: options.effects?.trail || false,
            trailColor: options.effects?.trailColor || '#ffffff',
            trailLength: options.effects?.trailLength || 20,
            glow: options.effects?.glow || false,
            glowColor: options.effects?.glowColor || '#ffffff',
            glowIntensity: options.effects?.glowIntensity || 1
        };

        // Animação
        this.animation = {
            type: options.animation?.type || 'none',
            speed: options.animation?.speed || 1
        };

        // Propriedades de sombras
        this.castShadow = options.castShadow || false;
        this.receiveShadow = options.receiveShadow || false;

        // Equipe para coloração específica
        this.team = options.team || '';

        // Referência ao objeto 3D (preenchido pelo RenderSystem)
        this.object3D = null;
        this.effectObjects = [];
    }

    /**
     * Define a visibilidade do objeto
     * @param {boolean} isVisible - Se o objeto deve ser visível
     */
    setVisibility(isVisible) {
        this.visible = isVisible;
    }

    /**
     * Define a cor do objeto
     * @param {string} color - Cor no formato hexadecimal
     */
    setColor(color) {
        this.color = color;
    }

    /**
     * Define a equipe para coloração específica
     * @param {string} team - Identificador da equipe ('', 'red', 'blue')
     */
    setTeam(team) {
        this.team = team;
    }

    /**
     * Adiciona um efeito visual
     * @param {string} effectType - Tipo de efeito ('trail', 'glow')
     * @param {Object} params - Parâmetros do efeito
     */
    addEffect(effectType, params = {}) {
        if (effectType === 'trail') {
            this.effects.trail = true;
            if (params.color) this.effects.trailColor = params.color;
            if (params.length) this.effects.trailLength = params.length;
        } else if (effectType === 'glow') {
            this.effects.glow = true;
            if (params.color) this.effects.glowColor = params.color;
            if (params.intensity) this.effects.glowIntensity = params.intensity;
        }
    }

    /**
     * Remove um efeito visual
     * @param {string} effectType - Tipo de efeito ('trail', 'glow')
     */
    removeEffect(effectType) {
        if (effectType === 'trail') {
            this.effects.trail = false;
        } else if (effectType === 'glow') {
            this.effects.glow = false;
        }
    }

    /**
     * Configura uma animação para o objeto
     * @param {string} type - Tipo de animação ('none', 'rotate', 'pulse', 'bounce')
     * @param {number} speed - Velocidade da animação
     */
    setAnimation(type, speed = 1) {
        this.animation.type = type;
        this.animation.speed = speed;
    }

    /**
     * Define a transparência do objeto
     * @param {number} opacity - Valor de opacidade (0-1)
     */
    setOpacity(opacity) {
        this.material.opacity = Math.max(0, Math.min(1, opacity));
        this.material.transparent = opacity < 1;
    }

    /**
     * Configura o material como emissivo (brilho próprio)
     * @param {boolean} emissive - Se deve emitir luz
     * @param {string} color - Cor de emissão
     * @param {number} intensity - Intensidade da emissão
     */
    setEmissive(emissive, color = '#ffffff', intensity = 1) {
        this.material.emissive = emissive;
        this.material.emissiveColor = color;
        this.material.emissiveIntensity = intensity;
    }

    /**
     * Configura as propriedades de sombra
     * @param {boolean} cast - Se projeta sombras
     * @param {boolean} receive - Se recebe sombras
     */
    setShadow(cast, receive) {
        this.castShadow = cast;
        this.receiveShadow = receive;
    }

    /**
     * Obtém o tipo de modelo
     * @returns {string} Tipo do modelo
     */
    getModelType() {
        return this.modelType;
    }

    /**
     * Obtém a cor baseada na equipe (se aplicável)
     * @returns {string} Cor no formato hexadecimal
     */
    getEffectiveColor() {
        // Se não tiver equipe, usa a cor padrão
        if (!this.team) return this.color;

        // Cores das equipes
        const teamColors = {
            red: '#ff3030',
            blue: '#3030ff'
        };

        return teamColors[this.team] || this.color;
    }

    /**
     * Serializa o componente para transmissão pela rede
     * @returns {Object} Representação serializada
     */
    serialize() {
        return {
            modelType: this.modelType,
            color: this.color,
            shape: this.shape,
            visible: this.visible,
            dimensions: this.dimensions,
            team: this.team,
            // Incluir apenas dados essenciais para sincronização
            material: {
                opacity: this.material.opacity,
                transparent: this.material.transparent,
                emissive: this.material.emissive
            },
            effects: {
                trail: this.effects.trail,
                glow: this.effects.glow
            },
            animation: this.animation.type
        };
    }

    /**
     * Deserializa dados da rede para atualizar o componente
     * @param {Object} data - Dados recebidos da rede
     */
    deserialize(data) {
        if (data.modelType) this.modelType = data.modelType;
        if (data.color) this.color = data.color;
        if (data.shape) this.shape = data.shape;
        if (data.visible !== undefined) this.visible = data.visible;
        if (data.dimensions) this.dimensions = {...this.dimensions, ...data.dimensions};
        if (data.team) this.team = data.team;
        
        if (data.material) {
            this.material.opacity = data.material.opacity || this.material.opacity;
            this.material.transparent = data.material.transparent || this.material.transparent;
            this.material.emissive = data.material.emissive || this.material.emissive;
        }
        
        if (data.effects) {
            this.effects.trail = data.effects.trail || this.effects.trail;
            this.effects.glow = data.effects.glow || this.effects.glow;
        }
        
        if (data.animation) {
            this.animation.type = data.animation;
        }
    }

    /**
     * Cria uma cópia independente deste componente
     * @returns {RenderComponent} Nova instância com os mesmos valores
     */
    clone() {
        return new RenderComponent({
            modelType: this.modelType,
            color: this.color,
            shape: this.shape,
            voxelData: this.voxelData ? JSON.parse(JSON.stringify(this.voxelData)) : null,
            visible: this.visible,
            dimensions: {...this.dimensions},
            material: {...this.material},
            effects: {...this.effects},
            animation: {...this.animation},
            castShadow: this.castShadow,
            receiveShadow: this.receiveShadow,
            team: this.team
        });
    }
}

// Exportar o componente
export default RenderComponent;