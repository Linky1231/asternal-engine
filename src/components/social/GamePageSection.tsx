import { useState, useEffect, useCallback } from "react";
import { X, Gamepad2, Heart, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { type PostWithMeta, fetchGames, donateOrbs, getMyOrbes } from "@/lib/social/api";
import { GameCard } from "./GameCard";

const PRESET_AMOUNTS = [5, 10, 25, 50, 100];

/**
 * Full-screen game page panel — renders a single game (by post ID) inside
 * a dedicated full-viewport section, similar to Events / Plus / Orión.
 * Includes an orb donation panel below the game.
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
  const [myBalance, setMyBalance] = useState(0);
  const [donating, setDonating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const [games, balance] = await Promise.all([
          fetchGames(),
          getMyOrbes(),
        ]);
        if (!cancelled) {
          const found = games.find((g) => g.id === gameId);
          if (found) {
            setGame(found);
          } else {
            setError("Juego no encontrado");
          }
          setMyBalance(balance);
        }
      } catch {
        if (!cancelled) setError("Error al cargar el juego");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [gameId]);

  const handleDonate = useCallback(async (amount: number) => {
    if (!game || donating) return;
    if (myId === game.author_id) {
      toast.error("No puedes donar a tu propio juego");
      return;
    }
    if (amount > myBalance) {
      toast.error("No tienes suficientes orbes");
      return;
    }
    setDonating(true);
    try {
      const result = await donateOrbs(game.id, amount);
      if (result.ok) {
        setMyBalance(result.balance ?? myBalance - amount);
        toast.success(`¡${amount} orbes donados!`, {
          description: `A @${game.author?.username || "el autor"}`,
        });
      } else {
        toast.error(result.error || "Error al donar");
      }
    } catch {
      toast.error("Error al procesar la donación");
    } finally {
      setDonating(false);
    }
  }, [game, myBalance, myId, donating]);

  const isOwnGame = myId === game?.author_id;

  return (
    <div
      className="fixed inset-0 z-[90] bg-background flex flex-col animate-in fade-in duration-200"
      style={{ height: "100dvh" }}
    >
      {/* Header */}
      <header className="shrink-0 border-b border-border/60 bg-background">
        <div className="max-w-2xl md:max-w-3xl mx-auto flex items-center gap-2.5 px-4 py-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary grid place-items-center shrink-0">
            <Gamepad2 size={18} />
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
        <div className="max-w-2xl md:max-w-3xl mx-auto px-4 py-4 space-y-5">
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
            <>
              {/* Game card */}
              <GameCard
                post={game}
                myId={myId}
                isMod={isMod}
                onChange={() => { /* refresh not critical */ }}
              />

              {/* Donation panel — only visible if user is logged in and it's not their own game */}
              {myId && !isOwnGame && (
                <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 grid place-items-center shrink-0">
                      <Sparkles size={16} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-display font-semibold text-foreground">
                        Donar orbes
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Apoya al autor con orbes
                      </div>
                    </div>
                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/15 shrink-0">
                      <Heart size={11} className="text-primary" fill="currentColor" />
                      <span className="text-[11px] font-mono font-semibold text-primary">{myBalance}</span>
                    </div>
                  </div>

                  {/* Preset amounts */}
                  <div className="grid grid-cols-5 gap-2">
                    {PRESET_AMOUNTS.map((amt) => {
                      const disabled = donating || amt > myBalance;
                      return (
                        <button
                          key={amt}
                          type="button"
                          disabled={disabled}
                          onClick={() => handleDonate(amt)}
                          className={`h-10 rounded-xl text-xs font-display font-semibold border transition active:scale-95 disabled:opacity-40 disabled:active:scale-100 ${
                            amt <= myBalance
                              ? "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 hover:border-primary/50"
                              : "border-border/40 bg-muted/30 text-muted-foreground"
                          }`}
                        >
                          {amt}
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom amount */}
                  <CustomDonateButton
                    maxAmount={myBalance}
                    donating={donating}
                    onDonate={handleDonate}
                  />

                  {isOwnGame && (
                    <p className="text-[10px] text-muted-foreground/50 text-center">
                      No puedes donar a tu propio juego
                    </p>
                  )}
                </div>
              )}

              {/* Login prompt for non-authenticated users */}
              {!myId && (
                <div className="rounded-2xl border border-border/60 bg-card p-4 text-center">
                  <p className="text-xs text-muted-foreground">
                    Inicia sesión para donar orbes al autor
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function CustomDonateButton({
  maxAmount,
  donating,
  onDonate,
}: {
  maxAmount: number;
  donating: boolean;
  onDonate: (amount: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");

  const submit = () => {
    const n = parseInt(value, 10);
    if (!isNaN(n) && n > 0) {
      onDonate(n);
      setOpen(false);
      setValue("");
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={donating}
        className="w-full h-9 rounded-xl text-[11px] font-display tracking-wider border border-dashed border-border/50 text-muted-foreground hover:border-primary/30 hover:text-primary transition disabled:opacity-40"
      >
        CANTIDAD PERSONALIZADA
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 relative">
        <input
          type="number"
          min={1}
          max={maxAmount}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={`1-${maxAmount}`}
          className="w-full h-9 rounded-xl bg-input/40 px-3 text-xs font-mono outline-none focus:ring-2 focus:ring-primary/20 border border-border/50"
          autoFocus
          onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") setOpen(false); }}
        />
      </div>
      <button
        type="button"
        onClick={submit}
        disabled={donating || !value || parseInt(value, 10) <= 0}
        className="h-9 px-4 rounded-xl grad-brand text-white text-[11px] font-display tracking-wider disabled:opacity-40 active:scale-95 transition shrink-0"
      >
        DONAR
      </button>
      <button
        type="button"
        onClick={() => { setOpen(false); setValue(""); }}
        className="h-9 px-3 rounded-xl bg-muted/50 text-[11px] text-muted-foreground border border-border/40 shrink-0 active:scale-95 transition"
      >
        ✕
      </button>
    </div>
  );
}
