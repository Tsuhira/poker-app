import { useState, useMemo } from "react";
import { useAuth } from "./hooks/useAuth.js";
import { useRoom } from "./hooks/useRoom.js";
import Lobby from "./pages/Lobby.jsx";
import JoinRoom from "./pages/JoinRoom.jsx";
import WaitingRoom from "./pages/WaitingRoom.jsx";
import Game from "./pages/Game.jsx";

function getStandaloneId() {
  let id = localStorage.getItem("poker_standalone_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("poker_standalone_id", id);
  }
  return id;
}

export default function App() {
  const { user, loading } = useAuth();
  const [screen, setScreen] = useState("home"); // home | lobby | joinRoom

  const standaloneId = useMemo(getStandaloneId, []);
  const myPlayerId = user?.uid ?? standaloneId;
  const myName = user?.displayName ?? localStorage.getItem("poker_display_name") ?? "Guest";

  const room = useRoom(myPlayerId, myName);

  if (loading) {
    return (
      <div className="screen">
        <div style={{ fontSize: 18, color: "#52b788" }}>読み込み中...</div>
      </div>
    );
  }

  // Game in progress → Game screen
  if (room.roomId && room.gameState) {
    return <Game room={room} myPlayerId={myPlayerId} />;
  }

  // In a room but game not started → WaitingRoom
  if (room.roomId) {
    return <WaitingRoom room={room} user={user} />;
  }

  // Lobby (Firebase mode)
  if (screen === "lobby") {
    return <Lobby room={room} user={user} myPlayerId={myPlayerId} onBack={() => setScreen("home")} />;
  }

  // Standalone join screen
  if (screen === "joinRoom") {
    return <JoinRoom room={room} myPlayerId={myPlayerId} myName={myName} onBack={() => setScreen("home")} />;
  }

  // Home: mode selection
  return (
    <div className="screen">
      <h1 style={{ fontSize: 36, fontWeight: "bold", marginBottom: 8 }}>🃏 Poker</h1>
      <p style={{ color: "#95d5b2", marginBottom: 24 }}>Texas Hold'em</p>

      {user ? (
        <div className="card">
          <p style={{ color: "#95d5b2", fontSize: 14 }}>ログイン中: {user.displayName}</p>
          <button className="btn-primary btn-lg" onClick={() => setScreen("lobby")}>
            くまアプリで遊ぶ（ロビー）
          </button>
          <button className="btn-secondary" onClick={() => setScreen("joinRoom")}>
            ルームコードで参加
          </button>
        </div>
      ) : (
        <div className="card">
          <p style={{ color: "#95d5b2", fontSize: 14 }}>ログインなしで遊べます</p>
          <button className="btn-primary btn-lg" onClick={() => setScreen("joinRoom")}>
            ルームコードで遊ぶ
          </button>
        </div>
      )}
    </div>
  );
}
