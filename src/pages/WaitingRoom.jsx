import { useState } from "react";

const PRESETS = [
  { label: "カジュアル", startingChips: 1000, sb: 5, bb: 10 },
  { label: "スタンダード", startingChips: 1000, sb: 10, bb: 20 },
  { label: "ハイ", startingChips: 2000, sb: 25, bb: 50 },
];

export default function WaitingRoom({ room, user }) {
  const [preset, setPreset] = useState(1);
  const [starting, setStarting] = useState(false);

  const handleStart = async () => {
    if (starting || room.waitingPlayers.length < 2) return;
    setStarting(true);
    try {
      await room.startGame(PRESETS[preset]);
    } catch (e) {
      console.error(e);
      setStarting(false);
    }
  };

  const roomCodeDisplay = room.mode === "webrtc" ? room.roomId : null;

  return (
    <div className="screen">
      <div className="card" style={{ maxWidth: 480 }}>
        <h2>待機室</h2>

        {roomCodeDisplay && (
          <div style={{ background: "rgba(82,183,136,0.15)", borderRadius: 10, padding: "12px 16px" }}>
            <p style={{ fontSize: 12, color: "#95d5b2", marginBottom: 4 }}>ルームコード（参加者に共有）</p>
            <p style={{ fontFamily: "monospace", fontSize: 18, letterSpacing: 2, wordBreak: "break-all" }}>
              {roomCodeDisplay}
            </p>
          </div>
        )}

        <div>
          <p style={{ fontSize: 13, color: "#95d5b2", marginBottom: 8 }}>
            参加者 ({room.waitingPlayers.length}人)
          </p>
          {room.waitingPlayers.map((p) => (
            <div key={p.id} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "8px 12px", background: "rgba(255,255,255,0.06)",
              borderRadius: 8, marginBottom: 6,
            }}>
              <span style={{ fontSize: 18 }}>{p.isHost ? "👑" : "👤"}</span>
              <span>{p.displayName}</span>
              {p.isHost && <span style={{ fontSize: 12, color: "#f4a261", marginLeft: "auto" }}>ホスト</span>}
            </div>
          ))}
        </div>

        {room.isHost ? (
          <>
            <div>
              <p style={{ fontSize: 13, color: "#95d5b2", marginBottom: 8 }}>ゲーム設定</p>
              <div style={{ display: "flex", gap: 8 }}>
                {PRESETS.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => setPreset(i)}
                    className={preset === i ? "btn-primary" : "btn-secondary"}
                    style={{ flex: 1, padding: "8px 4px", fontSize: 13 }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 12, color: "#95d5b2", marginTop: 8, textAlign: "center" }}>
                {PRESETS[preset].startingChips}チップ · SB {PRESETS[preset].sb} / BB {PRESETS[preset].bb}
              </div>
            </div>

            <button
              className="btn-primary btn-lg"
              onClick={handleStart}
              disabled={starting || room.waitingPlayers.length < 2}
            >
              {starting ? "開始中..." : room.waitingPlayers.length < 2 ? "2人以上必要" : "ゲームスタート"}
            </button>
          </>
        ) : (
          <p style={{ color: "#95d5b2", textAlign: "center" }}>ホストがゲームを開始するまで待機中...</p>
        )}

        <button className="btn-secondary" onClick={room.leaveRoom} style={{ fontSize: 13 }}>
          退出
        </button>
      </div>
    </div>
  );
}
