import { useEffect, useState } from "react";
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
 * Portada: cover del juego → primera captura → si no hay (o la imagen falla),
 * tile «blueprint» (cuadrícula técnica sobre blanco) con icono de juego de
 * trazo fino y ticks de esquina. Sin morado ni emojis: cobalto sobre blanco.
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

  const coverUrl = post.signed_cover ?? post.signed_screenshots[0] ?? null;
  const [imgFailed, setImgFailed] = useState(false);
  // Al cambiar la URL (o aparecer) se reintenta la imagen.
  useEffect(() => {
    setImgFailed(false);
  }, [coverUrl]);
  const hasCover = !!coverUrl && !imgFailed;

  const dims = size === "sm" ? "w-16" : size === "lg" ? "w-24" : "w-20";
  const radius = size === "lg" ? "rounded-[22px]" : "rounded-2xl";

  return (
    <button
      onClick={onOpen}
      className={`group flex flex-col items-center gap-1.5 ${dims} shrink-0 active:scale-[0.94] transition-transform`}
      title={title}
    >
      <div
        className={`relative aspect-square w-full ${radius} overflow-hidden ${
          hasCover
            ? "border border-white/60  transition-shadow group-hover:"
            : "tile-blueprint"
        }`}
      >
        {hasCover ? (
          <img
            src={coverUrl}
            alt={title}
            loading="lazy"
            onError={() => setImgFailed(true)}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <TileMark />
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

/** Icono de mando realista para tiles sin portada. */
function GamepadMini({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size * 0.55} viewBox="0 0 120 66" fill="none" className={className}>
      <path d="M20 18C20 12 25 8 32 8h56c7 0 12 4 12 10v18c0 6-3 10-8 14l-14 12c-3 2.5-7 4-12 4H46c-5 0-9-1.5-12-4L20 42V18z" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M20 38c-4 2-8 6-8 12v4c0 2 1 3 3 3 3 0 6-2 8-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M100 38c4 2 8 6 8 12v4c0 2-1 3-3 3-3 0-6-2-8-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <rect x="32" y="22" width="6" height="16" rx="1.5" fill="currentColor" fillOpacity="0.35" />
      <rect x="27" y="27" width="16" height="6" rx="1.5" fill="currentColor" fillOpacity="0.35" />
      <circle cx="82" cy="24" r="4.5" fill="currentColor" fillOpacity="0.4" stroke="currentColor" strokeWidth="2" />
      <circle cx="92" cy="30" r="4.5" fill="currentColor" fillOpacity="0.4" stroke="currentColor" strokeWidth="2" />
      <circle cx="72" cy="30" r="4.5" fill="currentColor" fillOpacity="0.4" stroke="currentColor" strokeWidth="2" />
      <circle cx="82" cy="36" r="4.5" fill="currentColor" fillOpacity="0.4" stroke="currentColor" strokeWidth="2" />
      <circle cx="42" cy="38" r="5.5" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="2" />
      <circle cx="42" cy="38" r="2.5" fill="currentColor" fillOpacity="0.5" />
      <circle cx="72" cy="42" r="5.5" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="2" />
      <circle cx="72" cy="42" r="2.5" fill="currentColor" fillOpacity="0.5" />
      <ellipse cx="54" cy="32" rx="3" ry="1.5" fill="currentColor" fillOpacity="0.35" />
      <ellipse cx="62" cy="32" rx="3" ry="1.5" fill="currentColor" fillOpacity="0.35" />
    </svg>
  );
}

/** Marca del tile sin portada: icono de juego de trazo fino sobre la cuadrícula blueprint. */
function TileMark() {
  return (
    <span className="absolute inset-0 grid place-items-center pointer-events-none" aria-hidden>
      {/* halo suave: profundidad sin caja ni recuadro genérico */}
      <span className="absolute w-14 h-14 rounded-full bg-primary/10 blur-xl" />
      <GamepadMini size={34} className="relative text-primary/70" />
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
        stroke="oklch(0.56 0.14 262 / 0.45)"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
      />
    </svg>
  );
}
