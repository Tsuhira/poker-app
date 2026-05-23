import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase.js";

export default function Lobby({ room, user, myPlayerId, onBack }) {
  const [rooms, setRooms] = useState([]);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const q = query(collection(db, "poker_rooms"), where("status", "==", "waiting"));
    return onSnapshot(q, (snap) => {
      setRooms(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    setError("");
    try {
      await room.createRoom("firestore");
    } catch (e) {
      setError(e.message);
      setCreating(false);
    }
  };

  const handleJoin = async (targetRoomId) => {
    if (joining) return;
    setJoining(targetRoomId);
    setError("");
    try {
      await room.joinRoom(targetRoomId, "firestore");
    } catch (e) {
      setError(e.message);
      setJoining(null);
    }
  };

  return (
    <div className="screen">
      <div className="card" style={{ maxWidth: 480 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="btn-secondary" onClick={onBack} style={{ padding: "6px 12px" }}>← 戻る</button>
          <h2>ロビー</h2>
        </div>

        <button className="btn-primary btn-lg" onClick={handleCreate} disabled={creating}>
          {creating ? "作成中..." : "部屋を作る"}
        </button>

        {error && <p style={{ color: "#e63946", fontSize: 14 }}>{error}</p>}

        <div style={{ marginTop: 8 }}>
          <p style={{ fontSize: 13, color: "#95d5b2", marginBottom: 8 }}>
            オープンな部屋 ({rooms.length})
          </p>
          {rooms.length === 0 && (
            <p style={{ color: "#aaa", fontSize: 14 }}>部屋がありません</p>
          )}
          {rooms.map((r) => (
            <div key={r.id} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              background: "rgba(255,255,255,0.06)", borderRadius: 10,
              padding: "12px 16px", marginBottom: 8,
            }}>
              <div>
                <div style={{ fontWeight: "bold" }}>
                  {r.players?.find((p) => p.isHost)?.displayName ?? "?"} の部屋
                </div>
                <div style={{ fontSize: 12, color: "#95d5b2", marginTop: 2 }}>
                  {r.players?.length ?? 0}人 · SB{r.settings?.sb} / BB{r.settings?.bb}
                </div>
              </div>
              <button
                className="btn-primary"
                onClick={() => handleJoin(r.id)}
                disabled={joining === r.id}
                style={{ padding: "8px 16px" }}
              >
                {joining === r.id ? "..." : "参加"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
