import { CardFront } from "./HoleCards.jsx";

export function CommunityCards({ cards = [] }) {
  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
      {cards.map((card, i) => <CardFront key={i} {...card} />)}
      {Array.from({ length: Math.max(0, 5 - cards.length) }).map((_, i) => (
        <div key={`empty-${i}`} style={{
          width: 52, height: 76, borderRadius: 6,
          border: "2px dashed rgba(255,255,255,0.2)",
          flexShrink: 0,
        }} />
      ))}
    </div>
  );
}
