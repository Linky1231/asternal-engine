import { useEffect, useState } from "react";
import { fetchNotifications, markNotificationsRead } from "@/lib/social/api";

type Notif = {
  id: string; type: string; created_at: string; read: boolean;
  actor?: { username: string; display_name: string | null } | null;
  post_id?: string | null;
};

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

  const label = (n: Notif) => {
    const who = n.actor?.display_name ?? n.actor?.username ?? "alguien";
    switch (n.type) {
      case "comment": return `${who} comentó tu post`;
      case "reply": return `${who} respondió tu comentario`;
      case "reaction": return `${who} reaccionó a tu contenido`;
      case "repost": return `${who} reposteó tu post`;
      case "mention": return `${who} te mencionó`;
      case "follow": return `${who} te siguió`;
      case "like": return `${who} le dio like a tu post`;
      default: return `${who}`;
    }
  };

  const timeAgo = (iso: string) => {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return "ahora";
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  };

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
      <div className="px-3 py-6 text-center text-xs text-muted-foreground">
        Sin notificaciones
      </div>
    );
  }

  return (
    <div className="mt-1 max-h-72 overflow-y-auto rounded-xl neu-inset p-1.5 space-y-1">
      {items.map(n => (
        <div key={n.id}
          className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs ${!n.read ? "bg-primary/8" : "bg-transparent"}`}>
          <span className="truncate">{label(n)}</span>
          <span className="text-[10px] text-muted-foreground font-mono shrink-0">{timeAgo(n.created_at)}</span>
        </div>
      ))}
    </div>
  );
}
