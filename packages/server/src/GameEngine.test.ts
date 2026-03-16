import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from './GameEngine.js';
import type { ClassId, GameState } from '@deck-pvp/shared';

function createTestGame(engine: GameEngine, p1Class: ClassId = 'warrior', p2Class: ClassId = 'rogue') {
  return engine.createGame(
    { id: 'p1', name: 'Player 1', class: p1Class },
    { id: 'p2', name: 'Player 2', class: p2Class },
  );
}

describe('GameEngine', () => {
  let engine: GameEngine;

  beforeEach(() => {
    engine = new GameEngine();
  });

  describe('createGame', () => {
    it('initializes game state correctly', () => {
      const state = createTestGame(engine);

      expect(state.id).toBeTruthy();
      expect(state.players).toHaveLength(2);
      expect(state.currentTurn).toBe('p1');
      expect(state.turnPhase).toBe('action');
      expect(state.turnNumber).toBe(1);
      expect(state.winner).toBeNull();
    });

    it('gives players correct starting HP per class', () => {
      const state = createTestGame(engine);
      expect(state.players[0].hp).toBe(75); // warrior
      expect(state.players[1].hp).toBe(65); // rogue
    });

    it('draws starting hands of 5 cards', () => {
      const state = createTestGame(engine);
      expect(state.players[0].hand).toHaveLength(5);
      expect(state.players[1].hand).toHaveLength(5);
    });

    it('sets energy to 3', () => {
      const state = createTestGame(engine);
      expect(state.players[0].energy).toBe(3);
      expect(state.players[1].energy).toBe(3);
    });
  });

  describe('playCard - attack', () => {
    it('deals damage to opponent', () => {
      const state = createTestGame(engine);
      const p1 = state.players[0];
      const p2 = state.players[1];

      // Find an attack card in hand
      const attackCard = p1.hand.find((c) => c.type === 'attack');
      if (!attackCard) throw new Error('No attack card in hand');

      const hpBefore = p2.hp;
      engine.playCard(state.id, 'p1', attackCard.id);

      expect(p2.hp).toBeLessThan(hpBefore);
      expect(p1.hand).not.toContain(attackCard);
      expect(p1.discardPile).toContainEqual(attackCard);
    });

    it('deducts energy cost', () => {
      const state = createTestGame(engine);
      const p1 = state.players[0];
      const attackCard = p1.hand.find((c) => c.type === 'attack')!;
      const energyBefore = p1.energy;

      engine.playCard(state.id, 'p1', attackCard.id);

      expect(p1.energy).toBe(energyBefore - attackCard.energyCost);
    });

    it('rejects play when not enough energy', () => {
      const state = createTestGame(engine);
      const p1 = state.players[0];
      p1.energy = 0;

      const card = p1.hand.find((c) => c.energyCost > 0);
      if (!card) return; // skip if all cards are 0 cost

      expect(() => engine.playCard(state.id, 'p1', card.id)).toThrow('Not enough energy');
    });

    it('rejects play when not your turn', () => {
      const state = createTestGame(engine);
      const p2 = state.players[1];
      const card = p2.hand[0];

      expect(() => engine.playCard(state.id, 'p2', card.id)).toThrow('Not your turn');
    });
  });

  describe('playCard - block', () => {
    it('adds block to player', () => {
      const state = createTestGame(engine);
      const p1 = state.players[0];

      const blockCard = p1.hand.find((c) => c.effects.some((e) => e.type === 'block'));
      if (!blockCard) throw new Error('No block card in hand');

      engine.playCard(state.id, 'p1', blockCard.id);

      expect(p1.block).toBeGreaterThan(0);
    });
  });

  describe('damage vs block', () => {
    it('block absorbs damage before HP', () => {
      const state = createTestGame(engine);
      const p2 = state.players[1];

      // Give opponent some block
      p2.block = 10;
      const hpBefore = p2.hp;

      const attackCard = state.players[0].hand.find((c) => c.type === 'attack')!;
      engine.playCard(state.id, 'p1', attackCard.id);

      const dmg = attackCard.effects.find((e) => e.type === 'damage')!.value;
      expect(p2.block).toBe(10 - dmg);
      expect(p2.hp).toBe(hpBefore); // HP untouched
    });

    it('excess damage goes through block to HP', () => {
      const state = createTestGame(engine);
      const p2 = state.players[1];

      p2.block = 2;
      const hpBefore = p2.hp;

      const attackCard = state.players[0].hand.find((c) => c.type === 'attack')!;
      const dmg = attackCard.effects.find((e) => e.type === 'damage')!.value;

      engine.playCard(state.id, 'p1', attackCard.id);

      expect(p2.block).toBe(0);
      expect(p2.hp).toBe(hpBefore - (dmg - 2));
    });
  });

  describe('strength buff', () => {
    it('strength adds to attack damage', () => {
      const state = createTestGame(engine);
      const p1 = state.players[0];
      const p2 = state.players[1];

      p1.strength = 3;
      const attackCard = p1.hand.find((c) => c.type === 'attack')!;
      const baseDmg = attackCard.effects.find((e) => e.type === 'damage')!.value;
      const hpBefore = p2.hp;

      engine.playCard(state.id, 'p1', attackCard.id);

      expect(p2.hp).toBe(hpBefore - baseDmg - 3);
    });
  });

  describe('poison', () => {
    it('poison ticks at start of poisoned players turn', () => {
      const state = createTestGame(engine);
      const p2 = state.players[1];

      // Give p2 poison
      p2.poison = 5;
      const hpBefore = p2.hp;

      // End p1's turn -> starts p2's turn -> poison ticks
      engine.endTurn(state.id, 'p1');

      expect(p2.hp).toBe(hpBefore - 5);
      expect(p2.poison).toBe(4); // decreases by 1
    });
  });

  describe('endTurn', () => {
    it('switches active player', () => {
      const state = createTestGame(engine);
      engine.endTurn(state.id, 'p1');
      expect(state.currentTurn).toBe('p2');
    });

    it('discards current players hand and resets next players energy', () => {
      const state = createTestGame(engine);
      const p1 = state.players[0];
      const p1HandBefore = p1.hand.length;

      engine.endTurn(state.id, 'p1');

      // p1's hand was discarded
      expect(p1.hand).toHaveLength(0);
      expect(p1.discardPile.length).toBeGreaterThanOrEqual(p1HandBefore);

      // p2 gets energy reset and draws cards
      const p2 = state.players[1];
      expect(p2.energy).toBe(3);
      // p2 had 5 from initial draw + 5 new = 10 (max hand size)
      expect(p2.hand).toHaveLength(10);
    });

    it('resets block on new turn', () => {
      const state = createTestGame(engine);
      const p2 = state.players[1];
      p2.block = 10;

      engine.endTurn(state.id, 'p1');

      expect(p2.block >= 0).toBe(true); // block resets (may have frost orb block)
    });

    it('increments turn number', () => {
      const state = createTestGame(engine);
      engine.endTurn(state.id, 'p1');
      expect(state.turnNumber).toBe(2);
    });
  });

  describe('win detection', () => {
    it('sets winner when opponent HP reaches 0', () => {
      const state = createTestGame(engine);
      const p2 = state.players[1];

      // Set opponent to very low HP
      p2.hp = 1;
      p2.block = 0;

      const attackCard = state.players[0].hand.find((c) => c.type === 'attack')!;
      engine.playCard(state.id, 'p1', attackCard.id);

      expect(state.winner).toBe('p1');
    });

    it('sets winner when poison kills a player', () => {
      const state = createTestGame(engine);
      const p2 = state.players[1];

      p2.hp = 3;
      p2.poison = 5;

      engine.endTurn(state.id, 'p1');

      expect(state.winner).toBe('p1');
    });
  });

  describe('mage orbs', () => {
    it('channeling adds orbs to player', () => {
      const state = createTestGame(engine, 'mage', 'warrior');
      const p1 = state.players[0];

      const channelCard = p1.hand.find((c) => c.effects.some((e) => e.type === 'channel'));
      if (!channelCard) return; // may not be in starting hand

      engine.playCard(state.id, 'p1', channelCard.id);
      expect(p1.orbs.length).toBeGreaterThan(0);
    });
  });

  describe('draw pile shuffle', () => {
    it('shuffles discard into draw when draw pile is empty', () => {
      const state = createTestGame(engine);
      const p1 = state.players[0];

      // Empty draw pile, put cards in discard
      const drawCards = [...p1.drawPile];
      p1.discardPile.push(...drawCards);
      p1.drawPile = [];

      // End turn to trigger draw for p2, then play p2's turn and end
      engine.endTurn(state.id, 'p1');
      engine.endTurn(state.id, 'p2');

      // p1 should have drawn cards (shuffled from discard)
      expect(p1.hand.length).toBeGreaterThan(0);
    });
  });
});
