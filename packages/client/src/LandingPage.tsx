interface LandingPageProps {
  onPlayPvP: () => void;
  onPlayVsAI: () => void;
  searching: boolean;
}

export default function LandingPage({ onPlayPvP, onPlayVsAI, searching }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-10 px-4">
      {/* Ambient glow behind title */}
      <div className="relative">
        <div className="absolute -inset-8 bg-purple-600/20 blur-3xl rounded-full" />
        <h1 className="relative text-6xl font-extrabold tracking-tight bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
          Deck PVP
        </h1>
      </div>

      <p className="text-gray-400 text-lg text-center max-w-md">
        A Slay the Spire-inspired PvP deck-building card game. Choose your
        class, build your strategy, and battle in real time.
      </p>

      {searching ? (
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-purple-300 text-lg">
              Searching for opponent...
            </span>
          </div>
          <div className="flex gap-1.5">
            <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <button
            onClick={onPlayPvP}
            className="px-10 py-4 bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white text-xl font-bold rounded-xl transition-all duration-200 shadow-lg shadow-purple-600/30 hover:shadow-purple-500/40 hover:scale-105 cursor-pointer w-64"
          >
            Play PvP
          </button>
          <button
            onClick={onPlayVsAI}
            className="px-10 py-4 bg-gray-700 hover:bg-gray-600 active:bg-gray-800 text-white text-xl font-bold rounded-xl transition-all duration-200 shadow-lg shadow-gray-700/30 hover:shadow-gray-600/40 hover:scale-105 cursor-pointer w-64"
          >
            Play vs AI
          </button>
        </div>
      )}

      <div className="flex gap-8 text-sm text-gray-600">
        <span>3 Classes</span>
        <span className="text-gray-700">•</span>
        <span>10-Card Decks</span>
        <span className="text-gray-700">•</span>
        <span>Real-Time PvP</span>
      </div>
    </div>
  );
}
