import express from "express";
import { createServer } from "http";
import { Server, type Socket } from "socket.io";
import {
  GAME_CONFIG,
  type ClassId,
  type ClientGameState,
  type ClientToServerEvents,
  type GameStats,
  type GameState,
  type PlayerState,
  type ServerToClientEvents,
} from "@deck-pvp/shared";
import { GameEngine } from "./GameEngine.js";
import { pickRandomClass, runAITurn } from "./AIPlayer.js";

const app = express();
const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

const PORT = 3001;
const engine = new GameEngine();

// ── Matchmaking state ───────────────────────────────────────────────────────

/** Socket id of a player waiting for a match */
let matchmakingQueue: string | null = null;

/** Pending matches waiting for both players to select a class */
interface PendingMatch {
  gameId: string;
  players: {
    socketId: string;
    class: ClassId | null;
  }[];
}

const pendingMatches = new Map<string, PendingMatch>();

/** Map from socket id → active game id */
const playerGames = new Map<string, string>();

/** Set of game IDs that are AI games (key = gameId, value = AI player id) */
const aiGames = new Map<string, string>();

/** Pending AI matches waiting for the human to select a class */
const pendingAIMatches = new Map<string, string>(); // socketId → matchId

// ── Helpers ─────────────────────────────────────────────────────────────────

function sanitizeGameState(state: GameState, playerId: string): ClientGameState {
  const you = state.players.find((p) => p.id === playerId)!;
  const opp = state.players.find((p) => p.id !== playerId)!;

  return {
    id: state.id,
    you,
    opponent: {
      id: opp.id,
      name: opp.name,
      class: opp.class,
      hp: opp.hp,
      maxHp: opp.maxHp,
      energy: opp.energy,
      maxEnergy: opp.maxEnergy,
      block: opp.block,
      strength: opp.strength,
      poison: opp.poison,
      orbs: opp.orbs,
      handCount: opp.hand.length,
      drawPileCount: opp.drawPile.length,
      discardPileCount: opp.discardPile.length,
    },
    currentTurn: state.currentTurn,
    turnPhase: state.turnPhase,
    turnNumber: state.turnNumber,
    winner: state.winner,
    lastAction: state.lastAction,
    turnEvents: state.turnEvents,
  };
}

function emitGameState(state: GameState): void {
  const aiPlayerId = aiGames.get(state.id);
  for (const player of state.players) {
    // Don't emit to AI — it has no socket
    if (player.id === aiPlayerId) continue;
    io.to(player.id).emit("game-state", sanitizeGameState(state, player.id));
  }
}

function emitGameOver(state: GameState, disconnected?: boolean): void {
  const statsMap = engine.getStats(state.id);
  const defaultStats: GameStats = { damageDealt: 0, cardsPlayed: 0, turnsTaken: 0 };
  const aiPlayerId = aiGames.get(state.id);

  for (const player of state.players) {
    // Don't emit to AI — it has no socket
    if (player.id === aiPlayerId) continue;
    const opp = state.players.find((p) => p.id !== player.id)!;
    io.to(player.id).emit("game-over", {
      winner: state.winner!,
      state: sanitizeGameState(state, player.id),
      stats: {
        you: statsMap?.get(player.id) ?? defaultStats,
        opponent: statsMap?.get(opp.id) ?? defaultStats,
      },
      ...(disconnected ? { disconnected: true } : {}),
    });
  }

  // Clean up AI game tracking
  if (aiPlayerId) {
    aiGames.delete(state.id);
  }
}

function cleanupPlayer(socketId: string): void {
  // Remove from matchmaking queue
  if (matchmakingQueue === socketId) {
    matchmakingQueue = null;
  }

  // Remove from pending AI matches
  pendingAIMatches.delete(socketId);

  // Remove from pending PvP matches
  for (const [matchId, match] of pendingMatches) {
    if (match.players.some((p) => p.socketId === socketId)) {
      const opponent = match.players.find((p) => p.socketId !== socketId);
      if (opponent) {
        io.to(opponent.socketId).emit("error", { message: "Opponent disconnected" });
      }
      pendingMatches.delete(matchId);
    }
  }

  // Handle active game disconnect
  const gameId = playerGames.get(socketId);
  if (gameId) {
    const state = engine.getGame(gameId);
    if (state && !state.winner) {
      // For AI games, just clean up — no need to award win to AI
      if (aiGames.has(gameId)) {
        state.winner = 'disconnected';
        aiGames.delete(gameId);
      } else {
        // Award win to the remaining player
        const winner = state.players.find((p) => p.id !== socketId);
        if (winner) {
          state.winner = winner.id;
          emitGameOver(state, true);
        }
      }
    }
    playerGames.delete(socketId);
  }
}

/** If the game is an AI game and it's the AI's turn, trigger AI play */
function maybeRunAITurn(gameId: string): void {
  const aiPlayerId = aiGames.get(gameId);
  if (!aiPlayerId) return;

  const state = engine.getGame(gameId);
  if (!state || state.winner || state.currentTurn !== aiPlayerId) return;

  runAITurn(
    engine,
    gameId,
    aiPlayerId,
    (updated) => emitGameState(updated),
    (updated) => emitGameOver(updated),
  );
}

// ── Express routes ──────────────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.json({ status: "ok", config: GAME_CONFIG });
});

// ── Socket.io handlers ──────────────────────────────────────────────────────

io.on("connection", (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
  console.log(`Player connected: ${socket.id}`);

  // ── Find Match ──────────────────────────────────────────────────────────
  socket.on("find-match", () => {
    // Clean up any previous game (e.g., rematch after game over)
    playerGames.delete(socket.id);

    if (matchmakingQueue === null) {
      matchmakingQueue = socket.id;
      socket.emit("waiting-for-opponent");
      console.log(`Player ${socket.id} entered matchmaking queue`);
    } else if (matchmakingQueue !== socket.id) {
      const opponentId = matchmakingQueue;
      matchmakingQueue = null;

      const matchId = crypto.randomUUID();
      const pending: PendingMatch = {
        gameId: matchId,
        players: [
          { socketId: opponentId, class: null },
          { socketId: socket.id, class: null },
        ],
      };
      pendingMatches.set(matchId, pending);

      io.to(opponentId).emit("match-found", { gameId: matchId });
      socket.emit("match-found", { gameId: matchId });
      console.log(`Match found: ${opponentId} vs ${socket.id} (${matchId})`);
    }
  });

  // ── Play vs AI ─────────────────────────────────────────────────────────
  socket.on("play-vs-ai", () => {
    // Clean up any previous game
    playerGames.delete(socket.id);

    const matchId = crypto.randomUUID();
    pendingAIMatches.set(socket.id, matchId);

    // Go straight to class selection (no matchmaking wait)
    socket.emit("match-found", { gameId: matchId });
    console.log(`AI match created for ${socket.id} (${matchId})`);
  });

  // ── Select Class ────────────────────────────────────────────────────────
  socket.on("select-class", (classId: ClassId) => {
    // Check if this is an AI match first
    const aiMatchId = pendingAIMatches.get(socket.id);
    if (aiMatchId) {
      pendingAIMatches.delete(socket.id);

      const aiId = `ai-${crypto.randomUUID()}`;
      const aiClass = pickRandomClass();

      const state = engine.createGame(
        { id: socket.id, name: "Player 1", class: classId },
        { id: aiId, name: "AI Opponent", class: aiClass },
      );

      playerGames.set(socket.id, state.id);
      aiGames.set(state.id, aiId);

      emitGameState(state);
      console.log(`AI game started: ${state.id} (AI class: ${aiClass})`);

      // If AI goes first (it won't since player1 always starts), trigger AI turn
      maybeRunAITurn(state.id);
      return;
    }

    // Find the pending PvP match for this socket
    let found: PendingMatch | null = null;
    for (const match of pendingMatches.values()) {
      if (match.players.some((p) => p.socketId === socket.id)) {
        found = match;
        break;
      }
    }

    if (!found) {
      socket.emit("error", { message: "No pending match found" });
      return;
    }

    // Set this player's class
    const player = found.players.find((p) => p.socketId === socket.id)!;
    player.class = classId;

    // Check if both players have selected
    if (found.players.every((p) => p.class !== null)) {
      // Both ready — create the game
      const p1 = found.players[0];
      const p2 = found.players[1];

      const state = engine.createGame(
        { id: p1.socketId, name: `Player 1`, class: p1.class! },
        { id: p2.socketId, name: `Player 2`, class: p2.class! },
      );

      // Track active game for both players
      playerGames.set(p1.socketId, state.id);
      playerGames.set(p2.socketId, state.id);

      pendingMatches.delete(found.gameId);

      // Send initial game state to both
      emitGameState(state);
      console.log(`Game started: ${state.id}`);
    } else {
      // Waiting for opponent to select
      socket.emit("waiting-for-opponent");
    }
  });

  // ── Play Card ───────────────────────────────────────────────────────────
  socket.on("play-card", (cardId: string) => {
    const gameId = playerGames.get(socket.id);
    if (!gameId) {
      socket.emit("error", { message: "Not in a game" });
      return;
    }

    try {
      const state = engine.playCard(gameId, socket.id, cardId);
      emitGameState(state);

      if (state.winner) {
        emitGameOver(state);
      }
    } catch (err) {
      socket.emit("error", { message: (err as Error).message });
    }
  });

  // ── End Turn ────────────────────────────────────────────────────────────
  socket.on("end-turn", () => {
    const gameId = playerGames.get(socket.id);
    if (!gameId) {
      socket.emit("error", { message: "Not in a game" });
      return;
    }

    try {
      const state = engine.endTurn(gameId, socket.id);
      emitGameState(state);

      if (state.winner) {
        emitGameOver(state);
      } else {
        // Trigger AI turn if this is an AI game
        maybeRunAITurn(gameId);
      }
    } catch (err) {
      socket.emit("error", { message: (err as Error).message });
    }
  });

  // ── Disconnect ──────────────────────────────────────────────────────────
  socket.on("disconnect", () => {
    console.log(`Player disconnected: ${socket.id}`);
    cleanupPlayer(socket.id);
  });
});

httpServer.listen(PORT, () => {
  console.log(`DeckPVP server running on http://localhost:${PORT}`);
});
