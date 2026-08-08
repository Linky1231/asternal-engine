import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  MessageSquare, Reply, Heart, Star, Repeat, AtSign, UserPlus, Gamepad2, Inbox,
} from "lucide-react";
import { fetchNotifications, markNotificationsRead, type Profile } from "@/lib/social/api";

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

const TYPE_META: Record<string, { icon: typeof Heart; label: string; tone: string }> = {
  comment: { icon: MessageSquare, label: "comentó tu post", tone: "text-primary bg-primary/12" },
  reply: { icon: Reply, label: "respondió tu comentario", tone: "text-accent bg-accent/12" },
  reaction: { icon: Heart, label: "reaccionó a tu contenido", tone: "text-rose-500 bg-rose-500/12" },
  like: { icon: Heart, label: "le gustó tu contenido", tone: "text-rose-500 bg-rose-500/12" },
  favorite: { icon: Star, label: "guardó tu contenido", tone: "text-amber-500 bg-amber-500/12" },
  repost: { icon: Repeat, label: "reposteó tu post", tone: "text-emerald-500 bg-emerald-500/12" },
  mention: { icon: AtSign, label: "te mencionó", tone: "text-violet-500 bg-violet-500/12" },
  follow: { icon: UserPlus, label: "te siguió", tone: "text-sky-500 bg-sky-500/12" },
  game: { icon: Gamepad2, label: "publicó un juego", tone: "text-primary bg-primary/12" },
};

function timeAgo(iso: string) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "ahora";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function NotificationsInline() {
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = (await fetchNotifications()) as Notif[];
        if (!alive) return;
        setItems(list);
        if (list.some(n => !n.read)) {
          await markNotificationsRead();
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const who = (n: Notif) => n.actor?.display_name ?? n.actor?.username ?? "Alguien";

  if (loading) {
    return (
      <div className="space-y-1.5 mt-1">
        {[0, 1, 2].map(i => (
          <div key={i} className="h-10 rounded-xl anim-shimmer" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="px-3 py-8 flex flex-col items-center gap-2 text-center text-xs text-muted-foreground">
        <Inbox size={20} className="text-muted-foreground/40" />
        Sin notificaciones todavía
      </div>
    );
  }

  return (
    <div className="mt-1 max-h-80 overflow-y-auto rounded-xl neu-inset p-1.5 space-y-1">
      {items.map(n => {
        const meta = TYPE_META[n.type] ?? TYPE_META.comment;
        const Icon = meta.icon;
        const unseen = !n.read;
        return (
          <div key={n.id}
            className={`flex items-start gap-2.5 px-2.5 py-2 rounded-xl text-xs transition-colors ${
              unseen ? "bg-primary/8" : "hover:bg-muted/40"
            }`}>
            <Link to="/profile/$userId" params={{ userId: n.actor_id ?? "" }}
              onClick={e => { if (!n.actor_id) e.preventDefault(); }}
              className="relative shrink-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/40 to-accent/30 grid place-items-center overflow-hidden text-[10px] font-display text-primary-glow">
                {n.actor?.avatar_url ? (
                  <img src={n.actor.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  who(n)[0]?.toUpperCase()
                )}
              </div>
              <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full grid place-items-center border-2 border-background ${meta.tone}`}>
                <Icon size={8} />
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
              <div className="text-[10px] font-mono text-muted-foreground/50 mt-0.5">{timeAgo(n.created_at)}</div>
            </div>
            {unseen && <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
          </div>
        );
      })}
    </div>
  );
}
