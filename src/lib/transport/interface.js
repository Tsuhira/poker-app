// 見間違えにくい文字のみ使用 (O/0, I/1/L を除外)
const ROOM_CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateRoomCode(length = 6) {
  return Array.from(
    { length },
    () => ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)]
  ).join("");
}

// TransportInterface — both WebRTC and Firestore implementations extend this
export class BaseTransport {
  // ルーム管理
  async createRoom(_settings) { throw new Error("Not implemented"); }
  async joinRoom(_roomId, _player) { throw new Error("Not implemented"); }
  async leaveRoom() { throw new Error("Not implemented"); }

  // ホスト → 全員
  async publishState(_state) { throw new Error("Not implemented"); }
  async publishHoleCards(_playerId, _cards) { throw new Error("Not implemented"); }

  // リスナー登録（戻り値: unsubscribe 関数）
  onStateChange(_cb) { throw new Error("Not implemented"); }
  onHoleCards(_cb) { throw new Error("Not implemented"); }
  onPlayerJoin(_cb) { throw new Error("Not implemented"); }
  onPlayerLeave(_cb) { throw new Error("Not implemented"); }

  // プレイヤー → ホスト
  async sendAction(_action) { throw new Error("Not implemented"); }
  onAction(_cb) { throw new Error("Not implemented"); }
}
