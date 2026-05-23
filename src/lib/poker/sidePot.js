// playerStates: Record<playerId, { totalBet: number, status: "active" | "folded" | "all_in" }>
// Returns: Pot[] where Pot = { amount: number, eligiblePlayers: string[] }
export function calculatePots(playerStates) {
  const entries = Object.entries(playerStates).map(([id, s]) => ({
    id,
    totalBet: s.totalBet,
    status: s.status,
  }));

  // Unique all-in contribution levels, sorted ascending
  const allInLevels = [
    ...new Set(entries.filter((e) => e.status === "all_in").map((e) => e.totalBet)),
  ].sort((a, b) => a - b);

  const pots = [];
  let level = 0;

  for (const cap of allInLevels) {
    const amount = entries.reduce(
      (sum, e) => sum + Math.max(0, Math.min(e.totalBet, cap) - level),
      0
    );

    if (amount === 0) continue;

    // Eligible: not folded AND contributed at least up to this cap
    const eligiblePlayers = entries
      .filter((e) => e.status !== "folded" && e.totalBet >= cap)
      .map((e) => e.id);

    pots.push({ amount, eligiblePlayers });
    level = cap;
  }

  // Final pot for all remaining contributions above the last all-in level
  const finalAmount = entries.reduce(
    (sum, e) => sum + Math.max(0, e.totalBet - level),
    0
  );

  if (finalAmount > 0) {
    const eligiblePlayers = entries
      .filter((e) => e.status !== "folded" && e.totalBet > level)
      .map((e) => e.id);
    pots.push({ amount: finalAmount, eligiblePlayers });
  }

  return pots;
}
