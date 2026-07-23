import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Gamepad2, Mail, Lock, User, Eye, EyeOff, ArrowRight, Loader2,
  Sparkles, Globe, Palette, Users, Share2, Trophy, Star,
  Code, Zap, Layers, Paintbrush, Lightbulb, Rocket, HeartHandshake,
  ChevronRight, MousePointer2, Wand2, Shirt, Play, Music, ArrowUpRight
} from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Asternal — Donde los juegos cobran vida" }] }),
  component: AuthPage,
});

/* ─── Cursor Glow ─── */
function CursorGlow() {
  const [pos, setPos] = useState({ x: -200, y: -200 });
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      setPos({ x: e.clientX, y: e.clientY });
      if (!visible) setVisible(true);
    };
    const onLeave = () => setVisible(false);
    const onEnter = () => setVisible(true);
    window.addEventListener("mousemove", onMove);
    document.addEventListener("mouseleave", onLeave);
    document.addEventListener("mouseenter", onEnter);
    return () => {
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("mouseenter", onEnter);
    };
  }, [visible]);

  return (
    <div
      className="fixed pointer-events-none select-none z-[9999] transition-opacity duration-500"
      style={{
        left: pos.x - 150,
        top: pos.y - 150,
        width: 300,
        height: 300,
        opacity: visible ? 0.25 : 0,
        background: "radial-gradient(circle, oklch(0.488 0.185 264 / 0.15), transparent 65%)",
        willChange: "left, top",
      }}
    />
  );
}

/* ─── Confetti particles ─── */
function ConfettiBurst({ active }: { active: boolean }) {
  const particles = useMemo(() =>
    Array.from({ length: 50 }).map((_, i) => ({
      id: i,
      x: 50 + (Math.random() - 0.5) * 30,
      delay: Math.random() * 0.3,
      duration: 1.2 + Math.random() * 0.8,
      color: [
        "oklch(0.488 0.185 264)",
        "oklch(0.72 0.11 260)",
        "oklch(0.65 0.2 150)",
        "oklch(0.85 0.2 85)",
        "oklch(0.75 0.2 330)",
        "oklch(1 0.3 50)",
      ][i % 6],
      size: 5 + Math.random() * 6,
      rotation: Math.random() * 360,
      drift: (Math.random() - 0.5) * 60,
    })),
  []);
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
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute rounded-sm"
          style={{
            left: `${p.x}%`,
            top: "45%",
            width: p.size,
            height: p.size * 0.6,
            background: p.color,
            animation: `confetti-fall ${p.duration}s ease-out ${p.delay}s both`,
            transform: `rotate(${p.rotation}deg)`,
            borderRadius: Math.random() > 0.5 ? "50%" : "2px",
          }}
        />
      ))}
      {/* Inner burst flash */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0 h-0 animate-confetti-flash rounded-full"
        style={{
          boxShadow: "0 0 120px 60px oklch(0.488 0.185 264 / 0.25), 0 0 200px 100px oklch(0.72 0.11 260 / 0.15)",
        }}
      />
    </div>
  );
}

/* ─── Parallax layer (tracks mouse) ─── */
function useParallax(intensity = 0.03) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      setOffset({
        x: (e.clientX - cx) * intensity,
        y: (e.clientY - cy) * intensity,
      });
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [intensity]);
  return offset;
}

/* ─── 3D Tilt Card ─── */
function TiltCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [rot, setRot] = useState({ x: 0, y: 0 });
  const [hover, setHover] = useState(false);

  const onMove = useCallback((e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setRot({ x: (y - 0.5) * -12, y: (x - 0.5) * 12 });
  }, []);
  const onLeave = useCallback(() => {
    setRot({ x: 0, y: 0 });
    setHover(false);
  }, []);
  const onEnter = useCallback(() => setHover(true), []);

  return (
    <div
      ref={cardRef}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onMouseEnter={onEnter}
      className={className}
      style={{
        perspective: "1200px",
      }}
    >
      <div
        style={{
          transform: `rotateX(${rot.x}deg) rotateY(${rot.y}deg)`,
          transition: hover
            ? "transform 0.12s cubic-bezier(0.22, 1, 0.36, 1)"
            : "transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        {/* Shine layer */}
        <div
          className="absolute inset-0 pointer-events-none rounded-3xl opacity-0 transition-opacity duration-300"
          style={{
            opacity: hover ? 0.4 : 0,
            background: `radial-gradient(
              circle at ${50 + rot.y * 2}% ${50 - rot.x * 2}%,
              oklch(1 1 300 / 0.15),
              transparent 60%
            )`,
          }}
        />
        {children}
      </div>
    </div>
  );
}

/* ─── Animated Particle ─── */
function Particle({ index }: { index: number }) {
  const size = 2 + (index % 3) * 2;
  const x = `${(index * 17 + 5) % 100}%`;
  const y = `${(index * 23 + 11) % 100}%`;
  const delay = (index % 8) * 0.7;
  const duration = 4 + (index % 4);
  return (
    <div
      className="absolute rounded-full pointer-events-none"
      style={{
        width: size, height: size,
        left: x, top: y,
        animation: `float-particle ${duration}s ease-in-out ${delay}s infinite`,
        background: index % 3 === 0
          ? "linear-gradient(135deg, oklch(0.72 0.11 260 / 0.3), oklch(0.488 0.185 264 / 0.2))"
          : index % 3 === 1
            ? "linear-gradient(135deg, oklch(0.488 0.185 264 / 0.25), oklch(0.62 0.15 250 / 0.15))"
            : "linear-gradient(135deg, oklch(0.78 0.09 240 / 0.2), oklch(0.72 0.11 260 / 0.1))",
        boxShadow: `0 0 ${size * 4}px ${index % 3 === 0 ? 'oklch(0.72 0.11 260 / 0.08)' : index % 3 === 1 ? 'oklch(0.488 0.185 264 / 0.08)' : 'oklch(0.78 0.09 240 / 0.06)'}`,
      }}
    />
  );
}

/* ─── Floating Icon (with parallax) ─── */
function FloatIcon({ icon: Icon, className, delay = 0, size = 18, px = 0, py = 0 }: { icon: React.ElementType; className?: string; delay?: number; size?: number; px?: number; py?: number }) {
  const parallax = useParallax(0.015);
  return (
    <div
      className={`absolute pointer-events-none select-none ${className}`}
      style={{
        animation: `float-icon 6s ease-in-out ${delay}s infinite`,
        transform: `translate(${parallax.x + px}px, ${parallax.y + py}px)`,
        willChange: "transform",
      }}
    >
      <div className="relative">
        <Icon size={size} className="text-primary/20" />
        <div className="absolute inset-0 blur-sm">
          <Icon size={size} className="text-primary/10" />
        </div>
      </div>
    </div>
  );
}

/* ─── Interactive Mini Game Scene ─── */
function InteractiveScene() {
  const [jump, setJump] = useState(false);
  const [pos, setPos] = useState(25);
  const [dir, setDir] = useState(1);
  const [coins, setCoins] = useState([35, 62]);
  const [collected, setCollected] = useState<number[]>([]);
  const coinRef1 = useRef<HTMLDivElement>(null);
  const coinRef2 = useRef<HTMLDivElement>(null);

  // Auto-walk character
  useEffect(() => {
    const t = setInterval(() => {
      setPos(p => {
        const next = p + dir * 0.6;
        if (next > 72) { setDir(-1); return 72; }
        if (next < 18) { setDir(1); return 18; }
        return next;
      });
    }, 40);
    return () => clearInterval(t);
  }, [dir]);

  // Check coin collection
  useEffect(() => {
    coins.forEach((coinPos, i) => {
      if (!collected.includes(i) && Math.abs(pos - coinPos) < 8) {
        setCollected(c => [...c, i]);
      }
    });
  }, [pos, coins, collected]);

  const handleClick = () => {
    setJump(true);
    setTimeout(() => setJump(false), 500);
  };

  return (
    <div
      className="relative w-full max-w-xs mx-auto h-[140px] rounded-2xl overflow-hidden border border-border/40 bg-gradient-to-b from-sky-50/60 to-indigo-50/40 shadow-inner mb-5 cursor-pointer group/scene"
      onClick={handleClick}
    >
      {/* Sky gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-sky-100/40 via-indigo-50/20 to-white/40" />

      {/* Twinkling stars */}
      <div className="absolute top-2 left-4 w-1.5 h-1.5 rounded-full bg-amber-300/60 animate-pulse" style={{ animationDelay: '0.5s', animationDuration: '1.8s' }} />
      <div className="absolute top-3 right-8 w-1 h-1 rounded-full bg-amber-300/40 animate-pulse" style={{ animationDelay: '1.2s', animationDuration: '2.2s' }} />
      <div className="absolute top-5 left-12 w-1 h-1 rounded-full bg-amber-300/50 animate-pulse" style={{ animationDelay: '0.8s', animationDuration: '1.5s' }} />
      <div className="absolute top-1 right-16 w-0.5 h-0.5 rounded-full bg-amber-300/70 animate-pulse" style={{ animationDelay: '0.3s', animationDuration: '2.5s' }} />
      <div className="absolute top-4 right-4 w-1 h-1 rounded-full bg-amber-300/30 animate-pulse" style={{ animationDelay: '1.8s', animationDuration: '2s' }} />

      {/* Cloud */}
      <div className="absolute top-3 right-[20%] flex gap-1 animate-[float-icon_8s_ease-in-out_infinite]">
        <div className="w-8 h-3 rounded-full bg-white/50" />
        <div className="w-5 h-3 rounded-full bg-white/40 -ml-2" />
      </div>

      {/* Mountains in background */}
      <svg className="absolute bottom-[30%] left-0 right-0 h-[40%] opacity-20" preserveAspectRatio="none" viewBox="0 0 200 40">
        <path d="M0 40 L20 8 L40 25 L60 5 L90 22 L110 2 L140 20 L160 10 L180 28 L200 15 L200 40 Z" fill="oklch(0.62 0.15 250 / 0.15)" />
      </svg>

      {/* Ground */}
      <div className="absolute bottom-0 left-0 right-0 h-[32%] bg-gradient-to-t from-emerald-200/60 via-emerald-100/40 to-transparent" />
      <div className="absolute bottom-[30%] left-0 right-0 h-[5px] bg-gradient-to-r from-emerald-300/50 via-emerald-400/40 to-emerald-300/50" />

      {/* Grass tufts */}
      <div className="absolute bottom-[32%] left-[10%] w-2 h-3 rounded-b-full bg-emerald-300/40" />
      <div className="absolute bottom-[32%] left-[45%] w-1.5 h-2.5 rounded-b-full bg-emerald-300/30" />
      <div className="absolute bottom-[32%] right-[20%] w-2 h-3 rounded-b-full bg-emerald-300/40" />

      {/* Platforms */}
      <div className="absolute bottom-[45%] left-[15%] w-[30%] h-[5px] rounded-sm bg-gradient-to-r from-stone-400/60 to-stone-300/50" />
      <div className="absolute bottom-[55%] right-[18%] w-[22%] h-[4px] rounded-sm bg-gradient-to-r from-stone-400/50 to-stone-300/40" />

      {/* Coins */}
      {coins.map((coinPos, i) => !collected.includes(i) && (
        <div
          key={i}
          ref={i === 0 ? coinRef1 : coinRef2}
          className="absolute animate-pulse"
          style={{
            bottom: i === 0 ? "50%" : "60%",
            left: `${coinPos}%`,
            animationDelay: `${i * 0.4}s`,
            animationDuration: '1.2s',
          }}
        >
          <div className="w-4 h-4 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 shadow-sm shadow-amber-400/40 flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-200/60" />
          </div>
        </div>
      ))}

      {/* Collectible sparkle on collected coin */}
      {collected.map((_, i) => (
        <div
          key={`sparkle-${i}`}
          className="absolute text-[10px] pointer-events-none animate-coin-collect"
          style={{
            bottom: i === 0 ? "50%" : "60%",
            left: i === 0 ? "35%" : "62%",
            color: "oklch(0.85 0.2 85)",
          }}
        >
          ✦
        </div>
      ))}

      {/* Character */}
      <div
        className="absolute z-10 transition-all duration-75"
        style={{
          bottom: jump ? "52%" : "32%",
          left: `${pos}%`,
          transform: `scaleX(${dir})`,
        }}
      >
        <div className={`w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/30 relative transition-all duration-200 ${jump ? 'rounded-b-sm' : 'rounded-lg'}`}>
          {/* Eyes */}
          <div className="absolute top-1.5 left-1 w-1.5 h-1.5 rounded-full bg-white/90" />
          <div className="absolute top-1.5 right-1 w-1.5 h-1.5 rounded-full bg-white/90" />
          {/* Mouth */}
          <div className={`absolute bottom-1.5 left-1/2 -translate-x-1/2 w-2 h-1 rounded-b-full bg-white/70 transition-all ${jump ? 'h-2 w-3' : ''}`} />
          {/* Hat */}
          <div className="absolute -top-2 -left-0.5 -right-0.5 h-2 rounded-t-md bg-gradient-to-r from-accent/80 to-primary/60" />
        </div>
      </div>

      {/* Shadows under character */}
      <div
        className="absolute z-0 w-5 h-1.5 rounded-full bg-black/10 blur-sm transition-all duration-200"
        style={{
          bottom: "30%",
          left: `calc(${pos}% - 6px)`,
          opacity: jump ? 0.3 : 0.6,
          width: jump ? 8 : 20,
        }}
      />

      {/* Click hint */}
      <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-white/70 backdrop-blur-sm border border-white/50 text-[7px] font-mono text-muted-foreground/50 shadow-sm flex items-center gap-1 opacity-0 group-hover/scene:opacity-100 transition-opacity">
        <MousePointer2 size={8} className="text-primary/50" />
        ¡TOCA!
      </div>

      {/* Editor badge */}
      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-white/70 backdrop-blur-sm border border-white/50 text-[8px] font-mono text-muted-foreground/60 shadow-sm flex items-center gap-1">
        <Wand2 size={9} className="text-primary/60" />
        ESCENA INTERACTIVA
      </div>

      {/* Grid overlay */}
      <svg className="absolute bottom-0 left-0 right-0 h-[32%] opacity-[0.06]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="scene-grid" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
            <path d="M 8 0 L 0 0 0 8" fill="none" stroke="oklch(0.488 0.185 264)" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#scene-grid)" />
      </svg>
    </div>
  );
}

/* ─── Step Indicator ─── */
function StepIndicator({ num, label, desc, active }: { num: number; label: string; desc: string; active: boolean }) {
  return (
    <div className={`flex items-start gap-3 transition-all duration-500 ${active ? 'opacity-100 scale-100' : 'opacity-30 scale-95'}`}>
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-display font-bold shrink-0 transition-all duration-500 ${
        active
          ? 'bg-gradient-to-br from-primary to-accent text-white shadow-md shadow-primary/20 scale-110'
          : 'bg-muted/50 text-muted-foreground/40 border border-border/30'
      }`}>
        {active ? (
          <span className="animate-[scale-in_300ms_ease-out]">{num}</span>
        ) : num}
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-display font-semibold text-foreground">{label}</div>
        <div className="text-[10px] text-muted-foreground/60 leading-relaxed">{desc}</div>
      </div>
    </div>
  );
}

/* ─── Feature Card ─── */
const FEATURES = [
  { icon: Palette, title: "Editor Visual", desc: "Dibuja sprites, anima personajes y diseña escenarios con herramientas intuitivas." },
  { icon: Code, title: "Programación Visual", desc: "Crea la lógica de tu juego conectando bloques visuales. Sin código, con poder infinito." },
  { icon: Share2, title: "Publicación Instantánea", desc: "Comparte tus juegos con la comunidad en un clic. Todos juegan al instante." },
  { icon: Users, title: "Comunidad Creativa", desc: "Comenta, reacciona, remixa y descubre juegos de cientos de creadores." },
];

/* ─── Rotating Feature ─── */
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
    }, 4200);
    return () => clearInterval(t);
  }, []);

  const feat = FEATURES[idx];
  return (
    <div className="relative w-full max-w-sm mx-auto h-[72px] overflow-hidden">
      <div
        className={`absolute inset-0 flex items-center gap-3 px-3.5 py-2.5 rounded-2xl border border-primary/15 bg-gradient-to-r from-primary/[0.07] to-accent/[0.07] backdrop-blur-sm transition-all duration-500 ${
          visible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-3 scale-95"
        }`}
      >
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/15 to-accent/15 grid place-items-center shrink-0 shadow-sm ring-1 ring-primary/5">
          <feat.icon size={17} className="text-primary" />
        </div>
        <div className="min-w-0 text-left flex-1">
          <div className="text-xs font-display font-semibold text-foreground flex items-center gap-1.5">
            {feat.title}
            <span className="inline-block w-1 h-1 rounded-full bg-primary/40 animate-pulse" style={{ animationDuration: '1.4s' }} />
          </div>
          <div className="text-[10px] text-muted-foreground/65 leading-relaxed mt-0.5 line-clamp-1">{feat.desc}</div>
        </div>
      </div>
    </div>
  );
}

/* ─── Floating Code Blocks ─── */
function FloatingCodeBlock({ className, delay = 0 }: { className?: string; delay?: number }) {
  const parallax = useParallax(0.02);
  return (
    <div
      className={`absolute pointer-events-none select-none ${className}`}
      style={{
        animation: `float-icon 7s ease-in-out ${delay}s infinite`,
        transform: `translate(${parallax.x}px, ${parallax.y}px)`,
        willChange: "transform",
      }}
    >
      <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/60 backdrop-blur-sm border border-primary/10 shadow-sm">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/60" />
        <div className="w-1.5 h-1.5 rounded-full bg-amber-400/60" />
        <div className="w-1.5 h-1.5 rounded-full bg-rose-400/60" />
        <span className="text-[7px] font-mono text-muted-foreground/40 ml-1">if (jump) →</span>
      </div>
    </div>
  );
}

/* ─── Animated Geometry Shape ─── */
function GeometryShape({ className, delay = 0, type = "hex" }: { className?: string; delay?: number; type?: "hex" | "circle" | "diamond" }) {
  const parallax = useParallax(0.025);
  const shapes = {
    hex: (
      <svg width="28" height="32" viewBox="0 0 28 32" fill="none">
        <path d="M14 0L28 8V24L14 32L0 24V8L14 0Z" stroke="oklch(0.488 0.185 264 / 0.15)" strokeWidth="1" fill="oklch(0.488 0.185 264 / 0.04)" />
      </svg>
    ),
    circle: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="oklch(0.72 0.11 260 / 0.12)" strokeWidth="1" fill="oklch(0.72 0.11 260 / 0.04)" />
      </svg>
    ),
    diamond: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M10 0L20 10L10 20L0 10L10 0Z" stroke="oklch(0.62 0.15 250 / 0.12)" strokeWidth="1" fill="oklch(0.62 0.15 250 / 0.04)" />
      </svg>
    ),
  };
  return (
    <div
      className={`absolute pointer-events-none select-none ${className}`}
      style={{
        animation: `float-icon 9s ease-in-out ${delay}s infinite, rotate-gentle 12s linear infinite`,
        transform: `translate(${parallax.x}px, ${parallax.y}px)`,
        willChange: "transform",
      }}
    >
      {shapes[type]}
    </div>
  );
}

/* ─── Form Content (animated between modes) ─── */
function FormContent({ mode, direction }: { mode: "signin" | "signup"; direction: "left" | "right" }) {
  return (
    <div
      key={mode}
      className="animate-form-slide"
      style={{
        animationName: direction === "right" ? "slide-in-right" : "slide-in-left",
        animationDuration: "350ms",
        animationTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
        animationFillMode: "both",
      }}
    >
      <div className="text-center mb-5">
        <div className="inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/20 mb-3">
          {mode === "signin" ? (
            <Gamepad2 size={20} className="text-white" />
          ) : (
            <Trophy size={20} className="text-white" />
          )}
        </div>
        <h2 className="text-lg font-display font-bold text-foreground">
          {mode === "signin" ? "Bienvenido de vuelta" : "Únete a la comunidad"}
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {mode === "signin" ? "Inicia sesión para seguir creando" : "Crea tu cuenta y empieza"}
        </p>
      </div>
    </div>
  );
}

/* ─── Main Component ─── */
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
  const [activeStep, setActiveStep] = useState(0);
  const [formDir, setFormDir] = useState<"left" | "right">("right");
  const [showConfetti, setShowConfetti] = useState(false);
  const fullLine = "crear, publicar y compartir";
  const emailRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

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
    }, 42);
    return () => clearInterval(t);
  }, [loaded]);

  // Step carousel
  useEffect(() => {
    if (!loaded) return;
    const t = setInterval(() => {
      setActiveStep(s => (s + 1) % 3);
    }, 3500);
    return () => clearInterval(t);
  }, [loaded]);

  useEffect(() => {
    setTimeout(() => emailRef.current?.focus(), 150);
  }, [mode]);

  // Confetti effect trigger
  useEffect(() => {
    if (successMsg) {
      setShowConfetti(true);
      const t = setTimeout(() => setShowConfetti(false), 2500);
      return () => clearTimeout(t);
    }
  }, [successMsg]);

  const switchMode = (m: "signin" | "signup") => {
    setFormDir(m === "signin" ? "left" : "right");
    setMode(m);
    setErr(null);
  };

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
        setTimeout(() => navigate({ to: "/" }), 900);
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
      {/* ─── Cursor Glow ─── */}
      <CursorGlow />

      {/* ─── Confetti ─── */}
      <ConfettiBurst active={showConfetti} />

      {/* ─── Background ─── */}
      <div className="fixed inset-0 pointer-events-none select-none overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,oklch(0.488_0.185_264/0.08),transparent)]" />
        <div className="absolute -top-1/2 -left-1/2 w-full h-full animate-mesh-grad rounded-full"
          style={{ background: "radial-gradient(circle at 30% 50%, oklch(0.488 0.185 264 / 0.07), transparent 60%)" }} />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full animate-mesh-grad-alt rounded-full"
          style={{ background: "radial-gradient(circle at 70% 50%, oklch(0.72 0.11 260 / 0.07), transparent 60%)" }} />

        <svg className="absolute inset-0 w-full h-full opacity-[0.025]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="auth-dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="0.8" fill="oklch(0.488 0.185 264)" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#auth-dots)" />
        </svg>
      </div>

      {/* ─── Particles ─── */}
      {Array.from({ length: 25 }).map((_, i) => <Particle key={i} index={i} />)}

      {/* ─── Floating Elements with Parallax ─── */}
      <FloatIcon icon={Sparkles} className="top-[10%] left-[3%]" delay={0} size={16} px={0} py={0} />
      <FloatIcon icon={Code} className="top-[20%] right-[5%]" delay={1.5} size={18} px={8} py={-4} />
      <FloatIcon icon={Layers} className="bottom-[35%] left-[4%]" delay={0.8} size={16} px={-4} py={6} />
      <FloatIcon icon={Zap} className="bottom-[20%] right-[6%]" delay={2.2} size={15} px={6} py={-2} />
      <FloatIcon icon={Star} className="top-[45%] left-[1%]" delay={3} size={14} px={-2} py={-4} />
      <FloatIcon icon={Lightbulb} className="top-[6%] right-[2%]" delay={0.4} size={16} px={4} py={2} />
      <FloatIcon icon={Rocket} className="bottom-[12%] left-[8%]" delay={1.8} size={15} px={-6} py={4} />
      <FloatIcon icon={Paintbrush} className="top-[32%] right-[3%]" delay={2.8} size={14} px={5} py={-3} />

      {/* ─── Geometric shapes ─── */}
      <GeometryShape type="hex" className="top-[15%] left-[12%]" delay={0.5} />
      <GeometryShape type="circle" className="bottom-[25%] right-[12%]" delay={1.2} />
      <GeometryShape type="diamond" className="top-[55%] left-[7%]" delay={2} />

      <FloatingCodeBlock className="top-[18%] right-[10%]" delay={1} />
      <FloatingCodeBlock className="bottom-[28%] left-[8%]" delay={2.5} />
      <FloatingCodeBlock className="top-[55%] right-[5%]" delay={0.5} />

      {/* ─────── LEFT: HERO ─────── */}
      <div className="relative z-10 lg:w-1/2 w-full lg:min-h-screen flex flex-col justify-center items-center px-5 py-8 lg:py-0 lg:px-10">
        <div className={`flex flex-col items-center text-center max-w-lg transition-all duration-700 ${loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {/* Back link */}
          <Link to="/" className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/70 border border-primary/10 text-[10px] font-display tracking-wider text-muted-foreground hover:text-primary hover:bg-primary/5 hover:border-primary/20 transition-all mb-6 backdrop-blur-sm shadow-sm">
            <Gamepad2 size={12} className="text-primary" />
            <span>VOLVER AL MOTOR</span>
            <ChevronRight size={10} className="text-muted-foreground/40 group-hover:translate-x-0.5 transition-transform" />
          </Link>

          {/* Interactive Scene */}
          <InteractiveScene />

          {/* Logo + Title */}
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-accent shadow-xl shadow-primary/30 grid place-items-center group/logo">
              <Gamepad2 size={28} className="text-white group-hover/logo:scale-110 transition-transform duration-300" />
            </div>
            <div className="text-left">
              <h1 className="text-3xl font-display font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent bg-[length:200%_100%] animate-shimmer-text">
                Asternal
              </h1>
              <p className="text-[10px] text-muted-foreground/50 font-mono tracking-[0.25em] uppercase">Motor de juegos · Comunidad</p>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-4 mb-5">
            <p className="text-base leading-relaxed text-foreground/85 font-display font-medium">
              Una <strong className="text-primary">plataforma social interactiva</strong> donde puedes{' '}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent font-bold relative">
                {typedLine}
                <span className="inline-block w-[2px] h-[1.1em] bg-primary ml-0.5 align-middle animate-pulse rounded-sm" />
              </span>{' '}
              tus propios juegos desde cero.
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground/75">
              Diseña personajes, construye escenarios, programa con bloques y añade animaciones — 
              todo en el navegador. Luego publícalo al instante.
            </p>
          </div>

          {/* Rotating feature card */}
          <RotatingFeature />

          {/* Steps */}
          <div className="w-full max-w-sm mx-auto mt-5 mb-5 space-y-3">
            <div className="flex items-center gap-2 text-[9px] text-muted-foreground/40 font-mono tracking-wider mb-2">
              <span className="flex-1 h-px bg-border/40" />
              CÓMO EMPEZAR
              <span className="flex-1 h-px bg-border/40" />
            </div>
            <StepIndicator
              num={1}
              label="Crea tu cuenta"
              desc="Regístrate en segundos y accede al editor"
              active={activeStep === 0}
            />
            <StepIndicator
              num={2}
              label="Diseña tu juego"
              desc="Usa las herramientas visuales para crear"
              active={activeStep === 1}
            />
            <StepIndicator
              num={3}
              label="Publícalo al mundo"
              desc="Compártelo con la comunidad en un clic"
              active={activeStep === 2}
            />
          </div>

          {/* Separator */}
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground/30 font-mono">
            <span className="w-6 h-px bg-border/40" />
            <span className="tracking-[0.15em]">COMENZAR</span>
            <span className="w-6 h-px bg-border/40" />
          </div>
        </div>
      </div>

      {/* ─────── RIGHT: AUTH ─────── */}
      <div className="relative z-10 lg:w-1/2 w-full lg:min-h-screen flex items-center justify-center px-4 py-8 lg:py-0">
        {/* Vertical separator */}
        <div className="hidden lg:block absolute left-0 top-[10%] bottom-[10%] w-px bg-gradient-to-b from-transparent via-border/40 to-transparent" />

        <div className={`w-full max-w-sm transition-all duration-700 delay-[400ms] ${loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>

          {/* ─── 3D TILT FORM CARD ─── */}
          <TiltCard>
            <div
              ref={cardRef}
              className="bg-white/70 backdrop-blur-2xl rounded-3xl border border-white/60 shadow-2xl shadow-primary/10 p-7 relative overflow-hidden group/card"
            >
              {/* Shimmer border effect */}
              <div className="absolute inset-0 rounded-3xl p-[1px] pointer-events-none opacity-0 group-hover/card:opacity-100 transition-opacity duration-1000">
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-transparent via-primary/20 via-accent/20 to-transparent bg-[length:200%_100%] animate-shimmer-border" />
              </div>

              {/* Shine overlay */}
              <div className="absolute inset-0 rounded-3xl pointer-events-none opacity-0 group-hover/card:opacity-100 transition-opacity duration-1000"
                style={{
                  background: "radial-gradient(ellipse at 30% 20%, oklch(0.488 0.185 264 / 0.04), transparent 60%)",
                }}
              />

              {/* Top accent bar */}
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-primary/50 via-accent/40 to-transparent" />

              {/* Header */}
              <div key={mode} className="text-center mb-5 animate-form-slide"
                style={{
                  animation: `${formDir === "right" ? "slide-in-right" : "slide-in-left"} 350ms cubic-bezier(0.22,1,0.36,1) both`,
                }}
              >
                <div className={`inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/20 mb-3 transition-all duration-500 ${loaded ? 'scale-100 rotate-0' : 'scale-0 -rotate-180'}`}>
                  {mode === "signin" ? (
                    <Gamepad2 size={20} className="text-white" />
                  ) : (
                    <Trophy size={20} className="text-white" />
                  )}
                </div>
                <h2 className="text-lg font-display font-bold text-foreground">
                  {mode === "signin" ? "Bienvenido de vuelta" : "Únete a la comunidad"}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {mode === "signin" ? "Inicia sesión para seguir creando" : "Crea tu cuenta y empieza"}
                </p>
              </div>

              {/* Tabs */}
              <div className="flex bg-muted/70 rounded-xl p-1 mb-5 relative">
                {/* Sliding indicator */}
                <div
                  className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg bg-white shadow-sm transition-all duration-300 ease-out-expo"
                  style={{ left: mode === "signin" ? "4px" : "calc(50% + 0px)" }}
                />
                {(["signin", "signup"] as const).map(m => (
                  <button key={m} type="button" onClick={() => switchMode(m)}
                    className={`relative flex-1 py-2 rounded-lg text-[11px] font-display font-semibold tracking-wider transition-all duration-300 z-10 ${
                      mode === m
                        ? "text-foreground scale-[1.02]"
                        : "text-muted-foreground/60 hover:text-foreground"
                    }`}
                  >
                    {m === "signin" ? "INICIAR SESIÓN" : "CREAR CUENTA"}
                  </button>
                ))}
              </div>

              {/* Form */}
              <form onSubmit={onSubmit} className="space-y-3">
                {/* Username field (animated entrance) */}
                {mode === "signup" && (
                  <div className="space-y-1 animate-form-slide"
                    style={{
                      animation: "slide-in-up 300ms cubic-bezier(0.22,1,0.36,1) both",
                    }}
                  >
                    <label className="text-[10px] font-semibold text-muted-foreground tracking-wider uppercase px-1 flex items-center gap-1">
                      <User size={11} className="text-primary/60" /> Usuario
                    </label>
                    <div className="relative group/field">
                      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/[0.04] to-accent/[0.04] opacity-0 group-focus-within/field:opacity-100 transition-opacity duration-500" />
                      <input value={username} onChange={e => setUsername(e.target.value)}
                        placeholder="tu_usuario" maxLength={32} autoComplete="username"
                        className="relative w-full bg-muted/30 border border-border/60 rounded-xl px-3.5 py-2.5 text-sm outline-none transition-all duration-300 placeholder:text-muted-foreground/30 focus:border-primary/50 focus:bg-white focus:ring-2 focus:ring-primary/8 focus:shadow-lg focus:shadow-primary/5" />
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground tracking-wider uppercase px-1 flex items-center gap-1">
                    <Mail size={11} className="text-primary/60" /> Email
                  </label>
                  <div className="relative group/field">
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/[0.04] to-accent/[0.04] opacity-0 group-focus-within/field:opacity-100 transition-opacity duration-500" />
                    <input ref={emailRef} type="email" value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="email@ejemplo.com" required autoComplete="email"
                      className="relative w-full bg-muted/30 border border-border/60 rounded-xl px-3.5 py-2.5 text-sm outline-none transition-all duration-300 placeholder:text-muted-foreground/30 focus:border-primary/50 focus:bg-white focus:ring-2 focus:ring-primary/8 focus:shadow-lg focus:shadow-primary/5" />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground tracking-wider uppercase px-1 flex items-center gap-1">
                    <Lock size={11} className="text-primary/60" /> Contraseña
                  </label>
                  <div className="relative group/field">
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/[0.04] to-accent/[0.04] opacity-0 group-focus-within/field:opacity-100 transition-opacity duration-500" />
                    <input type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                      placeholder={mode === "signup" ? "Mínimo 6 caracteres" : "••••••••"} required minLength={6}
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                      className="relative w-full bg-muted/30 border border-border/60 rounded-xl px-3.5 pr-10 py-2.5 text-sm outline-none transition-all duration-300 placeholder:text-muted-foreground/30 focus:border-primary/50 focus:bg-white focus:ring-2 focus:ring-primary/8 focus:shadow-lg focus:shadow-primary/5" />
                    <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground transition-colors z-10" tabIndex={-1}>
                      {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {/* Error message */}
                {err && (
                  <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-destructive/6 border border-destructive/15 text-xs text-destructive font-medium animate-[scale-in_250ms_cubic-bezier(0.16,1,0.3,1)]">
                    <div className="w-4 h-4 rounded-full bg-destructive/10 grid place-items-center shrink-0 text-[9px] font-bold">!</div>
                    {err}
                  </div>
                )}

                {/* Success message */}
                {successMsg && (
                  <div className="relative px-3.5 py-3 rounded-xl bg-gradient-to-r from-emerald-50 to-emerald-50/80 border border-emerald-200/80 text-xs text-emerald-700 font-medium animate-[scale-in_300ms_cubic-bezier(0.16,1,0.3,1)] overflow-hidden">
                    <div className="absolute inset-0 opacity-20" style={{ background: "radial-gradient(circle at 30% 50%, oklch(0.65 0.2 150 / 0.3), transparent 70%)" }} />
                    <span className="relative flex items-center gap-2">
                      <span className="text-base">🎉</span> {successMsg}
                    </span>
                  </div>
                )}

                {/* Submit button */}
                <button disabled={busy}
                  className="relative w-full py-3 rounded-xl bg-gradient-to-r from-primary to-accent text-white font-display font-semibold text-sm tracking-wider shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 active:scale-[0.97] transition-all duration-300 disabled:opacity-50 overflow-hidden group/btn"
                >
                  <div className="absolute inset-0 bg-white/10 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-500" />
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {busy ? (
                      <><Loader2 size={15} className="animate-spin" />{mode === "signin" ? "Entrando…" : "Creando cuenta…"}</>
                    ) : (
                      <><span>{mode === "signin" ? "INICIAR SESIÓN" : "CREAR CUENTA"}</span><ArrowRight size={14} className="group-hover/btn:translate-x-1 transition-transform" /></>
                    )}
                  </span>
                </button>

                {/* Forgot password */}
                {mode === "signin" && (
                  <div className="text-center pt-0.5">
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
          </TiltCard>

          {/* Footer */}
          <div className="mt-3 text-center">
            <p className="text-[8px] text-muted-foreground/30 flex items-center justify-center gap-1.5 font-mono">
              <Globe size={8} className="text-primary/20" />
              Datos guardados localmente en el navegador
              <Globe size={8} className="text-primary/20" />
            </p>
          </div>
        </div>
      </div>

      {/* Mobile bottom bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary/30 via-accent/30 to-transparent z-20" />
    </div>
  );
}
