import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, LogOut, Wrench, Plus, ShieldCheck, MessageCircle, Sparkles, Star, Menu, Bell, X, Home, Users, Flame, MessageSquare } from "lucide-react";
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

type Tab = "games" | "feed" | "gallery" | "profile";
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuMounted, setMenuMounted] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

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
      const r1 = requestAnimationFrame(() => {
        const r2 = requestAnimationFrame(() => setMenuVisible(true));
        (r1 as unknown as { r2?: number }).r2 = r2;
      });
      return () => cancelAnimationFrame(r1);
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
    <div className="min-h-screen w-screen flex flex-col bg-background text-foreground relative">
      {/* Ambient liquid glass background — morphing blobs */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute -top-60 -right-60 w-[600px] h-[600px] bg-gradient-to-br from-primary/8 via-accent/5 to-transparent morph-blob-1 will-change-transform" />
        <div className="absolute -bottom-60 -left-60 w-[500px] h-[500px] bg-gradient-to-tr from-accent/5 via-primary/6 to-transparent morph-blob-2 will-change-transform" />
        <div className="absolute top-1/3 left-1/3 w-[400px] h-[400px] bg-gradient-to-r from-primary/4 via-accent/3 to-primary/4 morph-blob-3 will-change-transform" />
      </div>

      {/* Header */}
      <header className="app-header sticky top-0 z-20 liquid-glass border-b-0 shadow-liquid border-glass-border">
        <div className="max-w-2xl mx-auto flex items-center gap-2 px-3 py-2.5">
          <button onClick={() => setTab("profile")} title="Mi perfil"
            className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent grid place-items-center shadow-[0_6px_16px_-6px_oklch(0.54_0.175_255/0.6)] active:scale-95 transition overflow-hidden shrink-0">
            {me?.avatar_url ? (
              <img src={me.avatar_url} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="font-display text-sm text-primary-foreground">
                {(me?.display_name ?? me?.username ?? "A")[0]?.toUpperCase()}
              </span>
            )}
          </button>
          <div className="flex-1 min-w-0">
            <div className="font-display text-sm text-primary glow-text leading-none truncate">ASTERNAL</div>
            <div className="text-[10px] font-mono text-muted-foreground truncate">@{me?.username ?? "…"}</div>
          </div>
          {typeof me?.orbes === "number" && me?.show_orbes !== false && (
            <Link
              to="/orbes"
              title={`${me.orbes} orbes · Ver panel`}
              className="flex items-center gap-1 px-2 h-9 rounded-xl glass border-glass-border hover:bg-white/70 shadow-sm active:scale-95 shrink-0 transition-all"
            >
              <Sparkles size={13} className="text-primary" fill="currentColor" />
              <span className="text-xs font-display font-semibold tabular-nums">{me.orbes}</span>
            </Link>
          )}
          <button onClick={() => setMenuOpen(true)} title="Menú"
            className="w-9 h-9 rounded-xl glass border-glass-border grid place-items-center active:scale-95 transition shrink-0 hover:bg-white/70">
            <Menu size={16} />
          </button>
        </div>

        {showSearch && (
          <div className="max-w-2xl mx-auto px-3 pb-2 flex gap-2 animate-in fade-in slide-in-from-top-2">
            <div className="flex-1 flex items-center gap-2 glass-inset px-3 py-0">
              <Search size={14} className="text-muted-foreground/50 shrink-0" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === "Enter" && reload(tab)}
                placeholder={tab === "games" ? "Buscar juegos…" : "Buscar publicaciones…"}
                className="flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-muted-foreground/40" />
            </div>
            <button onClick={() => reload(tab)} className="px-4 py-2 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground text-xs font-display tracking-widest active:scale-95 shadow-md shadow-primary/20 transition-all">IR</button>
          </div>
        )}

        {/* Tabs - glass pill container */}
        <div className="max-w-2xl mx-auto px-3 pb-2">
          <div className="flex glass-inset p-1">
            <TabButton active={tab === "games"} onClick={() => setTab("games")}>
              JUEGOS
            </TabButton>
            <TabButton active={tab === "feed"} onClick={() => setTab("feed")}>
              FEED
            </TabButton>
            <TabButton active={tab === "gallery"} onClick={() => setTab("gallery")}>
              GALERÍA
            </TabButton>
            <TabButton active={tab === "profile"} onClick={() => setTab("profile")}>
              PERFIL
            </TabButton>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-3 py-3 space-y-3 pb-24">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-3"
          >
            {tab === "games" ? (
              loading ? <SkeletonList /> : (
                <GamesHome games={games} myId={myId} isMod={mod} onChange={() => reload("games")} />
              )
            ) : tab === "feed" ? (
              <>
                <motion.div
                  initial={{ opacity: 0, y: -8, filter: "blur(2px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{ duration: 0.3, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
                >
                  <PostComposer onCreated={() => reload("feed")} />
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: 0.14, ease: [0.22, 1, 0.36, 1] }}
                >
                  <FeedSubTabs value={feedSub} onChange={setFeedSub} />
                </motion.div>
                <motion.div
                  key={feedSub}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                >
                  {feedSub === "forums" ? (
                    <ForumSection isAdmin={admin} isMod={mod} />
                  ) : loading ? <SkeletonList /> : (() => {
                    const filtered = filterFeed(posts, feedSub, myId);
                    if (filtered.length === 0) {
                      return (
                        <div className="text-center text-xs text-muted-foreground py-10">
                          {feedSub === "following"
                            ? "Interactúa con publicaciones para poblar esta sección."
                            : feedSub === "trending"
                            ? "Aún no hay tendencias. ¡Publica algo!"
                            : "Sé el primero en publicar."}
                        </div>
                      );
                    }
                    return filtered.map((p, i) => (
                      <motion.div
                        key={p.id}
                        initial={{ opacity: 0, y: 12, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.3, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
                      >
                        <PostCard key={p.id} post={p} myId={myId} isMod={mod} onChange={() => reload("feed")} />
                      </motion.div>
                    ));
                  })()}
                </motion.div>
              </>
            ) : tab === "gallery" ? (
              <GallerySection myId={myId} isMod={mod} />
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              >
                {myId && <ProfilePanel userId={myId} myId={myId} isMod={mod} viewingOwn={true} />}
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Floating CTA to editor — liquid glass pill */}
      <Link
        to="/editor"
        className="fixed bottom-5 right-5 z-30 h-14 pl-4 pr-5 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-[0_10px_30px_-6px_oklch(0.54_0.175_255/0.7)] flex items-center gap-2 active:scale-90 hover:scale-105 hover:shadow-[0_14px_40px_-8px_oklch(0.54_0.175_255/0.8)] transition-all duration-200 font-display tracking-widest text-xs liquid-glass-border"
      >
        <Plus size={18} /> CREAR
      </Link>

      {/* Menu drawer */}
      {menuMounted && (
        <div
          className="fixed inset-0 z-[100] asternal-menu-overlay"
          data-open={menuVisible ? "true" : "false"}
          onClick={closeMenu}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="absolute right-0 top-0 h-full w-[86vw] max-w-xs bg-background border-l border-border shadow-2xl p-4 flex flex-col gap-2 asternal-menu-drawer overflow-y-auto"
            data-open={menuVisible ? "true" : "false"}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="font-display text-xs tracking-widest text-primary">MENÚ</div>
              <button onClick={closeMenu} className="w-8 h-8 rounded-lg glass border-glass-border grid place-items-center active:scale-95"><X size={14}/></button>
            </div>
            <MenuItem icon={<Search size={16}/>} label="Buscar" onClick={() => { setShowSearch(s => !s); closeMenu(); }} />
            <MenuLink icon={<MessageCircle size={16}/>} label="Mensajes" to="/chats" onClick={closeMenu} />
            <MenuItem icon={<Bell size={16}/>} label="Notificaciones" onClick={() => setNotifOpen(o => !o)} />
            {notifOpen && <NotificationsInline />}
            {(mod || admin) && (
              <MenuLink icon={<ShieldCheck size={16} className="text-primary"/>} label="Moderación" to="/admin" onClick={closeMenu} />
            )}
            <MenuLink icon={<Star size={16} fill="currentColor" style={{ color: "var(--plus)" }}/>} label="Centro Plus" to="/plus" onClick={closeMenu} />
            <MenuLink icon={<Wrench size={16} className="text-primary"/>} label="Editor" to="/editor" onClick={closeMenu} />
            <MenuLink icon={<Sparkles size={16} className="text-primary"/>} label="Panel de Orbes" to="/orbes" onClick={closeMenu} />
            <div className="flex-1 min-h-4" />
            <button onClick={() => { logout(); closeMenu(); }}
              className="flex items-center gap-3 px-3 h-11 rounded-xl glass border-glass-border text-destructive hover:bg-white/70 active:scale-[0.98] transition-all">
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
        <div key={i} className="glass rounded-2xl border-glass-border overflow-hidden animate-pulse">
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
      className="flex items-center gap-3 px-3 h-11 rounded-xl glass border-glass-border hover:bg-white/70 active:scale-[0.98] transition-all">
      {icon} <span className="text-sm font-medium">{label}</span>
    </Link>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="relative flex-1 flex items-center justify-center py-2 rounded-xl text-[11px] font-display tracking-[0.12em] font-semibold active:scale-90 transition-all duration-200"
    >
      {active && (
        <motion.div
          className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary to-accent shadow-[0_4px_14px_-4px_oklch(0.54_0.175_255/0.55)]"
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.85 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
        />
      )}
      <span className={`relative z-10 transition-colors duration-150 ${active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
        {children}
      </span>
    </button>
  );
}

function MenuItem({ icon, label, onClick, children }: { icon: React.ReactNode; label: string; onClick?: () => void; children?: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-3 px-3 h-11 rounded-xl glass border-glass-border hover:bg-white/70 active:scale-[0.98] transition-all w-full text-left">
      {icon} <span className="text-sm font-medium flex-1">{label}</span>
      {children}
    </button>
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
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-display tracking-widest transition-all duration-200 outline-none focus:outline-none active:scale-95 ${
              active
                ? "bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-md shadow-primary/20"
                : "glass border-glass-border hover:bg-white/70 text-muted-foreground hover:text-foreground"
            }`}
          >
            {active && (
              <motion.span
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 20 }}
              >
                {it.icon}
              </motion.span>
            )}
            {!active && it.icon}
            {" "}{it.label.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}

function filterFeed(posts: PostWithMeta[], sub: FeedSub, myId: string | null): PostWithMeta[] {
  if (sub === "trending") {
    const now = Date.now();
    return [...posts]
      .map(p => {
        const ageH = Math.max(1, (now - new Date(p.created_at).getTime()) / 36e5);
        const score = ((p.likes ?? 0) + (p.favorites ?? 0) * 2 + (p.comments_count ?? 0) * 1.5) / Math.pow(ageH + 2, 0.8);
        return { p, score };
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


