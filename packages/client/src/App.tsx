import { useCallback, useEffect, useRef, useState } from "react";
import type { ClassId, ClientGameState, GameStats } from "@deck-pvp/shared";
import {
  connect,
  disconnect,
  findMatch,
  playVsAI,
  selectClass,
  onMatchFound,
  onGameState,
  onGameOver,
  onError,
  onWaitingForOpponent,
} from "./socket";
import { soundManager } from "./SoundManager";
import LandingPage from "./LandingPage";
import ClassSelection from "./ClassSelection";
import GameBoard from "./GameBoard";
import GameOverScreen from "./GameOverScreen";

type Screen = "landing" | "class-select" | "game" | "game-over";

interface GameOverData {
  stats: { you: GameStats; opponent: GameStats };
  disconnected?: boolean;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [searching, setSearching] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassId | null>(null);
  const [waitingForOpponent, setWaitingForOpponent] = useState(false);
  const [gameState, setGameState] = useState<ClientGameState | null>(null);
  const [gameOverData, setGameOverData] = useState<GameOverData | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const prevScreenRef = useRef<Screen>("landing");

  // Smooth screen transition helper
  const transitionTo = useCallback((next: Screen) => {
    setTransitioning(true);
    setTimeout(() => {
      prevScreenRef.current = next;
      setScreen(next);
      setTransitioning(false);
    }, 200);
  }, []);

  useEffect(() => {
    const unsubs = [
      onMatchFound(() => {
        setSearching(false);
        setWaitingForOpponent(false);
        transitionTo("class-select");
      }),
      onGameState((state) => {
        setGameState(state);
        setWaitingForOpponent(false);
        if (prevScreenRef.current !== "game") {
          transitionTo("game");
        } else {
          setScreen("game");
        }
      }),
      onGameOver(({ state, stats, disconnected }) => {
        setGameState(state);
        setGameOverData({ stats, disconnected });
        setScreen("game-over");
        // Play victory/defeat sound
        const isWinner = state.winner === state.you.id;
        soundManager.play(isWinner ? 'victory' : 'defeat');
      }),
      onError(({ message }) => {
        console.error("[server error]", message);
      }),
      onWaitingForOpponent(() => {
        setWaitingForOpponent(true);
      }),
    ];

    return () => unsubs.forEach((fn) => fn());
  }, []);

  const handlePlayPvP = useCallback(() => {
    connect();
    setSearching(true);
    findMatch();
  }, []);

  const handlePlayVsAI = useCallback(() => {
    connect();
    playVsAI();
  }, []);

  const handleSelectClass = useCallback((classId: ClassId) => {
    setSelectedClass(classId);
    selectClass(classId);
  }, []);

  const handlePlayAgain = useCallback(() => {
    setTransitioning(true);
    setTimeout(() => {
      setGameState(null);
      setGameOverData(null);
      setSelectedClass(null);
      setWaitingForOpponent(false);
      setSearching(false);
      prevScreenRef.current = "landing";
      setScreen("landing");
      setTransitioning(false);
    }, 200);
  }, []);

  const handleHome = useCallback(() => {
    disconnect();
    setTransitioning(true);
    setTimeout(() => {
      setGameState(null);
      setGameOverData(null);
      setSelectedClass(null);
      setWaitingForOpponent(false);
      setSearching(false);
      prevScreenRef.current = "landing";
      setScreen("landing");
      setTransitioning(false);
    }, 200);
  }, []);

  const transitionClass = transitioning ? "opacity-0 scale-[0.98]" : "opacity-100 scale-100";

  if (screen === "class-select") {
    return (
      <div className={`transition-all duration-200 ease-out ${transitionClass}`}>
        <ClassSelection
          onSelectClass={handleSelectClass}
          waitingForOpponent={waitingForOpponent}
          selectedClass={selectedClass}
        />
      </div>
    );
  }

  if ((screen === "game" || screen === "game-over") && gameState) {
    return (
      <div className={`transition-all duration-200 ease-out ${transitionClass}`}>
        <GameBoard gameState={gameState} />
        {screen === "game-over" && gameOverData && (
          <GameOverScreen
            gameState={gameState}
            stats={gameOverData.stats}
            disconnected={gameOverData.disconnected}
            onPlayAgain={handlePlayAgain}
            onHome={handleHome}
          />
        )}
      </div>
    );
  }

  return (
    <div className={`transition-all duration-200 ease-out ${transitionClass}`}>
      <LandingPage onPlayPvP={handlePlayPvP} onPlayVsAI={handlePlayVsAI} searching={searching} />
    </div>
  );
}
