import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Gamepad2, Mail, Lock, User, Eye, EyeOff, ArrowRight, Loader2,
  Sparkles, Globe, Palette, Users, Share2, Trophy, Star,
  Code, Zap, Layers, Paintbrush, Lightbulb, Rocket, HeartHandshake,
  ChevronRight
} from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Asternal — Donde los juegos cobran vida" }] }),
  component: AuthPage,
});

/* ─── Animated particle ─── */
function Particle({ index }: { index: number }) {
  const size = 2 + (index % 3) * 2;
  const x = `${(index * 17 + 5) % 100}%`;
  const y = `${(index * 23 + 11) % 100}%`;
  const delay = (index % 8) * 0.7;
  const duration = 4 + (index % 4);
  return (
    <div
      className="absolute rounded-full bg-gradient-to-br from-primary/20 to-accent/15 pointer-events-none"
      style={{
        width: size, height: size,
        left: x, top: y,
        animation: `float-particle ${duration}s ease-in-out ${delay}s infinite`,
        boxShadow: `0 0 ${size * 3}px oklch(0.488 0.185 264 / ${0.08 + (index % 3) * 0.04})`,
      }}
    />
  );
}

/* ─── Floating icon ─── */
function FloatIcon({ icon: Icon, className, delay = 0 }: { icon: React.ElementType; className?: string; delay?: number }) {
  return (
    <div
      className={`absolute pointer-events-none select-none ${className}`}
      style={{ animation: `float-icon 5s ease-in-out ${delay}s infinite` }}
    >
      <Icon size={20} className="text-primary/15" />
    </div>
  );
}

/* ─── Rotating Feature Highlighter ─── */
const FEATURES = [
  { icon: Palette, title: "Editor Visual", desc: "Dibuja sprites, anima personajes y diseña escenarios con herramientas intuitivas arrastrando y soltando." },
  { icon: Code, title: "Programación Visual", desc: "Crea la lógica de tu juego conectando bloques. Sin escribir código, con infinitas posibilidades." },
  { icon: Share2, title: "Publicación Instantánea", desc: "Comparte tus juegos con la comunidad en un solo clic. Todos pueden jugar al instante." },
  { icon: Users, title: "Comunidad Creativa", desc: "Comenta, reacciona, remixa y descubre juegos de cientos de creadores como tú." },
];

function RotatingFeature() {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx(i => (i + 1) % FEATURES.length);
        setVisible(true);
      }, 400);
    }, 4500);
    return () => clearInterval(t);
  }, []);

  const feat = FEATURES[idx];
  return (
    <div className="relative w-full max-w-sm mx-auto h-[72px] overflow-hidden">
      <div
        className={`absolute inset-0 flex items-center gap-3 px-4 py-3 rounded-2xl border border-primary/15 bg-gradient-to-r from-primary/8 to-accent/8 backdrop-blur-sm transition-all duration-500 ${
          visible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-3 scale-95"
        }`}
      >
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 grid place-items-center shrink-0 shadow-inner">
          <feat.icon size={18} className="text-primary" />
        </div>
        <div className="min-w-0 text-left">
          <div className="text-xs font-display font-semibold text-foreground">{feat.title}</div>
          <div className="text-[10px] text-muted-foreground/70 leading-relaxed mt-0.5 line-clamp-2">{feat.desc}</div>
        </div>
      </div>
    </div>
  );
}

/* ─── Animated Shimmer Border ─── */
function ShimmerBorder({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative rounded-3xl overflow-hidden">
      <div className="absolute inset-0 bg-[length:200%_100%] animate-shimmer-border rounded-3xl"
        style={{
          backgroundImage: "linear-gradient(90deg, transparent 0%, oklch(0.488 0.185 264 / 0.08) 25%, oklch(0.72 0.11 260 / 0.12) 50%, oklch(0.488 0.185 264 / 0.08) 75%, transparent 100%)",
        }}
      />
      <div className="absolute -inset-[1px] rounded-3xl bg-gradient-to-r from-primary/0 via-primary/20 via-accent/20 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
      <div className="relative">
        {children}
      </div>
    </div>
  );
}

/* ─── Main component ─── */
function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [typedLine, setTypedLine] = useState("");
  const fullLine = "crear, publicar y compartir";
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) navigate({ to: "/" });
    });
    requestAnimationFrame(() => setLoaded(true));
  }, [navigate]);

  // Typewriter effect
  useEffect(() => {
    if (!loaded) return;
    let i = 0;
    const t = setInterval(() => {
      setTypedLine(fullLine.slice(0, i + 1));
      i++;
      if (i >= fullLine.length) clearInterval(t);
    }, 45);
    return () => clearInterval(t);
  }, [loaded]);

  useEffect(() => {
    setTimeout(() => emailRef.current?.focus(), 100);
  }, [mode]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setSuccessMsg(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        if (!username.trim()) { setErr("Elige un nombre de usuario"); setBusy(false); return; }
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { username: username.trim() || email.split("@")[0] } },
        });
        if (error) throw error;
        setSuccessMsg("🎉 ¡Cuenta creada! Bienvenido a Asternal");
        setTimeout(() => navigate({ to: "/" }), 800);
      } else {
        if (!email.trim() || !password) { setErr("Completa todos los campos"); setBusy(false); return; }
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/" });
      }
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen w-screen flex flex-col lg:flex-row bg-background overflow-y-auto overflow-x-hidden relative">
      {/* ─── Mesh Gradient Background ─── */}
      <div className="fixed inset-0 pointer-events-none select-none overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,oklch(0.488_0.185_264/0.08),transparent)]" />
        <div className="absolute -top-1/2 -left-1/2 w-full h-full animate-mesh-grad rounded-full"
          style={{
            background: "radial-gradient(circle at 30% 50%, oklch(0.488 0.185 264 / 0.06), transparent 60%)",
          }}
        />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full animate-mesh-grad-alt rounded-full"
          style={{
            background: "radial-gradient(circle at 70% 50%, oklch(0.72 0.11 260 / 0.06), transparent 60%)",
          }}
        />

        {/* Dot grid overlay */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1" fill="oklch(0.488 0.185 264)" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dots)" />
        </svg>
      </div>

      {/* ─── Particles ─── */}
      {Array.from({ length: 15 }).map((_, i) => <Particle key={i} index={i} />)}

      {/* ─── Floating Icons ─── */}
      <FloatIcon icon={Sparkles} className="top-[15%] left-[5%]" delay={0} />
      <FloatIcon icon={Code} className="top-[25%] right-[8%]" delay={1.5} />
      <FloatIcon icon={Layers} className="bottom-[35%] left-[6%]" delay={0.8} />
      <FloatIcon icon={Zap} className="bottom-[20%] right-[10%]" delay={2.2} />
      <FloatIcon icon={Star} className="top-[50%] left-[3%]" delay={3} />
      <FloatIcon icon={Lightbulb} className="top-[10%] right-[4%]" delay={0.4} />
      <FloatIcon icon={Rocket} className="bottom-[12%] left-[12%]" delay={1.8} />

      {/* ─── LEFT: HERO ─── */}
      <div className="relative z-10 lg:w-1/2 w-full lg:min-h-screen flex flex-col justify-center items-center px-6 py-10 lg:py-0 lg:px-12 xl:px-16">
        <div className={`flex flex-col items-center text-center max-w-xl transition-all duration-700 ${loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {/* Back link */}
          <Link to="/" className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/60 border border-primary/10 text-[10px] font-display tracking-wider text-muted-foreground hover:text-primary hover:bg-primary/5 hover:border-primary/20 transition-all mb-8 backdrop-blur-sm shadow-sm">
            <Gamepad2 size={12} className="text-primary" />
            <span>VOLVER AL MOTOR</span>
            <ChevronRight size={11} className="text-muted-foreground/50 group-hover:translate-x-0.5 transition-transform" />
          </Link>

          {/* Logo + Title */}
          <div className="flex items-center justify-center gap-3 mb-5">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-accent shadow-xl shadow-primary/30 grid place-items-center animate-[gentle-pulse_3s_ease-in-out_infinite]">
              <Gamepad2 size={28} className="text-white" />
            </div>
            <div className="text-left">
              <h1 className="text-3xl font-display font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent bg-[length:200%_100%] animate-shimmer-text">
                Asternal
              </h1>
              <p className="text-[11px] text-muted-foreground/60 font-mono tracking-[0.2em] uppercase">Motor de juegos · Comunidad</p>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-5 mb-6">
            <p className="text-lg leading-relaxed text-foreground/85 font-display font-medium">
              Una <strong className="text-primary">plataforma social interactiva</strong> donde puedes{' '}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent font-bold relative">
                {typedLine}
                <span className="inline-block w-[2px] h-[1em] bg-primary ml-0.5 align-middle animate-pulse" />
              </span>{' '}
              tus propios juegos desde cero.
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground/80">
              Diseña personajes, construye escenarios, programa con bloques y añade animaciones — 
              todo en tu navegador. Luego publícalo al instante para que la comunidad lo juegue, 
              lo comente y le dé nueva vida.
            </p>
          </div>

          {/* Rotating Feature Highlight */}
          <div className="mb-4 w-full">
            <RotatingFeature />
          </div>

          {/* Quick action hint */}
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground/40 font-mono">
            <span className="w-4 h-px bg-border/60" />
            <span className="tracking-wider">Comienza tu aventura</span>
            <span className="w-4 h-px bg-border/60" />
          </div>
        </div>
      </div>

      {/* ─── RIGHT: AUTH FORM ─── */}
      <div className="relative z-10 lg:w-1/2 w-full lg:min-h-screen flex items-center justify-center px-4 py-10 lg:py-0">
        <div className="hidden lg:block absolute left-0 top-[10%] bottom-[10%] w-px bg-gradient-to-b from-transparent via-border/50 to-transparent" />

        <div className={`w-full max-w-sm transition-all duration-700 delay-[300ms] ${loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {/* Form card */}
          <div className="bg-white/70 backdrop-blur-2xl rounded-3xl border border-white/60 shadow-2xl shadow-primary/10 p-7 relative overflow-hidden group">
            {/* Animated border shine */}
            <div className="absolute inset-0 rounded-3xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700"
              style={{
                background: "linear-gradient(135deg, transparent 30%, oklch(0.488 0.185 264 / 0.06) 50%, transparent 70%)",
                backgroundSize: "200% 200%",
                animation: "shimmer-border 4s ease-in-out infinite",
              }}
            />

            {/* Top accent */}
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-primary/50 via-accent/50 to-transparent" />

            {/* Header */}
            <div className="text-center mb-6">
              <div className={`inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/25 mb-3 transition-all duration-700 delay-500 ${loaded ? 'scale-100 rotate-0' : 'scale-0 -rotate-180'}`}>
                <Trophy size={22} className="text-white" />
              </div>
              <h2 className="text-lg font-display font-bold text-foreground">
                {mode === "signin" ? "Bienvenido de vuelta" : "Únete a la comunidad"}
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                {mode === "signin"
                  ? "Inicia sesión para seguir creando"
                  : "Crea tu cuenta y empieza a hacer juegos"}
              </p>
            </div>

            {/* Tabs */}
            <div className="flex bg-muted/70 rounded-xl p-1 mb-5">
              {(["signin", "signup"] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`flex-1 py-2 rounded-lg text-[11px] font-display font-semibold tracking-wider transition-all duration-300 ${
                    mode === m
                      ? "bg-white text-foreground shadow-sm scale-[1.02]"
                      : "text-muted-foreground/70 hover:text-foreground"
                  }`}
                >
                  {m === "signin" ? "INICIAR SESIÓN" : "CREAR CUENTA"}
                </button>
              ))}
            </div>

            {/* Form */}
            <form onSubmit={onSubmit} className="space-y-3.5">
              {mode === "signup" && (
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground tracking-wider uppercase px-1 flex items-center gap-1">
                    <User size={11} className="text-primary/60" /> Usuario
                  </label>
                  <div className="relative group/field">
                    <input
                      value={username} onChange={e => setUsername(e.target.value)}
                      placeholder="tu_usuario" maxLength={32} autoComplete="username"
                      className="w-full bg-muted/30 border border-border/60 rounded-xl px-3.5 py-2.5 text-sm outline-none transition-all duration-300 placeholder:text-muted-foreground/30 focus:border-primary/50 focus:bg-white focus:ring-2 focus:ring-primary/10 focus:shadow-lg focus:shadow-primary/5 pl-3.5"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-muted-foreground tracking-wider uppercase px-1 flex items-center gap-1">
                  <Mail size={11} className="text-primary/60" /> Email
                </label>
                <div className="relative group/field">
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/5 to-accent/5 opacity-0 group-focus-within/field:opacity-100 transition-opacity duration-500" />
                  <input
                    ref={emailRef} type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="email@ejemplo.com" required autoComplete="email"
                    className="relative w-full bg-muted/30 border border-border/60 rounded-xl pl-3.5 pr-3.5 py-2.5 text-sm outline-none transition-all duration-300 placeholder:text-muted-foreground/30 focus:border-primary/50 focus:bg-white focus:ring-2 focus:ring-primary/10 focus:shadow-lg focus:shadow-primary/5"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-muted-foreground tracking-wider uppercase px-1 flex items-center gap-1">
                  <Lock size={11} className="text-primary/60" /> Contraseña
                </label>
                <div className="relative group/field">
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/5 to-accent/5 opacity-0 group-focus-within/field:opacity-100 transition-opacity duration-500" />
                  <input
                    type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                    placeholder={mode === "signup" ? "Mínimo 6 caracteres" : "••••••••"} required minLength={6}
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    className="relative w-full bg-muted/30 border border-border/60 rounded-xl pl-3.5 pr-10 py-2.5 text-sm outline-none transition-all duration-300 placeholder:text-muted-foreground/30 focus:border-primary/50 focus:bg-white focus:ring-2 focus:ring-primary/10 focus:shadow-lg focus:shadow-primary/5"
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground transition-colors z-10" tabIndex={-1}>
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Messages */}
              {err && (
                <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-destructive/6 border border-destructive/15 text-xs text-destructive font-medium animate-[scale-in_250ms_cubic-bezier(0.16,1,0.3,1)]">
                  <div className="w-4 h-4 rounded-full bg-destructive/10 grid place-items-center shrink-0 text-[9px] font-bold">!</div>
                  {err}
                </div>
              )}
              {successMsg && (
                <div className="relative px-3.5 py-3 rounded-xl bg-gradient-to-r from-emerald-50 to-emerald-50/80 border border-emerald-200/80 text-xs text-emerald-700 font-medium animate-[scale-in_300ms_cubic-bezier(0.16,1,0.3,1)] overflow-hidden">
                  <div className="absolute inset-0 opacity-20"
                    style={{
                      background: "radial-gradient(circle at 30% 50%, oklch(0.65 0.2 150 / 0.3), transparent 70%)",
                    }}
                  />
                  <span className="relative">{successMsg}</span>
                </div>
              )}

              {/* Submit */}
              <button
                disabled={busy}
                className="relative w-full py-3 rounded-xl bg-gradient-to-r from-primary to-accent text-white font-display font-semibold text-sm tracking-wider shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 active:scale-[0.97] transition-all duration-300 disabled:opacity-50 overflow-hidden group/btn"
              >
                <div className="absolute inset-0 bg-white/10 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-500" />
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {busy ? (
                    <><Loader2 size={15} className="animate-spin" />{mode === "signin" ? "Entrando…" : "Creando cuenta…"}</>
                  ) : (
                    <><span className="tracking-wider">{mode === "signin" ? "INICIAR SESIÓN" : "CREAR CUENTA"}</span><ArrowRight size={14} className="group-hover/btn:translate-x-1 transition-transform" /></>
                  )}
                </span>
              </button>

              {/* Forgot password */}
              {mode === "signin" && (
                <div className="text-center pt-1">
                  <button type="button" onClick={async () => {
                    if (!email.trim()) { setErr("Escribe tu email primero"); return; }
                    setBusy(true); setErr(null); setSuccessMsg(null);
                    try {
                      const { error } = await supabase.auth.resetPasswordForEmail(email);
                      if (error) throw error;
                      setSuccessMsg("✉️ Recibirás instrucciones si el email existe");
                    } catch (e) { setErr((e as Error).message); }
                    finally { setBusy(false); }
                  }} className="text-[11px] text-muted-foreground/60 hover:text-primary transition-colors underline underline-offset-2 decoration-dotted">
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
              )}
            </form>
          </div>

          {/* Footer */}
          <div className="mt-4 text-center">
            <p className="text-[9px] text-muted-foreground/35 flex items-center justify-center gap-1.5 font-mono">
              <Globe size={9} className="text-primary/25" />
              Datos guardados localmente en el navegador
              <Globe size={9} className="text-primary/25" />
            </p>
          </div>
        </div>
      </div>

      {/* Mobile bottom bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary/40 via-accent/40 to-transparent z-20" />
    </div>
  );
}
