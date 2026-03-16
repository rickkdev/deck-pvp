import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Application, Graphics, Container, Text, TextStyle } from "pixi.js";
import type { Card, CardType, ClassId, ClientGameState } from "@deck-pvp/shared";
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

// ── Animation Types ──────────────────────────────────────────────────────────

interface Particle {
  gfx: Graphics;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

interface FloatingText {
  text: Text;
  vy: number;
  life: number;
  maxLife: number;
}

interface BattlefieldHandle {
  animateAttack(isPlayer: boolean, classId: ClassId, damage: number): void;
  animateBlock(isPlayer: boolean, amount: number): void;
  animateBuff(isPlayer: boolean): void;
}

// ── PixiJS Battlefield with Animations ───────────────────────────────────────

const BattlefieldCanvas = forwardRef<
  BattlefieldHandle,
  { playerClass: ClassId; opponentClass: ClassId }
>(({ playerClass, opponentClass }, ref) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const playerContainerRef = useRef<Container | null>(null);
  const opponentContainerRef = useRef<Container | null>(null);
  const particleContainerRef = useRef<Container | null>(null);
  const textContainerRef = useRef<Container | null>(null);
  const playerBasePos = useRef({ x: 0, y: 0 });
  const opponentBasePos = useRef({ x: 0, y: 0 });
  const particlesRef = useRef<Particle[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);

  // Expose animation methods
  useImperativeHandle(ref, () => ({
    animateAttack(isPlayer: boolean, classId: ClassId, damage: number) {
      const app = appRef.current;
      const attacker = isPlayer
        ? playerContainerRef.current
        : opponentContainerRef.current;
      const basePos = isPlayer
        ? playerBasePos.current
        : opponentBasePos.current;
      const targetPos = isPlayer
        ? opponentBasePos.current
        : playerBasePos.current;

      if (!app || !attacker) return;

      const color = CLASS_COLORS[classId];

      // Phase 1: Lunge toward target (200ms)
      const lungeX = basePos.x + (targetPos.x - basePos.x) * 0.7;
      const startX = attacker.x;
      let elapsed = 0;

      const lunge = () => {
        elapsed += app.ticker.deltaMS;
        const progress = Math.min(1, elapsed / 200);
        const eased = 1 - Math.pow(1 - progress, 2); // ease-out
        attacker.x = startX + (lungeX - startX) * eased;

        if (progress >= 1) {
          app.ticker.remove(lunge);

          // Phase 2: Impact - particles + damage number
          spawnBurstParticles(targetPos.x, targetPos.y, color, 20);
          if (damage > 0) {
            spawnFloatingText(
              targetPos.x,
              targetPos.y - 40,
              `-${damage}`,
              0xff4444,
            );
          }

          // Phase 3: Return (200ms)
          let returnElapsed = 0;
          const currentX = attacker.x;
          const returnAnim = () => {
            returnElapsed += app.ticker.deltaMS;
            const p = Math.min(1, returnElapsed / 200);
            const e = p * p; // ease-in
            attacker.x = currentX + (basePos.x - currentX) * e;
            if (p >= 1) {
              attacker.x = basePos.x;
              app.ticker.remove(returnAnim);
            }
          };
          app.ticker.add(returnAnim);
        }
      };
      app.ticker.add(lunge);
    },

    animateBlock(isPlayer: boolean, amount: number) {
      const basePos = isPlayer
        ? playerBasePos.current
        : opponentBasePos.current;

      // Shield shimmer particles
      spawnShieldParticles(basePos.x, basePos.y, 15);
      if (amount > 0) {
        spawnFloatingText(
          basePos.x,
          basePos.y - 40,
          `+${amount}`,
          0x60a5fa,
        );
      }
    },

    animateBuff(isPlayer: boolean) {
      const basePos = isPlayer
        ? playerBasePos.current
        : opponentBasePos.current;

      // Rising golden particles
      spawnRiseParticles(basePos.x, basePos.y, 0xfbbf24, 15);
    },
  }));

  // Particle spawn helpers
  function spawnBurstParticles(
    x: number,
    y: number,
    color: number,
    count: number,
  ) {
    const container = particleContainerRef.current;
    if (!container) return;

    for (let i = 0; i < count; i++) {
      const gfx = new Graphics();
      const size = 2 + Math.random() * 4;
      gfx.circle(0, 0, size).fill({ color, alpha: 0.9 });
      gfx.x = x;
      gfx.y = y;
      container.addChild(gfx);

      const angle =
        (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const speed = 2 + Math.random() * 4;

      particlesRef.current.push({
        gfx,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 25 + Math.random() * 15,
      });
    }
  }

  function spawnShieldParticles(x: number, y: number, count: number) {
    const container = particleContainerRef.current;
    if (!container) return;

    for (let i = 0; i < count; i++) {
      const gfx = new Graphics();
      gfx.circle(0, 0, 2 + Math.random() * 3).fill({ color: 0x60a5fa, alpha: 0.8 });
      const angle = (Math.PI * 2 * i) / count;
      const radius = 35 + Math.random() * 10;
      gfx.x = x + Math.cos(angle) * radius;
      gfx.y = y + Math.sin(angle) * radius;
      container.addChild(gfx);

      particlesRef.current.push({
        gfx,
        vx: Math.cos(angle) * 0.5,
        vy: -0.5 - Math.random() * 1.5,
        life: 0,
        maxLife: 30 + Math.random() * 10,
      });
    }
  }

  function spawnRiseParticles(
    x: number,
    y: number,
    color: number,
    count: number,
  ) {
    const container = particleContainerRef.current;
    if (!container) return;

    for (let i = 0; i < count; i++) {
      const gfx = new Graphics();
      gfx.circle(0, 0, 2 + Math.random() * 3).fill({ color, alpha: 0.8 });
      gfx.x = x + (Math.random() - 0.5) * 40;
      gfx.y = y + (Math.random() - 0.5) * 20;
      container.addChild(gfx);

      particlesRef.current.push({
        gfx,
        vx: (Math.random() - 0.5) * 1.5,
        vy: -(1.5 + Math.random() * 2.5),
        life: 0,
        maxLife: 30 + Math.random() * 20,
      });
    }
  }

  function spawnFloatingText(
    x: number,
    y: number,
    content: string,
    color: number,
  ) {
    const container = textContainerRef.current;
    if (!container) return;

    const text = new Text({
      text: content,
      style: new TextStyle({
        fontSize: 28,
        fontWeight: "bold",
        fill: color,
        stroke: { color: 0x000000, width: 4 },
        fontFamily: "monospace",
      }),
    });
    text.anchor.set(0.5);
    text.x = x;
    text.y = y;
    container.addChild(text);

    floatingTextsRef.current.push({
      text,
      vy: -1.2,
      life: 0,
      maxLife: 50,
    });
  }

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

      // Battlefield background
      const bg = new Graphics();
      bg.rect(0, 0, w, h).fill(0x0a0a1a);
      bg.moveTo(w / 2, 0).lineTo(w / 2, h).stroke({ width: 1, color: 0x1a1a3a });
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
      playerContainerRef.current = playerContainer;
      playerBasePos.current = { x: w * 0.25, y: h * 0.5 };

      drawCharacter(playerContainer, playerClass, "You");

      // Opponent character (right side)
      const opponentContainer = new Container();
      opponentContainer.x = w * 0.75;
      opponentContainer.y = h * 0.5;
      app.stage.addChild(opponentContainer);
      opponentContainerRef.current = opponentContainer;
      opponentBasePos.current = { x: w * 0.75, y: h * 0.5 };

      drawCharacter(opponentContainer, opponentClass, "Foe");

      // Particle container (above characters)
      const particleContainer = new Container();
      app.stage.addChild(particleContainer);
      particleContainerRef.current = particleContainer;

      // Text container (topmost)
      const textContainer = new Container();
      app.stage.addChild(textContainer);
      textContainerRef.current = textContainer;

      // Animation loop: idle bob + particle/text updates
      let time = 0;
      app.ticker.add(() => {
        time += app.ticker.deltaTime * 0.03;

        // Idle bob (only adjust Y, X is animated by lunge)
        playerContainer.y = playerBasePos.current.y + Math.sin(time) * 4;
        opponentContainer.y =
          opponentBasePos.current.y + Math.sin(time + Math.PI) * 4;

        // Update particles
        const particles = particlesRef.current;
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.life += app.ticker.deltaTime;
          p.gfx.x += p.vx * app.ticker.deltaTime;
          p.gfx.y += p.vy * app.ticker.deltaTime;
          p.gfx.alpha = Math.max(0, 1 - p.life / p.maxLife);

          if (p.life >= p.maxLife) {
            particleContainer.removeChild(p.gfx);
            p.gfx.destroy();
            particles.splice(i, 1);
          }
        }

        // Update floating texts
        const texts = floatingTextsRef.current;
        for (let i = texts.length - 1; i >= 0; i--) {
          const ft = texts[i];
          ft.life += app.ticker.deltaTime;
          ft.text.y += ft.vy * app.ticker.deltaTime;
          ft.text.alpha = Math.max(0, 1 - ft.life / ft.maxLife);

          if (ft.life >= ft.maxLife) {
            textContainer.removeChild(ft.text);
            ft.text.destroy();
            texts.splice(i, 1);
          }
        }
      });
    };

    init();

    return () => {
      destroyed = true;
      particlesRef.current = [];
      floatingTextsRef.current = [];
      if (appRef.current) {
        appRef.current.destroy(true);
        appRef.current = null;
      }
    };
  }, [playerClass, opponentClass]);

  return <div ref={canvasRef} className="absolute inset-0" />;
});

BattlefieldCanvas.displayName = "BattlefieldCanvas";

function drawCharacter(container: Container, classId: ClassId, label: string) {
  const color = CLASS_COLORS[classId];
  const g = new Graphics();

  if (classId === "warrior") {
    g.rect(-30, -30, 60, 60).fill(color);
    g.rect(-30, -30, 60, 60).stroke({ width: 2, color: 0xffffff, alpha: 0.3 });
  } else if (classId === "rogue") {
    g.moveTo(0, -35).lineTo(30, 25).lineTo(-30, 25).closePath().fill(color);
    g.moveTo(0, -35)
      .lineTo(30, 25)
      .lineTo(-30, 25)
      .closePath()
      .stroke({ width: 2, color: 0xffffff, alpha: 0.3 });
  } else {
    g.circle(0, 0, 30).fill(color);
    g.circle(0, 0, 30).stroke({ width: 2, color: 0xffffff, alpha: 0.3 });
  }

  const glow = new Graphics();
  glow.circle(0, 0, 40).fill({ color, alpha: 0.15 });
  container.addChild(glow);
  container.addChild(g);

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
  isPlaying,
  onPlay,
}: {
  card: Card;
  canPlay: boolean;
  isYourTurn: boolean;
  isPlaying: boolean;
  onPlay: (cardId: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const playable = canPlay && isYourTurn;
  const isFree = card.energyCost === 0;

  return (
    <div
      className={`relative flex-shrink-0 w-28 transition-all duration-200 ${
        isPlaying
          ? "-translate-y-20 scale-75 opacity-0 pointer-events-none"
          : hovered
            ? "-translate-y-6 z-50 scale-110"
            : "z-10"
      } ${playable && !isPlaying ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}
      style={isPlaying ? { transition: "all 300ms ease-out" } : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => playable && !isPlaying && onPlay(card.id)}
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
      {isCurrentTurn && (
        <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
      )}

      <div className="min-w-[80px]">
        <p className="text-sm font-bold text-white">{name}</p>
        <p className="text-[10px] text-gray-400 capitalize">{classId}</p>
      </div>

      <HpBar hp={hp} maxHp={maxHp} />
      <EnergyPips current={energy} max={maxEnergy} />
      <StatusEffects
        strength={strength}
        poison={poison}
        block={block}
        orbs={orbs}
      />
    </div>
  );
}

// ── Helper: determine animation from card type ──────────────────────────────

function triggerCardAnimation(
  battlefieldRef: React.RefObject<BattlefieldHandle | null>,
  cardType: CardType,
  isPlayer: boolean,
  classId: ClassId,
  damage: number,
  block: number,
) {
  const bf = battlefieldRef.current;
  if (!bf) return;

  if (cardType === "attack") {
    bf.animateAttack(isPlayer, classId, damage);
  } else if (cardType === "skill") {
    bf.animateBlock(isPlayer, block);
  } else if (cardType === "power") {
    bf.animateBuff(isPlayer);
  }
}

// ── Main GameBoard ──────────────────────────────────────────────────────────

interface GameBoardProps {
  gameState: ClientGameState;
}

export default function GameBoard({ gameState }: GameBoardProps) {
  const { you, opponent, currentTurn, turnNumber } = gameState;
  const isYourTurn = currentTurn === you.id;
  const battlefieldRef = useRef<BattlefieldHandle | null>(null);
  const [playingCardId, setPlayingCardId] = useState<string | null>(null);
  const lastProcessedActionRef = useRef<string | null>(null);

  // Animate opponent's actions from lastAction
  useEffect(() => {
    const action = gameState.lastAction;
    if (!action) return;

    // Only animate opponent's actions (player actions are animated on click)
    if (action.playerId === you.id) return;

    // Deduplicate using a simple key
    const actionKey = `${action.playerId}-${action.cardName}-${gameState.turnNumber}-${opponent.hp}`;
    if (lastProcessedActionRef.current === actionKey) return;
    lastProcessedActionRef.current = actionKey;

    triggerCardAnimation(
      battlefieldRef,
      action.cardType,
      false, // opponent's action, animate from opponent side
      action.cardClass,
      action.damageDealt,
      action.blockGained,
    );
  }, [gameState.lastAction, you.id, gameState.turnNumber, opponent.hp]);

  // Clear playing card state when hand changes (server responded)
  useEffect(() => {
    if (playingCardId && !you.hand.some((c) => c.id === playingCardId)) {
      // Card was removed from hand by server, clear playing state after animation
      const timer = setTimeout(() => setPlayingCardId(null), 350);
      return () => clearTimeout(timer);
    }
  }, [you.hand, playingCardId]);

  const handlePlayCard = useCallback(
    (cardId: string) => {
      if (!isYourTurn || playingCardId) return;

      const card = you.hand.find((c) => c.id === cardId);
      if (!card) return;

      // Set playing animation state
      setPlayingCardId(cardId);

      // Compute approximate damage/block for animation
      const damage = card.effects
        .filter((e) => e.type === "damage")
        .reduce(
          (sum, e) =>
            sum + e.value + (card.type === "attack" ? you.strength : 0),
          0,
        );
      const block = card.effects
        .filter((e) => e.type === "block")
        .reduce((sum, e) => sum + e.value, 0);

      // Trigger PixiJS animation after brief delay for card fly-out
      setTimeout(() => {
        triggerCardAnimation(
          battlefieldRef,
          card.type,
          true,
          you.class,
          damage,
          block,
        );
      }, 150);

      // Emit to server
      emitPlayCard(cardId);
    },
    [isYourTurn, playingCardId, you.hand, you.strength, you.class],
  );

  const handleEndTurn = useCallback(() => {
    if (!isYourTurn) return;
    emitEndTurn();
  }, [isYourTurn]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-gray-950 select-none">
      {/* PixiJS Battlefield Canvas (bottom layer) */}
      <BattlefieldCanvas
        ref={battlefieldRef}
        playerClass={you.class}
        opponentClass={opponent.class}
      />

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
                isPlaying={card.id === playingCardId}
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
