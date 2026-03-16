// ── Card Types ──────────────────────────────────────────────────────────────

export type CardType = 'attack' | 'skill' | 'power';

export type EffectType = 'damage' | 'block' | 'strength' | 'poison' | 'draw' | 'energy' | 'channel';

export type OrbType = 'lightning' | 'frost';

export type EffectTarget = 'self' | 'opponent';

export type CardRarity = 'common' | 'uncommon' | 'rare';

export type ClassId = 'warrior' | 'rogue' | 'mage';

export interface Effect {
  type: EffectType;
  value: number;
  target: EffectTarget;
  orbType?: OrbType;
}

export interface Card {
  id: string;
  name: string;
  description: string;
  type: CardType;
  energyCost: number;
  effects: Effect[];
  class: ClassId;
  rarity: CardRarity;
}

// ── Action Tracking ─────────────────────────────────────────────────────────

export interface LastAction {
  playerId: string;
  cardName: string;
  cardType: CardType;
  cardClass: ClassId;
  damageDealt: number;
  blockGained: number;
}

// ── Turn Events ─────────────────────────────────────────────────────────────

export type TurnEventType = 'poison-tick' | 'lightning-orb' | 'frost-orb' | 'reshuffle';

export interface TurnEvent {
  type: TurnEventType;
  playerId: string;
  value: number; // damage dealt, block gained, or 0 for reshuffle
}

// ── Player & Game State ─────────────────────────────────────────────────────

export type TurnPhase = 'draw' | 'action' | 'end' | 'waiting';

export interface Orb {
  type: OrbType;
}

export interface PlayerState {
  id: string;
  name: string;
  class: ClassId;
  hp: number;
  maxHp: number;
  energy: number;
  maxEnergy: number;
  block: number;
  strength: number;
  poison: number;
  orbs: Orb[];
  hand: Card[];
  drawPile: Card[];
  discardPile: Card[];
}

export interface GameState {
  id: string;
  players: [PlayerState, PlayerState];
  currentTurn: string; // player id of the active player
  turnPhase: TurnPhase;
  turnNumber: number;
  winner: string | null; // player id of the winner, null if game ongoing
  lastAction: LastAction | null;
  turnEvents: TurnEvent[];
}

// ── Game Stats ──────────────────────────────────────────────────────────────

export interface GameStats {
  damageDealt: number;
  cardsPlayed: number;
  turnsTaken: number;
}

// ── Socket Event Types ──────────────────────────────────────────────────────

/** Game state sanitized for a specific player (opponent hand hidden) */
export interface ClientGameState {
  id: string;
  you: PlayerState;
  opponent: {
    id: string;
    name: string;
    class: ClassId;
    hp: number;
    maxHp: number;
    energy: number;
    maxEnergy: number;
    block: number;
    strength: number;
    poison: number;
    orbs: Orb[];
    handCount: number;
    drawPileCount: number;
    discardPileCount: number;
  };
  currentTurn: string;
  turnPhase: TurnPhase;
  turnNumber: number;
  winner: string | null;
  lastAction: LastAction | null;
  turnEvents: TurnEvent[];
}

/** Events emitted from client to server */
export interface ClientToServerEvents {
  'find-match': () => void;
  'play-vs-ai': () => void;
  'select-class': (classId: ClassId) => void;
  'play-card': (cardId: string) => void;
  'end-turn': () => void;
}

/** Events emitted from server to client */
export interface ServerToClientEvents {
  'match-found': (data: { gameId: string }) => void;
  'game-state': (state: ClientGameState) => void;
  'game-over': (data: { winner: string; state: ClientGameState; stats: { you: GameStats; opponent: GameStats }; disconnected?: boolean }) => void;
  'error': (data: { message: string }) => void;
  'waiting-for-opponent': () => void;
}
