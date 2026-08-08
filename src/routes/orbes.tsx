import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { ArrowLeft, Sparkles, TrendingUp, TrendingDown, Gift, Gamepad2, Loader2, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile, fetchOrbeTransactions, type OrbeTx, type Profile } from "@/lib/social/api";

export const Route = createFileRoute("/orbes")({
  head: () => ({ meta: [{ title: "Mis Orbes · Asternal" }] }),
  component: OrbesPage,
});

function timeAgo(iso: string) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `hace ${s}s`;
  const m = Math.floor(s / 60); if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60); if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24); if (d < 30) return `hace ${d} d`;
  return new Date(iso).toLocaleDateString();
}

function kindMeta(k: OrbeTx["kind"]) {
  switch (k) {
    case "welcome_bonus": return { label: "Bienvenida", Icon: Gift, tone: "text-emerald-500" };
    case "game_purchase": return { label: "Compra de juego", Icon: Gamepad2, tone: "text-primary" };
    case "adjustment":    return { label: "Ajuste", Icon: Wallet, tone: "text-muted-foreground" };
  }
}

function OrbesPage() {
  const navigate = useNavigate();

  // Bug de navegación: al salir del panel (botón «atrás» o gesto del navegador),
  // SIEMPRE se vuelve al menú principal (/) en lugar de a la pantalla aislada
  // del perfil (/profile), que es lo que ocurría antes.
  useEffect(() => {
    const onPop = () => {
      navigate({ to: "/", replace: true });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [navigate]);

  const [me, setMe] = useState<Profile | null>(null);
  const [txs, setTxs] = useState<OrbeTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate({ to: "/auth" }); return; }
      setLoading(true);
      try {
        const [p, t] = await Promise.all([getMyProfile(), fetchOrbeTransactions(200)]);
        setMe(p); setTxs(t);
      } catch (e) { setErr((e as Error).message); }
      finally { setLoading(false); }
    })();
  }, [navigate]);

  const stats = useMemo(() => {
    let earned = 0, spent = 0, purchases = 0;
    for (const t of txs) {
      if (t.amount > 0) earned += t.amount;
      else spent += -t.amount;
      if (t.kind === "game_purchase") purchases += 1;
    }
    return { earned, spent, purchases };
  }, [txs]);

  return (
    <div className="min-h-screen w-full flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-20 panel border-b backdrop-blur-xl">
        <div className="max-w-2xl md:max-w-3xl lg:max-w-5xl xl:max-w-6xl mx-auto flex items-center gap-2 px-3 py-2.5">
          <button onClick={() => navigate({ to: "/" })}
            className="w-9 h-9 rounded-xl border border-border grid place-items-center active:scale-95 transition">
            <ArrowLeft size={16} />
          </button>
          <div className="flex-1 font-display text-sm text-primary-glow glow-text flex items-center gap-2">
            <Sparkles size={14} fill="currentColor" /> MIS ORBES
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl md:max-w-3xl lg:max-w-5xl xl:max-w-6xl mx-auto w-full px-3 py-4 pb-24 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
        {/* Balance card */}
        <section className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/15 via-accent/10 to-transparent p-5 shadow-lg">
          <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-primary/20 blur-3xl" />
          <div className="relative">
            <div className="text-[10px] font-display tracking-[0.2em] text-muted-foreground">SALDO ACTUAL</div>
            <div className="flex items-baseline gap-2 mt-2">
              <Sparkles size={28} className="text-primary" fill="currentColor" />
              <div className="text-5xl font-display font-bold tabular-nums">
                {loading ? <span className="opacity-40">···</span> : (me?.orbes ?? 0).toLocaleString()}
              </div>
              <div className="text-xs font-mono text-muted-foreground">orbes</div>
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">
              Usa tus orbes para desbloquear juegos publicados por la comunidad.
            </div>
          </div>
        </section>

        {/* Stats grid */}
        <section className="grid grid-cols-3 gap-2">
          <StatCard label="Ganados" value={stats.earned} Icon={TrendingUp} tone="text-emerald-500" />
          <StatCard label="Gastados" value={stats.spent} Icon={TrendingDown} tone="text-rose-500" />
          <StatCard label="Juegos" value={stats.purchases} Icon={Gamepad2} tone="text-primary" />
        </section>

        {/* History */}
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="font-display text-sm tracking-widest">HISTORIAL</h2>
            <span className="text-[10px] font-mono text-muted-foreground">{txs.length} movimientos</span>
          </div>
          {err && <div className="text-xs text-destructive px-1">{err}</div>}
          {loading ? (
            <div className="p-8 text-center text-xs text-muted-foreground panel rounded-2xl border border-border/50">
              <Loader2 className="inline animate-spin mr-2" size={14} /> Cargando…
            </div>
          ) : txs.length === 0 ? (
            <div className="p-8 text-center panel rounded-2xl border border-dashed border-border space-y-2">
              <Sparkles size={22} className="mx-auto text-primary" />
              <div className="text-xs text-muted-foreground">Aún no hay movimientos.</div>
            </div>
          ) : (
            <ul className="panel rounded-2xl border border-border/50 divide-y divide-border/40 overflow-hidden">
              {txs.map(t => {
                const m = kindMeta(t.kind);
                const positive = t.amount > 0;
                return (
                  <li key={t.id} className="flex items-center gap-3 px-3 py-3 hover:bg-muted/30 transition-colors">
                    <div className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 ${positive ? "bg-emerald-500/10" : "bg-rose-500/10"}`}>
                      <m.Icon size={16} className={m.tone} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{t.description || m.label}</div>
                      <div className="text-[10px] font-mono text-muted-foreground">{m.label} · {timeAgo(t.created_at)}</div>
                    </div>
                    <div className={`font-display font-semibold tabular-nums text-sm flex items-center gap-1 ${positive ? "text-emerald-500" : "text-rose-500"}`}>
                      {positive ? "+" : ""}{t.amount}
                      <Sparkles size={11} fill="currentColor" />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="pt-2">
          <Link to="/" className="block text-center text-[11px] font-display tracking-widest text-primary-glow hover:underline">
            EXPLORAR JUEGOS PARA USAR TUS ORBES →
          </Link>
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value, Icon, tone }: { label: string; value: number; Icon: React.ComponentType<{ size?: number; className?: string }>; tone: string }) {
  return (
    <div className="panel rounded-2xl border border-border/50 p-3 flex flex-col items-start gap-1 transition-transform hover:scale-[1.02]">
      <Icon size={14} className={tone} />
      <div className="text-lg font-display font-semibold tabular-nums leading-none mt-1">{value.toLocaleString()}</div>
      <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{label}</div>
    </div>
  );
}
