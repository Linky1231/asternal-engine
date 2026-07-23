import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Gamepad2, Mail, Lock, User, Eye, EyeOff, ArrowRight, Loader2,
  Check, X, AlertCircle,
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

/* ─── Fields that remember being touched ─── */
function useFieldState(initial = "") {
  const [value, setValue] = useState(initial);
  const [focused, setFocused] = useState(false);
  const [touched, setTouched] = useState(false);
  const hasValue = value.trim().length > 0;
  const showLabel = focused || hasValue;
  return { value, setValue, focused, setFocused, touched, setTouched, hasValue, showLabel };
}

/* ─── Floating label input ─── */
function FloatInput({
  label, icon: Icon, type, value, onChange, onFocus, onBlur,
  focused, hasValue, placeholder, autoComplete, maxLength, minLength,
  inputRef, children, error,
}: {
  label: string; icon: React.ElementType; type: string;
  value: string; onChange: (v: string) => void;
  onFocus?: () => void; onBlur?: () => void;
  focused: boolean; hasValue: boolean;
  placeholder?: string; autoComplete?: string;
  maxLength?: number; minLength?: number;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  children?: React.ReactNode;
  error?: string | null;
}) {
  const isEmail = type === "email";
  const isValidEmail = isEmail && hasValue && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const isValidPassword = type === "password" && hasValue && value.length >= 6;
  const showLabel = focused || hasValue;

  return (
    <div className="space-y-1">
      <div className="relative group/input">
        {/* Background glow on focus */}
        <div className={`absolute -inset-1 rounded-xl opacity-0 blur-sm transition-opacity duration-500 ${
          focused ? 'opacity-100' : ''
        }`}
          style={{ background: "radial-gradient(ellipse at center, oklch(0.488 0.185 264 / 0.05), transparent 70%)" }}
        />

        <div className={`relative flex items-center border rounded-lg bg-white transition-all duration-300 ${
          focused
            ? 'border-primary/50 ring-[3px] ring-primary/[0.06] shadow-sm shadow-primary/5'
            : error
              ? 'border-destructive/40 ring-[3px] ring-destructive/[0.04]'
              : 'border-border/70 hover:border-border/90'
        }`}>
          {/* Icon */}
          <span className={`pl-3.5 transition-colors duration-300 shrink-0 ${
            focused ? 'text-primary/60' : error ? 'text-destructive/50' : 'text-muted-foreground/30'
          }`}>
            <Icon size={14} />
          </span>

          <div className="relative flex-1">
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type={type}
              value={value}
              onChange={e => onChange(e.target.value)}
              onFocus={onFocus}
              onBlur={onBlur}
              placeholder={focused ? placeholder || "" : " "}
              autoComplete={autoComplete}
              maxLength={maxLength}
              minLength={minLength}
              required
              className="w-full bg-transparent px-2.5 pt-4 pb-1.5 text-sm outline-none transition-all duration-300 placeholder:text-muted-foreground/20"
            />
            {/* Floating label */}
            <label className={`absolute left-2.5 transition-all duration-200 pointer-events-none select-none origin-left ${
              showLabel
                ? 'top-0.5 text-[10px] font-medium translate-y-0'
                : 'top-1/2 -translate-y-1/2 text-sm text-muted-foreground/40'
            } ${focused ? 'text-primary/70' : error ? 'text-destructive/60' : 'text-muted-foreground/50'}`}>
              {label}
            </label>
          </div>

          {/* Validation indicator */}
          {hasValue && !focused && (
            <span className={`pr-3 shrink-0 transition-all duration-300 ${
              isEmail && isValidEmail ? 'text-emerald-500' :
              type === "password" && isValidPassword ? 'text-emerald-500' :
              type === "text" && hasValue ? 'text-emerald-500' :
              'text-muted-foreground/20'
            }`}>
              {isEmail && isValidEmail || type === "password" && isValidPassword || type === "text" && hasValue
                ? <Check size={14} />
                : null
              }
            </span>
          )}

          {/* Children (e.g. eye toggle) */}
          {children}
        </div>

        {/* Inline error */}
        {error && (
          <p className="text-[11px] text-destructive/80 mt-1 flex items-center gap-1.5 px-1">
            <AlertCircle size={11} className="shrink-0" />
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── Password strength indicator ─── */
function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const len = password.length;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  const score = [len >= 6, len >= 10, hasUpper && hasLower, hasDigit, hasSpecial].filter(Boolean).length;
  const strength = score <= 1 ? "weak" : score <= 3 ? "medium" : "strong";

  const colors = {
    weak: { bg: "bg-destructive/15", fill: "bg-destructive/70", text: "text-destructive/70" },
    medium: { bg: "bg-amber-100", fill: "bg-amber-400", text: "text-amber-600" },
    strong: { bg: "bg-emerald-100", fill: "bg-emerald-500", text: "text-emerald-600" },
  };
  const c = colors[strength];

  return (
    <div className="px-1 mt-1.5 space-y-1">
      <div className="flex gap-1">
        {[1, 2, 3].map(i => (
          <div key={i} className={`h-1 rounded-full flex-1 transition-all duration-500 ${i <= score ? c.fill : c.bg}`} />
        ))}
      </div>
      <p className={`text-[10px] font-medium tracking-wide ${c.text} capitalize`}>{strength}</p>
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

/* ─── Main ─── */
function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const email = useFieldState();
  const password = useFieldState();
  const username = useFieldState();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});
  const [showPw, setShowPw] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [typedLine, setTypedLine] = useState("");
  const fullLine = "crea, publica y comparte";
  const [animateIdx, setAnimateIdx] = useState(0);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const usernameRef = useRef<HTMLInputElement>(null);

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

  // Stagger field animations on mode switch
  useEffect(() => {
    setAnimateIdx(0);
    username.setFocused(false);
    email.setFocused(false);
    password.setFocused(false);
    const fields = mode === "signup" ? 4 : 3; // username, email, password, button
    let i = 0;
    const t = setInterval(() => {
      i++;
      setAnimateIdx(i);
      if (i >= fields) clearInterval(t);
    }, 80);
    setTimeout(() => emailRef.current?.focus(), fields * 80 + 50);
    return () => clearInterval(t);
  }, [mode]);

  const clearErrors = () => { setErr(null); setFieldErrors({}); };

  const switchMode = (m: "signin" | "signup") => {
    clearErrors();
    setSuccessMsg(null);
    setMode(m);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();
    setSuccessMsg(null);

    // Mark all as touched
    email.setTouched(true);
    password.setTouched(true);
    if (mode === "signup") username.setTouched(true);

    // Validate
    const errors: Record<string, string> = {};
    if (!email.value.trim()) errors.email = "El email es obligatorio";
    if (mode === "signup" && !username.value.trim()) errors.username = "Elige un nombre de usuario";
    if (!password.value) errors.password = "La contraseña es obligatoria";
    else if (password.value.length < 6) errors.password = "Mínimo 6 caracteres";

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setBusy(false);
      return;
    }

    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: email.value, password: password.value,
          options: { data: { username: username.value.trim() || email.value.split("@")[0] } },
        });
        if (error) throw error;
        setSuccessMsg("Cuenta creada correctamente");
        setTimeout(() => navigate({ to: "/" }), 1000);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.value, password: password.value });
        if (error) throw error;
        navigate({ to: "/" });
      }
    } catch (e) {
      const msg = (e as Error).message;
      setErr(msg);
      if (msg.toLowerCase().includes("email") || msg.toLowerCase().includes("user")) {
        setFieldErrors(prev => ({ ...prev, email: msg }));
      } else if (msg.toLowerCase().includes("password") || msg.toLowerCase().includes("contraseña")) {
        setFieldErrors(prev => ({ ...prev, password: msg }));
      }
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen w-screen flex flex-col bg-background overflow-y-auto relative">

      {/* ─── Confetti ─── */}
      <ConfettiBurst active={!!successMsg} />

      {/* ─── Background ─── */}
      <div className="fixed inset-0 pointer-events-none select-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,oklch(0.488_0.185_264/0.06),transparent)]" />

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

        <svg className="absolute inset-0 w-full h-full opacity-[0.018]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="dot-grid" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="0.6" fill="oklch(0.488 0.185 264)" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dot-grid)" />
        </svg>
      </div>

      {/* ═══════ CENTER CONTENT ═══════ */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-5 py-10 lg:py-16">

        {/* Brand — Logo centered */}
        <div
          className={`w-full max-w-lg flex justify-center transition-all duration-1000 ${loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
          style={{ transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }}
        >
          <Link to="/" className="inline-flex items-center gap-2.5 group mb-8">
            <div className="w-8 h-8 rounded-lg bg-primary grid place-items-center shadow-md shadow-primary/20 group-hover:shadow-primary/30 transition-shadow">
              <Gamepad2 size={16} className="text-white" />
            </div>
            <span className="text-base font-display font-semibold tracking-tight text-foreground">
              Asternal
            </span>
          </Link>
        </div>

        {/* Two column layout on desktop */}
        <div className="w-full max-w-4xl flex flex-col lg:flex-row items-start justify-center gap-10 lg:gap-16">

          {/* ─── Brand column ─── */}
          <div
            className={`flex-1 flex flex-col items-center text-center transition-all duration-1000 ${loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
            style={{ transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }}
          >
            <h1 className="text-[clamp(1.75rem,3.5vw,2.75rem)] font-display font-bold tracking-tight leading-[1.1] text-foreground mb-4 max-w-md mx-auto">
              El{' '}
              <span className="text-primary relative">
                motor de juegos
                <span className="absolute -bottom-1 left-0 right-0 h-[3px] bg-primary/15 rounded-full" />
              </span>
              {' '}que cabe en tu navegador.
            </h1>

            <p className="text-base leading-relaxed text-muted-foreground/80 max-w-md mx-auto mb-6">
              Una plataforma social donde{' '}
              <span className="text-foreground font-medium">
                {typedLine}
                <span className="inline-block w-[2px] h-[1.05em] bg-primary/70 ml-0.5 align-middle animate-pulse rounded-sm" />
              </span>{' '}
              tus juegos desde cero. Sin instalaciones, sin código, sin límites.
            </p>

            {/* Feature grid */}
            <div className="grid grid-cols-2 gap-2 max-w-sm mx-auto">
              {[
                { label: "Editor visual", desc: "Sprites y animaciones" },
                { label: "Lógica con bloques", desc: "Sin código" },
                { label: "Publica al instante", desc: "Con un solo clic" },
                { label: "Comunidad activa", desc: "Remixa y colabora" },
              ].map((f) => (
                <div key={f.label} className="group/card">
                  <div className="p-2.5 rounded-lg border border-border/50 bg-white/40 backdrop-blur-sm transition-all duration-300 group-hover/card:bg-white/70 group-hover/card:border-border/70 group-hover/card:shadow-sm">
                    <div className="text-[12px] font-display font-semibold text-foreground mb-0.5">{f.label}</div>
                    <div className="text-[10px] text-muted-foreground/60 leading-snug">{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ─── Auth column ─── */}
          <div
            className={`w-full max-w-sm shrink-0 transition-all duration-1000 delay-200 ${loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
            style={{ transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }}
          >
            <TiltCard>
              <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/60 shadow-xl shadow-primary/[0.06] p-7 relative overflow-hidden">
                <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

                {/* Header */}
                <div className="text-center mb-6">
                  <div className="w-11 h-11 rounded-2xl bg-primary/10 grid place-items-center mx-auto mb-3">
                    <Gamepad2 size={20} className="text-primary" />
                  </div>
                  <h2 className="text-lg font-display font-semibold tracking-tight text-foreground mb-0.5">
                    {mode === "signin" ? "Bienvenido" : "Crear cuenta"}
                  </h2>
                  <p className="text-sm text-muted-foreground/70">
                    {mode === "signin" ? "Accede a tu panel de creación" : "Empieza a crear en segundos"}
                  </p>
                </div>

                {/* Tabs */}
                <div className="flex bg-muted/60 rounded-lg p-0.5 mb-5 relative">
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
                <form onSubmit={onSubmit} className="space-y-3">
                  {/* Username (signup only) */}
                  {mode === "signup" && (
                    <div
                      style={{
                        animation: animateIdx >= 0 ? 'slide-in-up 300ms cubic-bezier(0.22,1,0.36,1) both' : 'none',
                        animationDelay: '0ms',
                      }}
                    >
                      <FloatInput
                        label="Nombre de usuario"
                        icon={User}
                        type="text"
                        value={username.value}
                        onChange={username.setValue}
                        onFocus={() => { username.setFocused(true); }}
                        onBlur={() => { username.setFocused(false); username.setTouched(true); }}
                        focused={username.focused}
                        hasValue={username.hasValue}
                        placeholder="tu_usuario"
                        autoComplete="username"
                        maxLength={32}
                        inputRef={usernameRef as React.RefObject<HTMLInputElement>}
                        error={fieldErrors.username}
                      />
                    </div>
                  )}

                  {/* Email */}
                  <div
                    style={{
                      animation: animateIdx >= 1 ? 'slide-in-up 300ms cubic-bezier(0.22,1,0.36,1) both' : 'none',
                      animationDelay: `${mode === "signup" ? 80 : 0}ms`,
                    }}
                  >
                    <FloatInput
                      label="Correo electrónico"
                      icon={Mail}
                      type="email"
                      value={email.value}
                      onChange={email.setValue}
                      onFocus={() => { email.setFocused(true); }}
                      onBlur={() => { email.setFocused(false); email.setTouched(true); }}
                      focused={email.focused}
                      hasValue={email.hasValue}
                      placeholder="email@ejemplo.com"
                      autoComplete="email"
                      inputRef={emailRef}
                      error={fieldErrors.email}
                    />
                  </div>

                  {/* Password */}
                  <div
                    style={{
                      animation: animateIdx >= 2 ? 'slide-in-up 300ms cubic-bezier(0.22,1,0.36,1) both' : 'none',
                      animationDelay: `${mode === "signup" ? 160 : 80}ms`,
                    }}
                  >
                    <FloatInput
                      label="Contraseña"
                      icon={Lock}
                      type={showPw ? "text" : "password"}
                      value={password.value}
                      onChange={password.setValue}
                      onFocus={() => { password.setFocused(true); }}
                      onBlur={() => { password.setFocused(false); password.setTouched(true); }}
                      focused={password.focused}
                      hasValue={password.hasValue}
                      placeholder={mode === "signup" ? "Mínimo 6 caracteres" : "••••••••"}
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                      minLength={6}
                      inputRef={passwordRef}
                      error={fieldErrors.password}
                    >
                      <button type="button" onClick={() => setShowPw(!showPw)}
                        className="pr-3 text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors shrink-0" tabIndex={-1}>
                        {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </FloatInput>

                    {/* Password strength (signup only) */}
                    {mode === "signup" && <PasswordStrength password={password.value} />}
                  </div>

                  {/* Generic error */}
                  {err && !fieldErrors.email && !fieldErrors.password && !fieldErrors.username && (
                    <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-lg bg-destructive/[0.04] border border-destructive/10 text-xs text-destructive/90 animate-[scale-in_200ms_ease-out]">
                      <div className="w-4 h-4 rounded-full bg-destructive/8 grid place-items-center shrink-0 mt-[1px] text-[9px] font-bold">!</div>
                      <span>{err}</span>
                    </div>
                  )}

                  {/* Success */}
                  {successMsg && (
                    <div className="px-3.5 py-2.5 rounded-lg bg-emerald-50/80 border border-emerald-200/60 text-xs text-emerald-700/90 animate-[scale-in_300ms_ease-out]">
                      {successMsg}
                    </div>
                  )}

                  {/* Submit */}
                  <div
                    style={{
                      animation: animateIdx >= 3 ? 'slide-in-up 300ms cubic-bezier(0.22,1,0.36,1) both' : 'none',
                      animationDelay: `${mode === "signup" ? 240 : 160}ms`,
                    }}
                  >
                    <button disabled={busy}
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
                  </div>

                  {/* Forgot password */}
                  {mode === "signin" && (
                    <div className="text-center pt-1">
                      <button type="button" onClick={async () => {
                        if (!email.value.trim()) { setFieldErrors({ email: "Escribe tu email primero" }); return; }
                        setBusy(true); clearErrors(); setSuccessMsg(null);
                        try {
                          const { error } = await supabase.auth.resetPasswordForEmail(email.value);
                          if (error) throw error;
                          setSuccessMsg("Revisa tu bandeja de entrada");
                        } catch (e) { setErr((e as Error).message); }
                        finally { setBusy(false); }
                      }} className="text-[12px] text-muted-foreground/50 hover:text-primary transition-colors">
                        ¿Olvidaste tu contraseña?
                      </button>
                    </div>
                  )}
                </form>

                <div className="mt-5 pt-4 border-t border-border/40">
                  <p className="text-[10px] text-muted-foreground/30 text-center font-mono tracking-wider">
                    Tus datos se guardan localmente en el navegador
                  </p>
                </div>
              </div>
            </TiltCard>
          </div>
        </div>
      </div>
    </div>
  );
}
