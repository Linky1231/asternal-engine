import { useEffect, useRef, useState } from "react";
import { Avatar } from "./Avatar";
import { Link } from "@tanstack/react-router";
import {
  Bell, MessageSquare, Reply, Heart, Star, Repeat, AtSign, UserPlus,
  Gamepad2, CheckCheck, Inbox, X,
} from "lucide-react";
import { fetchNotifications, markNotificationsRead, type Profile } from "@/lib/social/api";
import { supabase } from "@/integrations/supabase/client";

type Notif = {
  id: string;
  type: string;
  created_at: string;
  read: boolean;
  actor_id?: string | null;
  actor?: Profile | null;
  post_id?: string | null;
  comment_id?: string | null;
};

type Cat = "todas" | "interacciones" | "seguidores" | "juegos";

const TYPE_META: Record<string, { icon: typeof Heart; label: string; cat: Exclude<Cat, "todas">; tone: string }> = {
  comment: { icon: MessageSquare, label: "comentó tu post", cat: "interacciones", tone: "text-primary bg-primary/12" },
  reply: { icon: Reply, label: "respondió tu comentario", cat: "interacciones", tone: "text-accent bg-accent/12" },
  reaction: { icon: Heart, label: "reaccionó a tu contenido", cat: "interacciones", tone: "text-rose-500 bg-rose-500/12" },
  like: { icon: Heart, label: "le gustó tu contenido", cat: "interacciones", tone: "text-rose-500 bg-rose-500/12" },
  favorite: { icon: Star, label: "guardó tu contenido como favorito", cat: "interacciones", tone: "text-amber-500 bg-amber-500/12" },
  repost: { icon: Repeat, label: "reposteó tu post", cat: "interacciones", tone: "text-emerald-500 bg-emerald-500/12" },
  mention: { icon: AtSign, label: "te mencionó", cat: "interacciones", tone: "text-violet-500 bg-violet-500/12" },
  follow: { icon: UserPlus, label: "te siguió", cat: "seguidores", tone: "text-sky-500 bg-sky-500/12" },
  game: { icon: Gamepad2, label: "publicó un juego", cat: "juegos", tone: "text-primary bg-primary/12" },
};

const CATS: { id: Cat; label: string }[] = [
  { id: "todas", label: "Todas" },
  { id: "interacciones", label: "Interacciones" },
  { id: "seguidores", label: "Seguidores" },
  { id: "juegos", label: "Juegos" },
];

function timeAgo(iso: string) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "ahora";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [cat, setCat] = useState<Cat>("todas");
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);

  const reload = async () => {
    try {
      setItems((await fetchNotifications()) as Notif[]);
    } finally {
      setLoading(false);
    }
  };

  // Carga inicial + refresco periódico + realtime (se sincroniza entre cuentas/dispositivos).
  useEffect(() => {
    reload();
    const t = setInterval(reload, 45000);
    let channel: unknown;
    try {
      if (typeof supabase.channel === "function") {
        channel = (supabase as any)
          .channel("my-notifications")
          .on("postgres_changes", { schema: "public", table: "notifications", event: "INSERT" }, (p: any) => {
            const n = p.new as Notif;
            setItems(prev => [n, ...prev.filter(x => x.id !== n.id)]);
          })
          .on("postgres_changes", { schema: "public", table: "notifications", event: "UPDATE" }, (p: any) => {
            const n = p.new as Notif;
            setItems(prev => prev.map(x => (x.id === n.id ? { ...x, ...n } : x)));
          });
        (channel as any).subscribe?.();
      }
    } catch {
      /* cliente local: sin realtime */
    }
    return () => {
      clearInterval(t);
      try {
        (supabase as any).removeChannel?.(channel);
      } catch { /* noop */ }
    };
  }, []);

  const unread = items.filter(i => !i.read).length;
  const filtered = cat === "todas" ? items : items.filter(i => (TYPE_META[i.type]?.cat ?? "interacciones") === cat);

  const toggle = async () => {
    const willOpen = !open;
    setOpen(willOpen);
    if (willOpen && unread) {
      // Se marcan como leídas tras abrir (pero conservamos el resaltado en esta vista).
      await markNotificationsRead();
      setTimeout(reload, 250);
    }
  };

  const markAll = async () => {
    await markNotificationsRead();
    await reload();
  };

  const who = (n: Notif) => n.actor?.display_name ?? n.actor?.username ?? "Alguien";

  return (
    <div className="relative" ref={panelRef}>
      <button onClick={toggle} title="Notificaciones"
        className="relative w-9 h-9 rounded-xl border border-border grid place-items-center active:scale-95 transition text-muted-foreground hover:text-primary">
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground text-[9px] font-mono rounded-full min-w-4 h-4 px-0.5 grid place-items-center animate-in zoom-in">{unread > 99 ? "99+" : unread}</span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30 md:hidden" onClick={() => setOpen(false)} />
          <div className={[
            "absolute z-40 panel border border-border/70 rounded-2xl overflow-hidden shadow-2xl",
            "w-[min(21rem,calc(100vw-1.5rem))]",
            "right-0 top-11",
            "flex flex-col",
          ].join(" ")}
            style={{ maxHeight: "min(30rem, calc(100dvh - 5rem))" }}
          >
            {/* Cabecera */}
            <div className="flex items-center gap-2 px-3.5 pt-3 pb-2 border-b border-border/50">
              <div className="flex-1">
                <div className="font-display text-xs tracking-widest text-primary font-semibold">NOTIFICACIONES</div>
                <div className="text-[10px] text-muted-foreground/70">
                  {unread > 0 ? `${unread} sin leer` : "Todo al día"}
                </div>
              </div>
              {items.length > 0 && (
                <button onClick={markAll} title="Marcar todas como leídas"
                  className="flex items-center gap-1 px-2 h-7 rounded-lg text-[10px] font-display text-muted-foreground border border-border/60 hover:text-primary hover:border-primary/40 active:scale-95 transition">
                  <CheckCheck size={12} /> LEÍDAS
                </button>
              )}
              <button onClick={() => setOpen(false)} className="w-7 h-7 rounded-lg border border-border/60 grid place-items-center text-muted-foreground hover:text-foreground active:scale-95 transition md:hidden">
                <X size={13} />
              </button>
            </div>

            {/* Categorías */}
            <div className="flex gap-1 px-3 py-2 border-b border-border/40 overflow-x-auto">
              {CATS.map(c => {
                const count = c.id === "todas"
                  ? unread
                  : items.filter(i => (TYPE_META[i.type]?.cat ?? "interacciones") === c.id && !i.read).length;
                return (
                  <button key={c.id} onClick={() => setCat(c.id)}
                    className={`flex items-center gap-1.5 px-2.5 h-7 rounded-lg text-[10px] font-display tracking-wide whitespace-nowrap transition active:scale-95 border ${
                      cat === c.id
                        ? "bg-gradient-to-br from-primary to-accent text-primary-foreground border-transparent shadow-sm"
                        : "text-muted-foreground border-border/60 hover:border-primary/30 hover:text-primary"
                    }`}>
                    {c.label}
                    {count > 0 && (
                      <span className={`min-w-3.5 h-3.5 px-0.5 rounded-full text-[8px] font-mono grid place-items-center ${cat === c.id ? "bg-white/25 text-white" : "bg-primary/15 text-primary"}`}>{count}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Lista */}
            <div className="overflow-y-auto flex-1 p-1.5 space-y-1">
              {loading && items.length === 0 ? (
                <div className="space-y-1.5 p-2">
                  {[0, 1, 2, 3].map(i => <div key={i} className="h-12 rounded-xl anim-shimmer" />)}
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
                  <Inbox size={22} className="text-muted-foreground/40" />
                  <div className="text-[11px]">Sin notificaciones aquí</div>
                </div>
              ) : (
                filtered.map(n => {
                  const meta = TYPE_META[n.type] ?? TYPE_META.comment;
                  const Icon = meta.icon;
                  const unseen = !n.read;
                  return (
                    <div key={n.id}
                      className={`flex items-start gap-2.5 px-2.5 py-2.5 rounded-xl border transition-colors ${
                        unseen ? "bg-primary/6 border-primary/15" : "border-transparent hover:bg-muted/40"
                      }`}>
                      <Link to="/profile/$userId" params={{ userId: n.actor_id ?? "" }}
                        onClick={e => { if (!n.actor_id) e.preventDefault(); }}
                        className="relative shrink-0">
                        <Avatar p={n.actor} size={36} />
                        <span className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full grid place-items-center border-2 border-background ${meta.tone}`}>
                          <Icon size={9} />
                        </span>
                      </Link>
                      <div className="flex-1 min-w-0 pt-0.5">
                        <div className="text-[12px] leading-snug text-foreground/90">
                          <Link to="/profile/$userId" params={{ userId: n.actor_id ?? "" }}
                            onClick={e => { if (!n.actor_id) e.preventDefault(); }}
                            className="font-display font-semibold hover:text-primary transition-colors">
                            {who(n)}
                          </Link>{" "}
                          <span className="text-muted-foreground/90">{meta.label}</span>
                        </div>
                        <div className="text-[10px] font-mono text-muted-foreground/60 mt-0.5">{timeAgo(n.created_at)}</div>
                      </div>
                      {unseen && <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
