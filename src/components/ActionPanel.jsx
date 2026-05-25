import { useState } from "react";
import { RaiseControls } from "./RaiseControls.jsx";

export function ActionPanel({ gameState, myPlayerId, onAction }) {
  const [showRaise, setShowRaise] = useState(false);

  if (!gameState) return null;
  const ps = gameState.playerStates[myPlayerId];
  if (!ps || ps.status !== "active") return null;

  const pot = Object.values(gameState.playerStates).reduce((s, p) => s + (p.totalBet ?? 0), 0);
  const bb = gameState.settings?.bb ?? 20;

  const toCall = gameState.currentBet - ps.bet;
  const canCheck = toCall === 0;
  const canCall  = toCall > 0 && ps.chips > toCall;
  const isForceAllIn = toCall > 0 && ps.chips <= toCall; // must go all-in to call
  const canRaise = ps.chips > toCall && (ps.chips - toCall) >= gameState.minRaise;

  const act = (action) => {
    setShowRaise(false);
    onAction(action);
  };

  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0,
      background: "rgba(0,20,10,0.92)", backdropFilter: "blur(8px)",
      borderTop: "1px solid rgba(255,255,255,0.1)",
      padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10,
    }}>
      {showRaise && (
        <RaiseControls
          currentBet={gameState.currentBet}
          minRaise={gameState.minRaise}
          myBet={ps.bet}
          myChips={ps.chips}
          onRaise={(amount) => act({ type: "raise", amount })}
          pot={pot}
          bb={bb}
          street={gameState.street}
        />
      )}

      <div style={{ display: "flex", gap: 10 }}>
        {/* Fold */}
        <button
          className="btn-danger"
          style={{ flex: 1 }}
          onClick={() => act({ type: "fold" })}
        >
          フォールド
        </button>

        {/* Check or Call */}
        {canCheck && (
          <button
            className="btn-secondary"
            style={{ flex: 1 }}
            onClick={() => act({ type: "check" })}
          >
            チェック
          </button>
        )}
        {canCall && (
          <button
            className="btn-primary"
            style={{ flex: 1 }}
            onClick={() => act({ type: "call" })}
          >
            コール {toCall}
          </button>
        )}
        {isForceAllIn && (
          <button
            className="btn-warning"
            style={{ flex: 1 }}
            onClick={() => act({ type: "all_in" })}
          >
            オールイン {ps.chips}
          </button>
        )}

        {/* Raise */}
        {canRaise && (
          <button
            className="btn-warning"
            style={{ flex: 1 }}
            onClick={() => setShowRaise((v) => !v)}
          >
            {showRaise ? "✕ キャンセル" : "レイズ ▲"}
          </button>
        )}

        {/* All-in (when not forced) */}
        {!isForceAllIn && ps.chips > 0 && !canRaise && (
          <button
            className="btn-warning"
            style={{ flex: 1 }}
            onClick={() => act({ type: "all_in" })}
          >
            オールイン
          </button>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#95d5b2" }}>
        <span>あなたの手番</span>
        <span>チップ: {ps.chips.toLocaleString()} / ベット: {ps.bet}</span>
      </div>
    </div>
  );
}
