import type { Card } from './types.js';

// ── Warrior Starter Deck ────────────────────────────────────────────────────

const warriorStrike: Card = {
  id: 'warrior-strike',
  name: 'Strike',
  description: 'Deal 6 damage.',
  type: 'attack',
  energyCost: 1,
  effects: [{ type: 'damage', value: 6, target: 'opponent' }],
  class: 'warrior',
  rarity: 'common',
};

const warriorDefend: Card = {
  id: 'warrior-defend',
  name: 'Defend',
  description: 'Gain 5 block.',
  type: 'skill',
  energyCost: 1,
  effects: [{ type: 'block', value: 5, target: 'self' }],
  class: 'warrior',
  rarity: 'common',
};

const warriorBash: Card = {
  id: 'warrior-bash',
  name: 'Bash',
  description: 'Deal 8 damage. Gain 2 strength.',
  type: 'attack',
  energyCost: 2,
  effects: [
    { type: 'damage', value: 8, target: 'opponent' },
    { type: 'strength', value: 2, target: 'self' },
  ],
  class: 'warrior',
  rarity: 'uncommon',
};

export const WARRIOR_STARTER_DECK: Card[] = [
  warriorStrike,
  warriorStrike,
  warriorStrike,
  warriorStrike,
  warriorStrike,
  warriorDefend,
  warriorDefend,
  warriorDefend,
  warriorDefend,
  warriorBash,
];

// ── Rogue Starter Deck ──────────────────────────────────────────────────────

const rogueShivStrike: Card = {
  id: 'rogue-shiv-strike',
  name: 'Shiv Strike',
  description: 'Deal 4 damage.',
  type: 'attack',
  energyCost: 1,
  effects: [{ type: 'damage', value: 4, target: 'opponent' }],
  class: 'rogue',
  rarity: 'common',
};

const rogueDefend: Card = {
  id: 'rogue-defend',
  name: 'Defend',
  description: 'Gain 5 block.',
  type: 'skill',
  energyCost: 1,
  effects: [{ type: 'block', value: 5, target: 'self' }],
  class: 'rogue',
  rarity: 'common',
};

const roguePoisonBlade: Card = {
  id: 'rogue-poison-blade',
  name: 'Poison Blade',
  description: 'Deal 3 damage. Apply 3 poison.',
  type: 'attack',
  energyCost: 1,
  effects: [
    { type: 'damage', value: 3, target: 'opponent' },
    { type: 'poison', value: 3, target: 'opponent' },
  ],
  class: 'rogue',
  rarity: 'uncommon',
};

const rogueDodge: Card = {
  id: 'rogue-dodge',
  name: 'Dodge',
  description: 'Gain 7 block. Draw 1 card.',
  type: 'skill',
  energyCost: 1,
  effects: [
    { type: 'block', value: 7, target: 'self' },
    { type: 'draw', value: 1, target: 'self' },
  ],
  class: 'rogue',
  rarity: 'uncommon',
};

export const ROGUE_STARTER_DECK: Card[] = [
  rogueShivStrike,
  rogueShivStrike,
  rogueShivStrike,
  rogueShivStrike,
  rogueShivStrike,
  rogueDefend,
  rogueDefend,
  rogueDefend,
  roguePoisonBlade,
  rogueDodge,
];

// ── Mage Starter Deck ───────────────────────────────────────────────────────

const mageArcaneBolt: Card = {
  id: 'mage-arcane-bolt',
  name: 'Arcane Bolt',
  description: 'Deal 5 damage.',
  type: 'attack',
  energyCost: 1,
  effects: [{ type: 'damage', value: 5, target: 'opponent' }],
  class: 'mage',
  rarity: 'common',
};

const mageBarrier: Card = {
  id: 'mage-barrier',
  name: 'Barrier',
  description: 'Gain 6 block.',
  type: 'skill',
  energyCost: 1,
  effects: [{ type: 'block', value: 6, target: 'self' }],
  class: 'mage',
  rarity: 'common',
};

const mageChannelLightning: Card = {
  id: 'mage-channel-lightning',
  name: 'Channel Lightning',
  description: 'Channel a lightning orb. (Deals 3 damage at end of turn.)',
  type: 'power',
  energyCost: 1,
  effects: [{ type: 'channel', value: 1, target: 'self', orbType: 'lightning' }],
  class: 'mage',
  rarity: 'uncommon',
};

const mageFrostShield: Card = {
  id: 'mage-frost-shield',
  name: 'Frost Shield',
  description: 'Channel a frost orb. Gain 3 block. (Frost orb gives 3 block at start of turn.)',
  type: 'power',
  energyCost: 1,
  effects: [
    { type: 'channel', value: 1, target: 'self', orbType: 'frost' },
    { type: 'block', value: 3, target: 'self' },
  ],
  class: 'mage',
  rarity: 'uncommon',
};

const mageSurge: Card = {
  id: 'mage-surge',
  name: 'Surge',
  description: 'Gain 1 energy this turn.',
  type: 'skill',
  energyCost: 0,
  effects: [{ type: 'energy', value: 1, target: 'self' }],
  class: 'mage',
  rarity: 'uncommon',
};

export const MAGE_STARTER_DECK: Card[] = [
  mageArcaneBolt,
  mageArcaneBolt,
  mageArcaneBolt,
  mageArcaneBolt,
  mageBarrier,
  mageBarrier,
  mageBarrier,
  mageChannelLightning,
  mageFrostShield,
  mageSurge,
];

// ── Utilities ────────────────────────────────────────────────────────────────

export const STARTER_DECKS: Record<string, Card[]> = {
  warrior: WARRIOR_STARTER_DECK,
  rogue: ROGUE_STARTER_DECK,
  mage: MAGE_STARTER_DECK,
};

export const ALL_CARDS: Card[] = [
  warriorStrike,
  warriorDefend,
  warriorBash,
  rogueShivStrike,
  rogueDefend,
  roguePoisonBlade,
  rogueDodge,
  mageArcaneBolt,
  mageBarrier,
  mageChannelLightning,
  mageFrostShield,
  mageSurge,
];
