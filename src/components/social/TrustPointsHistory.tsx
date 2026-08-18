import { useEffect, useState } from "react";
import { ShieldAlert, ShieldCheck, Clock, X } from "lucide-react";
import {
  fetchTrustHistory,
  type TrustHistoryEntry,
} from "@/lib/social/api";

function timeAgo(date: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(date).getTime()) / 1000));
  if (s < 60) return `hace ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  return d < 30 ? `hace ${d}d` : new Date(date).toLocaleDateString();
}

export function TrustPointsHistory({
  userId,
  onClose,
}: {
  userId: string;
  onClose: () => void;
}) {
  const [entries, setEntries] = useState<TrustHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await fetchTrustHistory(userId);
      if (!cancelled) {
        setEntries(data);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const deductions = entries.filter((e) => e.action === "deduct");
  const restores = entries.filter((e) => e.action === "restore");
  const totalDeducted = deductions.reduce((sum, e) => sum + e.amount, 0);
  const totalRestored = restores.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px] animate-in fade-in duration-200"
      />
      <div className="relative w-full sm:max-w-md rounded-t-2xl sm:rounded-lg border border-border bg-surface shadow-md animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-2 duration-300 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60">
          <div className="flex-1 text-sm font-semibold">
            Historial de Confianza
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-md border border-border grid place-items-center text-muted-foreground hover:text-foreground active:scale-95 transition"
          >
            <X size={14} />
          </button>
        </div>

        {/* Stats summary */}
        <div className="grid grid-cols-3 gap-2 px-4 py-3 border-b border-border/30">
          <div className="text-center">
            <div className="text-[10px] font-mono text-muted-foreground/50 mb-0.5">RESTADOS</div>
            <div className="text-sm font-display font-semibold text-red-500 tabular-nums">
              -{totalDeducted}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[10px] font-mono text-muted-foreground/50 mb-0.5">EVENTOS</div>
            <div className="text-sm font-display font-semibold text-foreground tabular-nums">
              {entries.length}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[10px] font-mono text-muted-foreground/50 mb-0.5">RECUPERADOS</div>
            <div className="text-sm font-display font-semibold text-emerald-500 tabular-nums">
              +{totalRestored}
            </div>
          </div>
        </div>

        {/* History list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loading ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              Cargando historial…
            </div>
          ) : entries.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              <Clock size={20} className="mx-auto mb-2 text-muted-foreground/30" />
              No hay eventos de confianza registrados
            </div>
          ) : (
            entries.map((entry) => {
              const isDeduct = entry.action === "deduct";
              return (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 px-3 py-2.5 rounded-lg border border-border/30 bg-card/50"
                >
                  <div
                    className={`w-8 h-8 rounded-lg grid place-items-center shrink-0 mt-0.5 ${
                      isDeduct
                        ? "bg-red-50 border border-red-200/50"
                        : "bg-emerald-50 border border-emerald-200/50"
                    }`}
                  >
                    {isDeduct ? (
                      <ShieldAlert size={14} className="text-red-500" />
                    ) : (
                      <ShieldCheck size={14} className="text-emerald-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-display font-semibold ${
                          isDeduct ? "text-red-500" : "text-emerald-500"
                        }`}
                      >
                        {isDeduct ? `-${entry.amount}` : `+${entry.amount}`} pts
                      </span>
                      <span className="text-[9px] font-mono text-muted-foreground/40">
                        {entry.points_before} → {entry.points_after}
                      </span>
                    </div>
                    {entry.reason && (
                      <div className="text-[11px] text-foreground/60 mt-0.5 leading-relaxed">
                        {entry.reason}
                      </div>
                    )}
                    <div className="text-[9px] font-mono text-muted-foreground/35 mt-1">
                      {timeAgo(entry.created_at)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
