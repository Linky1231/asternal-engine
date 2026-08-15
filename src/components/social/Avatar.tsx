import { useState } from "react";
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
 * Carga limpia: la inicial (o un círculo neutro si aún no hay perfil) se pinta
 * SIEMPRE debajo, y la foto solo se superpone cuando ya cargó (onLoad) o venía
 * en caché. Así nunca aparece un "?" ni el icono de imagen rota mientras la
 * imagen tarda en llegar; si la URL falla, se vuelve a la inicial con nombre.
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

  const name = (label || p?.display_name || p?.username || "").trim();
  const initial = name.charAt(0).toUpperCase();
  const url = p?.avatar_url && !imgFailed ? p.avatar_url : null;

  const roundCls = rounded === "full" ? "rounded-full" : rounded === "xl" ? "rounded-xl" : rounded === "lg" ? "rounded-lg" : "rounded-md";
  const dims = size !== undefined ? { width: size, height: size, fontSize: Math.max(10, size * 0.42) } : {};
  return (
    <div
      className={`relative overflow-hidden shrink-0 grid place-items-center font-display font-semibold text-primary-foreground bg-primary ${roundCls} ${className}`}
      style={{ ...dims, ...style }}
    >
      {/* Capa base: inicial solo si hay nombre; si no, círculo neutro (sin "?"). */}
      {initial ? (
        <span className="relative">{initial}</span>
      ) : (
        <span className="relative" aria-hidden="true" />
      )}
      {url && (
        <img
          src={url}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          onError={() => setImgFailed(true)}
        />
      )}
    </div>
  );
}
