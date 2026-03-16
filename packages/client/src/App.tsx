import { useCallback, useEffect, useState } from "react";
import type { ClassId, ClientGameState } from "@deck-pvp/shared";
import {
  connect,
  findMatch,
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

type Screen = "landing" | "class-select" | "game";

export default function App() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [searching, setSearching] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassId | null>(null);
  const [waitingForOpponent, setWaitingForOpponent] = useState(false);
  const [gameState, setGameState] = useState<ClientGameState | null>(null);

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
      onGameOver(({ state }) => {
        setGameState(state);
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

  const handlePlayNow = useCallback(() => {
    connect();
    setSearching(true);
    findMatch();
  }, []);

  const handleSelectClass = useCallback((classId: ClassId) => {
    setSelectedClass(classId);
    selectClass(classId);
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

  if (screen === "game" && gameState) {
    return <GameBoard gameState={gameState} />;
  }

  return <LandingPage onPlayNow={handlePlayNow} searching={searching} />;
}
