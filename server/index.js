// server/index.js
import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { NetworkSystem } from './systems/NetworkSystem.js';
import { GameSystem } from './systems/GameSystem.js';
import { PhysicsSystem } from './systems/PhysicsSystem.js';
import { WeaponSystem } from './systems/WeaponSystem.js';
import { BallisticsSystem } from './systems/BallisticsSystem.js';
import { CombatSystem } from './systems/CombatSystem.js';
import { SpellSystem } from './systems/SpellSystem.js';
import { MatchmakingSystem } from './systems/MatchmakingSystem.js';

// Configuração para obter o diretório atual com ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuração do servidor
const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, '../client')));

// Rota principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Classe principal do servidor
class GameServer {
  constructor() {
    this.systems = {};
    this.isRunning = false;
    this.lastUpdateTime = 0;
    this.updateRate = 1000 / 60; // 60 updates por segundo
    this.updateInterval = null;
  }

  async initialize() {
    console.log('Inicializando servidor do jogo...');
    
    // Inicializar sistemas do servidor
    this.systems.physics = new PhysicsSystem();
    this.systems.game = new GameSystem();
    this.systems.weapon = new WeaponSystem();
    this.systems.ballistics = new BallisticsSystem();
    this.systems.combat = new CombatSystem();
    this.systems.spell = new SpellSystem();
    this.systems.matchmaking = new MatchmakingSystem();
    this.systems.network = new NetworkSystem(io);
    
    // Inicialização na ordem correta
    await this.systems.physics.initialize();
    console.log('Sistema de física inicializado');
    
    this.systems.game.initialize();
    console.log('Sistema de jogo inicializado');
    
    this.systems.weapon.initialize();
    console.log('Sistema de armas inicializado');
    
    this.systems.ballistics.initialize();
    console.log('Sistema de balística inicializado');
    
    this.systems.combat.initialize();
    console.log('Sistema de combate inicializado');
    
    this.systems.spell.initialize();
    console.log('Sistema de magias inicializado');
    
    this.systems.matchmaking.initialize();
    console.log('Sistema de matchmaking inicializado');
    
    this.systems.network.initialize();
    console.log('Sistema de rede inicializado');
    
    this.setupEventListeners();
    
    // Iniciar loop de atualização do servidor
    this.isRunning = true;
    this.lastUpdateTime = Date.now();
    this.updateInterval = setInterval(this.update.bind(this), this.updateRate);
    
    console.log('Servidor do jogo inicializado com sucesso');
  }

  setupEventListeners() {
    // Configure a comunicação entre os sistemas através de eventos
    // Este é um exemplo simplificado
    
    // Eventos de jogador
    this.systems.network.on('player:join', (socket, data) => {
      const player = this.systems.game.addPlayer(socket.id, data.name);
      if (player) {
        this.systems.network.sendToPlayer(socket.id, 'player:joinConfirmed', {
          playerId: socket.id,
          entityId: player.entityId,
          position: player.position
        });
        
        // Informar a todos sobre o novo jogador
        this.systems.network.broadcastToAll('player:join', {
          playerId: socket.id,
          name: data.name,
          team: player.team,
          entityId: player.entityId,
          position: player.position
        }, [socket.id]); // Excluir o próprio jogador
      }
    });
    
    this.systems.network.on('player:move', (socket, data) => {
      // Validar movimento pelo sistema de física
      if (this.systems.physics.validateMovement(socket.id, data.position, data.velocity)) {
        // Se for válido, informar a todos sobre o movimento
        this.systems.network.broadcastToAll('player:move', {
          playerId: socket.id,
          position: data.position,
          velocity: data.velocity,
          rotation: data.rotation,
          timestamp: data.timestamp
        }, [socket.id]); // Excluir o próprio jogador
      } else {
        // Se for inválido, enviar correção para o jogador
        const correctPosition = this.systems.game.getPlayerPosition(socket.id);
        this.systems.network.sendToPlayer(socket.id, 'physics:positionCorrected', {
          position: correctPosition
        });
      }
    });
    
    this.systems.network.on('player:shoot', (socket, data) => {
      // Processar tiro através do sistema de armas e balística
      const result = this.systems.weapon.handlePlayerShoot({
        playerId: socket.id,
        weaponId: data.weaponId,
        position: data.position,
        direction: data.direction,
        timestamp: data.timestamp
      });
      
      if (result) {
        // Informar a todos sobre o tiro
        this.systems.network.broadcastToAll('player:shoot', {
          playerId: socket.id,
          weaponId: data.weaponId,
          position: data.position,
          direction: data.direction,
          timestamp: data.timestamp
        });
      }
    });
    
    // Adicionar outros manipuladores de eventos conforme necessário...
  }

  update() {
    if (!this.isRunning) return;
    
    const now = Date.now();
    const deltaTime = (now - this.lastUpdateTime) / 1000;
    this.lastUpdateTime = now;
    
    // Atualizar todos os sistemas
    this.systems.physics.update(deltaTime);
    this.systems.game.update(deltaTime);
    this.systems.weapon.update(deltaTime);
    this.systems.ballistics.update(deltaTime);
    this.systems.combat.update(deltaTime);
    this.systems.spell.update(deltaTime);
    this.systems.matchmaking.update(deltaTime);
    
    // Enviar atualizações de estado apenas a cada X atualizações para economizar largura de banda
    this.updateCounter = (this.updateCounter || 0) + 1;
    if (this.updateCounter >= 10) { // A cada 10 frames ~6 vezes por segundo
      this.systems.network.broadcastGameState();
      this.updateCounter = 0;
    }
  }

  shutdown() {
    console.log('Desligando servidor do jogo...');
    this.isRunning = false;
    
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    // Desligar sistemas na ordem inversa
    Object.values(this.systems).reverse().forEach(system => {
      if (system && typeof system.dispose === 'function') {
        system.dispose();
      }
    });
    
    this.systems = {};
    console.log('Servidor do jogo desligado com sucesso');
  }
}

// HTML básico para a página principal
const htmlTemplate = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FPS Mágico Multiplayer</title>
    <style>
        body, html {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
            background-color: #000;
            font-family: Arial, sans-serif;
        }
    </style>
</head>
<body>
    <div id="game-container"></div>
    
    <!-- Scripts -->
    <script type="module" src="index.js"></script>
</body>
</html>
`;

// Criar arquivo HTML se não existir
import fs from 'fs';
const clientDir = path.join(__dirname, '../client');
const htmlPath = path.join(clientDir, 'index.html');

if (!fs.existsSync(clientDir)) {
    fs.mkdirSync(clientDir, { recursive: true });
}

if (!fs.existsSync(htmlPath)) {
    fs.writeFileSync(htmlPath, htmlTemplate);
    console.log('Arquivo index.html criado em', htmlPath);
}

// Inicializar e iniciar o servidor
const gameServer = new GameServer();

// Iniciar o servidor HTTP
server.listen(PORT, async () => {
  console.log(`Servidor HTTP rodando na porta ${PORT}`);
  
  try {
    await gameServer.initialize();
    console.log(`Servidor de jogo pronto para conexões em http://localhost:${PORT}`);
    
    // Manipular desligamento gracioso
    process.on('SIGINT', () => {
      console.log('Recebido sinal SIGINT, desligando...');
      gameServer.shutdown();
      server.close(() => {
        console.log('Servidor HTTP fechado');
        process.exit(0);
      });
    });
  } catch (error) {
    console.error('Erro ao inicializar servidor de jogo:', error);
    process.exit(1);
  }
});