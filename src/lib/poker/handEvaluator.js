// C(n,k) の全組み合わせを返す
function combinations(arr, k) {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [first, ...rest] = arr;
  return [
    ...combinations(rest, k - 1).map((c) => [first, ...c]),
    ...combinations(rest, k),
  ];
}

function isFlush(cards) {
  return cards.every((c) => c.suit === cards[0].suit);
}

// 連続した5ランクなら最大ランクを返す、そうでなければ false
// Aロー (A-2-3-4-5) は 5 を返す
function straightHigh(ranks) {
  const uniq = [...new Set(ranks)].sort((a, b) => b - a);
  if (uniq.length < 5) return false;
  // 通常のストレート
  if (uniq[0] - uniq[4] === 4) return uniq[0];
  // Aロー: [14,5,4,3,2]
  if (
    uniq[0] === 14 &&
    uniq[1] === 5 &&
    uniq[2] === 4 &&
    uniq[3] === 3 &&
    uniq[4] === 2
  )
    return 5;
  return false;
}

// ランクの出現頻度を { rank, count }[] で返す（多い順→同数なら高ランク順）
function rankFreqs(ranks) {
  const freq = {};
  for (const r of ranks) freq[r] = (freq[r] || 0) + 1;
  return Object.entries(freq)
    .map(([r, c]) => ({ rank: Number(r), count: c }))
    .sort((a, b) => b.count - a.count || b.rank - a.rank);
}

// value 配列を辞書順比較（大きい方が強い）
function compareValues(v1, v2) {
  for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
    const a = v1[i] ?? 0;
    const b = v2[i] ?? 0;
    if (a !== b) return a > b ? 1 : -1;
  }
  return 0;
}

// 5枚のカードを評価して { rank, value, name } を返す
export function evaluateFive(cards) {
  const ranks = cards.map((c) => c.rank);
  const flush = isFlush(cards);
  const straight = straightHigh(ranks);
  const freqs = rankFreqs(ranks);
  const [f0, f1, f2] = freqs;

  if (flush && straight === 14)
    return { rank: 9, value: [9, 14], name: "Royal Flush" };
  if (flush && straight)
    return { rank: 8, value: [8, straight], name: "Straight Flush" };
  if (f0.count === 4)
    return { rank: 7, value: [7, f0.rank, f1.rank], name: "Four of a Kind" };
  if (f0.count === 3 && f1.count === 2)
    return { rank: 6, value: [6, f0.rank, f1.rank], name: "Full House" };
  if (flush)
    return {
      rank: 5,
      value: [5, ...ranks.sort((a, b) => b - a)],
      name: "Flush",
    };
  if (straight)
    return { rank: 4, value: [4, straight], name: "Straight" };
  if (f0.count === 3)
    return {
      rank: 3,
      value: [3, f0.rank, f1.rank, f2.rank],
      name: "Three of a Kind",
    };
  if (f0.count === 2 && f1.count === 2)
    return {
      rank: 2,
      value: [2, f0.rank, f1.rank, f2.rank],
      name: "Two Pair",
    };
  if (f0.count === 2)
    return {
      rank: 1,
      value: [1, f0.rank, ...freqs.slice(1).map((f) => f.rank)],
      name: "One Pair",
    };
  return {
    rank: 0,
    value: [0, ...ranks.sort((a, b) => b - a)],
    name: "High Card",
  };
}

// 5〜7枚から最強の5枚の評価結果を返す
// 戻り値: { rank, value, name, bestCards }
export function bestHand(cards) {
  if (cards.length < 5) throw new Error("bestHand requires at least 5 cards");
  const combos = cards.length === 5 ? [cards] : combinations(cards, 5);
  let best = null;
  let bestCards = null;
  for (const combo of combos) {
    const result = evaluateFive(combo);
    if (!best || compareValues(result.value, best.value) > 0) {
      best = result;
      bestCards = combo;
    }
  }
  return { ...best, bestCards };
}

// hand1, hand2 を比較: 1=hand1が強い, -1=hand2が強い, 0=同点
export function compareHands(hand1, hand2) {
  return compareValues(hand1.value, hand2.value);
}
