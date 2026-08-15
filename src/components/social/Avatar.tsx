import type { Profile } from "@/lib/social/api";

/** Forma mínima de perfil: acepta Profile, ManagedUser y objetos de grupo. */
export type AvatarLike = {
  id?: string;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
};

/** Avatar universal: foto subida → inicial con color de acento. */
export function Avatar({
  p,
  size,
  className = "",
  style,
  rounded = "full",
  label,
}: {
  p?: AvatarLike | null;
  /** Si se omite, el tamaño lo controla className (útil para tamaños responsive). */
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  rounded?: "full" | "xl" | "lg" | "md";
  label?: string;
}) {
  const initial = (label || p?.display_name || p?.username || "?").trim().charAt(0).toUpperCase();
  const roundCls = rounded === "full" ? "rounded-full" : rounded === "xl" ? "rounded-xl" : rounded === "lg" ? "rounded-lg" : "rounded-md";
  const dims = size !== undefined ? { width: size, height: size, fontSize: Math.max(10, size * 0.42) } : {};
  return (
    <div
      className={`relative overflow-hidden shrink-0 grid place-items-center font-display font-semibold text-primary-foreground bg-primary ${roundCls} ${className}`}
      style={{ ...dims, ...style }}
    >
      {p?.avatar_url ? (
        <img src={p.avatar_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <span className="relative">{initial}</span>
      )}
    </div>
  );
}
