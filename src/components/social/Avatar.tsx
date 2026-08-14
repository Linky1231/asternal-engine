import type { Profile } from "@/lib/social/api";
import {
  type AvatarSpec,
  DEFAULT_AVATAR,
  resolveAvatarSpec,
  SKIN_TONES,
  HAIR_COLORS,
  TOP_COLORS,
  BOTTOM_COLORS,
  SHOE_COLORS,
  ACCESSORY_COLORS,
  BACKGROUNDS,
} from "@/lib/social/avatar";

function pick(map: Record<string, string>, key: string | undefined, fallback: string): string {
  return (key && map[key]) || fallback;
}

/** Dibuja el personaje del avatar (spec) como SVG. Llena el contenedor. */
export function AvatarSvg({ spec, className = "" }: { spec: AvatarSpec; className?: string }) {
  const s = { ...DEFAULT_AVATAR, ...spec } as AvatarSpec;
  const skin = pick(SKIN_TONES, s.skin, "#F6C9A0");
  const hair = pick(HAIR_COLORS, s.hairColor, "#6B4423");
  const topColor = pick(TOP_COLORS, s.topColor, "#3D7BD9");
  const bottomColor = pick(BOTTOM_COLORS, s.bottomColor, "#2A3A5C");
  const shoesColor = pick(SHOE_COLORS, s.shoesColor, "#F4F5F7");
  const accColor = pick(ACCESSORY_COLORS, s.accessoryColor, "#2B2B33");
  const bg = pick(BACKGROUNDS, s.bg, "#7FB8E8");
  const eye = "#26262e";
  const hairShade = hair === "#E8C86A" || hair === "#B8BCC4" ? "#4a4436" : hair;

  // ── Pelo trasero (detrás de la cabeza) ──
  const backHair = (() => {
    switch (s.hair) {
      case "long":
        return (
          <>
            <ellipse cx={50} cy={36} rx={24.5} ry={26} fill={hair} />
            <path d="M30 36 q-4 16 0 30 q3 4 6 0 q3 -13 0 -26 z" fill={hair} />
            <path d="M70 36 q4 16 0 30 q-3 4 -6 0 q-3 -13 0 -26 z" fill={hair} />
          </>
        );
      case "medium":
        return <ellipse cx={50} cy={36} rx={24} ry={25} fill={hair} />;
      case "ponytail":
        return (
          <>
            <ellipse cx={50} cy={36} rx={23.5} ry={24} fill={hair} />
            <circle cx={73} cy={44} r={9} fill={hair} />
            <rect x={63} y={34} width={12} height={14} rx={5} fill={hair} />
          </>
        );
      case "curly":
        return <ellipse cx={50} cy={35} rx={24.5} ry={25} fill={hair} />;
      case "bun":
        return <ellipse cx={50} cy={36} rx={23} ry={24} fill={hair} />;
      default:
        return null;
    }
  })();

  // ── Flequillo / pelo delantero ──
  const frontHair = (() => {
    switch (s.hair) {
      case "bald":
        return null;
      case "spiky":
        return (
          <>
            <path d="M30 33 a20 20 0 0 1 40 0 q-1 -12 -10 -14 q-10 -3 -20 0 q-9 2 -10 14 z" fill={hair} />
            <g stroke={hair} strokeWidth={4} strokeLinecap="round">
              <path d="M40 12 l2 9" />
              <path d="M47 10 l2 9" />
              <path d="M54 10 l2 9" />
              <path d="M61 13 l1 8" />
              <path d="M34 15 l3 8" />
            </g>
          </>
        );
      case "curly":
        return (
          <>
            <path d="M30 33 a20 20 0 0 1 40 0 q-1 -12 -10 -14 q-10 -3 -20 0 q-9 2 -10 14 z" fill={hair} />
            <g fill={hair}>
              <circle cx={34} cy={18} r={5.5} />
              <circle cx={43} cy={13} r={6.5} />
              <circle cx={52} cy={12} r={6.5} />
              <circle cx={61} cy={14} r={6} />
              <circle cx={68} cy={20} r={5} />
              <circle cx={29} cy={25} r={4.5} />
              <circle cx={71} cy={26} r={4.5} />
            </g>
          </>
        );
      case "long":
        return (
          <>
            <path d="M30 33 a20 20 0 0 1 40 0 q-1 -12 -10 -14 q-10 -3 -20 0 q-9 2 -10 14 z" fill={hair} />
            <rect x={26.5} y={34} width={7} height={28} rx={3.5} fill={hair} />
            <rect x={66.5} y={34} width={7} height={28} rx={3.5} fill={hair} />
          </>
        );
      case "bun":
        return (
          <>
            <path d="M30 33 a20 20 0 0 1 40 0 q-1 -12 -10 -14 q-10 -3 -20 0 q-9 2 -10 14 z" fill={hair} />
            <circle cx={50} cy={9} r={6.5} fill={hair} />
          </>
        );
      default: // short, ponytail, medium
        return (
          <>
            <path d="M30 33 a20 20 0 0 1 40 0 q-1 -12 -10 -14 q-10 -3 -20 0 q-9 2 -10 14 z" fill={hair} />
            {(s.hair === "ponytail" || s.hair === "medium") && (
              <>
                <rect x={27.5} y={30} width={5} height={9} rx={2.5} fill={hair} />
                <rect x={67.5} y={30} width={5} height={9} rx={2.5} fill={hair} />
              </>
            )}
          </>
        );
    }
  })();

  // ── Cejas ──
  const brows = (() => {
    if (s.brows === "none") return null;
    const w = s.brows === "bold" ? 3.4 : 2.2;
    return (
      <g stroke={hairShade} strokeWidth={w} strokeLinecap="round">
        <path d="M35.5 34.5 q4 -2.5 8.5 -1.5" fill="none" />
        <path d="M64.5 34.5 q-4 -2.5 -8.5 -1.5" fill="none" />
      </g>
    );
  })();

  // ── Ojos ──
  const eyes = (() => {
    switch (s.eyes) {
      case "happy":
        return (
          <g stroke={eye} strokeWidth={2.6} strokeLinecap="round" fill="none">
            <path d="M35 40 q4.5 -4.5 9 0" />
            <path d="M56 40 q4.5 -4.5 9 0" />
          </g>
        );
      case "sleepy":
        return (
          <g stroke={eye} strokeWidth={2.6} strokeLinecap="round">
            <path d="M35 41.5 l9 -1.5" />
            <path d="M56 41.5 l9 -1.5" />
          </g>
        );
      case "cool":
        return (
          <g stroke={eye} strokeWidth={2.8} strokeLinecap="round">
            <path d="M35 40.5 l9 0" />
            <path d="M56 40.5 l9 0" />
          </g>
        );
      default:
        return (
          <g fill={eye}>
            <circle cx={39.5} cy={40} r={3} />
            <circle cx={60.5} cy={40} r={3} />
            <circle cx={40.6} cy={38.9} r={1} fill="#fff" />
            <circle cx={61.6} cy={38.9} r={1} fill="#fff" />
          </g>
        );
    }
  })();

  // ── Boca ──
  const mouth = (() => {
    switch (s.mouth) {
      case "open":
        return <ellipse cx={50} cy={50.5} rx={4.2} ry={5} fill="#8a4a4a" />;
      case "flat":
        return <path d="M45 50.5 h10" stroke={eye} strokeWidth={2.2} strokeLinecap="round" />;
      case "grin":
        return <path d="M44 48.5 q6 7 12 0 q-6 4.5 -12 0 z" fill={eye} />;
      default:
        return <path d="M44.5 48.5 q5.5 5.5 11 0" stroke={eye} strokeWidth={2.2} strokeLinecap="round" fill="none" />;
    }
  })();

  // ── Cuerpo: camisa ──
  const body = (() => {
    switch (s.top) {
      case "hoodie":
        return (
          <>
            <rect x={29} y={55} width={42} height={24} rx={7} fill={topColor} />
            <path d="M39 55 a11 11 0 0 1 22 0 l-22 0 z" fill={topColor} opacity={0.85} />
            <rect x={38} y={71} width={24} height={6} rx={3} fill="#000" opacity={0.14} />
          </>
        );
      case "jacket":
        return (
          <>
            <rect x={29} y={55} width={42} height={24} rx={5} fill={topColor} />
            <path d="M43 55 l7 7 l7 -7" fill="none" stroke="#000" strokeOpacity={0.18} strokeWidth={3} strokeLinejoin="round" />
            <path d="M29 56 l6 4 M71 56 l-6 4" stroke="#000" strokeOpacity={0.14} strokeWidth={4} strokeLinecap="round" />
          </>
        );
      case "dress":
        return (
          <>
            <path d="M34 55 h32 a6 6 0 0 1 6 6 v14 q-2 12 -10 15 h-24 q-8 -3 -10 -15 v-14 a6 6 0 0 1 6 -6 z" fill={topColor} />
            <path d="M45 55 h10 l3 10 h-16 z" fill={topColor} opacity={0.9} />
          </>
        );
      default: // tee
        return (
          <>
            <rect x={29} y={55} width={42} height={23} rx={6} fill={topColor} />
            <rect x={24.5} y={55} width={7.5} height={11} rx={3.5} fill={topColor} />
            <rect x={68} y={55} width={7.5} height={11} rx={3.5} fill={topColor} />
            <path d="M42 55 a8 8 0 0 1 16 0" fill="none" stroke="#000" strokeOpacity={0.12} strokeWidth={2.5} />
          </>
        );
    }
  })();

  // ── Pantalón / falda ──
  const bottom = (() => {
    switch (s.bottom) {
      case "shorts":
        return (
          <>
            <rect x={33} y={72} width={15} height={9} rx={3} fill={bottomColor} />
            <rect x={52} y={72} width={15} height={9} rx={3} fill={bottomColor} />
          </>
        );
      case "skirt":
        return <path d="M30 72 h40 l5 16 h-50 z" fill={bottomColor} />;
      case "none":
        return null;
      default:
        return (
          <>
            <rect x={33} y={72} width={15} height={17} rx={3.5} fill={bottomColor} />
            <rect x={52} y={72} width={15} height={17} rx={3.5} fill={bottomColor} />
          </>
        );
    }
  })();

  // ── Zapatos ──
  const shoes = (() => {
    if (s.shoes === "none") return null;
    const h = s.shoes === "boots" ? 13 : 9;
    const y = 100 - h;
    return (
      <>
        <rect x={30.5} y={y} width={18.5} height={h} rx={4.5} fill={shoesColor} />
        <rect x={51} y={y} width={18.5} height={h} rx={4.5} fill={shoesColor} />
        <rect x={30.5} y={100 - 3.5} width={18.5} height={3.5} rx={1.75} fill="#000" opacity={0.18} />
        <rect x={51} y={100 - 3.5} width={18.5} height={3.5} rx={1.75} fill="#000" opacity={0.18} />
      </>
    );
  })();

  // ── Accesorio ──
  const accessory = (() => {
    switch (s.accessory) {
      case "glasses":
        return (
          <g stroke={accColor} strokeWidth={3} fill="none" strokeLinecap="round">
            <circle cx={39.5} cy={40} r={6.2} />
            <circle cx={60.5} cy={40} r={6.2} />
            <path d="M45.5 40 h9" />
            <path d="M33.3 39 l-4 -2.5" />
            <path d="M66.7 39 l4 -2.5" />
          </g>
        );
      case "cap":
        return (
          <>
            <path d="M30 33 a20 20 0 0 1 40 0 l0 -1.5 q-1 -9 -20 -9 q-19 0 -20 9 z" fill={accColor} />
            <rect x={27} y={31} width={46} height={4.5} rx={2.25} fill={accColor} />
            <circle cx={50} cy={13.5} r={2.2} fill={accColor} />
          </>
        );
      case "headphones":
        return (
          <>
            <path d="M33 34 a17 17 0 0 1 34 0" stroke={accColor} strokeWidth={5} fill="none" strokeLinecap="round" />
            <rect x={29} y={33} width={8} height={13} rx={4} fill={accColor} />
            <rect x={63} y={33} width={8} height={13} rx={4} fill={accColor} />
          </>
        );
      case "crown":
        return (
          <>
            <path d="M37 30 v-9 l7 6.5 6 -9 6 9 7 -6.5 v9 z" fill={accColor} />
            <circle cx={37} cy={20.5} r={1.8} fill="#fff" opacity={0.85} />
            <circle cx={50} cy={17.5} r={1.8} fill="#fff" opacity={0.85} />
            <circle cx={63} cy={20.5} r={1.8} fill="#fff" opacity={0.85} />
          </>
        );
      default:
        return null;
    }
  })();

  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true" style={{ width: "100%", height: "100%", display: "block" }}>
      <rect x={0} y={0} width={100} height={100} fill={bg} />
      {backHair}
      <rect x={44} y={46} width={12} height={11} rx={4} fill={skin} />
      <circle cx={50} cy={32} r={21} fill={skin} />
      <circle cx={29} cy={33} r={4.5} fill={skin} />
      <circle cx={71} cy={33} r={4.5} fill={skin} />
      {brows}
      {eyes}
      {mouth}
      {frontHair}
      {accessory}
      {body}
      {bottom}
      {shoes}
    </svg>
  );
}

/** Forma mínima de perfil: acepta Profile, ManagedUser y objetos de grupo. */
export type AvatarLike = {
  id?: string;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  avatar_spec?: AvatarSpec | null;
};

/** Avatar universal: foto subida → personaje dibujado → inicial. */
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
  const spec = resolveAvatarSpec(p);
  const initial = (label || p?.display_name || p?.username || "?").trim().charAt(0).toUpperCase();
  const roundCls = rounded === "full" ? "rounded-full" : rounded === "xl" ? "rounded-xl" : rounded === "lg" ? "rounded-lg" : "rounded-md";
  const dims = size !== undefined ? { width: size, height: size, fontSize: Math.max(10, size * 0.42) } : {};
  return (
    <div
      className={`relative overflow-hidden shrink-0 grid place-items-center font-display font-semibold text-primary-foreground bg-gradient-to-br from-primary to-accent ${roundCls} ${className}`}
      style={{ ...dims, ...style }}
    >
      {p?.avatar_url && !spec ? (
        <img src={p.avatar_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
      ) : spec ? (
        <AvatarSvg spec={spec} />
      ) : (
        <span className="relative">{initial}</span>
      )}
    </div>
  );
}
