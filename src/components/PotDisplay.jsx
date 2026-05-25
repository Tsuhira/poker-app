export function PotDisplay({ pots = [], playerStates = {} }) {
  const livePot = Object.values(playerStates).reduce((s, ps) => s + (ps.totalBet ?? 0), 0);
  const total = pots.length ? pots.reduce((s, p) => s + p.amount, 0) : livePot;
  if (total === 0) return null;
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 22, fontWeight: "bold", color: "#f4a261" }}>
        ポット: {total.toLocaleString()}
      </div>
      {pots.length > 1 && (
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 4 }}>
          {pots.map((pot, i) => (
            <div key={i} style={{
              fontSize: 12, background: "rgba(255,255,255,0.12)",
              borderRadius: 6, padding: "2px 10px", color: "#95d5b2",
            }}>
              {i === 0 ? "メイン" : `サイド${i}`}: {pot.amount.toLocaleString()}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
