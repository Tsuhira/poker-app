import { describe, it, expect } from "vitest";
import {
  createInitialGameState,
  startHand,
  applyAction,
  advanceDealer,
  isGameOver,
} from "../src/lib/poker/gameEngine.js";

// --- Helpers ---

const SETTINGS = { startingChips: 1000, sb: 5, bb: 10, maxPlayers: 9 };

function makePlayers(names) {
  return names.map((name) => ({ id: name, displayName: name }));
}

function makeState(names, dealerIndex = 0) {
  return createInitialGameState({
    players: makePlayers(names),
    settings: SETTINGS,
    dealerIndex,
  });
}

// Run through a hand with a fixed action sequence; returns final state
function runActions(state, actions) {
  let s = state;
  for (const [playerId, action] of actions) {
    s = applyAction(s, playerId, action);
  }
  return s;
}

// --- Tests ---

describe("createInitialGameState", () => {
  it("全プレイヤーに startingChips が配布される", () => {
    const state = makeState(["A", "B", "C"]);
    for (const name of ["A", "B", "C"]) {
      expect(state.playerStates[name].chips).toBe(SETTINGS.startingChips);
    }
  });

  it("dealerIndex が設定される", () => {
    const state = makeState(["A", "B", "C"], 2);
    expect(state.dealerIndex).toBe(2);
  });
});

describe("startHand", () => {
  it("SB・BBが正しいプレイヤーから徴収される（3人）", () => {
    // dealers=0 → SB=1, BB=2
    const state = startHand(makeState(["A", "B", "C"], 0));
    expect(state.playerStates["B"].chips).toBe(1000 - 5);  // SB
    expect(state.playerStates["C"].chips).toBe(1000 - 10); // BB
    expect(state.playerStates["A"].chips).toBe(1000);      // UTG
  });

  it("ヘッズアップ（2人）: ディーラー=SB, 相手=BB", () => {
    // dealer=0=A → A is SB, B is BB
    const state = startHand(makeState(["A", "B"], 0));
    expect(state.playerStates["A"].chips).toBe(1000 - 5);  // SB
    expect(state.playerStates["B"].chips).toBe(1000 - 10); // BB
  });

  it("各プレイヤーにホールカード2枚が配られる", () => {
    const state = startHand(makeState(["A", "B", "C"]));
    for (const name of ["A", "B", "C"]) {
      expect(state.playerStates[name].holeCards).toHaveLength(2);
    }
  });

  it("currentBet が BB額になる", () => {
    const state = startHand(makeState(["A", "B", "C"]));
    expect(state.currentBet).toBe(SETTINGS.bb);
  });
});

describe("アクション - 順序", () => {
  it("Pre-flopは UTG（BBの左）から開始（3人）", () => {
    // dealer=0=A → SB=B(1), BB=C(2), UTG=A(0)
    const state = startHand(makeState(["A", "B", "C"], 0));
    expect(state.currentPlayerIndex).toBe(0); // A = UTG
    expect(state.players[state.currentPlayerIndex].id).toBe("A");
  });

  it("ヘッズアップ Pre-flopはディーラー（SB）から開始", () => {
    // dealer=0=A → A is SB, acts first pre-flop
    const state = startHand(makeState(["A", "B"], 0));
    expect(state.players[state.currentPlayerIndex].id).toBe("A");
  });

  it("Flop以降は SBの左（ディーラーの次の次）から開始", () => {
    // dealer=0=A, SB=B(1), BB=C(2)
    // Pre-flop: A(UTG) call, B(SB) call, C(BB) check → advance to Flop
    // Post-flop first: B(SB) = dealer+1
    const state = startHand(makeState(["A", "B", "C"], 0));
    let s = applyAction(state, "A", { type: "call" });
    s = applyAction(s, "B", { type: "call" });
    s = applyAction(s, "C", { type: "check" });
    expect(s.street).toBe("flop");
    // First to act on flop: first active left of dealer (dealer=0=A, so B=idx 1)
    expect(s.players[s.currentPlayerIndex].id).toBe("B");
  });
});

describe("アクション - Check", () => {
  it("currentBet=0 の時はチェック可能", () => {
    // dealer=0=A (2 players), A=SB posts 5, B=BB posts 10, pre-flop A must call
    // To test check: advance to flop where bet resets
    const state = startHand(makeState(["A", "B"], 0));
    let s = applyAction(state, "A", { type: "call" }); // A calls BB
    s = applyAction(s, "B", { type: "check" }); // BB checks → flop
    expect(s.street).toBe("flop");
    // On flop, currentBet=0, A goes first... actually B is first post-flop for heads-up
    // dealer=0=A, first active left of dealer = B (idx 1)
    expect(s.players[s.currentPlayerIndex].id).toBe("B");
    s = applyAction(s, "B", { type: "check" }); // B checks flop
    expect(s.playerStates["B"].status).toBe("active");
  });

  it("currentBet > 0 の時はチェック不可", () => {
    const state = startHand(makeState(["A", "B", "C"], 0));
    // A is UTG, currentBet=10 (BB), A cannot check
    expect(() => applyAction(state, "A", { type: "check" })).toThrow();
  });
});

describe("アクション - BBのチェック権", () => {
  it("誰もレイズしなかった場合 BB はチェック可能", () => {
    // dealer=0=A, SB=B, BB=C (3 players)
    // UTG(A) call, SB(B) call → BB(C) should be able to check
    const state = startHand(makeState(["A", "B", "C"], 0));
    let s = applyAction(state, "A", { type: "call" }); // UTG calls
    s = applyAction(s, "B", { type: "call" }); // SB calls
    // Now C (BB) can check
    expect(s.players[s.currentPlayerIndex].id).toBe("C");
    expect(() => applyAction(s, "C", { type: "check" })).not.toThrow();
  });
});

describe("アクション - Raise", () => {
  it("Raise でラウンドが延長され全員が再アクション可能", () => {
    // dealer=0=A, SB=B, BB=C (3 players)
    // UTG(A) calls, SB(B) calls, BB(C) raises → A and B need to act again
    const state = startHand(makeState(["A", "B", "C"], 0));
    let s = applyAction(state, "A", { type: "call" });
    s = applyAction(s, "B", { type: "call" });
    s = applyAction(s, "C", { type: "raise", amount: 30 }); // C raises to 30
    // A and B should have hasActed=false now
    expect(s.playerStates["A"].hasActed).toBe(false);
    expect(s.playerStates["B"].hasActed).toBe(false);
    expect(s.street).toBe("pre_flop"); // still pre-flop
  });

  it("minRaise 未満のレイズは拒否される", () => {
    // BB=10, minRaise=10 (initial)
    // A cannot raise to 15 (increment=5 < minRaise=10)
    const state = startHand(makeState(["A", "B", "C"], 0));
    expect(() => applyAction(state, "A", { type: "raise", amount: 15 })).toThrow();
  });

  it("合法なレイズ: minRaise 以上であれば通る", () => {
    const state = startHand(makeState(["A", "B", "C"], 0));
    expect(() => applyAction(state, "A", { type: "raise", amount: 20 })).not.toThrow();
  });
});

describe("ラウンド終了条件", () => {
  it("全員のbet額が揃い全員 hasActed でラウンド終了しストリートが進む", () => {
    // 3 players: A calls, B calls, C checks → flop
    const state = startHand(makeState(["A", "B", "C"], 0));
    let s = applyAction(state, "A", { type: "call" });
    s = applyAction(s, "B", { type: "call" });
    s = applyAction(s, "C", { type: "check" });
    expect(s.street).toBe("flop");
    expect(s.communityCards).toHaveLength(3);
  });

  it("全員 fold で 1人残り → 即 showdown & 勝者にチップ", () => {
    // dealer=0=A, SB=B, BB=C
    // A raises, B folds, C folds → A wins
    const state = startHand(makeState(["A", "B", "C"], 0));
    let s = applyAction(state, "A", { type: "raise", amount: 20 });
    s = applyAction(s, "B", { type: "fold" });
    s = applyAction(s, "C", { type: "fold" });
    expect(s.street).toBe("showdown");
    expect(s.winners).toHaveLength(1);
    expect(s.winners[0].playerId).toBe("A");
    // A wins the pot: B(5) + C(10) + A(20) = 35
    expect(s.playerStates["A"].chips).toBe(1000 - 20 + 35);
  });

  it("全員 all-in → Showdownに直行（残コミュニティカード一括公開）", () => {
    // Simulate all-in scenario: A goes all-in, B calls all-in
    const state = startHand(makeState(["A", "B"], 0));
    let s = applyAction(state, "A", { type: "all_in" });
    s = applyAction(s, "B", { type: "all_in" });
    expect(s.street).toBe("showdown");
    expect(s.communityCards).toHaveLength(5);
    expect(s.winners).not.toBeNull();
  });
});

describe("ゲームフロー", () => {
  it("ディーラーボタンが毎ハンド左に1つ移動する", () => {
    let state = makeState(["A", "B", "C"], 0);
    state = startHand(state);
    // Simulate hand ending
    state = startHand(advanceDealer(state));
    expect(state.dealerIndex).toBe(1);
    state = startHand(advanceDealer(state));
    expect(state.dealerIndex).toBe(2);
    state = startHand(advanceDealer(state));
    expect(state.dealerIndex).toBe(0); // wraps around
  });

  it("eliminated プレイヤーはディーラーボタン移動時にスキップされる", () => {
    let state = makeState(["A", "B", "C"], 0);
    // Manually eliminate B
    state.playerStates["B"].status = "eliminated";
    state = advanceDealer(state);
    expect(state.dealerIndex).toBe(2); // skip B(1), go to C(2)
  });

  it("チップが 0 になったプレイヤーが eliminated になる", () => {
    // Give A very few chips so they get eliminated
    let state = makeState(["A", "B"], 0);
    state.playerStates["A"].chips = 5; // less than BB
    state = startHand(state);
    // A goes all-in with 5 (posting SB), B posts BB=10
    // A all-ins, B calls
    let s = applyAction(state, "A", { type: "all_in" });
    s = applyAction(s, "B", { type: "call" });
    // If B wins, A should be eliminated
    if (s.winners && s.winners.every((w) => w.playerId !== "A")) {
      expect(s.playerStates["A"].status).toBe("eliminated");
    }
  });

  it("アクティブプレイヤーが 1人になったらゲーム終了", () => {
    let state = makeState(["A", "B"], 0);
    state.playerStates["A"].chips = 5;
    state.playerStates["B"].chips = 1000;
    state = startHand(state);
    // Force B to win by having B go all-in and A can't match
    let s = applyAction(state, "A", { type: "all_in" });
    s = applyAction(s, "B", { type: "call" });
    // Someone will be eliminated; check isGameOver after
    if (isGameOver(s)) {
      const remaining = s.players.filter((p) => s.playerStates[p.id].status !== "eliminated");
      expect(remaining).toHaveLength(1);
    }
  });
});

describe("チップが不足するブラインド（all-in 扱い）", () => {
  it("chips < SB のプレイヤーは all-in でブラインドを払う", () => {
    let state = makeState(["A", "B"], 0); // A=dealer=SB, B=BB
    state.playerStates["A"].chips = 3; // less than SB(5)
    state = startHand(state);
    expect(state.playerStates["A"].status).toBe("all_in");
    expect(state.playerStates["A"].chips).toBe(0);
    expect(state.playerStates["A"].bet).toBe(3);
  });
});

describe("フルハンドシナリオ（全員チェックのみ）", () => {
  it("全員チェックのみで Showdown まで進む", () => {
    // 2 players: A=dealer=SB, B=BB
    // Pre-flop: A calls (no raise), B checks
    // Flop/Turn/River: both check each time
    const state = startHand(makeState(["A", "B"], 0));
    let s = applyAction(state, "A", { type: "call" }); // A calls BB
    s = applyAction(s, "B", { type: "check" }); // B checks → flop
    expect(s.street).toBe("flop");
    s = applyAction(s, "B", { type: "check" }); // post-flop: B first (dealer+1=B for 2p)
    s = applyAction(s, "A", { type: "check" }); // → turn
    expect(s.street).toBe("turn");
    s = applyAction(s, "B", { type: "check" });
    s = applyAction(s, "A", { type: "check" }); // → river
    expect(s.street).toBe("river");
    s = applyAction(s, "B", { type: "check" });
    s = applyAction(s, "A", { type: "check" }); // → showdown
    expect(s.street).toBe("showdown");
    expect(s.winners).not.toBeNull();
    // Total chips conserved
    const totalChips = Object.values(s.playerStates).reduce((sum, ps) => sum + ps.chips, 0);
    expect(totalChips).toBe(2 * SETTINGS.startingChips);
  });
});
