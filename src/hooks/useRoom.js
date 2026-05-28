import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  createInitialGameState,
  startHand,
  applyAction,
  advanceDealer,
  addPlayers,
  isGameOver,
} from "../lib/poker/gameEngine.js";
import { WebRTCTransport } from "../lib/transport/webrtcTransport.js";
import { FirestoreTransport } from "../lib/transport/firestoreTransport.js";
import { db } from "../lib/firebase.js";

const DEFAULT_SETTINGS = { startingChips: 1000, sb: 10, bb: 20, maxPlayers: 9 };

// Strip deck and other players' hole cards; include all hole cards at showdown
function makePublicState(fullState) {
  const isShowdown = fullState.street === "showdown" && !fullState.uncontested;
  const playerStates = {};
  for (const [id, ps] of Object.entries(fullState.playerStates)) {
    playerStates[id] = {
      chips: ps.chips,
      bet: ps.bet,
      totalBet: ps.totalBet,
      status: ps.status,
      hasActed: ps.hasActed,
      holeCardCount: ps.holeCards?.length ?? 0,
      ...(isShowdown && ps.holeCards?.length > 0 ? { holeCards: ps.holeCards } : {}),
    };
  }
  return {
    street: fullState.street,
    dealerIndex: fullState.dealerIndex,
    communityCards: fullState.communityCards,
    pots: fullState.pots,
    currentPlayerIndex: fullState.currentPlayerIndex,
    currentBet: fullState.currentBet,
    minRaise: fullState.minRaise,
    playerStates,
    lastAggressor: fullState.lastAggressor,
    winners: fullState.winners,
    handResults: fullState.handResults ?? {},
    uncontested: fullState.uncontested ?? false,
    settings: fullState.settings,
    players: fullState.players,
  };
}

function formatAction(playerId, action, state) {
  const name = state.players.find((p) => p.id === playerId)?.displayName ?? playerId;
  switch (action.type) {
    case "fold":   return `${name}: フォールド`;
    case "check":  return `${name}: チェック`;
    case "call":   return `${name}: コール`;
    case "raise":  return `${name}: レイズ ${action.amount}`;
    case "all_in": return `${name}: オールイン`;
    default:       return `${name}: ${action.type}`;
  }
}

export function useRoom(myPlayerId, myName) {
  const [roomId, setRoomId] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [mode, setMode] = useState(null); // "firestore" | "webrtc"
  const [waitingPlayers, setWaitingPlayers] = useState([]);
  const [gameState, setGameState] = useState(null);
  const [myCards, setMyCards] = useState([]);
  const [log, setLog] = useState([]);
  const [gameEnded, setGameEnded] = useState(false);
  const [pendingPlayers, setPendingPlayers] = useState([]); // ゲーム中に参加した観戦者

  const transportRef = useRef(null);
  const engineRef = useRef(null);
  // Stable ref for myPlayerId to avoid stale closures in long-lived callbacks
  const myPlayerIdRef = useRef(myPlayerId);
  useEffect(() => { myPlayerIdRef.current = myPlayerId; }, [myPlayerId]);

  const addLog = useCallback((msg) => {
    setLog((prev) => [{ msg, ts: Date.now() }, ...prev].slice(0, 60));
  }, []);

  // Host: publish updated engine state to all and update own display
  const publishAndUpdate = useCallback(async (fullState) => {
    engineRef.current = fullState;
    const pubState = makePublicState(fullState);
    if (transportRef.current) await transportRef.current.publishState(pubState);
    setGameState(pubState);
    setMyCards(fullState.playerStates[myPlayerIdRef.current]?.holeCards ?? []);
    if (isGameOver(fullState)) setGameEnded(true);
  }, []);

  // Helper: send hole cards to all non-host players
  const distributeHoleCards = useCallback(async (fullState) => {
    for (const p of fullState.players) {
      if (p.id === myPlayerIdRef.current) continue;
      const ps = fullState.playerStates[p.id];
      if (ps.status === "eliminated") continue;
      await transportRef.current?.publishHoleCards(p.id, ps.holeCards);
    }
  }, []);

  // Host: listen for actions from participants
  useEffect(() => {
    if (!isHost || !roomId) return;
    const transport = transportRef.current;
    if (!transport) return;

    const unsub = transport.onAction(async (playerId, action) => {
      if (!engineRef.current) return;
      try {
        const newState = applyAction(engineRef.current, playerId, action);
        await publishAndUpdate(newState);
        addLog(formatAction(playerId, action, newState));
        // If a new hand auto-started (shouldn't happen here), distribute cards
      } catch (err) {
        console.error("Action processing error:", err);
      }
    });

    return unsub;
  }, [isHost, roomId, publishAndUpdate, addLog]);

  const createRoom = useCallback(async (transportMode, customSettings) => {
    const transport =
      transportMode === "firestore"
        ? new FirestoreTransport(db)
        : new WebRTCTransport();

    const settings = { ...DEFAULT_SETTINGS, ...customSettings, hostId: myPlayerIdRef.current };
    const id = await transport.createRoom(settings);

    transportRef.current = transport;
    setRoomId(id);
    setIsHost(true);
    setMode(transportMode);

    const hostPlayer = { id: myPlayerIdRef.current, displayName: myName, isHost: true };
    setWaitingPlayers([hostPlayer]);

    transport.onPlayerJoin((player) => {
      if (engineRef.current) {
        // ゲーム進行中 → 観戦者として追加し、現在の状態を送信
        setPendingPlayers((prev) =>
          prev.some((p) => p.id === player.id) ? prev : [...prev, player]
        );
        // WebRTC 向け: 現在のゲーム状態を新参加者に配信
        const pubState = makePublicState(engineRef.current);
        transport.publishState(pubState);
        addLog(`${player.displayName} が観戦参加しました`);
      } else {
        setWaitingPlayers((prev) =>
          prev.some((p) => p.id === player.id) ? prev : [...prev, player]
        );
        addLog(`${player.displayName} が参加しました`);
      }
    });
    transport.onPlayerLeave((playerId) => {
      setWaitingPlayers((prev) => prev.filter((p) => p.id !== playerId));
      setPendingPlayers((prev) => prev.filter((p) => p.id !== playerId));
      addLog(`プレイヤーが退出しました`);
    });

    return id;
  }, [myName, addLog]);

  const joinRoom = useCallback(async (targetRoomId, transportMode) => {
    const transport =
      transportMode === "firestore"
        ? new FirestoreTransport(db)
        : new WebRTCTransport();

    const player = { id: myPlayerIdRef.current, displayName: myName, isHost: false };
    await transport.joinRoom(targetRoomId, player);

    transportRef.current = transport;
    setRoomId(targetRoomId);
    setIsHost(false);
    setMode(transportMode);
    setWaitingPlayers([player]);

    transport.onStateChange((state) => {
      setGameState(state);
      setGameEnded(isGameOver({ players: state.players, playerStates: state.playerStates }));
    });
    transport.onHoleCards((cards) => setMyCards(cards));
    transport.onPlayerJoin((p) => {
      setWaitingPlayers((prev) =>
        prev.some((x) => x.id === p.id) ? prev : [...prev, p]
      );
      addLog(`${p.displayName} が参加しました`);
    });
    transport.onPlayerLeave((playerId) => {
      setWaitingPlayers((prev) => prev.filter((p) => p.id !== playerId));
    });
  }, [myName, addLog]);

  const startGame = useCallback(async (customSettings) => {
    const players = waitingPlayers.map((p) => ({ id: p.id, displayName: p.displayName }));
    const settings = { ...DEFAULT_SETTINGS, ...customSettings };

    const initial = createInitialGameState({ players, settings, dealerIndex: 0 });
    const hand = startHand(initial);

    await publishAndUpdate(hand);
    await distributeHoleCards(hand);
    addLog("--- ゲーム開始！ ---");
  }, [waitingPlayers, publishAndUpdate, distributeHoleCards, addLog]);

  const sendAction = useCallback(async (action) => {
    if (isHost) {
      const newState = applyAction(engineRef.current, myPlayerIdRef.current, action);
      await publishAndUpdate(newState);
      addLog(formatAction(myPlayerIdRef.current, action, newState));
    } else {
      await transportRef.current?.sendAction(action);
    }
  }, [isHost, publishAndUpdate, addLog]);

  const nextHand = useCallback(async () => {
    let base = engineRef.current;
    if (pendingPlayers.length > 0) {
      base = addPlayers(base, pendingPlayers);
      setPendingPlayers([]);
    }
    const advanced = advanceDealer(base);
    const hand = startHand(advanced);
    setGameEnded(false);
    await publishAndUpdate(hand);
    await distributeHoleCards(hand);
    addLog("--- 次のハンド ---");
  }, [publishAndUpdate, distributeHoleCards, addLog, pendingPlayers]);

  const leaveRoom = useCallback(async () => {
    await transportRef.current?.leaveRoom();
    transportRef.current = null;
    engineRef.current = null;
    setRoomId(null);
    setIsHost(false);
    setMode(null);
    setWaitingPlayers([]);
    setGameState(null);
    setMyCards([]);
    setLog([]);
    setGameEnded(false);
    setPendingPlayers([]);
  }, []);

  const isMyTurn = useMemo(() => {
    if (!gameState) return false;
    return gameState.players[gameState.currentPlayerIndex]?.id === myPlayerId;
  }, [gameState, myPlayerId]);

  return {
    roomId, isHost, mode, waitingPlayers, pendingPlayers,
    gameState, myCards, log, gameEnded, isMyTurn,
    createRoom, joinRoom, startGame, sendAction, nextHand, leaveRoom,
  };
}
