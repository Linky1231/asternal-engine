import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Play, Flame, Rocket, Heart, Sparkles as SparklesIcon, Users, ChevronRight, Gamepad2, Trophy, Joystick, Crown, CloudOff, Loader2, CheckCircle2, Star, Bookmark } from "lucide-react";
import type { PostWithMeta } from "@/lib/social/api";
import { fetchGamePlayCounts24h, toggleReaction } from "@/lib/social/api";
import { SUPABASE_ACCESS_TOKEN, runGamePlaysSchemaSetup } from "@/lib/supabase/setup";
import { getFeaturedGameIds } from "@/lib/social/featured-games";
import { GameIcon } from "./GameIcon";

function extractTitle(content: string): string {
  const line = content.split("\n")[0] || "Juego";
  return line.replace(/^🎮\s*/, "").trim() || "Juego";
}

type TrendTab = "hot" | "growing" | "rated" | "new";

export function GamesHome({
  games, myId, isMod, onChange,
}: {
  games: PostWithMeta[]; myId: string | null; isMod: boolean; onChange: () => void;
}) {
  const navigate = useNavigate();
  const [trend, setTrend] = useState<TrendTab>("hot");
  const [playCounts, setPlayCounts] = useState<Record<string, number>>({});
  const [rankCloud, setRankCloud] = useState<boolean | null>(null);
  const [installing, setInstalling] = useState(false);
  const [installMsg, setInstallMsg] = useState<string | null>(null);

  // Navigate to game page
  const openGame = useCallback((g: PostWithMeta) => {
    navigate({ to: "/game/$postId", params: { postId: g.id } });
  }, [navigate]);

  useEffect(() => {
    let alive = true;
    if (!games.length) { setPlayCounts({}); setRankCloud(false); return; }
    fetchGamePlayCounts24h(games.map(g => g.id))
      .then(r => { if (alive) { setPlayCounts(r.counts); setRankCloud(r.cloud); } })
      .catch(() => { if (alive) { setPlayCounts({}); setRankCloud(false); } });
    return () => { alive = false; };
  }, [games]);

  const installRankingTable = async () => {
    setInstalling(true);
    setInstallMsg(null);
    try {
      const token = (SUPABASE_ACCESS_TOKEN ?? "").trim();
      if (!token) {
        setInstallMsg("Sin token de Supabase. Abre ⋮ → Supabase → «Instalar esquema» para crear la tabla.");
        return;
      }
      const r = await runGamePlaysSchemaSetup(token);
      setInstallMsg(r.ok ? "Tabla creada: el ranking ya se sincroniza entre dispositivos." : r.message);
      if (r.ok && games.length) {
        const rr = await fetchGamePlayCounts24h(games.map(g => g.id));
        setPlayCounts(rr.counts);
        setRankCloud(rr.cloud);
      }
    } catch (e) {
      setInstallMsg((e as Error)?.message ?? "No se pudo instalar. Revisa el token en Keys.");
    } finally {
      setInstalling(false);
    }
  };

  const ranking24 = useMemo(() => {
    return [...games]
      .map(g => ({ g, n: playCounts[g.id] ?? 0 }))
      .filter(x => x.n > 0)
      .sort((a, b) => b.n - a.n)
      .slice(0, 3);
  }, [games, playCounts]);

  const sections = useMemo(() => {
    if (!games.length) return null;
    const scored = [...games];
    const featured = [...scored].sort((a, b) => (b.likes + b.comments_count * 2) - (a.likes + a.comments_count * 2))[0];
    const featuredId = featured?.id;

    const continuePlaying = scored
      .filter(g => g.id !== featuredId && (g.owned === true || g.author_id === myId))
      .slice(0, 12);

    const continueIds = new Set(continuePlaying.map(g => g.id));

    const recommended = scored
      .filter(g => g.id !== featuredId && !continueIds.has(g.id))
      .sort((a, b) => (b.likes + b.favorites) - (a.likes + a.favorites))
      .slice(0, 12);

    const now = Date.now();
    const week = 1000 * 60 * 60 * 24 * 7;

    const playsOf = (g: PostWithMeta) => playCounts[g.id] ?? 0;
    const hot = [...scored].sort((a, b) => {
      const pa = playsOf(a), pb = playsOf(b);
      if (pa !== pb) return pb - pa;
      const ageA = now - new Date(a.created_at).getTime();
      const ageB = now - new Date(b.created_at).getTime();
      const scoreA = (a.likes + a.favorites * 1.5 + a.comments_count * 2) * Math.pow(0.5, ageA / (week * 4));
      const scoreB = (b.likes + b.favorites * 1.5 + b.comments_count * 2) * Math.pow(0.5, ageB / (week * 4));
      return scoreB - scoreA;
    });
    const growing = [...scored]
      .filter(g => now - new Date(g.created_at).getTime() < week * 2)
      .sort((a, b) => {
        const ageA = Math.max(1, (now - new Date(a.created_at).getTime()) / 36e5);
        const ageB = Math.max(1, (now - new Date(b.created_at).getTime()) / 36e5);
        const velA = (a.likes + a.favorites * 2 + a.comments_count * 3) / ageA;
        const velB = (b.likes + b.favorites * 2 + b.comments_count * 3) / ageB;
        return velB - velA;
      });
    const rated = [...scored].sort((a, b) => {
      const scoreA = (b.likes + b.favorites * 2) * Math.pow(0.5, (now - new Date(a.created_at).getTime()) / (week * 8));
      const scoreB = (b.likes + b.favorites * 2) * Math.pow(0.5, (now - new Date(b.created_at).getTime()) / (week * 8));
      return scoreB - scoreA;
    });
    const brandNew = [...scored].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Para ti: games whose genre matches games the current user has published
    const myGenres = new Set(
      games
        .filter(g => g.author_id === myId && g.game_genre)
        .map(g => g.game_genre!)
    );
    const forYou = myGenres.size > 0
      ? [...scored]
          .filter(g => g.author_id !== myId && g.game_genre && myGenres.has(g.game_genre))
          .sort((a, b) => (b.likes + b.favorites * 2 + b.comments_count) - (a.likes + a.favorites * 2 + a.comments_count))
          .slice(0, 12)
      : [];

    return { featured, continuePlaying, recommended, forYou, trends: { hot, growing, rated, new: brandNew } };
  }, [games, myId, playCounts]);

  if (!sections) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-surface p-8 text-center space-y-3">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 border border-primary/15 grid place-items-center">
          <Gamepad2 size={26} className="text-primary" />
        </div>
        <div className="font-display text-sm">Aún no hay juegos publicados</div>
        <div className="text-xs text-muted-foreground max-w-xs mx-auto">
          Abre el editor y publica el primero.
        </div>
        <Link to="/editor" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl grad-brand text-primary-foreground text-xs font-display tracking-widest">
          ABRIR EDITOR
        </Link>
      </div>
    );
  }

  const { featured, continuePlaying, recommended, forYou, trends } = sections;
  const trendList = trends[trend];

  const featuredIds = getFeaturedGameIds();
  const curatedGames = useMemo(() => {
    if (!featuredIds.length) return [];
    const byId = new Map(games.map(g => [g.id, g]));
    return featuredIds.map(id => byId.get(id)).filter((g): g is PostWithMeta => !!g);
  }, [games, featuredIds]);

  return (
    <div className="space-y-5">
      {/* 0. Curated featured games header */}
      {curatedGames.length > 0 && (
        <CuratedHeader games={curatedGames} onOpen={openGame}
          onLike={(id) => { toggleReaction({ postId: id, type: "like" }); onChange(); }}
          onFavorite={(id) => { toggleReaction({ postId: id, type: "favorite" }); onChange(); }}
        />
      )}

      {/* 1. Banner destacado */}
      <FeaturedBanner post={featured} plays24={playCounts[featured.id] ?? 0} onPlay={() => openGame(featured)} />

      {/* 2. Ranking */}
      {rankCloud === false && games.length > 0 && (
        <RankingSyncBanner installing={installing} message={installMsg} onInstall={installRankingTable} />
      )}
      <Ranking24 games={ranking24} totalGames={games.length} onOpen={openGame} />

      {/* 3. Continuar jugando */}
      {continuePlaying.length > 0 && (
        <Section title="Continuar jugando" subtitle="Retoma donde lo dejaste">
          <IconRow games={continuePlaying} onOpen={openGame} />
        </Section>
      )}

      {/* 4. Para ti — basado en géneros del usuario */}
      {forYou.length > 0 && (
        <Section title="Para ti" subtitle="Basado en los juegos que publicas">
          <IconRow games={forYou} onOpen={openGame} />
        </Section>
      )}

      {/* 5. Tendencias — populares */}
      <div className="space-y-2">
        <div className="flex items-end justify-between px-1">
          <div>
            <div className="font-display text-base leading-tight">Tendencias</div>
            <div className="text-[11px] text-muted-foreground">Lo que se mueve ahora mismo</div>
          </div>
        </div>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
          <TrendChip active={trend === "hot"} onClick={() => setTrend("hot")} icon={<Flame size={12} />} label="Más jugados hoy" />
          <TrendChip active={trend === "growing"} onClick={() => setTrend("growing")} icon={<Rocket size={12} />} label="Creciendo rápido" />
          <TrendChip active={trend === "rated"} onClick={() => setTrend("rated")} icon={<Heart size={12} />} label="Mejor valorados" />
          <TrendChip active={trend === "new"} onClick={() => setTrend("new")} icon={<SparklesIcon size={12} />} label="Nuevos" />
        </div>
        <div className="grid grid-cols-4 xs:grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-3 gap-y-4 pt-1">
          {trendList.slice(0, 18).map(g => (
            <GameIcon key={g.id} post={g} onOpen={() => openGame(g)} />
          ))}
        </div>
      </div>

      {/* 6. Recomendados — abajo */}
      {recommended.length > 0 && (
        <Section title="Recomendados para ti" subtitle="En base a lo que juega la comunidad">
          <IconRow games={recommended} onOpen={openGame} />
        </Section>
      )}
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-end justify-between px-1">
        <div>
          <div className="font-display text-base leading-tight">{title}</div>
          {subtitle && <div className="text-[11px] text-muted-foreground">{subtitle}</div>}
        </div>
        <ChevronRight size={16} className="text-muted-foreground opacity-40" />
      </div>
      {children}
    </section>
  );
}

function IconRow({ games, onOpen }: { games: PostWithMeta[]; onOpen: (g: PostWithMeta) => void }) {
  return (
    <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-3 px-3 pb-1 md:flex-wrap md:overflow-visible md:justify-start">
      {games.map(g => (
        <GameIcon key={g.id} post={g} onOpen={() => onOpen(g)} />
      ))}
    </div>
  );
}

function TrendChip({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 flex items-center gap-1.5 px-3 h-8 rounded-lg text-[11px] font-medium transition-colors duration-200 active:scale-[0.96] ${
        active
          ? "bg-primary text-white"
          : "bg-card border border-line-strong text-ink-2 hover:border-primary/30 hover:text-primary"
      }`}
    >
      {icon} {label}
    </button>
  );
}

function RankingSyncBanner({ installing, message, onInstall }: {
  installing: boolean;
  message: string | null;
  onInstall: () => void;
}) {
  return (
    <section className="flex items-center gap-2.5 rounded-2xl border border-amber-400/40 bg-amber-50/70 dark:bg-amber-500/10 px-3.5 py-3">
      <div className="w-9 h-9 shrink-0 rounded-xl bg-amber-500/15 grid place-items-center">
        <CloudOff size={16} className="text-amber-600" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-display text-[12px] font-semibold leading-tight text-amber-900 dark:text-amber-200">
          El ranking no se sincroniza entre dispositivos
        </div>
        <div className="text-[10px] text-amber-800/80 dark:text-amber-300/80 leading-snug mt-0.5">
          Falta la tabla <span className="font-mono">game_plays</span> en Supabase. Con un clic la creas y el conteo pasa a ser global.
        </div>
        {message && (
          <div className={`text-[10px] mt-1 leading-snug flex items-center gap-1 ${message.startsWith("Tabla creada") || message.startsWith("Tabla") ? "text-emerald-600" : "text-amber-700"}`}>
            {message.startsWith("Tabla creada") ? <CheckCircle2 size={10} className="shrink-0" /> : null}
            {message}
          </div>
        )}
      </div>
      <button
        onClick={onInstall}
        disabled={installing}
        className="shrink-0 h-8 px-3 rounded-lg grad-brand text-primary-foreground text-[10px] font-display font-semibold tracking-widest shadow-sm active:scale-[0.97] transition disabled:opacity-50 flex items-center gap-1.5"
      >
        {installing ? <Loader2 size={11} className="animate-spin" /> : <Trophy size={11} />}
        {installing ? "CREANDO…" : "INSTALAR"}
      </button>
    </section>
  );
}

function Ranking24({ games, totalGames, onOpen }: {
  games: { g: PostWithMeta; n: number }[];
  totalGames: number;
  onOpen: (g: PostWithMeta) => void;
}) {
  if (games.length === 0) {
    return (
      <section className="rounded-2xl border border-border/60 bg-card/60 p-3.5 flex items-center gap-3">
        <div className="w-10 h-10 shrink-0 rounded-xl bg-primary/10 grid place-items-center">
          <Trophy size={17} className="text-primary" />
        </div>
        <div className="min-w-0">
          <div className="font-display text-[13px] leading-tight">Ranking · Más jugados (24h)</div>
          <div className="text-[11px] text-muted-foreground">
            {totalGames > 0
              ? "Aún no hay jugadas registradas hoy. ¡Dale a JUGAR y sube a la cima!"
              : "Cuando haya juegos publicados, aquí verás los más jugados."}
          </div>
        </div>
      </section>
    );
  }

  const medals = ["text-amber-400", "text-slate-400", "text-amber-700"];

  return (
    <section className="rounded-2xl border border-primary/20 grad-brand-soft p-3.5 space-y-2.5">
      <div className="flex items-center gap-2">
        <Trophy size={15} className="text-primary" />
        <div className="font-display text-[13px] leading-tight">Ranking · Más jugados (24h)</div>
        <span className="px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-[9px] font-mono font-bold tracking-wider">TOP 3</span>
        <span className="ml-auto text-[9px] font-mono text-muted-foreground/60">en vivo</span>
      </div>
      <div className="space-y-1.5">
        {games.map(({ g, n }, i) => {
          const title = extractTitle(g.content);
          return (
            <button
              key={g.id}
              onClick={() => onOpen(g)}
              className="w-full flex items-center gap-2.5 rounded-xl bg-card/80 border border-border/50 px-2.5 py-2 text-left hover:border-primary/40 hover:bg-card active:scale-[0.99] transition"
            >
              <span className={`w-6 h-6 shrink-0 rounded-lg grid place-items-center font-display text-[11px] font-bold ${i < 3 ? `bg-primary/10 ${medals[i]}` : "text-muted-foreground/60 bg-muted/60"}`}>
                {i + 1}
              </span>
              <div className="relative w-11 h-11 shrink-0 rounded-lg overflow-hidden border border-border/60 bg-muted/40">
                {g.signed_cover ? (
                  <img src={g.signed_cover} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full grid place-items-center text-muted-foreground/50">
                    <Gamepad2 size={16} />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-semibold truncate leading-tight">{title}</div>
                <div className="text-[10px] font-mono text-muted-foreground truncate">
                  @{g.author?.username ?? "jugador"}
                </div>
              </div>
              <span className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-display font-semibold tabular-nums">
                <Flame size={10} fill="currentColor" /> {n}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Featured games spotlight carousel.
 * Layout per wireframe: large square image LEFT, title + description RIGHT,
 * action bar at bottom (like circle + play bar). Auto-rotates.
 */
function CuratedHeader({ games, onOpen, onLike, onFavorite }: {
  games: PostWithMeta[];
  onOpen: (g: PostWithMeta) => void;
  onLike: (postId: string) => void;
  onFavorite: (postId: string) => void;
}) {
  const [active, setActive] = useState(0);
  const pauseRef = useRef(false);
  const [paused, setPaused] = useState(false);
  const len = games.length;

  useEffect(() => {
    if (len <= 1) return;
    const id = setInterval(() => {
      if (!pauseRef.current) {
        setActive(i => (i + 1) % len);
      }
    }, 5000);
    return () => clearInterval(id);
  }, [len]);

  const onEnter = () => { pauseRef.current = true; setPaused(true); };
  const onLeave = () => { pauseRef.current = false; setPaused(false); };
  const goTo = (i: number) => { setActive(i); };

  if (len === 0) return null;

  const g = games[active];
  const title = (g.content.split("\n")[0] || "Juego").replace(/^🎮\s*/, "").trim() || "Juego";
  const desc = g.content.split("\n").slice(1).join(" ").trim();
  const hasCover = !!g.signed_cover;
  const price = g.price_orbes ?? 0;

  return (
    <section className="space-y-3">
      {/* Label */}
      <div className="flex items-center gap-2 px-1">
        <div className="w-6 h-6 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center">
          <Star size={12} className="text-primary" fill="currentColor" />
        </div>
        <div>
          <div className="font-display text-[13px] font-bold leading-tight">Destacados por el equipo</div>
          <div className="text-[10px] text-muted-foreground">Selección curada por el equipo</div>
        </div>
      </div>

      {/* Spotlight card — matches wireframe */}
      <div
        className="w-full rounded-2xl border border-border/60 bg-card overflow-hidden active:scale-[0.99] transition-transform duration-300 select-none"
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        onTouchStart={onEnter}
        onTouchEnd={onLeave}
      >
        {/* Main content area: image left + text right */}
        <div className="flex gap-3.5 p-3.5 pb-2">
          {/* Left: large square game cover */}
          <button
            onClick={() => onOpen(g)}
            className="relative w-[38%] aspect-square shrink-0 rounded-xl overflow-hidden bg-gradient-to-br from-primary/5 to-primary/10 border border-border/30 group-hover:border-primary/30 transition-colors active:scale-[0.97]"
          >
            {hasCover ? (
              <img
                key={active}
                src={g.signed_cover ?? undefined}
                alt={title}
                className="absolute inset-0 w-full h-full object-cover animate-in fade-in duration-500 group-hover:scale-[1.03] transition-transform duration-500"
              />
            ) : (
              <div key={active} className="absolute inset-0 grid place-items-center animate-in fade-in duration-500">
                <Joystick size={40} strokeWidth={1.2} className="text-primary/20" />
              </div>
            )}
            {/* Subtle inner shadow for depth */}
            <div className="absolute inset-0 shadow-[inset_0_0_20px_rgba(0,0,0,0.06)] pointer-events-none" />
          </button>

          {/* Right: title + author + description */}
          <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
            <div className="space-y-1">
              <button
                onClick={() => onOpen(g)}
                className="text-left w-full"
              >
                <div className="font-display text-[15px] sm:text-base font-bold leading-snug line-clamp-1 text-foreground hover:text-primary transition-colors">
                  {title}
                </div>
              </button>
              {g.author && (
                <div className="text-[11px] text-muted-foreground font-mono">
                  @{g.author.username ?? "jugador"}
                </div>
              )}
              {desc && (
                <p className="text-[11px] text-muted-foreground/70 leading-relaxed line-clamp-3 mt-1">
                  {desc}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Action bar at bottom */}
        <div className="flex items-center gap-2 px-3.5 pb-3">
          {/* Like button */}
          <button
            onClick={() => onLike(g.id)}
            className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90 ${
              g.my_like
                ? "bg-red-500/15 text-red-500"
                : "bg-muted/60 text-muted-foreground hover:bg-red-500/10 hover:text-red-400"
            }`}
          >
            <Heart size={14} fill={g.my_like ? "currentColor" : "none"} />
          </button>
          <span className="text-[10px] tabular-nums text-muted-foreground font-mono">
            {g.likes}
          </span>

          {/* Favorite/bookmark button */}
          <button
            onClick={() => onFavorite(g.id)}
            className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90 ${
              g.my_favorite
                ? "bg-amber-500/15 text-amber-500"
                : "bg-muted/60 text-muted-foreground hover:bg-amber-500/10 hover:text-amber-500"
            }`}
          >
            <Bookmark size={14} fill={g.my_favorite ? "currentColor" : "none"} />
          </button>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Play button */}
          <button
            onClick={() => onOpen(g)}
            className="shrink-0 h-8 px-4 rounded-full grad-brand text-white font-display tracking-widest text-[10px] flex items-center justify-center gap-1.5 active:scale-95 transition-transform shadow-sm"
          >
            <Play size={12} fill="currentColor" /> JUGAR
          </button>
        </div>
      </div>

      {/* Navigation dots + progress */}
      {len > 1 && (
        <div className="flex items-center justify-center gap-2">
          {games.map((_, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); goTo(i); }}
              onMouseEnter={onEnter}
              onMouseLeave={onLeave}
              className={`transition-all duration-300 rounded-full ${
                i === active
                  ? "w-6 h-2 bg-primary"
                  : "w-2 h-2 bg-primary/25 hover:bg-primary/40"
              }`}
              aria-label={`Ir al juego ${i + 1}`}
            />
          ))}
          <div className="ml-1 h-0.5 w-10 rounded-full bg-primary/10 overflow-hidden">
            <div
              className="h-full bg-primary/50 rounded-full"
              style={{
                width: paused ? "0%" : "100%",
                transition: paused ? "none" : "width 5s linear",
                transformOrigin: "left",
              }}
            />
          </div>
        </div>
      )}
    </section>
  );
}

function FeaturedBanner({ post, plays24, onPlay }: { post: PostWithMeta; plays24?: number; onPlay: () => void }) {
  const title = extractTitle(post.content);
  const hasCover = !!post.signed_cover;
  const active = plays24 && plays24 > 0 ? plays24 : 1 + Math.floor((post.likes + post.comments_count) * 1.3);
  return (
    <div className="relative">
      <div className="banner-glow-halo absolute -inset-3 rounded-[32px]" aria-hidden />
      <div className="banner-glow relative rounded-3xl overflow-hidden border border-white/70">
        <div className="relative aspect-[16/10] w-full md:aspect-[21/9]">
        {hasCover ? (
          <img src={post.signed_cover ?? undefined} alt={title} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 grad-brand">
            <div className="absolute inset-0 grid place-items-center">
              <Joystick size={120} strokeWidth={1} className="text-white/[0.13]" />
            </div>
          </div>
        )}
        {hasCover && <div className="absolute inset-0 banner-overlay-deep" />}
        {!hasCover && <div className="absolute inset-0 bg-gradient-to-t from-ink/30 via-ink/5 to-transparent" />}
        {hasCover && <div className="banner-shine" />}
        <div className="absolute inset-0 pointer-events-none noise-overlay opacity-[0.16] mix-blend-overlay" />
        <div className="badge-glow absolute top-3 left-3 flex items-center gap-1.5 px-2.5 h-6 rounded-full bg-primary/95 text-primary-foreground text-[10px] font-display tracking-widest ring-1 ring-white/30 ring-inset">
          <Crown size={11} fill="currentColor" /> JUEGO MÁS JUGADO
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 p-4 space-y-3">
        <div>
          <div className="text-white font-display text-xl leading-tight drop-shadow">{title}</div>
          <div className="text-white/80 text-[11px] font-mono truncate">
            @{post.author?.username ?? "jugador"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onPlay}
            className="flex-1 h-11 rounded-xl bg-white text-primary font-display tracking-widest text-xs flex items-center justify-center gap-2  transition "
          >
            <Play size={16} fill="currentColor" /> JUGAR
          </button>
        </div>
        <div className="flex items-center gap-3 text-white/90 text-[11px]">
          <span className="flex items-center gap-1">
            {plays24 && plays24 > 0 ? <Flame size={11} fill="currentColor" /> : <Users size={11} />}
            {plays24 && plays24 > 0 ? `${plays24} jugados hoy` : `${active} activos`}
          </span>
          <span className="flex items-center gap-1"><Heart size={11} fill="currentColor" /> {post.likes}</span>
        </div>
      </div>
      </div>
    </div>
  );
}
