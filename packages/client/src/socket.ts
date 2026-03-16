import { io, type Socket } from "socket.io-client";
import type {
  ClassId,
  ClientGameState,
  ClientToServerEvents,
  GameStats,
  ServerToClientEvents,
} from "@deck-pvp/shared";

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SERVER_URL = "http://localhost:3001";

let socket: TypedSocket | null = null;

/** Get or create the socket connection */
export function getSocket(): TypedSocket {
  if (!socket) {
    socket = io(SERVER_URL, {
      autoConnect: false,
    });
  }
  return socket;
}

/** Connect to the server */
export function connect(): TypedSocket {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
  return s;
}

/** Disconnect from the server */
export function disconnect(): void {
  if (socket) {
    socket.disconnect();
  }
}

/** Enter the matchmaking queue */
export function findMatch(): void {
  getSocket().emit("find-match");
}

/** Select a class for the current match */
export function selectClass(classId: ClassId): void {
  getSocket().emit("select-class", classId);
}

/** Play a card from hand */
export function playCard(cardId: string): void {
  getSocket().emit("play-card", cardId);
}

/** End the current turn */
export function endTurn(): void {
  getSocket().emit("end-turn");
}

// ── Event listeners ─────────────────────────────────────────────────────────

export function onMatchFound(callback: (data: { gameId: string }) => void): () => void {
  const s = getSocket();
  s.on("match-found", callback);
  return () => { s.off("match-found", callback); };
}

export function onGameState(callback: (state: ClientGameState) => void): () => void {
  const s = getSocket();
  s.on("game-state", callback);
  return () => { s.off("game-state", callback); };
}

export function onGameOver(callback: (data: { winner: string; state: ClientGameState; stats: { you: GameStats; opponent: GameStats }; disconnected?: boolean }) => void): () => void {
  const s = getSocket();
  s.on("game-over", callback);
  return () => { s.off("game-over", callback); };
}

export function onError(callback: (data: { message: string }) => void): () => void {
  const s = getSocket();
  s.on("error", callback);
  return () => { s.off("error", callback); };
}

export function onWaitingForOpponent(callback: () => void): () => void {
  const s = getSocket();
  s.on("waiting-for-opponent", callback);
  return () => { s.off("waiting-for-opponent", callback); };
}
