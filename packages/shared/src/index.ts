// Shared types and constants for DeckPVP
export * from './types.js';

export const GAME_CONFIG = {
  HP: 70,
  ENERGY_PER_TURN: 3,
  CARDS_DRAWN_PER_TURN: 5,
  MAX_HAND_SIZE: 10,
  STARTING_DECK_SIZE: 10,
  BLOCK_RESETS_EACH_TURN: true,
} as const;
