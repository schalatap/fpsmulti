// client/index.js
import { CoreSystem } from './systems/CoreSystem.js';

// Configuração do cliente
const config = {
  serverUrl: window.location.hostname === 'localhost' 
    ? 'http://localhost:3000'  // Desenvolvimento local
    : window.location.origin,  // Produção
  container: document.getElementById('game-container') || document.body,
};

// Inicialização do jogo quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Criar e inicializar o sistema principal
    window.game = new CoreSystem();
    
    // Interface de login simples
    const loginForm = document.createElement('div');
    loginForm.id = 'login-form';
    loginForm.innerHTML = `
      <div class="login-container">
        <h2>FPS Mágico</h2>
        <input type="text" id="player-name" placeholder="Seu nome" maxlength="16" value="Player_${Math.floor(Math.random() * 1000)}">
        <button id="start-game">Entrar no Jogo</button>
      </div>
    `;
    document.body.appendChild(loginForm);
    
    // Estilo básico para o formulário de login
    const style = document.createElement('style');
    style.textContent = `
      .login-container {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.7);
        padding: 20px;
        border-radius: 8px;
        text-align: center;
        color: white;
        font-family: Arial, sans-serif;
      }
      .login-container input, .login-container button {
        display: block;
        width: 100%;
        margin: 10px 0;
        padding: 8px;
        box-sizing: border-box;
      }
      .login-container button {
        background: #4c83af;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        transition: background 0.3s;
      }
      .login-container button:hover {
        background: #3a6d98;
      }
      #game-container {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0;
        overflow: hidden;
      }
      #ui-container {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 100;
      }
      .ui-element {
        pointer-events: auto;
      }
    `;
    document.head.appendChild(style);
    
    // Criar contêineres
    const gameContainer = document.getElementById('game-container') || document.createElement('div');
    gameContainer.id = 'game-container';
    document.body.appendChild(gameContainer);
    
    const uiContainer = document.createElement('div');
    uiContainer.id = 'ui-container';
    document.body.appendChild(uiContainer);
    
    // Iniciar jogo ao clicar no botão
    document.getElementById('start-game').addEventListener('click', async () => {
      const playerName = document.getElementById('player-name').value.trim() || config.playerName;
      
      // Atualizar configuração com o nome do jogador
      const fullConfig = {
        ...config,
        playerName,
        container: gameContainer
      };
      
      // Remover o formulário de login
      loginForm.style.display = 'none';
      
      // Inicializar o jogo
      try {
        await window.game.initialize(fullConfig);
        console.log('Jogo inicializado com sucesso');
      } catch (error) {
        console.error('Erro ao inicializar o jogo:', error);
        alert('Erro ao inicializar o jogo. Verifique o console para mais detalhes.');
      }
    });
    
  } catch (error) {
    console.error('Erro fatal ao inicializar aplicação:', error);
    alert('Erro ao inicializar a aplicação. Verifique o console para mais detalhes.');
  }
});