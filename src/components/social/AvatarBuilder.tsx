import { useEffect, useMemo, useState } from "react";
import { Dices, Save, X, ImagePlus, Loader2 } from "lucide-react";
import type { Profile } from "@/lib/social/api";
import { saveAvatarSpec, clearAvatarSpec } from "@/lib/social/api";
import {
  type AvatarSpec,
  DEFAULT_AVATAR,
  randomAvatarSpec,
  resolveAvatarSpec,
  SKIN_TONES,
  HAIR_STYLES,
  HAIR_COLORS,
  EYE_STYLES,
  BROWS,
  MOUTHS,
  TOPS,
  TOP_COLORS,
  BOTTOMS,
  BOTTOM_COLORS,
  SHOES,
  SHOE_COLORS,
  ACCESSORIES,
  ACCESSORY_COLORS,
  BACKGROUNDS,
} from "@/lib/social/avatar";
import { AvatarSvg } from "./Avatar";

type SectionKey =
  | "skin" | "hair" | "brows" | "eyes" | "mouth"
  | "top" | "bottom" | "shoes" | "accessory" | "bg";

const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: "skin", label: "PIEL" },
  { key: "hair", label: "PELO" },
  { key: "brows", label: "CEJAS" },
  { key: "eyes", label: "OJOS" },
  { key: "mouth", label: "BOCA" },
  { key: "top", label: "CAMISA" },
  { key: "bottom", label: "PANTALÓN" },
  { key: "shoes", label: "ZAPATOS" },
  { key: "accessory", label: "ACCESORIO" },
  { key: "bg", label: "FONDO" },
];

export function AvatarBuilder({
  open,
  onClose,
  profile,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  profile: Profile;
  onSaved: (spec: AvatarSpec | null) => void;
}) {
  const [section, setSection] = useState<SectionKey>("skin");
  const [spec, setSpec] = useState<AvatarSpec>(DEFAULT_AVATAR);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSpec(resolveAvatarSpec(profile) ?? DEFAULT_AVATAR);
    setSavedMsg(false);
    setSaving(false);
  }, [open, profile]);

  const set = <K extends keyof AvatarSpec>(key: K, value: AvatarSpec[K]) => {
    setSpec(s => ({ ...s, [key]: value }));
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveAvatarSpec(profile.id, spec);
      onSaved(spec);
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 1500);
    } finally {
      setSaving(false);
    }
  };

  const usePhoto = async () => {
    setSaving(true);
    try {
      await clearAvatarSpec(profile.id);
      onSaved(null);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const swatchRow = (label: string, colors: Record<string, string>, active: string, onChange: (k: string) => void) => (
    <div>
      <div className="text-[10px] font-display tracking-widest text-muted-foreground mb-1.5">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(colors).map(([k, hex]) => (
          <button
            key={k}
            onClick={() => onChange(k)}
            aria-label={k}
            className={`w-8 h-8 rounded-full border-2 transition active:scale-90 ${active === k ? "border-primary ring-2 ring-primary/40 scale-105" : "border-border/60 hover:border-primary/50"}`}
            style={{ background: hex }}
          />
        ))}
      </div>
    </div>
  );

  const chipRow = (label: string, options: Record<string, string>, active: string, onChange: (k: string) => void) => (
    <div>
      <div className="text-[10px] font-display tracking-widest text-muted-foreground mb-1.5">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(options).map(([k, name]) => (
          <button
            key={k}
            onClick={() => onChange(k)}
            className={`px-2.5 py-1 rounded-full text-[10px] font-display tracking-wide border transition active:scale-95 ${
              active === k
                ? "bg-primary text-white border-transparent"
                : "border-border/60 text-muted-foreground hover:border-primary/50 hover:text-foreground"
            }`}
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  );

  const sectionUI = useMemo(() => {
    switch (section) {
      case "skin": return swatchRow("Tono de piel", SKIN_TONES, spec.skin, k => set("skin", k));
      case "hair":
        return (
          <div className="space-y-3">
            {chipRow("Estilo", HAIR_STYLES, spec.hair, k => set("hair", k))}
            {swatchRow("Color", HAIR_COLORS, spec.hairColor, k => set("hairColor", k))}
          </div>
        );
      case "brows": return chipRow("Cejas", BROWS, spec.brows, k => set("brows", k));
      case "eyes": return chipRow("Ojos", EYE_STYLES, spec.eyes, k => set("eyes", k));
      case "mouth": return chipRow("Boca", MOUTHS, spec.mouth, k => set("mouth", k));
      case "top":
        return (
          <div className="space-y-3">
            {chipRow("Prenda", TOPS, spec.top, k => set("top", k))}
            {swatchRow("Color", TOP_COLORS, spec.topColor, k => set("topColor", k))}
          </div>
        );
      case "bottom":
        return (
          <div className="space-y-3">
            {chipRow("Prenda", BOTTOMS, spec.bottom, k => set("bottom", k))}
            {swatchRow("Color", BOTTOM_COLORS, spec.bottomColor, k => set("bottomColor", k))}
          </div>
        );
      case "shoes":
        return (
          <div className="space-y-3">
            {chipRow("Calzado", SHOES, spec.shoes, k => set("shoes", k))}
            {swatchRow("Color", SHOE_COLORS, spec.shoesColor, k => set("shoesColor", k))}
          </div>
        );
      case "accessory":
        return (
          <div className="space-y-3">
            {chipRow("Accesorio", ACCESSORIES, spec.accessory, k => set("accessory", k))}
            {spec.accessory !== "none" && swatchRow("Color", ACCESSORY_COLORS, spec.accessoryColor, k => set("accessoryColor", k))}
          </div>
        );
      case "bg": return swatchRow("Fondo", BACKGROUNDS, spec.bg, k => set("bg", k));
      default: return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, spec]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[140] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button aria-label="Cerrar" onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px] animate-in fade-in duration-200" />
      <div className="relative w-full sm:max-w-md panel rounded-t-2xl sm:rounded-2xl border border-border shadow-2xl animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-2 duration-300 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40">
          <div className="flex-1 font-display text-xs tracking-widest text-primary-glow">PERSONALIZA TU AVATAR</div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg border border-border grid place-items-center active:scale-95 transition">
            <X size={14} />
          </button>
        </div>

        {/* Preview */}
        <div className="flex items-center gap-4 px-4 py-4 border-b border-border/40 bg-gradient-to-br from-primary/8 to-accent/8">
          <div className="w-24 h-24 rounded-full overflow-hidden ring-4 ring-primary/25 shadow-xl shrink-0">
            <AvatarSvg spec={spec} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-display font-semibold truncate">{profile.display_name || profile.username || "Jugador"}</div>
            <div className="text-[10px] font-mono text-muted-foreground mt-0.5 truncate">@{profile.username}</div>
            <button onClick={() => setSpec(randomAvatarSpec())}
              className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border/70 text-[10px] font-display tracking-widest hover:border-primary/50 active:scale-95 transition">
              <Dices size={12} className="text-primary-glow" /> ALEATORIO
            </button>
          </div>
        </div>

        {/* Sections */}
        <div className="px-3 pt-2.5 overflow-x-auto no-scrollbar shrink-0">
          <div className="flex gap-1 pb-1 min-w-max">
            {SECTIONS.map(sec => (
              <button key={sec.key} onClick={() => setSection(sec.key)}
                className={`px-2.5 py-1.5 rounded-lg text-[9px] font-display tracking-widest transition active:scale-95 ${
                  section === sec.key
                    ? "bg-primary text-white"
                    : "text-muted-foreground hover:bg-muted/40"
                }`}>
                {sec.label}
              </button>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {sectionUI}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-4 py-3 border-t border-border/40">
          <button onClick={() => void usePhoto()} disabled={saving}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border/70 text-[10px] font-display tracking-widest text-muted-foreground hover:text-foreground active:scale-95 disabled:opacity-50 transition shrink-0">
            <ImagePlus size={12} /> USAR FOTO
          </button>
          <div className="flex-1" />
          {savedMsg ? (
            <span className="text-[10px] font-display tracking-widest text-emerald-500">¡GUARDADO!</span>
          ) : null}
          <button onClick={() => void save()} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-[11px] font-semibold active:scale-95 disabled:opacity-60 transition shrink-0">
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} GUARDAR
          </button>
        </div>
      </div>
    </div>
  );
}
