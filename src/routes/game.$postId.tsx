import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { ArrowLeft } from "lucide-react";
import { GameCard } from "@/components/social/GameCard";
import { supabase } from "@/integrations/supabase/client";
import { fetchGameById, type PostWithMeta, isMod } from "@/lib/social/api";

export const Route = createFileRoute("/game/$postId")({
  head: () => ({ meta: [{ title: "Asternal — Juego" }] }),
  component: GamePage,
});

function GamePage() {
  const { postId } = Route.useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState<PostWithMeta | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [mod, setMod] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let uid: string | null = null;
      try {
        const res = await supabase.auth.getSession();
        uid = res.data?.session?.user?.id ?? null;
      } catch { /* ignore */ }
      if (!uid) {
        try {
          const raw = localStorage.getItem("_local_auth_session");
          if (raw) {
            const s = JSON.parse(raw) as { userId?: string; expiresAt?: string };
            if (s.userId && s.expiresAt && new Date(s.expiresAt) > new Date()) uid = s.userId;
          }
        } catch { /* noop */ }
      }
      setMyId(uid);
      try { setMod(await isMod()); } catch { /* noop */ }
      const g = await fetchGameById(postId);
      if (!g) { setError("Juego no encontrado"); return; }
      setGame(g);
    } catch (e) {
      setError((e as Error).message || "Error al cargar el juego");
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => { load(); }, [load]);

  const onChange = useCallback(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b border-border/70">
          <div className="max-w-2xl mx-auto flex items-center gap-3 px-4 py-3">
            <button onClick={() => navigate({ to: "/" })} className="w-9 h-9 rounded-xl border border-border/70 bg-background grid place-items-center active:scale-95 transition">
              <ArrowLeft size={16} />
            </button>
            <div className="text-sm font-display font-semibold">Cargando…</div>
          </div>
        </header>
        <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">
          <div className="space-y-4 animate-pulse">
            <div className="aspect-[16/10] rounded-2xl bg-muted/40" />
            <div className="h-4 w-1/2 bg-muted/50 rounded" />
            <div className="h-3 w-1/3 bg-muted/40 rounded" />
          </div>
        </main>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b border-border/70">
          <div className="max-w-2xl mx-auto flex items-center gap-3 px-4 py-3">
            <button onClick={() => navigate({ to: "/" })} className="w-9 h-9 rounded-xl border border-border/70 bg-background grid place-items-center active:scale-95 transition">
              <ArrowLeft size={16} />
            </button>
            <div className="text-sm font-display font-semibold">Error</div>
          </div>
        </header>
        <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-16 text-center">
          <div className="text-sm text-muted-foreground">{error || "Juego no encontrado"}</div>
          <button onClick={() => navigate({ to: "/" })} className="mt-4 px-4 py-2 rounded-xl grad-brand text-xs font-display tracking-widest">
            VOLVER
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b border-border/70">
        <div className="max-w-2xl mx-auto flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate({ to: "/" })} className="w-9 h-9 rounded-xl border border-border/70 bg-background grid place-items-center active:scale-95 transition shrink-0">
            <ArrowLeft size={16} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-display font-semibold truncate">
              {(game.content.split("\n")[0] || "Juego").replace(/^🎮\s*/, "").trim() || "Juego"}
            </div>
            <div className="text-[10px] font-mono text-muted-foreground truncate">
              @{game.author?.username ?? "jugador"}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-3 py-4 pb-20">
        <GameCard post={game} myId={myId} isMod={mod} onChange={onChange} />
      </main>
    </div>
  );
}
