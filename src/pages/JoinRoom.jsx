import { useState } from "react";

export default function JoinRoom({ room, myPlayerId, myName, onBack }) {
  const [roomCode, setRoomCode] = useState("");
  const [displayName, setDisplayName] = useState(myName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const saveName = (name) => {
    setDisplayName(name);
    localStorage.setItem("poker_display_name", name);
  };

  const handleCreate = async () => {
    if (!displayName.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      await room.createRoom("webrtc");
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  const handleJoin = async () => {
    if (!roomCode.trim() || !displayName.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      await room.joinRoom(roomCode.trim(), "webrtc");
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <div className="screen">
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="btn-secondary" onClick={onBack} style={{ padding: "6px 12px" }}>← 戻る</button>
          <h2>ルームコードで遊ぶ</h2>
        </div>

        <div>
          <label style={{ fontSize: 13, color: "#95d5b2" }}>表示名</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => saveName(e.target.value)}
            placeholder="ニックネームを入力"
            style={{ marginTop: 6 }}
          />
        </div>

        <button className="btn-primary btn-lg" onClick={handleCreate} disabled={busy || !displayName.trim()}>
          {busy ? "作成中..." : "部屋を作る（ホスト）"}
        </button>

        <div style={{ textAlign: "center", color: "#95d5b2", fontSize: 13 }}>— または —</div>

        <div>
          <label style={{ fontSize: 13, color: "#95d5b2" }}>ルームコード</label>
          <input
            type="text"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
            placeholder="ホストのコードを入力"
            style={{ marginTop: 6 }}
          />
        </div>

        <button
          className="btn-secondary btn-lg"
          onClick={handleJoin}
          disabled={busy || !roomCode.trim() || !displayName.trim()}
        >
          {busy ? "接続中..." : "参加する"}
        </button>

        {error && <p style={{ color: "#e63946", fontSize: 14 }}>{error}</p>}
      </div>
    </div>
  );
}
