import type { ClientGameState, GameStats } from "@deck-pvp/shared";

interface GameOverScreenProps {
  gameState: ClientGameState;
  stats: { you: GameStats; opponent: GameStats };
  disconnected?: boolean;
  onPlayAgain: () => void;
  onHome: () => void;
}

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-400 text-sm">{label}</span>
      <span className="text-white font-bold text-lg font-mono">{value}</span>
    </div>
  );
}

export default function GameOverScreen({
  gameState,
  stats,
  disconnected,
  onPlayAgain,
  onHome,
}: GameOverScreenProps) {
  const isWinner = gameState.winner === gameState.you.id;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
        {/* Title */}
        <h1
          className={`text-5xl font-black text-center mb-2 ${
            isWinner ? "text-green-400" : "text-red-500"
          }`}
        >
          {isWinner ? "Victory!" : "Defeat"}
        </h1>

        {disconnected && (
          <p className="text-center text-yellow-400 text-sm mb-4">
            Opponent disconnected
          </p>
        )}

        {/* Stats */}
        <div className="mt-6 space-y-4">
          <div>
            <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-2">
              Your Stats
            </h3>
            <div className="bg-gray-800/60 rounded-lg p-3 space-y-1">
              <StatRow label="Damage Dealt" value={stats.you.damageDealt} />
              <StatRow label="Cards Played" value={stats.you.cardsPlayed} />
              <StatRow label="Turns Taken" value={stats.you.turnsTaken} />
            </div>
          </div>

          <div>
            <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-2">
              Opponent Stats
            </h3>
            <div className="bg-gray-800/60 rounded-lg p-3 space-y-1">
              <StatRow label="Damage Dealt" value={stats.opponent.damageDealt} />
              <StatRow label="Cards Played" value={stats.opponent.cardsPlayed} />
              <StatRow label="Turns Taken" value={stats.opponent.turnsTaken} />
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="mt-8 flex gap-3">
          <button
            onClick={onPlayAgain}
            className="flex-1 py-3 rounded-lg font-bold text-white bg-amber-600 hover:bg-amber-500 transition-colors cursor-pointer shadow-lg shadow-amber-600/20"
          >
            Play Again
          </button>
          <button
            onClick={onHome}
            className="flex-1 py-3 rounded-lg font-bold text-gray-300 bg-gray-800 hover:bg-gray-700 transition-colors cursor-pointer border border-gray-700"
          >
            Home
          </button>
        </div>
      </div>
    </div>
  );
}
