import type { ClientGameState } from "@deck-pvp/shared";

interface GameBoardProps {
  gameState: ClientGameState;
}

export default function GameBoard({ gameState }: GameBoardProps) {
  const isYourTurn = gameState.currentTurn === gameState.you.id;

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4 px-4">
      <h2 className="text-2xl font-bold text-white">
        Game Board — Turn {gameState.turnNumber}
      </h2>
      <p className={`text-lg ${isYourTurn ? "text-green-400" : "text-yellow-400"}`}>
        {isYourTurn ? "Your turn" : "Opponent's turn"}
      </p>
      <div className="flex gap-12 text-center">
        <div>
          <p className="text-gray-400 text-sm">You ({gameState.you.class})</p>
          <p className="text-white text-xl font-bold">
            {gameState.you.hp} / {gameState.you.maxHp} HP
          </p>
        </div>
        <div className="text-gray-600">vs</div>
        <div>
          <p className="text-gray-400 text-sm">
            Opponent ({gameState.opponent.class})
          </p>
          <p className="text-white text-xl font-bold">
            {gameState.opponent.hp} / {gameState.opponent.maxHp} HP
          </p>
        </div>
      </div>
      <p className="text-gray-500 text-sm mt-8">
        Full game board UI coming in US-007
      </p>
    </div>
  );
}
