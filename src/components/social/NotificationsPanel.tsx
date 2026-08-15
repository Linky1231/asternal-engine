import { useEffect, useMemo, useState } from "react";
import { Avatar } from "./Avatar";
import { Link } from "@tanstack/react-router";
import {
  Bell, MessageSquare, Reply, Heart, Star, Repeat, AtSign, UserPlus,
  Gamepad2, CheckCheck, Inbox, X, TrendingUp, Loader2,
} from "lucide-react";
import { fetchAllNotifications, markNotificationsRead, type Profile } from "@/lib/social/api";

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

const CATS: { id: Cat; label: string; icon: typeof Heart; tone: string }[] = [
  { id: "todas", label: "Todas", icon: Inbox, tone: "text-primary bg-primary/12" },
  { id: "interacciones", label: "Interacciones", icon: Heart, tone: "text-rose-500 bg-rose-500/12" },
  { id: "seguidores", label: "Seguidores", icon: UserPlus, tone: "text-sky-500 bg-sky-500/12" },
  { id: "juegos", label: "Juegos", icon: Gamepad2, tone: "text-primary bg-primary/12" },
];

function timeAgo(iso: string) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "ahora";
  if (s < 3600) return `hace ${Math.floor(s / 60)}m`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)}h`;
  return `hace ${Math.floor(s / 86400)}d`;
}

function catOf(type: string): Exclude<Cat, "todas"> {
  return TYPE_META[type]?.cat ?? "interacciones";
}

export function NotificationsPanel({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState<Cat>("todas");
  const [marking, setMarking] = useState(false);

  const reload = async () => {
    try {
      setItems((await fetchAllNotifications()) as Notif[]);
    } finally {
      setLoading(false);
    }
  };

  // Carga inicial + refresco periódico (los totales del panel son reales).
  useEffect(() => {
    reload();
    const t = setInterval(reload, 45000);
    return () => clearInterval(t);
  }, []);

  const unread = items.filter(i => !i.read).length;
  const readPct = items.length ? Math.round(((items.length - unread) / items.length) * 100) : 100;

  // Totales por categoría (interacciones · seguidores · juegos).
  const stats = useMemo(() => {
    const perCat: Record<Exclude<Cat, "todas">, { total: number; unread: number }> = {
      interacciones: { total: 0, unread: 0 },
      seguidores: { total: 0, unread: 0 },
      juegos: { total: 0, unread: 0 },
    };
    for (const n of items) {
      const c = catOf(n.type);
      perCat[c].total += 1;
      if (!n.read) perCat[c].unread += 1;
    }
    return perCat;
  }, [items]);

  // Por periodo: hoy · últimos 7 días · últimos 30 días.
  const periods = useMemo(() => {
    const now = Date.now();
    const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
    const weekAgo = now - 7 * 864e5;
    const monthAgo = now - 30 * 864e5;
    const mk = () => ({ received: 0, unread: 0 });
    const today = mk(), week = mk(), month = mk();
    for (const n of items) {
      const ts = new Date(n.created_at).getTime();
      if (ts >= startToday.getTime()) {
        today.received += 1;
        if (!n.read) today.unread += 1;
      }
      if (ts >= weekAgo) {
        week.received += 1;
        if (!n.read) week.unread += 1;
      }
      if (ts >= monthAgo) {
        month.received += 1;
        if (!n.read) month.unread += 1;
      }
    }
    return { today, week, month };
  }, [items]);

  // Actividad de los últimos 7 días para la mini gráfica.
  const last7 = useMemo(() => {
    const days: { label: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const start = d.getTime();
      let count = 0;
      for (const n of items) {
        const ts = new Date(n.created_at).getTime();
        if (ts >= start && ts < start + 864e5) count += 1;
      }
      days.push({ label: d.toLocaleDateString("es", { weekday: "narrow" }), count });
    }
    return days;
  }, [items]);
  const max7 = Math.max(1, ...last7.map(d => d.count));

  const filtered = cat === "todas" ? items : items.filter(n => catOf(n.type) === cat);

  const markAll = async () => {
    setMarking(true);
    try {
      await markNotificationsRead();
      await reload();
    } finally {
      setMarking(false);
    }
  };

  const who = (n: Notif) => n.actor?.display_name ?? n.actor?.username ?? "Alguien";

  return (
    <div className="fixed inset-0 z-[90] bg-background flex flex-col">
      {/* Franja de identidad (mismo lenguaje que el chat) */}
      <div className="h-[3px] shrink-0 bg-gradient-to-r from-primary to-accent" />

      {/* Cabecera */}
      <header className="shrink-0 border-b border-border/60 bg-background/95 backdrop-blur-md px-3 sm:px-4 py-2.5 flex items-center gap-2.5">
        <button
          onClick={onClose}
          aria-label="Cerrar notificaciones"
          className="w-9 h-9 rounded-lg border border-line-strong bg-card text-ink-2 grid place-items-center hover:bg-muted/60 hover:text-foreground active:scale-95 transition shrink-0"
        >
          <X size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="font-display text-sm font-semibold flex items-center gap-2">
            <Bell size={14} className="text-primary shrink-0" />
            <span className="truncate">NOTIFICACIONES</span>
          </div>
          <div className="text-[10px] font-mono text-muted-foreground truncate mt-0.5">
            {items.length} notificación{items.length !== 1 ? "es" : ""} · {unread} sin leer
          </div>
        </div>
        {items.length > 0 && (
          <button
            onClick={markAll}
            disabled={marking || unread === 0}
            className="flex items-center gap-1.5 px-3 h-8 rounded-lg border border-border/60 text-[10px] font-display text-muted-foreground hover:text-primary hover:border-primary/40 active:scale-95 transition shrink-0 disabled:opacity-40"
          >
            {marking ? <Loader2 size={12} className="animate-spin" /> : <CheckCheck size={12} />}
            MARCAR LEÍDAS
          </button>
        )}
      </header>

      {/* Contenido */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl md:max-w-3xl lg:max-w-4xl mx-auto w-full px-3 py-3 pb-12 space-y-3">
          {/* Tarjeta hero: sin leer */}
          <section className="relative overflow-hidden rounded-xl border border-primary/30 bg-gradient-to-br from-primary/15 via-accent/10 to-transparent p-4 shadow-sm">
            <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-primary/15 blur-2xl" />
            <div className="relative flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground grid place-items-center shadow-lg shrink-0">
                <Bell size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-display tracking-[0.2em] text-muted-foreground">SIN LEER</div>
                <div className="text-3xl font-display font-bold tabular-nums leading-tight">
                  {loading ? <span className="opacity-40">···</span> : unread}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {items.length - unread} leídas de {items.length} totales · {readPct}% al día
                </div>
              </div>
              <TrendingUp size={22} className="text-primary/40 shrink-0" />
            </div>
            {/* Progreso de leídas */}
            <div className="relative mt-3 h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
                style={{ width: `${readPct}%` }}
              />
            </div>
          </section>

          {/* Totales por categoría */}
          <section className="grid grid-cols-3 gap-2">
            <StatCard label="Interacciones" value={stats.interacciones.total} unread={stats.interacciones.unread} Icon={Heart} tone="text-rose-500" bg="bg-rose-500/10" />
            <StatCard label="Seguidores" value={stats.seguidores.total} unread={stats.seguidores.unread} Icon={UserPlus} tone="text-sky-500" bg="bg-sky-500/10" />
            <StatCard label="Juegos" value={stats.juegos.total} unread={stats.juegos.unread} Icon={Gamepad2} tone="text-primary" bg="bg-primary/10" />
          </section>

          {/* Desglose por categoría (filtro) */}
          <section className="rounded-lg border border-border/70 bg-surface p-3 space-y-2">
            <div className="flex items-center justify-between px-0.5 gap-2">
              <h2 className="font-display text-[11px] tracking-widest text-muted-foreground flex items-center gap-1.5">
                <Inbox size={12} className="text-primary-glow" />
                POR CATEGORÍA
              </h2>
              <span className="text-[9px] font-mono text-muted-foreground/60 shrink-0">toca para filtrar la lista</span>
            </div>
            {CATS.map(c => {
              const id = c.id;
              const isAll = id === "todas";
              const total = isAll ? items.length : stats[id].total;
              const un = isAll ? unread : stats[id].unread;
              const active = cat === c.id;
              const share = items.length ? Math.round((total / items.length) * 100) : 0;
              const Icon = c.icon;
              return (
                <button
                  key={c.id}
                  onClick={() => setCat(c.id)}
                  className={`w-full text-left rounded-xl border px-2.5 py-2 transition active:scale-[0.99] ${
                    active ? "border-primary/40 bg-primary/8" : "border-border/50 hover:border-primary/25 hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={`w-8 h-8 rounded-lg grid place-items-center shrink-0 ${c.tone}`}>
                      <Icon size={14} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-display font-medium truncate">{c.label}</span>
                        {un > 0 && (
                          <span className="shrink-0 min-w-[16px] h-4 px-1 rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground text-[9px] font-display grid place-items-center">
                            {un}
                          </span>
                        )}
                      </div>
                      <div className="text-[9px] font-mono text-muted-foreground/60 mt-0.5">{total} notificación{total !== 1 ? "es" : ""} · {share}% del total</div>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground/50 shrink-0">{share}%</span>
                  </div>
                  <div className="mt-1.5 h-1 rounded-full bg-muted/40 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent" style={{ width: `${share}%` }} />
                  </div>
                </button>
              );
            })}
          </section>

          {/* Estadísticas por periodo */}
          <section className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <h2 className="font-display text-sm tracking-widest flex items-center gap-1.5">
                <TrendingUp size={13} className="text-primary-glow" />
                POR PERIODO
              </h2>
              <span className="text-[10px] font-mono text-muted-foreground">hoy · 7 días · 30 días</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <PeriodCard label="HOY" {...periods.today} />
              <PeriodCard label="7 DÍAS" {...periods.week} />
              <PeriodCard label="30 DÍAS" {...periods.month} />
            </div>
          </section>

          {/* Mini gráfica de actividad */}
          <section className="rounded-lg border border-border/70 bg-surface p-3">
            <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-1.5">
              Actividad · últimos 7 días
            </div>
            <div className="flex items-end gap-1 h-12">
              {last7.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                  <div
                    className="w-full rounded-md bg-gradient-to-t from-primary/70 to-accent/70 transition-all hover:from-primary hover:to-accent"
                    style={{ height: `${Math.max(6, (d.count / max7) * 100)}%`, minHeight: 4 }}
                    title={`${d.label}: ${d.count} notificación${d.count !== 1 ? "es" : ""}`}
                  />
                  <span className="text-[7px] font-mono text-muted-foreground/60 truncate w-full text-center">{d.label}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Lista filtrada */}
          <section className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <h2 className="font-display text-sm tracking-widest flex items-center gap-1.5">
                <Bell size={13} className="text-primary-glow" />
                {cat === "todas" ? "TODAS" : CATS.find(c => c.id === cat)?.label.toUpperCase()}
              </h2>
              <span className="text-[10px] font-mono text-muted-foreground">{filtered.length} notificación{filtered.length !== 1 ? "es" : ""}</span>
            </div>
            {loading && items.length === 0 ? (
              <div className="space-y-1.5">
                {[0, 1, 2, 3].map(i => <div key={i} className="h-14 rounded-xl anim-shimmer" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-surface p-8 text-center">
                <Inbox size={22} className="mx-auto mb-2 text-muted-foreground/40" />
                <div className="text-xs text-muted-foreground">Sin notificaciones aquí</div>
              </div>
            ) : (
              <ul className="rounded-lg border border-border/70 bg-surface divide-y divide-border/40 overflow-hidden">
                {filtered.map(n => {
                  const meta = TYPE_META[n.type] ?? TYPE_META.comment;
                  const Icon = meta.icon;
                  const unseen = !n.read;
                  return (
                    <li key={n.id} className={`flex items-start gap-3 px-3 py-3 transition-colors ${unseen ? "bg-primary/5" : "hover:bg-muted/30"}`}>
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
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, unread, Icon, tone, bg }: {
  label: string; value: number; unread: number;
  Icon: React.ComponentType<{ size?: number; className?: string }>; tone: string; bg: string;
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-surface p-3 flex flex-col items-start gap-1 min-w-0 transition-transform hover:scale-[1.02]">
      <div className={`w-7 h-7 rounded-lg grid place-items-center ${bg}`}>
        <Icon size={13} className={tone} />
      </div>
      <div className="text-lg font-display font-semibold tabular-nums leading-none mt-1">{value.toLocaleString()}</div>
      <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider truncate w-full">{label}</div>
      {unread > 0 && <div className="text-[9px] font-mono text-primary-glow truncate">{unread} sin leer</div>}
    </div>
  );
}

function PeriodCard({ label, received, unread }: { label: string; received: number; unread: number }) {
  const read = received - unread;
  return (
    <div className="rounded-lg border border-border/70 bg-surface p-3 space-y-1.5">
      <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider truncate">{label}</div>
      <div className="flex items-center justify-between gap-1">
        <span className="text-[10px] text-muted-foreground shrink-0">Recibidas</span>
        <span className="text-xs font-display font-semibold tabular-nums">{received}</span>
      </div>
      <div className="flex items-center justify-between gap-1">
        <span className="text-[10px] text-muted-foreground shrink-0">Sin leer</span>
        <span className={`text-xs font-display font-semibold tabular-nums ${unread > 0 ? "text-primary-glow" : "text-emerald-500"}`}>{unread}</span>
      </div>
      <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-border/40">
        <span className="text-[10px] text-muted-foreground shrink-0">Leídas</span>
        <span className="text-xs font-display font-semibold tabular-nums text-emerald-500">{read}</span>
      </div>
    </div>
  );
}
