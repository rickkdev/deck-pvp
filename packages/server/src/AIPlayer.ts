import type { Card, ClassId, GameState } from '@deck-pvp/shared';
import { GameEngine } from './GameEngine.js';

const AI_CLASSES: ClassId[] = ['warrior', 'rogue', 'mage'];

/** Pick a random class for the AI */
export function pickRandomClass(): ClassId {
  return AI_CLASSES[Math.floor(Math.random() * AI_CLASSES.length)];
}

/**
 * Simple AI strategy:
 * - Play highest damage attack if opponent has no block
 * - Play block cards if HP < 50%
 * - Otherwise play random playable card
 * - End turn after playing all playable cards or running out of energy
 */
export function getAICardToPlay(state: GameState, aiPlayerId: string): Card | null {
  const ai = state.players.find((p) => p.id === aiPlayerId);
  if (!ai) return null;
  const opponent = state.players.find((p) => p.id !== aiPlayerId);
  if (!opponent) return null;

  const playable = ai.hand.filter((c) => c.energyCost <= ai.energy);
  if (playable.length === 0) return null;

  // If opponent has no block, play highest damage attack card
  if (opponent.block === 0) {
    const attacks = playable.filter((c) => c.type === 'attack');
    if (attacks.length > 0) {
      attacks.sort((a, b) => getTotalDamage(b, ai.strength) - getTotalDamage(a, ai.strength));
      return attacks[0];
    }
  }

  // If HP < 50%, prioritize block cards
  if (ai.hp < ai.maxHp * 0.5) {
    const blockCards = playable.filter((c) =>
      c.effects.some((e) => e.type === 'block'),
    );
    if (blockCards.length > 0) {
      return blockCards[0];
    }
  }

  // Otherwise play a random playable card
  return playable[Math.floor(Math.random() * playable.length)];
}

function getTotalDamage(card: Card, strength: number): number {
  let total = 0;
  for (const effect of card.effects) {
    if (effect.type === 'damage') {
      total += effect.value + (card.type === 'attack' ? strength : 0);
    }
  }
  return total;
}

/**
 * Run the AI's full turn asynchronously with delays between card plays.
 * Calls onStateUpdate after each action so the client sees real-time updates.
 */
export async function runAITurn(
  engine: GameEngine,
  gameId: string,
  aiPlayerId: string,
  onStateUpdate: (state: GameState) => void,
  onGameOver: (state: GameState) => void,
): Promise<void> {
  const AI_DELAY = 500; // ms between card plays

  const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  // Play cards one at a time with delays
  while (true) {
    const state = engine.getGame(gameId);
    if (!state || state.winner || state.currentTurn !== aiPlayerId) return;

    const card = getAICardToPlay(state, aiPlayerId);
    if (!card) break;

    await delay(AI_DELAY);

    // Re-check state in case something changed during delay
    const current = engine.getGame(gameId);
    if (!current || current.winner || current.currentTurn !== aiPlayerId) return;

    try {
      const updated = engine.playCard(gameId, aiPlayerId, card.id);
      onStateUpdate(updated);

      if (updated.winner) {
        onGameOver(updated);
        return;
      }
    } catch {
      // Card may no longer be valid, skip it
      break;
    }
  }

  // End turn
  await delay(AI_DELAY);

  const state = engine.getGame(gameId);
  if (!state || state.winner || state.currentTurn !== aiPlayerId) return;

  try {
    const updated = engine.endTurn(gameId, aiPlayerId);
    onStateUpdate(updated);

    if (updated.winner) {
      onGameOver(updated);
      return;
    }

    // After ending turn, it's now the human's turn — nothing more to do
  } catch {
    // Turn may have already ended
  }
}
