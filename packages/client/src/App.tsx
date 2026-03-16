import { useCallback, useEffect, useState } from "react";
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

  useEffect(() => {
    const unsubs = [
      onMatchFound(() => {
        setSearching(false);
        setScreen("class-select");
      }),
      onGameState((state) => {
        setGameState(state);
        setWaitingForOpponent(false);
        setScreen("game");
      }),
      onGameOver(({ state, stats, disconnected }) => {
        setGameState(state);
        setGameOverData({ stats, disconnected });
        setScreen("game-over");
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
    setGameState(null);
    setGameOverData(null);
    setSelectedClass(null);
    setWaitingForOpponent(false);
    setSearching(false);
    setScreen("landing");
  }, []);

  const handleHome = useCallback(() => {
    disconnect();
    setGameState(null);
    setGameOverData(null);
    setSelectedClass(null);
    setWaitingForOpponent(false);
    setSearching(false);
    setScreen("landing");
  }, []);

  if (screen === "class-select") {
    return (
      <ClassSelection
        onSelectClass={handleSelectClass}
        waitingForOpponent={waitingForOpponent}
        selectedClass={selectedClass}
      />
    );
  }

  if ((screen === "game" || screen === "game-over") && gameState) {
    return (
      <>
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
      </>
    );
  }

  return <LandingPage onPlayPvP={handlePlayPvP} onPlayVsAI={handlePlayVsAI} searching={searching} />;
}
