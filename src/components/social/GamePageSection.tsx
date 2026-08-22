import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { type PostWithMeta, fetchGames } from "@/lib/social/api";
import { GameCard } from "./GameCard";

/**
 * Full-screen game page panel — renders a single game (by post ID) inside
 * a dedicated full-viewport section, similar to Events / Plus / Orión.
 */
export function GamePageSection({
  gameId,
  myId,
  isMod,
  onClose,
}: {
  gameId: string;
  myId: string | null;
  isMod: boolean;
  onClose: () => void;
}) {
  const [game, setGame] = useState<PostWithMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        // Fetch all games and find the one matching the gameId
        const games = await fetchGames();
        const found = games.find((g) => g.id === gameId);
        if (!cancelled) {
          if (found) {
            setGame(found);
          } else {
            setError("Juego no encontrado");
          }
        }
      } catch {
        if (!cancelled) setError("Error al cargar el juego");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [gameId]);

  return (
    <div
      className="fixed inset-0 z-[90] bg-background flex flex-col animate-in fade-in duration-200"
      style={{ height: "100dvh" }}
    >
      {/* Header */}
      <header className="shrink-0 border-b border-border/60 bg-background">
        <div className="max-w-2xl md:max-w-3xl mx-auto flex items-center gap-2.5 px-4 py-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary grid place-items-center shrink-0">
            <span className="text-lg">🎮</span>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-display font-semibold text-foreground">
              {game ? (game.content.split("\n")[0] || "Juego").replace(/^🎮\s*/, "").trim() || "Juego" : "Cargando juego..."}
            </h2>
            <p className="text-xs text-muted-foreground truncate">
              {game ? `Por @${game.author?.username || "desconocido"}` : " "}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl border border-border/70 bg-background grid place-items-center active:scale-95 transition shrink-0"
          >
            <X size={16} />
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="max-w-2xl md:max-w-3xl mx-auto px-4 py-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              <span className="text-xs text-muted-foreground">Cargando juego...</span>
            </div>
          )}
          {error && (
            <div className="text-center py-20 space-y-2">
              <p className="text-sm text-muted-foreground">{error}</p>
              <button
                onClick={onClose}
                className="h-9 px-4 rounded-lg bg-muted text-xs font-medium"
              >
                VOLVER
              </button>
            </div>
          )}
          {game && (
            <GameCard
              post={game}
              myId={myId}
              isMod={isMod}
              onChange={() => {
                /* refresh not critical here */
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
