import { CardFront } from "./HoleCards.jsx";

const HAND_NAMES = ["High Card","One Pair","Two Pair","Three of a Kind","Straight","Flush","Full House","Four of a Kind","Straight Flush","Royal Flush"];

function cardKey(c) { return `${c.suit}${c.rank}`; }

// bestCards の中から「役に絡んでるカード」だけ返す
function getComboCards(rank, bestCards) {
  if (!bestCards?.length) return [];
  const cnt = {};
  for (const c of bestCards) cnt[c.rank] = (cnt[c.rank] || 0) + 1;

  switch (rank) {
    case 0: // High Card → 最高ランクの1枚
      return [...bestCards].sort((a, b) => b.rank - a.rank).slice(0, 1);
    case 1: // One Pair → ペアの2枚
      return bestCards.filter(c => cnt[c.rank] === 2);
    case 2: // Two Pair → 両ペアの4枚
      return bestCards.filter(c => cnt[c.rank] === 2);
    case 3: // Three of a Kind → トリップスの3枚
      return bestCards.filter(c => cnt[c.rank] === 3);
    case 6: // Full House → 全5枚（スリー＋ペア）
    case 4: // Straight → 全5枚
    case 5: // Flush → 全5枚
    case 8: // Straight Flush
    case 9: // Royal Flush
      return bestCards;
    case 7: // Four of a Kind → フォーカードの4枚
      return bestCards.filter(c => cnt[c.rank] === 4);
    default:
      return bestCards;
  }
}

// inBest: 有効5枚 → 太枠（緑アウトライン）
// inCombo: 役に絡む枚 → ハイライト（オレンジ背景フレーム）
function HighlightCard({ card, inBest, inCombo, xsmall = false }) {
  return (
    <div style={{
      opacity: inBest ? 1 : 0.25,
      outline: inCombo ? "2px solid #52b788" : "none",
      outlineOffset: "1px",
      borderRadius: xsmall ? 5 : 6,
      flexShrink: 0,
    }}>
      <CardFront {...card} small={!xsmall} xsmall={xsmall} />
    </div>
  );
}

export function ShowdownReveal({ gameState, myPlayerId, isHost, onNextHand, pendingPlayers = [] }) {
  if (!gameState || gameState.street !== "showdown") return null;

  const { winners = [], players, playerStates, communityCards = [], handResults = {} } = gameState;
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
            const hr = handResults[p.id];
            const bestSet  = new Set(hr?.bestCards?.map(cardKey) ?? []);
            const comboSet = new Set(getComboCards(hr?.rank, hr?.bestCards).map(cardKey));

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
                      <HighlightCard key={i} card={card}
                        inBest={bestSet.has(cardKey(card))}
                        inCombo={comboSet.has(cardKey(card))} />
                    ))}
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 4, justifyContent: "center", marginBottom: 6, opacity: 0.3 }}>
                    {[0,1].map(i => <CardFront key={i} suit="S" rank={2} small />)}
                  </div>
                )}

                {/* コミュニティカード（小） */}
                {communityCards.length > 0 && (
                  <div style={{ display: "flex", gap: 3, justifyContent: "center", marginBottom: 8 }}>
                    {communityCards.map((card, i) => (
                      <HighlightCard key={i} card={card}
                        inBest={bestSet.has(cardKey(card))}
                        inCombo={comboSet.has(cardKey(card))}
                        xsmall />
                    ))}
                  </div>
                )}

                {hr && (
                  <div style={{ fontSize: 12, color: "#95d5b2", marginBottom: 4 }}>
                    {HAND_NAMES[hr.rank] ?? hr.name ?? ""}
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
