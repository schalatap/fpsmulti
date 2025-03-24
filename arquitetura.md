# FPS Mágico Multiplayer - Arquitetura

## Visão Geral

Este projeto é um jogo FPS multiplayer com elementos mágicos, desenvolvido com tecnologias web modernas, seguindo o padrão de arquitetura Entity Component System (ECS) para proporcionar alta modularidade e facilitar o desenvolvimento incremental.

### Tecnologias Principais
- **Cliente**: 
  - Three.js (renderização 3D)
  - Ammo.js (física e balística)
  - Socket.IO (comunicação em tempo real)

- **Servidor**: 
  - Node.js
  - Express
  - Socket.IO
  - Ammo.js (validação de física no servidor)

### Estilo Visual
- Estilo voxel/low-poly
- Gráficos gerados proceduralmente via código
- Sem necessidade de modelos 3D ou texturas externas
- Sem necessidade de áudio externo ou quaisquer arquivos externos
- Formas geométricas simples com cores básicas

### Conceito do Jogo
- FPS multiplayer estilo Counter-Strike com elementos mágicos
- Jogadores ganham pontos de atributo ao morrer para melhorar suas habilidades
- Sistema de magias, buffs e debuffs além das armas convencionais
- Mapas compactos focados em confronto rápido entre jogadores
- Física realista para projéteis e balística

## Estrutura do Projeto

```
/
├── client/                 # Código do cliente (frontend)
│   ├── components/         # Componentes ECS
│   ├── systems/            # Sistemas ECS para o cliente
│   │   ├── RenderSystem.js # Sistema de renderização
│   │   ├── InputSystem.js  # Sistema de entrada do jogador
│   │   ├── PhysicsSystem.js # Sistema de física e colisões com Ammo.js
│   │   ├── WeaponSystem.js # Sistema de armas
│   │   ├── SpellSystem.js  # Sistema de magias
│   │   └── UISystem.js     # Sistema de interface do usuário
│   ├── utils/              # Funções utilitárias
│   ├── styles/             # Estilos CSS
│   ├── assets/             # Recursos gerados proceduralmente
│   └── index.js            # Ponto de entrada do cliente
│
├── server/                 # Código do servidor (backend)
│   ├── components/         # Componentes ECS específicos do servidor
│   ├── systems/            # Sistemas ECS para o servidor
│   │   ├── GameSystem.js   # Sistema de regras do jogo
│   │   ├── PhysicsSystem.js # Sistema de física com Ammo.js
│   │   ├── CombatSystem.js # Sistema de combate
│   │   ├── BallisticsSystem.js # Sistema de balística
│   │   └── MatchmakingSystem.js # Sistema de matchmaking
│   ├── maps/               # Definições de mapas
│   ├── utils/              # Funções utilitárias do servidor
│   └── index.js            # Ponto de entrada do servidor
│
├── shared/                 # Código compartilhado entre cliente e servidor
│   ├── components/         # Definições de componentes
│   ├── constants/          # Constantes compartilhadas
│   ├── events/             # Definições de eventos
│   ├── weapons/            # Definições de armas
│   ├── spells/             # Definições de magias
│   └── utils/              # Funções utilitárias compartilhadas
│
├── ARCHITECTURE.md         # Este documento
├── DEV_GUIDE.md            # Guia para desenvolvimento
├── package.json
└── README.md
```

## Paradigma ECS

O projeto segue o padrão Entity Component System (ECS) para maximizar a modularidade:

### Entidades
- Representam objetos do jogo (jogadores, projéteis, itens, etc.)
- São apenas identificadores que agrupam componentes
- Não contêm lógica ou dados

### Componentes
- Contêm apenas dados, sem lógica
- São unidades reutilizáveis e modulares
- Exemplos: `PositionComponent`, `HealthComponent`, `WeaponComponent`

### Sistemas
- Contêm lógica que opera sobre entidades com certos componentes
- Cada sistema é responsável por uma funcionalidade específica
- Exemplos: `MovementSystem`, `CombatSystem`, `RenderSystem`

## Catálogo de Sistemas

### Sistema de Renderização (RenderSystem)
- **Arquivos**:
  - `client/systems/RenderSystem.js`
  
- **Responsabilidades**:
  - Inicialização do Three.js
  - Renderização de entidades com componentes visuais
  - Gerenciamento de câmera em primeira pessoa
  - Renderização de armas e efeitos visuais de magias
  - Geração procedural de modelos low-poly/voxel
  - Criação e animação de efeitos visuais
  - Gerenciamento de luzes e sombras
  - Gerenciamento do loop de renderização
  
- **Interfaces**:
  - `initialize(container)` → Inicializa o sistema de renderização
  - `addEntity(entity)` → Adiciona entidade para renderização
  - `removeEntity(entityId)` → Remove entidade da renderização
  - `update(deltaTime)` → Atualiza a renderização
  - `createModel(renderComponent)` → Cria modelo 3D baseado no componente
  - `createPlayerModel(color)` → Cria modelo de jogador
  - `createWeaponModel(renderComponent)` → Gera modelo de arma
  - `createProjectileModel(renderComponent)` → Cria modelo de projétil
  - `createObstacleModel(renderComponent)` → Cria modelo de obstáculo
  - `createSpellModel(renderComponent)` → Cria modelo de magia
  - `createVoxelModel(voxelData, defaultColor)` → Cria modelo baseado em voxels
  - `createBasicModel(shape, color)` → Cria modelo básico com forma simples
  - `createSpellEffect(type, position, params)` → Cria efeito visual para magia
  - `createHitEffect(position, normal, type)` → Cria efeito de impacto
  - `removeSpellEffect(effectId)` → Remove efeito visual
  - `updateSpellEffectPosition(effectId, position)` → Atualiza posição de efeito
  - `setPlayerEntity(entity)` → Define entidade do jogador para controle da câmera
  - `getPlayerEntity()` → Obtém a entidade do jogador local
  - `getCamera()` → Obtém a câmera de renderização
  - `getRenderer()` → Obtém o renderizador Three.js
  - `getScene()` → Obtém a cena Three.js
  - `setEntityVisibility(entityId, isVisible)` → Define visibilidade de entidade
  - `handleResize()` → Lida com redimensionamento da janela
  - `updateCameraPosition()` → Atualiza posição da câmera com base no jogador
  - `updateEffects(deltaTime)` → Atualiza efeitos visuais ativos
  - `animate()` → Loop de animação principal
  - `dispose()` → Libera recursos do sistema

- **Componentes Utilizados**:
  - `PositionComponent`
  - `RenderComponent`
  - `FirstPersonComponent`
  - `WeaponComponent`

- **Eventos Consumidos**:
  - Nenhum evento consumido diretamente. A comunicação acontece via chamadas de método.

- **Eventos Emitidos**:
  - Nenhum evento emitido diretamente. Outros sistemas consultam o estado do RenderSystem via métodos.

### Sistema de Entrada (InputSystem)
- **Arquivos**:
  - `client/systems/InputSystem.js`
  - `shared/utils/EventEmitter.js`
  
- **Responsabilidades**:
  - Capturar entrada do teclado e mouse
  - Mapear entradas para ações no jogo
  - Gerenciar estado do ponteiro bloqueado (pointer lock)
  - Emitir eventos de entrada para outros sistemas
  - Processar comandos de movimento, tiro, pulo, etc.
  - Normalizar movimento diagonal
  - Gerenciar sensibilidade do mouse
  - Prevenir comportamento padrão do navegador para teclas de jogo
  
- **Interfaces**:
  - `initialize(domElement)` → Configura listeners de eventos no elemento DOM
  - `update(deltaTime)` → Processa entradas e emite eventos de movimento
  - `getMovementVector()` → Retorna vetor de movimento baseado nas teclas pressionadas
  - `isKeyPressed(key)` → Verifica se uma tecla está pressionada
  - `handleKeyDown(event)` → Processa tecla pressionada
  - `handleKeyUp(event)` → Processa tecla liberada
  - `handleMouseDown(event)` → Processa botão do mouse pressionado
  - `handleMouseUp(event)` → Processa botão do mouse liberado
  - `handleMouseMove(event)` → Processa movimento do mouse
  - `handlePointerLockChange()` → Processa mudança no estado do bloqueio do ponteiro
  - `handlePointerLockError()` → Processa erros no bloqueio do ponteiro
  - `handleClick()` → Processa clique para requisitar bloqueio do ponteiro
  - `handleWheel(event)` → Processa evento de roda do mouse
  - `handleContextMenu(event)` → Previne menu de contexto
  - `updateKeyState(code, isPressed)` → Atualiza estado de uma tecla
  - `isGameKey(code)` → Verifica se uma tecla é utilizada no jogo
  - `setKeyMap(newKeyMap)` → Define mapeamento personalizado de teclas
  - `setSensitivity(value)` → Define sensibilidade do mouse
  - `resetAllInputStates()` → Reseta todos os estados de entrada
  - `requestPointerLock()` → Solicita bloqueio do ponteiro
  - `exitPointerLock()` → Libera bloqueio do ponteiro
  - `subscribe(eventType, callback)` → Assina eventos de entrada
  - `dispose()` → Libera recursos e remove event listeners

- **Componentes Utilizados**:
  - Não utiliza componentes ECS diretamente.

- **Eventos Emitidos**:
  - `input:move` → Movimento do jogador (WASD)
  - `input:jump` → Pulo do jogador (Espaço)
  - `input:fire` → Disparo de arma (Mouse esquerdo)
  - `input:aim` → Mira (Mouse direito)
  - `input:reload` → Recarga de arma (R)
  - `input:switch` → Troca de arma (1-5)
  - `input:cycleWeapon` → Troca de arma via roda do mouse
  - `input:look` → Movimento de câmera (mouse)
  - `input:menu` → Abre/fecha menu do jogo (ESC)
  - `input:chat` → Abre chat (Enter/T)
  - `input:pointerLockChange` → Mudança no estado do bloqueio do ponteiro

- **Eventos Consumidos**:
  - Não consome eventos diretamente. Recebe input via eventos do DOM.

### EventEmitter (Utilitário)
- **Arquivos**:
  - `shared/utils/EventEmitter.js`
  
- **Responsabilidades**:
  - Implementar sistema de eventos para comunicação entre componentes
  - Gerenciar assinaturas de eventos
  - Emitir eventos com dados para assinantes
  - Permitir cancelamento de assinaturas
  
- **Interfaces**:
  - `subscribe(eventName, callback)` → Assina um evento e retorna função para cancelar
  - `emit(eventName, data)` → Emite um evento com dados para todos os assinantes
  - `clearEvent(eventName)` → Remove todos os ouvintes para um evento específico
  - `clearAllEvents()` → Remove todos os ouvintes para todos os eventos
  - `getEventNames()` → Retorna lista de eventos ativos
  - `hasListeners(eventName)` → Verifica se um evento tem ouvintes
  - `listenerCount(eventName)` → Retorna o número de ouvintes para um evento

### Sistema de Rede - Cliente (NetworkSystem)
- **Arquivos**:
  - `client/systems/NetworkSystem.js`
  
- **Responsabilidades**:
  - Estabelecer conexão com o servidor via Socket.IO
  - Enviar ações do jogador para o servidor
  - Receber e processar atualizações de estado do jogo
  - Gerenciar reconexões em caso de falha
  
- **Interfaces**:
  - `initialize()` → Inicializa o sistema de rede do cliente
  - `setupSocketEvents()` → Configura eventos do Socket.IO
  - `tryReconnect()` → Tenta reconectar ao servidor
  - `registerRemotePlayer(playerId, entityId)` → Registra jogador remoto
  - `unregisterRemotePlayer(playerId)` → Remove registro de jogador remoto
  - `getRemotePlayerEntityId(playerId)` → Obtém ID de entidade de jogador remoto
  - `sendToServer(eventType, data)` → Envia evento para o servidor
  - `subscribeToEvent(eventType, callback)` → Assina para receber eventos
  - `update(deltaTime)` → Atualiza o sistema de rede

- **Componentes Utilizados**:
  - Não utiliza componentes diretamente.

- **Eventos Emitidos**:
  - `network:connected` → Conexão estabelecida com o servidor
  - `network:disconnected` → Desconectado do servidor
  - `network:error` → Erro de conexão
  - `network:maxReconnectAttempts` → Máximo de tentativas de reconexão atingido

- **Eventos Consumidos**:
  - Eventos do Socket.IO enviados pelo servidor

### Sistema de Jogo (GameSystem)
- **Arquivos**:
  - `server/systems/GameSystem.js`
  - `shared/constants/GameConfig.js`
  
- **Responsabilidades**:
  - Gerenciar a lógica principal do jogo
  - Controlar fluxo da partida (início, fim)
  - Gerenciar jogadores e equipes
  - Controlar pontuação e objetivos
  - Gerenciar respawn de jogadores
  - Criar e manter mapa do jogo
  
- **Interfaces**:
  - `initialize()` → Inicializa o sistema de jogo
  - `createInitialMap()` → Cria entidades do mapa inicial
  - `createWall(x, y, z, width, height, depth)` → Helper para criar paredes
  - `createObstacle(x, y, z)` → Helper para criar obstáculos
  - `addPlayer(socketId, playerName)` → Adiciona um novo jogador
  - `removePlayer(socketId)` → Remove um jogador
  - `playerDeath(playerId, killerId)` → Processa a morte de um jogador
  - `respawnPlayer(playerId)` → Processa o respawn de um jogador
  - `checkGameEnd()` → Verifica o fim da partida
  - `endGame()` → Finaliza a partida
  - `resetGame()` → Reinicia o jogo
  - `startGame()` → Inicia a partida
  - `getGameState()` → Obtém o estado atual do jogo
  - `update(deltaTime)` → Atualiza o sistema de jogo

- **Componentes Utilizados**:
  - `PositionComponent`
  - `PlayerComponent`
  - `HealthComponent`
  - `PhysicsComponent`

- **Eventos Consumidos**:
  - Não consome eventos diretamente. Reage a chamadas de método do NetworkSystem.

- **Eventos Emitidos (via NetworkSystem)**:
  - `player:death` → Notificação de morte de jogador
  - `player:respawn` → Notificação de respawn de jogador
  - `match:starting` → Notificação de início de contagem regressiva
  - `match:start` → Notificação de início de partida
  - `match:end` → Notificação de fim de partida
  - `game:state` → Estado atual do jogo

### Sistema de Rede - Servidor (NetworkSystem)
- **Arquivos**:
  - `server/systems/NetworkSystem.js`
  
- **Responsabilidades**:
  - Gerenciar conexões de clientes
  - Receber e processar eventos dos clientes
  - Transmitir atualizações para os clientes
  - Manter salas de jogo
  
- **Interfaces**:
  - `initialize()` → Inicializa o sistema de rede do servidor
  - `handleConnection(socket)` → Manipula nova conexão de cliente
  - `setupClientEvents(socket)` → Configura eventos para um cliente
  - `handleDisconnect(socket)` → Manipula desconexão de cliente
  - `handlePlayerJoin(socket, data)` → Manipula evento de junção ao jogo
  - `handlePlayerMove(socket, data)` → Manipula evento de movimentação
  - `handlePlayerShoot(socket, data)` → Manipula evento de disparo
  - `handlePlayerJump(socket, data)` → Manipula evento de pulo
  - `handlePlayerReload(socket, data)` → Manipula evento de recarga
  - `handlePlayerSwitchWeapon(socket, data)` → Manipula evento de troca de arma
  - `handlePlayerCastSpell(socket, data)` → Manipula evento de lançamento de magia
  - `handleChatMessage(socket, data)` → Manipula evento de mensagem de chat
  - `filterChatMessage(message)` → Filtra mensagens de chat
  - `sendToPlayer(playerId, eventType, data)` → Envia evento para um jogador
  - `broadcastToRoom(roomId, eventType, data)` → Envia evento para uma sala
  - `broadcastToRoomExcept(roomId, exceptPlayerId, eventType, data)` → Envia evento para todos na sala exceto um
  - `broadcastToAll(eventType, data)` → Envia evento para todos os clientes
  - `broadcastGameState()` → Envia estado do jogo para todos os clientes

- **Componentes Utilizados**:
  - Não utiliza componentes diretamente. Interage com o GameSystem.

- **Eventos Emitidos (para clientes)**:
  - `player:joinConfirmed` → Confirmação de entrada no jogo
  - `player:join` → Notificação de novo jogador
  - `player:leave` → Notificação de saída de jogador
  - `player:move` → Atualização de posição de jogador
  - `player:shoot` → Notificação de disparo
  - `player:jump` → Notificação de pulo
  - `player:reload` → Notificação de recarga
  - `player:switchWeapon` → Notificação de troca de arma
  - `player:castSpell` → Notificação de lançamento de magia
  - `chat:message` → Mensagem de chat
  - `game:state` → Estado atual do jogo

- **Eventos Consumidos (de clientes)**:
  - `player:join` → Solicitação de entrada no jogo
  - `player:move` → Movimento do jogador
  - `player:shoot` → Disparo do jogador
  - `player:jump` → Pulo do jogador
  - `player:reload` → Recarga de arma
  - `player:switchWeapon` → Troca de arma
  - `player:castSpell` → Lançamento de magia
  - `chat:message` → Envio de mensagem de chat

### Sistema de Física (PhysicsSystem)
- **Arquivos**:
  - `client/systems/PhysicsSystem.js`
  - `server/systems/PhysicsSystem.js`
  
- **Responsabilidades**:
  - Integração com Ammo.js
  - Detecção de colisão
  - Movimento de jogadores e projéteis
  - Aplicação de forças físicas e gravidade
  - Simulação de balística para projéteis
  
- **Interfaces Cliente**:
  - `initialize()` → Inicializa o mundo físico Ammo.js
  - `update(deltaTime)` → Atualiza simulação física
  - `addRigidBody(entity)` → Adiciona corpo rígido à simulação
  - `removeRigidBody(entityId)` → Remove corpo rígido da simulação
  - `applyForce(entityId, force)` → Aplica força a um corpo rígido
  - `applyImpulse(entityId, impulse)` → Aplica impulso a um corpo rígido
  - `setLinearVelocity(entityId, velocity)` → Define velocidade linear de um corpo
  - `raycast(origin, direction, maxDistance)` → Realiza raycast para detecção de colisão
  - `checkCollisions()` → Verifica colisões entre entidades
  - `dispose()` → Libera recursos do Ammo.js
  
- **Interfaces Servidor**:
  - `initialize()` → Inicializa o mundo físico no servidor
  - `update(deltaTime)` → Atualiza simulação física no servidor
  - `addRigidBody(entity)` → Adiciona corpo rígido à simulação no servidor
  - `removeRigidBody(entityId)` → Remove corpo rígido da simulação no servidor
  - `handlePlayerMove(data)` → Processa movimento do jogador
  - `handlePlayerJump(data)` → Processa pulo do jogador
  - `isPlayerGrounded(entityId)` → Verifica se jogador está no chão
  - `validateMovement(playerId, position, velocity)` → Valida movimento do jogador
  - `simulateProjectile(data)` → Simula trajetória de projétil
  - `checkCollisions()` → Verifica colisões entre todas as entidades

- **Componentes Utilizados**:
  - `PositionComponent`
  - `VelocityComponent`
  - `CollisionComponent`
  - `PhysicsComponent`
  - `RigidBodyComponent`
  - `PlayerComponent`

- **Eventos Emitidos**:
  - `physics:positionUpdated` → Posição da entidade atualizada pela física
  - `physics:collision` → Colisão detectada entre entidades
  - `physics:positionCorrected` → Correção de posição enviada ao cliente

- **Eventos Consumidos**:
  - `player:move` → Jogador moveu-se
  - `player:jump` → Jogador pulou

### Sistema de Balística (BallisticsSystem)
- **Arquivos**:
  - `client/systems/BallisticsSystem.js`
  - `server/systems/BallisticsSystem.js`
  - `shared/constants/BallisticsConstants.js`
  - `shared/components/ProjectileComponent.js`
  
- **Responsabilidades**:
  - Simulação de trajetória de projéteis
  - Cálculo de dano baseado em distância, penetração, etc.
  - Efeitos de recuo de armas
  - Efeitos de penetração de materiais
  - Gerenciamento do ciclo de vida dos projéteis
  - Detecção de colisões de projéteis
  - Visualização de projéteis no cliente
  
- **Interfaces**:
  - `initialize()` → Inicializa o sistema de balística
  - `update(deltaTime)` → Atualiza a simulação de projéteis
  - `fireProjectile(weaponType, origin, direction, initialVelocity)` → Dispara projétil
  - `calculateTrajectory(projectileData)` → Calcula trajetória completa
  - `calculateDamage(projectile, hitInfo)` → Calcula dano baseado no impacto
  - `calculateRecoil(weaponType)` → Calcula recuo da arma
  - `handlePlayerShoot(data)` → Manipula evento de disparo do jogador
  - `handleProjectileHit(projectileId, hitResult)` → Processa colisão de projétil
  - `removeProjectile(projectileId)` → Remove projétil do sistema
  - `createProjectileMesh(weaponType)` → [Cliente] Cria representação visual do projétil
  - `createHitEffect(position, normal, weaponType)` → [Cliente] Cria efeito visual de impacto
  - `canPenetrate(projectile, hitResult)` → [Servidor] Verifica se projétil pode penetrar o material
  - `getProjectileSpeed(weaponType)` → Obtém velocidade do projétil baseado no tipo de arma
  - `getProjectileLifetime(weaponType)` → Obtém tempo de vida do projétil baseado no tipo de arma
  - `getProjectileDamage(weaponType)` → Obtém dano do projétil baseado no tipo de arma
  - `getProjectilePenetration(weaponType)` → Obtém penetração do projétil baseado no tipo de arma
  - `getMaxEffectiveRange(weaponType)` → Obtém alcance efetivo baseado no tipo de arma
  - `isAffectedByGravity(weaponType)` → Verifica se o projétil é afetado pela gravidade
  - `getBaseRecoil(weaponType)` → Obtém padrão de recuo base para o tipo de arma
  - `dispose()` → Libera recursos do sistema

- **Componentes Utilizados**:
  - `ProjectileComponent`
  - `WeaponComponent`
  - `PositionComponent`
  - `HealthComponent`
  - `PhysicsComponent`

- **Eventos Emitidos**:
  - `projectile:hit` → Projétil atingiu alvo
  - `player:damage` → Jogador tomou dano
  - `projectile:create` → [Servidor] Notifica criação de projétil
  - `projectile:remove` → [Servidor] Notifica remoção de projétil

- **Eventos Consumidos**:
  - `player:shoot` → Jogador atirou

### Sistema de Armas (WeaponSystem)
- **Arquivos**:
  - `client/systems/WeaponSystem.js`
  - `server/systems/WeaponSystem.js`
  - `shared/constants/WeaponConstants.js`
  
- **Responsabilidades**:
  - Gerenciar arsenal de armas disponíveis
  - Controlar munição e recarregamento
  - Aplicar características de armas (dano, recuo, precisão)
  - Renderizar armas e efeitos visuais
  - Calcular dano baseado em distância e outros fatores
  - Simular recuo das armas
  
- **Interfaces Cliente**:
  - `initialize(renderSystem)` → Inicializa o sistema com referência ao renderizador
  - `addEntity(entity)` → Adiciona entidade de arma ao sistema
  - `removeEntity(entityId)` → Remove entidade de arma do sistema
  - `handleFireInput()` → Processa entrada de disparo do jogador local
  - `handleReloadInput()` → Processa entrada de recarga do jogador local
  - `handleSwitchInput(data)` → Processa entrada de troca de arma do jogador local
  - `handleRemotePlayerShoot(data)` → Processa tiro de jogador remoto
  - `handleRemotePlayerReload(data)` → Processa recarga de jogador remoto
  - `handleRemotePlayerSwitch(data)` → Processa troca de arma de jogador remoto
  - `fireWeapon(playerId, weaponId)` → Dispara arma
  - `reloadWeapon(playerId, weaponId)` → Recarrega arma
  - `switchWeapon(playerId, weaponId)` → Troca de arma
  - `getWeaponStats(weaponId)` → Obtém estatísticas da arma
  - `calculateRecoil(weaponComponent)` → Calcula recuo da arma
  - `playShootEffects(position, direction, weaponType)` → Reproduz efeitos visuais de tiro
  - `playReloadEffects(playerId)` → Reproduz efeitos de recarga
  - `playSwitchWeaponEffects(playerId, weaponType)` → Reproduz efeitos de troca de arma
  - `update(deltaTime)` → Atualiza o sistema de armas

- **Interfaces Servidor**:
  - `initialize()` → Inicializa o sistema de armas no servidor
  - `registerWeapon(entity)` → Registra uma nova arma no sistema
  - `removeWeapon(entityId)` → Remove uma arma do sistema
  - `handlePlayerShoot(data)` → Processa evento de disparo do jogador
  - `handlePlayerReload(data)` → Processa evento de recarga do jogador
  - `handlePlayerSwitchWeapon(data)` → Processa evento de troca de arma do jogador
  - `fireWeapon(playerId, weaponId)` → Dispara arma (validação do servidor)
  - `reloadWeapon(playerId, weaponId)` → Recarrega arma
  - `switchWeapon(playerId, weaponId)` → Troca de arma
  - `getWeaponStats(weaponId)` → Obtém estatísticas da arma
  - `calculateDamage(weaponComponent, hitInfo)` → Calcula dano baseado no impacto
  - `applyDamage(targetPlayerId, damage, attackerId, weaponId)` → Aplica dano a um jogador
  - `createWeaponForPlayer(playerId, weaponType)` → Cria uma nova arma para um jogador
  - `createWeaponComponent(type)` → Cria um componente de arma baseado no tipo
  - `dispose()` → Libera recursos do sistema

- **Componentes Utilizados**:
  - `WeaponComponent`
  - `PlayerComponent`
  - `HealthComponent`
  - `PositionComponent`

- **Eventos Emitidos**:
  - `projectile:hit` → Projétil atingiu alvo
  - `player:damage` → Jogador tomou dano
  - `player:death` → Jogador morreu

- **Eventos Consumidos**:
  - `input:fire` → Jogador atirou (cliente)
  - `input:reload` → Jogador recarregou (cliente)
  - `input:switch` → Jogador trocou de arma (cliente)
  - `player:shoot` → Notificação de disparo
  - `player:reload` → Notificação de recarga
  - `player:switchWeapon` → Notificação de troca de arma

### Sistema de Combate (CombatSystem)
- **Arquivos**:
  - `server/systems/CombatSystem.js`
  - `client/systems/CombatSystem.js`
  - `shared/constants/CombatConstants.js`
  
- **Responsabilidades**:
  - Gerenciamento de dano aos jogadores e entidades
  - Processamento de morte e respawn
  - Aplicação de efeitos de estado (buffs/debuffs)
  - Cálculo de dano baseado em armas, partes do corpo e distância
  - Visualização de feedback de combate (sangue, indicadores de dano)
  - Gerenciamento de regeneração de saúde
  - Feedback tátil, visual e sonoro de combate
  - Aplicação de cura e efeitos de suporte
  
- **Interfaces Servidor**:
  - `initialize()` → Inicializa o sistema de combate
  - `registerEntity(entity)` → Registra uma entidade com componente de saúde
  - `unregisterEntity(entityId)` → Remove uma entidade do sistema de combate
  - `handleProjectileHit(data)` → Processa hit de projétil
  - `handleSpellEffect(data)` → Processa efeito de magia
  - `handleAreaDamage(data)` → Processa dano de área
  - `applyDamage(targetId, damageInfo, attackerId)` → Aplica dano a uma entidade
  - `handlePlayerDeath(targetId, killerId, damageInfo)` → Processa morte de jogador
  - `processDeathQueue()` → Processa fila de jogadores mortos
  - `applyEffect(targetId, effect, sourceId)` → Aplica efeito de status
  - `removeEffect(targetId, effectType)` → Remove efeito de status
  - `processActiveEffects()` → Processa efeitos ativos periodicamente
  - `applyHealing(targetId, amount, sourceId)` → Aplica cura a uma entidade
  - `isImmuneToDamage(effectComponent, damageType)` → Verifica imunidade a dano
  - `applyDamageModifiers(damage, damageType, effectComponent)` → Aplica modificadores de dano
  - `calculateDistance(pointA, pointB)` → Calcula distância entre dois pontos
  - `calculateHitPart(hitPosition, targetId)` → Determina parte do corpo atingida
  - `getWeaponInfo(weaponType)` → Obtém informações sobre a arma
  - `calculateDamage(data)` → Calcula dano baseado em múltiplos fatores
  - `logDamage(targetId, attackerId, damage, damageInfo)` → Registra dano para estatísticas
  - `calculateScoreValue(damageInfo)` → Calcula valor de pontuação para um abate
  - `update(deltaTime)` → Atualiza o sistema de combate

- **Interfaces Cliente**:
  - `initialize()` → Inicializa o sistema de combate no cliente
  - `createBloodOverlay()` → Cria overlay para feedback visual de dano
  - `handlePlayerDamage(data)` → Processa dano ao jogador (visual/sonoro)
  - `handlePlayerDeath(data)` → Processa morte de jogador (visual/sonoro)
  - `handlePlayerHeal(data)` → Processa cura do jogador (visual/sonoro)
  - `handleEffectApplied(data)` → Processa aplicação de efeito (visual/sonoro)
  - `handleEffectRemoved(data)` → Processa remoção de efeito (visual)
  - `isLocalPlayer(playerId)` → Verifica se é o jogador local
  - `showDamageIndicator(attackerId)` → Mostra indicador de direção do dano
  - `pulseBloodOverlay(damageRatio)` → Anima overlay de sangue baseado no dano
  - `playDamageSound(damageType, damage)` → Reproduz som de dano
  - `createDamageNumber(targetId, damage, isCritical)` → Cria números de dano flutuantes
  - `createBloodEffect(targetId, hitPart)` → Cria efeito de sangue na parte atingida
  - `createDeathEffect(targetId, damageType)` → Cria efeito visual de morte
  - `createHealEffect(targetId, amount)` → Cria efeito visual de cura
  - `createStatusEffect(targetId, effectType, duration)` → Cria efeito visual de status
  - `removeStatusEffect(targetId, effectType)` → Remove efeito visual de status
  - `showDeathScreen()` → Mostra tela de morte para o jogador local
  - `showKillConfirmation(targetId, isHeadshot)` → Mostra confirmação de abate
  - `showEffectAppliedIndicator(effectType)` → Mostra indicador de efeito aplicado
  - `showEffectRemovedIndicator(effectType)` → Mostra indicador de efeito removido
  - `showHealEffect()` → Mostra efeito de cura recebida
  - `getLocalPlayerPosition()` → Obtém posição do jogador local
  - `getEntityPosition(entityId)` → Obtém posição de uma entidade
  - `update(deltaTime)` → Atualiza o sistema visual de combate
  - `dispose()` → Libera recursos do sistema

- **Componentes Utilizados**:
  - `HealthComponent`
  - `PlayerComponent`
  - `PositionComponent`
  - `EffectComponent`
  - `WeaponComponent`

- **Eventos Emitidos**:
  - `player:damage` → Jogador tomou dano
  - `player:death` → Jogador morreu
  - `player:heal` → Jogador recebeu cura
  - `effect:applied` → Efeito aplicado a uma entidade
  - `effect:removed` → Efeito removido de uma entidade
  - `ui:showDeathScreen` → [Cliente] Mostra tela de morte
  - `ui:showKillConfirmation` → [Cliente] Mostra confirmação de abate
  - `ui:showEffectIndicator` → [Cliente] Mostra indicador de efeito
  - `ui:showHealEffect` → [Cliente] Mostra efeito de cura

- **Eventos Consumidos**:
  - `projectile:hit` → Projétil atingiu algo
  - `spell:effect` → Efeito de magia aplicado
  - `aoe:damage` → Dano de área aplicado
  - `player:damage` → [Cliente] Jogador tomou dano
  - `player:death` → [Cliente] Jogador morreu
  - `player:heal` → [Cliente] Jogador recebeu cura
  - `effect:applied` → [Cliente] Efeito aplicado a uma entidade
  - `effect:removed` → [Cliente] Efeito removido de uma entidade

### Sistema de Magias (SpellSystem)
- **Arquivos**:
  - `client/systems/SpellSystem.js`
  - `server/systems/SpellSystem.js`
  - `shared/constants/SpellConstants.js`
  - `shared/components/SpellComponent.js`
  
- **Responsabilidades**:
  - Gerenciamento do lançamento de magias
  - Controle de cooldowns e custos de mana
  - Aplicação de efeitos de status (buffs/debuffs)
  - Simulação de projéteis mágicos e áreas de efeito
  - Cálculo de dano e efeitos baseados em tipos e elementos
  - Visualização de efeitos mágicos e feedback visual
  - Controle de magias de invocação
  - Gerenciamento de buffs e debuffs em jogadores
  
- **Interfaces Cliente**:
  - `initialize(localPlayerId)` → Inicializa o sistema de magias para o cliente
  - `setupEventListeners()` → Configura ouvintes de eventos para o sistema
  - `handleCastInput(data)` → Processa entrada de lançamento de magia
  - `handleRemoteSpellCast(data)` → Processa lançamento de magia de jogadores remotos
  - `handleSpellEffect(data)` → Processa a criação de efeitos de magia no mundo
  - `handleSpellRemove(data)` → Processa a remoção de magias do mundo
  - `handlePlayerDeath(data)` → Processa a morte de jogadores (cancelamento de magias)
  - `update(deltaTime)` → Atualiza o sistema de magias (casting, visuais, mana)
  - `updateCasting(deltaTime)` → Atualiza o processo de lançamento de magias
  - `updateSpellVisuals(deltaTime)` → Atualiza os efeitos visuais de magias ativas
  - `updateManaRegeneration(deltaTime)` → Atualiza a regeneração de mana do jogador
  - `addEntity(entity)` → Adiciona uma entidade ao sistema 
  - `removeEntity(entityId)` → Remove uma entidade do sistema
  - `dispose()` → Libera recursos do sistema

- **Interfaces Servidor**:
  - `initialize()` → Inicializa o sistema de magias para o servidor
  - `setupEventListeners()` → Configura ouvintes de eventos para o sistema
  - `handlePlayerCastSpell(data)` → Processa solicitação de lançamento de magia
  - `handlePlayerDeath(data)` → Processa a morte de jogadores
  - `handlePlayerRespawn(data)` → Processa o respawn de jogadores
  - `handleMatchEnd()` → Processa o fim da partida
  - `castSpell(pendingSpell)` → Dispara uma magia após o tempo de lançamento
  - `createProjectileSpell(playerId, spellId, position, rotation, spellInfo)` → Cria uma magia de projétil
  - `createAreaSpell(playerId, spellId, targetPosition, spellInfo)` → Cria uma magia de área
  - `createBuffSpell(playerId, spellId, spellInfo)` → Cria uma magia de buff
  - `createDebuffSpell(playerId, spellId, targetId, targetPosition, spellInfo)` → Cria uma magia de debuff
  - `createUtilitySpell(playerId, spellId, targetPosition, spellInfo)` → Cria uma magia de utilidade
  - `createSummonSpell(playerId, spellId, targetPosition, spellInfo)` → Cria uma magia de invocação
  - `handleSpellCollision(spellEntity, collision)` → Processa colisão de magia
  - `applySpellDamage(targetId, casterId, spellId, damage, spellInfo)` → Aplica dano de magia
  - `applyEffectToEntity(entityId, effect, spellId, sourceId, duration)` → Aplica efeito a entidade
  - `removeEffectFromEntity(entityId, effectId)` → Remove efeito de entidade
  - `removeAllEffectsFromEntity(entityId)` → Remove todos os efeitos de entidade
  - `clearAllEffects()` → Limpa todos os efeitos em todas as entidades
  - `applyDamageModifiers(damage, element, effectComponent)` → Aplica modificadores de dano
  - `calculateManaCost(spellInfo)` → Calcula custo de mana modificado
  - `calculateSpellDamage(spellInfo)` → Calcula dano modificado
  - `calculateCooldown(spellInfo)` → Calcula cooldown modificado
  - `update(deltaTime)` → Atualiza o sistema de magias
  - `processPendingSpells()` → Processa magias pendentes após tempo de lançamento
  - `updateActiveSpells(deltaTime)` → Atualiza magias ativas no mundo
  - `processAreaEffect(spellEntity, spellComponent, deltaTime)` → Processa efeitos de área
  - `processActiveEffects(deltaTime)` → Processa efeitos ativos em entidades
  - `findPlayersInRange(position, radius)` → Encontra jogadores dentro de um raio
  - `addEntity(entity)` → Adiciona uma entidade ao sistema
  - `removeEntity(entityId)` → Remove uma entidade do sistema
  - `clearEffectsBySource(sourceId)` → Remove efeitos causados por uma entidade
  - `dispose()` → Libera recursos do sistema

- **Componentes Utilizados**:
  - `SpellComponent`
  - `SpellCasterComponent`
  - `ManaComponent`
  - `PositionComponent`
  - `VelocityComponent`
  - `EffectComponent`
  - `HealthComponent`
  - `RenderComponent`
  - `CollisionComponent`
  - `PhysicsComponent`
  - `AIComponent` (para invocações)

- **Eventos Emitidos**:
  - `player:manaChanged` → Notificação de alteração de mana
  - `player:damage` → Notificação de dano de magia
  - `player:death` → Notificação de morte por magia
  - `spell:effect` → Notificação de efeito de magia
  - `spell:remove` → Notificação de remoção de magia
  - `spell:buff` → Notificação de buff aplicado
  - `spell:debuff` → Notificação de debuff aplicado
  - `spell:summon` → Notificação de invocação
  - `effect:applied` → Notificação de efeito aplicado
  - `effect:removed` → Notificação de efeito removido

- **Eventos Consumidos**:
  - `input:cast` → [Cliente] Entrada de lançamento de magia
  - `spell:cast` → Notificação de início de lançamento
  - `spell:effect` → Notificação de efeito de magia
  - `spell:remove` → Notificação de remoção de magia
  - `player:death` → Notificação de morte de jogador
  - `player:respawn` → Notificação de respawn de jogador
  - `player:castSpell` → [Servidor] Solicitação de lançamento de magia
  - `match:end` → Notificação de fim de partida

### Sistema de UI (UISystem)
- **Arquivos**:
  - `client/systems/UISystem.js`
  
- **Responsabilidades**:
  - Renderizar interface do usuário
  - Mostrar informações do jogador (vida, mana, munição)
  - Mostrar feedbacks visuais (dano, cura, efeitos de status)
  - Gerenciar menus do jogo (morte, pausa, fim de partida)
  - Gerenciar feed de abates
  - Prover indicadores de direção do dano
  - Gerenciar sistema de chat
  - Exibir confirmações de abate
  - Criar overlays para feedback visual
  
- **Interfaces**:
  - `initialize(containerId, localPlayerId)` → Inicializa o sistema de UI com o contêiner e ID do jogador local
  - `createUIElements()` → Cria os elementos da UI
  - `createOverlays()` → Cria overlays para menus e efeitos visuais
  - `createStyle()` → Cria estilos CSS para a UI
  - `setupEventListeners()` → Configura ouvintes de eventos
  - `updateHUD(playerData)` → Atualiza HUD com dados do jogador
  - `showMenu(menuType)` → Mostra um menu específico
  - `hideMenu(menuType)` → Esconde um menu específico
  - `showDamageIndicator(attackerId)` → Mostra indicador de direção do dano
  - `pulseBloodOverlay(damageRatio)` → Pulsa overlay de sangue baseado no dano
  - `pulseHealOverlay(healRatio)` → Pulsa overlay de cura baseado na cura
  - `pulseEffectOverlay(effectType)` → Pulsa overlay de efeito baseado no tipo
  - `showKillFeed(killerId, victimId, weaponType)` → Mostra feed de abates
  - `showKillConfirmation(victimId, isHeadshot)` → Mostra confirmação de abate
  - `showEffectAppliedIndicator(effectType)` → Mostra indicador de efeito aplicado
  - `showEffectRemovedIndicator(effectType)` → Mostra indicador de efeito removido
  - `startRespawnTimer(time)` → Inicia temporizador de respawn
  - `showMatchResults(data)` → Mostra resultados da partida
  - `addChatMessage(playerName, message)` → Adiciona mensagem ao chat
  - `openChat()` → Abre campo de entrada do chat
  - `closeChat()` → Fecha campo de entrada do chat
  - `sendChatMessage()` → Envia mensagem de chat
  - `resetKillFeed()` → Limpa feed de abates
  - `updateGameState(data)` → Atualiza UI com estado do jogo
  - `getWeaponDisplayName(weaponType)` → Obtém nome de exibição para arma
  - `getEffectDisplayName(effectType)` → Obtém nome de exibição para efeito
  - `getPlayerName(playerId)` → Obtém nome do jogador pelo ID
  - `getLocalPlayerPosition()` → Obtém posição do jogador local
  - `getEntityPosition(entityId)` → Obtém posição de uma entidade
  - `update(deltaTime)` → Atualiza o sistema de UI
  - `dispose()` → Libera recursos do sistema

- **Componentes Utilizados**:
  - `PlayerComponent`
  - `HealthComponent`
  - `ManaComponent`
  - `WeaponComponent`

- **Eventos Emitidos**:
  - `ui:chatOpen` → Notifica que o chat foi aberto
  - `ui:chatClose` → Notifica que o chat foi fechado
  - `player:chatMessage` → Mensagem de chat para enviar ao servidor
  - `game:pause` → Solicita pausa do jogo
  - `game:resume` → Solicita retomada do jogo

- **Eventos Consumidos**:
  - `player:damage` → Jogador tomou dano
  - `player:heal` → Jogador recebeu cura
  - `player:death` → Jogador morreu
  - `player:respawn` → Jogador renasceu
  - `player:manaChanged` → Mana do jogador alterada
  - `player:reload` → Jogador recarregou arma
  - `player:switchWeapon` → Jogador trocou de arma
  - `effect:applied` → Efeito aplicado ao jogador
  - `effect:removed` → Efeito removido do jogador
  - `match:start` → Partida iniciada
  - `match:end` → Partida terminada
  - `chat:message` → Mensagem de chat recebida
  - `ui:showDeathScreen` → Solicitação para mostrar tela de morte
  - `ui:showKillConfirmation` → Solicitação para mostrar confirmação de abate

### Sistema de Rede - Cliente (NetworkSystem)
- **Arquivos**:
 - `client/systems/NetworkSystem.js`
 - `shared/utils/EventEmitter.js`
 
- **Responsabilidades**:
 - Estabelecer conexão com o servidor via Socket.IO
 - Enviar ações do jogador para o servidor
 - Receber e processar atualizações de estado do jogo
 - Gerenciar reconexões em caso de falha
 - Sincronizar tempo entre cliente e servidor
 - Medir latência da conexão
 - Gerenciar registro de jogadores remotos
 
- **Interfaces**:
 - `initialize()` → Inicializa o sistema de rede do cliente
 - `setupSocketEvents()` → Configura eventos do Socket.IO
 - `tryReconnect()` → Tenta reconectar ao servidor
 - `registerRemotePlayer(playerId, entityId)` → Registra jogador remoto
 - `unregisterRemotePlayer(playerId)` → Remove registro de jogador remoto
 - `getRemotePlayerEntityId(playerId)` → Obtém ID de entidade de jogador remoto
 - `sendToServer(eventType, data)` → Envia evento para o servidor
 - `subscribeToEvent(eventType, callback)` → Assina para receber eventos
 - `measurePing()` → Mede latência através de ping/pong
 - `synchronizeTime()` → Sincroniza relógio com o servidor
 - `clientToServerTime(clientTime)` → Converte timestamp do cliente para servidor
 - `serverToClientTime(serverTime)` → Converte timestamp do servidor para cliente
 - `getLatency()` → Obtém latência atual
 - `joinGame(playerName, team)` → Solicita entrada no jogo
 - `isConnected()` → Verifica se está conectado ao servidor
 - `update(deltaTime)` → Atualiza o sistema de rede
 - `dispose()` → Libera recursos do sistema

- **Componentes Utilizados**:
 - Não utiliza componentes diretamente.

- **Eventos Emitidos**:
 - `network:connected` → Conexão estabelecida com o servidor
 - `network:disconnected` → Desconectado do servidor
 - `network:error` → Erro de conexão
 - `network:maxReconnectAttempts` → Máximo de tentativas de reconexão atingido
 - `network:ping` → Atualização de latência
 - `player:joinConfirmed` → Confirmação de entrada no jogo
 - `player:join` → Notificação de novo jogador
 - `player:leave` → Notificação de saída de jogador
 - `player:move` → Atualização de posição de jogador
 - `player:shoot` → Notificação de disparo
 - `player:jump` → Notificação de pulo
 - `player:reload` → Notificação de recarga
 - `player:switchWeapon` → Notificação de troca de arma
 - `player:castSpell` → Notificação de lançamento de magia
 - `player:damage` → Notificação de dano ao jogador
 - `player:death` → Notificação de morte de jogador
 - `player:respawn` → Notificação de respawn
 - `chat:message` → Mensagem de chat recebida
 - `game:state` → Estado atual do jogo
 - `projectile:create` → Criação de projétil
 - `projectile:remove` → Remoção de projétil
 - `projectile:hit` → Impacto de projétil
 - `spell:effect` → Efeito de magia criado
 - `spell:remove` → Efeito de magia removido
 - `effect:applied` → Efeito de status aplicado
 - `effect:removed` → Efeito de status removido
 - `match:start` → Partida iniciada
 - `match:end` → Partida terminada

- **Eventos Consumidos**:
 - Eventos do Socket.IO enviados pelo servidor

### Sistema de Rede - Servidor (NetworkSystem)
- **Arquivos**:
 - `server/systems/NetworkSystem.js`
 
- **Responsabilidades**:
 - Gerenciar conexões de clientes
 - Receber e processar eventos dos clientes
 - Transmitir atualizações para os clientes
 - Manter salas de jogo
 - Validar ações dos jogadores
 - Filtrar mensagens de chat
 - Sincronizar tempo com clientes
 - Medir e monitorar latência dos jogadores
 
- **Interfaces**:
 - `initialize()` → Inicializa o sistema de rede do servidor
 - `handleConnection(socket)` → Manipula nova conexão de cliente
 - `setupClientEvents(socket)` → Configura eventos para um cliente
 - `handleDisconnect(socket)` → Manipula desconexão de cliente
 - `handlePlayerJoin(socket, data)` → Manipula evento de junção ao jogo
 - `handlePlayerMove(socket, data)` → Manipula evento de movimentação
 - `handlePlayerShoot(socket, data)` → Manipula evento de disparo
 - `handlePlayerJump(socket, data)` → Manipula evento de pulo
 - `handlePlayerReload(socket, data)` → Manipula evento de recarga
 - `handlePlayerSwitchWeapon(socket, data)` → Manipula evento de troca de arma
 - `handlePlayerCastSpell(socket, data)` → Manipula evento de lançamento de magia
 - `handleChatMessage(socket, data)` → Manipula evento de mensagem de chat
 - `filterChatMessage(message)` → Filtra mensagens de chat
 - `validatePlayer(socketId)` → Valida existência e estado do jogador
 - `sendToPlayer(playerId, eventType, data)` → Envia evento para um jogador
 - `broadcastToRoom(roomId, eventType, data)` → Envia evento para uma sala
 - `broadcastToRoomExcept(roomId, exceptPlayerId, eventType, data)` → Envia evento para todos na sala exceto um
 - `broadcastToTeam(roomId, team, eventType, data)` → Envia evento para membros de uma equipe
 - `broadcastToAll(eventType, data)` → Envia evento para todos os clientes
 - `broadcastGameState()` → Envia estado do jogo para todos os clientes
 - `getPlayerCount()` → Obtém número total de jogadores
 - `getRoomCount()` → Obtém número total de salas
 - `getPlayersInRoom(roomId)` → Obtém lista de jogadores em uma sala
 - `getPlayerName(playerId)` → Obtém nome de um jogador
 - `dispose()` → Libera recursos do sistema

- **Componentes Utilizados**:
 - Não utiliza componentes diretamente. Interage com o GameSystem.

- **Eventos Emitidos (para clientes)**:
 - `network:welcome` → Boas-vindas para novo cliente
 - `player:joinConfirmed` → Confirmação de entrada no jogo
 - `player:joinRejected` → Rejeição de entrada no jogo
 - `player:otherPlayers` → Lista de outros jogadores
 - `player:join` → Notificação de novo jogador
 - `player:leave` → Notificação de saída de jogador
 - `player:move` → Atualização de posição de jogador
 - `player:shoot` → Notificação de disparo
 - `player:jump` → Notificação de pulo
 - `player:reload` → Notificação de recarga
 - `player:switchWeapon` → Notificação de troca de arma
 - `player:castSpell` → Notificação de lançamento de magia
 - `chat:message` → Mensagem de chat
 - `game:state` → Estado atual do jogo
 - `pong` → Resposta de ping para medição de latência
 - `time:sync` → Resposta de sincronização de tempo
 - `physics:positionCorrected` → Correção de posição invalida

- **Eventos Consumidos (de clientes)**:
 - `disconnect` → Cliente desconectou
 - `player:join` → Solicitação de entrada no jogo
 - `player:move` → Movimento do jogador
 - `player:shoot` → Disparo do jogador
 - `player:jump` → Pulo do jogador
 - `player:reload` → Recarga de arma
 - `player:switchWeapon` → Troca de arma
 - `player:castSpell` → Lançamento de magia
 - `chat:message` → Envio de mensagem de chat
 - `ping` → Ping para medição de latência
 - `time:sync` → Solicitação de sincronização de tempo

### Sistema de Matchmaking (MatchmakingSystem)
- **Arquivos**:
  - `server/systems/MatchmakingSystem.js`
  - `shared/constants/MatchmakingConstants.js`
  
- **Responsabilidades**:
  - Gerenciar filas de jogadores por modo de jogo e tipo de partida
  - Criar e balancear partidas automaticamente
  - Gerenciar salas personalizadas para jogos amigáveis
  - Balancear equipes baseado em habilidade e nível
  - Implementar sistema de classificação (ELO)
  - Gerenciar penalidades para abandono de partidas
  - Permitir reconexão em partidas ativas
  - Transitar salas entre diferentes estados (espera, iniciando, ativa, finalizando)
  - Processar estatísticas e atualizar ratings após partidas
  
- **Interfaces**:
  - `initialize()` → Inicializa o sistema de matchmaking
  - `setupEventListeners()` → Configura os ouvintes de eventos
  - `initializeQueues()` → Inicializa as filas para cada modo de jogo e tipo de partida
  - `startMatchmakingLoop()` → Inicia o loop de processamento de matchmaking
  - `processQueues()` → Processa todas as filas de matchmaking
  - `processCasualQueue(queueId, queue)` → Processa fila de partidas casuais
  - `processCompetitiveQueue(queueId, queue)` → Processa fila de partidas competitivas
  - `processRooms()` → Processa salas de jogo
  - `processDisconnectedPlayers()` → Processa jogadores desconectados
  - `processPlayerPenalties()` → Processa penalidades de jogadores
  - `createRoom(queueId, players, isRanked)` → Cria uma nova sala de jogo
  - `createCustomRoom(hostPlayerId, settings)` → Cria uma sala personalizada
  - `joinCustomRoom(playerId, roomId)` → Entra em uma sala personalizada
  - `leaveCustomRoom(playerId, roomId)` → Sai de uma sala personalizada
  - `startCustomRoom(playerId, roomId)` → Inicia uma sala personalizada
  - `setPlayerReady(playerId, roomId, isReady)` → Marca um jogador como pronto
  - `setPlayerTeam(playerId, roomId, teamId)` → Define o time de um jogador
  - `transferRoomOwnership(hostId, roomId, newHostId)` → Transfere a propriedade da sala
  - `joinQueue(playerId, gameMode, matchType)` → Entra em uma fila de matchmaking
  - `leaveQueue(playerId)` → Sai de uma fila de matchmaking
  - `estimateWaitTime(queueId, playerId)` → Estima tempo de espera
  - `getPlayerRating(playerId)` → Obtém o rating de um jogador
  - `updatePlayerRating(playerId, newRating)` → Atualiza o rating de um jogador
  - `handlePlayerConnect(playerId)` → Lida com a conexão de um jogador
  - `handlePlayerDisconnect(playerId)` → Lida com a desconexão de um jogador
  - `handlePlayerReconnect(playerId, roomId)` → Lida com a reconexão de um jogador
  - `handlePlayerAbandon(playerId, roomId)` → Lida com o abandono de um jogador
  - `applyAbandonmentPenalty(playerId, matchType)` → Aplica penalidade por abandono
  - `endMatchDueToPlayerShortage(roomId)` → Finaliza uma partida por falta de jogadores
  - `countActivePlayers(room)` → Conta jogadores ativos em uma sala
  - `startMatch(roomId)` → Inicia uma partida
  - `transitionRoomState(roomId, newState)` → Transiciona o estado de uma sala
  - `handleMatchEnd(roomId, stats)` → Lida com o fim de uma partida
  - `updateRatings(roomId, stats)` → Atualiza ratings dos jogadores após uma partida
  - `cleanupRoom(roomId)` → Limpa recursos da sala após o fim
  - `balanceTeams(roomId)` → Balanceia equipes em uma sala
  - `getPlayerActiveMatch(playerId)` → Verifica se um jogador está em uma partida
  - `getStats()` → Obtém estatísticas do sistema de matchmaking
  - `calculateAverageWaitTime(queueId)` → Calcula tempo médio de espera em uma fila
  - `dispose()` → Libera recursos do sistema

- **Componentes Utilizados**:
  - Não utiliza componentes ECS diretamente. Interage com o GameSystem e NetworkSystem.

- **Eventos Emitidos**:
  - `roomStateChanged` → Mudança de estado de uma sala

- **Eventos Consumidos**:
  - `player:connect` → Jogador conectou
  - `player:disconnect` → Jogador desconectou
  - `matchmaking:joinQueue` → Jogador solicitou entrada na fila
  - `matchmaking:leaveQueue` → Jogador solicitou saída da fila
  - `match:end` → Partida terminou
  - `matchmaking:createCustomRoom` → Jogador solicitou criação de sala personalizada
  - `matchmaking:joinCustomRoom` → Jogador solicitou entrada em sala personalizada
  - `matchmaking:leaveCustomRoom` → Jogador solicitou saída de sala personalizada
  - `matchmaking:startCustomRoom` → Jogador solicitou início de sala personalizada


## Protocolos de Comunicação

### Socket.IO
- **Usado para toda comunicação cliente-servidor**:
  - Posições dos jogadores
  - Disparos e impactos de projéteis
  - Lançamento de magias
  - Eventos do jogo (morte, respawn, etc.)
  - Chat entre jogadores
  - Atualizações de estado

- **Características**:
  - Confiável e com reconexão automática
  - Baixa latência suficiente para FPS
  - Suporte a compressão de dados
  - Salas para separar partidas

## Segurança e Prevenção de Trapaças

Para garantir a segurança do jogo e prevenir trapaças:

1. **Autoridade do Servidor**: Toda lógica crítica (dano, colisões, física de projéteis) é validada no servidor
2. **Validação de Movimento**: O servidor verifica se movimentos são fisicamente possíveis
3. **Detecção de Anomalias**: Sistema para detectar comportamentos impossíveis (tiros impossíveis, velocidade excessiva)
4. **Rate-Limiting**: Prevenção contra ataques de flooding de ações
5. **Predição no Cliente**: O cliente prediz resultados para responsividade, mas o servidor corrige se necessário

## Catálogo de Componentes

### PositionComponent
- **Dados**:
  - `x` → Coordenada X no mundo
  - `y` → Coordenada Y no mundo
  - `z` → Coordenada Z no mundo
  - `rotationX` → Rotação no eixo X (pitch)
  - `rotationY` → Rotação no eixo Y (yaw)
  - `rotationZ` → Rotação no eixo Z (roll)

### VelocityComponent
- **Dados**:
  - `x` → Velocidade no eixo X
  - `y` → Velocidade no eixo Y
  - `z` → Velocidade no eixo Z
  - `speed` → Velocidade escalar total

### HealthComponent
- **Dados**:
  - `currentHealth` → Saúde atual
  - `maxHealth` → Saúde máxima
  - `lastDamageTime` → Timestamp do último dano recebido
  - `regeneration` → Taxa de regeneração por segundo

### RenderComponent
- **Dados**:
  - `modelType` → Tipo do modelo (jogador, arma, projétil)
  - `color` → Cor principal (formato hexadecimal)
  - `shape` → Forma básica (cubo, esfera, cilindro)
  - `voxelData` → Dados para geração do modelo voxel
  - `visible` → Flag de visibilidade
  - `dimensions` → Dimensões da forma (largura, altura, profundidade, raio)
  - `material` → Propriedades do material (wireframe, opacidade, transparência, emissivo)
  - `effects` → Efeitos visuais adicionais (rastro, brilho)
  - `animation` → Informações de animação
  - `castShadow` → Flag se projeta sombras
  - `receiveShadow` → Flag se recebe sombras
  - `team` → Equipe para coloração específica
  - `object3D` → Referência ao objeto Three.js (preenchido pelo RenderSystem)
  - `effectObjects` → Objetos de efeitos visuais adicionais

### PhysicsComponent
- **Dados**:
  - `mass` → Massa da entidade
  - `friction` → Coeficiente de fricção
  - `restitution` → Coeficiente de restituição (quicar)
  - `linearDamping` → Amortecimento linear
  - `angularDamping` → Amortecimento angular
  - `collisionGroup` → Grupo de colisão
  - `collisionMask` → Máscara de colisão

### RigidBodyComponent
- **Dados**:
  - `body` → Referência ao corpo rígido no Ammo.js
  - `shape` → Forma de colisão (box, sphere, capsule, cylinder, mesh)
  - `isStatic` → Flag para corpo estático
  - `isTrigger` → Flag para trigger (sem colisão física)
  - `mass` → Massa do corpo em kg
  - `friction` → Coeficiente de fricção
  - `restitution` → Coeficiente de restituição (elasticidade)
  - `linearDamping` → Amortecimento linear
  - `angularDamping` → Amortecimento angular
  - `kinematic` → Flag para corpo cinemático
  - `dimensions` → Dimensões da forma [x, y, z]
  - `radius` → Raio para formas esféricas ou cilíndricas
  - `height` → Altura para formas cilíndricas ou capsulares
  - `collisionGroup` → Grupo de colisão para filtragem
  - `collisionMask` → Máscara de colisão para filtragem
  - `allowSleep` → Flag para permitir que o corpo "adormeça"
  - `canRotate` → Flag se o corpo pode rotacionar
  - `lockAxisX` → Flag para travar rotação no eixo X
  - `lockAxisY` → Flag para travar rotação no eixo Y
  - `lockAxisZ` → Flag para travar rotação no eixo Z
  - `userData` → Dados personalizados para callbacks de colisão
  - `isGrounded` → Flag se o objeto está no chão
  - `lastGroundedTime` → Timestamp da última vez que estava no chão
  - `collisions` → Lista de colisões atuais

### PlayerComponent
- **Dados**:
  - `id` → ID único do jogador
  - `name` → Nome do jogador
  - `team` → Equipe do jogador
  - `isAlive` → Flag de estado de vida
  - `respawnTime` → Tempo até respawn
  - `kills` → Número de abates
  - `deaths` → Número de mortes
  - `score` → Pontuação

### FirstPersonComponent
- **Dados**:
  - `cameraHeight` → Altura da câmera em relação ao jogador
  - `lookSpeed` → Velocidade de rotação da câmera
  - `bobFactor` → Fator de balanço ao andar
  - `fov` → Campo de visão em graus
  - `minPitch` → Limite mínimo de inclinação vertical
  - `maxPitch` → Limite máximo de inclinação vertical
  - `enableHeadBob` → Flag para ativar o balanço da câmera
  - `enableRecoil` → Flag para ativar o recuo visual
  - `smoothRotation` → Flag para suavizar a rotação da câmera
  - `rotationSmoothing` → Fator de suavização da rotação
  - `weaponPosition` → Posição relativa da arma na tela {x, y, z}
  - `viewmodelVisible` → Flag se o modelo da arma é visível
  - `recoilSettings` → Configurações de recuo visual
  - `pitch` → Rotação vertical atual em graus
  - `yaw` → Rotação horizontal atual em graus
  - `bobPhase` → Fase atual do ciclo de balanço
  - `bobActive` → Flag se o balanço está ativo
  - `recoil` → Estado atual de recuo {x, y, active}
  - `damageEffect` → Intensidade do efeito de dano
  - `healEffect` → Intensidade do efeito de cura
  - `flashEffect` → Intensidade do efeito de flash
  - `targetPitch` → Rotação vertical alvo para suavização
  - `targetYaw` → Rotação horizontal alvo para suavização
  - `camera` → Referência à câmera Three.js
  - `viewmodel` → Referência ao modelo da arma

### WeaponComponent
- **Dados**:
  - `weaponType` → Tipo da arma
  - `damage` → Dano base
  - `fireRate` → Taxa de disparo (tiros por segundo)
  - `reloadTime` → Tempo de recarga em segundos
  - `accuracy` → Precisão (0 a 1)
  - `recoil` → Recuo (0 a 1)
  - `currentAmmo` → Munição atual
  - `maxAmmo` → Capacidade máxima do carregador
  - `reserveAmmo` → Munição reserva
  - `lastFireTime` → Timestamp do último disparo
  - `isReloading` → Flag de estado de recarga
  - `range` → Alcance efetivo em unidades

### ProjectileComponent
- **Dados**:
  - `weaponType` → Tipo de arma que disparou
  - `shooterId` → ID do atirador
  - `damage` → Dano do projétil
  - `speed` → Velocidade do projétil
  - `lifetime` → Tempo de vida máximo em segundos
  - `penetration` → Capacidade de penetração
  - `creationTime` → Timestamp de criação

### AttributeComponent
- **Dados**:
  - `strength` → Força (aumenta dano físico)
  - `dexterity` → Destreza (aumenta precisão e velocidade)
  - `intelligence` → Inteligência (aumenta dano mágico e mana)
  - `vitality` → Vitalidade (aumenta vida)
  - `availablePoints` → Pontos disponíveis para distribuir
  - `level` → Nível atual do jogador
  - `experience` → Experiência acumulada
  - `experienceToNextLevel` → Experiência necessária para subir de nível
  - `maxAttributeValue` → Valor máximo permitido para cada atributo
  - `attributePointsPerLevel` → Pontos de atributo ganhos por nível
  - `temporaryModifiers` → Modificadores temporários de atributos

### SpellComponent
- **Dados**:
  - `spellId` → ID da magia
  - `casterId` → ID da entidade que lançou a magia
  - `targetId` → ID da entidade alvo (se aplicável)
  - `targetPosition` → Posição alvo para magias de área
  - `element` → Elemento da magia
  - `damage` → Dano base
  - `radius` → Raio de efeito (para magias de área)
  - `duration` → Duração do efeito
  - `lifetime` → Tempo de vida da magia (projéteis, áreas)
  - `speed` → Velocidade (para projéteis)
  - `creationTime` → Timestamp de criação
  - `effects` → Efeitos adicionais

### SpellCasterComponent
- **Dados**:
  - `knownSpells` → Lista de IDs de magias conhecidas
  - `cooldowns` → Objeto com cooldowns atuais por magia
  - `castingSpell` → ID da magia sendo lançada
  - `castingStartTime` → Timestamp de início do lançamento
  - `castingEndTime` → Timestamp previsto de término do lançamento
  - `castingProgress` → Progresso atual do lançamento (0-1)
  - `castingTarget` → Alvo do lançamento
  - `castingPosition` → Posição alvo do lançamento
  - `canCastWhileMoving` → Flag indicando se pode lançar em movimento

### ManaComponent
- **Dados**:
  - `currentMana` → Mana atual
  - `maxMana` → Mana máxima
  - `regeneration` → Taxa de regeneração por segundo
  - `lastUsageTime` → Timestamp do último uso de mana
  - `regenDelay` → Atraso para iniciar regeneração após uso

### EffectComponent
- **Dados**:
  - `activeEffects` → Lista de efeitos ativos
  - `immunities` → Lista de efeitos aos quais a entidade é imune

## Catálogo de Eventos

| Evento | Emissor | Consumidores | Dados | Descrição |
|--------|---------|--------------|-------|-----------|
| `player:join` | NetworkSystem | GameSystem, UISystem | {playerId, name, team} | Novo jogador conectado |
| `player:joinConfirmed` | NetworkSystem (Servidor) | NetworkSystem (Cliente) | {playerId, entityId} | Confirmação de entrada no jogo |
| `player:leave` | NetworkSystem | GameSystem, UISystem | {playerId} | Jogador desconectado |
| `player:move` | InputSystem, NetworkSystem | PhysicsSystem, RenderSystem | {playerId, position, velocity, rotation, timestamp} | Jogador moveu-se |
| `player:jump` | InputSystem, NetworkSystem | PhysicsSystem | {playerId, timestamp} | Jogador pulou |
| `player:shoot` | InputSystem, NetworkSystem | WeaponSystem, BallisticsSystem | {playerId, weaponId, position, direction, timestamp} | Jogador disparou |
| `player:reload` | InputSystem, NetworkSystem | WeaponSystem, UISystem | {playerId, weaponId, timestamp} | Jogador recarregou |
| `player:switchWeapon` | InputSystem, NetworkSystem | WeaponSystem, UISystem | {playerId, weaponId, timestamp} | Jogador trocou de arma |
| `player:castSpell` | InputSystem, NetworkSystem | SpellSystem, UISystem | {playerId, spellId, target, timestamp} | Jogador lançou magia |
| `player:damage` | CombatSystem, NetworkSystem | HealthSystem, UISystem | {playerId, damage, attackerId, weaponId} | Jogador tomou dano |
| `player:death` | CombatSystem, NetworkSystem | GameSystem, UISystem | {playerId, killerId, weaponId} | Jogador morreu |
| `player:respawn` | GameSystem, NetworkSystem | UISystem | {playerId, position} | Jogador renasceu |
| `projectile:hit` | BallisticsSystem, NetworkSystem | RenderSystem, CombatSystem | {projectileId, targetId, position, normal} | Projétil atingiu algo |
| `input:look` | InputSystem | Cliente | {movementX, movementY} | Jogador moveu a visão |
| `input:aim` | InputSystem | Cliente | {aiming} | Jogador começou/parou de mirar |
| `spell:effect` | SpellSystem, NetworkSystem | RenderSystem, EffectSystem | {spellId, position, targetIds, caster} | Efeito de magia aplicado |
| `match:start` | GameSystem, NetworkSystem | UISystem | {mapId, teams, players} | Partida iniciou |
| `match:end` | GameSystem, NetworkSystem | UISystem | {winningTeam, scores} | Partida terminou |
| `network:connected` | NetworkSystem (Cliente) | Cliente | {} | Conexão estabelecida com o servidor |
| `network:disconnected` | NetworkSystem (Cliente) | Cliente | {} | Desconectado do servidor |
| `network:error` | NetworkSystem (Cliente) | Cliente | {error} | Erro de conexão |
| `network:maxReconnectAttempts` | NetworkSystem (Cliente) | Cliente | {} | Máximo de tentativas de reconexão atingido |
| `chat:message` | NetworkSystem | UISystem | {playerId, playerName, message, timestamp} | Mensagem de chat |
| `game:state` | NetworkSystem (Servidor) | Cliente | {status, time, teams, players} | Estado atual do jogo |

## Diretrizes para Implementação

### Princípios Gerais
1. **Desacoplamento**: Sistemas comunicam-se via eventos, não chamadas diretas
2. **Coesão**: Cada sistema tem uma responsabilidade única e bem definida
3. **Simplicidade**: Prefira soluções simples a complexas quando possível
4. **Autoridade do Servidor**: Lógica crítica sempre no servidor
5. **Predição no Cliente**: Cliente prediz resultados para responsividade, servidor valida

### Implementando um Novo Sistema
1. Defina claramente suas responsabilidades
2. Identifique componentes necessários
3. Declare interfaces públicas
4. Documente eventos emitidos e consumidos
5. Implemente o sistema no cliente e/ou servidor
6. Atualize este documento

### Implementando um Novo Componente
1. Defina dados necessários para representar o estado
2. Evite incluir lógica no componente
3. Crie o componente nos arquivos compartilhados
4. Atualize este documento

## Auto-Documentação e Atualização

### Diretrizes para Atualização deste Documento

Este documento serve como a fonte de verdade para a arquitetura do projeto. Ao implementar novas funcionalidades, siga estas diretrizes para atualizá-lo:

1. **Ao adicionar um novo sistema**:
   - Adicione uma nova seção em "Catálogo de Sistemas" seguindo o formato existente
   - Liste todos os arquivos relacionados
   - Documente as interfaces públicas
   - Especifique os componentes utilizados
   - Documente os eventos emitidos e consumidos

2. **Ao adicionar um novo componente**:
   - Adicione uma nova seção em "Catálogo de Componentes"
   - Liste todos os dados armazenados no componente
   - Explique brevemente o propósito do componente

3. **Ao adicionar novos eventos**:
   - Adicione o evento à tabela em "Catálogo de Eventos"
   - Especifique emissor, consumidores e formato dos dados

4. **Ao fazer alterações significativas**:
   - Adicione uma entrada em "Registro de Mudanças" com a data
   - Descreva brevemente as mudanças realizadas
   - Atualize a versão do documento no topo

5. **Ao implementar uma nova funcionalidade**:
   - Especifique como a funcionalidade se integra aos sistemas existentes
   - Atualize qualquer documentação relacionada à funcionalidade

### Formato para Documentação de Sistema

```
### Sistema XXX (XXXSystem)
- **Arquivos**:
  - `caminho/para/ArquivoX.js`
  - `caminho/para/ArquivoY.js`
  
- **Responsabilidades**:
  - Responsabilidade 1
  - Responsabilidade 2
  
- **Interfaces**:
  - `metodo1(param1, param2)` → Descrição do método
  - `metodo2(param)` → Descrição do método

- **Componentes Utilizados**:
  - `ComponenteA`
  - `ComponenteB`

- **Eventos Emitidos**:
  - `evento:tipo1` → Descrição do evento
  - `evento:tipo2` → Descrição do evento
  
- **Eventos Consumidos**:
  - `evento:tipo3` → Como o sistema reage
  - `evento:tipo4` → Como o sistema reage
```

### Formato para Documentação de Componente

```
### XXXComponent
- **Dados**:
  - `propriedade1` → Descrição da propriedade
  - `propriedade2` → Descrição da propriedade
```

### Formato para Registro de Mudanças

```
### YYYY-MM-DD: Título da Mudança
- Mudança 1
- Mudança 2
- Próximos passos (opcional)
```

## Registro de Mudanças - O QUE JÁ FOI FEITO:

### 2025-03-24: Implementação da Infraestrutura Básica e Sistemas Essenciais
- Criação da estrutura de pastas e arquivos conforme especificação da arquitetura
- Implementação do package.json com as dependências necessárias para o projeto

### 2025-03-25: Implementação do Sistema de Física
- Desenvolvimento do PhysicsSystem para o cliente utilizando Ammo.js em client/systems/PhysicsSystem.js
- Implementação das interfaces de detecção de colisão, raycast e simulação física
- Desenvolvimento do PhysicsSystem para o servidor em server/systems/PhysicsSystem.js
- Implementação da validação de movimentos de jogadores no servidor
- Implementação da simulação de projéteis no servidor
- Integração do sistema de eventos para notificação de colisões físicas
- Atualização da documentação do Sistema de Física para refletir todas as interfaces implementadas

### 2025-03-26: Implementação do Sistema de Armas
- Desenvolvimento do WeaponSystem para o cliente em client/systems/WeaponSystem.js
- Implementação do gerenciamento de arsenal, munição e recarregamento
- Desenvolvimento do WeaponSystem para o servidor em server/systems/WeaponSystem.js
- Implementação da validação de disparos e cálculo de dano
- Criação de constantes de armas em shared/constants/WeaponConstants.js
- Implementação de efeitos visuais para disparos e recargas
- Integração com sistema de física para simulação de projéteis
- Implementação de sistema de recuo das armas baseado em características

### 2025-03-27: Implementação do Sistema de Balística (BallisticsSystem)
- Desenvolvimento do BallisticsSystem para o cliente em client/systems/BallisticsSystem.js
- Desenvolvimento do BallisticsSystem para o servidor em server/systems/BallisticsSystem.js
- Criação de constantes compartilhadas para balística em shared/constants/BallisticsConstants.js
- Implementação do componente ProjectileComponent em shared/components/ProjectileComponent.js
- Implementação da simulação de trajetória de projéteis com física realista
- Implementação do cálculo de dano baseado em distância, localização do impacto e materiais
- Implementação do sistema de penetração de materiais
- Implementação do cálculo de recuo de armas
- Integração com o PhysicsSystem para detecção de colisões
- Implementação da representação visual de projéteis e efeitos de impacto no cliente
- Atualização da documentação do Sistema de Balística

### 2025-03-28: Implementação do Sistema de Combate (CombatSystem)
- Desenvolvimento do CombatSystem para o servidor em server/systems/CombatSystem.js
- Desenvolvimento do CombatSystem para o cliente em client/systems/CombatSystem.js
- Criação das constantes de combate em shared/constants/CombatConstants.js
- Implementação do sistema de dano baseado em armas, distância e partes do corpo
- Implementação de sistema de efeitos de status (buffs/debuffs)
- Implementação de feedback visual e sonoro para eventos de combate
- Implementação de sistema de morte e respawn
- Implementação de sistema de cura e regeneração de saúde
- Implementação de sistema de visualização de dano (números, efeitos visuais)
- Implementação de sistema de log de dano para estatísticas e killcam
- Integração com WeaponSystem e BallisticsSystem
- Integração com sistema de rede para sincronização entre clientes

### 2025-03-29: Implementação do Sistema de Magias (SpellSystem)
- Desenvolvimento do SpellSystem para o cliente em client/systems/SpellSystem.js
- Desenvolvimento do SpellSystem para o servidor em server/systems/SpellSystem.js
- Criação de constantes para magias em shared/constants/SpellConstants.js
- Implementação dos componentes SpellComponent, SpellCasterComponent e ManaComponent em shared/components/SpellComponent.js
- Implementação do sistema de lançamento de magias com tempo de preparação
- Implementação de diferentes tipos de magias: projéteis, áreas, buffs, debuffs, utilidades e invocações
- Implementação de sistema de elementos mágicos com diferentes efeitos visuais e mecânicos
- Implementação de efeitos de status (queimadura, lentidão, escudos, etc.)
- Integração com o sistema de física para colisões de projéteis mágicos
- Implementação de regeneração de mana e gerenciamento de recursos
- Implementação de visualização de efeitos mágicos no cliente
- Atualização da documentação do Sistema de Magias, seus componentes, constantes e eventos

### 2025-03-30: Implementação do Sistema de UI (UISystem)
- Desenvolvimento do UISystem em client/systems/UISystem.js
- Implementação de interface gráfica completa para o jogo incluindo:
  - HUD com informações de saúde, mana e munição
  - Sistema de menus (pausa, morte, fim de partida)
  - Feed de abates com notificações visuais
  - Indicadores de dano e direção de ataques
  - Sistema de chat in-game
  - Overlays visuais para feedback de dano, cura e efeitos de status
  - Confirmações visuais de abates e headshots
  - Temporizador de respawn
  - Tela de resultados de partida com estatísticas dos jogadores
- Integração com sistema de eventos para reação às ações do jogo
- Criação de estilos CSS dinâmicos para todos os elementos da interface
- Otimização para garantir performance mesmo em momentos de alta atividade no jogo
- Implementação de sistema responsivo para diferentes tamanhos de tela
- Atualização da documentação do Sistema de UI para refletir todas as interfaces implementadas

### 2025-03-31: Implementação do Sistema de Renderização (RenderSystem)
- Desenvolvimento do RenderSystem em client/systems/RenderSystem.js
- Implementação da inicialização do Three.js com cena, câmera e renderizador
- Implementação do gerenciamento de entidades visuais com componentes
- Implementação de geração procedural de modelos 3D low-poly/voxel:
  - Personagens (jogadores)
  - Armas (pistolas, rifles, shotguns, varinhas, cajados)
  - Projéteis (balas, projéteis mágicos)
  - Obstáculos (caixas, cilindros, esferas)
  - Efeitos mágicos (auras, escudos, vórtices)
- Implementação de efeitos visuais de magias com diferentes estilos e comportamentos:
  - Explosões com partículas e luzes dinâmicas
  - Relâmpagos com linhas animadas aleatoriamente
  - Portais com anéis luminosos e efeitos translúcidos
  - Auras com esferas semitransparentes e partículas
  - Projéteis mágicos com rastros e iluminação
- Implementação de sistema de animação de efeitos baseado em tempo de vida
- Implementação de câmera em primeira pessoa com controle de rotação
- Implementação de sistema de iluminação dinâmica com luzes ambiente, direcional e hemisférica
- Implementação de otimizações de renderização:
  - Cache de modelos para reutilização
  - Sistema de instanciação de objetos similares
  - Gerenciamento de ciclo de vida de efeitos visuais temporários
- Implementação de tratamento de eventos de redimensionamento da janela
- Implementação de sistema de sombras para maior realismo visual
- Implementação de loop de animação otimizado com delta time
- Implementação de gerenciamento adequado de recursos e disposição
- Atualização da documentação do Sistema de Renderização para refletir todas as interfaces implementadas


### 2025-04-01: Implementação do Sistema de Entrada (InputSystem) com EventEmitter documentado.
- Desenvolvimento do InputSystem em client/systems/InputSystem.js
- Implementação do EventEmitter em shared/utils/EventEmitter.js para comunicação baseada em eventos
- Implementação do gerenciamento de entrada do teclado para movimentação (WASD)
- Implementação do gerenciamento de entrada do mouse para olhar e atirar
- Implementação do gerenciamento do ponteiro bloqueado (pointer lock)
- Implementação de mapeamento de teclas configurável
- Implementação de sensibilidade de mouse ajustável
- Implementação de prevenção de comportamento padrão para teclas de jogo
- Implementação de normalização de movimento diagonal
- Integração com eventos DOM para capturar entradas
- Implementação de sistema de eventos para emitir ações para outros sistemas
- Implementação de cooldowns para ações como pulo
- Implementação de modificadores de velocidade (sprint, agachar)
- Implementação de gerenciamento de ciclo de vida para limpar recursos adequadamente
- Atualização da documentação do Sistema de Entrada para refletir todas as interfaces implementadas


### 2025-04-02: Implementação do Sistema de Rede (NetworkSystem)
- Desenvolvimento do NetworkSystem para o cliente em client/systems/NetworkSystem.js
- Desenvolvimento do NetworkSystem para o servidor em server/systems/NetworkSystem.js
- Implementação de comunicação em tempo real usando Socket.IO
- Implementação de sistema de salas para partidas
- Implementação de gerenciamento de conexão e reconexão
- Implementação de sincronização de tempo entre cliente e servidor
- Implementação de sistema de medição de latência (ping/pong)
- Implementação de filtro de mensagens para o chat
- Implementação de validação de movimento do jogador
- Implementação de difusão de eventos para jogadores corretos
- Implementação de sistema de equipes para comunicação em chat
- Implementação de transmissão de estado de jogo para clientes
- Implementação de tratamento de novos jogadores entrando e saindo
- Integração com o GameSystem para validação de ações dos jogadores
- Atualização da documentação do Sistema de Rede para refletir todas as interfaces implementadas

### 2025-04-03: Implementação do Sistema de Jogo (GameSystem) e Componentes Básicos
- Desenvolvimento do GameSystem em server/systems/GameSystem.js
- Criação de constantes de jogo em shared/constants/GameConfig.js
- Implementação dos componentes:
  - PlayerComponent em shared/components/PlayerComponent.js
  - PositionComponent em shared/components/PositionComponent.js
  - HealthComponent em shared/components/HealthComponent.js
  - PhysicsComponent em shared/components/PhysicsComponent.js
- Implementação da lógica de fluxo de partida (início, fim, reset)
- Implementação do gerenciamento de jogadores e equipes
- Implementação do sistema de pontuação e verificação de condições de vitória
- Implementação do gerenciamento de respawn de jogadores
- Implementação da geração de mapas com paredes e obstáculos
- Implementação de sistema de equipes com balanceamento automático
- Integração com NetworkSystem para comunicação com clientes
- Integração com PhysicsSystem para colisões e posicionamento físico
- Integração com WeaponSystem para criação inicial de armas dos jogadores
- Implementação de sistema completo de estado de jogo para sincronização
- Acompanhamento e sincronização de tempo de partida
- Atualização da documentação do Sistema de Jogo e seus componentes


### 2025-04-04: Implementação dos Componentes Restantes
- Desenvolvimento do VelocityComponent em shared/components/VelocityComponent.js
  - Implementação de métodos para definição e manipulação de velocidade
  - Adição de funções utilitárias para operações com vetores de velocidade
  - Implementação de serialização para comunicação em rede
- Desenvolvimento do RenderComponent em shared/components/RenderComponent.js
  - Suporte a diferentes tipos de modelos (jogador, arma, projétil, etc.)
  - Configuração de materiais, cores e efeitos visuais
  - Implementação de sistema de animação e efeitos especiais
- Desenvolvimento do RigidBodyComponent em shared/components/RigidBodyComponent.js
  - Integração com Ammo.js para simulação física realista
  - Suporte a diferentes formas de colisão (caixa, esfera, cilindro, etc.)
  - Implementação de detecção de estados como "grounded"
  - Sistema de filtragem de colisões e configuração de propriedades físicas
- Desenvolvimento do FirstPersonComponent em shared/components/FirstPersonComponent.js
  - Gerenciamento de câmera em primeira pessoa com controle de rotação
  - Sistema de balanço ao andar para maior realismo
  - Implementação de efeitos visuais para feedback (dano, cura, etc.)
  - Suporte a recuo visual de armas
- Desenvolvimento do AttributeComponent em shared/components/AttributeComponent.js
  - Sistema de atributos básicos (força, destreza, inteligência, vitalidade)
  - Implementação de sistema de níveis e experiência
  - Cálculo de bônus baseados nos atributos
  - Suporte a modificadores temporários (buffs/debuffs)
- Desenvolvimento do EffectComponent em shared/components/EffectComponent.js
  - Sistema completo de efeitos de status (buffs, debuffs, efeitos periódicos)
  - Gerenciamento de efeitos acumuláveis (stacks)
  - Sistema de imunidades e remoção de efeitos
  - Cálculo de modificadores baseados em efeitos ativos
- Atualização da documentação com os novos componentes implementados


### 2025-04-05: Implementação do Sistema de Matchmaking (MatchmakingSystem)
- Desenvolvimento do MatchmakingSystem em server/systems/MatchmakingSystem.js
- Criação de constantes para matchmaking em shared/constants/MatchmakingConstants.js
- Implementação de sistema completo de filas de jogadores para diferentes modos de jogo
- Implementação de matchmaking baseado em habilidade para partidas competitivas
- Implementação de sistema de salas personalizadas com configuração e controle por parte do host
- Implementação de balanceamento de equipes baseado em habilidade e nível dos jogadores
- Implementação de sistema de penalidades para abandono de partidas
- Implementação de sistema de ranking com algoritmo ELO para atualização de ratings
- Implementação de reconexão para jogadores que se desconectam durante partidas
- Implementação de transição de estados das salas (espera, iniciando, ativa, finalizando)
- Implementação de estimativa de tempo de espera em filas
- Integração com GameSystem para gerenciamento do ciclo de vida das partidas
- Integração com NetworkSystem para comunicação com os clientes
- Atualização da documentação do Sistema de Matchmaking