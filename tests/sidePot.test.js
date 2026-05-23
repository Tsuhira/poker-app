import { describe, it, expect } from "vitest";
import { calculatePots } from "../src/lib/poker/sidePot.js";

// Helper: build a minimal playerStates object
const ps = (entries) =>
  Object.fromEntries(entries.map(([id, totalBet, status]) => [id, { totalBet, status }]));

describe("calculatePots", () => {
  it("オールインなし → メインポット1つ", () => {
    const pots = calculatePots(ps([
      ["A", 100, "active"],
      ["B", 100, "active"],
      ["C", 100, "active"],
    ]));
    expect(pots).toHaveLength(1);
    expect(pots[0].amount).toBe(300);
    expect(pots[0].eligiblePlayers.sort()).toEqual(["A", "B", "C"]);
  });

  it("1人オールイン（最小額）→ メインポット + サイドポット1つ", () => {
    // A: 100 all-in, B: 300 active, C: 300 active
    const pots = calculatePots(ps([
      ["A", 100, "all_in"],
      ["B", 300, "active"],
      ["C", 300, "active"],
    ]));
    expect(pots).toHaveLength(2);

    // メインポット: 100*3 = 300
    expect(pots[0].amount).toBe(300);
    expect(pots[0].eligiblePlayers.sort()).toEqual(["A", "B", "C"]);

    // サイドポット: 200*2 = 400
    expect(pots[1].amount).toBe(400);
    expect(pots[1].eligiblePlayers.sort()).toEqual(["B", "C"]);
  });

  it("2人オールイン（異なる額）→ メインポット + サイドポット2つ", () => {
    // A: 50 all-in, B: 100 all-in, C: 300 active
    const pots = calculatePots(ps([
      ["A",  50, "all_in"],
      ["B", 100, "all_in"],
      ["C", 300, "active"],
    ]));
    expect(pots).toHaveLength(3);

    // Pot 1: 50*3 = 150, eligible: A, B, C
    expect(pots[0].amount).toBe(150);
    expect(pots[0].eligiblePlayers.sort()).toEqual(["A", "B", "C"]);

    // Pot 2: 50*2 = 100, eligible: B, C
    expect(pots[1].amount).toBe(100);
    expect(pots[1].eligiblePlayers.sort()).toEqual(["B", "C"]);

    // Pot 3: 200*1 = 200, eligible: C
    expect(pots[2].amount).toBe(200);
    expect(pots[2].eligiblePlayers).toEqual(["C"]);

    // 合計が元のチップと一致
    expect(pots.reduce((s, p) => s + p.amount, 0)).toBe(50 + 100 + 300);
  });

  it("フォールドしたプレイヤーの分はポットに含まれるがeligibleには入らない", () => {
    // A: 100 all-in, B: 300 active, C: 300 active, D: 200 fold
    const pots = calculatePots(ps([
      ["A", 100, "all_in"],
      ["B", 300, "active"],
      ["C", 300, "active"],
      ["D", 200, "folded"],
    ]));

    // メインポット: 100*4 = 400, eligible: A, B, C (D folded)
    expect(pots[0].amount).toBe(400);
    expect(pots[0].eligiblePlayers.sort()).toEqual(["A", "B", "C"]);
    expect(pots[0].eligiblePlayers).not.toContain("D");

    // サイドポット: B:200 + C:200 + D:100(fold) = 500, eligible: B, C
    expect(pots[1].amount).toBe(500);
    expect(pots[1].eligiblePlayers.sort()).toEqual(["B", "C"]);
    expect(pots[1].eligiblePlayers).not.toContain("D");

    // 合計が全チップと一致
    expect(pots.reduce((s, p) => s + p.amount, 0)).toBe(100 + 300 + 300 + 200);
  });

  it("オールイン額がBBより小さい場合の処理", () => {
    // A: 30 all-in（BB=100未満）, B: 100 active, C: 100 active
    const pots = calculatePots(ps([
      ["A",  30, "all_in"],
      ["B", 100, "active"],
      ["C", 100, "active"],
    ]));
    expect(pots).toHaveLength(2);

    // Pot 1: 30*3 = 90, eligible: A, B, C
    expect(pots[0].amount).toBe(90);
    expect(pots[0].eligiblePlayers.sort()).toEqual(["A", "B", "C"]);

    // Pot 2: 70*2 = 140, eligible: B, C
    expect(pots[1].amount).toBe(140);
    expect(pots[1].eligiblePlayers.sort()).toEqual(["B", "C"]);

    expect(pots.reduce((s, p) => s + p.amount, 0)).toBe(30 + 100 + 100);
  });

  it("全員オールイン（異なる額）の多段サイドポット", () => {
    // A: 50 all-in, B: 100 all-in, C: 200 all-in
    const pots = calculatePots(ps([
      ["A",  50, "all_in"],
      ["B", 100, "all_in"],
      ["C", 200, "all_in"],
    ]));
    expect(pots).toHaveLength(3);

    // Pot 1 (cap=50): 50*3 = 150, eligible: A, B, C
    expect(pots[0].amount).toBe(150);
    expect(pots[0].eligiblePlayers.sort()).toEqual(["A", "B", "C"]);

    // Pot 2 (cap=100): 50*2 = 100, eligible: B, C
    expect(pots[1].amount).toBe(100);
    expect(pots[1].eligiblePlayers.sort()).toEqual(["B", "C"]);

    // Pot 3 (cap=200): 100*1 = 100, eligible: C
    expect(pots[2].amount).toBe(100);
    expect(pots[2].eligiblePlayers).toEqual(["C"]);

    expect(pots.reduce((s, p) => s + p.amount, 0)).toBe(50 + 100 + 200);
  });

  it("同額オールインは1つのポットにまとめられる", () => {
    // A: 100 all-in, B: 100 all-in, C: 300 active
    const pots = calculatePots(ps([
      ["A", 100, "all_in"],
      ["B", 100, "all_in"],
      ["C", 300, "active"],
    ]));
    expect(pots).toHaveLength(2);

    // Pot 1 (cap=100): 100*3 = 300, eligible: A, B, C
    expect(pots[0].amount).toBe(300);
    expect(pots[0].eligiblePlayers.sort()).toEqual(["A", "B", "C"]);

    // Pot 2: 200*1 = 200, eligible: C
    expect(pots[1].amount).toBe(200);
    expect(pots[1].eligiblePlayers).toEqual(["C"]);

    expect(pots.reduce((s, p) => s + p.amount, 0)).toBe(100 + 100 + 300);
  });
});
