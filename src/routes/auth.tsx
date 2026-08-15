import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { supabase, clearSupabaseCredentials } from "@/integrations/supabase/client";
import {
  Gamepad2, Mail, Lock, User, Eye, EyeOff, ArrowRight, Loader2,
  Check, AlertCircle, Sparkles, PencilRuler, Blocks, Rocket, Users, Play, RefreshCw,
} from "lucide-react";

/* ─── Traduce errores de Supabase a mensajes claros en español ─── */
function friendlyAuthError(msg: string): string {
  const m = msg.toLowerCase();
  // Límite de envíos de correo (registros / OTP / recuperación): se bloquea
  // temporalmente por seguridad tras varios intentos seguidos.
  if (/rate limit|rate_limit|over.?request.?rate|too many (requests|attempts)|email.*send/i.test(m)) {
    return "Límite de envíos de correo alcanzado (el servicio integrado de Supabase permite ~2 por hora). Registrarte y acceder NO requieren correo, así que puedes intentarlo de nuevo de inmediato. Si el error aparece en «¿Olvidaste tu contraseña?», espera ~1 hora o conecta un SMTP personalizado (ej. Resend) para subir el límite.";
  }
  if (/invalid login credentials|invalid credentials|incorrect (email|password)|password.*does not match/i.test(m)) {
    return "Usuario o contraseña incorrectos. Revísalos e inténtalo de nuevo.";
  }
  if (/user already registered|already registered|email.*already.*exist/i.test(m)) {
    return "Ese email ya tiene una cuenta. Pulsa ACCEDER para entrar.";
  }
  if (/email not confirmed|confirm your email|verify your email/i.test(m)) {
    return "Aún no has confirmado tu email. Revisa tu bandeja de entrada (y la carpeta de spam).";
  }
  return msg;
}

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Asternal — Acceso a la plataforma" }] }),
  component: AuthPage,
});

/* ─── Confetti ─── */
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
        <div key={i} className="absolute rounded-full"
          style={{
            left: `${45 + (i % 5) * 3}%`, top: `${30 + (i % 7) * 4}%`,
            width: 3 + (i % 4), height: 3 + (i % 4),
            background: ["oklch(0.52 0.19 258)","oklch(0.72 0.14 235)","oklch(0.65 0.2 150)","oklch(0.85 0.2 85)"][i % 4],
            animation: `confetti-fall ${1 + (i % 4) * 0.3}s ease-out ${(i % 8) * 0.05}s both`,
            opacity: 0,
          }}
        />
      ))}
    </div>
  );
}

/* ─── Twinkling star ─── */
function Star({ index }: { index: number }) {
  const size = 1 + (index % 2);
  const x = `${(index * 37 + 13) % 100}%`;
  const y = `${(index * 23 + 5) % 100}%`;
  return (
    <div className="absolute rounded-full pointer-events-none"
      style={{
        width: size, height: size, left: x, top: y,
        background: "oklch(0.72 0.14 235)",
        animation: `twinkle ${3 + (index % 4)}s ease-in-out ${index * 0.35}s infinite`,
      }}
    />
  );
}

/* ─── Circuit lines ─── */
function CircuitLines() {
  return (
    <svg className="absolute inset-0 w-full h-full opacity-[0.05]" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none">
      <g stroke="oklch(0.52 0.19 258)" strokeWidth="0.7">
        <path d="M0 12% H 35% V 7% H 65%" />
        <path d="M0 24% H 20% V 18% H 55%" />
        <path d="M100% 10% H 68% V 5% H 45%" />
        <path d="M100% 30% H 55% V 36% H 30%" />
        <path d="M35% 100% V 60% H 60%" />
        <path d="M70% 100% V 50% H 88%" />
      </g>
      <g fill="oklch(0.52 0.19 258)">
        <circle cx="35%" cy="7%" r="2.2" />
        <circle cx="65%" cy="7%" r="2.2" />
        <circle cx="20%" cy="18%" r="2.2" />
        <circle cx="55%" cy="18%" r="2.2" />
        <circle cx="60%" cy="36%" r="2.2" />
        <circle cx="30%" cy="36%" r="2.2" />
        <circle cx="60%" cy="60%" r="2.2" />
        <circle cx="88%" cy="50%" r="2.2" />
      </g>
    </svg>
  );
}

/* ─── Hero scene: pixel sprite ─── */
const SPRITE_PX = [
  "·","·","c","c","c","c","·","·",
  "·","c","c","c","c","c","c","·",
  "·","c","s","s","s","s","c","·",
  "·","s","s","s","s","s","s","·",
  "·","s","e","s","s","e","s","·",
  "·","s","s","s","s","s","s","·",
  "·","b","b","b","b","b","b","·",
  "·","b","b","b","b","b","b","·",
];
const PX_COLORS: Record<string, string> = {
  c: "oklch(0.52 0.19 258)",
  s: "oklch(0.84 0.12 85)",
  e: "oklch(0.25 0.02 250)",
  b: "oklch(0.62 0.14 252)",
};

/* ─── Creator robot ─── */
function CreatorRobot() {
  return (
    <div className="relative">
      {/* Head */}
      <div className="w-12 h-11 rounded-[10px] bg-gradient-to-b from-white to-white/70 border-2 border-primary/25 shadow-lg flex items-center justify-center gap-[3px]">
        <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_6px_oklch(0.52_0.19_258/0.6)]" />
        <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_6px_oklch(0.52_0.19_258/0.6)]" />
      </div>
      {/* Neck */}
      <div className="w-1.5 h-2 bg-primary/20 mx-auto" />
      {/* Body with screen */}
      <div className="w-11 h-12 rounded-[10px] bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/30 relative overflow-hidden">
        <div className="absolute inset-x-2 bottom-2 top-4 rounded-md bg-white/90 flex items-center justify-center">
          <div className="w-4 h-3 rounded-sm bg-gradient-to-br from-primary to-accent opacity-70" />
        </div>
      </div>
      {/* Arms */}
      <div className="absolute -left-2 top-[32px] w-2.5 h-5 rounded-full bg-primary/70 shadow" />
      <div className="absolute -right-2 top-[32px] w-2.5 h-5 rounded-full bg-primary/70 shadow" />
      {/* Legs */}
      <div className="absolute left-[11px] -bottom-2 w-2.5 h-3.5 rounded-b-full bg-primary/80" />
      <div className="absolute right-[11px] -bottom-2 w-2.5 h-3.5 rounded-b-full bg-primary/80" />
    </div>
  );
}

/* ─── Floating editor panel (sprite) ─── */
function SpritePanel() {
  return (
    <div className="w-[122px] rounded-xl p-2.5 border border-border/60 bg-white/90 shadow-sm">
      <div className="flex items-center gap-1.5 mb-2">
        <div className="w-2 h-2 rounded-full bg-primary" />
        <div className="w-2 h-2 rounded-full bg-amber-400" />
        <div className="w-2 h-2 rounded-full bg-emerald-400" />
        <div className="ml-auto text-[8px] font-mono text-muted-foreground/50 truncate">hero.png</div>
      </div>
      <div className="grid grid-cols-8 gap-[2px] w-fit mx-auto">
        {SPRITE_PX.map((px, i) => (
          <div key={i} className="w-[7px] h-[7px] rounded-[1px]"
            style={{ background: px === "·" ? "transparent" : PX_COLORS[px] }} />
        ))}
      </div>
      <div className="mt-2 h-[3px] rounded-full bg-gradient-to-r from-primary/60 to-accent/60 opacity-60" />
    </div>
  );
}

/* ─── Floating editor panel (blocks) ─── */
function BlockPanel() {
  return (
    <div className="w-[112px] rounded-xl p-2.5 border border-border/60 bg-white/90 shadow-sm">
      <div className="text-[8px] font-mono text-muted-foreground/50 mb-1.5 tracking-wider">LÓGICA</div>
      <div className="space-y-1">
        <div className="h-3.5 rounded-md bg-primary/80 flex items-center px-1.5 shadow-sm">
          <span className="text-[7px] font-semibold text-white tracking-wide">mover →</span>
        </div>
        <div className="h-3.5 rounded-md bg-emerald-400/80 flex items-center px-1.5 shadow-sm">
          <span className="text-[7px] font-semibold text-white tracking-wide">si · toca</span>
        </div>
        <div className="h-3.5 rounded-md bg-amber-400/80 flex items-center px-1.5 shadow-sm">
          <span className="text-[7px] font-semibold text-white tracking-wide">repetir 4</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Floating play pill ─── */
function PlayPanel() {
  return (
    <div className="flex items-center gap-2 rounded-full pl-2 pr-3.5 py-1.5 border border-border/60 bg-white/90 shadow-sm">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-accent grid place-items-center shadow-md shadow-primary/30">
        <Play size={12} className="text-white fill-white" />
      </div>
      <div className="text-[9px] font-semibold text-foreground/80 leading-tight">
        Jugar ahora
        <div className="text-[8px] font-normal text-muted-foreground/60">en tu navegador</div>
      </div>
    </div>
  );
}

/* ─── Hero scene ─── */
function HeroScene() {
  return (
    <div className="relative w-full h-[230px] lg:h-[440px] select-none pointer-events-none">
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 origin-center scale-[0.6] lg:scale-100" style={{ willChange: "transform" }}>
        <div className="relative w-[460px] h-[460px]">

          {/* Ambient glows */}
          <div className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 w-[360px] h-[360px] rounded-full"
            style={{ background: "radial-gradient(circle, oklch(0.52 0.19 258 / 0.14), transparent 62%)" }} />
          <div className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 w-[220px] h-[220px] rounded-full"
            style={{ background: "radial-gradient(circle, oklch(0.72 0.14 235 / 0.12), transparent 60%)" }} />


          {/* Floating island + robot */}
          <div className="absolute left-1/2 top-[63%] -translate-x-1/2">
            <div className="absolute left-1/2 -translate-x-1/2 top-[38px] w-[330px] h-[70px] rounded-[50%] bg-primary/10 blur-2xl" />
            {/* Robot */}
            <div className="relative z-10 flex justify-center" style={{ animation: "bob 4s ease-in-out infinite", willChange: "transform" }}>
              <CreatorRobot />
            </div>
            {/* Crystal */}
            <div className="absolute right-[12%] top-[6px] animate-float-icon" style={{ animationDelay: "0.8s" }}>
              <div className="w-5 h-8 rounded-t-lg rounded-b-sm bg-gradient-to-b from-accent to-primary/40 shadow-lg shadow-accent/30 rotate-12" />
            </div>
            {/* Disc */}
            <div className="relative -mt-1 z-10 w-[250px] h-[54px] rounded-[50%] bg-gradient-to-b from-white/90 to-white/40 border border-white/70 shadow-[0_25px_60px_-15px_oklch(0.52_0.19_258/0.4)]">
              <div className="absolute inset-0 rounded-[50%] overflow-hidden opacity-40"
                style={{
                  background:
                    "repeating-linear-gradient(90deg, transparent 0 13px, oklch(0.52 0.19 258 / 0.1) 13px 14px), repeating-linear-gradient(0deg, transparent 0 13px, oklch(0.52 0.19 258 / 0.1) 13px 14px)",
                }} />
              <div className="absolute left-1/2 top-0 -translate-x-1/2 w-3/4 h-[3px] rounded-full bg-white/80 blur-[1px]" />
            </div>
            {/* Floating rocks */}
            <div className="absolute -left-10 top-[52px] w-14 h-7 rounded-full bg-primary/10 border border-primary/15 animate-float-icon" style={{ animationDelay: "1.2s" }} />
            <div className="absolute -right-12 top-[60px] w-10 h-6 rounded-full bg-accent/10 border border-accent/15 animate-float-icon" style={{ animationDelay: "2s" }} />
          </div>

          {/* Floating UI panels */}
          <div className="absolute left-[3%] top-[20%] animate-float-icon" style={{ animationDelay: "0.4s", willChange: "transform" }}>
            <SpritePanel />
          </div>
          <div className="absolute right-[1%] top-[30%] animate-float-icon" style={{ animationDelay: "1.1s", willChange: "transform" }}>
            <BlockPanel />
          </div>
          <div className="absolute right-[9%] bottom-[9%] animate-float-icon" style={{ animationDelay: "1.7s", willChange: "transform" }}>
            <PlayPanel />
          </div>
          <div className="absolute left-[8%] bottom-[20%] animate-float-icon" style={{ animationDelay: "2.3s", willChange: "transform" }}>
            <div className="w-9 h-9 rounded-full bg-white/90 border border-border/60 grid place-items-center shadow-sm">
              <Sparkles size={15} className="text-accent" />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

/* ─── useFieldState ─── */
function useFieldState(initial = "") {
  const [value, setValue] = useState(initial);
  const [focused, setFocused] = useState(false);
  const [touched, setTouched] = useState(false);
  const hasValue = value.trim().length > 0;
  const showLabel = focused || hasValue;
  return { value, setValue, focused, setFocused, touched, setTouched, hasValue, showLabel };
}

/* ─── FloatInput ─── */
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
  const showLabelLocal = focused || hasValue;

  return (
    <div className="space-y-1">
      <div className="relative group/input">
        <div className={`absolute -inset-1 rounded-xl opacity-0 blur-sm transition-opacity duration-500 ${focused ? 'opacity-100' : ''}`}
          style={{ background: "radial-gradient(ellipse at center, oklch(0.52 0.19 258 / 0.06), transparent 70%)" }}
        />
        <div className={`relative flex items-center border rounded-xl bg-white transition-all duration-300 ${
          focused
            ? 'border-primary/50 ring-[3px] ring-primary/[0.06] shadow-sm shadow-primary/5'
            : error
              ? 'border-destructive/40 ring-[3px] ring-destructive/[0.04]'
              : 'border-border/70 hover:border-border/90'
        }`}>
          <span className={`pl-3.5 transition-colors duration-300 shrink-0 ${focused ? 'text-primary/60' : error ? 'text-destructive/50' : 'text-muted-foreground/30'}`}>
            <Icon size={14} />
          </span>
          <div className="relative flex-1">
            <input ref={inputRef as React.RefObject<HTMLInputElement>}
              type={type} value={value} onChange={e => onChange(e.target.value)}
              onFocus={onFocus} onBlur={onBlur}
              placeholder={focused ? placeholder || "" : " "}
              autoComplete={autoComplete} maxLength={maxLength} minLength={minLength} required
              className="w-full bg-transparent px-2.5 pt-4 pb-1.5 text-sm outline-none transition-all duration-300 placeholder:text-muted-foreground/20"
            />
            <label className={`absolute left-2.5 transition-all duration-200 pointer-events-none select-none origin-left ${
              showLabelLocal
                ? 'top-0.5 text-[10px] font-medium translate-y-0'
                : 'top-1/2 -translate-y-1/2 text-sm text-muted-foreground/40'
            } ${focused ? 'text-primary/70' : error ? 'text-destructive/60' : 'text-muted-foreground/50'}`}>
              {label}
            </label>
          </div>
          {hasValue && !focused && (
            <span className="pr-3 shrink-0 text-emerald-500">
              {(isEmail && isValidEmail) || (type === "password" && isValidPassword) || (type === "text" && hasValue)
                ? <Check size={14} /> : null}
            </span>
          )}
          {children}
        </div>
        {error && (
          <p className="text-[11px] text-destructive/80 mt-1 flex items-center gap-1.5 px-1">
            <AlertCircle size={11} className="shrink-0" /> {error}
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── PasswordStrength ─── */
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

/* ─── Logo (rediseñado) ─── */
function Logo({ loaded }: { loaded: boolean }) {
  return (
    <div style={{ animation: loaded ? 'scale-in 700ms 0ms cubic-bezier(0.16,1,0.3,1) both' : 'none' }}>
      <Link to="/" className="inline-flex items-center gap-3 group">
        <div className="relative">
          <div className="absolute inset-0 rounded-2xl bg-primary/30 blur-xl scale-150 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="relative w-11 h-11 rounded-2xl bg-gradient-to-br from-primary to-accent grid place-items-center shadow-lg shadow-primary/30"
            style={{ animation: "bob-slow 5s ease-in-out infinite" }}>
            <Gamepad2 size={22} className="text-white" />
          </div>
          <div className="absolute -right-1 -top-1 w-2.5 h-2.5 rounded-full bg-accent border-2 border-background animate-pulse" />
        </div>
        <span className="text-xl font-display font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground to-foreground/60 bg-clip-text text-transparent">
          Asternal
        </span>
      </Link>
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
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const usernameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) navigate({ to: "/" });
    });
    requestAnimationFrame(() => setLoaded(true));
  }, [navigate]);

  const clearErrors = () => { setErr(null); setFieldErrors({}); };

  // Recuperación rápida: si una clave guardada en el navegador es inválida
  // (p. ej. un token sbp_… pegado como anon key), la borra y recarga la app.
  const resetConnection = () => {
    clearSupabaseCredentials();
    window.location.reload();
  };

  const switchMode = (m: "signin" | "signup") => {
    clearErrors();
    setSuccessMsg(null);
    setMode(m);
  };

  /** Normaliza un nombre de usuario a la forma segura (minúsculas, a-z0-9_). */
  const cleanUsername = (v: string) => v.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");

  /**
   * Resuelve el identificador de acceso: si es un correo se usa tal cual;
   * si es un nombre de usuario se mapea de forma determinista a
   * <usuario>@asternal.app (la misma cuenta creada al registrarse sin correo).
   */
  const resolveLoginEmail = (identifier: string): string => {
    const v = identifier.trim();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return v;
    const u = cleanUsername(v);
    return `${u || "usuario"}@asternal.app`;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();
    setSuccessMsg(null);
    email.setTouched(true);
    password.setTouched(true);
    if (mode === "signup") username.setTouched(true);

    const errors: Record<string, string> = {};
    if (!email.value.trim()) errors.email = "Escribe tu usuario o correo";
    if (mode === "signup" && !cleanUsername(username.value)) errors.username = "Elige un nombre de usuario";
    if (!password.value) errors.password = "La contraseña es obligatoria";
    else if (password.value.length < 6) errors.password = "Mínimo 6 caracteres";

    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }

    setBusy(true);
    try {
      if (mode === "signup") {
        const u = cleanUsername(username.value);
        // Sin correo no pasa nada: se usa <usuario>@asternal.app (determinista,
        // sirve también para acceder después solo con el nombre de usuario).
        const emailFinal = email.value.trim() || `${u}@asternal.app`;
        const { error } = await supabase.auth.signUp({
          email: emailFinal, password: password.value,
          options: { data: { username: u } },
        });
        if (error) throw error;
        setSuccessMsg("Cuenta creada correctamente");
        setTimeout(() => navigate({ to: "/" }), 1000);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: resolveLoginEmail(email.value),
          password: password.value,
        });
        if (error) throw error;
        navigate({ to: "/" });
      }
    } catch (e) {
      const msg = (e as Error).message;
      const friendly = friendlyAuthError(msg);
      setErr(friendly);
      if (/email|user|rate/i.test(msg))
        setFieldErrors(prev => ({ ...prev, email: friendly }));
      else if (/password|contraseña/i.test(msg))
        setFieldErrors(prev => ({ ...prev, password: friendly }));
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen w-full flex flex-col bg-background overflow-y-auto relative">

      <ConfettiBurst active={!!successMsg} />

      {/* ─── Background layers ─── */}
      <div className="fixed inset-0 pointer-events-none select-none overflow-hidden" style={{ transform: "translateZ(0)" }}>
        {/* Base glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,oklch(0.52_0.19_258/0.09),transparent)]" />
        {/* Mesh blobs */}
        <div className="absolute -top-[30%] -left-[20%] w-[70%] h-[70%] opacity-50"
          style={{ background: "radial-gradient(circle at 30% 50%, oklch(0.52 0.19 258 / 0.07), transparent 60%)" }} />
        <div className="absolute -bottom-[30%] -right-[20%] w-[70%] h-[70%] opacity-50"
          style={{ background: "radial-gradient(circle at 70% 50%, oklch(0.72 0.14 235 / 0.06), transparent 60%)" }} />
        {/* Dot grid */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.02]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="dot-grid-auth" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="0.5" fill="oklch(0.52 0.19 258)" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dot-grid-auth)" />
        </svg>
      </div>

      {/* ═══════ CONTENT ═══════ */}
      <div className="relative z-10 flex-1 flex flex-col">

        {/* Header: logo memorable */}
        <header className="w-full px-5 pt-6 flex justify-center">
          <Logo loaded={loaded} />
        </header>

        {/* Main grid */}
        <div className="flex-1 w-full max-w-6xl mx-auto grid lg:grid-cols-[1.05fr_1fr] items-center gap-2 lg:gap-14 px-5 pb-10 pt-3">

          {/* ─── BRAND + HERO ─── */}
          <div className="order-1 flex flex-col items-center text-center">

            {/* Hero visual — estrella de la página */}
            <div className="w-full" style={{
              animation: loaded ? 'scale-in 1100ms 100ms cubic-bezier(0.16,1,0.3,1) both' : 'none',
            }}>
              <HeroScene />
            </div>

            {/* Personality line */}
            <div style={{
              animation: loaded ? 'fade-in-up 500ms 300ms cubic-bezier(0.22,1,0.36,1) both' : 'none',
            }}>
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-primary/15 bg-white/50 backdrop-blur-sm text-[11px] font-display font-medium tracking-wide text-primary/80 shadow-sm -mt-1 lg:-mt-3">
                <Sparkles size={12} className="text-accent" />
                Todo comienza con una idea
              </div>
            </div>

            {/* Headline corta y directa */}
            <div style={{
              animation: loaded ? 'fade-in-up 600ms 420ms cubic-bezier(0.22,1,0.36,1) both' : 'none',
            }}>
              <h1 className="text-[clamp(1.8rem,3.6vw,2.9rem)] font-display font-bold tracking-tight leading-[1.08] text-foreground mt-4 mb-3 max-w-lg mx-auto">
                Crea juegos desde{' '}
                <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent bg-[length:200%_100%] animate-shimmer-text">
                  cualquier navegador.
                </span>
              </h1>
            </div>

            {/* Descripción breve */}
            <div style={{
              animation: loaded ? 'fade-in-up 600ms 540ms cubic-bezier(0.22,1,0.36,1) both' : 'none',
            }}>
              <p className="text-[15px] leading-relaxed text-muted-foreground/80 max-w-md mx-auto mb-8">
                Un estudio completo en la nube: editor visual, lógica con bloques,
                publicación al instante y una comunidad activa. Sin instalaciones.
              </p>
            </div>

            {/* Feature chips (solo pantallas grandes) */}
            <div className="hidden sm:grid grid-cols-2 gap-2.5 max-w-sm mx-auto w-full">
              {[
                { icon: PencilRuler, label: "Editor visual", desc: "Sprites y animaciones" },
                { icon: Blocks, label: "Lógica con bloques", desc: "Sin código" },
                { icon: Rocket, label: "Publica al instante", desc: "Con un solo clic" },
                { icon: Users, label: "Comunidad activa", desc: "Remixa y colabora" },
              ].map((f, i) => (
                <div key={f.label} className="group/card" style={{ animation: loaded ? `fade-in-up 900ms ${1000 + i * 280}ms cubic-bezier(0.16,1,0.3,1) both` : 'none' }}>
                  <div className="p-2.5 rounded-xl border border-border/50 bg-white/40 backdrop-blur-sm transition-all duration-400 group-hover/card:bg-white/80 group-hover/card:border-primary/30 group-hover/card:shadow-lg group-hover/card:shadow-primary/5 group-hover/card:-translate-y-0.5">
                    <div className="flex items-center gap-1.5 text-[12px] font-display font-semibold text-foreground mb-0.5 group-hover/card:text-primary transition-colors duration-300">
                      <f.icon size={12} className="text-primary/60 group-hover/card:text-primary transition-colors duration-300" />
                      {f.label}
                    </div>
                    <div className="text-[10px] text-muted-foreground/60 leading-snug">{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ─── AUTH CARD ─── */}
          <div className="order-2 w-full flex justify-center lg:justify-end">
            <div className="w-full max-w-[400px]" style={{
              animation: loaded ? 'fade-in-up 800ms 700ms cubic-bezier(0.22,1,0.36,1) both' : 'none',
            }}>
                {/* Tarjeta premium: borde degradado + sombras en capas + radius 24px */}
                <div className="relative rounded-3xl p-px bg-gradient-to-b from-white/70 via-white/25 to-primary/15 shadow-[0_30px_80px_-20px_oklch(0.52_0.19_258/0.3),0_10px_30px_-10px_oklch(0.52_0.19_258/0.18)]">
                  <div className="relative bg-white/75 backdrop-blur-md rounded-[calc(1.5rem-1px)] p-7 overflow-hidden group/form-card">

                    {/* Shine superior */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 h-px w-3/4 bg-gradient-to-r from-transparent via-white/90 to-transparent" />
                    {/* Glow interno */}
                    <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-32 bg-primary/5 blur-2xl rounded-full pointer-events-none" />

                    {/* Header */}
                    <div className="text-center mb-6 relative">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-accent grid place-items-center mx-auto mb-3 shadow-lg shadow-primary/25 relative">
                        <div className="absolute inset-0 rounded-2xl bg-primary/20 blur-lg scale-125 animate-pulse" style={{ animationDuration: '3s' }} />
                        <Gamepad2 size={22} className="text-white relative" />
                      </div>
                      <h2 className="text-lg font-display font-semibold tracking-tight text-foreground mb-0.5">
                        {mode === "signin" ? "Bienvenido de nuevo" : "Crea tu cuenta"}
                      </h2>
                      <p className="text-sm text-muted-foreground/70">
                        {mode === "signin" ? "Accede a tu estudio en la nube" : "Únete a la comunidad Asternal"}
                      </p>
                    </div>

                    {/* Tabs */}
                    <div className="flex bg-muted/60 rounded-xl p-0.5 mb-5 relative">
                      <div className="absolute top-0.5 bottom-0.5 w-[calc(50%_-_2px)] rounded-[10px] bg-white shadow-sm transition-all duration-400"
                        style={{ left: mode === "signin" ? "2px" : "calc(50% + 0px)" }} />
                      {(["signin", "signup"] as const).map(m => (
                        <button key={m} type="button" onClick={() => switchMode(m)}
                          className={`relative flex-1 py-2 rounded-[10px] text-xs font-display font-semibold tracking-wider transition-all duration-300 z-10 ${
                            mode === m ? "text-foreground" : "text-muted-foreground/50 hover:text-muted-foreground/80"
                          }`}>
                          {m === "signin" ? "ACCEDER" : "REGISTRARSE"}
                        </button>
                      ))}
                    </div>

                    {/* Form */}
                    <form onSubmit={onSubmit} className="space-y-3">
                      {mode === "signup" && (
                        <div style={{ animation: 'slide-in-up 300ms cubic-bezier(0.22,1,0.36,1) both', animationDelay: '0ms' }}>
                          <FloatInput label="Nombre de usuario" icon={User} type="text"
                            value={username.value} onChange={username.setValue}
                            onFocus={() => username.setFocused(true)}
                            onBlur={() => { username.setFocused(false); username.setTouched(true); }}
                            focused={username.focused} hasValue={username.hasValue}
                            placeholder="tu_usuario" autoComplete="username" maxLength={32}
                            inputRef={usernameRef as React.RefObject<HTMLInputElement>}
                            error={fieldErrors.username} />
                        </div>
                      )}

                      <div style={{ animation: 'slide-in-up 300ms cubic-bezier(0.22,1,0.36,1) both', animationDelay: '80ms' }}>
                        <FloatInput
                          label={mode === "signup" ? "Correo electrónico (opcional)" : "Usuario o correo"}
                          icon={mode === "signup" ? Mail : User}
                          type="text"
                          value={email.value} onChange={email.setValue}
                          onFocus={() => email.setFocused(true)}
                          onBlur={() => { email.setFocused(false); email.setTouched(true); }}
                          focused={email.focused} hasValue={email.hasValue}
                          placeholder={mode === "signup" ? "email@ejemplo.com (no es necesario)" : "tu_usuario o email@ejemplo.com"}
                          autoComplete={mode === "signup" ? "email" : "username"}
                          inputRef={emailRef} error={fieldErrors.email} />
                      </div>

                      <div style={{ animation: 'slide-in-up 300ms cubic-bezier(0.22,1,0.36,1) both', animationDelay: '160ms' }}>
                        <FloatInput label="Contraseña" icon={Lock} type={showPw ? "text" : "password"}
                          value={password.value} onChange={password.setValue}
                          onFocus={() => password.setFocused(true)}
                          onBlur={() => { password.setFocused(false); password.setTouched(true); }}
                          focused={password.focused} hasValue={password.hasValue}
                          placeholder={mode === "signup" ? "Mínimo 6 caracteres" : "••••••••"}
                          autoComplete={mode === "signup" ? "new-password" : "current-password"}
                          minLength={6} inputRef={passwordRef} error={fieldErrors.password}>
                          <button type="button" onClick={() => setShowPw(!showPw)}
                            className="pr-3 text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors shrink-0" tabIndex={-1}>
                            {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </FloatInput>
                        {mode === "signup" && <PasswordStrength password={password.value} />}
                      </div>

                      {err && !fieldErrors.email && !fieldErrors.password && !fieldErrors.username && (
                        <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-lg bg-destructive/[0.04] border border-destructive/10 text-xs text-destructive/90 animate-[scale-in_200ms_ease-out]">
                          <div className="w-4 h-4 rounded-full bg-destructive/8 grid place-items-center shrink-0 mt-[1px] text-[9px] font-bold">!</div>
                          <span>{err}</span>
                        </div>
                      )}

                      {/* "Invalid API key": una clave de Supabase guardada en el navegador es incorrecta */}
                      {err && /invalid api key|apikey|invalid key/i.test(err) && (
                        <button type="button" onClick={resetConnection}
                          className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-dashed border-amber-400/50 text-[11px] font-medium text-amber-700 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20 hover:bg-amber-100/70 dark:hover:bg-amber-950/40 transition-colors"
                        >
                          <RefreshCw size={11} /> Restablecer la conexión de Supabase (borra la clave guardada y recarga)
                        </button>
                      )}

                      {successMsg && (
                        <div className="px-3.5 py-2.5 rounded-lg bg-emerald-50/80 border border-emerald-200/60 text-xs text-emerald-700/90 animate-[scale-in_300ms_ease-out]">
                          {successMsg}
                        </div>
                      )}

                      {/* Submit button */}
                      <div style={{ animation: 'slide-in-up 300ms cubic-bezier(0.22,1,0.36,1) both', animationDelay: '240ms' }}>
                        <button disabled={busy}
                          className="relative w-full py-2.5 rounded-xl bg-gradient-to-br from-primary to-accent text-white text-sm font-display font-semibold tracking-wide shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 active:scale-[0.98] transition-all duration-300 disabled:opacity-50 overflow-hidden group/btn"
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700 ease-in-out" />
                          <div className="absolute inset-0 bg-white/[0.06] translate-y-full group-hover/btn:translate-y-0 transition-transform duration-500" />
                          <span className="relative z-10 flex items-center justify-center gap-2">
                            {busy ? (
                              <><Loader2 size={14} className="animate-spin" />{mode === "signin" ? "Accediendo…" : "Creando…"}</>
                            ) : (
                              <><span>{mode === "signin" ? "ACCEDER" : "CREAR CUENTA"}</span><ArrowRight size={13} className="group-hover/btn:translate-x-0.5 transition-transform" /></>
                            )}
                          </span>
                        </button>
                      </div>

                      {mode === "signin" && (
                        <div className="text-center pt-1">
                          <button type="button" onClick={async () => {
                            if (!email.value.trim()) { setFieldErrors({ email: "Escribe tu usuario o correo primero" }); return; }
                            setBusy(true); clearErrors(); setSuccessMsg(null);
                            try {
                              const { error } = await supabase.auth.resetPasswordForEmail(resolveLoginEmail(email.value));
                              if (error) throw error;
                              setSuccessMsg("Revisa tu bandeja de entrada (o si usaste solo usuario, tu correo @asternal.app)");
                            } catch (e) { setErr(friendlyAuthError((e as Error).message)); }
                            finally { setBusy(false); }
                          }} className="text-[12px] text-muted-foreground/50 hover:text-primary transition-colors">
                            ¿Olvidaste tu contraseña?
                          </button>
                        </div>
                      )}
                    </form>

                    <div className="mt-5 pt-4 border-t border-border/40">
                      <p className="text-[10px] text-muted-foreground/30 text-center font-mono tracking-wider">
                        Tus creaciones se sincronizan en la nube
                      </p>
                      <button type="button" onClick={resetConnection}
                        className="mt-2 w-full text-center text-[10px] text-muted-foreground/30 hover:text-primary transition-colors underline underline-offset-2">
                        ¿Problemas de conexión? Restablecer Supabase
                      </button>
                    </div>
                  </div>
                </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
