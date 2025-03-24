export class ProjectileComponent {
    constructor(data = {}) {
        this.weaponType = data.weaponType || 'pistol';
        this.shooterId = data.shooterId || null;
        this.damage = data.damage || 0;
        this.speed = data.speed || 0;
        this.lifetime = data.lifetime || 3; // in seconds
        this.penetration = data.penetration || 0;
        this.creationTime = data.creationTime || Date.now();
    }
    
    serialize() {
        return {
            weaponType: this.weaponType,
            shooterId: this.shooterId,
            damage: this.damage,
            speed: this.speed,
            lifetime: this.lifetime,
            penetration: this.penetration,
            creationTime: this.creationTime
        };
    }
    
    static deserialize(data) {
        return new ProjectileComponent(data);
    }
}