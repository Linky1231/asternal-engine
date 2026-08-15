import { Sparkles, Lock } from "lucide-react";
import type { PostWithMeta } from "@/lib/social/api";

function extractTitle(content: string): string {
  const line = content.split("\n")[0] || "Juego";
  return line.replace(/^🎮\s*/, "").trim() || "Juego";
}

/**
 * App-icon style game tile. Square, rounded, with cover image cropped from center.
 * Tap fires onOpen — the parent decides whether to open a play sheet, GameCard modal, etc.
 *
 * Sin portada: tile «blueprint» (cuadrícula técnica sobre blanco) con una marca
 * geométrica mínima y ticks de esquina, en lugar del recuadro celeste con el
 * icono de control genérico.
 */
export function GameIcon({
  post,
  onOpen,
  size = "md",
  showTitle = true,
}: {
  post: PostWithMeta;
  onOpen: () => void;
  size?: "sm" | "md" | "lg";
  showTitle?: boolean;
}) {
  const title = extractTitle(post.content);
  const price = post.price_orbes ?? 0;
  const owned = post.owned ?? price <= 0;
  const needsPurchase = !owned && price > 0;

  const dims = size === "sm" ? "w-16" : size === "lg" ? "w-24" : "w-20";
  const radius = size === "lg" ? "rounded-[22px]" : "rounded-2xl";
  const hasCover = !!post.signed_cover;

  return (
    <button
      onClick={onOpen}
      className={`group flex flex-col items-center gap-1.5 ${dims} shrink-0 active:scale-[0.94] transition-transform`}
      title={title}
    >
      <div
        className={`relative aspect-square w-full ${radius} overflow-hidden ${
          hasCover
            ? "border border-white/60 shadow-[0_14px_36px_-16px_oklch(0.45_0.22_268/0.55)] transition-shadow group-hover:shadow-[0_20px_44px_-16px_oklch(0.45_0.24_268/0.6)]"
            : "tile-blueprint"
        }`}
      >
        {hasCover ? (
          <img
            src={post.signed_cover ?? undefined}
            alt={title}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <BlueprintMark />
        )}
        {/* subtle top gloss like iOS icons */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/15 via-transparent to-black/[0.06]" />
        {/* ticks de esquina: detalle técnico del tile blueprint */}
        {!hasCover && <CornerTicks />}
        {needsPurchase ? (
          <div className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-white/95 grid place-items-center shadow">
            <Lock size={11} className="text-primary" />
          </div>
        ) : price > 0 && owned ? (
          <div className="absolute bottom-1 right-1 px-1.5 h-5 rounded-full bg-emerald-500/95 grid place-items-center shadow">
            <Sparkles size={10} className="text-white" fill="currentColor" />
          </div>
        ) : null}
      </div>
      {showTitle && (
        <div className="text-[10.5px] font-medium leading-tight text-center w-full line-clamp-2 min-h-[24px]">
          {title}
        </div>
      )}
    </button>
  );
}

/** Marca geométrica mínima: rombo de cruz con centro en degradado cobalto→violeta. */
function BlueprintMark() {
  return (
    <span className="relative grid place-items-center pointer-events-none" aria-hidden>
      <span className="w-8 h-8 rotate-45 rounded-[6px] border border-primary/40 bg-white/80 shadow-[0_6px_18px_-8px_oklch(0.53_0.22_262/0.5)]" />
      <span className="absolute w-3 h-3 rotate-45 rounded-[3px] bg-gradient-to-br from-primary to-violet-500" />
    </span>
  );
}

/** Ticks de las 4 esquinas (línea técnica, como marca de registro de blueprint). */
function CornerTicks() {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 80 80"
      preserveAspectRatio="none"
      aria-hidden
    >
      <path
        d="M7 22 V7 H22 M73 22 V7 H58 M73 58 V73 H58 M7 58 V73 H22"
        fill="none"
        stroke="oklch(0.53 0.22 262 / 0.5)"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
      />
    </svg>
  );
}
