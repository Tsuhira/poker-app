import { createDeck, shuffle, draw } from "./deck.js";
import { bestHand, compareHands } from "./handEvaluator.js";
import { calculatePots } from "./sidePot.js";

// Deep copy (game state contains only plain objects/arrays/primitives)
function deepCopy(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// --- Player helpers ---

function activePlayers(state) {
  return state.players.filter((p) => state.playerStates[p.id].status === "active");
}

function nonFoldedPlayers(state) {
  return state.players.filter((p) => state.playerStates[p.id].status !== "folded" && state.playerStates[p.id].status !== "eliminated");
}

// Next active player index cycling through state.players from fromIndex
function nextActiveIndex(state, fromIndex) {
  const n = state.players.length;
  for (let i = 1; i <= n; i++) {
    const idx = (fromIndex + i) % n;
    if (state.playerStates[state.players[idx].id].status === "active") return idx;
  }
  return -1;
}

// Determine SB player id for current dealer
function sbId(state) {
  const n = state.players.length;
  if (n === 2) return state.players[state.dealerIndex].id;
  return state.players[(state.dealerIndex + 1) % n].id;
}

// Determine BB player id for current dealer
function bbId(state) {
  const n = state.players.length;
  if (n === 2) return state.players[(state.dealerIndex + 1) % n].id;
  return state.players[(state.dealerIndex + 2) % n].id;
}

// First-to-act index for pre-flop
function preflopFirstIndex(state) {
  const n = state.players.length;
  if (n === 2) return state.dealerIndex; // dealer = SB acts first heads-up
  // UTG = 3 left of dealer
  const bbIdx = (state.dealerIndex + 2) % n;
  return nextActiveIndex(state, bbIdx);
}

// First-to-act index for post-flop streets (first active left of dealer)
function postflopFirstIndex(state) {
  return nextActiveIndex(state, state.dealerIndex);
}

// Post blind chips for a player (handles all-in if chips < amount)
function postBlind(state, playerId, amount) {
  const ps = state.playerStates[playerId];
  const actual = Math.min(amount, ps.chips);
  ps.chips -= actual;
  ps.bet += actual;
  ps.totalBet += actual;
  if (ps.chips === 0) ps.status = "all_in";
  if (ps.bet > state.currentBet) state.currentBet = ps.bet;
}

// Check if the current betting round is over
function isBettingRoundOver(state) {
  const active = activePlayers(state);
  if (active.length === 0) return true;
  return active.every(
    (p) =>
      state.playerStates[p.id].hasActed &&
      state.playerStates[p.id].bet === state.currentBet
  );
}

// --- Pot resolution helpers ---

function resolveShowdown(state) {
  const community = state.communityCards;

  // Debug: log hole cards at showdown time
  for (const p of state.players) {
    const ps = state.playerStates[p.id];
    const cards = ps.holeCards?.map((c) => `${c.rank}${c.suit}`).join(",") ?? "undefined";
    if (!ps.holeCards?.length) {
      console.warn(`[resolveShowdown] WARNING: ${p.id} has empty holeCards! status=${ps.status}`);
    } else {
      console.log(`[resolveShowdown] ${p.id}: holeCards=[${cards}] status=${ps.status}`);
    }
  }
  console.log(`[resolveShowdown] community: ${community.map((c) => `${c.rank}${c.suit}`).join(",")}`);

  // Calculate final pots from totalBets
  const psMap = {};
  for (const p of state.players) {
    const ps = state.playerStates[p.id];
    psMap[p.id] = { totalBet: ps.totalBet, status: ps.status };
  }
  state.pots = calculatePots(psMap);

  const winners = [];

  for (let potIdx = 0; potIdx < state.pots.length; potIdx++) {
    const pot = state.pots[potIdx];
    const candidates = pot.eligiblePlayers.map((id) => ({
      id,
      hand: bestHand([...(state.playerStates[id].holeCards ?? []), ...community]),
    }));

    candidates.sort((a, b) => -compareHands(a.hand, b.hand)); // best first

    const best = candidates[0].hand;
    const tied = candidates.filter((c) => compareHands(c.hand, best) === 0);

    const share = Math.floor(pot.amount / tied.length);
    const remainder = pot.amount - share * tied.length;

    tied.forEach((c, i) => {
      const amount = i === 0 ? share + remainder : share; // SB-adjacent player gets remainder
      state.playerStates[c.id].chips += amount;
      winners.push({ playerId: c.id, potIndex: potIdx, amount, handRank: c.hand.rank, bestHand: c.hand.bestCards });
    });
  }

  // 全非フォールドプレイヤーのハンド結果を記録（表示用）
  const handResults = {};
  for (const p of state.players) {
    const ps = state.playerStates[p.id];
    if (ps.status === "folded" || ps.status === "eliminated") continue;
    if ((ps.holeCards?.length ?? 0) > 0) {
      const result = bestHand([...ps.holeCards, ...community]);
      handResults[p.id] = { rank: result.rank, name: result.name, bestCards: result.bestCards };
    }
  }
  state.handResults = handResults;

  state.winners = winners;
  state.street = "showdown";
  markEliminated(state);
  return state;
}

function resolveUncontestedWin(state) {
  // Only one non-folded player — wins all chips bet in the hand
  const winner = nonFoldedPlayers(state)[0];

  // Compute total pot from totalBets
  const total = Object.values(state.playerStates).reduce((s, ps) => s + ps.totalBet, 0);
  state.pots = [{ amount: total, eligiblePlayers: [winner.id] }];
  state.playerStates[winner.id].chips += total;
  state.winners = [{ playerId: winner.id, potIndex: 0, amount: total, handRank: null, bestHand: null }];
  state.street = "showdown";
  state.uncontested = true;
  markEliminated(state);
  return state;
}

function markEliminated(state) {
  for (const p of state.players) {
    if (state.playerStates[p.id].chips === 0 && state.playerStates[p.id].status !== "eliminated") {
      state.playerStates[p.id].status = "eliminated";
    }
  }
}

function dealCommunity(state, count) {
  const result = draw(state.deck, count);
  state.communityCards.push(...result.cards);
  state.deck = result.remaining;
}

function resetBetsForStreet(state) {
  state.currentBet = 0;
  state.minRaise = state.settings.bb;
  state.lastAggressor = null;
  for (const p of state.players) {
    const ps = state.playerStates[p.id];
    if (ps.status === "active") {
      ps.bet = 0;
      ps.hasActed = false;
    }
  }
}

// Advance to the next street after a betting round ends
function advanceStreet(state) {
  const alive = nonFoldedPlayers(state);

  if (alive.length === 1) return resolveUncontestedWin(state);

  // All non-folded players are all-in → deal remaining community at once
  const allAllIn = alive.every((p) => state.playerStates[p.id].status === "all_in");

  switch (state.street) {
    case "pre_flop":
      state.street = "flop";
      dealCommunity(state, 3);
      break;
    case "flop":
      state.street = "turn";
      dealCommunity(state, 1);
      break;
    case "turn":
      state.street = "river";
      dealCommunity(state, 1);
      break;
    case "river":
      return resolveShowdown(state);
  }

  if (allAllIn) {
    // Skip remaining betting — deal rest of board then showdown
    if (state.communityCards.length < 5) dealCommunity(state, 5 - state.communityCards.length);
    return resolveShowdown(state);
  }

  resetBetsForStreet(state);
  state.currentPlayerIndex = postflopFirstIndex(state);
  return state;
}

// --- Public API ---

// Initialize game state (no chips distributed yet; call startHand before first deal)
export function createInitialGameState({ players, settings, dealerIndex = 0 }) {
  const playerStates = {};
  for (const p of players) {
    playerStates[p.id] = {
      chips: settings.startingChips,
      bet: 0,
      totalBet: 0,
      holeCards: [],
      status: "active",
      hasActed: false,
    };
  }
  return {
    street: "waiting",
    dealerIndex,
    deck: [],
    communityCards: [],
    pots: [],
    currentPlayerIndex: -1,
    currentBet: 0,
    minRaise: settings.bb,
    playerStates,
    lastAggressor: null,
    winners: null,
    settings,
    players, // ordered array of { id, displayName }
  };
}

// Start a new hand: reset per-hand fields, post blinds, deal hole cards, set first player
export function startHand(state) {
  const next = deepCopy(state);

  // Reset per-hand fields for non-eliminated players
  for (const p of next.players) {
    const ps = next.playerStates[p.id];
    if (ps.status === "eliminated") continue;
    ps.bet = 0;
    ps.totalBet = 0;
    ps.holeCards = [];
    ps.hasActed = false;
    ps.status = "active";
  }

  next.street = "pre_flop";
  next.communityCards = [];
  next.pots = [];
  next.currentBet = 0;
  next.lastAggressor = null;
  next.winners = null;
  next.uncontested = false;
  next.minRaise = next.settings.bb;

  // Post blinds
  const sb = sbId(next);
  const bb = bbId(next);
  postBlind(next, sb, next.settings.sb);
  postBlind(next, bb, next.settings.bb);

  // Deal hole cards
  let deck = shuffle(createDeck());
  for (const p of next.players) {
    const ps = next.playerStates[p.id];
    if (ps.status === "active" || ps.status === "all_in") {
      const result = draw(deck, 2);
      ps.holeCards = result.cards;
      deck = result.remaining;
    }
  }
  next.deck = deck;

  // Set first player pre-flop
  next.currentPlayerIndex = preflopFirstIndex(next);

  return next;
}

// Apply a player action; returns new state
export function applyAction(state, playerId, action) {
  if (state.players[state.currentPlayerIndex]?.id !== playerId) {
    throw new Error(`Not ${playerId}'s turn`);
  }

  const next = deepCopy(state);
  const ps = next.playerStates[playerId];

  switch (action.type) {
    case "fold":
      ps.status = "folded";
      ps.hasActed = true;
      break;

    case "check":
      if (ps.bet !== next.currentBet) throw new Error("Cannot check: must call or raise");
      ps.hasActed = true;
      break;

    case "call": {
      const toCall = Math.min(next.currentBet - ps.bet, ps.chips);
      ps.chips -= toCall;
      ps.bet += toCall;
      ps.totalBet += toCall;
      if (ps.chips === 0) ps.status = "all_in";
      ps.hasActed = true;
      break;
    }

    case "raise": {
      // action.amount = total bet for this street (call amount included)
      const raiseTotal = action.amount;
      const increment = raiseTotal - next.currentBet;
      if (increment < next.minRaise) throw new Error(`Raise ${increment} below minRaise ${next.minRaise}`);
      const toAdd = Math.min(raiseTotal - ps.bet, ps.chips);
      ps.chips -= toAdd;
      ps.bet += toAdd;
      ps.totalBet += toAdd;
      if (ps.chips === 0) ps.status = "all_in";
      next.minRaise = ps.bet - next.currentBet;
      next.currentBet = ps.bet;
      next.lastAggressor = playerId;
      // Re-open action for all other active players
      for (const p of next.players) {
        if (p.id !== playerId && next.playerStates[p.id].status === "active") {
          next.playerStates[p.id].hasActed = false;
        }
      }
      ps.hasActed = true;
      break;
    }

    case "all_in": {
      const toAdd = ps.chips;
      ps.bet += toAdd;
      ps.totalBet += toAdd;
      ps.chips = 0;
      ps.status = "all_in";
      if (ps.bet > next.currentBet) {
        const increment = ps.bet - next.currentBet;
        if (increment >= next.minRaise) {
          next.minRaise = increment;
          next.lastAggressor = playerId;
          for (const p of next.players) {
            if (p.id !== playerId && next.playerStates[p.id].status === "active") {
              next.playerStates[p.id].hasActed = false;
            }
          }
        }
        next.currentBet = ps.bet;
      }
      ps.hasActed = true;
      break;
    }

    default:
      throw new Error(`Unknown action: ${action.type}`);
  }

  if (isBettingRoundOver(next)) {
    return advanceStreet(next);
  }

  next.currentPlayerIndex = nextActiveIndex(next, next.currentPlayerIndex);
  return next;
}

// 途中参加プレイヤーを追加（次のハンド開始前に呼ぶ）
export function addPlayers(state, newPlayers) {
  const next = deepCopy(state);
  for (const p of newPlayers) {
    if (next.players.some((existing) => existing.id === p.id)) continue;
    next.players.push({ id: p.id, displayName: p.displayName });
    next.playerStates[p.id] = {
      chips: next.settings.startingChips,
      bet: 0,
      totalBet: 0,
      holeCards: [],
      status: "active",
      hasActed: false,
    };
  }
  return next;
}

// Move dealer button to next non-eliminated player
export function advanceDealer(state) {
  const next = deepCopy(state);
  const n = next.players.length;
  for (let i = 1; i <= n; i++) {
    const idx = (next.dealerIndex + i) % n;
    if (next.playerStates[next.players[idx].id].status !== "eliminated") {
      next.dealerIndex = idx;
      break;
    }
  }
  return next;
}

export function isGameOver(state) {
  return state.players.filter((p) => state.playerStates[p.id].status !== "eliminated").length <= 1;
}
