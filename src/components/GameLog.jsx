import { useRef, useEffect } from "react";

export function GameLog({ log }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = 0;
  }, [log.length]);

  return (
    <div style={{
      position: "fixed", right: 8, top: 8,
      width: 200, maxHeight: "45vh",
      background: "rgba(0,0,0,0.55)", borderRadius: 10,
      padding: "10px 12px", overflow: "hidden", backdropFilter: "blur(4px)",
    }}>
      <div style={{ fontSize: 11, color: "#95d5b2", marginBottom: 6, fontWeight: "bold" }}>ゲームログ</div>
      <div ref={ref} style={{ overflowY: "auto", maxHeight: "calc(45vh - 40px)" }}>
        {log.map((entry, i) => (
          <div key={i} style={{
            fontSize: 12, marginBottom: 4, color: i === 0 ? "#fff" : "rgba(255,255,255,0.65)",
            lineHeight: 1.4,
          }}>
            {entry.msg}
          </div>
        ))}
      </div>
    </div>
  );
}
