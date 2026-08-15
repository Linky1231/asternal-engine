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
 * Avatar universal: foto subida → inicial con color de acento.
 *
 * La inicial siempre se renderiza POR DEBAJO de la foto: mientras la imagen
 * carga (o si la URL está rota/expirada) se ve la letra, nunca un hueco ni un
 * «?». Si la imagen falla, se elimina y queda la inicial de respaldo.
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
  const initial = (label || p?.display_name || p?.username || "?").trim().charAt(0).toUpperCase();

  // Al cambiar la URL (o aparecer) se reintenta la imagen y se vuelve a la inicial.
  useEffect(() => {
    setImgFailed(false);
  }, [url]);

  const roundCls = rounded === "full" ? "rounded-full" : rounded === "xl" ? "rounded-xl" : rounded === "lg" ? "rounded-lg" : "rounded-md";
  const dims = size !== undefined ? { width: size, height: size, fontSize: Math.max(10, size * 0.42) } : {};
  return (
    <div
      className={`relative overflow-hidden shrink-0 grid place-items-center font-display font-semibold text-primary-foreground bg-primary ${roundCls} ${className}`}
      style={{ ...dims, ...style }}
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
