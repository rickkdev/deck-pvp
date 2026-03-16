import express from "express";
import { createServer } from "http";
import { Server, type Socket } from "socket.io";
import {
  GAME_CONFIG,
  type ClassId,
  type ClientGameState,
  type ClientToServerEvents,
  type GameState,
  type PlayerState,
  type ServerToClientEvents,
} from "@deck-pvp/shared";
import { GameEngine } from "./GameEngine.js";

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
  };
}

function emitGameState(state: GameState): void {
  for (const player of state.players) {
    io.to(player.id).emit("game-state", sanitizeGameState(state, player.id));
  }
}

function emitGameOver(state: GameState): void {
  for (const player of state.players) {
    io.to(player.id).emit("game-over", {
      winner: state.winner!,
      state: sanitizeGameState(state, player.id),
    });
  }
}

function cleanupPlayer(socketId: string): void {
  // Remove from matchmaking queue
  if (matchmakingQueue === socketId) {
    matchmakingQueue = null;
  }

  // Remove from pending matches
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
      // Award win to the remaining player
      const winner = state.players.find((p) => p.id !== socketId);
      if (winner) {
        state.winner = winner.id;
        emitGameOver(state);
      }
    }
    playerGames.delete(socketId);
  }
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

  // ── Select Class ────────────────────────────────────────────────────────
  socket.on("select-class", (classId: ClassId) => {
    // Find the pending match for this socket
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
