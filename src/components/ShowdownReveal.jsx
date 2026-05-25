import { HoleCards } from "./HoleCards.jsx";

const HAND_NAMES = ["High Card","One Pair","Two Pair","Three of a Kind","Straight","Flush","Full House","Four of a Kind","Straight Flush","Royal Flush"];

export function ShowdownReveal({ gameState, myPlayerId, isHost, onNextHand, pendingPlayers = [] }) {
  if (!gameState || gameState.street !== "showdown") return null;

  const { winners = [], players, playerStates } = gameState;
  const winnerIds = new Set(winners.map((w) => w.playerId));

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", gap: 16, padding: 24, zIndex: 100,
    }}>
      <h2 style={{ fontSize: 28 }}>ショーダウン</h2>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, justifyContent: "center", maxWidth: 600 }}>
        {players
          .filter((p) => playerStates[p.id]?.status !== "folded")
          .map((p) => {
            const ps = playerStates[p.id];
            const isWinner = winnerIds.has(p.id);
            const winInfo = winners.find((w) => w.playerId === p.id);
            return (
              <div key={p.id} style={{
                background: isWinner ? "rgba(82,183,136,0.2)" : "rgba(255,255,255,0.07)",
                border: isWinner ? "2px solid #52b788" : "2px solid transparent",
                borderRadius: 14, padding: "14px 18px", textAlign: "center", minWidth: 130,
              }}>
                <div style={{ fontWeight: "bold", marginBottom: 6 }}>
                  {p.displayName} {isWinner && "🏆"}
                </div>
                <HoleCards cards={ps?.holeCards} hidden={!ps?.holeCards?.length} />
                {winInfo && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 13, color: "#52b788" }}>
                      {HAND_NAMES[winInfo.handRank] ?? ""}
                    </div>
                    <div style={{ fontSize: 14, color: "#f4a261", fontWeight: "bold" }}>
                      +{winInfo.amount.toLocaleString()}
                    </div>
                  </div>
                )}
                <div style={{ fontSize: 12, color: "#95d5b2", marginTop: 4 }}>
                  → {ps?.chips.toLocaleString()} チップ
                </div>
              </div>
            );
          })}
      </div>

      {pendingPlayers.length > 0 && (
        <p style={{ fontSize: 13, color: "#95d5b2", margin: 0 }}>
          {pendingPlayers.map((p) => p.displayName).join(", ")} が次のハンドから参加
        </p>
      )}

      {isHost && (
        <button className="btn-primary btn-lg" onClick={onNextHand} style={{ marginTop: 8 }}>
          次のハンドへ
        </button>
      )}
    </div>
  );
}
