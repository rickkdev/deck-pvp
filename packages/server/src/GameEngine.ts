import {
  type Card,
  type ClassId,
  type GameState,
  type LastAction,
  type PlayerState,
  type TurnEvent,
  GAME_CONFIG,
  STARTER_DECKS,
} from '@deck-pvp/shared';

const CLASS_HP: Record<ClassId, number> = {
  warrior: 75,
  rogue: 65,
  mage: 60,
};

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function cloneDeck(deck: Card[]): Card[] {
  return deck.map((card, i) => ({ ...card, id: `${card.id}-${i}` }));
}

export class GameEngine {
  private games = new Map<string, GameState>();

  createGame(
    player1: { id: string; name: string; class: ClassId },
    player2: { id: string; name: string; class: ClassId },
  ): GameState {
    const gameId = crypto.randomUUID();

    const p1 = this.createPlayer(player1);
    const p2 = this.createPlayer(player2);

    const state: GameState = {
      id: gameId,
      players: [p1, p2],
      currentTurn: p1.id,
      turnPhase: 'action',
      turnNumber: 1,
      winner: null,
      lastAction: null,
      turnEvents: [],
    };

    // Draw starting hands
    this.drawCards(p1, GAME_CONFIG.CARDS_DRAWN_PER_TURN);
    this.drawCards(p2, GAME_CONFIG.CARDS_DRAWN_PER_TURN);

    this.games.set(gameId, state);
    return state;
  }

  getGame(gameId: string): GameState | undefined {
    return this.games.get(gameId);
  }

  playCard(gameId: string, playerId: string, cardId: string): GameState {
    const state = this.games.get(gameId);
    if (!state) throw new Error('Game not found');
    if (state.winner) throw new Error('Game is already over');
    if (state.currentTurn !== playerId) throw new Error('Not your turn');

    const player = this.getPlayer(state, playerId);
    const opponent = this.getOpponent(state, playerId);

    // Clear turn events on card play (they're only relevant at turn transition)
    state.turnEvents = [];

    const cardIndex = player.hand.findIndex((c) => c.id === cardId);
    if (cardIndex === -1) throw new Error('Card not in hand');

    const card = player.hand[cardIndex];
    if (player.energy < card.energyCost) throw new Error('Not enough energy');

    // Pay energy cost
    player.energy -= card.energyCost;

    // Remove card from hand
    player.hand.splice(cardIndex, 1);

    // Track totals for lastAction
    let totalDamageDealt = 0;
    let totalBlockGained = 0;

    // Resolve effects
    for (const effect of card.effects) {
      const target = effect.target === 'self' ? player : opponent;

      switch (effect.type) {
        case 'damage': {
          // Strength adds to attack card damage
          const bonus = card.type === 'attack' ? player.strength : 0;
          const totalDamage = effect.value + bonus;
          totalDamageDealt += totalDamage;
          this.applyDamage(target, totalDamage);
          break;
        }
        case 'block':
          target.block += effect.value;
          totalBlockGained += effect.value;
          break;
        case 'strength':
          target.strength += effect.value;
          break;
        case 'poison':
          target.poison += effect.value;
          break;
        case 'draw':
          this.drawCards(target, effect.value);
          break;
        case 'energy':
          target.energy += effect.value;
          break;
        case 'channel':
          if (effect.orbType) {
            target.orbs.push({ type: effect.orbType });
          }
          break;
      }
    }

    // Add to discard pile
    player.discardPile.push(card);

    // Record the action for animation
    state.lastAction = {
      playerId,
      cardName: card.name,
      cardType: card.type,
      cardClass: card.class,
      damageDealt: totalDamageDealt,
      blockGained: totalBlockGained,
    };

    // Check win condition
    this.checkWin(state);

    return state;
  }

  endTurn(gameId: string, playerId: string): GameState {
    const state = this.games.get(gameId);
    if (!state) throw new Error('Game not found');
    if (state.winner) throw new Error('Game is already over');
    if (state.currentTurn !== playerId) throw new Error('Not your turn');

    const player = this.getPlayer(state, playerId);
    const opponent = this.getOpponent(state, playerId);

    // Clear last action and turn events
    state.lastAction = null;
    const events: TurnEvent[] = [];

    // Resolve lightning orbs at end of turn (deal 3 damage to opponent)
    for (const orb of player.orbs) {
      if (orb.type === 'lightning') {
        this.applyDamage(opponent, 3);
        events.push({ type: 'lightning-orb', playerId: opponent.id, value: 3 });
      }
    }

    // Check win after lightning orb damage
    if (this.checkWin(state)) {
      state.turnEvents = events;
      return state;
    }

    // Discard remaining hand
    player.discardPile.push(...player.hand);
    player.hand = [];

    // Switch to opponent's turn
    state.currentTurn = opponent.id;
    state.turnNumber++;

    // --- Start of opponent's turn ---

    // Resolve poison at start of poisoned player's turn
    if (opponent.poison > 0) {
      const poisonDmg = opponent.poison;
      this.applyDamage(opponent, poisonDmg);
      opponent.poison--;
      events.push({ type: 'poison-tick', playerId: opponent.id, value: poisonDmg });
      if (this.checkWin(state)) {
        state.turnEvents = events;
        return state;
      }
    }

    // Reset block
    opponent.block = 0;

    // Reset energy
    opponent.energy = opponent.maxEnergy;

    // Resolve frost orbs at start of turn (give 3 block)
    for (const orb of opponent.orbs) {
      if (orb.type === 'frost') {
        opponent.block += 3;
        events.push({ type: 'frost-orb', playerId: opponent.id, value: 3 });
      }
    }

    // Track reshuffle
    if (opponent.drawPile.length === 0 && opponent.discardPile.length > 0) {
      events.push({ type: 'reshuffle', playerId: opponent.id, value: 0 });
    }

    // Draw new hand
    this.drawCards(opponent, GAME_CONFIG.CARDS_DRAWN_PER_TURN);

    state.turnEvents = events;
    return state;
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  private createPlayer(info: { id: string; name: string; class: ClassId }): PlayerState {
    const deck = STARTER_DECKS[info.class];
    if (!deck) throw new Error(`Unknown class: ${info.class}`);

    const maxHp = CLASS_HP[info.class];
    const cloned = cloneDeck(deck);

    return {
      id: info.id,
      name: info.name,
      class: info.class,
      hp: maxHp,
      maxHp,
      energy: GAME_CONFIG.ENERGY_PER_TURN,
      maxEnergy: GAME_CONFIG.ENERGY_PER_TURN,
      block: 0,
      strength: 0,
      poison: 0,
      orbs: [],
      hand: [],
      drawPile: shuffleArray(cloned),
      discardPile: [],
    };
  }

  private getPlayer(state: GameState, playerId: string): PlayerState {
    const p = state.players.find((p) => p.id === playerId);
    if (!p) throw new Error('Player not found');
    return p;
  }

  private getOpponent(state: GameState, playerId: string): PlayerState {
    const p = state.players.find((p) => p.id !== playerId);
    if (!p) throw new Error('Opponent not found');
    return p;
  }

  private applyDamage(target: PlayerState, amount: number): void {
    let remaining = amount;
    if (target.block > 0) {
      if (target.block >= remaining) {
        target.block -= remaining;
        remaining = 0;
      } else {
        remaining -= target.block;
        target.block = 0;
      }
    }
    target.hp = Math.max(0, target.hp - remaining);
  }

  private drawCards(player: PlayerState, count: number): void {
    for (let i = 0; i < count; i++) {
      if (player.hand.length >= GAME_CONFIG.MAX_HAND_SIZE) break;

      if (player.drawPile.length === 0) {
        if (player.discardPile.length === 0) break;
        player.drawPile = shuffleArray(player.discardPile);
        player.discardPile = [];
      }

      const card = player.drawPile.pop()!;
      player.hand.push(card);
    }
  }

  private checkWin(state: GameState): boolean {
    for (const player of state.players) {
      if (player.hp <= 0) {
        const winner = state.players.find((p) => p.id !== player.id)!;
        state.winner = winner.id;
        return true;
      }
    }
    return false;
  }
}
