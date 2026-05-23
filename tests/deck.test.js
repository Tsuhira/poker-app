import { describe, it, expect } from "vitest";
import { createDeck, shuffle, draw } from "../src/lib/poker/deck.js";

describe("createDeck", () => {
  it("52枚生成される", () => {
    expect(createDeck()).toHaveLength(52);
  });

  it("全カードのsuitが正しい範囲内", () => {
    const suits = new Set(createDeck().map((c) => c.suit));
    expect([...suits].sort()).toEqual(["C", "D", "H", "S"]);
  });

  it("全カードのrankが2〜14の範囲内", () => {
    const ranks = createDeck().map((c) => c.rank);
    expect(ranks.every((r) => r >= 2 && r <= 14)).toBe(true);
  });

  it("重複カードがない", () => {
    const deck = createDeck();
    const keys = deck.map((c) => `${c.suit}${c.rank}`);
    expect(new Set(keys).size).toBe(52);
  });
});

describe("shuffle", () => {
  it("シャッフル後も52枚", () => {
    expect(shuffle(createDeck())).toHaveLength(52);
  });

  it("シャッフル後も重複なし", () => {
    const shuffled = shuffle(createDeck());
    const keys = shuffled.map((c) => `${c.suit}${c.rank}`);
    expect(new Set(keys).size).toBe(52);
  });

  it("元のデッキを変更しない", () => {
    const deck = createDeck();
    const first = deck[0];
    shuffle(deck);
    expect(deck[0]).toBe(first);
  });
});

describe("draw", () => {
  it("指定枚数のカードを取り出す", () => {
    const deck = createDeck();
    const { cards } = draw(deck, 5);
    expect(cards).toHaveLength(5);
  });

  it("残りデッキ枚数が (52-n) になる", () => {
    const deck = createDeck();
    const { remaining } = draw(deck, 5);
    expect(remaining).toHaveLength(47);
  });

  it("取り出したカードと残りの合計が元の枚数と一致", () => {
    const deck = createDeck();
    const { cards, remaining } = draw(deck, 3);
    expect(cards.length + remaining.length).toBe(52);
  });

  it("デフォルトで1枚取り出す", () => {
    const { cards } = draw(createDeck());
    expect(cards).toHaveLength(1);
  });

  it("元のデッキを変更しない", () => {
    const deck = createDeck();
    draw(deck, 5);
    expect(deck).toHaveLength(52);
  });
});
