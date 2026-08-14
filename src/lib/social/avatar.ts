// ─────────────────────────────────────────────────────────────────────────────
// Sistema de avatar personalizable + ID público de usuario (código AST-XXXXXX)
// ─────────────────────────────────────────────────────────────────────────────
// El avatar se guarda como un «spec» (piezas + colores) que cualquier parte de
// la app puede dibujar como SVG. El código de usuario es DETERMINISTA: se deriva
// del UUID de la cuenta, así TODOS los usuarios (nuevos y antiguos) tienen su
// propio ID desde el primer momento sin necesidad de migración de base de datos.

export const AVATAR_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin 0/O/1/I

/** ID público de usuario: AST-XXXXXX, estable y único por cuenta. */
export function getUserCode(userId: string): string {
  // Hash FNV-1a del UUID → 30 bits → 6 caracteres del alfabeto seguro.
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < userId.length; i++) {
    const c = userId.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x85ebca6b) >>> 0;
  }
  const bits = (h1 ^ (h2 << 1)) >>> 0;
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += AVATAR_ALPHABET[(bits >> (i * 5)) % 32];
  }
  return `AST-${code}`;
}

// ─────────────────────────── Tipos ───────────────────────────

export type AvatarSpec = {
  skin: string;        // clave de tono de piel
  hair: string;        // estilo de pelo
  hairColor: string;   // clave de color de pelo
  brows: string;       // cejas: none | natural | bold
  eyes: string;        // ojos: round | happy | sleepy | cool
  mouth: string;       // boca: smile | open | flat | grin
  top: string;         // camisa: tee | hoodie | jacket | dress
  topColor: string;    // clave de color de camisa
  bottom: string;      // pantalón: pants | shorts | skirt | none
  bottomColor: string; // clave de color de pantalón
  shoes: string;       // zapatos: sneakers | boots | none
  shoesColor: string;  // clave de color de zapatos
  accessory: string;   // accesorio: none | glasses | cap | headphones | crown
  accessoryColor: string;
  bg: string;          // clave de color de fondo
};

export const DEFAULT_AVATAR: AvatarSpec = {
  skin: "warm",
  hair: "short",
  hairColor: "brown",
  brows: "natural",
  eyes: "round",
  mouth: "smile",
  top: "tee",
  topColor: "blue",
  bottom: "pants",
  bottomColor: "navy",
  shoes: "sneakers",
  shoesColor: "white",
  accessory: "none",
  accessoryColor: "black",
  bg: "sky",
};

// ─────────────────────────── Paletas ───────────────────────────

export const SKIN_TONES: Record<string, string> = {
  porcelain: "#FFE0CF",
  warm: "#F6C9A0",
  tan: "#E8B084",
  bronze: "#C68642",
  brown: "#8D5524",
  dark: "#5C3317",
};

export const HAIR_STYLES: Record<string, string> = {
  short: "Corto",
  medium: "Medio",
  long: "Largo",
  spiky: "Espigado",
  curly: "Rizado",
  bald: "Rapado",
  ponytail: "Coleta",
  bun: "Moño",
};

export const HAIR_COLORS: Record<string, string> = {
  black: "#2B2B33",
  brown: "#6B4423",
  blonde: "#E8C86A",
  red: "#C4452C",
  pink: "#E86AA6",
  blue: "#4A7BD6",
  purple: "#8A5AD6",
  silver: "#B8BCC4",
};

export const EYE_STYLES: Record<string, string> = {
  round: "Redondos",
  happy: "Felices",
  sleepy: "Sombríos",
  cool: "Frescos",
};

export const BROWS: Record<string, string> = {
  none: "Ninguna",
  natural: "Natural",
  bold: "Gruesas",
};

export const MOUTHS: Record<string, string> = {
  smile: "Sonrisa",
  open: "Abierta",
  flat: "Neutra",
  grin: "Fresca",
};

export const TOPS: Record<string, string> = {
  tee: "Camiseta",
  hoodie: "Sudadera",
  jacket: "Chaqueta",
  dress: "Vestido",
};

export const BOTTOMS: Record<string, string> = {
  none: "Ninguno",
  pants: "Pantalón",
  shorts: "Cortos",
  skirt: "Falda",
};

export const SHOES: Record<string, string> = {
  none: "Ninguno",
  sneakers: "Deportivos",
  boots: "Botas",
};

export const ACCESSORIES: Record<string, string> = {
  none: "Ninguno",
  glasses: "Gafas",
  cap: "Gorra",
  headphones: "Auriculares",
  crown: "Corona",
};

const SHARED_COLORS: Record<string, string> = {
  black: "#2B2B33",
  white: "#F4F5F7",
  gray: "#8A8F98",
  red: "#D64545",
  orange: "#E8873A",
  yellow: "#E8C74A",
  green: "#3FA45C",
  teal: "#2BA8A0",
  blue: "#3D7BD9",
  navy: "#2A3A5C",
  purple: "#8A5AD6",
  pink: "#E86AA6",
  brown: "#8B5A3C",
  beige: "#D8C3A5",
};

export const TOP_COLORS = SHARED_COLORS;
export const BOTTOM_COLORS = SHARED_COLORS;
export const SHOE_COLORS = SHARED_COLORS;
export const ACCESSORY_COLORS = SHARED_COLORS;

export const BACKGROUNDS: Record<string, string> = {
  sky: "#7FB8E8",
  mint: "#6FC9B0",
  sunset: "#E89A7A",
  lavender: "#A48AD6",
  rose: "#E88AA8",
  night: "#3A3F5C",
  gold: "#E8C66A",
  forest: "#4A8A5C",
};

export function randomAvatarSpec(): AvatarSpec {
  const pick = <T extends Record<string, unknown>>(o: T): string => {
    const keys = Object.keys(o);
    return keys[Math.floor(Math.random() * keys.length)];
  };
  return {
    skin: pick(SKIN_TONES),
    hair: pick(HAIR_STYLES),
    hairColor: pick(HAIR_COLORS),
    brows: pick(BROWS),
    eyes: pick(EYE_STYLES),
    mouth: pick(MOUTHS),
    top: pick(TOPS),
    topColor: pick(TOP_COLORS),
    bottom: pick(BOTTOMS),
    bottomColor: pick(BOTTOM_COLORS),
    shoes: pick(SHOES),
    shoesColor: pick(SHOE_COLORS),
    accessory: pick(ACCESSORIES),
    accessoryColor: pick(ACCESSORY_COLORS),
    bg: pick(BACKGROUNDS),
  };
}

// ─────────────────────────── Persistencia ───────────────────────────
// El spec se guarda en la nube (columna avatar_spec de profiles) cuando la
// columna existe; si aún no (esquema sin aplicar), cae a localStorage para que
// el avatar funcione igualmente en este dispositivo.

const AVATAR_LS_KEY = (userId: string) => `_ast_avatar_spec_${userId}`;

export function loadAvatarSpecLocal(userId: string): AvatarSpec | null {
  try {
    const raw = localStorage.getItem(AVATAR_LS_KEY(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AvatarSpec;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function saveAvatarSpecLocal(userId: string, spec: AvatarSpec): void {
  try {
    localStorage.setItem(AVATAR_LS_KEY(userId), JSON.stringify(spec));
  } catch {
    /* quota / private mode */
  }
}

export function clearAvatarSpecLocal(userId: string): void {
  try {
    localStorage.removeItem(AVATAR_LS_KEY(userId));
  } catch {
    /* noop */
  }
}

/** Spec efectivo de un perfil: nube primero, localStorage como respaldo. */
export function resolveAvatarSpec(profile: {
  id?: string;
  avatar_spec?: AvatarSpec | null;
} | null | undefined): AvatarSpec | null {
  if (!profile?.id) return null;
  if (profile.avatar_spec && typeof profile.avatar_spec === "object") return profile.avatar_spec;
  return loadAvatarSpecLocal(profile.id);
}
