import { useCallback, useEffect, useRef, useState } from "react";
import { Application, Graphics, Container, Text, TextStyle, Ticker } from "pixi.js";
import type { Card, ClassId, ClientGameState } from "@deck-pvp/shared";
import { playCard as emitPlayCard, endTurn as emitEndTurn } from "./socket";

// ── Constants ────────────────────────────────────────────────────────────────

const CLASS_COLORS: Record<ClassId, number> = {
  warrior: 0xdc2626,
  rogue: 0x22c55e,
  mage: 0x3b82f6,
};

const CLASS_LABELS: Record<ClassId, string> = {
  warrior: "W",
  rogue: "R",
  mage: "M",
};

const CARD_TYPE_COLORS: Record<string, string> = {
  attack: "border-red-500 bg-red-950/60",
  skill: "border-blue-500 bg-blue-950/60",
  power: "border-yellow-500 bg-yellow-950/60",
};

const CARD_TYPE_LABELS: Record<string, string> = {
  attack: "ATK",
  skill: "SKL",
  power: "PWR",
};

// ── PixiJS Battlefield ──────────────────────────────────────────────────────

function Battlefield({
  playerClass,
  opponentClass,
}: {
  playerClass: ClassId;
  opponentClass: ClassId;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const app = new Application();
    appRef.current = app;

    let destroyed = false;

    const init = async () => {
      await app.init({
        resizeTo: canvasRef.current!,
        background: 0x0a0a1a,
        antialias: true,
      });

      if (destroyed) {
        app.destroy(true);
        return;
      }

      canvasRef.current!.appendChild(app.canvas);

      const w = app.screen.width;
      const h = app.screen.height;

      // Battlefield background - subtle grid pattern
      const bg = new Graphics();
      bg.rect(0, 0, w, h).fill(0x0a0a1a);
      // Center divider line
      bg.moveTo(w / 2, 0).lineTo(w / 2, h).stroke({ width: 1, color: 0x1a1a3a });
      // Horizontal line
      bg.moveTo(0, h / 2).lineTo(w, h / 2).stroke({ width: 1, color: 0x1a1a3a });
      app.stage.addChild(bg);

      // Ground line
      const ground = new Graphics();
      ground.moveTo(0, h * 0.7).lineTo(w, h * 0.7).stroke({ width: 2, color: 0x1e1e3e });
      app.stage.addChild(ground);

      // Player character (left side)
      const playerContainer = new Container();
      playerContainer.x = w * 0.25;
      playerContainer.y = h * 0.5;
      app.stage.addChild(playerContainer);

      drawCharacter(playerContainer, playerClass, "You");

      // Opponent character (right side)
      const opponentContainer = new Container();
      opponentContainer.x = w * 0.75;
      opponentContainer.y = h * 0.5;
      app.stage.addChild(opponentContainer);

      drawCharacter(opponentContainer, opponentClass, "Foe");

      // Idle animation - gentle bob
      let time = 0;
      const ticker = new Ticker();
      ticker.add((t) => {
        time += t.deltaTime * 0.03;
        playerContainer.y = h * 0.5 + Math.sin(time) * 4;
        opponentContainer.y = h * 0.5 + Math.sin(time + Math.PI) * 4;
      });
      ticker.start();
    };

    init();

    return () => {
      destroyed = true;
      if (appRef.current) {
        appRef.current.destroy(true);
        appRef.current = null;
      }
    };
  }, [playerClass, opponentClass]);

  return <div ref={canvasRef} className="absolute inset-0" />;
}

function drawCharacter(container: Container, classId: ClassId, label: string) {
  const color = CLASS_COLORS[classId];
  const g = new Graphics();

  if (classId === "warrior") {
    // Red square
    g.rect(-30, -30, 60, 60).fill(color);
    g.rect(-30, -30, 60, 60).stroke({ width: 2, color: 0xffffff, alpha: 0.3 });
  } else if (classId === "rogue") {
    // Green triangle
    g.moveTo(0, -35).lineTo(30, 25).lineTo(-30, 25).closePath().fill(color);
    g.moveTo(0, -35).lineTo(30, 25).lineTo(-30, 25).closePath().stroke({ width: 2, color: 0xffffff, alpha: 0.3 });
  } else {
    // Blue circle
    g.circle(0, 0, 30).fill(color);
    g.circle(0, 0, 30).stroke({ width: 2, color: 0xffffff, alpha: 0.3 });
  }

  // Glow effect
  const glow = new Graphics();
  glow.circle(0, 0, 40).fill({ color, alpha: 0.15 });
  container.addChild(glow);
  container.addChild(g);

  // Class letter
  const classText = new Text({
    text: CLASS_LABELS[classId],
    style: new TextStyle({
      fontFamily: "monospace",
      fontSize: 20,
      fontWeight: "bold",
      fill: 0xffffff,
    }),
  });
  classText.anchor.set(0.5);
  container.addChild(classText);

  // Label below
  const nameText = new Text({
    text: label,
    style: new TextStyle({
      fontFamily: "sans-serif",
      fontSize: 12,
      fill: 0x888888,
    }),
  });
  nameText.anchor.set(0.5);
  nameText.y = 45;
  container.addChild(nameText);
}

// ── HP Bar Component ────────────────────────────────────────────────────────

function HpBar({ hp, maxHp }: { hp: number; maxHp: number }) {
  const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  const barColor =
    pct > 50 ? "bg-green-500" : pct > 25 ? "bg-yellow-500" : "bg-red-500";

  return (
    <div className="flex items-center gap-2">
      <div className="w-32 h-3 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
        <div
          className={`h-full ${barColor} transition-all duration-300 rounded-full`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-mono text-gray-300">
        {hp}/{maxHp}
      </span>
    </div>
  );
}

// ── Energy Pips ─────────────────────────────────────────────────────────────

function EnergyPips({ current, max }: { current: number; max: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: max }, (_, i) => (
        <div
          key={i}
          className={`w-3 h-3 rounded-full border ${
            i < current
              ? "bg-yellow-400 border-yellow-300 shadow-[0_0_4px_rgba(250,204,21,0.5)]"
              : "bg-gray-800 border-gray-600"
          }`}
        />
      ))}
      <span className="text-xs font-mono text-gray-400 ml-1">
        {current}/{max}
      </span>
    </div>
  );
}

// ── Status Effects ──────────────────────────────────────────────────────────

function StatusEffects({
  strength,
  poison,
  block,
  orbs,
}: {
  strength: number;
  poison: number;
  block: number;
  orbs: { type: string }[];
}) {
  return (
    <div className="flex items-center gap-2">
      {block > 0 && (
        <span className="flex items-center gap-0.5 text-xs">
          <span className="text-blue-400">🛡</span>
          <span className="text-blue-300 font-bold">{block}</span>
        </span>
      )}
      {strength > 0 && (
        <span className="flex items-center gap-0.5 text-xs">
          <span className="text-red-400 font-bold">STR</span>
          <span className="text-red-300 font-bold">{strength}</span>
        </span>
      )}
      {poison > 0 && (
        <span className="flex items-center gap-0.5 text-xs">
          <span className="text-green-400 font-bold">PSN</span>
          <span className="text-green-300 font-bold">{poison}</span>
        </span>
      )}
      {orbs.map((orb, i) => (
        <span
          key={i}
          className={`text-xs font-bold ${
            orb.type === "lightning" ? "text-yellow-300" : "text-cyan-300"
          }`}
        >
          {orb.type === "lightning" ? "⚡" : "❄"}
        </span>
      ))}
    </div>
  );
}

// ── Card Component ──────────────────────────────────────────────────────────

function CardInHand({
  card,
  canPlay,
  isYourTurn,
  onPlay,
}: {
  card: Card;
  canPlay: boolean;
  isYourTurn: boolean;
  onPlay: (cardId: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const playable = canPlay && isYourTurn;
  const isFree = card.energyCost === 0;

  return (
    <div
      className={`relative flex-shrink-0 w-28 transition-all duration-200 ${
        hovered ? "-translate-y-6 z-50 scale-110" : "z-10"
      } ${playable ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => playable && onPlay(card.id)}
    >
      <div
        className={`rounded-lg border-2 p-2 ${CARD_TYPE_COLORS[card.type]} ${
          isFree && playable ? "shadow-[0_0_8px_rgba(250,204,21,0.4)]" : ""
        }`}
      >
        {/* Energy cost */}
        <div className="flex justify-between items-center mb-1">
          <span className="w-5 h-5 rounded-full bg-yellow-500/80 text-[10px] font-bold text-black flex items-center justify-center">
            {card.energyCost}
          </span>
          <span className="text-[9px] text-gray-400 uppercase tracking-wider">
            {CARD_TYPE_LABELS[card.type]}
          </span>
        </div>

        {/* Card name */}
        <p className="text-xs font-bold text-white mb-1 leading-tight">
          {card.name}
        </p>

        {/* Description */}
        <p className="text-[10px] text-gray-300 leading-tight">
          {card.description}
        </p>
      </div>
    </div>
  );
}

// ── Player Info Bar ─────────────────────────────────────────────────────────

function PlayerInfoBar({
  name,
  classId,
  hp,
  maxHp,
  energy,
  maxEnergy,
  block,
  strength,
  poison,
  orbs,
  isCurrentTurn,
}: {
  name: string;
  classId: ClassId;
  hp: number;
  maxHp: number;
  energy: number;
  maxEnergy: number;
  block: number;
  strength: number;
  poison: number;
  orbs: { type: string }[];
  isCurrentTurn: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-2 rounded-lg bg-gray-900/80 backdrop-blur-sm border ${
        isCurrentTurn ? "border-amber-500/50" : "border-gray-800"
      }`}
    >
      {/* Turn indicator dot */}
      {isCurrentTurn && (
        <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
      )}

      {/* Name + Class */}
      <div className="min-w-[80px]">
        <p className="text-sm font-bold text-white">{name}</p>
        <p className="text-[10px] text-gray-400 capitalize">{classId}</p>
      </div>

      {/* HP */}
      <HpBar hp={hp} maxHp={maxHp} />

      {/* Energy */}
      <EnergyPips current={energy} max={maxEnergy} />

      {/* Status Effects */}
      <StatusEffects strength={strength} poison={poison} block={block} orbs={orbs} />
    </div>
  );
}

// ── Main GameBoard ──────────────────────────────────────────────────────────

interface GameBoardProps {
  gameState: ClientGameState;
}

export default function GameBoard({ gameState }: GameBoardProps) {
  const { you, opponent, currentTurn, turnNumber } = gameState;
  const isYourTurn = currentTurn === you.id;

  const handlePlayCard = useCallback(
    (cardId: string) => {
      if (!isYourTurn) return;
      emitPlayCard(cardId);
    },
    [isYourTurn]
  );

  const handleEndTurn = useCallback(() => {
    if (!isYourTurn) return;
    emitEndTurn();
  }, [isYourTurn]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-gray-950 select-none">
      {/* PixiJS Battlefield Canvas (bottom layer) */}
      <Battlefield playerClass={you.class} opponentClass={opponent.class} />

      {/* React HUD Overlay (top layer) */}
      <div className="absolute inset-0 flex flex-col pointer-events-none">
        {/* Top Bar - Opponent Info */}
        <div className="p-3 flex items-center justify-between pointer-events-auto">
          <PlayerInfoBar
            name="Opponent"
            classId={opponent.class}
            hp={opponent.hp}
            maxHp={opponent.maxHp}
            energy={opponent.energy}
            maxEnergy={opponent.maxEnergy}
            block={opponent.block}
            strength={opponent.strength}
            poison={opponent.poison}
            orbs={opponent.orbs}
            isCurrentTurn={currentTurn === opponent.id}
          />

          {/* Turn indicator + pile counts for opponent */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 font-mono">
              Hand: {opponent.handCount}
            </span>
            <span className="text-xs text-gray-500 font-mono">
              Draw: {opponent.drawPileCount}
            </span>
            <span className="text-xs text-gray-500 font-mono">
              Disc: {opponent.discardPileCount}
            </span>
          </div>
        </div>

        {/* Middle - Turn Number */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-600 text-xs font-mono">
              TURN {turnNumber}
            </p>
            <p
              className={`text-sm font-bold ${
                isYourTurn ? "text-green-400" : "text-yellow-400"
              }`}
            >
              {isYourTurn ? "Your Turn" : "Opponent's Turn"}
            </p>
          </div>
        </div>

        {/* Bottom Area - Player Info + Hand + Controls */}
        <div className="p-3 space-y-2">
          {/* Player Info Bar */}
          <div className="flex items-center justify-between pointer-events-auto">
            <PlayerInfoBar
              name="You"
              classId={you.class}
              hp={you.hp}
              maxHp={you.maxHp}
              energy={you.energy}
              maxEnergy={you.maxEnergy}
              block={you.block}
              strength={you.strength}
              poison={you.poison}
              orbs={you.orbs}
              isCurrentTurn={isYourTurn}
            />

            {/* Pile counts + End Turn */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 font-mono">
                Draw: {you.drawPile.length}
              </span>
              <span className="text-xs text-gray-500 font-mono">
                Disc: {you.discardPile.length}
              </span>

              <button
                onClick={handleEndTurn}
                disabled={!isYourTurn}
                className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${
                  isYourTurn
                    ? "bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/30 cursor-pointer"
                    : "bg-gray-800 text-gray-600 cursor-not-allowed"
                }`}
              >
                End Turn
              </button>
            </div>
          </div>

          {/* Hand of Cards */}
          <div className="flex items-end justify-center gap-1 pb-1 pointer-events-auto min-h-[140px]">
            {you.hand.map((card) => (
              <CardInHand
                key={card.id}
                card={card}
                canPlay={card.energyCost <= you.energy}
                isYourTurn={isYourTurn}
                onPlay={handlePlayCard}
              />
            ))}
            {you.hand.length === 0 && (
              <p className="text-gray-600 text-sm italic">No cards in hand</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
