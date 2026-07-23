import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Gamepad2, Mail, Lock, User, Eye, EyeOff, ArrowRight, Loader2, Sparkles } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Acceder · Asternal" }] }),
  component: AuthPage,
});

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
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) navigate({ to: "/" });
    });
  }, [navigate]);

  useEffect(() => {
    // Focus email field on mode switch
    setTimeout(() => emailRef.current?.focus(), 100);
  }, [mode]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setSuccessMsg(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        if (!username.trim()) {
          setErr("Elige un nombre de usuario");
          setBusy(false);
          return;
        }
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            data: { username: username.trim() || email.split("@")[0] },
          },
        });
        if (error) throw error;
        setSuccessMsg("✅ Cuenta creada correctamente. Bienvenido a Asternal!");
        setTimeout(() => navigate({ to: "/" }), 600);
      } else {
        if (!email.trim() || !password) {
          setErr("Completa todos los campos");
          setBusy(false);
          return;
        }
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/" });
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen w-screen flex flex-col bg-background overflow-hidden">
      {/* Decorative gradient blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none select-none">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-gradient-to-br from-primary/8 to-accent/6 blur-[120px]" />
        <div className="absolute -bottom-32 -left-32 w-[400px] h-[400px] rounded-full bg-gradient-to-tr from-accent/6 to-primary/8 blur-[100px]" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[200px] bg-gradient-to-r from-primary/4 via-accent/4 to-primary/4 blur-[80px] rounded-full" />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-5 py-4">
        <Link
          to="/"
          className="group flex items-center gap-2 text-xs font-display tracking-widest text-muted-foreground/70 hover:text-foreground transition-colors duration-300"
        >
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-accent grid place-items-center shadow-sm group-hover:shadow-md transition-shadow">
            <Gamepad2 size={13} className="text-white" />
          </div>
          <span className="hidden sm:inline">VOLVER AL MOTOR</span>
          <span className="sm:hidden">← VOLVER</span>
        </Link>

        <div className="flex items-center gap-2">
          <Sparkles size={13} className="text-primary" />
          <span className="font-display text-sm font-semibold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            ASTERNAL
          </span>
        </div>

        <div className="w-20" />
      </header>

      {/* Main content */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-6">
        <div className="w-full max-w-sm">
          {/* Card */}
          <div className="bg-white/90 backdrop-blur-xl rounded-3xl border border-white/40 shadow-xl shadow-primary/5 p-8 relative overflow-hidden">
            {/* Card top accent line */}
            <div className="absolute top-0 left-8 right-8 h-[2px] bg-gradient-to-r from-primary/0 via-primary/60 to-primary/0 rounded-full" />

            {/* Logo area */}
            <div className="text-center mb-7">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/25 mb-4">
                <Gamepad2 size={26} className="text-white" />
              </div>
              <h1 className="text-xl font-display font-bold text-foreground">
                {mode === "signin" ? "Bienvenido de vuelta" : "Crear cuenta"}
              </h1>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                {mode === "signin"
                  ? "Inicia sesión para acceder a tu contenido"
                  : "Regístrate y empieza a crear juegos"}
              </p>
            </div>

            {/* Tab selector */}
            <div className="flex bg-muted/60 rounded-2xl p-1 mb-6">
              <button
                type="button"
                onClick={() => setMode("signin")}
                className={`flex-1 py-2.5 rounded-xl text-xs font-display font-semibold tracking-wider transition-all duration-300 ${
                  mode === "signin"
                    ? "bg-white text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                INICIAR SESIÓN
              </button>
              <button
                type="button"
                onClick={() => setMode("signup")}
                className={`flex-1 py-2.5 rounded-xl text-xs font-display font-semibold tracking-wider transition-all duration-300 ${
                  mode === "signup"
                    ? "bg-white text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                CREAR CUENTA
              </button>
            </div>

            {/* Form */}
            <form onSubmit={onSubmit} className="space-y-4">
              {/* Username field (signup only) */}
              {mode === "signup" && (
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-semibold text-muted-foreground tracking-wider uppercase px-1">
                    Nombre de usuario
                  </label>
                  <div className="relative group">
                    <User
                      size={16}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 group-focus-within:text-primary transition-colors duration-300"
                    />
                    <input
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      placeholder="tu_usuario"
                      maxLength={32}
                      autoComplete="username"
                      className="w-full bg-muted/40 border border-border/60 rounded-2xl pl-10 pr-3.5 py-3 text-sm outline-none transition-all duration-300 placeholder:text-muted-foreground/40 focus:border-primary/50 focus:bg-muted/20 focus:ring-2 focus:ring-primary/10"
                    />
                  </div>
                </div>
              )}

              {/* Email field */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-muted-foreground tracking-wider uppercase px-1">
                  Correo electrónico
                </label>
                <div className="relative group">
                  <Mail
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 group-focus-within:text-primary transition-colors duration-300"
                  />
                  <input
                    ref={emailRef}
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="email@ejemplo.com"
                    required
                    autoComplete="email"
                    className="w-full bg-muted/40 border border-border/60 rounded-2xl pl-10 pr-3.5 py-3 text-sm outline-none transition-all duration-300 placeholder:text-muted-foreground/40 focus:border-primary/50 focus:bg-muted/20 focus:ring-2 focus:ring-primary/10"
                  />
                </div>
              </div>

              {/* Password field */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-muted-foreground tracking-wider uppercase px-1">
                  Contraseña
                </label>
                <div className="relative group">
                  <Lock
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 group-focus-within:text-primary transition-colors duration-300"
                  />
                  <input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder={mode === "signup" ? "Mínimo 6 caracteres" : "Tu contraseña"}
                    required
                    minLength={6}
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    className="w-full bg-muted/40 border border-border/60 rounded-2xl pl-10 pr-10 py-3 text-sm outline-none transition-all duration-300 placeholder:text-muted-foreground/40 focus:border-primary/50 focus:bg-muted/20 focus:ring-2 focus:ring-primary/10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Error message */}
              {err && (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-destructive/8 border border-destructive/20 text-xs text-destructive font-medium animate-[scale-in_200ms_ease-out]">
                  <div className="w-5 h-5 rounded-full bg-destructive/10 grid place-items-center shrink-0">
                    <span className="text-[10px] font-bold">!</span>
                  </div>
                  {err}
                </div>
              )}

              {/* Success message */}
              {successMsg && (
                <div className="px-4 py-2.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 font-medium animate-[scale-in_200ms_ease-out]">
                  {successMsg}
                </div>
              )}

              {/* Submit button */}
              <button
                disabled={busy}
                className="relative w-full py-3.5 rounded-2xl bg-gradient-to-r from-primary to-accent text-white font-display font-semibold text-sm tracking-wider shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg overflow-hidden group"
              >
                {busy ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    {mode === "signin" ? "Entrando..." : "Creando cuenta..."}
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    {mode === "signin" ? "INICIAR SESIÓN" : "CREAR CUENTA"}
                    <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
                  </span>
                )}
              </button>

              {/* Forgot password link */}
              {mode === "signin" && (
                <div className="text-center">
                  <button
                    type="button"
                    onClick={async () => {
                      if (!email.trim()) { setErr("Escribe tu email arriba primero"); return; }
                      setBusy(true); setErr(null); setSuccessMsg(null);
                      try {
                        const { error } = await supabase.auth.resetPasswordForEmail(email);
                        if (error) throw error;
                        setSuccessMsg("✉️ Si el email existe, recibirás instrucciones para restablecer tu contraseña");
                      } catch (e) { setErr((e as Error).message); }
                      finally { setBusy(false); }
                    }}
                    className="text-[11px] text-muted-foreground/70 hover:text-primary transition-colors duration-300 underline underline-offset-2 decoration-dotted"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
              )}
            </form>
          </div>

          {/* Footer info */}
          <div className="mt-5 text-center">
            <p className="text-[10px] text-muted-foreground/50 flex items-center justify-center gap-1.5">
              <span className="inline-block w-1 h-1 rounded-full bg-primary/30" />
              Tus datos se guardan localmente en el navegador
              <span className="inline-block w-1 h-1 rounded-full bg-primary/30" />
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
