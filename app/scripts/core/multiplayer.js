          class MultiplayerManager {
  constructor() {
    this.peer = null;
    this.connections = {};
    this.playerNames = {};
    this.playerSlots = {};
    this.maxPlayers = 4;
    this.roomId = null;
    this.isHost = false;
    this.playerName = null;
    this.playingMultiplayer = false;
    this.gameStateInterval = null;

    this.hostRoomIdDisplay = document.getElementById('host-room-code');
    this.joinRoomIdDisplay = document.getElementById('join-room-code');
    this.hostPlayerList = document.getElementById('host-player-list');
    this.joinPlayerList = document.getElementById('join-player-list');
    this.hostPlayerCount = document.getElementById('host-player-count');
    this.joinPlayerCount = document.getElementById('join-player-count');
    this.startButton = document.getElementById('game-start');
    this.menuActions = document.getElementById('menu-actions');
    this.hostPanel = document.getElementById('host-panel');
    this.joinPanel = document.getElementById('join-panel');
    this.hostNameInput = document.getElementById('host-name');
    this.joinNameInput = document.getElementById('join-name');
    this.hostActionButton = document.getElementById('host-action');
    this.joinActionButton = document.getElementById('join-action');
    this.hostMenuButton = document.getElementById('host-menu');
    this.joinMenuButton = document.getElementById('join-menu');
    this.hostLobby = document.getElementById('host-lobby');
    this.joinLobby = document.getElementById('join-lobby');
    this.hostSetup = document.getElementById('host-setup');
    this.joinSetup = document.getElementById('join-setup');

    this.initUi();
  }

  initUi() {
    if (this.hostMenuButton) this.hostMenuButton.addEventListener('click', () => this.showHostPanel());
    if (this.joinMenuButton) this.joinMenuButton.addEventListener('click', () => this.showJoinPanel());
    if (this.hostActionButton) this.hostActionButton.addEventListener('click', () => this.startHosting());
    if (this.joinActionButton) this.joinActionButton.addEventListener('click', () => this.performJoin());
    if (this.startButton) this.startButton.addEventListener('click', () => this.startGame());
  }

  generateRoomId(length = 5) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let id = '';
    while (id.length < length) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  }

  createPeer(roomId = null) {
    if (this.peer) return this.peer;

    this.peer = roomId ? new Peer(roomId) : new Peer();
    this.peer.on('open', (id) => {
      this.peerId = id;
      this.playerNames[id] = this.playerName || 'Player';
      if (this.isHost) {
        this.roomId = id;
        this.playerNames[id] = this.playerName || 'Host';
        if (this.hostRoomIdDisplay) this.hostRoomIdDisplay.innerText = id;
        this.updatePlayerList();
        this.broadcastPlayerList();
        this.showHostLobby();
      }
    });

    this.peer.on('connection', (conn) => {
      // Host receives incoming connections
      if (!this.isHost) return conn.close();
      if (Object.keys(this.connections).length >= this.maxPlayers - 1) {
        conn.on('open', () => conn.send({ type: 'room_full' }));
        conn.close();
        return;
      }

      this.registerConnection(conn);
    });

    return this.peer;
  }

  showHostLobby() {
    if (this.hostSetup) this.hostSetup.classList.add('hidden');
    if (this.hostLobby) this.hostLobby.classList.remove('hidden');
  }

  showJoinLobby() {
    if (this.joinSetup) this.joinSetup.classList.add('hidden');
    if (this.joinLobby) this.joinLobby.classList.remove('hidden');
  }

  showHostPanel() {
    if (this.menuActions) this.menuActions.classList.add('hidden');
    if (this.hostPanel) this.hostPanel.classList.remove('hidden');
    if (this.joinPanel) this.joinPanel.classList.add('hidden');
    if (this.hostSetup) this.hostSetup.classList.remove('hidden');
    if (this.hostLobby) this.hostLobby.classList.add('hidden');
    if (this.joinLobby) this.joinLobby.classList.add('hidden');
  }

  showJoinPanel() {
    if (this.menuActions) this.menuActions.classList.add('hidden');
    if (this.joinPanel) this.joinPanel.classList.remove('hidden');
    if (this.hostPanel) this.hostPanel.classList.add('hidden');
    if (this.joinSetup) this.joinSetup.classList.remove('hidden');
    if (this.joinLobby) this.joinLobby.classList.add('hidden');
  }

  startHosting() {
    const name = this.hostNameInput?.value?.trim();
    if (!name) return alert('Enter a name to host');

    this.playerName = name;
    this.isHost = true;
    this.playingMultiplayer = true;
    this.createPeer(this.generateRoomId());
  }

  performJoin() {
    const name = this.joinNameInput?.value?.trim();
    const roomId = document.getElementById('join-room-id')?.value?.trim();
    if (!name) return alert('Enter a name to join');
    if (!roomId) return alert('Enter a room code to join');

    this.playerName = name;
    this.isHost = false;
    this.playingMultiplayer = true;
    this.createPeer();

    const conn = this.peer.connect(roomId);
    conn.on('open', () => {
      this.registerConnection(conn);
      this.showJoinLobby();
      conn.send({ type: 'introduce', id: this.peerId, name: this.playerName });
    });
    conn.on('error', (err) => console.warn('Connection error', err));
  }

  registerConnection(conn) {
    const remoteId = conn.remoteId || conn.peer;
    this.connections[remoteId] = conn;

    conn.on('data', (data) => this.handleMessage(conn, data));
    conn.on('close', () => {
      delete this.connections[remoteId];
      delete this.playerNames[remoteId];
      delete this.playerSlots[remoteId];
      this.updatePlayerList();
      if (this.isHost) this.broadcastPlayerList();
    });

    if (this.isHost) {
      conn.send({ type: 'request_introduce' });
    }

    this.updatePlayerList();
    if (this.isHost) this.broadcastPlayerList();
  }

  handleMessage(conn, data) {
    if (!data || !data.type) return;
    const remoteId = conn.remoteId || conn.peer;
    if (data.type === 'introduce') {
      if (this.isHost) {
        this.playerNames[remoteId] = data.name || remoteId;
        this.updatePlayerList();
        this.broadcastPlayerList();
      }
    } else if (data.type === 'request_introduce') {
      conn.send({ type: 'introduce', id: this.peerId, name: this.playerName || 'Player' });
    } else if (data.type === 'player_list') {
      this.playerSlots = {};
      if (data.roomId) {
        this.roomId = data.roomId;
        if (this.joinRoomIdDisplay) this.joinRoomIdDisplay.innerText = data.roomId;
      }
      if (Array.isArray(data.players)) {
        data.players.forEach((player) => {
          if (player.id && player.name) {
            this.playerNames[player.id] = player.name;
            if (typeof player.slot === 'number') {
              this.playerSlots[player.id] = player.slot;
            }
          }
        });
      }
      this.updatePlayerList();
      this.showJoinLobby();
    } else if (data.type === 'start_game') {
      window.dispatchEvent(new CustomEvent('multiplayer:start', { detail: {} }));
    } else if (data.type === 'player_input') {
      if (this.isHost && window.gameCoordinator) {
        window.gameCoordinator.applyRemotePlayerInput(data);
      }
    } else if (data.type === 'game_state') {
      if (!this.isHost) {
        window.dispatchEvent(new CustomEvent('multiplayer:state', { detail: data }));
      }
    } else if (data.type === 'room_full') {
      alert('Room is full');
    }
  }

  updatePlayerList() {
    const players = [this.peerId].concat(Object.keys(this.connections));
    const targetList = this.isHost ? this.hostPlayerList : this.joinPlayerList;
    const targetCount = this.isHost ? this.hostPlayerCount : this.joinPlayerCount;

    if (targetList) {
      while (targetList.firstChild) targetList.removeChild(targetList.firstChild);
      players.slice(0, this.maxPlayers).forEach((p) => {
        const li = document.createElement('li');
        li.innerText = this.playerNames[p] || p;
        targetList.appendChild(li);
      });
    }

    if (targetCount) targetCount.innerText = String(Math.min(players.length, this.maxPlayers));

    if (this.startButton) {
      this.startButton.disabled = !this.isHost || players.length === 0;
    }
  }

  broadcastPlayerList() {
    if (!this.isHost || !this.roomId) return;

    const players = [this.peerId].concat(Object.keys(this.connections)).slice(0, this.maxPlayers);
    const payload = {
      type: 'player_list',
      roomId: this.roomId,
      players: players.map((id, slot) => ({
        id,
        name: this.playerNames[id] || id,
        slot,
      })),
    };

    this.playerSlots = {};
    payload.players.forEach((player) => {
      this.playerSlots[player.id] = player.slot;
    });

    Object.values(this.connections).forEach((conn) => {
      if (conn.open) conn.send(payload);
    });
  }

  broadcast(message) {
    Object.values(this.connections).forEach((conn) => {
      if (conn.open) conn.send(message);
    });
  }

  broadcastGameState() {
    if (!this.isHost || !this.roomId || !window.gameCoordinator) return;

    const players = window.gameCoordinator.players || [window.gameCoordinator.pacman];

    const playerStates = players.map((player, slot) => ({
      slot,
      top: player.position.top,
      left: player.position.left,
      direction: player.direction,
      moving: player.moving,
    }));

    const ghostStates = window.gameCoordinator.ghosts.map((ghost) => ({
      name: ghost.name,
      top: ghost.position.top,
      left: ghost.position.left,
      direction: ghost.direction,
      mode: ghost.mode,
      moving: ghost.moving,
    }));

    this.broadcast({
      type: 'game_state',
      playerStates,
      ghostStates,
    });
  }

  startGameStateBroadcast() {
    if (this.gameStateInterval) return;
    this.gameStateInterval = setInterval(() => {
      this.broadcastGameState();
    }, 100);
  }

  sendPlayerInput(input) {
    Object.values(this.connections).forEach((conn) => {
      if (conn.open) conn.send({ type: 'player_input', ...input });
    });
  }

  startGame() {
    if (this.isHost) {
      this.broadcastPlayerList();
      this.broadcast({ type: 'start_game' });
      this.broadcastGameState();
      this.startGameStateBroadcast();
    } else {
      this.broadcast({ type: 'start_game' });
    }

    window.dispatchEvent(new CustomEvent('multiplayer:start', { detail: {} }));
  }
}

window.MultiplayerManager = MultiplayerManager;
