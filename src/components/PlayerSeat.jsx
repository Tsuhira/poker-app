import { HoleCards } from "./HoleCards.jsx";

const STATUS_BADGE = {
  folded: { label: "FOLD", bg: "#555", color: "#aaa" },
  all_in: { label: "ALL IN", bg: "#e63946", color: "#fff" },
  eliminated: { label: "OUT", bg: "#333", color: "#777" },
};

export function PlayerSeat({
  player, playerState, isDealer, isSB, isBB,
  isCurrentPlayer, isMe, showCards, small = false,
}) {
  if (!player || !playerState) return null;

  const statusBadge = STATUS_BADGE[playerState.status];
  const isFolded = playerState.status === "folded";
  const isElim = playerState.status === "eliminated";

  const showHoleCards = showCards && playerState.holeCards?.length > 0;

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
      opacity: isFolded || isElim ? 0.5 : 1,
      position: "relative",
    }}>
      {/* Current player indicator */}
      {isCurrentPlayer && (
        <div style={{
          position: "absolute", top: -8, left: "50%", transform: "translateX(-50%)",
          width: 0, height: 0,
          borderLeft: "8px solid transparent",
          borderRight: "8px solid transparent",
          borderTop: "10px solid #f4a261",
        }} />
      )}

      {/* Cards */}
      <HoleCards
        cards={showHoleCards ? playerState.holeCards : undefined}
        hidden={!showHoleCards}
        count={playerState.holeCardCount ?? 2}
        small
      />

      {/* Name + chips */}
      <div style={{
        background: isMe ? "rgba(82,183,136,0.25)" : "rgba(0,0,0,0.5)",
        border: isCurrentPlayer ? "2px solid #f4a261" : "2px solid transparent",
        borderRadius: 8, padding: small ? "4px 8px" : "6px 12px",
        textAlign: "center", minWidth: small ? 70 : 90,
      }}>
        {/* Role badges */}
        <div style={{ display: "flex", justifyContent: "center", gap: 4, marginBottom: 2 }}>
          {isDealer && <Badge label="D" color="#f4a261" />}
          {isSB && <Badge label="SB" color="#74b9ff" />}
          {isBB && <Badge label="BB" color="#a29bfe" />}
        </div>

        <div style={{ fontWeight: "bold", fontSize: small ? 12 : 13, maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {player.displayName}
          {isMe && " (You)"}
        </div>

        {statusBadge ? (
          <div style={{ fontSize: 11, background: statusBadge.bg, color: statusBadge.color, borderRadius: 4, padding: "1px 6px", marginTop: 2 }}>
            {statusBadge.label}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: "#95d5b2", marginTop: 2 }}>
            {playerState.chips.toLocaleString()}
          </div>
        )}

        {playerState.bet > 0 && (
          <div style={{ fontSize: 11, color: "#f4a261", marginTop: 1 }}>
            ベット: {playerState.bet}
          </div>
        )}
      </div>
    </div>
  );
}

function Badge({ label, color }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: "bold", background: color, color: "#000",
      borderRadius: 4, padding: "0 4px", lineHeight: "16px",
    }}>
      {label}
    </span>
  );
}
