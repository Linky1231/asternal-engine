import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Gamepad2, Clock, BarChart3, Loader2, ChevronRight, ExternalLink } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { PostWithMeta } from "@/lib/social/api";
import { getMyLikedPosts, getAggregatedPlayTime, formatPlayTime } from "@/lib/social/history";
import { UserName } from "./UserName";

type HistoryTab = "games" | "likes";

export function HistorySection() {
  const [tab, setTab] = useState<HistoryTab>("games");
  const [likedPosts, setLikedPosts] = useState<PostWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [likesLoading, setLikesLoading] = useState(false);

  const agg = getAggregatedPlayTime();
  const sortedGames = Array.from(agg.entries()).sort((a, b) => b[1].lastPlayed.localeCompare(a[1].lastPlayed));

  useEffect(() => {
    // Simulate loading time for the view transition
    const t = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (tab !== "likes") return;
    setLikesLoading(true);
    getMyLikedPosts()
      .then(setLikedPosts)
      .catch(() => {})
      .finally(() => setLikesLoading(false));
  }, [tab]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-4"
    >
      {/* Header */}
      <div className="panel rounded-2xl border border-border/50 p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent grid place-items-center">
            <BarChart3 size={18} className="text-primary-foreground" />
          </div>
          <div>
            <div className="font-display text-sm font-semibold">Historial</div>
            <div className="text-[11px] text-muted-foreground">
              {sortedGames.length} juegos jugados · {likedPosts.length} likes
            </div>
          </div>
        </div>

        {/* Sub-tabs */}
        <div className="relative flex bg-muted/40 rounded-xl p-0.5">
          <button
            onClick={() => setTab("games")}
            className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-display tracking-widest transition-colors ${
              tab === "games" ? "text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            <Gamepad2 size={13} /> JUEGOS
          </button>
          <button
            onClick={() => setTab("likes")}
            className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-display tracking-widest transition-colors ${
              tab === "likes" ? "text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            <Heart size={13} /> LIKES
          </button>
          <div
            className="absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] rounded-lg bg-gradient-to-br from-primary to-accent shadow-sm transition-transform duration-300 ease-out"
            style={{ transform: `translateX(${tab === "games" ? "0%" : "calc(100% + 4px)"})` }}
          />
        </div>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {tab === "games" ? (
          <motion.div
            key="games"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-2"
          >
            {loading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 size={16} className="animate-spin mr-2" />
                <span className="text-xs">Cargando historial…</span>
              </div>
            ) : sortedGames.length === 0 ? (
              <div className="panel rounded-2xl border border-dashed border-border/60 p-8 text-center">
                <Gamepad2 size={24} className="mx-auto mb-2 text-muted-foreground/40" />
                <div className="text-sm text-muted-foreground">Aún no has jugado ningún juego</div>
                <div className="text-[11px] text-muted-foreground/60 mt-1">
                  ¡Explora juegos en la sección JUEGOS!
                </div>
              </div>
            ) : (
              sortedGames.map(([gameId, data], i) => (
                <motion.div
                  key={gameId}
                  initial={{ opacity: 0, y: 12, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.25, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
                  className="panel rounded-2xl border border-border/50 overflow-hidden hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-center gap-3 p-3">
                    {/* Cover thumbnail */}
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 shrink-0 overflow-hidden grid place-items-center">
                      {data.coverUrl ? (
                        <img src={data.coverUrl} alt={data.title} className="w-full h-full object-cover" />
                      ) : (
                        <Gamepad2 size={18} className="text-primary/40" />
                      )}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="font-display text-sm font-medium truncate">{data.title}</div>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground font-mono">
                        <span className="inline-flex items-center gap-1">
                          <Clock size={10} /> {formatPlayTime(data.totalSeconds)}
                        </span>
                        <span>{data.sessions} sesión{data.sessions !== 1 ? "es" : ""}</span>
                      </div>
                      <div className="mt-0.5 text-[9px] text-muted-foreground/60 font-mono">
                        Última vez: {new Date(data.lastPlayed).toLocaleDateString("es", {
                          day: "numeric", month: "short", year: "numeric",
                        })}
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="w-20 hidden sm:block">
                      <div className="text-[9px] font-mono text-muted-foreground text-right mb-1">
                        {formatPlayTime(data.totalSeconds)}
                      </div>
                      <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                          style={{
                            width: `${Math.min(100, (data.totalSeconds / 3600) * 50)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </motion.div>
        ) : (
          <motion.div
            key="likes"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-2"
          >
            {likesLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 size={16} className="animate-spin mr-2" />
                <span className="text-xs">Cargando likes…</span>
              </div>
            ) : likedPosts.length === 0 ? (
              <div className="panel rounded-2xl border border-dashed border-border/60 p-8 text-center">
                <Heart size={24} className="mx-auto mb-2 text-muted-foreground/40" />
                <div className="text-sm text-muted-foreground">No has dado like a ninguna publicación</div>
                <div className="text-[11px] text-muted-foreground/60 mt-1">
                  ¡Explora y da like a las publicaciones que te gusten!
                </div>
              </div>
            ) : (
              likedPosts.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 12, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.25, delay: i * 0.03, ease: [0.22, 1, 0.36, 1] }}
                  className="panel rounded-2xl border border-border/50 overflow-hidden hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-start gap-3 p-3">
                    {/* Author avatar */}
                    <Link
                      to="/profile/$userId"
                      params={{ userId: p.author_id }}
                      className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/40 to-accent/30 grid place-items-center overflow-hidden shrink-0"
                    >
                      {p.author?.avatar_url ? (
                        <img src={p.author.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[10px] font-display text-primary-glow">
                          {(p.author?.username ?? "?")[0]?.toUpperCase()}
                        </span>
                      )}
                    </Link>
                    {/* Content preview */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-xs">
                        <UserName p={p.author} />
                        <span className="text-muted-foreground/60">·</span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {new Date(p.created_at).toLocaleDateString("es")}
                        </span>
                      </div>
                      <p className="text-sm mt-1 line-clamp-2 text-muted-foreground/90">
                        {p.content.replace(/^[🎮🎨]\s*/, "").trim()}
                      </p>
                      {p.media_type === "image" && p.signed_media[0] && (
                        <img
                          src={p.signed_media[0]}
                          alt=""
                          className="mt-2 w-full h-32 object-cover rounded-xl bg-muted/30"
                        />
                      )}
                    </div>
                    <Heart size={14} className="text-rose-400 shrink-0 mt-1" fill="currentColor" />
                  </div>
                </motion.div>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
