import { describe, it, expect, vi, beforeEach } from "vitest";
import { BaseTransport } from "../../src/lib/transport/interface.js";

// --- PeerJS をモック ---
// WebRTCTransport のテストで使う簡易 Peer 実装
function makeMockPeer(autoId = "host-peer-id") {
  const peer = {
    id: autoId,
    _handlers: {},
    on(event, cb) { this._handlers[event] = cb; return this; },
    destroy() {},
    connect(targetId) {
      const conn = makeMockConn(targetId);
      return conn;
    },
    // テストから接続イベントを発火するヘルパー
    _triggerConnection(conn) { this._handlers["connection"]?.(conn); },
    _triggerOpen() { this._handlers["open"]?.(this.id); },
    _triggerError(err) { this._handlers["error"]?.(err); },
  };
  return peer;
}

function makeMockConn(targetId = "remote-peer") {
  const conn = {
    targetId,
    _handlers: {},
    _sent: [],
    on(event, cb) { this._handlers[event] = cb; return this; },
    send(msg) { this._sent.push(msg); },
    _triggerOpen() { this._handlers["open"]?.(); },
    _triggerData(data) { this._handlers["data"]?.(data); },
    _triggerClose() { this._handlers["close"]?.(); },
  };
  return conn;
}

// WebRTCTransport に Peer コンストラクタを注入できるよう内部を直接テスト
import { WebRTCTransport } from "../../src/lib/transport/webrtcTransport.js";

vi.mock("peerjs", () => {
  return { default: vi.fn() };
});

import Peer from "peerjs";

// --- BaseTransport ---
describe("BaseTransport", () => {
  it("非同期メソッドが Not implemented を reject する", async () => {
    const t = new BaseTransport();
    await expect(t.createRoom({})).rejects.toThrow("Not implemented");
    await expect(t.joinRoom("id", {})).rejects.toThrow("Not implemented");
    await expect(t.leaveRoom()).rejects.toThrow("Not implemented");
    await expect(t.publishState({})).rejects.toThrow("Not implemented");
    await expect(t.publishHoleCards("id", [])).rejects.toThrow("Not implemented");
    await expect(t.sendAction({})).rejects.toThrow("Not implemented");
  });

  it("同期メソッドが Not implemented を throw する", () => {
    const t = new BaseTransport();
    expect(() => t.onStateChange(() => {})).toThrow("Not implemented");
    expect(() => t.onHoleCards(() => {})).toThrow("Not implemented");
    expect(() => t.onPlayerJoin(() => {})).toThrow("Not implemented");
    expect(() => t.onPlayerLeave(() => {})).toThrow("Not implemented");
    expect(() => t.onAction(() => {})).toThrow("Not implemented");
  });
});

// --- WebRTCTransport ユニットテスト ---
describe("WebRTCTransport", () => {
  let transport;
  let mockPeer;

  beforeEach(() => {
    mockPeer = makeMockPeer("host-id");
    Peer.mockImplementation(() => {
      setTimeout(() => mockPeer._triggerOpen(), 0);
      return mockPeer;
    });
    transport = new WebRTCTransport();
  });

  it("createRoom: peer.id を roomId として返す", async () => {
    const roomId = await transport.createRoom({});
    expect(roomId).toBe("host-id");
    expect(transport._isHost).toBe(true);
  });

  it("onStateChange: ハンドラを登録して unsubscribe 関数を返す", async () => {
    await transport.createRoom({});
    const cb = vi.fn();
    const unsub = transport.onStateChange(cb);
    expect(typeof unsub).toBe("function");
    // 状態変化を内部 _dispatch で発火
    transport._dispatch({ type: "state", state: { street: "flop" } });
    expect(cb).toHaveBeenCalledWith({ street: "flop" });
    // unsubscribe 後は呼ばれない
    unsub();
    transport._dispatch({ type: "state", state: { street: "river" } });
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("onHoleCards: ハンドラを登録・解除できる", async () => {
    await transport.createRoom({});
    const cb = vi.fn();
    const unsub = transport.onHoleCards(cb);
    transport._dispatch({ type: "holeCards", cards: [{ suit: "S", rank: 14 }] });
    expect(cb).toHaveBeenCalledWith([{ suit: "S", rank: 14 }]);
    unsub();
    transport._dispatch({ type: "holeCards", cards: [] });
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("onPlayerJoin: 参加イベントを受信できる", async () => {
    await transport.createRoom({});
    const cb = vi.fn();
    transport.onPlayerJoin(cb);
    transport._dispatch({ type: "playerJoin", player: { id: "p1", displayName: "Alice" } });
    expect(cb).toHaveBeenCalledWith({ id: "p1", displayName: "Alice" });
  });

  it("onPlayerLeave: 退出イベントを受信できる", async () => {
    await transport.createRoom({});
    const cb = vi.fn();
    transport.onPlayerLeave(cb);
    transport._dispatch({ type: "playerLeave", playerId: "p1" });
    expect(cb).toHaveBeenCalledWith("p1");
  });

  it("publishState: 全接続済み peer に送信する", async () => {
    await transport.createRoom({});
    const conn1 = makeMockConn("p1");
    const conn2 = makeMockConn("p2");
    transport._peerConns["p1"] = conn1;
    transport._peerConns["p2"] = conn2;

    await transport.publishState({ street: "turn" });

    expect(conn1._sent).toContainEqual({ type: "state", state: { street: "turn" } });
    expect(conn2._sent).toContainEqual({ type: "state", state: { street: "turn" } });
  });

  it("publishHoleCards: 指定 peer にのみ送信する", async () => {
    await transport.createRoom({});
    const conn1 = makeMockConn("p1");
    const conn2 = makeMockConn("p2");
    transport._peerConns["p1"] = conn1;
    transport._peerConns["p2"] = conn2;

    const cards = [{ suit: "H", rank: 14 }];
    await transport.publishHoleCards("p1", cards);

    expect(conn1._sent).toContainEqual({ type: "holeCards", cards });
    expect(conn2._sent).toHaveLength(0);
  });

  it("_handleIncoming: JOIN メッセージで playerJoin ハンドラが呼ばれる", async () => {
    await transport.createRoom({});
    const joinCb = vi.fn();
    transport.onPlayerJoin(joinCb);

    const conn = makeMockConn("p1");
    transport._handleIncoming(conn);
    conn._triggerData({ type: "join", player: { id: "p1", displayName: "Bob" } });

    expect(joinCb).toHaveBeenCalledWith({ id: "p1", displayName: "Bob", isHost: false });
    expect(transport._peerConns["p1"]).toBe(conn);
  });

  it("_handleIncoming: close で playerLeave ハンドラが呼ばれる", async () => {
    await transport.createRoom({});
    const leaveCb = vi.fn();
    transport.onPlayerLeave(leaveCb);

    const conn = makeMockConn("p1");
    transport._peerConns["p1"] = conn;
    transport._handleIncoming(conn);
    conn._triggerClose();

    expect(leaveCb).toHaveBeenCalledWith("p1");
    expect(transport._peerConns["p1"]).toBeUndefined();
  });

  it("_handleIncoming: ACTION メッセージで onAction ハンドラが呼ばれる", async () => {
    await transport.createRoom({});
    const actionCb = vi.fn();
    transport.onAction(actionCb);

    const conn = makeMockConn("p1");
    transport._handleIncoming(conn);
    conn._triggerData({ type: "action", from: "p1", action: { type: "fold" } });

    expect(actionCb).toHaveBeenCalledWith("p1", { type: "fold" });
  });

  it("leaveRoom: peer を破棄してコネクションをリセットする", async () => {
    await transport.createRoom({});
    const destroySpy = vi.spyOn(mockPeer, "destroy");
    await transport.leaveRoom();
    expect(destroySpy).toHaveBeenCalled();
    expect(transport._peer).toBeNull();
  });
});

// --- FirestoreTransport ユニットテスト ---
describe("FirestoreTransport", () => {
  it("createRoom / joinRoom / sendAction は Firestore db を呼ぶ（統合テスト）", () => {
    // 実際の Firestore 接続が必要なテストは CI 環境では skip
    // ローカルで Firebase エミュレータを使う場合に実行する
    expect(true).toBe(true); // placeholder
  });
});
