// client/systems/NetworkSystem.js
import io from 'socket.io-client';
import { EventEmitter } from '../../shared/utils/EventEmitter.js';

export class NetworkSystem {
  constructor() {
    this.socket = null;
    this.eventEmitter = new EventEmitter();
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000; // 3 segundos
    this.remotePlayerEntities = {}; // Mapeamento de playerId para entityId
    this.serverTimeDelta = 0; // Diferença entre tempo do servidor e cliente
    this.localPlayerId = null;
    this.lastPingTime = 0;
    this.pingInterval = 2000; // 2 segundos
    this.latency = 0;
    this.serverUrl = window.location.hostname === 'localhost' 
      ? 'http://localhost:3000' 
      : window.location.origin;
  }

  initialize() {
    this.socket = io(this.serverUrl, {
      reconnection: false, // Vamos gerenciar nossa própria reconexão
      timeout: 10000
    });

    this.setupSocketEvents();
    
    // Iniciar medição de ping
    setInterval(() => this.measurePing(), this.pingInterval);

    console.log('NetworkSystem initialized, connecting to', this.serverUrl);
    return this;
  }

  setupSocketEvents() {
    this.socket.on('connect', () => {
      console.log('Connected to server');
      this.connected = true;
      this.reconnectAttempts = 0;
      this.eventEmitter.emit('network:connected');
      
      // Sincronizar tempo com o servidor
      this.synchronizeTime();
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected from server:', reason);
      this.connected = false;
      this.eventEmitter.emit('network:disconnected', { reason });
      
      // Tentar reconectar automaticamente
      if (reason !== 'io client disconnect') {
        setTimeout(() => this.tryReconnect(), this.reconnectDelay);
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      this.eventEmitter.emit('network:error', { error: error.message });
    });

    // Eventos específicos do jogo
    this.socket.on('player:joinConfirmed', (data) => {
      console.log('Join confirmed:', data);
      this.localPlayerId = data.playerId;
      this.eventEmitter.emit('player:joinConfirmed', data);
    });

    this.socket.on('player:join', (data) => {
      console.log('Player joined:', data);
      this.registerRemotePlayer(data.playerId, data.entityId);
      this.eventEmitter.emit('player:join', data);
    });

    this.socket.on('player:leave', (data) => {
      console.log('Player left:', data);
      this.unregisterRemotePlayer(data.playerId);
      this.eventEmitter.emit('player:leave', data);
    });

    this.socket.on('player:move', (data) => {
      this.eventEmitter.emit('player:move', data);
    });

    this.socket.on('player:shoot', (data) => {
      this.eventEmitter.emit('player:shoot', data);
    });

    this.socket.on('player:jump', (data) => {
      this.eventEmitter.emit('player:jump', data);
    });

    this.socket.on('player:reload', (data) => {
      this.eventEmitter.emit('player:reload', data);
    });

    this.socket.on('player:switchWeapon', (data) => {
      this.eventEmitter.emit('player:switchWeapon', data);
    });

    this.socket.on('player:castSpell', (data) => {
      this.eventEmitter.emit('player:castSpell', data);
    });

    this.socket.on('chat:message', (data) => {
      this.eventEmitter.emit('chat:message', data);
    });

    this.socket.on('game:state', (data) => {
      this.eventEmitter.emit('game:state', data);
    });

    this.socket.on('physics:positionCorrected', (data) => {
      this.eventEmitter.emit('physics:positionCorrected', data);
    });

    this.socket.on('projectile:create', (data) => {
      this.eventEmitter.emit('projectile:create', data);
    });

    this.socket.on('projectile:remove', (data) => {
      this.eventEmitter.emit('projectile:remove', data);
    });

    this.socket.on('projectile:hit', (data) => {
      this.eventEmitter.emit('projectile:hit', data);
    });

    this.socket.on('player:damage', (data) => {
      this.eventEmitter.emit('player:damage', data);
    });

    this.socket.on('player:death', (data) => {
      this.eventEmitter.emit('player:death', data);
    });

    this.socket.on('player:respawn', (data) => {
      this.eventEmitter.emit('player:respawn', data);
    });

    this.socket.on('spell:effect', (data) => {
      this.eventEmitter.emit('spell:effect', data);
    });

    this.socket.on('spell:remove', (data) => {
      this.eventEmitter.emit('spell:remove', data);
    });

    this.socket.on('effect:applied', (data) => {
      this.eventEmitter.emit('effect:applied', data);
    });

    this.socket.on('effect:removed', (data) => {
      this.eventEmitter.emit('effect:removed', data);
    });

    this.socket.on('match:start', (data) => {
      this.eventEmitter.emit('match:start', data);
    });

    this.socket.on('match:end', (data) => {
      this.eventEmitter.emit('match:end', data);
    });

    // Ping/pong para medir latência
    this.socket.on('pong', (serverTime) => {
      const currentTime = Date.now();
      this.latency = currentTime - this.lastPingTime;
      this.serverTimeDelta = serverTime - currentTime + Math.floor(this.latency / 2);
      this.eventEmitter.emit('network:ping', { latency: this.latency });
    });

    // Resposta de sincronização de tempo
    this.socket.on('time:sync', (serverTime) => {
      const currentTime = Date.now();
      this.serverTimeDelta = serverTime - currentTime;
      console.log(`Time synced. Server delta: ${this.serverTimeDelta}ms`);
    });
  }

  tryReconnect() {
    if (this.connected) return;
    
    this.reconnectAttempts++;
    console.log(`Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
    
    if (this.reconnectAttempts > this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.eventEmitter.emit('network:maxReconnectAttempts');
      return;
    }

    // Recria o socket
    if (this.socket) {
      this.socket.close();
    }
    
    this.socket = io(this.serverUrl, { reconnection: false, timeout: 10000 });
    this.setupSocketEvents();
  }

  registerRemotePlayer(playerId, entityId) {
    this.remotePlayerEntities[playerId] = entityId;
    console.log(`Registered remote player: ${playerId} -> Entity: ${entityId}`);
  }

  unregisterRemotePlayer(playerId) {
    delete this.remotePlayerEntities[playerId];
    console.log(`Unregistered remote player: ${playerId}`);
  }

  getRemotePlayerEntityId(playerId) {
    return this.remotePlayerEntities[playerId];
  }

  sendToServer(eventType, data) {
    if (!this.connected || !this.socket) {
      console.warn(`Cannot send ${eventType} - not connected`);
      return false;
    }

    // Adiciona timestamp do cliente para medição de latência e detecção de cheating
    const enhancedData = {
      ...data,
      clientTime: Date.now()
    };

    this.socket.emit(eventType, enhancedData);
    return true;
  }

  subscribeToEvent(eventType, callback) {
    return this.eventEmitter.subscribe(eventType, callback);
  }

  measurePing() {
    if (this.connected) {
      this.lastPingTime = Date.now();
      this.socket.emit('ping', this.lastPingTime);
    }
  }

  synchronizeTime() {
    if (this.connected) {
      this.socket.emit('time:sync', Date.now());
    }
  }

  // Converte timestamp do cliente para timestamp do servidor
  clientToServerTime(clientTime) {
    return clientTime + this.serverTimeDelta;
  }

  // Converte timestamp do servidor para timestamp do cliente
  serverToClientTime(serverTime) {
    return serverTime - this.serverTimeDelta;
  }

  getLatency() {
    return this.latency;
  }

  joinGame(playerName, team = null) {
    this.sendToServer('player:join', {
      name: playerName,
      team: team
    });
  }

  isConnected() {
    return this.connected;
  }

  update(deltaTime) {
    // A maior parte do trabalho é baseada em eventos,
    // mas você pode adicionar tarefas que precisam ser executadas periodicamente aqui
    
    // Por exemplo, enviar uma atualização de heartbeat a cada X segundos
  }

  dispose() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.eventEmitter.clearAllEvents();
    console.log('NetworkSystem disposed');
  }
}