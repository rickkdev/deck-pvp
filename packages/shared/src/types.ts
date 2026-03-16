// ── Card Types ──────────────────────────────────────────────────────────────

export type CardType = 'attack' | 'skill' | 'power';

export type EffectType = 'damage' | 'block' | 'strength' | 'poison' | 'draw' | 'energy';

export type EffectTarget = 'self' | 'opponent';

export type CardRarity = 'common' | 'uncommon' | 'rare';

export type ClassId = 'warrior' | 'rogue' | 'mage';

export interface Effect {
  type: EffectType;
  value: number;
  target: EffectTarget;
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

// ── Player & Game State ─────────────────────────────────────────────────────

export type TurnPhase = 'draw' | 'action' | 'end' | 'waiting';

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
}
