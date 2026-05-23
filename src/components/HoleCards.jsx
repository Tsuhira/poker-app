const SUIT_SYMBOL = { S: "♠", H: "♥", D: "♦", C: "♣" };
const SUIT_COLOR  = { S: "#222", H: "#d62828", D: "#d62828", C: "#222" };
const RANK_LABEL  = { 11: "J", 12: "Q", 13: "K", 14: "A" };

function CardFront({ suit, rank, small = false }) {
  const w = small ? 36 : 52;
  const h = small ? 52 : 76;
  const fs = small ? 13 : 18;
  const label = RANK_LABEL[rank] ?? String(rank);
  return (
    <div style={{
      width: w, height: h, background: "#fff", borderRadius: small ? 4 : 6,
      border: "1px solid #ccc", display: "flex", flexDirection: "column",
      justifyContent: "space-between", padding: small ? "3px 4px" : "4px 6px",
      color: SUIT_COLOR[suit], fontSize: fs, fontWeight: "bold",
      boxShadow: "0 2px 6px rgba(0,0,0,0.4)", flexShrink: 0,
    }}>
      <div style={{ lineHeight: 1 }}>{label}</div>
      <div style={{ textAlign: "center", fontSize: small ? 16 : 22 }}>{SUIT_SYMBOL[suit]}</div>
      <div style={{ alignSelf: "flex-end", transform: "rotate(180deg)", lineHeight: 1 }}>{label}</div>
    </div>
  );
}

function CardBack({ small = false }) {
  const w = small ? 36 : 52;
  const h = small ? 52 : 76;
  return (
    <div style={{
      width: w, height: h, background: "#1a237e", borderRadius: small ? 4 : 6,
      border: "1px solid #3949ab", flexShrink: 0,
      boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
      backgroundImage: "repeating-linear-gradient(45deg, #283593 0, #283593 2px, #1a237e 2px, #1a237e 10px)",
    }} />
  );
}

export function HoleCards({ cards, hidden = false, count = 2, small = false }) {
  if (hidden || !cards?.length) {
    return (
      <div style={{ display: "flex", gap: small ? 3 : 4 }}>
        {Array.from({ length: count }).map((_, i) => <CardBack key={i} small={small} />)}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", gap: small ? 3 : 4 }}>
      {cards.map((card, i) => <CardFront key={i} {...card} small={small} />)}
    </div>
  );
}

export { CardFront };
