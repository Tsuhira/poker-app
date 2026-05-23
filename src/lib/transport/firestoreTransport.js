import {
  doc,
  collection,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  onSnapshot,
  arrayUnion,
  serverTimestamp,
} from "firebase/firestore";
import { BaseTransport } from "./interface.js";

// Firestore パス構成
// poker_rooms/{roomId}                ← RoomState
// poker_rooms/{roomId}/game/current   ← PublicGameState (onSnapshot)
// poker_rooms/{roomId}/hands/{uid}    ← 手札（本人のみ参照）
// poker_rooms/{roomId}/actions        ← プレイヤーアクション（ホストが受信・削除）

export class FirestoreTransport extends BaseTransport {
  constructor(db) {
    super();
    this._db = db;
    this._roomId = null;
    this._myPlayerId = null;
    this._isHost = false;
    this._unsubscribes = [];
  }

  // ホスト: 部屋を作成して roomId を返す
  async createRoom(settings) {
    const roomRef = doc(collection(this._db, "poker_rooms"));
    await setDoc(roomRef, {
      hostId: settings.hostId,
      status: "waiting",
      settings,
      players: [],
      createdAt: serverTimestamp(),
    });
    this._roomId = roomRef.id;
    this._myPlayerId = settings.hostId;
    this._isHost = true;
    return this._roomId;
  }

  // 参加者: 部屋に入室
  async joinRoom(roomId, player) {
    this._roomId = roomId;
    this._myPlayerId = player.id;
    this._isHost = false;

    const roomRef = doc(this._db, "poker_rooms", roomId);
    await updateDoc(roomRef, {
      players: arrayUnion({ id: player.id, displayName: player.displayName, isHost: false }),
    });
  }

  async leaveRoom() {
    this._unsubscribes.forEach((unsub) => unsub());
    this._unsubscribes = [];
  }

  // ホスト: PublicGameState を全員に配信
  async publishState(state) {
    const gameRef = doc(this._db, "poker_rooms", this._roomId, "game", "current");
    await setDoc(gameRef, state);
  }

  // ホスト: 特定プレイヤーの手札を書き込む
  async publishHoleCards(playerId, cards) {
    const handRef = doc(this._db, "poker_rooms", this._roomId, "hands", playerId);
    await setDoc(handRef, { cards });
  }

  // 参加者: アクションをサブコレクションに追加
  async sendAction(action) {
    const actionsRef = collection(this._db, "poker_rooms", this._roomId, "actions");
    await addDoc(actionsRef, {
      playerId: this._myPlayerId,
      action,
      timestamp: serverTimestamp(),
    });
  }

  // 全員: ゲーム状態の変化を購読
  onStateChange(cb) {
    const ref = doc(this._db, "poker_rooms", this._roomId, "game", "current");
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) cb(snap.data());
    });
    this._unsubscribes.push(unsub);
    return unsub;
  }

  // 本人: 自分の手札を購読
  onHoleCards(cb) {
    const ref = doc(this._db, "poker_rooms", this._roomId, "hands", this._myPlayerId);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) cb(snap.data().cards);
    });
    this._unsubscribes.push(unsub);
    return unsub;
  }

  // 全員: 参加者の増加を検知
  onPlayerJoin(cb) {
    const ref = doc(this._db, "poker_rooms", this._roomId);
    let prevIds = new Set();
    const unsub = onSnapshot(ref, (snap) => {
      const players = snap.data()?.players ?? [];
      players
        .filter((p) => !prevIds.has(p.id))
        .forEach((p) => cb(p));
      prevIds = new Set(players.map((p) => p.id));
    });
    this._unsubscribes.push(unsub);
    return unsub;
  }

  // 全員: 参加者の退出を検知
  onPlayerLeave(cb) {
    const ref = doc(this._db, "poker_rooms", this._roomId);
    let prevIds = new Set();
    const unsub = onSnapshot(ref, (snap) => {
      const players = snap.data()?.players ?? [];
      const currentIds = new Set(players.map((p) => p.id));
      prevIds.forEach((id) => {
        if (!currentIds.has(id)) cb(id);
      });
      prevIds = currentIds;
    });
    this._unsubscribes.push(unsub);
    return unsub;
  }

  // ホスト: アクションを購読し、処理後に削除
  onAction(cb) {
    const ref = collection(this._db, "poker_rooms", this._roomId, "actions");
    const unsub = onSnapshot(ref, (snap) => {
      snap.docChanges().forEach(async (change) => {
        if (change.type === "added") {
          const { playerId, action } = change.doc.data();
          cb(playerId, action);
          await deleteDoc(change.doc.ref);
        }
      });
    });
    this._unsubscribes.push(unsub);
    return unsub;
  }
}
