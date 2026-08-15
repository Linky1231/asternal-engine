import { Gamepad2, Sparkles, Lock } from "lucide-react";
import type { PostWithMeta } from "@/lib/social/api";

function extractTitle(content: string): string {
  const line = content.split("\n")[0] || "Juego";
  return line.replace(/^🎮\s*/, "").trim() || "Juego";
}

/**
 * App-icon style game tile. Square, rounded, with cover image cropped from center.
 * Tap fires onOpen — the parent decides whether to open a play sheet, GameCard modal, etc.
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

  return (
    <button
      onClick={onOpen}
      className={`group flex flex-col items-center gap-1.5 ${dims} shrink-0 active:scale-[0.94] transition-transform`}
      title={title}
    >
      <div
        className={`relative aspect-square w-full ${radius} overflow-hidden border border-border/60 shadow-sm bg-gradient-to-br from-primary/20 to-accent/20 grid place-items-center`}
      >
        {post.signed_cover ? (
          <img
            src={post.signed_cover}
            alt={title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <Gamepad2 className="text-primary-glow/80" size={size === "lg" ? 32 : 26} />
        )}
        {/* subtle top gloss like iOS icons */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/15 via-transparent to-black/10" />
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
