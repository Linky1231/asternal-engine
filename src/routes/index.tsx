import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gamepad2, Newspaper, Search, LogOut, Wrench, Plus, ShieldCheck, User, Sparkles, Star, Menu, Bell, X, Home, Users, Flame, MessageSquare, Palette, Trophy, History, Clock, BarChart3, ChevronDown, ChevronRight, Globe, Heart, Megaphone, Database } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchFeed, fetchGames, getMyProfile, isMod, isAdmin, type PostWithMeta, type Profile } from "@/lib/social/api";
import { PostComposer } from "@/components/social/PostComposer";
import { PostCard } from "@/components/social/PostCard";
import { GamesHome } from "@/components/social/GamesHome";
import { NotificationBell } from "@/components/social/NotificationBell";
import { ProfilePanel } from "@/components/social/ProfilePanel";
import { NotificationsInline } from "@/components/social/NotificationsInline";
import { ForumSection } from "@/components/social/ForumSection";
import { GallerySection } from "@/components/social/GallerySection";
import { EventsSection } from "@/components/social/EventsSection";
import { HistorySection } from "@/components/social/HistorySection";
import { SupabaseSetupDialog } from "@/components/social/SupabaseSetupDialog";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Asternal — Juegos y Comunidad" },
      { name: "description", content: "Descubre y juega creaciones hechas con Asternal. Crea las tuyas y publícalas al instante." },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" },
    ],
  }),
  component: HomePage,
});

type Tab = "games" | "feed" | "gallery" | "events" | "profile" | "history";
type FeedSub = "forYou" | "following" | "trending" | "forums";

function HomePage() {
  const navigate = useNavigate();
  const [me, setMe] = useState<Profile | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [mod, setMod] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [tab, setTab] = useState<Tab>("games");
  const [feedSub, setFeedSub] = useState<FeedSub>("forYou");
  const [games, setGames] = useState<PostWithMeta[]>([]);
  const [posts, setPosts] = useState<PostWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuMounted, setMenuMounted] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [inPreview, setInPreview] = useState(false);

  // When the app runs embedded in the Freebuff preview (inside an iframe), the
  // platform's floating button overlaps the top-right of the app. Push the
  // header row down so the menu (☰) stays visible and tappable there.
  useEffect(() => {
    try {
      setInPreview(typeof window !== "undefined" && window.self !== window.top);
    } catch { /* cross-origin access can throw; treat as standalone */ }
  }, []);

  const reload = useCallback(async (which: Tab) => {
    if (which === "profile") return;
    setLoading(true);
    try {
      if (which === "games") setGames(await fetchGames({ search: search || undefined }));
      else setPosts(await fetchFeed({ search: search || undefined }));
      getMyProfile().then(p => p && setMe(p)).catch(() => {/* ignore */});
    } finally { setLoading(false); }
  }, [search]);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate({ to: "/auth" }); return; }
      setMyId(session.user.id);
      setMe(await getMyProfile());
      setMod(await isMod());
      setAdmin(await isAdmin());
      await reload(tab);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (myId) reload(tab); }, [tab, reload, myId]);

  // Clean two-phase mount/animate for the drawer.
  useEffect(() => {
    if (menuOpen) {
      setMenuMounted(true);
      // Wait one paint after mount, then flip data-open to trigger the transition.
      let raf1 = 0;
      let raf2 = 0;
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setMenuVisible(true));
      });
      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
      };
    }
    if (!menuMounted) return;
    setMenuVisible(false);
    const t = window.setTimeout(() => {
      setMenuMounted(false);
      setNotifOpen(false);
    }, 360);
    return () => window.clearTimeout(t);
  }, [menuOpen, menuMounted]);

  const logout = async () => { await supabase.auth.signOut(); navigate({ to: "/auth" }); };
  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="min-h-screen w-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="app-header sticky top-0 z-20 bg-background/92 backdrop-blur-xl border-b border-border/60">
        <div className={`max-w-2xl mx-auto flex items-center gap-2 px-4 ${inPreview ? "pt-14 pb-3" : "py-3"}`}>
          <button onClick={() => setTab("profile")} title="Mi perfil"
            className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent grid place-items-center shadow-[0_2px_10px_-3px_oklch(0.488_0.185_264/0.45)] active:scale-95 transition overflow-hidden shrink-0">
            {me?.avatar_url ? (
              <img src={me.avatar_url} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="font-display text-sm text-primary-foreground">
                {(me?.display_name ?? me?.username ?? "A")[0]?.toUpperCase()}
              </span>
            )}
          </button>
          <div className="flex-1 min-w-0">
            <div className="font-display text-sm font-semibold text-foreground leading-none truncate">Asternal</div>
            <div className="text-[11px] text-muted-foreground/70 truncate mt-0.5">@{me?.username ?? "…"}</div>
          </div>
          {typeof me?.orbes === "number" && me?.show_orbes !== false && (
            <Link
              to="/orbes"
              title={`${me.orbes} orbes · Ver panel`}
              className="flex items-center gap-1 px-2 h-9 rounded-xl bg-primary/10 border border-primary/20 shadow-sm active:scale-95 shrink-0"
            >
              <Sparkles size={13} className="text-primary" fill="currentColor" />
              <span className="text-xs font-display font-semibold tabular-nums">{me.orbes}</span>
            </Link>
          )}
          <button onClick={() => setMenuOpen(true)} title="Menú"
            className="w-9 h-9 rounded-xl border border-border/70 hover:bg-muted/60 bg-background grid place-items-center active:scale-95 transition shrink-0">
            <Menu size={16} />
          </button>
        </div>




        {showSearch && (
          <div className="max-w-2xl mx-auto px-3 pb-2 flex gap-2 animate-in fade-in slide-in-from-top-2">
            <input value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === "Enter" && reload(tab)}
              placeholder={tab === "games" ? "Buscar juegos…" : "Buscar publicaciones…"}
              className="flex-1 bg-input/50 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40" />
            <button onClick={() => reload(tab)} className="px-3 py-2 rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground text-xs font-display tracking-widest shadow-[0_2px_8px_-3px_oklch(0.488_0.185_264/0.4)] active:scale-95 transition">IR</button>
          </div>
        )}

        {/* Tabs */}
        <div className="max-w-2xl mx-auto px-3 pb-2">
          <div className="relative flex bg-muted/50 rounded-2xl p-0.5">
            <button
              onClick={() => setTab("games")}
              className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-display tracking-widest transition-colors duration-200 ${tab === "games" ? "text-primary-foreground" : "text-muted-foreground"}`}
            >
              <Gamepad2 size={14} /> JUEGOS
            </button>
            <button
              onClick={() => setTab("feed")}
              className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-display tracking-widest transition-colors duration-200 ${tab === "feed" ? "text-primary-foreground" : "text-muted-foreground"}`}
            >
              <Newspaper size={14} /> FEED
            </button>
            <button
              onClick={() => setTab("gallery")}
              className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-display tracking-widest transition-colors duration-200 ${tab === "gallery" ? "text-primary-foreground" : "text-muted-foreground"}`}
            >
              <Palette size={14} /> GALERÍA
            </button>
            <button
              onClick={() => setTab("events")}
              className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-display tracking-widest transition-colors duration-200 ${tab === "events" ? "text-primary-foreground" : "text-muted-foreground"}`}
            >
              <Trophy size={14} /> EVENTOS
            </button>
            <button
              onClick={() => setTab("profile")}
              className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-display tracking-widest transition-colors duration-200 ${tab === "profile" ? "text-primary-foreground" : "text-muted-foreground"}`}
            >
              <User size={14} /> PERFIL
            </button>
            <div
              className="absolute top-1 bottom-1 w-[calc(20%_-_4px)] rounded-xl bg-gradient-to-br from-primary to-accent shadow-sm transition-transform duration-300 ease-out"
              style={{ transform: `translateX(${tab === "games" ? "0%" : tab === "feed" ? "calc(100% + 6px)" : tab === "gallery" ? "calc(200% + 12px)" : tab === "events" ? "calc(300% + 18px)" : "calc(400% + 24px)"})` }}
            />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-3 py-3 space-y-3 pb-24">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={tab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="space-y-3"
          >
            {tab === "games" ? (
              loading ? <SkeletonList /> : (
                <GamesHome games={games} myId={myId} isMod={mod} onChange={() => reload("games")} />
              )
            ) : tab === "feed" ? (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                >
                  <PostComposer onCreated={() => reload("feed")} />
                </motion.div>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15, delay: 0.05, ease: "easeOut" }}
                >
                  <FeedSubTabs value={feedSub} onChange={setFeedSub} />
                </motion.div>
                <motion.div
                  key={feedSub}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.12, ease: "easeOut" }}
                >
                  {feedSub === "forums" ? (
                    <ForumSection isAdmin={admin} isMod={mod} />
                  ) : loading ? <SkeletonList /> : (() => {
                    const filtered = filterFeed(posts, feedSub, myId);
                    if (filtered.length === 0) {
                      return (
                        <div className="text-center text-xs text-muted-foreground py-10">
                          {feedSub === "forYou"
                            ? "Sé el primero en publicar o sigue a creadores para ver su contenido aquí."
                            : feedSub === "following"
                            ? "Interactúa con publicaciones (like, favorito) para poblar esta sección."
                            : feedSub === "trending"
                            ? "Aún no hay tendencias. ¡Publica algo!"
                            : ""}
                        </div>
                      );
                    }
                    return filtered.map((p, i) => (
                      <motion.div
                        key={p.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.15, delay: Math.min(i * 0.02, 0.15), ease: "easeOut" }}
                      >
                        <PostCard key={p.id} post={p} myId={myId} isMod={mod} onChange={() => reload("feed")} />
                      </motion.div>
                    ));
                  })()}
                </motion.div>
              </>
            ) : tab === "gallery" ? (
              <GallerySection myId={myId} isMod={mod} />
            ) : tab === "events" ? (
              <EventsSection isAdmin={admin} />
            ) : tab === "history" ? (
              <HistorySection />
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
              >
                {myId && <ProfilePanel userId={myId} myId={myId} isMod={mod} viewingOwn={true} onProfileChange={setMe} />}
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Floating CTA to editor */}
      <Link
        to="/editor"
        className="fixed bottom-5 right-5 z-30 h-14 pl-4 pr-5 rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-[0_6px_24px_-6px_oklch(0.488_0.185_264/0.5)] flex items-center gap-2 active:scale-95 transition font-display tracking-widest text-xs"
      >
        <Plus size={18} /> CREAR
      </Link>

      {/* Supabase setup dialog */}
      <SupabaseSetupDialog open={setupOpen} onOpenChange={setSetupOpen} />

      {/* Menu drawer */}
      {menuMounted && (
        <div
          className="fixed inset-0 z-[100] asternal-menu-overlay"
          data-open={menuVisible ? "true" : "false"}
          onClick={closeMenu}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="absolute right-0 top-0 h-full w-[86vw] max-w-xs bg-background border-l border-border shadow-lg p-4 flex flex-col gap-2 asternal-menu-drawer overflow-y-auto"
            data-open={menuVisible ? "true" : "false"}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="font-display text-xs tracking-widest text-primary-glow">MENÚ</div>
              <button onClick={closeMenu} className="w-8 h-8 rounded-lg border border-border grid place-items-center active:scale-95 bg-background"><X size={14}/></button>
            </div>
            {/* Categoría: SOCIAL */}
            <CategoryHeader label="SOCIAL" />
            <MenuItem icon={<Search size={16}/>} label="Buscar" onClick={() => { setShowSearch(s => !s); closeMenu(); }} />
            <MenuItem icon={<Bell size={16}/>} label="Notificaciones" onClick={() => setNotifOpen(o => !o)} />
            {notifOpen && <NotificationsInline />}

            {/* Categoría: COMUNIDAD */}
            <CategoryHeader label="COMUNIDAD" />
            <MenuItem icon={<BarChart3 size={16} className="text-primary-glow"/>} label="Historial" onClick={() => { setTab("history"); closeMenu(); }} />
            <MenuLink icon={<Megaphone size={16} className="text-primary"/>} label="Panel de Orbes" to="/orbes" onClick={closeMenu} />
            {(mod || admin) && (
              <MenuLink icon={<ShieldCheck size={16} className="text-primary-glow"/>} label="Moderación" to="/admin" onClick={closeMenu} />
            )}

            {/* Categoría: CREACIÓN */}
            <CategoryHeader label="CREACIÓN" />
            <MenuLink icon={<Wrench size={16} className="text-primary-glow"/>} label="Editor" to="/editor" onClick={closeMenu} />
            <MenuLink icon={<Star size={16} fill="currentColor" style={{ color: "var(--plus)" }}/>} label="Centro Plus" to="/plus" onClick={closeMenu} />

            {/* Categoría: SISTEMA */}
            <CategoryHeader label="SISTEMA" />
            <MenuItem icon={<Database size={16} className="text-primary-glow"/>} label="Supabase" onClick={() => { setSetupOpen(true); closeMenu(); }} />

            <div className="flex-1 min-h-4" />
            <button onClick={() => { logout(); closeMenu(); }}
              className="flex items-center gap-3 px-3 h-11 rounded-xl border border-border bg-background text-destructive active:scale-[0.98] transition">
              <LogOut size={16} /> <span className="text-sm font-medium">Cerrar sesión</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map(i => (
        <div key={i} className="panel rounded-2xl border border-border/50 overflow-hidden animate-pulse">
          <div className="aspect-[16/10] bg-muted/40" />
          <div className="p-3 space-y-2">
            <div className="h-3 w-1/2 bg-muted/50 rounded" />
            <div className="h-2.5 w-1/3 bg-muted/40 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

function MenuLink({ icon, label, to, onClick }: { icon: React.ReactNode; label: string; to: string; onClick?: () => void }) {
  return (
    <Link to={to} onClick={onClick}
      className="flex items-center gap-3 px-3 h-11 rounded-xl border border-border bg-background hover:bg-muted/60 active:scale-[0.98] transition">
      {icon} <span className="text-sm font-medium">{label}</span>
    </Link>
  );
}

function MenuItem({ icon, label, onClick, children }: { icon: React.ReactNode; label: string; onClick?: () => void; children?: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-3 px-3 h-11 rounded-xl border border-border bg-background hover:bg-muted/60 active:scale-[0.98] transition w-full text-left">
      {icon} <span className="text-sm font-medium flex-1">{label}</span>
      {children}
    </button>
  );
}

function CategoryHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 pt-1 pb-0.5">
      <div className="text-[10px] font-display tracking-[0.15em] text-muted-foreground/60">{label}</div>
      <div className="flex-1 h-px bg-border/40" />
    </div>
  );
}

function FeedSubTabs({ value, onChange }: { value: FeedSub; onChange: (v: FeedSub) => void }) {
  const items: { id: FeedSub; label: string; icon: React.ReactNode }[] = [
    { id: "forYou", label: "Para ti", icon: <Home size={13} /> },
    { id: "following", label: "Seguidos", icon: <Users size={13} /> },
    { id: "trending", label: "Tendencias", icon: <Flame size={13} /> },
    { id: "forums", label: "Foros", icon: <MessageSquare size={13} /> },
  ];
  return (
    <div className="flex gap-2 py-2">
      {items.map(it => {
        const active = value === it.id;
        return (
          <button
            key={it.id}
            onClick={() => onChange(it.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-display tracking-widest transition-all duration-200 outline-none focus:outline-none ${
              active
              ? "bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-[0_2px_8px_-3px_oklch(0.488_0.185_264/0.35)]"
              : "bg-background text-muted-foreground hover:text-foreground"
            }`}
            style={active ? undefined : { boxShadow: "inset 0 0 0 1px var(--color-border)" }}
          >
            {it.icon} {it.label.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}

function computeForYouScore(
  p: PostWithMeta,
  now: number,
  authorCounts: Map<string, number>,
): number {
  // --- Raw engagement (weighted) ---
  const likes = p.likes ?? 0;
  const favs = p.favorites ?? 0;
  const comments = p.comments_count ?? 0;
  const reposts = p.reposts_count ?? 0;

  const engagement =
    likes * 1.0 +
    favs * 2.5 +
    comments * 3.0 +
    reposts * 4.0;

  // --- Recency: exponential decay (24h half-life) ---
  const ageMs = now - new Date(p.created_at).getTime();
  const ageH = Math.max(0.01, ageMs / 36e5);
  const HALF_LIFE = 24; // hours
  const recencyFactor = Math.pow(0.5, ageH / HALF_LIFE);

  // --- Freshness burst: posts < 24h get a boost that fades linearly ---
  const freshBoost = ageH < 24 ? 1 + (1 - ageH / 24) * 0.7 : 1;

  // --- Media bonus ---
  const hasMedia = p.media_type === "image" || p.media_type === "video";
  const hasCover = !!p.cover_url;
  const mediaBonus = hasMedia || hasCover ? 1.25 : 1;

  // --- Engagement rate (interactions per hour) ---
  const totalInteractions = likes + favs + comments + reposts;
  const rateBonus = ageH > 0.5
    ? 1 + Math.min(2, (totalInteractions / ageH) * 0.2)
    : 2; // very fresh posts get a generous rate bonus

  // --- Author diversity penalty ---
  const authorCount = authorCounts.get(p.author_id) ?? 0;
  // First post: no penalty. Second: -30%. Third+: -60%.
  const diversityPenalty = authorCount === 0 ? 1
    : authorCount === 1 ? 0.7
    : 0.4;

  // --- Base score ---
  let score = engagement * recencyFactor * freshBoost * mediaBonus * rateBonus * diversityPenalty;

  // --- Small chaotic jitter (±8%) for natural variety in ties ---
  score *= 0.92 + Math.random() * 0.16;

  return score;
}

function filterFeed(posts: PostWithMeta[], sub: FeedSub, myId: string | null): PostWithMeta[] {
  const now = Date.now();

  if (sub === "forYou") {
    const authorCounts = new Map<string, number>();

    const scored = [...posts]
      .map(p => {
        const score = computeForYouScore(p, now, authorCounts);
        // Track author count AFTER scoring so the penalty is based on *prior* entries
        authorCounts.set(p.author_id, (authorCounts.get(p.author_id) ?? 0) + 1);
        return { p, score };
      })
      .sort((a, b) => b.score - a.score);

    return scored.map(x => x.p);
  }

  if (sub === "trending") {
    return [...posts]
      .map(p => {
        const likes = p.likes ?? 0;
        const favs = p.favorites ?? 0;
        const comments = p.comments_count ?? 0;
        const reposts = p.reposts_count ?? 0;
        const ageH = Math.max(1, (now - new Date(p.created_at).getTime()) / 36e5);
        // Trending favours raw velocity
        const velocity = (likes + favs * 3 + comments * 2 + reposts * 5) / Math.pow(ageH + 1, 0.6);
        return { p, score: velocity };
      })
      .sort((a, b) => b.score - a.score)
      .map(x => x.p);
  }

  if (sub === "following") {
    if (!myId) return [];
    const engagedAuthors = new Set(
      posts.filter(p => p.my_like || p.my_favorite || p.my_repost).map(p => p.author_id),
    );
    engagedAuthors.delete(myId);
    return posts.filter(p => engagedAuthors.has(p.author_id));
  }

  return posts;
}


