import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fetchEvents, type EventItem } from "@/lib/social/api";
import {
  Calendar, Trophy, Clock, Users, FileText,
  ChevronRight, ExternalLink, Sparkles,
} from "lucide-react";

function timeUntil(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return "Iniciado";
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  if (days > 0) return `${days}d ${hours}h`;
  const mins = Math.floor((diff % 3600000) / 60000);
  return `${hours}h ${mins}m`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("es-ES", {
    day: "numeric", month: "short", year: "numeric",
  });
}

const STATUS_STYLES: Record<string, { label: string; class: string }> = {
  upcoming: { label: "PRÓXIMO", class: "text-amber-600 bg-amber-50 border-amber-200" },
  active: { label: "ACTIVO", class: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  completed: { label: "FINALIZADO", class: "text-slate-500 bg-slate-100 border-slate-200" },
};

export function EventsSection({ isAdmin }: { isAdmin: boolean }) {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchEvents();
        setEvents(data);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, []);

  const sorted = [...events].sort((a, b) => {
    const order = { upcoming: 0, active: 1, completed: 2 };
    return (order[a.status] ?? 3) - (order[b.status] ?? 3);
  });

  const activeCount = events.filter(e => e.status === "active").length;
  const upcomingCount = events.filter(e => e.status === "upcoming").length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-display font-semibold text-foreground">Eventos</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {activeCount > 0
              ? `${activeCount} evento${activeCount > 1 ? "s" : ""} activo${activeCount > 1 ? "s" : ""}`
              : upcomingCount > 0
              ? `${upcomingCount} próximo${upcomingCount > 1 ? "s" : ""}`
              : "Participa en concursos y gana premios"}
          </p>
        </div>
        {activeCount > 0 && (
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium border border-emerald-200 bg-emerald-50 text-emerald-700">
            <Sparkles size={12} />
            {activeCount} activo{activeCount > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1].map(i => (
            <div key={i} className="panel rounded-xl overflow-hidden animate-pulse">
              <div className="h-32 bg-muted/50" />
              <div className="p-4 space-y-2">
                <div className="h-4 w-2/3 bg-muted/60 rounded" />
                <div className="h-3 w-1/2 bg-muted/40 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="panel rounded-xl p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-muted/60 grid place-items-center mx-auto mb-3">
            <Calendar size={20} className="text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">No hay eventos disponibles</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Los eventos y concursos aparecerán aquí</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {sorted.map((ev, i) => {
              const s = STATUS_STYLES[ev.status] ?? STATUS_STYLES.upcoming;
              const isOpen = selected === ev.id;
              const now = Date.now();
              const startsAt = new Date(ev.starts_at).getTime();
              const endsAt = new Date(ev.ends_at).getTime();
              const isLive = startsAt <= now && endsAt > now;
              const isPast = endsAt < now;

              return (
                <motion.div
                  key={ev.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                  className="panel rounded-xl overflow-hidden border border-border/80"
                >
                  {/* Banner */}
                  <div
                    className="relative h-32 bg-gradient-to-br from-slate-100 to-slate-200 cursor-pointer"
                    onClick={() => setSelected(isOpen ? null : ev.id)}
                  >
                    {ev.banner_url ? (
                      <img src={ev.banner_url} alt={ev.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full grid place-items-center">
                        <Trophy size={36} className="text-slate-400" />
                      </div>
                    )}
                    <div className="absolute top-3 left-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wider border ${s.class}`}>
                        {s.label}
                      </span>
                    </div>
                    {isLive && (
                      <div className="absolute top-3 right-3">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wider border border-emerald-200 bg-emerald-50 text-emerald-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          EN VIVO
                        </span>
                      </div>
                    )}
                    {ev.prize_pool && ev.prize_pool > 0 && (
                      <div className="absolute bottom-3 right-3">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wider border border-amber-200 bg-amber-50 text-amber-700">
                          <Trophy size={10} /> {ev.prize_pool} Orbes
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3
                          className="text-sm font-display font-semibold text-foreground cursor-pointer hover:text-primary transition-colors"
                          onClick={() => setSelected(isOpen ? null : ev.id)}
                        >
                          {ev.title}
                        </h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{ev.description}</p>
                      </div>
                      <button
                        onClick={() => setSelected(isOpen ? null : ev.id)}
                        className="shrink-0 w-7 h-7 rounded-lg border border-border grid place-items-center text-muted-foreground hover:bg-muted/60 transition"
                      >
                        <ChevronRight size={14} className={`transition-transform ${isOpen ? "rotate-90" : ""}`} />
                      </button>
                    </div>

                    {/* Meta row */}
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Calendar size={11} />
                        {formatDate(ev.starts_at)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock size={11} />
                        {isPast ? "Finalizado" : timeUntil(isLive ? ev.ends_at : ev.starts_at)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Users size={11} />
                        {ev.participant_count ?? 0} participantes
                      </span>
                      {ev.submission_count !== undefined && (
                        <span className="inline-flex items-center gap-1">
                          <FileText size={11} />
                          {ev.submission_count} submissions
                        </span>
                      )}
                    </div>

                    {/* Expanded details */}
                    <AnimatePresence>
                      {isOpen && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                          className="overflow-hidden"
                        >
                          <div className="pt-2 border-t border-border/60 space-y-3">
                            {ev.prize_description && (
                              <div>
                                <div className="text-[10px] font-display tracking-widest text-muted-foreground mb-1">PREMIOS</div>
                                <p className="text-xs text-foreground/80">{ev.prize_description}</p>
                              </div>
                            )}
                            {ev.rules && (
                              <div>
                                <div className="text-[10px] font-display tracking-widest text-muted-foreground mb-1">REGLAS</div>
                                <p className="text-xs text-foreground/80 whitespace-pre-wrap">{ev.rules}</p>
                              </div>
                            )}
                            <div className="flex items-center gap-2 pt-1">
                              {!isPast && (
                                <button
                                  className="h-8 px-4 rounded-lg bg-primary text-primary-foreground text-[11px] font-medium hover:bg-primary/90 active:scale-[0.98] transition"
                                  onClick={() => {/* Participar */ }}
                                >
                                  Participar
                                </button>
                              )}
                              {ev.my_submission && (
                                <span className="text-[11px] text-emerald-600 font-medium">
                                  ✓ Participando
                                </span>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
