import { useEffect, useState } from "react";
import type { Profile } from "@/lib/social/api";

/** Forma mínima de perfil: acepta Profile, ManagedUser y objetos de grupo. */
export type AvatarLike = {
  id?: string;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
};

/**
 * Degradados suaves (cobalto/cian/violeta) para el monograma de respaldo.
 * Deterministas por usuario: mismo perfil → mismo degradado en toda la app.
 */
const FALLBACK_GRADIENTS = [
  "linear-gradient(135deg, oklch(0.58 0.14 262) 0%, oklch(0.66 0.09 218) 100%)",
  "linear-gradient(135deg, oklch(0.55 0.14 288) 0%, oklch(0.64 0.1 242) 100%)",
  "linear-gradient(135deg, oklch(0.64 0.08 218) 0%, oklch(0.72 0.07 192) 100%)",
  "linear-gradient(135deg, oklch(0.57 0.13 275) 0%, oklch(0.66 0.09 230) 100%)",
  "linear-gradient(135deg, oklch(0.61 0.11 252) 0%, oklch(0.69 0.08 208) 100%)",
];

/** Hash FNV-1a estable por id/usuario → degradado fijo (nunca cambia entre renders). */
function hashKey(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Avatar universal: foto subida → monograma con degradado suave determinista.
 *
 * El monograma siempre se renderiza POR DEBAJO de la foto: mientras la imagen
 * carga (o si la URL está rota/expirada) se ve la inicial con color de acento,
 * nunca un hueco, un «?» ni un cuadro gris genérico. Si la imagen falla, se
 * elimina y queda el monograma.
 */
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
  const [imgFailed, setImgFailed] = useState(false);
  const url = p?.avatar_url;
  const name = (label || p?.display_name || p?.username || "").trim();
  const initial = (name.charAt(0) || "A").toUpperCase();
  const seed = p?.id ?? p?.username ?? name ?? "user";
  const gradient = FALLBACK_GRADIENTS[hashKey(seed) % FALLBACK_GRADIENTS.length];

  // Al cambiar la URL (o aparecer) se reintenta la imagen y se vuelve al monograma.
  useEffect(() => {
    setImgFailed(false);
  }, [url]);

  const roundCls = rounded === "full" ? "rounded-full" : rounded === "xl" ? "rounded-xl" : rounded === "lg" ? "rounded-lg" : "rounded-md";
  const dims = size !== undefined ? { width: size, height: size, fontSize: Math.max(10, size * 0.42) } : {};
  return (
    <div
      className={`relative overflow-hidden shrink-0 grid place-items-center font-display font-semibold text-white ${roundCls} ${className}`}
      style={{ ...dims, backgroundImage: gradient, ...style }}
    >
      <span className="relative">{initial}</span>
      {url && !imgFailed && (
        <img
          key={url}
          src={url}
          alt=""
          loading="lazy"
          onError={() => setImgFailed(true)}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
    </div>
  );
}
