import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft, Star, Palette, Rocket, Link2, Check, Loader2,
  Youtube, Instagram, Music2, Globe, Gift, Sparkles as SparklesIcon,
  Wand2, IdCard,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import {
  getMyProfile, claimPlusOrbes, updatePlusSettings,
  isPlusActive,
  type Profile, type SocialLinks, type CreatorCardStyle,
} from "@/lib/social/api";
import { UserName } from "@/components/social/UserName";

export const Route = createFileRoute("/plus")({
  head: () => ({
    meta: [
      { title: "Centro Plus · Asternal" },
      { name: "description", content: "Tu Centro Plus: efectos de nombre, fondos premium, tarjeta de creador y más." },
    ],
  }),
  component: PlusPage,
});

const FRAMES = [
  { id: "aurora", label: "Aurora", css: "linear-gradient(135deg, #1AA6D6, #2FD9D2, #7BE7FF)" },
  { id: "ocean",  label: "Océano", css: "linear-gradient(135deg, #0F6C9E, #1AA6D6, #2FD9D2)" },
  { id: "ice",    label: "Hielo",  css: "linear-gradient(135deg, #B8ECFF, #7BE7FF, #2FD9D2)" },
  { id: "neon",   label: "Neón",   css: "linear-gradient(135deg, #2FD9D2, #B8ECFF, #1AA6D6)" },
];

const NAME_EFFECTS: { id: string; label: string }[] = [
  { id: "glow",     label: "Brillo" },
  { id: "rainbow",  label: "Arcoíris" },
  { id: "gradient", label: "Degradado" },
  { id: "pulse",    label: "Pulso" },
  { id: "shadow",   label: "Sombra" },
  { id: "neon",     label: "Neón" },
];

// Fondos de perfil eliminados por petición del usuario.


const POST_EFFECTS: { id: string; label: string }[] = [
  { id: "sparkle",  label: "Destellos" },
  { id: "wave",     label: "Ondas" },
  { id: "confetti", label: "Confeti" },
  { id: "glow",     label: "Resplandor" },
  { id: "fade-up",  label: "Elegante" },
];

const CARD_THEMES: { id: NonNullable<CreatorCardStyle["theme"]>; label: string; bg: string; fg: string }[] = [
  { id: "dark",   label: "Dark",   bg: "linear-gradient(135deg, #1a1a2e, #16213e)", fg: "#ffffff" },
  { id: "light",  label: "Light",  bg: "linear-gradient(135deg, #f8f9fa, #e9ecef)", fg: "#212529" },
  { id: "neon",   label: "Neon",   bg: "linear-gradient(135deg, #12121e, #1a0033)", fg: "#2FD9D2" },
  { id: "aurora", label: "Aurora", bg: "linear-gradient(135deg, #667eea, #764ba2, #f093fb)", fg: "#ffffff" },
  { id: "sunset", label: "Sunset", bg: "linear-gradient(135deg, #ff9a9e, #fad0c4)", fg: "#3a1a1a" },
];

function PlusPage() {
  const navigate = useNavigate();
  const [me, setMe] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [claimMsg, setClaimMsg] = useState<string | null>(null);
  const [socials, setSocials] = useState<SocialLinks>({});
  const [savedSocials, setSavedSocials] = useState<null | "saving" | "saved">(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate({ to: "/auth" }); return; }
      const p = await getMyProfile();
      setMe(p);
      setSocials((p?.social_links as SocialLinks) ?? {});
      setLoading(false);
    })();
  }, [navigate]);

  const isPlus = isPlusActive(me);

  const refresh = async () => setMe(await getMyProfile());

  const claim = async () => {
    setClaiming(true); setClaimMsg(null);
    try {
      const r = await claimPlusOrbes();
      if (r.ok) { setClaimMsg(`+${r.amount} orbes reclamados 🎉`); await refresh(); }
      else if (r.reason === "already_claimed") {
        const next = r.next_at ? new Date(r.next_at).toLocaleDateString() : "";
        setClaimMsg(`Ya reclamaste este mes. Próximo: ${next}`);
      }
    } catch (e) { setClaimMsg((e as Error).message); }
    finally { setClaiming(false); }
  };

  const toggleBadge = async () => {
    if (!me) return;
    const next = !(me.show_plus_badge ?? true);
    await updatePlusSettings({ show_plus_badge: next });
    setMe({ ...me, show_plus_badge: next });
  };

  const setFrame = async (id: string | null) => {
    if (!me) return;
    await updatePlusSettings({ avatar_frame: id });
    setMe({ ...me, avatar_frame: id });
  };
  const setNameFx = async (id: string | null) => {
    if (!me) return;
    await updatePlusSettings({ name_effect: id });
    setMe({ ...me, name_effect: id });
  };

  const setPostFx = async (id: string | null) => {
    if (!me) return;
    await updatePlusSettings({ post_effect: id });
    setMe({ ...me, post_effect: id });
  };
  const setCardTheme = async (theme: NonNullable<CreatorCardStyle["theme"]>) => {
    if (!me) return;
    const next: CreatorCardStyle = { ...(me.creator_card_style ?? {}), theme };
    await updatePlusSettings({ creator_card_style: next });
    setMe({ ...me, creator_card_style: next });
  };

  const saveSocials = async () => {
    setSavedSocials("saving");
    await updatePlusSettings({ social_links: socials });
    setSavedSocials("saved");
    setTimeout(() => setSavedSocials(null), 1500);
  };

  const canClaim = isPlus && (!me?.last_plus_claim_at || (Date.now() - new Date(me.last_plus_claim_at).getTime()) > 30 * 24 * 3600 * 1000);

  if (loading) return <div className="min-h-screen grid place-items-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen w-full flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-20 panel border-b backdrop-blur-xl">
        <div className="max-w-2xl md:max-w-3xl lg:max-w-5xl xl:max-w-6xl mx-auto flex items-center gap-2 px-3 py-2.5">
          <button onClick={() => navigate({ to: "/" })}
            className="w-9 h-9 rounded-xl border border-border grid place-items-center active:scale-95 transition">
            <ArrowLeft size={16} />
          </button>
          <div className="flex-1 font-display text-sm flex items-center gap-2" style={{ color: "var(--plus)" }}>
            <Star size={14} fill="currentColor" /> CENTRO PLUS
          </div>
          {isPlus && (
            <span className="text-[10px] font-display tracking-widest px-2 py-1 rounded-full text-white"
              style={{ background: "var(--gradient-plus)" }}>ACTIVO</span>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-2xl md:max-w-3xl lg:max-w-5xl xl:max-w-6xl mx-auto w-full px-3 py-5 pb-24 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-3xl p-6 shadow-lg border"
          style={{
            borderColor: "color-mix(in oklab, var(--plus) 40%, transparent)",
            background: "linear-gradient(135deg, color-mix(in oklab, var(--plus) 22%, transparent), color-mix(in oklab, var(--plus-glow) 12%, transparent))",
          }}>
          <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full blur-3xl opacity-40" style={{ background: "var(--plus-glow)" }} />
          <div className="relative">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-display tracking-[0.2em] uppercase text-white"
              style={{ background: "var(--gradient-plus)" }}>
              <Star size={10} fill="currentColor" /> Plus
            </div>
            <h1 className="mt-3 text-3xl font-display font-bold">Asternal Plus</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isPlus
                ? "Todos tus beneficios están activos. Gestiónalos desde aquí."
                : <>Todos los beneficios premium <span className="text-foreground font-semibold">gratis para todos</span>.</>}
            </p>
          </div>
        </section>

        {/* Reclamar orbes */}
        <FeatureCard icon={<Gift size={18} />} title="10.000 Orbes mensuales"
          desc={isPlus ? (canClaim ? "Disponibles para reclamar." : "Ya reclamaste este mes.") : "Reclama orbes cada mes."}
          locked={!isPlus}>
          <button disabled={!isPlus || !canClaim || claiming} onClick={claim}
            className="w-full h-10 rounded-xl text-sm font-display tracking-widest text-white active:scale-[0.98] transition disabled:opacity-40"
            style={{ background: "var(--gradient-plus)" }}>
            {claiming ? <Loader2 size={14} className="inline animate-spin" /> : canClaim ? "RECLAMAR AHORA" : "RECLAMADO"}
          </button>
          {claimMsg && <div className="text-[11px] text-muted-foreground mt-2 text-center">{claimMsg}</div>}
        </FeatureCard>

        {/* Insignia Plus */}
        <FeatureCard icon={<Star size={18} fill="currentColor" />} title="Insignia Plus"
          desc="Muestra tu insignia junto a tu nombre." locked={!isPlus}>
          <button disabled={!isPlus} onClick={toggleBadge}
            className="w-full h-10 rounded-xl text-sm font-display tracking-widest border transition active:scale-[0.98] disabled:opacity-40"
            style={{
              borderColor: "var(--plus)",
              color: me?.show_plus_badge ? "white" : "var(--plus)",
              background: me?.show_plus_badge ? "var(--gradient-plus)" : "transparent",
            }}>
            {me?.show_plus_badge ? "✓ VISIBLE" : "OCULTA"}
          </button>
        </FeatureCard>

        {/* Name effects — NEW */}
        <FeatureCard icon={<Wand2 size={18} />} title="Efectos de nombre"
          desc="Haz que tu nombre destaque en publicaciones y perfil." locked={!isPlus}>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            <button onClick={() => setNameFx(null)} disabled={!isPlus}
              className={`h-12 rounded-xl border-2 text-xs font-display transition ${!me?.name_effect ? "border-foreground" : "border-border"} disabled:opacity-40`}>
              Ninguno
            </button>
            {NAME_EFFECTS.map(fx => (
              <button key={fx.id} onClick={() => setNameFx(fx.id)} disabled={!isPlus}
                className={`h-12 rounded-xl border-2 grid place-items-center transition ${me?.name_effect === fx.id ? "border-foreground" : "border-border"} disabled:opacity-40`}>
                <span className={`name-fx name-fx-${fx.id} text-sm font-display`}>{fx.label}</span>
              </button>
            ))}
          </div>
        </FeatureCard>

        {/* Fondos de perfil eliminados por petición del usuario */}


        {/* Post entrance effects — NEW */}
        <FeatureCard icon={<SparklesIcon size={18} />} title="Efectos al publicar"
          desc="Tus próximas publicaciones aparecerán con animación." locked={!isPlus}>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            <button onClick={() => setPostFx(null)} disabled={!isPlus}
              className={`h-11 rounded-xl border-2 text-xs font-display transition ${!me?.post_effect ? "border-foreground" : "border-border"} disabled:opacity-40`}>
              Ninguno
            </button>
            {POST_EFFECTS.map(fx => (
              <button key={fx.id} onClick={() => setPostFx(fx.id)} disabled={!isPlus}
                className={`h-11 rounded-xl border-2 text-xs font-display transition ${me?.post_effect === fx.id ? "border-foreground" : "border-border"} disabled:opacity-40`}>
                {fx.label}
              </button>
            ))}
          </div>
        </FeatureCard>

        {/* Creator card — NEW */}
        <FeatureCard icon={<IdCard size={18} />} title="Tarjeta de creador"
          desc="Tu identidad como desarrollador en un vistazo." locked={!isPlus}>
          <CreatorCardPreview profile={me} />
          <div className="grid grid-cols-5 md:grid-cols-10 gap-2 mt-3">
            {CARD_THEMES.map(t => {
              const active = (me?.creator_card_style?.theme ?? "dark") === t.id;
              return (
                <button key={t.id} onClick={() => setCardTheme(t.id)} disabled={!isPlus}
                  className={`aspect-square rounded-lg border-2 relative overflow-hidden transition ${active ? "border-foreground" : "border-transparent"} disabled:opacity-40`}
                  style={{ background: t.bg }}>
                  <span className="absolute inset-0 grid place-items-center text-[9px] font-display" style={{ color: t.fg }}>
                    {t.label}
                  </span>
                </button>
              );
            })}
          </div>
        </FeatureCard>

        {/* Frames */}
        <FeatureCard icon={<Palette size={18} />} title="Marcos premium"
          desc="Marco animado para tu foto de perfil." locked={!isPlus}>
          <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
            <button onClick={() => setFrame(null)} disabled={!isPlus}
              className={`aspect-square rounded-xl border-2 grid place-items-center text-[10px] font-mono transition ${!me?.avatar_frame ? "border-foreground" : "border-border"}`}>
              Ninguno
            </button>
            {FRAMES.map(f => (
              <button key={f.id} onClick={() => setFrame(f.id)} disabled={!isPlus}
                className={`aspect-square rounded-xl p-1 border-2 transition ${me?.avatar_frame === f.id ? "border-foreground" : "border-transparent"} disabled:opacity-40`}
                style={{ background: f.css }} title={f.label}>
                <div className="w-full h-full rounded-lg bg-background/70 grid place-items-center text-[10px]">
                  {me?.avatar_frame === f.id && <Check size={14} />}
                </div>
              </button>
            ))}
          </div>
        </FeatureCard>

        {/* Redes sociales */}
        <FeatureCard icon={<Link2 size={18} />} title="Redes sociales"
          desc="Se muestran como iconos en tu perfil." locked={!isPlus}>
          <div className="space-y-2">
            <SocialInput icon={<Youtube size={14} />} placeholder="URL de YouTube"
              value={socials.youtube ?? ""} onChange={v => setSocials({ ...socials, youtube: v })} disabled={!isPlus} />
            <SocialInput icon={<Music2 size={14} />} placeholder="URL de TikTok"
              value={socials.tiktok ?? ""} onChange={v => setSocials({ ...socials, tiktok: v })} disabled={!isPlus} />
            <SocialInput icon={<Instagram size={14} />} placeholder="URL de Instagram"
              value={socials.instagram ?? ""} onChange={v => setSocials({ ...socials, instagram: v })} disabled={!isPlus} />
            <SocialInput icon={<Globe size={14} />} placeholder="Sitio web"
              value={socials.website ?? ""} onChange={v => setSocials({ ...socials, website: v })} disabled={!isPlus} />
            <button disabled={!isPlus || savedSocials === "saving"} onClick={saveSocials}
              className="w-full h-9 rounded-xl text-xs font-display tracking-widest text-white active:scale-[0.98] transition disabled:opacity-40"
              style={{ background: "var(--gradient-plus)" }}>
              {savedSocials === "saving" ? "GUARDANDO…" : savedSocials === "saved" ? "✓ GUARDADO" : "GUARDAR"}
            </button>
          </div>
        </FeatureCard>

        <FeatureCard icon={<Rocket size={18} />} title="Acceso anticipado"
          desc="Prueba antes que nadie funciones beta." locked={!isPlus}>
          <div className="flex flex-wrap gap-2 text-[11px]">
            <span className="px-2 py-1 rounded-full border" style={{ borderColor: "var(--plus)", color: "var(--plus)" }}>Editor de animaciones</span>
            <span className="px-2 py-1 rounded-full border" style={{ borderColor: "var(--plus)", color: "var(--plus)" }}>Encuestas</span>
            <span className="px-2 py-1 rounded-full border" style={{ borderColor: "var(--plus)", color: "var(--plus)" }}>Contenido desbloqueable</span>
          </div>
        </FeatureCard>

        {/* Plus gratuito para todos */}
        <section className="relative overflow-hidden rounded-2xl border-2 p-5 space-y-3"
          style={{
            borderColor: "color-mix(in oklab, var(--plus) 40%, transparent)",
            background: "linear-gradient(135deg, color-mix(in oklab, var(--plus) 12%, transparent), transparent)",
          }}>
          <div className="flex items-center gap-2.5">
            <Gift size={18} style={{ color: "var(--plus)" }} />
            <div>
              <div className="font-display text-sm font-semibold">Plus gratis para todos</div>
              <div className="text-[10px] text-muted-foreground/60">La suscripción ya no es necesaria: todos los beneficios están desbloqueados.</div>
            </div>
          </div>
        </section>

        <div className="text-center pt-2">
          <Link to="/" className="text-[11px] text-muted-foreground underline">Volver al inicio</Link>
        </div>
      </main>
    </div>
  );
}

function CreatorCardPreview({ profile }: { profile: Profile | null }) {
  const theme = profile?.creator_card_style?.theme ?? "dark";
  const themeCfg = CARD_THEMES.find(t => t.id === theme) ?? CARD_THEMES[0];
  return (
    <div className="relative rounded-2xl overflow-hidden p-4 flex items-center gap-3"
      style={{ background: themeCfg.bg, color: themeCfg.fg, minHeight: 110 }}>
      <div className="w-16 h-16 rounded-2xl bg-white/20 grid place-items-center shrink-0 overflow-hidden">
        {profile?.avatar_url
          ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
          : <span className="font-display text-2xl">{(profile?.display_name ?? profile?.username ?? "?")[0]?.toUpperCase()}</span>}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-base font-display font-semibold truncate">
          <UserName p={profile} size="md" showBadge={false} />
        </div>
        <div className="text-[11px] opacity-80 font-mono truncate">@{profile?.username ?? "?"}</div>
        <div className="text-[10px] opacity-70 mt-1 truncate">{profile?.bio ?? "Creador en Asternal"}</div>
      </div>
      <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-display"
        style={{ background: "rgba(255,255,255,0.15)" }}>
        <Star size={9} fill="currentColor" /> PLUS
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, desc, locked, children }: {
  icon: React.ReactNode; title: string; desc: string; locked: boolean; children: React.ReactNode;
}) {
  return (
    <section className="panel rounded-2xl border border-border/50 p-4 space-y-3 relative">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl grid place-items-center shrink-0 text-white"
          style={{ background: "var(--gradient-plus)" }}>{icon}</div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold flex items-center gap-2">
            {title}
            {locked && <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">PLUS</span>}
          </div>
          <div className="text-[11px] text-muted-foreground">{desc}</div>
        </div>
      </div>
      <div className={locked ? "opacity-60 pointer-events-none select-none" : ""}>{children}</div>
    </section>
  );
}

function SocialInput({ icon, placeholder, value, onChange, disabled }: {
  icon: React.ReactNode; placeholder: string; value: string; onChange: (v: string) => void; disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 bg-input/40 rounded-xl px-3 py-2">
      <span className="text-muted-foreground">{icon}</span>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} disabled={disabled}
        className="flex-1 bg-transparent text-xs outline-none disabled:opacity-50" />
    </div>
  );
}
