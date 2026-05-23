import { useState, useEffect } from "react";

export function RaiseControls({ currentBet, minRaise, myBet, myChips, onRaise }) {
  const minTotal = currentBet + minRaise;
  const maxTotal = myBet + myChips; // all-in
  const [amount, setAmount] = useState(minTotal);

  useEffect(() => {
    setAmount(Math.min(Math.max(minTotal, amount), maxTotal));
  }, [minTotal, maxTotal]);

  const clamp = (v) => Math.max(minTotal, Math.min(maxTotal, Math.round(v)));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#95d5b2" }}>
        <span>最小: {minTotal}</span>
        <span style={{ fontWeight: "bold", fontSize: 18, color: "#fff" }}>{amount}</span>
        <span>最大: {maxTotal}</span>
      </div>
      <input
        type="range"
        min={minTotal} max={maxTotal} step={1}
        value={amount}
        onChange={(e) => setAmount(Number(e.target.value))}
      />
      <div style={{ display: "flex", gap: 6 }}>
        {[0.5, 0.75, 1].map((frac) => {
          const pot = Math.round(maxTotal * frac); // rough pot fraction shortcuts
          const label = frac === 0.5 ? "½" : frac === 0.75 ? "¾" : "MAX";
          return (
            <button
              key={frac}
              className="btn-secondary"
              style={{ flex: 1, padding: "6px", fontSize: 13 }}
              onClick={() => setAmount(clamp(pot))}
            >
              {label}
            </button>
          );
        })}
      </div>
      <button
        className="btn-warning btn-lg"
        onClick={() => onRaise(amount)}
        disabled={amount < minTotal || amount > maxTotal}
      >
        レイズ {amount}
      </button>
    </div>
  );
}
