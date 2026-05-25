import { useState, useEffect } from "react";

export function RaiseControls({ currentBet, minRaise, myBet, myChips, onRaise, pot = 0, bb = 20, street = "pre_flop" }) {
  const minTotal = currentBet + minRaise;
  const maxTotal = myBet + myChips;
  const [amount, setAmount] = useState(minTotal);

  useEffect(() => {
    setAmount((prev) => Math.min(Math.max(minTotal, prev), maxTotal));
  }, [minTotal, maxTotal]);

  const clamp = (v) => Math.max(minTotal, Math.min(maxTotal, Math.round(v)));

  // Pot-sized raise = currentBet + (pot after calling)
  const toCall = currentBet - myBet;
  const potAfterCall = pot + toCall;

  const potButtons = [
    { label: "1/3P", value: currentBet + Math.round(potAfterCall / 3) },
    { label: "1/2P", value: currentBet + Math.round(potAfterCall / 2) },
    { label: "3/4P", value: currentBet + Math.round(potAfterCall * 0.75) },
    { label: "P",    value: currentBet + potAfterCall },
  ];

  const bbButtons = street === "pre_flop"
    ? [
        { label: "2bb",   value: 2 * bb },
        { label: "2.5bb", value: Math.round(2.5 * bb) },
        { label: "3bb",   value: 3 * bb },
        { label: "4bb",   value: 4 * bb },
      ]
    : [];

  const btnStyle = {
    flex: 1, padding: "6px 2px", fontSize: 12,
    background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.2)",
    borderRadius: 6, color: "#fff", cursor: "pointer",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
      {/* bb buttons (pre-flop only) */}
      {bbButtons.length > 0 && (
        <div style={{ display: "flex", gap: 5 }}>
          {bbButtons.map(({ label, value }) => (
            <button key={label} style={btnStyle} onClick={() => setAmount(clamp(value))}>
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Pot fraction buttons + ALL-IN */}
      <div style={{ display: "flex", gap: 5 }}>
        {potButtons.map(({ label, value }) => (
          <button key={label} style={btnStyle} onClick={() => setAmount(clamp(value))}>
            {label}
          </button>
        ))}
        <button style={{ ...btnStyle, color: "#f4a261", borderColor: "#f4a261" }} onClick={() => setAmount(maxTotal)}>
          ALL-IN
        </button>
      </div>

      {/* Slider + current amount */}
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
        style={{ width: "100%" }}
      />

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
