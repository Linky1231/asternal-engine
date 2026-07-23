import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Gamepad2, Mail, Lock, User, Eye, EyeOff, ArrowRight, Loader2,
  Sparkles, Globe, Palette, Users, Share2, Trophy, Star,
  Code, Zap, Play, Layers
} from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Asternal — Donde los juegos cobran vida" }] }),
  component: AuthPage,
});

/* ───────── Animated floating icon ───────── */
function FloatIcon({ icon: Icon, className, delay = 0 }: { icon: React.ElementType; className?: string; delay?: number }) {
  return (
    <div
      className={`absolute animate-[float_4s_ease-in-out_infinite] pointer-events-none select-none ${className}`}
      style={{ animationDelay: `${delay}s` }}
    >
      <Icon size={20} className="text-primary/15" />
    </div>
  );
}

/* ───────── Feature card ───────── */
function FeatureCard({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) {
  return (
    <div className="group flex items-start gap-3 p-3 rounded-2xl transition-all duration-300 hover:bg-primary/5 hover:shadow-sm hover:shadow-primary/5">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/10 grid place-items-center shrink-0 group-hover:from-primary/15 group-hover:to-accent/15 group-hover:border-primary/20 transition-all duration-300">
        <Icon size={18} className="text-primary" />
      </div>
      <div className="min-w-0">
        <h4 className="text-sm font-display font-semibold text-foreground">{title}</h4>
        <p className="text-xs text-muted-foreground/80 leading-relaxed mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

/* ───────── Main component ───────── */
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
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) navigate({ to: "/" });
    });
    // Entrance animation trigger
    requestAnimationFrame(() => setLoaded(true));
  }, [navigate]);

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
        setSuccessMsg("✅ Cuenta creada. Redirigiendo a Asternal…");
        setTimeout(() => navigate({ to: "/" }), 600);
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
    <div className="min-h-screen w-screen flex flex-col lg:flex-row bg-background overflow-y-auto overflow-x-hidden">
      {/* ───────── LEFT / TOP — HERO ───────── */}
      <div className="relative lg:w-1/2 w-full lg:min-h-screen flex flex-col justify-center px-6 py-10 lg:py-0 lg:px-12 xl:px-16 overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none select-none">
          <div className="absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-primary/10 via-accent/8 to-transparent blur-[140px]" />
          <div className="absolute -bottom-20 -right-20 w-[400px] h-[400px] rounded-full bg-gradient-to-tr from-accent/6 to-primary/10 blur-[100px]" />
        </div>

        {/* Floating icons */}
        <FloatIcon icon={Sparkles} className="top-[12%] left-[8%]" delay={0} />
        <FloatIcon icon={Code} className="top-[28%] right-[12%]" delay={1.2} />
        <FloatIcon icon={Layers} className="bottom-[30%] left-[10%]" delay={0.6} />
        <FloatIcon icon={Zap} className="bottom-[18%] right-[8%]" delay={1.8} />
        <FloatIcon icon={Star} className="top-[45%] left-[5%]" delay={2.4} />

        {/* Header — centrado */}
        <div className={`relative flex flex-col items-center text-center transition-all duration-700 ${loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <Link to="/" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/5 border border-primary/10 text-[11px] font-display tracking-wider text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all mb-8">
            <Gamepad2 size={13} className="text-primary" />
            VOLVER AL MOTOR
          </Link>

          {/* Logo + Title */}
          <div className="flex items-center justify-center gap-3 mb-5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/25 grid place-items-center">
              <Gamepad2 size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Asternal
              </h1>
              <p className="text-xs text-muted-foreground/70 font-mono tracking-wider">v2.0 · motor de juegos</p>
            </div>
          </div>

          {/* Platform description */}
          <div className="space-y-4 mb-8 max-w-lg mx-auto">
            <p className="text-base leading-relaxed text-foreground/85 font-display">
              Una <strong className="text-primary">plataforma social interactiva</strong> donde puedes{" "}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent font-semibold">
                crear, publicar y compartir
              </span>{" "}
              tus propios juegos desde cero.
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Diseña personajes, construye escenarios, programa lógica con bloques y añade animaciones — 
              todo desde tu navegador. Luego publícalo al instante para que la comunidad lo juegue, 
              lo comente, lo remixee y le dé vida.
            </p>
          </div>

          {/* Feature grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-8 max-w-lg mx-auto">
            <FeatureCard
              icon={Palette}
              title="Editor visual"
              desc="Dibuja sprites, anima personajes y diseña escenarios con herramientas intuitivas."
            />
            <FeatureCard
              icon={Code}
              title="Programación visual"
              desc="Crea lógica de juego con bloques. Sin código, pero con todo el poder."
            />
            <FeatureCard
              icon={Share2}
              title="Publica al instante"
              desc="Comparte tus creaciones con la comunidad con un solo clic."
            />
            <FeatureCard
              icon={Users}
              title="Comunidad activa"
              desc="Comenta, reacciona, remixa y descubre juegos de otros creadores."
            />
          </div>

        </div>
      </div>

      {/* ───────── RIGHT / BOTTOM — AUTH FORM ───────── */}
      <div className="relative lg:w-1/2 w-full lg:min-h-screen flex items-center justify-center px-4 py-10 lg:py-0">
        {/* Decorative separator line for desktop */}
        <div className="hidden lg:block absolute left-0 top-[10%] bottom-[10%] w-px bg-gradient-to-b from-transparent via-border/60 to-transparent" />

        {/* Mobile gradient glow */}
        <div className="lg:hidden fixed inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 right-0 h-[300px] bg-gradient-to-b from-primary/5 to-transparent blur-[80px]" />
        </div>

        <div className={`w-full max-w-sm transition-all duration-700 delay-200 ${loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {/* Form card */}
          <div className="bg-white/80 backdrop-blur-2xl rounded-3xl border border-white/60 shadow-xl shadow-primary/5 p-7 relative overflow-hidden">
            {/* Card accent */}
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-primary/0 via-primary/60 via-accent/60 to-primary/0" />

            {/* Header */}
            <div className="text-center mb-6">
              <div className={`inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/25 mb-3 transition-transform duration-500 ${loaded ? 'scale-100' : 'scale-0'}`}>
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
                      ? "bg-white text-foreground shadow-sm"
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
                  <label className="text-[10px] font-semibold text-muted-foreground tracking-wider uppercase px-1">Usuario</label>
                  <div className="relative group">
                    <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 group-focus-within:text-primary transition-colors" />
                    <input
                      value={username} onChange={e => setUsername(e.target.value)}
                      placeholder="tu_usuario" maxLength={32} autoComplete="username"
                      className="w-full bg-muted/30 border border-border/60 rounded-xl pl-9 pr-3.5 py-2.5 text-sm outline-none transition-all placeholder:text-muted-foreground/30 focus:border-primary/50 focus:bg-white focus:ring-2 focus:ring-primary/8"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-muted-foreground tracking-wider uppercase px-1">Email</label>
                <div className="relative group">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 group-focus-within:text-primary transition-colors" />
                  <input
                    ref={emailRef} type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="email@ejemplo.com" required autoComplete="email"
                    className="w-full bg-muted/30 border border-border/60 rounded-xl pl-9 pr-3.5 py-2.5 text-sm outline-none transition-all placeholder:text-muted-foreground/30 focus:border-primary/50 focus:bg-white focus:ring-2 focus:ring-primary/8"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-muted-foreground tracking-wider uppercase px-1">Contraseña</label>
                <div className="relative group">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 group-focus-within:text-primary transition-colors" />
                  <input
                    type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                    placeholder={mode === "signup" ? "Mínimo 6 caracteres" : "••••••••"} required minLength={6}
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    className="w-full bg-muted/30 border border-border/60 rounded-xl pl-9 pr-10 py-2.5 text-sm outline-none transition-all placeholder:text-muted-foreground/30 focus:border-primary/50 focus:bg-white focus:ring-2 focus:ring-primary/8"
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground transition-colors" tabIndex={-1}>
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Messages */}
              {err && (
                <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-destructive/6 border border-destructive/15 text-xs text-destructive font-medium animate-[scale-in_200ms_ease-out]">
                  <div className="w-4 h-4 rounded-full bg-destructive/10 grid place-items-center shrink-0 text-[9px] font-bold">!</div>
                  {err}
                </div>
              )}
              {successMsg && (
                <div className="px-3.5 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 font-medium animate-[scale-in_200ms_ease-out]">
                  {successMsg}
                </div>
              )}

              {/* Submit */}
              <button
                disabled={busy}
                className="relative w-full py-3 rounded-xl bg-gradient-to-r from-primary to-accent text-white font-display font-semibold text-sm tracking-wider shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 active:scale-[0.98] transition-all duration-300 disabled:opacity-50 overflow-hidden group"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {busy ? (
                    <><Loader2 size={15} className="animate-spin" />{mode === "signin" ? "Entrando…" : "Creando cuenta…"}</>
                  ) : (
                    <>{mode === "signin" ? "INICIAR SESIÓN" : "CREAR CUENTA"}<ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" /></>
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
            <p className="text-[9px] text-muted-foreground/40 flex items-center justify-center gap-1.5">
              <Globe size={10} className="text-primary/30" />
              Tus datos se guardan localmente en el navegador
              <Globe size={10} className="text-primary/30" />
            </p>
          </div>
        </div>
      </div>

      {/* ───────── MOBILE BOTTOM BAR ───────── */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-accent to-primary opacity-30" />
    </div>
  );
}
