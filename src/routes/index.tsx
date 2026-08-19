import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Avatar } from "@/components/social/Avatar";
import { Component, useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gamepad2, Newspaper, Search, LogOut, Wrench, Plus, ShieldCheck, User, Sparkles, Star, Menu, MessageCircle, Bell, X, Home, Users, Flame, MessageSquare, Palette, Trophy, BarChart3, ChevronRight, Megaphone, Bot } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { fetchFeed, fetchGames, getMyProfile, isMod, isAdmin, type PostWithMeta, type Profile } from "@/lib/social/api";
import { syncAllProjects } from "@/lib/engine/cloud-sync";
import { PostComposer } from "@/components/social/PostComposer";
import { PostCard } from "@/components/social/PostCard";
import { GamesHome } from "@/components/social/GamesHome";
import { NotificationBell } from "@/components/social/NotificationBell";
import { ProfilePanel } from "@/components/social/ProfilePanel";
import { NotificationsPanel } from "@/components/social/NotificationsPanel";
import ChatSection from "@/components/social/ChatSection";
import OrionPanel from "@/components/ai/OrionPanel";
import { ForumSection } from "@/components/social/ForumSection";
import { GallerySection } from "@/components/social/GallerySection";
import { EventsSection } from "@/components/social/EventsSection";
import { SegmentedControl } from "@/components/ui/segmented";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Asternal — Juegos y Comunidad" },
      { name: "description", content: "Descubre y juega creaciones hechas con Asternal. Crea las tuyas y publícalas al instante." },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" },
    ],
  }),
  component: HomePage,
});

type Tab = "games" | "feed" | "gallery" | "events" | "profile";
type FeedSub = "forYou" | "following" | "trending" | "forums";

/**
 * Aisla el chat: si algo falla dentro de él (error inesperado de render o
 * efecto), solo se cierra el chat con un aviso en vez de tumbar toda la app
 * con la página de error de la ruta.
 */
class ChatBoundary extends Component<
  { onClose: () => void; onRetry: () => void; children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) {
      return (
        <div className="fixed inset-0 z-[90] bg-background/97 backdrop-blur-xl grid place-items-center p-6">
          <div className="text-center max-w-xs">
            <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-destructive/10 grid place-items-center">
              <MessageCircle size={20} className="text-destructive" />
            </div>
            <p className="text-sm font-semibold mb-1">El chat tuvo un problema</p>
            <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
              Cierra y vuelve a abrirlo. Si persiste, revisa la conexión de Supabase.
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={this.props.onRetry}
                className="px-4 py-2 rounded-xl btn-grad text-xs font-display tracking-widest"
              >
                REINTENTAR
              </button>
              <button
                onClick={this.props.onClose}
                className="px-4 py-2 rounded-xl border border-line-strong bg-card text-foreground text-xs font-display tracking-widest hover:bg-muted/60 transition"
              >
                VOLVER
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInitialView, setChatInitialView] = useState<"group" | "dms" | "groups" | undefined>(undefined);
  const [chatRetryNonce, setChatRetryNonce] = useState(0);
  const [orionOpen, setOrionOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [chatShareText, setChatShareText] = useState<string | null>(null);
  const [chatShareView, setChatShareView] = useState<"group" | "dms" | "groups" | undefined>(undefined);
  const [inPreview, setInPreview] = useState(false);

  // When the app runs embedded in the Freebuff preview (inside an iframe), the
  // platform's floating button overlaps the top-right of the app. Push the
  // header row down so the menu (☰) stays visible and tappable there.
  useEffect(() => {
    try {
      setInPreview(typeof window !== "undefined" && window.self !== window.top);
    } catch { /* cross-origin access can throw; treat as standalone */ }
  }, []);

  // Abrir el chat con un mensaje compartido (botón «Compartir en el chat» del perfil).
  useEffect(() => {
    try {
      const t = sessionStorage.getItem("asternal_chat_share");
      if (t) {
        sessionStorage.removeItem("asternal_chat_share");
        setChatShareText(t);
        setChatOpen(true);
      }
    } catch { /* noop */ }
    // También escuchar CustomEvents para compartir en tiempo real (sin depender de remount)
    const handler = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (typeof d === "string") {
        setChatShareText(d);
        setChatOpen(true);
      } else if (d && typeof d === "object") {
        setChatShareText(d.text ?? null);
        setChatShareView(d.view ?? undefined);
        setChatOpen(true);
      }
    };
    window.addEventListener("asternal_share_chat", handler);
    return () => window.removeEventListener("asternal_share_chat", handler);
  }, []);

  // Al cambiar de apartado del encabezado (JUEGOS/FEED/GALERÍA/EVENTOS/PERFIL)
  // la página vuelve al inicio: si estabas scrolleado abajo, la nueva sección
  // empezaba desde esa posición y no se veían su cabecera ni su indicador de
  // carga. Al reiniciar el scroll siempre se muestra desde arriba.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [tab]);

  const reload = useCallback(async (which: Tab) => {
    if (which === "profile") return;
    setLoading(true);
    try {
      if (which === "games") setGames(await fetchGames({ search: search || undefined }));
      else setPosts(await fetchFeed({ search: search || undefined }));
      getMyProfile().then(p => p && setMe(p)).catch(() => {/* ignore */});
    } finally { setLoading(false); }
  }, [search]);

  // Callback estable para PostCard (memoizado): no cambia de identidad en cada
  // render, así abrir un menú en una tarjeta no fuerza a re-renderizar el resto.
  const onFeedChange = useCallback(() => reload("feed"), [reload]);

  useEffect(() => {
    (async () => {
      try {
        let session = null;
        try {
          const res = await supabase.auth.getSession();
          session = res.data?.session ?? null;
        } catch {
          /* Credenciales de Supabase rotas/inaccesibles → se intenta la cuenta local */
        }
        let uid: string | null = session?.user?.id ?? null;
        let localSession = false;
        if (!uid) {
          // Puente: cuenta local creada antes de conectar Supabase (o credenciales
          // inválidas). La app sigue funcionando en modo local en lugar de
          // redirigir en bucle a /auth.
          try {
            const raw = localStorage.getItem("_local_auth_session");
            if (raw) {
              const s = JSON.parse(raw) as { userId?: string; expiresAt?: string };
              if (s.userId && s.expiresAt && new Date(s.expiresAt) > new Date()) {
                uid = s.userId;
                localSession = true;
              }
            }
          } catch { /* noop */ }
        }
        if (!uid) { navigate({ to: "/auth" }); return; }
        setMyId(uid);
        // Estado de la nube: conectada (claves reales + cuenta real), cuenta
        // local con Supabase conectado, o modo local puro (todo en el navegador).
        // Sincroniza los proyectos con la nube (sube los locales sin respaldo y
        // descarga los de la cuenta) para que los juegos aparezcan en cualquier
        // dispositivo con la misma cuenta. Silencioso: no bloquea la carga.
        if (!localSession) {
          syncAllProjects().then(r => {
            if (r.pushed > 0 || r.imported > 0) {
              toast.success(
                `Nube sincronizada: ${r.pushed} subido${r.pushed === 1 ? "" : "s"} · ${r.imported} descargado${r.imported === 1 ? "" : "s"}`
              );
            }
          }).catch(() => {/* noop */});
        }
        let prof: Profile | null = null;
        try { prof = await getMyProfile(); } catch { /* noop */ }
        if (!prof && localSession) {
          // El perfil de la cuenta local vive en localStorage.
          try {
            const rows = JSON.parse(localStorage.getItem("_local_data_profiles") || "[]") as Profile[];
            prof = rows.find((p) => p.id === uid) ?? null;
          } catch { /* noop */ }
        }
        if (prof) setMe(prof);
        try { setMod(await isMod()); } catch { /* noop */ }
        try { setAdmin(await isAdmin()); } catch { /* noop */ }
        await reload(tab);
      } catch (e) {
        // No romper la preview si el esquema aún no está creado en Supabase.
        console.warn("[home] error de carga inicial (¿esquema sin crear?):", e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (myId) reload(tab); }, [tab, reload, myId]);

  const logout = async () => { await supabase.auth.signOut(); navigate({ to: "/auth" }); };
  const closeMenu = () => { setMenuOpen(false); setNotifOpen(false); };

  return (
    <div className="min-h-screen w-full flex flex-col bg-background text-foreground">
      {/* Header */}
      {/* bg casi opaco + blur reducido: el backdrop-blur-xl sobre un header
          sticky obligaba a re-desenfocar el fondo en cada frame de scroll → lag. */}
      <header className="app-header sticky top-0 z-20 bg-background border-b border-border/70">
        <div className={`max-w-2xl md:max-w-3xl lg:max-w-5xl xl:max-w-6xl mx-auto flex items-center gap-2 sm:gap-2.5 px-3 sm:px-4 ${inPreview ? "pt-14 pb-3" : "py-2.5"}`}>
          <button onClick={() => navigate({ to: "/profile" })} title="Mi perfil"
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl overflow-hidden border border-slate-900/5  active:scale-95 transition shrink-0">
            <Avatar p={me} className="w-full h-full" />
          </button>
          <div className="flex-1 min-w-0 header-name">
            <div className="font-display text-[13px] sm:text-sm font-semibold text-foreground leading-none truncate">Asternal</div>
            <div className="text-[10px] sm:text-[11px] text-ink-3 truncate mt-1">@{me?.username ?? "…"}</div>
          </div>
          {typeof me?.orbes === "number" && me?.show_orbes !== false && (
            <Link
              to="/orbes"
              title={`${me.orbes} orbes · Ver panel`}
              className="flex items-center gap-1.5 h-8 sm:h-9 px-2 sm:px-2.5 rounded-lg bg-primary/10 text-primary border border-primary/15 hover:bg-primary/15 active:scale-95 transition shrink-0"
            >
              <Sparkles size={12} className="text-primary shrink-0" fill="currentColor" />
              <span className="text-[11px] sm:text-xs font-display font-semibold tabular-nums">{me.orbes}</span>
            </Link>
          )}
          <button onClick={() => setMenuOpen(true)} title="Menú"
            className="w-9 h-9 rounded-lg border border-line-strong bg-card text-ink-2 grid place-items-center hover:bg-muted/60 hover:text-foreground active:scale-95 transition shrink-0">
            <Menu size={16} />
          </button>
        </div>

        {showSearch && (
          <div className="max-w-2xl md:max-w-3xl lg:max-w-5xl xl:max-w-6xl mx-auto px-3 pb-2 flex gap-2 animate-in fade-in slide-in-from-top-2">
            <input value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === "Enter" && reload(tab)}
              placeholder={tab === "games" ? "Buscar juegos…" : "Buscar publicaciones…"}
              className="flex-1 bg-card border border-line-strong rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground" />
            <button onClick={() => reload(tab)}
              className="px-4 py-2 rounded-lg btn-grad text-xs font-display tracking-widest shrink-0">IR</button>
          </div>
        )}

        {/* Tabs principales */}
        <div className="max-w-2xl md:max-w-3xl lg:max-w-5xl xl:max-w-6xl mx-auto px-3 pb-2.5">
          <SegmentedControl
            items={[
              { id: "games", label: <span className="hidden min-[380px]:inline">JUEGOS</span>, icon: <Gamepad2 size={14} className="shrink-0" />, title: "Juegos" },
              { id: "feed", label: <span className="hidden min-[380px]:inline">FEED</span>, icon: <Newspaper size={14} className="shrink-0" />, title: "Feed" },
              { id: "gallery", label: <span className="hidden min-[380px]:inline">GALERÍA</span>, icon: <Palette size={14} className="shrink-0" />, title: "Galería" },
              { id: "events", label: <span className="hidden min-[380px]:inline">EVENTOS</span>, icon: <Trophy size={14} className="shrink-0" />, title: "Eventos" },
              { id: "profile", label: <span className="hidden min-[380px]:inline">PERFIL</span>, icon: <User size={14} className="shrink-0" />, title: "Perfil" },
            ]}
            value={tab}
            onChange={setTab}
          />
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-2xl md:max-w-3xl lg:max-w-5xl xl:max-w-6xl mx-auto w-full px-3 py-3 space-y-3 pb-24">
        {/* mode="wait" en vez de popLayout: el popLayout mantiene las dos pestañas
            montadas y posicionadas de forma absoluta durante la transición (más DOM,
            más medición de layout). Con wait solo existe una a la vez y el fade es
            composited: cambio de pestaña sin lag. */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
            className="space-y-3"
          >
            {tab === "games" ? (
              loading ? <SkeletonList /> : (
                <GamesHome games={games} myId={myId} isMod={mod} onChange={() => reload("games")} />
              )
            ) : tab === "feed" ? (
              <div className="max-w-2xl md:max-w-3xl mx-auto w-full">
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
                      <div key={p.id} className="card-enter mb-3 last:mb-0" style={{ animationDelay: `${Math.min(i * 25, 180)}ms` }}>
                        <PostCard post={p} myId={myId} isMod={mod} onChange={onFeedChange} />
                      </div>
                    ));
                  })()}
                </motion.div>
              </div>
            ) : tab === "gallery" ? (
              <GallerySection myId={myId} isMod={mod} />
            ) : tab === "events" ? (
              <EventsSection isAdmin={admin} />
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
              >
                {myId && (
                  <div className="max-w-2xl md:max-w-3xl lg:max-w-4xl mx-auto w-full">
                    <ProfilePanel userId={myId} myId={myId} isMod={mod} viewingOwn={true} onProfileChange={setMe} />
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Floating CTA to editor */}
      <Link
        to="/editor"
        className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-[max(1.25rem,env(safe-area-inset-right))] z-30 h-14 pl-4 pr-5 rounded-xl btn-grad  flex items-center gap-2 active:scale-95 font-display tracking-widest text-xs"
      >
        <Plus size={18} strokeWidth={2} /> CREAR
      </Link>

      {/* Menu drawer — dos AnimatePresence separados (el fragment <> no desmonta en exit) */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            key="menu-overlay"
            className="fixed inset-0 z-[100] bg-black/55 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            onClick={closeMenu}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            key="menu-drawer"
            onClick={e => e.stopPropagation()}
            className="fixed right-0 top-0 z-[101] h-full w-[86vw] max-w-xs bg-card border-l border-border shadow-md p-4 flex flex-col gap-0.5 overflow-y-auto"
            initial={{ x: "100%", opacity: 0.4 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "tween", duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="section-label">MENÚ</div>
              <button onClick={closeMenu}
                className="w-8 h-8 rounded-lg border border-line-strong bg-card text-ink-2 grid place-items-center hover:bg-muted/60 hover:text-foreground active:scale-95 transition">
                <X size={14}/>
              </button>
            </div>
            {/* Acceso directo al perfil: al tocar la foto sales del menú y vas a tu perfil */}
            <button
              onClick={() => { closeMenu(); navigate({ to: "/profile" }); }}
              className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/50 active:scale-[0.98] transition mb-2 text-left group"
            >
              <Avatar p={me} size={44} className="ring-2 ring-primary/15" />
              <div className="min-w-0 flex-1">
                <div className="font-display text-sm truncate group-hover:text-primary transition-colors">{me?.display_name ?? me?.username ?? "Mi perfil"}</div>
                <div className="text-[11px] font-mono text-muted-foreground truncate">@{me?.username ?? "…"} · Ver perfil</div>
              </div>
              <ChevronRight size={16} className="text-muted-foreground/50 shrink-0 group-hover:translate-x-0.5 transition-transform" />
            </button>
            {/* Categoría: SOCIAL */}
            <CategoryHeader label="SOCIAL" />
            <MenuItem icon={<MessageCircle size={16} className="text-primary-glow"/>} label="Chats" onClick={() => { setChatOpen(true); closeMenu(); }} />
            <MenuItem icon={<Bot size={16} className="text-primary-glow"/>} label="Asistencia · Orión" onClick={() => { setOrionOpen(true); closeMenu(); }} />
            <MenuLink icon={<Search size={16} className="text-primary-glow"/>} label="Buscar" to="/search" onClick={closeMenu} />
            <MenuItem icon={<Bell size={16} className="text-primary-glow"/>} label="Notificaciones" onClick={() => { setMenuOpen(false); setNotifOpen(true); }} />

            {/* Categoría: COMUNIDAD */}
            <CategoryHeader label="COMUNIDAD" />
            <MenuLink icon={<BarChart3 size={16} className="text-primary-glow"/>} label="Historial" to="/history" onClick={closeMenu} />
            <MenuLink icon={<Megaphone size={16} className="text-primary-glow"/>} label="Panel de Orbes" to="/orbes" onClick={closeMenu} />
            {(mod || admin) && (
              <MenuLink icon={<ShieldCheck size={16} className="text-primary-glow"/>} label="Moderación" to="/admin" onClick={closeMenu} />
            )}

            {/* Categoría: CREACIÓN */}
            <CategoryHeader label="CREACIÓN" />
            <MenuLink icon={<Wrench size={16} className="text-primary-glow"/>} label="Editor" to="/editor" onClick={closeMenu} />
            <MenuLink icon={<Star size={16} fill="currentColor" style={{ color: "var(--plus)" }}/>} label="Centro Plus" to="/plus" onClick={closeMenu} />

            <div className="flex-1 min-h-4" />
            <button onClick={() => { logout(); closeMenu(); }}
              className="flex items-center gap-3 px-3 h-11 rounded-lg text-destructive hover:bg-destructive/10 active:scale-[0.98] transition">
              <LogOut size={16} /> <span className="text-sm font-medium">Cerrar sesión</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full-screen chat */}
      {chatOpen && (
        <ChatBoundary
          onClose={() => setChatOpen(false)}
          onRetry={() => setChatRetryNonce((n) => n + 1)}
        >
          <ChatSection
            key={chatRetryNonce}
            myId={myId}
            onClose={() => { setChatOpen(false); setChatShareText(null); setChatShareView(undefined); }}
            initialText={chatShareText ?? undefined}
            initialView={chatShareView}
          />
        </ChatBoundary>
      )}

      {/* Full-screen asistente Orión */}
      <AnimatePresence>
        {orionOpen && <OrionPanel onClose={() => setOrionOpen(false)} />}
      </AnimatePresence>

      {/* Full-screen panel de notificaciones */}
      {notifOpen && <NotificationsPanel onClose={() => setNotifOpen(false)} />}

    </div>
  );
}

function SkeletonList() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map(i => (
        <div key={i} className="rounded-lg border border-border/70 bg-surface overflow-hidden animate-pulse">
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
      className="flex items-center gap-3 px-3 h-10 rounded-lg text-ink hover:bg-muted/60 active:scale-[0.98] transition">
      {icon} <span className="text-sm font-medium">{label}</span>
    </Link>
  );
}

function MenuItem({ icon, label, onClick, children }: { icon: React.ReactNode; label: string; onClick?: () => void; children?: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-3 px-3 h-10 rounded-lg text-ink hover:bg-muted/60 active:scale-[0.98] transition w-full text-left">
      {icon} <span className="text-sm font-medium flex-1">{label}</span>
      {children}
    </button>
  );
}

function CategoryHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 pt-2 pb-1">
      <div className="section-label">{label}</div>
      <div className="flex-1 h-px bg-border/60" />
    </div>
  );
}

// Barra de pestañas de publicaciones reconstruida desde cero: botones estáticos
// con estado activo por clases condicionales. SIN píldora deslizante, sin refs,
// sin medición de layout, sin listeners de scroll y sin framer-motion: nada que
// pueda desalinearse, saltar o dar lag. Los botones se reparten el ancho con
// flex-1 y nunca desbordan la fila, así el bug de "la píldora se va al otro
// extremo" es imposible por construcción.
function FeedSubTabs({ value, onChange }: { value: FeedSub; onChange: (v: FeedSub) => void }) {
  const items: { id: FeedSub; label: string; icon: React.ReactNode }[] = [
    { id: "forYou", label: "Para ti", icon: <Home size={13} /> },
    { id: "following", label: "Seguidos", icon: <Users size={13} /> },
    { id: "trending", label: "Tendencias", icon: <Flame size={13} /> },
    { id: "forums", label: "Foros", icon: <MessageSquare size={13} /> },
  ];
  return (
    <div className="flex gap-1.5 pt-1 pb-2">
      {items.map((it) => {
        const active = value === it.id;
        return (
          <button
            key={it.id}
            onClick={() => onChange(it.id)}
            aria-pressed={active}
            className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-[10px] sm:text-[11px] font-display font-semibold tracking-wide whitespace-nowrap border transition-colors duration-200 outline-none focus:outline-none active:scale-[0.97] ${
              active
                ? "border-transparent grad-brand text-primary-foreground shadow-sm"
                : "border-line-strong bg-card text-muted-foreground hover:border-primary/25 hover:text-foreground"
            }`}
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
  // Determinista por post: antes era Math.random() y cada re-render del feed
  // re-ordenaba ligeramente las publicaciones (cambio brusco de posición).
  score *= seededJitter(p.id);

  return score;
}

// Hash FNV-1a estable por id: mismo post → mismo jitter en todos los renders,
// así el orden del feed nunca cambia por re-renderizaciones ajenas (abrir un
// menú, actualizar el perfil, etc.).
function seededJitter(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const u = (h >>> 0) / 4294967295; // [0, 1)
  return 0.92 + u * 0.16; // ±8%
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
