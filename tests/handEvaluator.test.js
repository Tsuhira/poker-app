import { describe, it, expect } from "vitest";
import { evaluateFive, bestHand, compareHands } from "../src/lib/poker/handEvaluator.js";

const c = (suit, rank) => ({ suit, rank });

// --- 5枚評価 ---
describe("evaluateFive", () => {
  it("Royal Flush", () => {
    const hand = evaluateFive([c("S",14),c("S",13),c("S",12),c("S",11),c("S",10)]);
    expect(hand.rank).toBe(9);
    expect(hand.name).toBe("Royal Flush");
  });

  it("Straight Flush（Aロー: A-2-3-4-5）", () => {
    const hand = evaluateFive([c("H",14),c("H",2),c("H",3),c("H",4),c("H",5)]);
    expect(hand.rank).toBe(8);
    expect(hand.value[1]).toBe(5); // highは5
  });

  it("Straight Flush（通常）", () => {
    const hand = evaluateFive([c("D",9),c("D",8),c("D",7),c("D",6),c("D",5)]);
    expect(hand.rank).toBe(8);
    expect(hand.value[1]).toBe(9);
  });

  it("Four of a Kind", () => {
    const hand = evaluateFive([c("S",14),c("H",14),c("D",14),c("C",14),c("S",5)]);
    expect(hand.rank).toBe(7);
  });

  it("Full House", () => {
    const hand = evaluateFive([c("S",14),c("H",14),c("D",14),c("C",13),c("S",13)]);
    expect(hand.rank).toBe(6);
  });

  it("Flush", () => {
    const hand = evaluateFive([c("S",14),c("S",10),c("S",8),c("S",6),c("S",3)]);
    expect(hand.rank).toBe(5);
  });

  it("Straight（Aハイ: A-K-Q-J-10）", () => {
    const hand = evaluateFive([c("S",14),c("H",13),c("D",12),c("C",11),c("S",10)]);
    expect(hand.rank).toBe(4);
    expect(hand.value[1]).toBe(14);
  });

  it("Straight（Aロー: A-2-3-4-5）", () => {
    const hand = evaluateFive([c("S",14),c("H",2),c("D",3),c("C",4),c("S",5)]);
    expect(hand.rank).toBe(4);
    expect(hand.value[1]).toBe(5);
  });

  it("Three of a Kind", () => {
    const hand = evaluateFive([c("S",7),c("H",7),c("D",7),c("C",2),c("S",3)]);
    expect(hand.rank).toBe(3);
  });

  it("Two Pair", () => {
    const hand = evaluateFive([c("S",14),c("H",14),c("D",13),c("C",13),c("S",2)]);
    expect(hand.rank).toBe(2);
  });

  it("One Pair", () => {
    const hand = evaluateFive([c("S",14),c("H",14),c("D",10),c("C",8),c("S",3)]);
    expect(hand.rank).toBe(1);
  });

  it("High Card", () => {
    const hand = evaluateFive([c("S",14),c("H",10),c("D",8),c("C",6),c("S",2)]);
    expect(hand.rank).toBe(0);
  });
});

// --- 7枚からベストハンド ---
describe("bestHand", () => {
  it("7枚から最強の5枚を選択する", () => {
    // 手札: K♠Q♠ コミュニティ: A♠J♠10♠ 9♥ 2♣
    // → ロイヤルフラッシュ: A♠K♠Q♠J♠10♠
    const cards = [
      c("S",13), c("S",12),
      c("S",14), c("S",11), c("S",10), c("H",9), c("C",2),
    ];
    const result = bestHand(cards);
    expect(result.rank).toBe(9);
    expect(result.name).toBe("Royal Flush");
  });

  it("コミュニティカードのみで役が成立するケース", () => {
    // 手札: 2♥3♦ コミュニティ: A♠A♦A♣A♥K♠
    // → フォーエースはコミュニティのみで成立
    const cards = [
      c("H",2), c("D",3),
      c("S",14), c("D",14), c("C",14), c("H",14), c("S",13),
    ];
    const result = bestHand(cards);
    expect(result.rank).toBe(7); // Four of a Kind
  });

  it("5枚でも動作する", () => {
    const cards = [c("S",14),c("H",14),c("D",14),c("C",14),c("S",5)];
    const result = bestHand(cards);
    expect(result.rank).toBe(7);
  });
});

// --- ハンド比較 ---
describe("compareHands", () => {
  it("ランクが高い方が勝つ", () => {
    const flush = bestHand([c("S",14),c("S",10),c("S",8),c("S",6),c("S",3)]);
    const straight = bestHand([c("S",9),c("H",8),c("D",7),c("C",6),c("S",5)]);
    expect(compareHands(flush, straight)).toBe(1);
  });

  it("同ランクでキッカー比較（ペア同士）", () => {
    // A A K Q J vs A A K Q 10
    const hand1 = bestHand([c("S",14),c("H",14),c("D",13),c("C",12),c("S",11)]);
    const hand2 = bestHand([c("D",14),c("C",14),c("S",13),c("H",12),c("D",10)]);
    expect(compareHands(hand1, hand2)).toBe(1); // Jキッカーの方が強い
  });

  it("完全同点は 0 を返す", () => {
    const hand1 = bestHand([c("S",14),c("H",13),c("D",12),c("C",11),c("S",10)]);
    const hand2 = bestHand([c("H",14),c("D",13),c("C",12),c("S",11),c("H",10)]);
    expect(compareHands(hand1, hand2)).toBe(0);
  });

  it("Aロー Straight vs 通常 Straight", () => {
    const aLow  = bestHand([c("S",14),c("H",2),c("D",3),c("C",4),c("S",5)]);
    const sixHigh = bestHand([c("S",6),c("H",2),c("D",3),c("C",4),c("S",5)]);
    expect(compareHands(sixHigh, aLow)).toBe(1); // 6ハイの方が強い
  });
});
