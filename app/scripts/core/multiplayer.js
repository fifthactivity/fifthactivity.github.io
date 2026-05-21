class MultiplayerManager {
  constructor() {
    this.peer = null;
    this.connections = {};
    this.playerNames = {};
    this.maxPlayers = 4;
    this.roomId = null;
    this.isHost = false;
    this.playerName = null;

    this.roomIdDisplay = document.getElementById('room-id');
    this.playerList = document.getElementById('player-list');
    this.playerCount = document.getElementById('player-count');
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
      if (this.isHost) {
        this.roomId = id;
        this.playerNames[id] = this.playerName || 'Host';
        if (this.roomIdDisplay) this.roomIdDisplay.innerText = id;
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
    const hostSetup = document.getElementById('host-setup');
    if (hostSetup) hostSetup.classList.add('hidden');
    if (this.hostLobby) this.hostLobby.classList.remove('hidden');
  }

  showHostPanel() {
    if (this.menuActions) this.menuActions.classList.add('hidden');
    if (this.hostPanel) this.hostPanel.classList.remove('hidden');
    if (this.joinPanel) this.joinPanel.classList.add('hidden');
    if (this.hostLobby) this.hostLobby.classList.add('hidden');
  }

  showJoinPanel() {
    if (this.menuActions) this.menuActions.classList.add('hidden');
    if (this.joinPanel) this.joinPanel.classList.remove('hidden');
    if (this.hostPanel) this.hostPanel.classList.add('hidden');
  }

  startHosting() {
    const name = this.hostNameInput?.value?.trim();
    if (!name) return alert('Enter a name to host');

    this.playerName = name;
    this.isHost = true;
    this.createPeer(this.generateRoomId());
  }

  performJoin() {
    const name = this.joinNameInput?.value?.trim();
    const roomId = document.getElementById('join-room-id')?.value?.trim();
    if (!name) return alert('Enter a name to join');
    if (!roomId) return alert('Enter a room code to join');

    this.playerName = name;
    this.isHost = false;
    this.createPeer();

    const conn = this.peer.connect(roomId);
    conn.on('open', () => {
      this.registerConnection(conn);
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
      this.updatePlayerList();
    });

    // For host: ask for identification
    if (this.isHost) {
      conn.send({ type: 'request_introduce' });
    }

    this.updatePlayerList();
  }

  handleMessage(conn, data) {
    if (!data || !data.type) return;
    const remoteId = conn.remoteId || conn.peer;
    if (data.type === 'introduce') {
      if (this.isHost) {
        this.playerNames[remoteId] = data.name || remoteId;
        this.updatePlayerList();
      }
    } else if (data.type === 'request_introduce') {
      conn.send({ type: 'introduce', id: this.peerId, name: this.playerName || 'Player' });
    } else if (data.type === 'room_full') {
      alert('Room is full');
    }
  }

  updatePlayerList() {
    if (!this.playerList) return;
    while (this.playerList.firstChild) this.playerList.removeChild(this.playerList.firstChild);

    const players = this.isHost ? [this.peerId].concat(Object.keys(this.connections)) : [this.peerId];
    players.slice(0, this.maxPlayers).forEach((p) => {
      const li = document.createElement('li');
      li.innerText = this.playerNames[p] || p;
      this.playerList.appendChild(li);
    });

    if (this.playerCount) this.playerCount.innerText = String(Math.min(players.length, this.maxPlayers));

    if (this.startButton) {
      this.startButton.disabled = !this.isHost || players.length === 0;
    }
  }

  broadcast(message) {
    Object.values(this.connections).forEach((conn) => {
      if (conn.open) conn.send(message);
    });
  }

  startGame() {
    // For now, emit a start message to connected peers
    this.broadcast({ type: 'start_game' });
    // Host can also trigger UI changes; gameCoordinator should listen for this as needed
    window.dispatchEvent(new CustomEvent('multiplayer:start', { detail: {} }));
  }
}

window.MultiplayerManager = MultiplayerManager;
