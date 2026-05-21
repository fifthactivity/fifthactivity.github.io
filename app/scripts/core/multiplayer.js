class MultiplayerManager {
  constructor() {
    this.peer = null;
    this.connections = {};
    this.maxPlayers = 4;
    this.roomId = null;
    this.isHost = false;

    this.peerIdDisplay = document.getElementById('peer-id');
    this.roomIdDisplay = document.getElementById('room-id');
    this.playerList = document.getElementById('player-list');
    this.playerCount = document.getElementById('player-count');
    this.startButton = document.getElementById('game-start');

    this.initUi();
  }

  initUi() {
    const hostBtn = document.getElementById('host-room');
    const joinBtn = document.getElementById('join-room');
    const joinInput = document.getElementById('join-room-id');

    if (hostBtn) hostBtn.addEventListener('click', () => this.hostRoom());
    if (joinBtn && joinInput) joinBtn.addEventListener('click', () => this.joinRoom(joinInput.value));
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
      if (this.peerIdDisplay) this.peerIdDisplay.innerText = id;
      if (this.isHost) {
        this.roomId = id;
        if (this.roomIdDisplay) this.roomIdDisplay.innerText = id;
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

  hostRoom() {
    this.isHost = true;
    this.createPeer(this.generateRoomId());
  }

  joinRoom(roomId) {
    if (!roomId) return alert('Enter a room ID to join');
    this.isHost = false;
    this.createPeer();

    const conn = this.peer.connect(roomId);
    conn.on('open', () => {
      this.registerConnection(conn);
      conn.send({ type: 'introduce', id: this.peerId });
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
    if (data.type === 'introduce') {
      // add to UI
      this.updatePlayerList();
    } else if (data.type === 'room_full') {
      alert('Room is full');
    }
  }

  updatePlayerList() {
    if (!this.playerList) return;
    while (this.playerList.firstChild) this.playerList.removeChild(this.playerList.firstChild);

    // Host counts self plus connections
    const players = this.isHost ? [this.peerId].concat(Object.keys(this.connections)) : [this.peerId];
    players.slice(0, this.maxPlayers).forEach((p) => {
      const li = document.createElement('li');
      li.innerText = p;
      this.playerList.appendChild(li);
    });

    if (this.playerCount) this.playerCount.innerText = String(Math.min(players.length, this.maxPlayers));

    if (this.startButton) {
      // only host can start the game and there must be at least one other player or self
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
