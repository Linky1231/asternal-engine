import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { fetchFeed, getMyProfile, isMod, type PostWithMeta, type Profile } from "@/lib/social/api";
import { PostComposer } from "@/components/social/PostComposer";
import { PostCard } from "@/components/social/PostCard";
import { NotificationBell } from "@/components/social/NotificationBell";
import { Search, LogOut, Gamepad2, Palette, Sparkles, Inbox, X, SlidersHorizontal } from "lucide-react";

export const Route = createFileRoute("/feed")({
  head: () => ({ meta: [{ title: "Feed · Asternal" }] }),
  component: FeedPage,
});

type FilterCat = "all" | "game" | "artwork";

const CATEGORIES: { id: FilterCat; label: string; icon: React.ReactNode }[] = [
  { id: "all", label: "Todos", icon: <Sparkles size={13} /> },
  { id: "game", label: "Juegos", icon: <Gamepad2 size={13} /> },
  { id: "artwork", label: "Arte", icon: <Palette size={13} /> },
];

function FeedPage() {
  const navigate = useNavigate();
  const [me, setMe] = useState<Profile | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [mod, setMod] = useState(false);
  const [posts, setPosts] = useState<PostWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState("");
  const [category, setCategory] = useState<FilterCat>("all");
  const [showFilters, setShowFilters] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchFeed({
        search: search || undefined,
        tag: tag || undefined,
        category: category === "all" ? undefined : category,
        includeGames: category === "game",
      });
      setPosts(data);
    } finally { setLoading(false); }
  }, [search, tag, category]);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate({ to: "/auth" }); return; }
      setMyId(session.user.id);
      setMe(await getMyProfile());
      setMod(await isMod());
      await reload();
    })();
  }, [navigate, reload]);

  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  return (
    <div className="min-h-screen w-full flex flex-col bg-background">
      <header className="sticky top-0 z-20 app-header flex items-center gap-2 px-3 py-2.5 panel border-b backdrop-blur-sm bg-card/90">
        <Link to="/" className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent grid place-items-center shadow-[0_4px_14px_-4px_oklch(0.52_0.19_258/0.6)] active:scale-95 transition-transform duration-300 ease-out">
          <span className="font-display text-base font-bold text-primary-foreground">A</span>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="font-display text-sm text-primary-glow glow-text leading-none tracking-wide">FEED</div>
          <div className="text-[10px] font-mono text-muted-foreground -mt-0.5 truncate">@{me?.username ?? "..."}</div>
        </div>
        <button onClick={() => setShowFilters(s => !s)}
          className={`w-10 h-10 rounded-xl border grid place-items-center transition-[transform,background-color,border-color,color] duration-300 ease-out active:scale-[0.94] ${showFilters ? "border-primary/50 bg-primary/10 text-primary-glow" : "border-border text-muted-foreground hover:bg-muted/50"}`}
          title="Búsqueda y filtros">
          <Search size={16} />
        </button>
        <NotificationBell />
        <button onClick={logout} title="Cerrar sesión"
          className="w-10 h-10 rounded-xl border border-border text-muted-foreground grid place-items-center hover:bg-destructive/10 hover:text-destructive active:scale-[0.94] transition-[transform,background-color,color] duration-300 ease-out">
          <LogOut size={15} />
        </button>
      </header>

      {/* Filtros por categoría */}
      <div className="px-3 pt-3 max-w-2xl md:max-w-3xl lg:max-w-4xl mx-auto w-full">
        <div className="relative flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {CATEGORIES.map(c => (
            <button key={c.id} onClick={() => setCategory(c.id)}
              className={`relative shrink-0 h-9 px-4 rounded-full grid grid-flow-col auto-cols-max items-center gap-1.5 text-xs font-medium transition-colors duration-300 ease-out active:scale-[0.96] ${category === c.id ? "text-primary-foreground" : "text-muted-foreground hover:text-primary-glow"}`}>
              {category === c.id && (
                <motion.span
                  layoutId="feed-cat-pill"
                  className="absolute inset-0 rounded-full bg-gradient-to-r from-primary to-accent shadow-[0_3px_12px_-3px_oklch(0.52_0.19_258/0.55)]"
                  transition={{ type: "spring", stiffness: 280, damping: 30, mass: 0.85 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                {c.icon}
                {c.label}
              </span>
            </button>
          ))}
          <button onClick={() => setShowFilters(s => !s)}
            className={`relative shrink-0 h-9 px-3 rounded-full grid grid-flow-col auto-cols-max items-center gap-1.5 text-xs font-medium transition-[transform,color,background-color,border-color] duration-300 ease-out active:scale-[0.96] ${showFilters ? "bg-primary/10 text-primary-glow border border-primary/30" : "bg-card border border-border text-muted-foreground hover:text-primary-glow hover:border-primary/30"}`}>
            <SlidersHorizontal size={13} />
            Filtros
          </button>
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden">
              <div className="mt-2 panel rounded-2xl p-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className="flex items-center gap-2 bg-muted/40 rounded-xl px-3 py-2.5 border border-border/50 focus-within:border-primary/40 transition-colors">
                  <Search size={14} className="text-muted-foreground shrink-0" />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar en publicaciones…"
                    className="flex-1 bg-transparent text-xs outline-none min-w-0" />
                  {search && <button onClick={() => setSearch("")} className="text-muted-foreground hover:text-foreground active:scale-[0.92] transition-transform duration-200"><X size={13} /></button>}
                </label>
                <label className="flex items-center gap-2 bg-muted/40 rounded-xl px-3 py-2.5 border border-border/50 focus-within:border-primary/40 transition-colors">
                  <span className="text-primary-glow text-sm shrink-0">#</span>
                  <input value={tag} onChange={e => setTag(e.target.value)} placeholder="Etiqueta…"
                    className="flex-1 bg-transparent text-xs outline-none min-w-0" />
                  {tag && <button onClick={() => setTag("")} className="text-muted-foreground hover:text-foreground active:scale-[0.92] transition-transform duration-200"><X size={13} /></button>}
                </label>
                <button onClick={reload}
                  className="sm:col-span-2 py-2.5 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground text-[10px] font-display tracking-[0.2em] uppercase shadow-[0_3px_12px_-3px_oklch(0.52_0.19_258/0.5)] active:scale-[0.98] transition-transform duration-300 ease-out">
                  Aplicar filtros
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <main className="flex-1 p-3 space-y-3 max-w-2xl md:max-w-3xl lg:max-w-4xl mx-auto w-full pb-[env(safe-area-inset-bottom)]">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
          <PostComposer onCreated={reload} />
        </motion.div>

        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map(i => (
              <div key={i} className="panel rounded-2xl p-3 space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-full anim-shimmer" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-1/3 rounded-full anim-shimmer" />
                    <div className="h-2.5 w-1/4 rounded-full anim-shimmer" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="h-3 w-full rounded-full anim-shimmer" />
                  <div className="h-3 w-2/3 rounded-full anim-shimmer" />
                </div>
                <div className="h-48 rounded-xl anim-shimmer" />
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="panel rounded-2xl p-10 text-center space-y-3 border border-dashed border-border">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-primary/15 to-accent/15 grid place-items-center">
              <Inbox size={24} className="text-primary-glow" />
            </div>
            <div className="font-display text-sm">No hay publicaciones aún</div>
            <div className="text-xs text-muted-foreground max-w-xs mx-auto">Sé el primero en compartir algo con la comunidad — un juego, un dibujo o una idea.</div>
            <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="mt-2 h-9 px-5 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground text-xs font-display tracking-widest shadow-sm active:scale-95 transition-transform duration-300 ease-out">
              CREAR PUBLICACIÓN
            </button>
          </motion.div>
        ) : (
          <AnimatePresence mode="popLayout">
            {posts.map((p, i) => (
              <motion.div
                key={p.id}
                layout
                initial={{ opacity: 0, y: 24, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.18 } }}
                transition={{ duration: 0.4, delay: Math.min(i * 0.06, 0.6), ease: [0.22, 1, 0.36, 1] }}
              >
                <PostCard key={p.id} post={p} myId={myId} isMod={mod} onChange={reload} />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </main>
    </div>
  );
}
