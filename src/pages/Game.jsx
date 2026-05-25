import { HoleCards } from "../components/HoleCards.jsx";
import { CommunityCards } from "../components/CommunityCards.jsx";
import { PotDisplay } from "../components/PotDisplay.jsx";
import { PlayerSeat } from "../components/PlayerSeat.jsx";
import { ActionPanel } from "../components/ActionPanel.jsx";
import { ShowdownReveal } from "../components/ShowdownReveal.jsx";

const STREET_LABEL = {
  pre_flop: "プリフロップ",
  flop: "フロップ",
  turn: "ターン",
  river: "リバー",
  showdown: "ショーダウン",
};

export default function Game({ room, myPlayerId }) {
  const { gameState, myCards, isMyTurn, isHost, gameEnded, roomId, pendingPlayers } = room;
  if (!gameState) return null;

  const { players, playerStates, communityCards, pots, currentPlayerIndex, dealerIndex, settings } = gameState;
  const n = players.length;

  // Split players: me at bottom, others above
  const myIndex = players.findIndex((p) => p.id === myPlayerId);
  const isSpectator = myIndex === -1;
  const others = players.filter((p) => p.id !== myPlayerId);

  const sbIndex = n === 2 ? dealerIndex : (dealerIndex + 1) % n;
  const bbIndex = n === 2 ? (dealerIndex + 1) % n : (dealerIndex + 2) % n;

  const getRoles = (playerIndex) => ({
    isDealer: playerIndex === dealerIndex,
    isSB: playerIndex === sbIndex,
    isBB: playerIndex === bbIndex,
    isCurrentPlayer: playerIndex === currentPlayerIndex,
  });

  const isShowdown = gameState.street === "showdown";

  // Game over screen
  if (gameEnded && !isShowdown) {
    const survivor = players.find((p) => playerStates[p.id]?.status !== "eliminated");
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: 16 }}>
        <h1 style={{ fontSize: 36 }}>🎉 ゲーム終了</h1>
        <p style={{ fontSize: 22, color: "#f4a261" }}>
          {survivor?.displayName ?? "?"} の優勝！
        </p>
        <button className="btn-primary btn-lg" onClick={room.leaveRoom}>ロビーに戻る</button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", position: "relative" }}>
      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "10px 16px", background: "rgba(0,0,0,0.3)",
      }}>
        <span style={{ fontSize: 14, color: "#95d5b2" }}>
          {STREET_LABEL[gameState.street] ?? gameState.street}
        </span>
        <span style={{ fontSize: 11, color: "#555", letterSpacing: "0.05em" }}>
          {roomId}
        </span>
        <button
          className="btn-secondary"
          style={{ fontSize: 12, padding: "4px 10px" }}
          onClick={room.leaveRoom}
        >
          退出
        </button>
      </div>

      {/* Other players */}
      <div style={{
        display: "flex", flexWrap: "wrap", justifyContent: "center",
        gap: 12, padding: "12px 16px",
      }}>
        {others.map((p) => {
          const pIdx = players.indexOf(p);
          const ps = playerStates[p.id];
          return (
            <PlayerSeat
              key={p.id}
              player={p}
              playerState={ps}
              {...getRoles(pIdx)}
              isMe={false}
              showCards={isShowdown && ps?.holeCards?.length > 0}
              small
            />
          );
        })}
      </div>

      {/* Community area */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 12, padding: "8px 16px",
      }}>
        <PotDisplay pots={pots} playerStates={playerStates} />
        <CommunityCards cards={communityCards} />
      </div>

      {/* My seat / Spectator */}
      {isSpectator ? (
        <div style={{ textAlign: "center", padding: "16px", color: "#888", fontSize: 13 }}>
          観戦中 — 次のハンドから参加
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "8px 16px 16px" }}>
          <HoleCards cards={myCards} hidden={!myCards?.length} />
          <PlayerSeat
            player={players[myIndex]}
            playerState={playerStates[myPlayerId]}
            {...getRoles(myIndex)}
            isMe
            showCards={false}
          />
        </div>
      )}

      {/* Action panel (shown only on my turn) */}
      {isMyTurn && !isShowdown && (
        <ActionPanel
          gameState={gameState}
          myPlayerId={myPlayerId}
          onAction={room.sendAction}
        />
      )}

      {/* Showdown overlay */}
      {isShowdown && (
        <ShowdownReveal
          gameState={gameState}
          myPlayerId={myPlayerId}
          isHost={isHost}
          onNextHand={room.nextHand}
          pendingPlayers={pendingPlayers}
        />
      )}

      {/* Bottom padding for action panel */}
      {isMyTurn && !isShowdown && <div style={{ height: 140 }} />}
    </div>
  );
}
