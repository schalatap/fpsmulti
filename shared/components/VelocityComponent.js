/**
 * @fileoverview Componente que representa a velocidade de uma entidade no mundo.
 * Usado para movimento, física e cálculos de trajetória.
 */

class VelocityComponent {
    /**
     * Cria um novo componente de velocidade
     * @param {Object} options - Opções de inicialização
     * @param {number} [options.x=0] - Velocidade no eixo X
     * @param {number} [options.y=0] - Velocidade no eixo Y
     * @param {number} [options.z=0] - Velocidade no eixo Z
     * @param {number} [options.speed=0] - Velocidade escalar total
     */
    constructor(options = {}) {
        this.x = options.x || 0;
        this.y = options.y || 0;
        this.z = options.z || 0;
        this.speed = options.speed || 0;
    }

    /**
     * Atualiza a velocidade
     * @param {number} x - Nova velocidade no eixo X
     * @param {number} y - Nova velocidade no eixo Y
     * @param {number} z - Nova velocidade no eixo Z
     */
    set(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.updateSpeed();
    }

    /**
     * Adiciona à velocidade atual
     * @param {number} x - Velocidade a adicionar no eixo X
     * @param {number} y - Velocidade a adicionar no eixo Y
     * @param {number} z - Velocidade a adicionar no eixo Z
     */
    add(x, y, z) {
        this.x += x;
        this.y += y;
        this.z += z;
        this.updateSpeed();
    }

    /**
     * Multiplica a velocidade atual por um fator
     * @param {number} factor - Fator de multiplicação
     */
    scale(factor) {
        this.x *= factor;
        this.y *= factor;
        this.z *= factor;
        this.updateSpeed();
    }

    /**
     * Atualiza a velocidade escalar com base nos componentes x, y, z
     */
    updateSpeed() {
        this.speed = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    }

    /**
     * Verifica se a entidade está em movimento
     * @returns {boolean} - Verdadeiro se a velocidade for diferente de zero
     */
    isMoving() {
        return this.speed > 0.001; // Pequena tolerância para erros de ponto flutuante
    }

    /**
     * Retorna a direção do movimento como um vetor normalizado
     * @returns {Object} - Componentes normalizados da direção
     */
    getDirection() {
        if (!this.isMoving()) {
            return { x: 0, y: 0, z: 0 };
        }

        return {
            x: this.x / this.speed,
            y: this.y / this.speed,
            z: this.z / this.speed
        };
    }

    /**
     * Define a velocidade a partir de uma direção e magnitude
     * @param {Object} direction - Direção do movimento (será normalizada)
     * @param {number} speed - Magnitude da velocidade
     */
    setFromDirection(direction, speed) {
        // Normalizar a direção
        const length = Math.sqrt(
            direction.x * direction.x + 
            direction.y * direction.y + 
            direction.z * direction.z
        );

        if (length > 0) {
            this.x = (direction.x / length) * speed;
            this.y = (direction.y / length) * speed;
            this.z = (direction.z / length) * speed;
            this.speed = speed;
        } else {
            this.x = 0;
            this.y = 0;
            this.z = 0;
            this.speed = 0;
        }
    }

    /**
     * Reduz gradualmente a velocidade (aplicar atrito/resistência)
     * @param {number} factor - Fator de desaceleração (0-1)
     */
    dampen(factor) {
        if (factor < 0 || factor > 1) {
            throw new Error("Fator de amortecimento deve estar entre 0 e 1");
        }
        this.scale(1 - factor);
    }

    /**
     * Limita a velocidade máxima
     * @param {number} maxSpeed - Velocidade máxima permitida
     */
    clamp(maxSpeed) {
        if (this.speed > maxSpeed) {
            const scale = maxSpeed / this.speed;
            this.x *= scale;
            this.y *= scale;
            this.z *= scale;
            this.speed = maxSpeed;
        }
    }

    /**
     * Reseta a velocidade para zero
     */
    reset() {
        this.x = 0;
        this.y = 0;
        this.z = 0;
        this.speed = 0;
    }

    /**
     * Cria uma cópia independente deste componente
     * @returns {VelocityComponent} Nova instância com os mesmos valores
     */
    clone() {
        return new VelocityComponent({
            x: this.x,
            y: this.y,
            z: this.z,
            speed: this.speed
        });
    }

    /**
     * Serializa o componente para transmissão pela rede
     * @returns {Object} Representação serializada
     */
    serialize() {
        return {
            x: this.x,
            y: this.y,
            z: this.z,
            speed: this.speed
        };
    }

    /**
     * Deserializa dados da rede para atualizar o componente
     * @param {Object} data - Dados recebidos da rede
     */
    deserialize(data) {
        this.x = data.x || 0;
        this.y = data.y || 0;
        this.z = data.z || 0;
        this.speed = data.speed || 0;
    }
}

// Exportar o componente
export default VelocityComponent;