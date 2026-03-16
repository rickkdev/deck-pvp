import { Application, Graphics } from "pixi.js";
import { useEffect, useRef } from "react";
import { GAME_CONFIG } from "@deck-pvp/shared";

function PixiCanvas() {
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const app = new Application();
    let mounted = true;

    app
      .init({
        width: 400,
        height: 300,
        background: "#1a1a2e",
        resizeTo: undefined,
      })
      .then(() => {
        if (!mounted || !canvasRef.current) {
          app.destroy(true);
          return;
        }

        canvasRef.current.appendChild(app.canvas as HTMLCanvasElement);

        const rect = new Graphics();
        rect.rect(125, 75, 150, 150);
        rect.fill({ color: 0x7c3aed });
        rect.stroke({ color: 0xa78bfa, width: 3 });
        app.stage.addChild(rect);
      });

    return () => {
      mounted = false;
      app.destroy(true);
    };
  }, []);

  return <div ref={canvasRef} className="rounded-lg overflow-hidden" />;
}

export default function App() {
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center gap-8">
      <h1 className="text-4xl font-bold text-purple-400">Deck PVP</h1>
      <p className="text-gray-400">
        A Slay the Spire-inspired PvP deck-building card game
      </p>
      <PixiCanvas />
      <p className="text-sm text-gray-500">
        Max HP: {GAME_CONFIG.HP} | Energy per turn:{" "}
        {GAME_CONFIG.ENERGY_PER_TURN} | Cards drawn:{" "}
        {GAME_CONFIG.CARDS_DRAWN_PER_TURN}
      </p>
    </div>
  );
}
