import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Gamepad2, Mail, Lock, User, Eye, EyeOff, ArrowRight, Loader2,
  Globe, ChevronRight, ArrowUpRight,
} from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Asternal — Acceso a la plataforma" }] }),
  component: AuthPage,
});

/* ─── Confetti on success ─── */
function ConfettiBurst({ active }: { active: boolean }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!active) { setShow(false); return; }
    setShow(true);
    const t = setTimeout(() => setShow(false), 2500);
    return () => clearTimeout(t);
  }, [active]);

  if (!show) return null;
  return (
    <div className="fixed inset-0 pointer-events-none z-[9998] overflow-hidden">
      {Array.from({ length: 32 }).map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${45 + (i % 5) * 3}%`,
            top: `${30 + (i % 7) * 4}%`,
            width: 3 + (i % 4),
            height: 3 + (i % 4),
            background: [
              "oklch(0.488 0.185 264)",
              "oklch(0.72 0.11 260)",
              "oklch(0.65 0.2 150)",
              "oklch(0.85 0.2 85)",
            ][i % 4],
            animation: `confetti-fall ${1 + (i % 4) * 0.3}s ease-out ${(i % 8) * 0.05}s both`,
            opacity: 0,
          }}
        />
      ))}
    </div>
  );
}

/* ─── 3D Tilt Card (subtle) ─── */
function TiltCard({ children }: { children: React.ReactNode }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [rot, setRot] = useState({ x: 0, y: 0 });
  const [hover, setHover] = useState(false);

  const onMove = useCallback((e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setRot({ x: (y - 0.5) * -6, y: (x - 0.5) * 6 });
  }, []);

  return (
    <div
      ref={cardRef}
      onMouseMove={onMove}
      onMouseLeave={() => { setRot({ x: 0, y: 0 }); setHover(false); }}
      onMouseEnter={() => setHover(true)}
      style={{ perspective: "1000px" }}
    >
      <div
        className="relative"
        style={{
          transform: `rotateX(${rot.x}deg) rotateY(${rot.y}deg)`,
          transition: hover
            ? "transform 0.08s cubic-bezier(0.22, 1, 0.36, 1)"
            : "transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)",
          transformStyle: "preserve-3d",
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none rounded-2xl opacity-0 transition-opacity duration-700"
          style={{
            opacity: hover ? 0.5 : 0,
            background: `radial-gradient(
              circle at ${50 + rot.y * 3}% ${50 - rot.x * 3}%,
              oklch(1 1 300 / 0.08),
              transparent 60%
            )`,
          }}
        />
        {children}
      </div>
    </div>
  );
}

/* ─── Elegant Stats Ticker ─── */
const STATS = [
  { label: "Creadores", value: "3.2K" },
  { label: "Juegos", value: "8.1K" },
  { label: "Sin código", value: "100%" },
];

/* ─── Main ─── */
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
  const fullLine = "crea, publica y comparte";
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) navigate({ to: "/" });
    });
    requestAnimationFrame(() => setLoaded(true));
  }, [navigate]);

  // Typewriter
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
    setTimeout(() => emailRef.current?.focus(), 200);
  }, [mode]);

  const switchMode = (m: "signin" | "signup") => { setMode(m); setErr(null); };

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
        setSuccessMsg("Cuenta creada correctamente");
        setTimeout(() => navigate({ to: "/" }), 1000);
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
    <div className="min-h-screen w-screen flex flex-col lg:flex-row bg-background overflow-hidden relative">

      {/* ─── Confetti ─── */}
      <ConfettiBurst active={!!successMsg} />

      {/* ─── Background ─── */}
      <div className="fixed inset-0 pointer-events-none select-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,oklch(0.488_0.185_264/0.06),transparent)]" />

        {/* Very subtle mesh */}
        <div className="absolute -top-[30%] -left-[20%] w-[70%] h-[70%] opacity-30"
          style={{
            background: "radial-gradient(circle at 30% 50%, oklch(0.488 0.185 264 / 0.05), transparent 60%)",
            animation: "drift-slow 20s ease-in-out infinite",
          }}
        />
        <div className="absolute -bottom-[30%] -right-[20%] w-[70%] h-[70%] opacity-30"
          style={{
            background: "radial-gradient(circle at 70% 50%, oklch(0.72 0.11 260 / 0.04), transparent 60%)",
            animation: "drift-slow 25s ease-in-out infinite reverse",
          }}
        />

        {/* Dot grid */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.018]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="dot-grid" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="0.6" fill="oklch(0.488 0.185 264)" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dot-grid)" />
        </svg>
      </div>

      {/* ═══════ LEFT — Brand ═══════ */}
      <div className="relative z-10 lg:w-[52%] w-full lg:min-h-screen flex flex-col justify-center px-6 lg:px-16 xl:px-24 pt-10 pb-20 lg:pb-0">
        <div
          className={`max-w-xl transition-all duration-1000 ${loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
          style={{ transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }}
        >
          {/* Brand */}
          <div className="mb-12 lg:mb-16">
            <Link to="/" className="inline-flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl bg-primary grid place-items-center shadow-lg shadow-primary/20 group-hover:shadow-primary/30 transition-shadow">
                <Gamepad2 size={20} className="text-white" />
              </div>
              <span className="text-lg font-display font-semibold tracking-tight text-foreground">
                Asternal
              </span>
            </Link>
          </div>

          {/* Hero */}
          <h1 className="text-[clamp(2rem,4vw,3.25rem)] font-display font-bold tracking-tight leading-[1.08] text-foreground mb-5">
            El{' '}
            <span className="text-primary relative">
              motor de juegos
              <span className="absolute -bottom-1 left-0 right-0 h-[3px] bg-primary/20 rounded-full" />
            </span>
            {' '}que cabe en tu navegador.
          </h1>

          <p className="text-base lg:text-lg leading-relaxed text-muted-foreground/80 max-w-lg mb-6">
            Una plataforma social donde{' '}
            <span className="text-foreground font-medium">
              {typedLine}
              <span className="inline-block w-[2px] h-[1.05em] bg-primary/70 ml-0.5 align-middle animate-pulse rounded-sm" />
            </span>{' '}
            tus juegos desde cero. Sin instalaciones, sin código, sin límites.
          </p>

          {/* Stats row */}
          <div className="flex items-center gap-8 lg:gap-12 mb-10">
            {STATS.map((s, i) => (
              <div key={s.label}>
                <div className="text-xl lg:text-2xl font-display font-bold tracking-tight text-foreground">{s.value}</div>
                <div className="text-[11px] text-muted-foreground/50 font-medium tracking-wide uppercase mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Feature grid */}
          <div className="grid grid-cols-2 gap-3 max-w-md">
            {[
              { label: "Editor visual", desc: "Sprites, escenas y animaciones" },
              { label: "Lógica con bloques", desc: "Programa sin escribir código" },
              { label: "Publica al instante", desc: "Comparte con un solo clic" },
              { label: "Comunidad activa", desc: "Remixa, comenta y colabora" },
            ].map((f) => (
              <div key={f.label} className="group/card">
                <div className="p-3 rounded-xl border border-border/50 bg-white/40 backdrop-blur-sm transition-all duration-300 group-hover/card:bg-white/60 group-hover/card:border-border/80 group-hover/card:shadow-sm">
                  <div className="text-[13px] font-display font-semibold text-foreground mb-0.5">{f.label}</div>
                  <div className="text-[11px] text-muted-foreground/60 leading-snug">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* subtle gradient line at bottom */}
          <div className="mt-12 h-px bg-gradient-to-r from-primary/10 via-primary/5 to-transparent max-w-sm" />
        </div>
      </div>

      {/* ═══════ RIGHT — Auth ═══════ */}
      <div className="relative z-10 lg:w-[48%] w-full lg:min-h-screen flex items-center justify-center px-5 py-10 lg:py-0">
        {/* Vertical rule */}
        <div className="hidden lg:block absolute left-0 top-[12%] bottom-[12%] w-px bg-gradient-to-b from-transparent via-border/30 to-transparent" />

        <div
          className={`w-full max-w-sm transition-all duration-1000 delay-300 ${loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
          style={{ transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }}
        >
          <TiltCard>
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/60 shadow-xl shadow-primary/[0.06] p-8 relative overflow-hidden">
              {/* Subtle top edge */}
              <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

              {/* Header */}
              <div className="text-center mb-7">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 grid place-items-center mx-auto mb-4">
                  <Gamepad2 size={22} className="text-primary" />
                </div>
                <h2 className="text-xl font-display font-semibold tracking-tight text-foreground mb-1">
                  {mode === "signin" ? "Bienvenido" : "Crear cuenta"}
                </h2>
                <p className="text-sm text-muted-foreground/70">
                  {mode === "signin" ? "Accede a tu panel de creación" : "Empieza a crear en segundos"}
                </p>
              </div>

              {/* Tabs */}
              <div className="flex bg-muted/60 rounded-lg p-0.5 mb-6 relative">
                <div
                  className="absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] rounded-md bg-white shadow-sm transition-all duration-400"
                  style={{ left: mode === "signin" ? "2px" : "calc(50% + 0px)" }}
                />
                {(["signin", "signup"] as const).map(m => (
                  <button key={m} type="button" onClick={() => switchMode(m)}
                    className={`relative flex-1 py-2 rounded-md text-xs font-display font-semibold tracking-wider transition-all duration-300 z-10 ${
                      mode === m
                        ? "text-foreground"
                        : "text-muted-foreground/50 hover:text-muted-foreground/80"
                    }`}
                  >
                    {m === "signin" ? "ACCEDER" : "REGISTRARSE"}
                  </button>
                ))}
              </div>

              {/* Form */}
              <form onSubmit={onSubmit} className="space-y-4">
                {/* Username */}
                {mode === "signup" && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-muted-foreground/70 tracking-wide uppercase flex items-center gap-1.5">
                      <User size={12} className="text-primary/50" /> Usuario
                    </label>
                    <div className="relative">
                      <input
                        value={username} onChange={e => setUsername(e.target.value)}
                        placeholder="tu_usuario"
                        maxLength={32}
                        autoComplete="username"
                        className="w-full bg-white border border-border/70 rounded-lg px-3.5 py-2.5 text-sm outline-none transition-all duration-300 placeholder:text-muted-foreground/25 focus:border-primary/40 focus:ring-[3px] focus:ring-primary/[0.06] focus:bg-white"
                      />
                    </div>
                  </div>
                )}

                {/* Email */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground/70 tracking-wide uppercase flex items-center gap-1.5">
                    <Mail size={12} className="text-primary/50" /> Correo electrónico
                  </label>
                  <div className="relative">
                    <input
                      ref={emailRef}
                      type="email"
                      value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="email@ejemplo.com"
                      required
                      autoComplete="email"
                      className="w-full bg-white border border-border/70 rounded-lg px-3.5 py-2.5 text-sm outline-none transition-all duration-300 placeholder:text-muted-foreground/25 focus:border-primary/40 focus:ring-[3px] focus:ring-primary/[0.06] focus:bg-white"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground/70 tracking-wide uppercase flex items-center gap-1.5">
                    <Lock size={12} className="text-primary/50" /> Contraseña
                  </label>
                  <div className="relative">
                    <input
                      type={showPw ? "text" : "password"}
                      value={password} onChange={e => setPassword(e.target.value)}
                      placeholder={mode === "signup" ? "Mínimo 6 caracteres" : "••••••••"}
                      required
                      minLength={6}
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                      className="w-full bg-white border border-border/70 rounded-lg px-3.5 pr-10 py-2.5 text-sm outline-none transition-all duration-300 placeholder:text-muted-foreground/25 focus:border-primary/40 focus:ring-[3px] focus:ring-primary/[0.06] focus:bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors"
                      tabIndex={-1}
                    >
                      {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {/* Error */}
                {err && (
                  <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-lg bg-destructive/[0.04] border border-destructive/10 text-xs text-destructive/90">
                    <div className="w-4 h-4 rounded-full bg-destructive/8 grid place-items-center shrink-0 mt-[1px] text-[9px] font-bold">!</div>
                    <span>{err}</span>
                  </div>
                )}

                {/* Success */}
                {successMsg && (
                  <div className="px-3.5 py-2.5 rounded-lg bg-emerald-50/80 border border-emerald-200/60 text-xs text-emerald-700/90">
                    {successMsg}
                  </div>
                )}

                {/* Submit */}
                <button
                  disabled={busy}
                  className="relative w-full py-2.5 rounded-lg bg-primary text-white text-sm font-display font-semibold tracking-wide shadow-md shadow-primary/15 hover:shadow-lg hover:shadow-primary/25 active:scale-[0.98] transition-all duration-300 disabled:opacity-50 overflow-hidden group/btn"
                >
                  <div className="absolute inset-0 bg-white/[0.08] translate-y-full group-hover/btn:translate-y-0 transition-transform duration-500" />
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {busy ? (
                      <><Loader2 size={14} className="animate-spin" />{mode === "signin" ? "Accediendo…" : "Creando…"}</>
                    ) : (
                      <><span>{mode === "signin" ? "ACCEDER" : "CREAR CUENTA"}</span><ArrowRight size={13} className="group-hover/btn:translate-x-0.5 transition-transform" /></>
                    )}
                  </span>
                </button>

                {/* Forgot password */}
                {mode === "signin" && (
                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={async () => {
                        if (!email.trim()) { setErr("Escribe tu email primero"); return; }
                        setBusy(true); setErr(null); setSuccessMsg(null);
                        try {
                          const { error } = await supabase.auth.resetPasswordForEmail(email);
                          if (error) throw error;
                          setSuccessMsg("Revisa tu bandeja de entrada");
                        } catch (e) { setErr((e as Error).message); }
                        finally { setBusy(false); }
                      }}
                      className="text-[12px] text-muted-foreground/50 hover:text-primary transition-colors"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>
                )}
              </form>

              {/* Footer */}
              <div className="mt-6 pt-5 border-t border-border/40">
                <p className="text-[10px] text-muted-foreground/30 text-center font-mono tracking-wider">
                  Tus datos se guardan localmente en el navegador
                </p>
              </div>
            </div>
          </TiltCard>
        </div>
      </div>

      {/* Mobile edge */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent z-20" />
    </div>
  );
}
