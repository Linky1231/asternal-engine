import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Play, Flame, Rocket, Heart, Sparkles as SparklesIcon, Users, ChevronRight, Gamepad2 } from "lucide-react";
import type { PostWithMeta } from "@/lib/social/api";
import { GameIcon } from "./GameIcon";
import { GameCard } from "./GameCard";

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
  const [selected, setSelected] = useState<PostWithMeta | null>(null);
  const [trend, setTrend] = useState<TrendTab>("hot");

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

    const hot = [...scored].sort((a, b) => (b.likes + b.comments_count) - (a.likes + a.comments_count));
    const growing = [...scored]
      .filter(g => now - new Date(g.created_at).getTime() < week * 2)
      .sort((a, b) => b.likes - a.likes);
    const rated = [...scored].sort((a, b) => (b.likes + b.favorites * 2) - (a.likes + a.favorites * 2));
    const brandNew = [...scored].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return { featured, continuePlaying, recommended, trends: { hot, growing, rated, new: brandNew } };
  }, [games, myId]);

  if (!sections) {
    return (
      <div className="panel rounded-2xl border border-dashed border-border p-8 text-center space-y-3">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-primary/30 to-accent/30 grid place-items-center">
          <Gamepad2 size={26} className="text-primary-glow" />
        </div>
        <div className="font-display text-sm">Aún no hay juegos publicados</div>
        <div className="text-xs text-muted-foreground max-w-xs mx-auto">
          Abre el editor y publica el primero.
        </div>
        <Link to="/editor" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground text-xs font-display tracking-widest">
          ABRIR EDITOR
        </Link>
      </div>
    );
  }

  const { featured, continuePlaying, recommended, trends } = sections;
  const trendList = trends[trend];

  return (
    <div className="space-y-5">
      {/* 1. Banner destacado */}
      <FeaturedBanner post={featured} onPlay={() => setSelected(featured)} />

      {/* 2. Continuar jugando */}
      {continuePlaying.length > 0 && (
        <Section title="Continuar jugando" subtitle="Retoma donde lo dejaste">
          <IconRow games={continuePlaying} onOpen={setSelected} />
        </Section>
      )}

      {/* 3. Recomendados para ti */}
      {recommended.length > 0 && (
        <Section title="Recomendados para ti" subtitle="En base a lo que juega la comunidad">
          <IconRow games={recommended} onOpen={setSelected} />
        </Section>
      )}

      {/* 4. Tendencias */}
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
            <GameIcon key={g.id} post={g} onOpen={() => setSelected(g)} />
          ))}
        </div>
      </div>

      {selected && (
        <GamePlayModal post={selected} myId={myId} isMod={isMod} onClose={() => setSelected(null)} onChange={onChange} />
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
      className={`shrink-0 flex items-center gap-1.5 px-3 h-8 rounded-full text-[11px] font-medium tracking-wide transition ${
        active
          ? "bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-sm"
          : "bg-muted/50 text-muted-foreground hover:bg-muted"
      }`}
    >
      {icon} {label}
    </button>
  );
}

function FeaturedBanner({ post, onPlay }: { post: PostWithMeta; onPlay: () => void }) {
  const title = extractTitle(post.content);
  const active = 1 + Math.floor((post.likes + post.comments_count) * 1.3);
  return (
    <div className="relative rounded-3xl overflow-hidden border border-primary/30 shadow-lg">
      <div className="relative aspect-[16/10] w-full md:aspect-[21/9]">
        {post.signed_cover ? (
          <img src={post.signed_cover} alt={title} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/40 to-accent/40" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10" />
        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 h-6 rounded-full bg-primary/90 text-primary-foreground text-[10px] font-display tracking-widest">
          <Flame size={11} fill="currentColor" /> DESTACADO
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
            className="flex-1 h-11 rounded-xl bg-white text-primary font-display tracking-widest text-xs flex items-center justify-center gap-2 active:scale-95 transition shadow-md"
          >
            <Play size={16} fill="currentColor" /> JUGAR
          </button>
        </div>
        <div className="flex items-center gap-3 text-white/90 text-[11px]">
          <span className="flex items-center gap-1"><Users size={11} /> {active} activos</span>
          <span className="flex items-center gap-1"><Heart size={11} fill="currentColor" /> {post.likes}</span>
        </div>
      </div>
    </div>
  );
}

function GamePlayModal({
  post, myId, isMod, onClose, onChange,
}: {
  post: PostWithMeta; myId: string | null; isMod: boolean; onClose: () => void; onChange: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm p-3 flex items-start justify-center pt-16 overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-lg animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
      >
        <GameCard post={post} myId={myId} isMod={isMod} onChange={onChange} />
        <button
          onClick={onClose}
          className="mt-3 w-full h-10 rounded-xl bg-white/10 text-white text-xs font-display tracking-widest border border-white/20 active:scale-95"
        >
          CERRAR
        </button>
      </div>
    </div>
  );
}
