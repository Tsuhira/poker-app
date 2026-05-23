import Peer from "peerjs";
import { BaseTransport } from "./interface.js";

// メッセージタイプ定数
const MSG = {
  JOIN: "join",
  STATE: "state",
  HOLE_CARDS: "holeCards",
  ACTION: "action",
  PLAYER_JOIN: "playerJoin",
  PLAYER_LEAVE: "playerLeave",
};

export class WebRTCTransport extends BaseTransport {
  constructor() {
    super();
    this._peer = null;
    this._isHost = false;
    this._myPlayerId = null;
    this._hostConn = null;          // 参加者 → ホスト
    this._peerConns = {};           // ホスト: peerId → DataConnection
    this._handlers = {
      stateChange: [],
      holeCards: [],
      playerJoin: [],
      playerLeave: [],
      action: [],
    };
  }

  // ホスト: 部屋を作成して roomId (= peer.id) を返す
  async createRoom(_settings) {
    return new Promise((resolve, reject) => {
      this._peer = new Peer();
      this._isHost = true;

      this._peer.on("open", (id) => {
        this._myPlayerId = id;
        this._peer.on("connection", (conn) => this._handleIncoming(conn));
        resolve(id);
      });

      this._peer.on("error", reject);
    });
  }

  // 参加者: roomId を使ってホストに接続
  async joinRoom(roomId, player) {
    return new Promise((resolve, reject) => {
      this._peer = new Peer();
      this._isHost = false;
      this._myPlayerId = player.id;

      this._peer.on("open", () => {
        this._hostConn = this._peer.connect(roomId, { reliable: true });

        this._hostConn.on("open", () => {
          this._hostConn.send({ type: MSG.JOIN, player });
          this._hostConn.on("data", (msg) => this._dispatch(msg));
          resolve();
        });

        this._hostConn.on("error", reject);
      });

      this._peer.on("error", reject);
    });
  }

  async leaveRoom() {
    this._peer?.destroy();
    this._peer = null;
    this._peerConns = {};
    this._hostConn = null;
  }

  // ホスト: 全参加者にゲーム状態をブロードキャスト
  async publishState(state) {
    this._broadcast({ type: MSG.STATE, state });
  }

  // ホスト: 特定プレイヤーにのみ手札を送信
  async publishHoleCards(playerId, cards) {
    this._peerConns[playerId]?.send({ type: MSG.HOLE_CARDS, cards });
  }

  // 参加者: アクションをホストに送信
  async sendAction(action) {
    this._hostConn.send({ type: MSG.ACTION, action, from: this._myPlayerId });
  }

  onStateChange(cb) { return this._on("stateChange", cb); }
  onHoleCards(cb)   { return this._on("holeCards", cb); }
  onPlayerJoin(cb)  { return this._on("playerJoin", cb); }
  onPlayerLeave(cb) { return this._on("playerLeave", cb); }
  onAction(cb)      { return this._on("action", cb); }

  // --- 内部 ---

  _on(type, cb) {
    this._handlers[type].push(cb);
    return () => {
      this._handlers[type] = this._handlers[type].filter((h) => h !== cb);
    };
  }

  _emit(type, ...args) {
    this._handlers[type].forEach((cb) => cb(...args));
  }

  _broadcast(msg) {
    Object.values(this._peerConns).forEach((conn) => conn.send(msg));
  }

  _broadcastExcept(excludeId, msg) {
    Object.entries(this._peerConns)
      .filter(([id]) => id !== excludeId)
      .forEach(([, conn]) => conn.send(msg));
  }

  // ホスト: 新しい接続が来たときの処理
  _handleIncoming(conn) {
    conn.on("data", (msg) => {
      if (msg.type === MSG.JOIN) {
        const player = { ...msg.player, isHost: false };
        this._peerConns[player.id] = conn;
        this._emit("playerJoin", player);
        this._broadcastExcept(player.id, { type: MSG.PLAYER_JOIN, player });
      } else if (msg.type === MSG.ACTION) {
        this._emit("action", msg.from, msg.action);
      }
    });

    conn.on("close", () => {
      const playerId = Object.keys(this._peerConns).find(
        (id) => this._peerConns[id] === conn
      );
      if (playerId) {
        delete this._peerConns[playerId];
        this._emit("playerLeave", playerId);
        this._broadcast({ type: MSG.PLAYER_LEAVE, playerId });
      }
    });
  }

  // 参加者: ホストからのメッセージを振り分ける
  _dispatch(msg) {
    switch (msg.type) {
      case MSG.STATE:        this._emit("stateChange", msg.state);    break;
      case MSG.HOLE_CARDS:  this._emit("holeCards", msg.cards);      break;
      case MSG.PLAYER_JOIN: this._emit("playerJoin", msg.player);    break;
      case MSG.PLAYER_LEAVE:this._emit("playerLeave", msg.playerId); break;
    }
  }
}
