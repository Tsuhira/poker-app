import { CardFront } from "./HoleCards.jsx";
import { bestHand } from "../lib/poker/handEvaluator.js";

const HAND_NAMES = ["High Card","One Pair","Two Pair","Three of a Kind","Straight","Flush","Full House","Four of a Kind","Straight Flush","Royal Flush"];

function cardKey(c) { return `${c.suit}${c.rank}`; }

function HighlightCard({ card, inBest, xsmall = false }) {
  return (
    <div style={{
      opacity: inBest ? 1 : 0.28,
      borderRadius: xsmall ? 3 : 4,
      outline: inBest ? "2px solid #52b788" : "none",
      outlineOffset: "1px",
      flexShrink: 0,
    }}>
      <CardFront {...card} small={!xsmall} xsmall={xsmall} />
    </div>
  );
}

export function ShowdownReveal({ gameState, myPlayerId, isHost, onNextHand, pendingPlayers = [] }) {
  if (!gameState || gameState.street !== "showdown") return null;

  const { winners = [], players, playerStates, communityCards = [] } = gameState;
  const winnerIds = new Set(winners.map((w) => w.playerId));

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", gap: 16, padding: 24, zIndex: 100,
      overflowY: "auto",
    }}>
      <h2 style={{ fontSize: 26, margin: 0 }}>ショーダウン</h2>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, justifyContent: "center", maxWidth: 680 }}>
        {players
          .filter((p) => playerStates[p.id]?.status !== "folded")
          .map((p) => {
            const ps = playerStates[p.id];
            const isWinner = winnerIds.has(p.id);
            const winInfo = winners.find((w) => w.playerId === p.id);

            const holeCards = ps?.holeCards ?? [];
            const allCards = [...holeCards, ...communityCards];
            const best = allCards.length >= 5 ? bestHand(allCards) : null;
            const bestSet = new Set(best?.bestCards?.map(cardKey) ?? []);

            return (
              <div key={p.id} style={{
                background: isWinner ? "rgba(82,183,136,0.15)" : "rgba(255,255,255,0.06)",
                border: isWinner ? "2px solid #52b788" : "2px solid rgba(255,255,255,0.1)",
                borderRadius: 14, padding: "14px 16px", textAlign: "center", minWidth: 140,
              }}>
                <div style={{ fontWeight: "bold", marginBottom: 8, fontSize: 14 }}>
                  {p.displayName} {isWinner && "🏆"}
                </div>

                {/* ホールカード */}
                {holeCards.length > 0 ? (
                  <div style={{ display: "flex", gap: 4, justifyContent: "center", marginBottom: 6 }}>
                    {holeCards.map((card, i) => (
                      <HighlightCard key={i} card={card} inBest={bestSet.has(cardKey(card))} />
                    ))}
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 4, justifyContent: "center", marginBottom: 6, opacity: 0.4 }}>
                    {[0,1].map(i => <CardFront key={i} suit="S" rank={0} small />)}
                  </div>
                )}

                {/* コミュニティカード（小） */}
                {communityCards.length > 0 && (
                  <div style={{ display: "flex", gap: 3, justifyContent: "center", marginBottom: 8 }}>
                    {communityCards.map((card, i) => (
                      <HighlightCard key={i} card={card} inBest={bestSet.has(cardKey(card))} xsmall />
                    ))}
                  </div>
                )}

                {/* ハンド名 */}
                {best && (
                  <div style={{ fontSize: 12, color: "#95d5b2", marginBottom: 4 }}>
                    {HAND_NAMES[best.rank] ?? ""}
                  </div>
                )}

                {winInfo && (
                  <div style={{ fontSize: 13, color: "#f4a261", fontWeight: "bold" }}>
                    +{winInfo.amount.toLocaleString()}
                  </div>
                )}
                <div style={{ fontSize: 12, color: "#888", marginTop: 3 }}>
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
        <button className="btn-primary btn-lg" onClick={onNextHand} style={{ marginTop: 4 }}>
          次のハンドへ
        </button>
      )}
    </div>
  );
}
