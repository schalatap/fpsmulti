/**
 * @fileoverview Componente que gerencia a câmera em primeira pessoa
 * para um jogador controlado localmente.
 */

class FirstPersonComponent {
    /**
     * Cria um novo componente de primeira pessoa
     * @param {Object} options - Opções de inicialização
     * @param {number} [options.cameraHeight=1.7] - Altura da câmera em relação ao jogador (metros)
     * @param {number} [options.lookSpeed=0.002] - Sensibilidade do mouse
     * @param {number} [options.bobFactor=0.08] - Intensidade do balanço ao andar
     * @param {number} [options.fov=75] - Campo de visão em graus
     * @param {number} [options.minPitch=-85] - Limite mínimo de inclinação vertical (em graus)
     * @param {number} [options.maxPitch=85] - Limite máximo de inclinação vertical (em graus)
     * @param {boolean} [options.enableHeadBob=true] - Ativar balanço da câmera ao andar
     * @param {boolean} [options.enableRecoil=true] - Ativar recuo visual ao atirar
     * @param {boolean} [options.smoothRotation=true] - Suavizar rotação da câmera
     * @param {number} [options.rotationSmoothing=0.2] - Fator de suavização (menor = mais suave)
     * @param {Object} [options.weaponPosition] - Posição relativa da arma na tela
     * @param {number} [options.weaponPosition.x=0.3] - Posição X relativa da arma
     * @param {number} [options.weaponPosition.y=-0.3] - Posição Y relativa da arma
     * @param {number} [options.weaponPosition.z=-0.5] - Posição Z relativa da arma
     * @param {boolean} [options.viewmodelVisible=true] - Se o modelo da arma é visível
     * @param {Object} [options.recoilSettings] - Configurações de recuo visual
     * @param {number} [options.recoilSettings.maxX=5] - Recuo máximo no eixo X (em graus)
     * @param {number} [options.recoilSettings.maxY=10] - Recuo máximo no eixo Y (em graus)
     * @param {number} [options.recoilSettings.recoverySpeed=5] - Velocidade de recuperação do recuo
     */
    constructor(options = {}) {
        // Configurações da câmera
        this.cameraHeight = options.cameraHeight !== undefined ? options.cameraHeight : 1.7;
        this.lookSpeed = options.lookSpeed !== undefined ? options.lookSpeed : 0.002;
        this.bobFactor = options.bobFactor !== undefined ? options.bobFactor : 0.08;
        this.fov = options.fov !== undefined ? options.fov : 75;
        
        // Limites de rotação vertical
        this.minPitch = options.minPitch !== undefined ? options.minPitch : -85;
        this.maxPitch = options.maxPitch !== undefined ? options.maxPitch : 85;
        
        // Efeitos visuais
        this.enableHeadBob = options.enableHeadBob !== undefined ? options.enableHeadBob : true;
        this.enableRecoil = options.enableRecoil !== undefined ? options.enableRecoil : true;
        this.smoothRotation = options.smoothRotation !== undefined ? options.smoothRotation : true;
        this.rotationSmoothing = options.rotationSmoothing !== undefined ? options.rotationSmoothing : 0.2;
        
        // Posição da arma na tela
        this.weaponPosition = {
            x: options.weaponPosition?.x !== undefined ? options.weaponPosition.x : 0.3,
            y: options.weaponPosition?.y !== undefined ? options.weaponPosition.y : -0.3,
            z: options.weaponPosition?.z !== undefined ? options.weaponPosition.z : -0.5
        };
        
        // Visibilidade do viewmodel
        this.viewmodelVisible = options.viewmodelVisible !== undefined ? options.viewmodelVisible : true;
        
        // Estado atual
        this.pitch = 0; // Rotação vertical em graus (olhar para cima/baixo)
        this.yaw = 0; // Rotação horizontal em graus (olhar para esquerda/direita)
        this.bobPhase = 0; // Fase atual do ciclo de balanço
        this.bobActive = false; // Se o balanço está ativo (andando)
        
        // Configurações de recuo
        this.recoilSettings = {
            maxX: options.recoilSettings?.maxX !== undefined ? options.recoilSettings.maxX : 5,
            maxY: options.recoilSettings?.maxY !== undefined ? options.recoilSettings.maxY : 10,
            recoverySpeed: options.recoilSettings?.recoverySpeed !== undefined ? options.recoilSettings.recoverySpeed : 5
        };
        
        // Estado atual de recuo
        this.recoil = {
            x: 0, // Rotação atual de recuo no eixo X
            y: 0, // Rotação atual de recuo no eixo Y
            active: false // Se há recuo ativo
        };
        
        // Efeitos visuais adicionais
        this.damageEffect = 0; // Intensidade do efeito de dano (0-1)
        this.healEffect = 0; // Intensidade do efeito de cura (0-1)
        this.flashEffect = 0; // Intensidade do flash (0-1)
        
        // Rotação alvo para suavização
        this.targetPitch = 0;
        this.targetYaw = 0;
        
        // Referências para objetos Three.js (preenchidas pelo RenderSystem)
        this.camera = null;
        this.viewmodel = null;
    }

    /**
     * Atualiza a rotação da câmera
     * @param {number} deltaPitch - Mudança na rotação vertical
     * @param {number} deltaYaw - Mudança na rotação horizontal
     */
    rotate(deltaPitch, deltaYaw) {
        // Aplicar a sensibilidade
        deltaPitch *= this.lookSpeed;
        deltaYaw *= this.lookSpeed;
        
        if (this.smoothRotation) {
            // Atualizar rotação alvo
            this.targetPitch += deltaPitch;
            this.targetYaw += deltaYaw;
            
            // Limitar rotação vertical alvo
            this.targetPitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.targetPitch));
        } else {
            // Aplicar diretamente
            this.pitch += deltaPitch;
            this.yaw += deltaYaw;
            
            // Limitar rotação vertical
            this.pitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.pitch));
        }
    }

    /**
     * Aplica recuo visual da arma
     * @param {number} strengthX - Força do recuo no eixo X
     * @param {number} strengthY - Força do recuo no eixo Y
     */
    applyRecoil(strengthX, strengthY) {
        if (!this.enableRecoil) return;
        
        // Adicionar recuo atual
        this.recoil.x += strengthX;
        this.recoil.y += strengthY;
        
        // Limitar aos valores máximos
        this.recoil.x = Math.min(this.recoilSettings.maxX, this.recoil.x);
        this.recoil.y = Math.min(this.recoilSettings.maxY, this.recoil.y);
        
        this.recoil.active = true;
    }

    /**
     * Atualiza o estado do balanço da câmera
     * @param {boolean} isMoving - Se o jogador está em movimento
     * @param {number} speed - Velocidade do movimento (para escalar o balanço)
     */
    updateHeadBob(isMoving, speed) {
        this.bobActive = this.enableHeadBob && isMoving;
        if (this.bobActive) {
            // A velocidade afeta a frequência do balanço
            const bobSpeed = speed * 0.15;
            this.bobPhase += bobSpeed;
        }
    }

    /**
     * Aplica um efeito de dano na tela
     * @param {number} intensity - Intensidade do efeito (0-1)
     */
    applyDamageEffect(intensity) {
        this.damageEffect = Math.min(1, this.damageEffect + intensity);
    }

    /**
     * Aplica um efeito de cura na tela
     * @param {number} intensity - Intensidade do efeito (0-1)
     */
    applyHealEffect(intensity) {
        this.healEffect = Math.min(1, this.healEffect + intensity);
    }

    /**
     * Aplica um efeito de flash na tela
     * @param {number} intensity - Intensidade do efeito (0-1)
     */
    applyFlashEffect(intensity) {
        this.flashEffect = Math.min(1, this.flashEffect + intensity);
    }

    /**
     * Define a posição relativa da arma na tela
     * @param {number} x - Posição X
     * @param {number} y - Posição Y
     * @param {number} z - Posição Z
     */
    setWeaponPosition(x, y, z) {
        this.weaponPosition.x = x;
        this.weaponPosition.y = y;
        this.weaponPosition.z = z;
    }

    /**
     * Define a visibilidade do viewmodel (arma)
     * @param {boolean} visible - Se o viewmodel deve ser visível
     */
    setViewmodelVisible(visible) {
        this.viewmodelVisible = visible;
    }

    /**
     * Define a altura da câmera (útil para agachar)
     * @param {number} height - Nova altura da câmera
     */
    setCameraHeight(height) {
        this.cameraHeight = height;
    }

    /**
     * Define o campo de visão (FOV)
     * @param {number} fov - Novo FOV em graus
     */
    setFOV(fov) {
        this.fov = fov;
    }

    /**
     * Define a sensibilidade do mouse
     * @param {number} sensitivity - Nova sensibilidade
     */
    setSensitivity(sensitivity) {
        this.lookSpeed = sensitivity;
    }

    /**
     * Atualiza o estado do componente
     * @param {number} deltaTime - Tempo desde o último frame em segundos
     */
    update(deltaTime) {
        // Suavizar rotação se habilitado
        if (this.smoothRotation) {
            // Interpolar entre rotação atual e alvo
            this.pitch += (this.targetPitch - this.pitch) * this.rotationSmoothing;
            this.yaw += (this.targetYaw - this.yaw) * this.rotationSmoothing;
        }
        
        // Reduzir gradualmente efeitos visuais
        this.damageEffect = Math.max(0, this.damageEffect - deltaTime * 2);
        this.healEffect = Math.max(0, this.healEffect - deltaTime * 2);
        this.flashEffect = Math.max(0, this.flashEffect - deltaTime * 3);
        
        // Recuperar do recuo
        if (this.recoil.active) {
            const recovery = this.recoilSettings.recoverySpeed * deltaTime;
            
            this.recoil.x = Math.max(0, this.recoil.x - recovery);
            this.recoil.y = Math.max(0, this.recoil.y - recovery);
            
            // Desativar quando o recuo estiver zerado
            if (this.recoil.x <= 0 && this.recoil.y <= 0) {
                this.recoil.active = false;
            }
        }
    }

    /**
     * Calcula o deslocamento do balanço da câmera
     * @returns {Object} Deslocamento {x, y, z}
     */
    calculateHeadBobOffset() {
        if (!this.bobActive) return { x: 0, y: 0, z: 0 };
        
        // Calcular movimento senoidal com base na fase atual
        const xOffset = Math.sin(this.bobPhase * 2) * this.bobFactor * 0.5;
        const yOffset = Math.abs(Math.sin(this.bobPhase)) * this.bobFactor;
        
        return { x: xOffset, y: yOffset, z: 0 };
    }

    /**
     * Calcula a rotação total (incluindo recuo)
     * @returns {Object} Rotação {pitch, yaw}
     */
    getTotalRotation() {
        return {
            pitch: this.pitch - this.recoil.y, // Recuo puxa a mira para cima (pitch negativo)
            yaw: this.yaw + this.recoil.x // Recuo horizontal
        };
    }

    /**
     * Obtém a posição da câmera baseada na altura e efeitos
     * @param {Object} playerPosition - Posição do jogador {x, y, z}
     * @returns {Object} Posição da câmera {x, y, z}
     */
    getCameraPosition(playerPosition) {
        const bobOffset = this.calculateHeadBobOffset();
        
        return {
            x: playerPosition.x + bobOffset.x,
            y: playerPosition.y + this.cameraHeight + bobOffset.y,
            z: playerPosition.z + bobOffset.z
        };
    }

    /**
     * Serializa o componente para transmissão pela rede
     * @returns {Object} Representação serializada
     */
    serialize() {
        return {
            pitch: this.pitch,
            yaw: this.yaw,
            cameraHeight: this.cameraHeight,
            viewmodelVisible: this.viewmodelVisible
        };
    }

    /**
     * Deserializa dados da rede para atualizar o componente
     * @param {Object} data - Dados recebidos da rede
     */
    deserialize(data) {
        if (data.pitch !== undefined) this.pitch = data.pitch;
        if (data.yaw !== undefined) this.yaw = data.yaw;
        if (data.cameraHeight !== undefined) this.cameraHeight = data.cameraHeight;
        if (data.viewmodelVisible !== undefined) this.viewmodelVisible = data.viewmodelVisible;
    }

    /**
     * Cria uma cópia independente deste componente
     * @returns {FirstPersonComponent} Nova instância com os mesmos valores
     */
    clone() {
        return new FirstPersonComponent({
            cameraHeight: this.cameraHeight,
            lookSpeed: this.lookSpeed,
            bobFactor: this.bobFactor,
            fov: this.fov,
            minPitch: this.minPitch,
            maxPitch: this.maxPitch,
            enableHeadBob: this.enableHeadBob,
            enableRecoil: this.enableRecoil,
            smoothRotation: this.smoothRotation,
            rotationSmoothing: this.rotationSmoothing,
            weaponPosition: {...this.weaponPosition},
            viewmodelVisible: this.viewmodelVisible,
            recoilSettings: {...this.recoilSettings}
        });
    }
}

// Exportar o componente
export default FirstPersonComponent;