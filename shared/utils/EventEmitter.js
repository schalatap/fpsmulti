/**
 * Sistema de eventos simples para comunicação entre componentes
 */
export class EventEmitter {
    constructor() {
      this.events = {};
      this.eventId = 0;
    }
  
    /**
     * Assina um evento
     * @param {string} eventName - Nome do evento
     * @param {function} callback - Função de callback
     * @returns {function} Função para cancelar a assinatura
     */
    subscribe(eventName, callback) {
      if (!this.events[eventName]) {
        this.events[eventName] = {};
      }
  
      const id = this.eventId++;
      this.events[eventName][id] = callback;
  
      // Retorna função para cancelar a assinatura
      return () => {
        delete this.events[eventName][id];
        if (Object.keys(this.events[eventName]).length === 0) {
          delete this.events[eventName];
        }
      };
    }
  
    /**
     * Emite um evento
     * @param {string} eventName - Nome do evento
     * @param {any} data - Dados para enviar com o evento
     */
    emit(eventName, data) {
      if (!this.events[eventName]) {
        return;
      }
  
      Object.values(this.events[eventName]).forEach(callback => {
        callback(data);
      });
    }
  
    /**
     * Remove todos os ouvintes para um evento
     * @param {string} eventName - Nome do evento
     */
    clearEvent(eventName) {
      delete this.events[eventName];
    }
  
    /**
     * Remove todos os ouvintes para todos os eventos
     */
    clearAllEvents() {
      this.events = {};
    }
  
    /**
     * Obtém os nomes de todos os eventos ativos
     * @returns {string[]} Array com nomes dos eventos
     */
    getEventNames() {
      return Object.keys(this.events);
    }
  
    /**
     * Verifica se um evento tem ouvintes
     * @param {string} eventName - Nome do evento
     * @returns {boolean} True se o evento tiver ouvintes
     */
    hasListeners(eventName) {
      return !!this.events[eventName] && Object.keys(this.events[eventName]).length > 0;
    }
  
    /**
     * Retorna o número de ouvintes para um evento
     * @param {string} eventName - Nome do evento
     * @returns {number} Número de ouvintes
     */
    listenerCount(eventName) {
      if (!this.events[eventName]) {
        return 0;
      }
      return Object.keys(this.events[eventName]).length;
    }
  }
  
  export default EventEmitter;