import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Copy, Check, Reply, SmilePlus, ImagePlus, Loader2, Users, WifiOff, Database, Plug, RefreshCw, KeyRound, CheckCircle2, AlertTriangle, Mic, Play, Pause, Trash2, ArrowDown, ExternalLink, Megaphone, Gift, PartyPopper, Lock, Sparkles, Timer, Undo2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  getCommunityChat,
  fetchChatMessages,
  sendChatMessage,
  subscribeToChat,
  uploadSticker,
  fetchMyStickers,
  deleteSticker,
  signMedia,
  isAudioMessage,
  uploadChatMedia,
  fetchChatProfiles,
  isNetworkError,
  queuePendingMessage,
  flushPendingMessages,
  isChatSchemaOutdated,
  createAnnouncement,
  createOrbGift,
  claimOrbGift,
  fetchOrbGift,
  expireOrbGifts,
  subscribeToOrbGifts,
  isAnnouncement,
  isGiftMessage,
  COMMUNITY_CHAT_NAME,
  CHAT_ERR,
  type ChatMessage,
  type ChatSticker,
  type OrbGift,
} from "@/lib/social/chat";
import { supabase, hasSupabaseConfig, saveSupabaseCredentials, isSchemaMissing, getSupabaseUrl } from "@/integrations/supabase/client";
import { UserName } from "./UserName";
import { getMyProfile, getMyOrbes, isAdmin } from "@/lib/social/api";
import type { Profile } from "@/lib/social/api";
import { runChatSchemaSetup, SUPABASE_ACCESS_TOKEN, sqlEditorUrl } from "@/lib/supabase/setup";
import { CHAT_SCHEMA_SQL } from "@/lib/supabase/chat-schema";

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtDay(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return fmtTime(iso);
  return d.toLocaleDateString([], { day: "2-digit", month: "short" });
}

/** Convierte el error técnico del chat en una pista útil para el usuario. */
function connHint(msg: string): string {
  if (/invalid api key|apikey|401|invalid key/i.test(msg))
    return "La anon key guardada no es válida. Cópiala de Supabase → Project Settings → API Keys (empieza por eyJ… o sb_publishable_) y guárdala en ⋮ → Supabase → «Pegar claves». Si el error persiste, usa «Restablecer la conexión» en el login.";
  if (/infinite recursion|recursion detected|recursive/i.test(msg))
    return "Hay políticas RLS antiguas en las tablas del chat (de una instalación previa) que causan un bucle de seguridad. Pulsa «Instalar chat» para limpiarlas y reinstalarlas bien (necesita tu token sbp_…).";
  if (/permission denied|row-level security|42501|PGRST301|new row violates|violates row-level/i.test(msg))
    return "Las tablas existen pero los permisos (RLS) bloquean el chat: suele pasar si se instaló un esquema antiguo o la sesión no coincide. Pulsa «Instalar chat» para reinstalar los permisos, o entra de nuevo con tu cuenta.";
  if (/failed to fetch|networkerror|load failed|network request failed|ERR_/i.test(msg))
    return "El servidor de Supabase no respondió. No es necesariamente tu internet: puede ser un bloqueo temporal o del dominio en esta vista previa. Reintenta en unos segundos o revisa la URL y la anon key (⋮ → Supabase).";
  return "Revisa que la URL y la anon key sean correctas (Supabase → Project Settings → API Keys).";
}

/** Explica el motivo REAL de un fallo de envío, en lugar de culpar a la conexión del usuario. */
function sendErrorDetail(err: unknown): { title: string; desc: string; action?: "install" } {
  const msg = (err as Error)?.message ?? "";
  const code = (err as { code?: string })?.code;
  if (code === CHAT_ERR.AUTH_REQUIRED || code === CHAT_ERR.REAL_AUTH_REQUIRED) {
    return {
      title: "Inicia sesión para enviar mensajes",
      desc:
        code === CHAT_ERR.REAL_AUTH_REQUIRED
          ? "Tu base de datos está conectada pero esta cuenta es local. Entra con tu cuenta de Supabase (⋮ → Cerrar sesión → login) y vuelve."
          : "El chat necesita una sesión activa. Inicia sesión y vuelve.",
    };
  }
  if (/invalid api key|401|apikey|invalid key/i.test(msg))
    return {
      title: "La clave de Supabase no es válida",
      desc: "Revisa la anon key (empieza por eyJ… o sb_publishable_) en ⋮ → Supabase y guárdala de nuevo.",
    };
  if (/permission denied|row-level security|42501|pgrst301|new row violates|infinite recursion/i.test(msg))
    return {
      title: "Los permisos bloquean el envío",
      desc: "Reinstala las tablas del chat con «Instalar chat» (necesita tu token sbp_…) o entra con tu cuenta de Supabase.",
      action: "install",
    };
  if (/schema cache/i.test(msg) || /could not find the .* column/i.test(msg) || code === "PGRST204")
    return {
      title: "La tabla del chat está desactualizada",
      desc: "Falta una columna en chat_messages (suele pasar si instalaste el chat antes de que existiera el audio de voz). Pulsa «Instalar chat» con tu token sbp_ para actualizar la tabla y vuelve a enviar.",
      action: "install",
    };
  if (/foreign key|23503|does not exist|undefined_table|42p01/i.test(msg))
    return {
      title: "Falta algo en la base de datos",
      desc: "Parece que tu cuenta no tiene perfil en la base o falta una tabla. Entra con tu cuenta de Supabase y, si persiste, pulsa «Instalar chat».",
    };
  if (isNetworkError(err))
    return {
      title: "El servidor del chat no respondió",
      desc: "No es un problema de tu internet: el servidor no respondió. Tu mensaje quedó guardado y se enviará solo cuando se restablezca.",
    };
  return { title: "No se pudo enviar el mensaje", desc: msg.slice(0, 220) || "Error desconocido. Reinténtalo." };
}

function Avatar({ p, name, size = 40 }: { p?: Profile | null; name?: string; size?: number }) {
  const label = (p?.display_name || p?.username || name || "?").trim().charAt(0).toUpperCase();
  return (
    <div
      className="rounded-full overflow-hidden shrink-0 grid place-items-center font-display font-semibold text-primary-foreground"
      style={{ width: size, height: size, fontSize: size * 0.42, background: "linear-gradient(135deg, var(--color-primary), var(--color-accent))" }}
    >
      {p?.avatar_url ? (
        <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
      ) : (
        label
      )}
    </div>
  );
}

function BubbleActions({ mine, copied, onCopy, onReply }: { mine: boolean; copied: boolean; onCopy: () => void; onReply: () => void }) {
  return (
    <div className={`absolute top-1/2 -translate-y-1/2 ${mine ? "-left-2" : "-right-2"} hidden group-hover:flex gap-0.5 bg-background border border-border rounded-lg p-0.5 shadow-md z-10`}>
      <button onClick={onCopy} title="Copiar" className="w-6 h-6 grid place-items-center rounded-md hover:bg-muted/70 text-muted-foreground">
        {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
      </button>
      <button onClick={onReply} title="Responder" className="w-6 h-6 grid place-items-center rounded-md hover:bg-muted/70 text-muted-foreground">
        <Reply size={12} />
      </button>
    </div>
  );
}

/** Formatea segundos como m:ss (o ss) para la duración del audio. */
function fmtDur(s: number): string {
  if (!isFinite(s) || s < 0) s = 0;
  const secs = Math.round(s);
  const m = Math.floor(secs / 60);
  const r = secs % 60;
  return m > 0 ? `${m}:${String(r).padStart(2, "0")}` : `${r}s`;
}

// Elemento de audio que está sonando en este momento (solo uno a la vez).
let currentAudio: HTMLAudioElement | null = null;

/** Burbuja de audio de voz: play/pausa, forma de onda animada y duración. */
function AudioBubble({ url, mine, duration }: { url: string; mine: boolean; duration: number }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(duration || 0);

  // Barras decorativas de la forma de onda (estáticas; el progreso las ilumina).
  const bars = useRef<number[]>([]);
  if (!bars.current.length) {
    bars.current = Array.from({ length: 22 }, () => 0.35 + Math.random() * 0.65);
  }

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
    } else {
      // Pausa cualquier otro audio que esté sonando.
      if (currentAudio && currentAudio !== el) {
        try {
          currentAudio.pause();
          currentAudio.currentTime = 0;
        } catch { /* noop */ }
      }
      currentAudio = el;
      void el.play().catch(() => setPlaying(false));
    }
  };

  return (
    <div className={`flex items-center gap-2 min-w-[200px] max-w-[240px] ${mine ? "flex-row" : "flex-row-reverse"}`}>
      <button
        onClick={toggle}
        className={`w-8 h-8 rounded-full grid place-items-center shrink-0 transition active:scale-90 ${
          mine ? "bg-white/25 text-white hover:bg-white/30" : "bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-sm"
        }`}
      >
        {playing ? <Pause size={13} /> : <Play size={13} className="ml-0.5" />}
      </button>
      <div className="flex-1 min-w-0">
        {/* Forma de onda */}
        <div className={`flex items-center gap-[2px] h-8 ${mine ? "justify-start" : "justify-end"}`}>
          {bars.current.map((h, i) => {
            const lit = progress * bars.current.length >= i;
            return (
              <span
                key={i}
                className={`w-[3px] rounded-full transition-colors duration-100 ${
                  mine ? "bg-white/25" : "bg-primary/20"
                } ${lit ? (mine ? "!bg-white" : "!bg-primary") : ""}`}
                style={{ height: `${Math.round(h * 32)}px` }}
              />
            );
          })}
        </div>
        {/* Progreso + duración */}
        <div className={`flex items-center gap-1.5 text-[9px] ${mine ? "text-white/70" : "text-muted-foreground/70"}`}>
          <span className="font-mono tabular-nums">{fmtDur(progress > 0 ? time : dur)}</span>
          <div className="flex-1 h-1 rounded-full overflow-hidden bg-black/10 dark:bg-white/10">
            <div
              className={`h-full rounded-full ${mine ? "bg-white/80" : "bg-primary"}`}
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          <span className="font-mono tabular-nums">{fmtDur(dur)}</span>
        </div>
      </div>
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (isFinite(d) && d > 0) setDur(d);
        }}
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          setTime(el.currentTime);
          if (isFinite(el.duration) && el.duration > 0) setProgress(el.currentTime / el.duration);
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
          setTime(0);
        }}
        className="hidden"
      />
    </div>
  );
}

/** URL lista para el <img>/<audio>: las URLs http se usan tal cual (legado);
 *  las rutas se resuelven con la firma cacheada (permanente). */
function resolveMediaUrl(u: string | null | undefined, cache: Map<string, string>): string | null {
  if (!u) return null;
  if (/^https?:/.test(u)) return u;
  return cache.get(u) ?? null;
}

function MessageBubble({
  m,
  mine,
  sender,
  reply,
  mediaUrl,
  copied,
  onCopy,
  onReply,
}: {
  m: ChatMessage;
  mine: boolean;
  sender?: Profile | null;
  reply?: ChatMessage | null;
  mediaUrl: string | null;
  copied: boolean;
  onCopy: () => void;
  onReply: () => void;
}) {
  return (
    <div className={`group relative flex gap-2 ${mine ? "justify-end pl-10" : "justify-start pr-10"}`}>
      {!mine && (
        m.sender_id ? (
          <Link to="/profile/$userId" params={{ userId: m.sender_id }} className="shrink-0" onClick={e => e.stopPropagation()}>
            <Avatar p={sender} size={28} />
          </Link>
        ) : (
          <div className="shrink-0"><Avatar p={sender} size={28} /></div>
        )
      )}
      <div className={`flex flex-col min-w-0 max-w-[78%] ${mine ? "items-end" : "items-start"}`}>
        <div className={`mb-0.5 ${mine ? "pr-1" : "pl-1"}`}>
          {m.sender_id ? (
            <Link to="/profile/$userId" params={{ userId: m.sender_id }} className="hover:opacity-80 transition-opacity">
              <UserName p={sender} size="xs" />
            </Link>
          ) : (
            <UserName p={sender} size="xs" />
          )}
        </div>
        <div
          className={
            mine
              ? "bg-gradient-to-br from-primary to-accent text-primary-foreground rounded-2xl rounded-br-md px-3 py-2 shadow-[0_4px_14px_-6px_oklch(0.488_0.185_264/0.45)]"
              : "bg-card border border-border rounded-2xl rounded-bl-md px-3 py-2 shadow-sm"
          }
        >
          {reply && (
            <div className="mb-1.5 border-l-2 border-primary/50 pl-2 py-0.5 rounded-r-md bg-black/5 dark:bg-white/5 text-[11px] text-muted-foreground line-clamp-2">
              {isAudioMessage(reply) ? "🎤 Audio de voz" : reply.media_url ? "🖼️ Sticker" : reply.content || "Mensaje"}
            </div>
          )}
          {m.content && <div className="text-[13px] leading-snug whitespace-pre-wrap break-words">{m.content}</div>}
          {mediaUrl && isAudioMessage(m) ? (
            <AudioBubble url={mediaUrl} mine={mine} duration={0} />
          ) : m.media_url && !mediaUrl ? (
            <div className="text-[10px] text-muted-foreground/70 py-1.5 flex items-center gap-1.5">
              <Loader2 size={11} className="animate-spin" /> Cargando media…
            </div>
          ) : mediaUrl ? (
            <img src={mediaUrl} alt="Sticker" className="max-w-44 max-h-44 rounded-xl mt-0.5 object-contain" draggable={false} />
          ) : null}
          <div className={`text-[9px] mt-1 ${mine ? "text-primary-foreground/70" : "text-muted-foreground/70"} text-right`}>{fmtTime(m.created_at)}</div>
        </div>
      </div>
      {mine && (
        m.sender_id ? (
          <Link to="/profile/$userId" params={{ userId: m.sender_id }} className="shrink-0" onClick={e => e.stopPropagation()}>
            <Avatar p={sender} size={28} />
          </Link>
        ) : (
          <div className="shrink-0"><Avatar p={sender} size={28} /></div>
        )
      )}
      <BubbleActions mine={mine} copied={copied} onCopy={onCopy} onReply={onReply} />
    </div>
  );
}

/** Aviso del grupo: solo lo publica el administrador y lo ve toda la comunidad. */
function AnnouncementCard({ m, sender }: { m: ChatMessage; sender?: Profile | null }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/[0.12] via-accent/[0.08] to-transparent px-3.5 py-3 shadow-sm">
      <div className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-primary/15 blur-2xl pointer-events-none" />
      <div className="relative flex items-start gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground grid place-items-center shrink-0 shadow-[0_4px_12px_-6px_oklch(0.488_0.185_264/0.6)]">
          <Megaphone size={14} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[9px] font-display tracking-[0.18em] text-primary font-bold">AVISO DE LA COMUNIDAD</span>
            <span className="text-[9px] text-muted-foreground/70">
              {sender?.display_name || sender?.username ? `${sender?.display_name || sender?.username} · ` : ""}
              {fmtDay(m.created_at)}
            </span>
          </div>
          <p className="text-[13px] leading-snug font-medium mt-1 whitespace-pre-wrap break-words">{m.content}</p>
        </div>
      </div>
    </div>
  );
}

/** Paquete de regalos de orbes: abre, cuenta atrás y animaciones al abrir/cerrar. */
function GiftCard({
  m,
  gift,
  claiming,
  expiring,
  claimedAmount,
  onClaim,
  onExpire,
}: {
  m: ChatMessage;
  gift?: OrbGift | null;
  claiming: boolean;
  expiring: boolean;
  claimedAmount?: number;
  onClaim: () => void;
  onExpire: () => void;
}) {
  const [burst, setBurst] = useState<"claim" | "close" | "expired" | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const prevStatus = useRef<string | undefined>(gift?.status);
  const celebratedClose = useRef(false);
  const expiredFired = useRef(false);

  // Tick cada segundo para el countdown de caducidad.
  useEffect(() => {
    if (!gift || gift.status !== "open") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [gift]);

  // Animación de cierre cuando el paquete pasa de abierto a cerrado en vivo.
  useEffect(() => {
    if (!gift) return;
    const prev = prevStatus.current;
    prevStatus.current = gift.status;
    if (gift.status === "closed" && prev === "open" && !celebratedClose.current && claimedAmount == null) {
      celebratedClose.current = true;
      setBurst("close");
      const t = setTimeout(() => setBurst(null), 2600);
      return () => clearTimeout(t);
    }
    if (gift.status === "expired" && prev === "open" && claimedAmount == null) {
      celebratedClose.current = true;
      setBurst("expired");
      const t = setTimeout(() => setBurst(null), 2600);
      return () => clearTimeout(t);
    }
  }, [gift, claimedAmount]);

  // Animación de apertura justo después de reclamar el regalo.
  useEffect(() => {
    if (claimedAmount != null) {
      setBurst("claim");
      const t = setTimeout(() => setBurst(null), 2600);
      return () => clearTimeout(t);
    }
  }, [claimedAmount]);

  if (!gift) {
    return (
      <div className="flex justify-center">
        <div className="flex items-center gap-2 px-4 py-3 rounded-2xl border border-border bg-card text-[11px] text-muted-foreground">
          <Loader2 size={13} className="animate-spin" /> Cargando regalo…
        </div>
      </div>
    );
  }

  const open = gift.status === "open";
  const expired = gift.status === "expired";
  const progress = Math.min(100, Math.round((gift.claims / Math.max(1, gift.max_claims)) * 100));
  const remaining = Math.max(0, gift.max_claims - gift.claims);
  const unclaimed = Math.max(0, gift.total_orbes - gift.claims * gift.amount_per_person);

  // Tiempo restante para que caduque el paquete (24 h desde su creación).
  const expiresAt = gift.expires_at ? new Date(gift.expires_at).getTime() : 0;
  const msLeft = expiresAt ? Math.max(0, expiresAt - now) : 0;
  const expiredLocal = open && expiresAt > 0 && msLeft <= 0;
  const h = Math.floor(msLeft / 3_600_000);
  const min = Math.floor((msLeft % 3_600_000) / 60_000);
  const s = Math.floor((msLeft % 60_000) / 1000);
  const countdown = `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

  // Si el paquete superó las 24 h estando abierto, pedimos al servidor que lo
  // caduque y devuelva los orbes no reclamados (una sola vez).
  useEffect(() => {
    if (expiredLocal && !expiredFired.current) {
      expiredFired.current = true;
      onExpire();
    }
  }, [expiredLocal, onExpire]);

  return (
    <div className="flex justify-center px-1">
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/[0.10] via-accent/[0.06] to-transparent px-3.5 py-3 shadow-sm">
        <div className="absolute -left-6 -top-8 w-24 h-24 rounded-full bg-primary/15 blur-2xl pointer-events-none" />
        <div className="absolute -right-6 -bottom-8 w-24 h-24 rounded-full bg-accent/10 blur-2xl pointer-events-none" />

        <div className="relative flex items-center gap-3">
          <motion.div
            animate={open ? { scale: [1, 1.06, 1] } : { scale: 1 }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            style={{ willChange: "transform" }}
            className="w-12 h-12 shrink-0 rounded-2xl bg-gradient-to-br from-primary to-accent text-primary-foreground grid place-items-center shadow-[0_8px_20px_-8px_oklch(0.488_0.185_264/0.6)]"
          >
            <Gift size={22} strokeWidth={2} />
            <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/20 pointer-events-none" />
          </motion.div>
          <div className="flex-1 min-w-0">
            <div className="text-[9px] font-display tracking-[0.18em] text-primary font-bold">
              PAQUETE DE REGALOS
            </div>
            <div className="text-[13px] font-semibold leading-tight mt-0.5">{m.content}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
              <Sparkles size={11} className="text-primary" />
              <b>{gift.amount_per_person} orbes</b> por persona · {gift.max_claims} {gift.max_claims === 1 ? "regalo" : "regalos"}
            </div>
          </div>
        </div>

        {/* Progreso de aperturas */}
        <div className="relative mt-3">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
            <span>{gift.claims} / {gift.max_claims} abiertos</span>
            <span className={open ? "text-primary font-semibold" : "text-muted-foreground"}>
              {open ? `${remaining} restan${remaining === 1 ? "" : "n"}` : "Cerrado"}
            </span>
          </div>
          <div className="h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
              initial={false}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          {open && !expiredLocal && (
            <div className="flex items-center justify-center gap-1 mt-1.5 text-[10px] text-muted-foreground">
              <Timer size={10} /> Caduca en {countdown}
            </div>
          )}
          {expired && (
            <div className="flex items-center justify-center gap-1 mt-1.5 text-[10px] text-muted-foreground">
              <Undo2 size={10} /> Caducado · {unclaimed.toLocaleString("es")} orbes devueltos
            </div>
          )}
        </div>

        {/* Acción */}
        <div className="relative mt-3">
          {claimedAmount != null ? (
            <div className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-[11px] font-display tracking-wider">
              <CheckCircle2 size={13} /> ¡REGALO ABIERTO! +{claimedAmount} ORBES
            </div>
          ) : open && !expiredLocal ? (
            <button
              onClick={onClaim}
              disabled={claiming || expiring}
              className="w-full py-2.5 rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground text-[11px] font-display tracking-widest shadow-[0_6px_16px_-6px_oklch(0.488_0.185_264/0.5)] active:scale-[0.98] transition disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {claiming ? <Loader2 size={13} className="animate-spin" /> : <Gift size={13} />}
              {claiming ? "ABRIENDO…" : "ABRIR REGALO"}
            </button>
          ) : expired || expiredLocal ? (
            <div className="flex items-center justify-center gap-1.5 py-2 rounded-xl border border-border bg-black/[0.04] dark:bg-white/[0.05] text-muted-foreground text-[11px] font-display tracking-wider">
              <Undo2 size={11} /> PAQUETE CADUCADO
            </div>
          ) : (
            <div className="flex items-center justify-center gap-1.5 py-2 rounded-xl border border-border bg-black/[0.04] dark:bg-white/[0.05] text-muted-foreground text-[11px] font-display tracking-wider">
              <Lock size={11} /> PAQUETE CERRADO
            </div>
          )}
        </div>

        {/* Animaciones: apertura (reclamé) y cierre (se llenó) */}
        <AnimatePresence>
          {burst && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="absolute inset-0 z-10 grid place-items-center rounded-2xl bg-black/60 backdrop-blur-[2px]"
            >
              {burst === "claim" ? (
                <motion.div
                  initial={{ scale: 0.6, opacity: 0, y: 14 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.85, opacity: 0 }}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                  style={{ willChange: "transform, opacity" }}
                  className="text-center px-4"
                >
                  <div className="w-14 h-14 mx-auto mb-2.5 rounded-2xl bg-gradient-to-br from-primary to-accent text-primary-foreground grid place-items-center shadow-[0_8px_20px_-8px_oklch(0.488_0.185_264/0.6)]">
                    <Sparkles size={26} />
                  </div>
                  <div className="text-sm font-bold text-white drop-shadow">¡+{claimedAmount ?? gift.amount_per_person} ORBES!</div>
                  <div className="text-[10px] text-white/80 mt-0.5">Ya están en tu cuenta</div>
                </motion.div>
              ) : burst === "expired" ? (
                <motion.div
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.85, opacity: 0 }}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                  style={{ willChange: "transform, opacity" }}
                  className="text-center px-4"
                >
                  <div className="w-14 h-14 mx-auto mb-2.5 rounded-2xl bg-card border border-border text-muted-foreground grid place-items-center">
                    <Undo2 size={24} />
                  </div>
                  <div className="text-sm font-bold text-white drop-shadow">¡El paquete caducó!</div>
                  <div className="text-[10px] text-white/80 mt-0.5">Los orbes no reclamados se devolvieron al creador</div>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.85, opacity: 0 }}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                  style={{ willChange: "transform, opacity" }}
                  className="text-center px-4"
                >
                  <div className="w-14 h-14 mx-auto mb-2.5 rounded-2xl bg-card border border-border text-muted-foreground grid place-items-center">
                    <Lock size={24} />
                  </div>
                  <div className="text-sm font-bold text-white drop-shadow">¡Se acabó el paquete!</div>
                  <div className="text-[10px] text-white/80 mt-0.5">Todos los regalos fueron abiertos</div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function ChatSection({ myId, onClose }: { myId: string | null; onClose: () => void }) {
  const [chatInfo, setChatInfo] = useState<{ id: string; name: string; memberCount: number; memberOk?: boolean; local?: boolean } | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [senders, setSenders] = useState<Map<string, Profile>>(new Map());
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [stickersOpen, setStickersOpen] = useState(false);
  const [myStickers, setMyStickers] = useState<ChatSticker[]>([]);
  const [signedStickers, setSignedStickers] = useState<Map<string, string>>(new Map());
  const [stickerUploading, setStickerUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [sendingAudio, setSendingAudio] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recChunksRef = useRef<Blob[]>([]);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isLocal, setIsLocal] = useState<boolean>(() => !hasSupabaseConfig());
  const [connecting, setConnecting] = useState(false);
  const [connectUrl, setConnectUrl] = useState("https://gxpgczwkovertezeydkt.supabase.co");
  const [connectKey, setConnectKey] = useState("");
  const [connectError, setConnectError] = useState<string | null>(null);
  const [initError, setInitError] = useState<"schema" | "conn" | "auth" | "rls" | null>(null);
  const [errorDetail, setErrorDetail] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [installOpen, setInstallOpen] = useState(false);
  const [installToken, setInstallToken] = useState(SUPABASE_ACCESS_TOKEN ?? "");
  const [installing, setInstalling] = useState(false);
  const [installResult, setInstallResult] = useState<string | null>(null);
  const [installOk, setInstallOk] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  // Paginación por cursor + scroll infinito
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [unseen, setUnseen] = useState(0);
  // URLs firmadas de los media de los mensajes (cacheadas: nunca expiran en la base)
  const [signedMedia, setSignedMedia] = useState<Map<string, string>>(new Map());
  // ¿La tabla del chat está desactualizada (sin la columna media_type)?
  const [schemaOutdated, setSchemaOutdated] = useState(false);
  // Avisos del grupo y paquetes de regalo (solo el administrador puede crearlos)
  const [isOwner, setIsOwner] = useState(false);
  const [announceOpen, setAnnounceOpen] = useState(false);
  const [announceText, setAnnounceText] = useState("");
  const [announceBusy, setAnnounceBusy] = useState(false);
  const [announceErr, setAnnounceErr] = useState<string | null>(null);
  const [giftOpen, setGiftOpen] = useState(false);
  const [giftTitle, setGiftTitle] = useState("");
  const [giftAmount, setGiftAmount] = useState("200");
  const [giftPeople, setGiftPeople] = useState("5");
  const [giftBusy, setGiftBusy] = useState(false);
  const [giftErr, setGiftErr] = useState<string | null>(null);
  const [myOrbes, setMyOrbes] = useState<number | null>(null);
  const [gifts, setGifts] = useState<Map<string, OrbGift>>(new Map());
  const giftsRef = useRef<Map<string, OrbGift>>(new Map());
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [expiringId, setExpiringId] = useState<string | null>(null);
  const [myClaims, setMyClaims] = useState<Map<string, number>>(new Map());

  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const sendersRef = useRef<Set<string>>(new Set());
  const listRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const cursorRef = useRef<{ created_at: string; id: string } | null>(null);
  const prevScrollHeightRef = useRef(0);
  const signedMediaRef = useRef<Map<string, string>>(new Map());

  // Load senders for a batch of messages
  const loadSenders = useCallback(async (msgs: ChatMessage[]) => {
    const ids = Array.from(new Set(msgs.map((m) => m.sender_id).filter(Boolean))) as string[];
    const missing = ids.filter((id) => !sendersRef.current.has(id));
    if (!missing.length) return;
    try {
      const pmap = await fetchChatProfiles(missing);
      for (const id of missing) sendersRef.current.add(id);
      setSenders((prev) => {
        const next = new Map(prev);
        for (const [id, p] of pmap) next.set(id, p);
        return next;
      });
    } catch {
      /* noop */
    }
  }, []);

  // Mi propio perfil siempre disponible (evita "anon" si la carga de perfiles falla)
  useEffect(() => {
    if (!myId) return;
    let cancelled = false;
    (async () => {
      let p: Profile | null = null;
      try {
        p = await getMyProfile();
      } catch {
        /* noop */
      }
      if (!p) {
        // Cuenta local (o credenciales rotas): el perfil vive en localStorage.
        try {
          const rows = JSON.parse(localStorage.getItem("_local_data_profiles") || "[]") as Profile[];
          p = rows.find((x) => x.id === myId) ?? null;
        } catch {
          /* noop */
        }
      }
      if (cancelled || !p) return;
      sendersRef.current.add(p.id);
      setSenders((prev) => {
        if (prev.has(p.id)) return prev;
        const next = new Map(prev);
        next.set(p.id, p);
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [myId]);

  const copyChatSql = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(CHAT_SCHEMA_SQL);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2500);
    } catch {
      toast.error("No se pudo copiar el SQL", {
        description: "Cópialo manualmente o usa el botón «Instalar» si tu token sbp_… funciona.",
      });
    }
  }, []);

  const doConnect = useCallback(() => {
    const res = saveSupabaseCredentials(connectUrl.trim(), connectKey.trim());
    if (!res.ok) {
      setConnectError(res.error ?? "No se pudieron guardar las credenciales");
      return;
    }
    setConnectError(null);
    window.location.reload();
  }, [connectUrl, connectKey]);

  // Preparar el chat comunitario + cargar mensajes
  useEffect(() => {
    let cancelled = false;
    setInitError(null);
    setErrorDetail("");
    setLoading(true);
    (async () => {
      try {
        const info = await getCommunityChat();
        if (cancelled) return;
        setChatInfo(info);
        // El aviso de «modo local» depende del modo activo real del chat
        // (cuenta local + Supabase conectado también opera en local).
        setIsLocal(!hasSupabaseConfig() || !!info.local);
        const { messages: msgs, hasMore: more } = await fetchChatMessages(info.id);
        if (cancelled) return;
        setMessages(msgs);
        setHasMore(more);
        if (msgs.length) cursorRef.current = { created_at: msgs[0].created_at, id: msgs[0].id };
        stickToBottomRef.current = true;
        await loadSenders(msgs);
        // Comprueba si la tabla del chat está desactualizada (sin media_type)
        // para avisar de reinstalar el esquema antes de que falle un audio.
        isChatSchemaOutdated()
          .then((outdated) => {
            if (!cancelled) setSchemaOutdated(outdated);
          })
          .catch(() => {});
      } catch (err) {
        if (cancelled) return;
        const code = (err as { code?: string })?.code;
        if (code === CHAT_ERR.AUTH_REQUIRED || code === CHAT_ERR.REAL_AUTH_REQUIRED) {
          setInitError("auth");
        } else {
          const msg = (err as Error)?.message ?? "";
          if (isSchemaMissing(err)) {
            setInitError("schema");
          } else if (/infinite recursion|recursion detected|permission denied|row-level security|42501|PGRST301/i.test(msg)) {
            // Permisos (RLS) del chat desactualizados: se reparan reinstalando las tablas.
            setInitError("rls");
          } else {
            setInitError("conn");
          }
        }
        setErrorDetail((err as Error)?.message ?? "");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadSenders, retryKey]);

  // Suscripción en tiempo real: INSERT (nuevos), UPDATE (ediciones), DELETE (eliminaciones)
  useEffect(() => {
    if (!chatInfo) return;
    const unsub = subscribeToChat(chatInfo.id, (ev) => {
      if (ev.type === "INSERT") {
        setMessages((prev) => (prev.some((m) => m.id === ev.message.id) ? prev : [...prev, ev.message]));
        loadSenders([ev.message]);
        if (!stickToBottomRef.current) setUnseen((n) => n + 1);
      } else if (ev.type === "UPDATE") {
        setMessages((prev) => prev.map((m) => (m.id === ev.message.id ? { ...m, ...ev.message } : m)));
      } else if (ev.type === "DELETE") {
        setMessages((prev) => prev.filter((m) => m.id !== ev.message.id));
      }
    });
    return unsub;
  }, [chatInfo, loadSenders]);

  // ¿Es el administrador propietario? (solo linkyteam989@gmail.com puede
  // publicar avisos y crear paquetes de regalo; el servidor lo refuerza).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user?.email && user.email.toLowerCase() === "linkyteam989@gmail.com") {
          if (!cancelled) setIsOwner(true);
          return;
        }
        const ok = await isAdmin().catch(() => false);
        if (!cancelled) setIsOwner(ok);
      } catch {
        if (!cancelled) setIsOwner(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Carga el estado de los paquetes de regalo referenciados en los mensajes.
  useEffect(() => {
    const ids = Array.from(new Set(messages.map((m) => m.gift_id).filter((x): x is string => !!x)));
    const need = ids.filter((id) => !giftsRef.current.has(id));
    if (!need.length) return;
    let cancelled = false;
    (async () => {
      for (const id of need) {
        try {
          const g = await fetchOrbGift(id);
          if (cancelled || !g) continue;
          giftsRef.current.set(id, g);
        } catch {
          /* noop */
        }
      }
      if (!cancelled) setGifts(new Map(giftsRef.current));
    })();
    return () => {
      cancelled = true;
    };
  }, [messages]);

  // Realtime de los paquetes: aperturas y cierres en vivo para todos.
  useEffect(() => {
    if (!chatInfo) return;
    const unsub = subscribeToOrbGifts((type, g) => {
      setGifts((prev) => {
        const next = new Map(prev);
        if (type === "DELETE") next.delete(g.id);
        else next.set(g.id, { ...(next.get(g.id) ?? ({} as OrbGift)), ...g });
        return next;
      });
    });
    return unsub;
  }, [chatInfo]);

  // Reenvía automáticamente los mensajes que quedaron pendientes por un fallo de
  // red (el servidor no respondió) cuando el chat está listo o vuelve la conexión.
  useEffect(() => {
    if (!chatInfo) return;
    let cancelled = false;
    const flush = async () => {
      try {
        const sent = await flushPendingMessages();
        if (cancelled || !sent) return;
        toast.success(sent === 1 ? "Tu mensaje pendiente se envió ✓" : `Se enviaron ${sent} mensajes pendientes ✓`);
      } catch {
        /* noop */
      }
    };
    void flush();
    const onOnline = () => void flush();
    window.addEventListener("online", onOnline);
    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
    };
  }, [chatInfo]);

  // Auto-scroll solo si el usuario está pegado al final (nunca al cargar histórico)
  useEffect(() => {
    if (stickToBottomRef.current && !loading) {
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages.length, loading]);

  // Firma las rutas de media de los mensajes al cargarlos (cacheada). Los mensajes
  // guardan la RUTA del archivo (no una URL firmada que expira), así el media
  // permanece accesible siempre mientras se re-firma al abrir el chat.
  useEffect(() => {
    if (!messages.length) return;
    const paths = Array.from(
      new Set(messages.map((m) => m.media_url).filter((u): u is string => !!u && !/^https?:/.test(u)))
    );
    const need = paths.filter((p) => !signedMediaRef.current.has(p));
    if (!need.length) return;
    let cancelled = false;
    (async () => {
      try {
        const signed = await signMedia(need);
        if (cancelled) return;
        const fresh = new Map<string, string>();
        need.forEach((p, i) => {
          if (signed[i]) fresh.set(p, signed[i]);
        });
        if (!fresh.size) return;
        signedMediaRef.current = new Map([...signedMediaRef.current, ...fresh]);
        setSignedMedia(signedMediaRef.current);
      } catch {
        /* noop: se reintenta en el próximo cambio de mensajes */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [messages]);

  // Carga la página anterior (scroll infinito hacia arriba)
  const loadOlder = useCallback(async () => {
    if (!chatInfo || loadingMore || !hasMore || !cursorRef.current) return;
    setLoadingMore(true);
    const el = listRef.current;
    prevScrollHeightRef.current = el?.scrollHeight ?? 0;
    try {
      const { messages: older, hasMore: more } = await fetchChatMessages(chatInfo.id, {
        before: cursorRef.current,
      });
      if (!older.length) {
        setHasMore(false);
        return;
      }
      cursorRef.current = { created_at: older[0].created_at, id: older[0].id };
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        return [...older.filter((m) => !seen.has(m.id)), ...prev];
      });
      setHasMore(more);
      // Mantener la posición visual tras insertar mensajes antiguos arriba.
      requestAnimationFrame(() => {
        const el2 = listRef.current;
        if (el2) el2.scrollTop = el2.scrollHeight - prevScrollHeightRef.current;
      });
    } catch {
      toast.error("No se pudieron cargar mensajes anteriores");
    } finally {
      setLoadingMore(false);
    }
  }, [chatInfo, hasMore, loadingMore]);

  const onScrollList = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    stickToBottomRef.current = nearBottom;
    if (nearBottom && unseen > 0) setUnseen(0);
    if (el.scrollTop < 60 && hasMore && !loadingMore) void loadOlder();
  }, [hasMore, loadingMore, loadOlder, unseen]);

  const jumpToBottom = useCallback(() => {
    stickToBottomRef.current = true;
    setUnseen(0);
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, []);

  // Cargar stickers al abrir el panel
  useEffect(() => {
    if (!stickersOpen) return;
    (async () => {
      try {
        const st = await fetchMyStickers();
        setMyStickers(st);
        const paths = st.map((s) => s.path);
        const signed = await signMedia(paths);
        const map = new Map<string, string>();
        paths.forEach((p, i) => map.set(p, signed[i] ?? p));
        setSignedStickers(map);
      } catch {
        /* noop */
      }
    })();
  }, [stickersOpen]);

  /** Muestra el motivo real de un fallo de envío, con acción directa si aplica (instalar esquema). */
  const reportSendError = useCallback((err: unknown) => {
    const detail = sendErrorDetail(err);
    toast.error(detail.title, {
      description: detail.desc,
      action:
        detail.action === "install"
          ? {
              label: "INSTALAR CHAT",
              onClick: () => {
                setInstallToken(SUPABASE_ACCESS_TOKEN ?? "");
                setInstallResult(null);
                setInstallOpen(true);
              },
            }
          : undefined,
    });
  }, []);

  const handleSend = useCallback(
    async (mediaUrl?: string) => {
      const content = draft.trim();
      if (!chatInfo) {
        toast.error("El chat aún no está conectado", {
          description: initError === "schema" ? "Instala las tablas del chat con el botón de abajo." : "Reintenta en unos segundos.",
        });
        return;
      }
      if (!content && !mediaUrl) return;
      try {
        const sent = await sendChatMessage(chatInfo.id, {
          content: content || undefined,
          mediaUrl: mediaUrl ?? undefined,
          replyToId: replyTo?.id ?? null,
        });
        // Eco inmediato (el realtime lo confirmará; se deduplica por id).
        setMessages((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]));
        setDraft("");
        setReplyTo(null);
        setStickersOpen(false);
        if (inputRef.current) inputRef.current.style.height = "auto";
        // Si hay mensajes pendientes por un fallo de red anterior, la conexión
        // acaba de funcionar: los reenviamos ahora mismo.
        void flushPendingMessages()
          .then((n) => {
            if (n > 0)
              toast.success(n === 1 ? "Tu mensaje pendiente se envió ✓" : `Se enviaron ${n} mensajes pendientes ✓`);
          })
          .catch(() => {});
      } catch (err) {
        // Fallo de red: guardamos el mensaje en la cola local y se reenviará solo.
        if (isNetworkError(err) && chatInfo) {
          queuePendingMessage(chatInfo.id, {
            content: content || undefined,
            mediaUrl,
            mediaType: mediaUrl ? "image" : undefined,
            replyToId: replyTo?.id ?? null,
          });
        }
        reportSendError(err);
      }
    },
    [chatInfo, draft, replyTo, initError]
  );

  const copyMessage = useCallback(async (m: ChatMessage) => {
    if (!m.content) return;
    try {
      await navigator.clipboard.writeText(m.content);
      setCopiedId(m.id);
      setTimeout(() => setCopiedId((c) => (c === m.id ? null : c)), 1400);
    } catch {
      /* noop */
    }
  }, []);

  const publishAnnouncement = useCallback(async () => {
    const text = announceText.trim();
    if (!chatInfo || !text) return;
    setAnnounceBusy(true);
    setAnnounceErr(null);
    const r = await createAnnouncement(chatInfo.id, text);
    setAnnounceBusy(false);
    if (!r.ok) {
      setAnnounceErr(r.error ?? "No se pudo publicar el aviso");
      return;
    }
    if (r.message) {
      const msg = r.message;
      setMessages((prev) => (prev.some((x) => x.id === msg.id) ? prev : [...prev, msg]));
      void loadSenders([msg]);
    }
    setAnnounceOpen(false);
    setAnnounceText("");
    toast.success("Aviso publicado para toda la comunidad");
  }, [chatInfo, announceText, loadSenders]);

  const createGiftPackage = useCallback(async () => {
    if (!chatInfo) return;
    const amount = Math.floor(Number(giftAmount) || 0);
    const people = Math.floor(Number(giftPeople) || 0);
    if (amount < 100 || amount % 2 !== 0) {
      setGiftErr("La cantidad por persona debe ser par y de mínimo 100 orbes.");
      return;
    }
    if (people < 1 || people > 1000) {
      setGiftErr("La cantidad de personas debe estar entre 1 y 1000.");
      return;
    }
    if (myOrbes != null && amount * people > myOrbes) {
      setGiftErr(`Necesitas ${amount * people} orbes y tienes ${myOrbes}.`);
      return;
    }
    setGiftBusy(true);
    setGiftErr(null);
    const r = await createOrbGift(chatInfo.id, {
      title: giftTitle.trim(),
      amountPerPerson: amount,
      maxClaims: people,
    });
    setGiftBusy(false);
    if (!r.ok) {
      setGiftErr(r.error ?? "No se pudo crear el paquete de regalos");
      return;
    }
    if (r.message) {
      const msg = r.message;
      setMessages((prev) => (prev.some((x) => x.id === msg.id) ? prev : [...prev, msg]));
      void loadSenders([msg]);
    }
    if (r.giftId) {
      const g = await fetchOrbGift(r.giftId).catch(() => null);
      if (g) {
        giftsRef.current.set(g.id, g);
        setGifts(new Map(giftsRef.current));
      }
    }
    setGiftOpen(false);
    setGiftTitle("");
    setGiftAmount("200");
    setGiftPeople("5");
    setMyOrbes((o) => (o == null ? o : Math.max(0, o - amount * people)));
    toast.success("¡Paquete de regalos creado!", { description: `Se descontaron ${amount * people} orbes de tu cuenta` });

  }, [chatInfo, giftTitle, giftAmount, giftPeople, myOrbes, loadSenders]);

  const handleClaimGift = useCallback(async (giftId: string) => {
    if (claimingId) return;
    setClaimingId(giftId);
    const r = await claimOrbGift(giftId);
    setClaimingId(null);
    if (!r.ok) {
      toast.error(r.error ?? "No se pudo abrir el regalo");
      const g = await fetchOrbGift(giftId).catch(() => null);
      if (g) {
        giftsRef.current.set(giftId, g);
        setGifts(new Map(giftsRef.current));
      }
      return;
    }
    const amount = r.amount ?? 0;
    setMyClaims((prev) => new Map(prev).set(giftId, amount));
    const g = await fetchOrbGift(giftId).catch(() => null);
    if (g) {
      giftsRef.current.set(giftId, g);
      setGifts(new Map(giftsRef.current));
    }
    toast.success(`¡+${amount} orbes a tu cuenta!`);
  }, [claimingId]);

  // Caduca un paquete que superó las 24 h: el servidor devuelve al creador
  // los orbes que nadie reclamó y el realtime avisa a todos los clientes.
  const handleExpireGift = useCallback(async (giftId: string) => {
    if (expiringId) return;
    setExpiringId(giftId);
    const closed = await expireOrbGifts();
    setExpiringId(null);
    const g = await fetchOrbGift(giftId).catch(() => null);
    if (g) {
      giftsRef.current.set(giftId, g);
      setGifts(new Map(giftsRef.current));
    }
    if (closed > 0) {
      const unclaimed = g ? Math.max(0, g.total_orbes - g.claims * g.amount_per_person) : 0;
      toast.info("Paquete caducado", { description: `${unclaimed.toLocaleString("es")} orbes no reclamados se devolvieron al creador` });
    }
  }, [expiringId]);

  const onPickStickerFile = useCallback(
    async (file: File | null) => {
      if (!file || !chatInfo) return;      setStickerUploading(true);
    try {
      const { path, id } = await uploadSticker(file);
      const [signed] = await signMedia([path]);
      // Aparece al instante en la biblioteca de stickers de la cuenta.
      if (id) setMyStickers((prev) => [{ id, path, title: "Sticker" }, ...prev.filter((s) => s.path !== path)]);
      setSignedStickers((prev) => new Map(prev).set(path, signed));
      signedMediaRef.current = new Map(signedMediaRef.current).set(path, signed);
      setSignedMedia(signedMediaRef.current);
      // Guardamos la RUTA (no una URL firmada que expira): el media es permanente.
      try {
        const sent = await sendChatMessage(chatInfo.id, { mediaUrl: path, replyToId: replyTo?.id ?? null });
        setMessages((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]));
        setReplyTo(null);
      } catch (err) {
        if (isNetworkError(err)) {
          queuePendingMessage(chatInfo.id, { mediaUrl: path, mediaType: "image", replyToId: replyTo?.id ?? null });
        }
        reportSendError(err);
      }
    } catch (err) {
      toast.error("No se pudo subir el sticker", { description: sendErrorDetail(err).desc });
    } finally {
      setStickerUploading(false);
    }
  },
  [chatInfo, replyTo]
);

  const onDeleteSticker = useCallback(async (id: string) => {
    try {
      await deleteSticker(id);
      setMyStickers((prev) => prev.filter((s) => s.id !== id));
    } catch {
      toast.error("No se pudo eliminar el sticker");
    }
  }, []);

  // ───── Audio de voz ─────
  const startRecording = useCallback(async () => {
    if (recording || sendingAudio) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recChunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recChunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
      setRecSeconds(0);
      setStickersOpen(false);
      recTimerRef.current = setInterval(() => setRecSeconds((s) => s + 1), 1000);
    } catch {
      toast.error("No se pudo acceder al micrófono", {
        description: "Permite el acceso al micrófono en el navegador e inténtalo de nuevo.",
      });
    }
  }, [recording, sendingAudio]);

  const stopRecording = useCallback(
    async (send: boolean) => {
      const rec = recorderRef.current;
      if (!rec || rec.state === "inactive") {
        setRecording(false);
        if (recTimerRef.current) clearInterval(recTimerRef.current);
        return;
      }
      if (recTimerRef.current) clearInterval(recTimerRef.current);
      setRecording(false);
      if (!send) {
        try {
          rec.onstop = null;
          rec.stop();
        } catch { /* noop */ }
        recChunksRef.current = [];
        return;
      }

      const done = new Promise<Blob>((resolve) => {
        rec.onstop = () => {
          rec.stream?.getTracks().forEach((t) => t.stop());
          // El último dataavailable se entrega justo antes de stop: leemos el ref aquí.
          const blob = new Blob(recChunksRef.current, { type: rec.mimeType || "audio/webm" });
          recChunksRef.current = [];
          resolve(blob);
        };
      });
      rec.stop();
      const blob = await done;
      if (!blob.size || !chatInfo) {
        toast.error("La grabación quedó vacía");
        return;
      }
      setSendingAudio(true);
      let audioPath: string | null = null;
      try {
        const path = await uploadChatMedia(new File([blob], "voice.webm", { type: blob.type || "audio/webm" }), myId ?? "me");
        audioPath = path;
        const [signed] = await signMedia([path]);
        signedMediaRef.current = new Map(signedMediaRef.current).set(path, signed);
        setSignedMedia(signedMediaRef.current);
        // Guardamos la RUTA: la URL se firma en pantalla y nunca expira en la base.
        const sent = await sendChatMessage(chatInfo.id, {
          mediaUrl: path,
          mediaType: "audio",
          replyToId: replyTo?.id ?? null,
        });
        setMessages((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]));
        setReplyTo(null);
      } catch (err) {
        if (audioPath && isNetworkError(err) && chatInfo) {
          queuePendingMessage(chatInfo.id, { mediaUrl: audioPath, mediaType: "audio", replyToId: replyTo?.id ?? null });
        }
        reportSendError(err);
      } finally {
        setSendingAudio(false);
      }
    },
    [chatInfo, replyTo, myId]
  );

  // Si cierras el chat grabando, detén el micrófono y el timer.
  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        try {
          recorderRef.current.onstop = null;
          recorderRef.current.stop();
        } catch { /* noop */ }
      }
      if (recTimerRef.current) clearInterval(recTimerRef.current);
    };
  }, []);

  const textareaAutoGrow = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="fixed inset-0 z-[90] bg-background/97 backdrop-blur-xl flex flex-col md:mx-auto md:max-w-3xl md:border-x md:border-border/60 md:shadow-2xl"
      style={{ height: "100dvh" }}
    >
      {/* ───── Header ───── */}
      <header className="shrink-0 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="max-w-2xl md:max-w-full mx-auto flex items-center gap-2 px-4 py-3">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div
              className="rounded-full grid place-items-center shrink-0 font-display font-semibold text-primary-foreground"
              style={{ width: 36, height: 36, fontSize: 15, background: "linear-gradient(135deg, var(--color-primary), var(--color-accent))" }}
            >
              <Users size={16} />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">{chatInfo?.name ?? COMMUNITY_CHAT_NAME}</div>
              <div className="text-[10px] text-muted-foreground">
                {chatInfo
                  ? chatInfo.memberOk === false
                    ? "chat compartido · permisos por reparar"
                    : `${chatInfo.memberCount} ${chatInfo.memberCount === 1 ? "miembro" : "miembros"} · chat compartido`
                  : loading
                    ? "Conectando…"
                    : initError
                      ? "Sin conexión"
                      : "Conectando…"}
              </div>
            </div>
          </div>
          {isOwner && (
            <button
              onClick={() => {
                setAnnounceErr(null);
                setAnnounceText("");
                setAnnounceOpen(true);
              }}
              title="Publicar aviso del grupo"
              className="w-9 h-9 rounded-xl border border-primary/40 bg-primary/10 text-primary grid place-items-center active:scale-95 transition shrink-0 hover:bg-primary/20"
            >
              <Megaphone size={15} />
            </button>
          )}
          {!isLocal && (
            <button
              onClick={() => {
                setGiftErr(null);
                setGiftAmount("200");
                setGiftPeople("5");
                setGiftOpen(true);
                void getMyOrbes()
                  .then(setMyOrbes)
                  .catch(() => setMyOrbes(null));
              }}
              title="Crear paquete de regalos"
              className="w-9 h-9 rounded-xl border border-primary/40 bg-primary/10 text-primary grid place-items-center active:scale-95 transition shrink-0 hover:bg-primary/20"
            >
              <Gift size={15} />
            </button>
          )}
          <button
            onClick={() => {
              setInstallToken(SUPABASE_ACCESS_TOKEN ?? "");
              setInstallResult(null);
              setInstallOpen(true);
            }}
            title="Instalar / reparar tablas del chat"
            className="w-9 h-9 rounded-xl border border-border/70 bg-background grid place-items-center active:scale-95 transition shrink-0 hover:border-primary/40 hover:text-primary"
          >
            <Database size={15} />
          </button>
          <button onClick={onClose} className="w-9 h-9 rounded-xl border border-border/70 bg-background grid place-items-center active:scale-95 transition shrink-0">
            <X size={16} />
          </button>
        </div>
      </header>

      {/* Aviso de modo local */}
      {isLocal && (
        <div className="shrink-0 mx-3 mt-2 px-3 py-2 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-center gap-2">
          <span className="flex-1 text-[11px] text-amber-700 dark:text-amber-300">
            {hasSupabaseConfig()
              ? "Chat local: tu cuenta actual no está en Supabase, así que los mensajes se guardan solo en este dispositivo. Entra con tu cuenta de Supabase (⋮ → Cerrar sesión → login) para compartirlos con la comunidad."
              : "Modo local: los mensajes no se comparten entre dispositivos. Conecta tu base de datos para el chat comunitario."}
          </span>
          {hasSupabaseConfig() ? (
            <Link
              to="/auth"
              className="shrink-0 px-2.5 py-1 rounded-lg bg-gradient-to-br from-primary to-accent text-primary-foreground text-[10px] font-display tracking-widest active:scale-95 transition"
            >
              INICIAR SESIÓN
            </Link>
          ) : (
            <button
              onClick={() => setConnecting(true)}
              className="shrink-0 px-2.5 py-1 rounded-lg bg-gradient-to-br from-primary to-accent text-primary-foreground text-[10px] font-display tracking-widest active:scale-95 transition"
            >
              CONECTAR
            </button>
          )}
        </div>
      )}

      {/* Error de conexión / esquema / sesión del chat */}
      {initError && !chatInfo && !loading && (
        <div className="shrink-0 mx-3 mt-2 px-3 py-3 rounded-xl border border-rose-500/25 bg-rose-500/[0.06] space-y-2.5">
          <div className="flex items-start gap-2.5">
            <WifiOff size={15} className="text-rose-500 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed text-muted-foreground">
              {initError === "schema" ? (
                <>
                  <span className="font-semibold text-foreground">Las tablas del chat no existen</span>{" "}
                  en tu base de datos. Pulsa «Instalar chat» (necesita tu token{" "}
                  <span className="font-mono">sbp_…</span> de Supabase) o abre el menú (⋮) → <b>Supabase</b> →{" "}
                  <b>Crear esquema</b>.
                </>
              ) : initError === "rls" ? (
                <>
                  <span className="font-semibold text-foreground">Permisos del chat desactualizados</span>{" "}
                  (una instalación anterior dejó políticas que se bloquean entre sí). Pulsa{" "}
                  <b>«Instalar chat»</b> con tu token <span className="font-mono">sbp_…</span> para limpiarlas y
                  reinstalarlas. La anon key <span className="font-mono">eyJ…</span> no puede reparar
                  permisos: solo sirve para leer y escribir.
                </>
              ) : initError === "auth" ? (
                <>
                  <span className="font-semibold text-foreground">Inicia sesión para usar el chat.</span>{" "}
                  {errorDetail.includes("base de datos está conectada")
                    ? "Tu base está conectada pero esta cuenta es local: los permisos de Supabase exigen la cuenta real. Entra con ella y vuelve."
                    : "El chat comunitario necesita una sesión activa."}
                </>
              ) : (
                <>
                  <span className="font-semibold text-foreground">No se pudo conectar al chat.</span>{" "}
                  {connHint(errorDetail)}
                </>
              )}
            </div>
          </div>
          {(initError === "conn" || initError === "rls") && errorDetail && (
            <p className="text-[10px] font-mono text-muted-foreground/50 break-words bg-black/[0.03] dark:bg-white/[0.04] rounded-lg px-2 py-1.5">
              {errorDetail.slice(0, 220)}
            </p>
          )}
          <div className="flex gap-2">
            {(initError === "schema" || initError === "rls") && (
              <button
                onClick={() => {
                  setInstallToken(SUPABASE_ACCESS_TOKEN ?? "");
                  setInstallResult(null);
                  setInstallOpen(true);
                }}
                className="flex-1 py-2 rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground text-[10px] font-display tracking-widest active:scale-[0.98] transition flex items-center justify-center gap-1.5"
              >
                <Database size={12} /> INSTALAR CHAT
              </button>
            )}
            {initError === "auth" && (
              <Link
                to="/auth"
                className="flex-1 py-2 rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground text-[10px] font-display tracking-widest active:scale-[0.98] transition flex items-center justify-center gap-1.5"
              >
                <KeyRound size={12} /> INICIAR SESIÓN
              </Link>
            )}
            <button
              onClick={() => setRetryKey((k) => k + 1)}
              className="flex-1 py-2 rounded-xl border border-border bg-background text-[10px] font-display tracking-widest active:scale-[0.98] transition flex items-center justify-center gap-1.5"
            >
              <RefreshCw size={12} /> REINTENTAR
            </button>
          </div>
        </div>
      )}

      {/* Aviso: la tabla del chat está desactualizada (falta media_type) */}
      {chatInfo && schemaOutdated && (
        <div className="shrink-0 mx-3 mt-2 px-3 py-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-start gap-2">
          <AlertTriangle size={13} className="text-amber-500 shrink-0 mt-0.5" />
          <span className="flex-1 text-[11px] leading-relaxed text-amber-700 dark:text-amber-300">
            <span className="font-semibold">La tabla del chat está desactualizada:</span> falta la columna
            para el audio de voz. Pulsa{" "}
            <button
              onClick={() => {
                setInstallToken(SUPABASE_ACCESS_TOKEN ?? "");
                setInstallResult(null);
                setInstallOpen(true);
              }}
              className="underline font-semibold active:opacity-70"
            >
              «Instalar chat»
            </button>{" "}
            con tu token <span className="font-mono">sbp_…</span> para actualizarla (los mensajes de texto y
            los stickers funcionan igualmente).
          </span>
        </div>
      )}

      {/* Aviso no bloqueante: las políticas de miembros quedaron rotas pero el chat sigue usable */}
      {chatInfo && chatInfo.memberOk === false && (
        <div className="shrink-0 mx-3 mt-2 px-3 py-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-start gap-2">
          <AlertTriangle size={13} className="text-amber-500 shrink-0 mt-0.5" />
          <span className="flex-1 text-[11px] leading-relaxed text-amber-700 dark:text-amber-300">
            <span className="font-semibold">Los mensajes cargan, pero quedaron políticas antiguas</span> que
            bloquean el registro de miembros. Pulsa{" "}
            <button
              onClick={() => {
                setInstallToken(SUPABASE_ACCESS_TOKEN ?? "");
                setInstallResult(null);
                setInstallOpen(true);
              }}
              className="underline font-semibold active:opacity-70"
            >
              «Instalar chat»
            </button>{" "}
            para repararlo (necesita tu token <span className="font-mono">sbp_…</span>).
          </span>
        </div>
      )}

      {/* ───── Mensajes ───── */}
      <div ref={listRef} onScroll={onScrollList} className="relative flex-1 overflow-y-auto px-3 py-4 space-y-3 no-scrollbar min-h-0">
        {loadingMore && (
          <div className="flex justify-center py-1">
            <Loader2 size={14} className="animate-spin text-muted-foreground" />
          </div>
        )}
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 size={18} className="animate-spin text-muted-foreground" />
          </div>
        ) : !chatInfo ? null : !messages.length ? (
          <div className="text-center text-xs text-muted-foreground py-10">
            Sé el primero en saludar a la comunidad 👋
          </div>
        ) : (
          messages.map((m) =>
            isAnnouncement(m) ? (
              <AnnouncementCard key={m.id} m={m} sender={senders.get(m.sender_id)} />
            ) : isGiftMessage(m) ? (
              <GiftCard
                key={m.id}
                m={m}
                gift={m.gift_id ? gifts.get(m.gift_id) ?? null : null}
                claiming={claimingId === m.gift_id}
                expiring={expiringId === m.gift_id}
                claimedAmount={m.gift_id ? myClaims.get(m.gift_id) : undefined}
                onClaim={() => m.gift_id && void handleClaimGift(m.gift_id)}
                onExpire={() => m.gift_id && void handleExpireGift(m.gift_id)}
              />
            ) : (
              <MessageBubble
                key={m.id}
                m={m}
                mine={m.sender_id === myId}
                sender={senders.get(m.sender_id)}
                reply={m.reply_to_id ? messages.find((x) => x.id === m.reply_to_id) ?? null : null}
                mediaUrl={resolveMediaUrl(m.media_url, signedMedia)}
                copied={copiedId === m.id}
                onCopy={() => void copyMessage(m)}
                onReply={() => {
                  setReplyTo(m);
                  setStickersOpen(false);
                  inputRef.current?.focus();
                }}
              />
            )
          )
        )}
        <div ref={endRef} />
        {unseen > 0 && (
          <button
            onClick={jumpToBottom}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground text-[11px] font-display tracking-wide shadow-lg active:scale-95 transition"
          >
            <ArrowDown size={12} /> {unseen} nuevo{unseen > 1 ? "s" : ""}
          </button>
        )}
      </div>

      {/* ───── Barra de respuesta ───── */}
      <AnimatePresence>
        {replyTo && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15 }}
            className="mx-3 mb-1.5 flex items-center gap-2 px-3 py-1.5 rounded-xl border border-primary/25 bg-primary/5"
          >
            <Reply size={12} className="text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-display tracking-wider text-primary">
                RESPONDIENDO A{" "}
                {senders.get(replyTo.sender_id)?.display_name?.toUpperCase() ||
                  senders.get(replyTo.sender_id)?.username?.toUpperCase() ||
                  ""}
              </div>
              <div className="text-[11px] text-muted-foreground truncate">
                {isAudioMessage(replyTo) ? "🎤 Audio de voz" : replyTo.media_url ? "🖼️ Sticker" : replyTo.content || ""}
              </div>
            </div>
            <button onClick={() => setReplyTo(null)} className="w-6 h-6 grid place-items-center rounded-md hover:bg-muted/70 text-muted-foreground shrink-0">
              <X size={12} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ───── Barra de escritura ───── */}
      <div className="shrink-0 px-3 pb-[max(env(safe-area-inset-bottom),12px)] pt-1.5">
        <div className="relative flex items-end gap-2 bg-card border border-border rounded-2xl px-3 py-2 shadow-sm">
          {recording ? (
            /* ── Grabando: timer + cancelar + enviar ── */
            <div className="flex-1 flex items-center gap-2 py-1">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse shrink-0" />
              <span className="font-mono tabular-nums text-sm">
                {String(Math.floor(recSeconds / 60)).padStart(2, "0")}:{String(recSeconds % 60).padStart(2, "0")}
              </span>
              <span className="text-[11px] text-muted-foreground truncate flex-1">Grabando… mantén cerca el teléfono</span>
              <button
                onClick={() => void stopRecording(false)}
                title="Descartar grabación"
                className="w-9 h-9 rounded-xl border border-border grid place-items-center text-muted-foreground active:scale-95 transition shrink-0"
              >
                <Trash2 size={15} />
              </button>
              <button
                onClick={() => void stopRecording(true)}
                disabled={sendingAudio}
                className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 text-white grid place-items-center active:scale-95 transition shrink-0 shadow-[0_4px_12px_-5px_oklch(0.577_0.245_27.3/0.5)] disabled:opacity-50"
                title="Enviar audio"
              >
                {sendingAudio ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} />}
              </button>
            </div>
          ) : (
            <>
          <button
            onClick={() => setStickersOpen((o) => !o)}
            className={`w-9 h-9 rounded-xl grid place-items-center active:scale-95 transition shrink-0 ${stickersOpen ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/60"}`}
          >
            <SmilePlus size={18} />
          </button>
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              textareaAutoGrow(e.target);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            enterKeyHint="send"
            rows={1}
            placeholder="Escribe un mensaje…"
            className="flex-1 resize-none bg-transparent outline-none text-sm leading-snug py-1.5 max-h-[120px] placeholder:text-muted-foreground/60"
          />
          <button
            onClick={() => void handleSend()}
            disabled={!draft.trim()}
            className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground grid place-items-center active:scale-95 transition shrink-0 disabled:opacity-40 disabled:active:scale-100 shadow-[0_4px_12px_-5px_oklch(0.488_0.185_264/0.5)]"
          >
            <Send size={15} />
          </button>
          <button
            onClick={() => void startRecording()}
            disabled={sendingAudio}
            title="Grabar audio de voz"
            className="w-9 h-9 rounded-xl border border-border/70 grid place-items-center text-muted-foreground hover:text-rose-500 hover:border-rose-400/40 active:scale-95 transition shrink-0 disabled:opacity-40"
          >
            <Mic size={16} />
          </button>
            </>
          )}

          {/* Panel de stickers */}
          <AnimatePresence>
            {stickersOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.98 }}
                transition={{ duration: 0.16, ease: "easeOut" }}
                className="absolute bottom-full left-0 right-0 mb-2 bg-card border border-border rounded-2xl shadow-xl p-3 z-20"
              >
                <div className="text-[10px] font-display tracking-widest text-muted-foreground mb-2">
                  TUS STICKERS{myStickers.length > 0 ? ` (${myStickers.length})` : ""} · se guardan en tu cuenta
                </div>
                {myStickers.length === 0 ? (
                  <div className="text-[11px] text-muted-foreground text-center py-4">
                    Aún no tienes stickers guardados. Sube el primero 👇
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {myStickers.map((s) => (
                      <div
                        key={s.id}
                        className="relative aspect-square rounded-xl overflow-hidden border border-border hover:border-primary/50 group/st"
                      >
                        <button
                          onClick={() => void handleSend(signedStickers.get(s.path) ?? s.path)}
                          title={s.title}
                          className="w-full h-full active:scale-95 transition"
                        >
                          <img
                            src={signedStickers.get(s.path) ?? s.path}
                            alt={s.title}
                            className="w-full h-full object-cover group-hover/st:scale-105 transition-transform"
                          />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            void onDeleteSticker(s.id);
                          }}
                          title="Eliminar sticker"
                          className="absolute top-1 right-1 w-5 h-5 rounded-md bg-black/60 text-white grid place-items-center opacity-0 group-hover/st:opacity-100 transition active:scale-90"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={stickerUploading}
                  className="mt-2.5 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-primary/40 text-primary text-[11px] font-display tracking-widest hover:bg-primary/5 active:scale-[0.98] transition disabled:opacity-40"
                >
                  {stickerUploading ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
                  SUBIR STICKER
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    e.target.value = "";
                    void onPickStickerFile(f);
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Diálogo de conexión (solo modo local) */}
      <AnimatePresence>
        {connecting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[95] bg-black/55 backdrop-blur-md grid place-items-center p-4"
            onClick={() => setConnecting(false)}
          >
            <motion.div
              initial={{ scale: 0.96, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 8 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-card border border-border rounded-2xl p-4 shadow-xl"
            >
              <div className="text-sm font-semibold mb-0.5">Conectar Supabase</div>
              <p className="text-[11px] text-muted-foreground mb-3">
                Pega la URL y la anon key de tu proyecto (están en Keys como V1 y V2). Los mensajes y la comunidad se sincronizarán entre dispositivos. Si tras conectar el chat sigue sin cargar, instala las tablas del chat con el botón «Instalar chat» que aparece abajo.
              </p>
              <input
                value={connectUrl}
                onChange={(e) => setConnectUrl(e.target.value)}
                placeholder="https://xxxx.supabase.co"
                className="w-full bg-input/50 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 border border-border/60 mb-2"
              />
              <input
                value={connectKey}
                onChange={(e) => {
                  setConnectKey(e.target.value);
                  setConnectError(null);
                }}
                placeholder="eyJhbGciOi… (anon key, no tu token sbp_…)"
                className="w-full bg-input/50 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 border border-border/60 mb-2"
              />
              {connectError && (
                <div className="mb-3 rounded-lg border border-rose-500/30 bg-rose-500/[0.06] px-3 py-2 text-[11px] text-rose-700 dark:text-rose-300 flex items-start gap-1.5">
                  <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                  <span>{connectError}</span>
                </div>
              )}
              <p className="text-[10px] text-muted-foreground/60 leading-relaxed mb-3">
                ⚠️ <b>No pegues aquí tu token de acceso personal (sbp_…)</b> — ese solo sirve para instalar
                tablas y rompería la app con «Invalid API key». La anon key es el JWT que empieza por{" "}
                <span className="font-mono">eyJ…</span> (Project Settings → API Keys).
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConnecting(false)}
                  className="flex-1 py-2 rounded-xl border border-border bg-background text-xs font-display tracking-widest active:scale-[0.98] transition"
                >
                  CANCELAR
                </button>
                <button
                  onClick={doConnect}
                  disabled={!connectUrl.trim() || !connectKey.trim()}
                  className="flex-1 py-2 rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground text-xs font-display tracking-widest active:scale-[0.98] transition disabled:opacity-40"
                >
                  CONECTAR
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Diálogo de instalación de las tablas del chat */}
      <AnimatePresence>
        {installOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[95] bg-black/55 backdrop-blur-md grid place-items-center p-4"
            onClick={() => setInstallOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.96, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 8 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-card border border-border rounded-2xl p-4 shadow-xl"
            >
              <div className="text-sm font-semibold mb-0.5 flex items-center gap-2">
                <Database size={15} className="text-primary" /> Instalar tablas del chat
              </div>
              <p className="text-[11px] text-muted-foreground mb-3">
                Tu clave anon no puede crear tablas. Pega tu token de acceso personal (Supabase Dashboard →{" "}
                <b>Account → Access Tokens → Generate new token</b>) y la app creará{" "}
                <b>chats</b>, <b>chat_members</b> y <b>chat_messages</b> al instante.
              </p>
              <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5 mb-1.5">
                <KeyRound size={12} /> Token de acceso personal (sbp_…)
              </label>
              <input
                value={installToken}
                onChange={(e) => setInstallToken(e.target.value)}
                type="password"
                placeholder="sbp_xxxxxxxxxxxxxxxx"
                autoComplete="off"
                className="w-full bg-input/50 rounded-xl px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-primary/40 border border-border/60 mb-3"
              />
              {installResult && (
                <div
                  className={`mb-3 rounded-xl border p-2.5 text-[11px] flex items-start gap-2 ${
                    installOk
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                  }`}
                >
                  {installOk ? <CheckCircle2 size={13} className="shrink-0 mt-0.5" /> : <AlertTriangle size={13} className="shrink-0 mt-0.5" />}
                  <span className="break-words">{installResult}</span>
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => setInstallOpen(false)}
                  className="flex-1 py-2 rounded-xl border border-border bg-background text-xs font-display tracking-widest active:scale-[0.98] transition"
                >
                  CANCELAR
                </button>
                <button
                  onClick={async () => {
                    if (!installToken.trim().startsWith("sbp_")) return;
                    setInstalling(true);
                    setInstallResult(null);
                    const r = await runChatSchemaSetup(installToken.trim());
                    setInstalling(false);
                    let msg = r.message;
                    if (!r.ok && /invalid api key|unauthorized|401|forbidden/i.test(r.message)) {
                      msg =
                        "Tu token de acceso (sbp_…) no es válido o expiró. Genérate uno nuevo en Supabase → Account → Access Tokens. " +
                        "Recuerda: el token sbp_ no es la anon key (esa empieza por eyJ…).";
                    }
                    setInstallResult(msg);
                    setInstallOk(r.ok);
                    if (r.ok) {
                      toast.success("Tablas del chat instaladas");
                      setInstallOpen(false);
                      setRetryKey((k) => k + 1);
                    }
                  }}
                  disabled={installing || !installToken.trim().startsWith("sbp_")}
                  className="flex-1 py-2 rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground text-xs font-display tracking-widest active:scale-[0.98] transition disabled:opacity-40 flex items-center justify-center gap-1.5"
                >
                  {installing ? <Loader2 size={13} className="animate-spin" /> : <Plug size={13} />}
                  {installing ? "INSTALANDO…" : "INSTALAR"}
                </button>
              </div>

              {/* Respaldo manual: copiar el SQL / abrir el SQL Editor */}
              <div className="mt-3 pt-3 border-t border-border/60 space-y-2">
                <div className="text-[10px] text-muted-foreground/70 leading-relaxed">
                  ¿El botón de arriba falla (CORS o token)? Copia el SQL y pégalo en el SQL Editor de tu
                  proyecto (limpia las políticas antiguas y las reinstala).
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => void copyChatSql()}
                    className="flex-1 py-2 rounded-xl border border-border bg-background text-[10px] font-display tracking-widest active:scale-[0.98] transition flex items-center justify-center gap-1.5"
                  >
                    {copiedSql ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                    {copiedSql ? "¡COPIADO!" : "COPIAR SQL"}
                  </button>
                  {sqlEditorUrl(getSupabaseUrl() ?? "") && (
                    <a
                      href={sqlEditorUrl(getSupabaseUrl() ?? "") ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 py-2 rounded-xl border border-border bg-background text-[10px] font-display tracking-widest transition flex items-center justify-center gap-1.5 hover:text-primary hover:border-primary/40"
                    >
                      <ExternalLink size={12} /> ABRIR SQL EDITOR
                    </a>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Diálogo: publicar aviso del grupo (solo admin) */}
      <AnimatePresence>
        {announceOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[95] bg-black/55 backdrop-blur-md grid place-items-center p-4"
            onClick={() => setAnnounceOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.96, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 8 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-card border border-border rounded-2xl p-4 shadow-xl"
            >
              <div className="text-sm font-semibold mb-0.5 flex items-center gap-2">
                <Megaphone size={15} className="text-primary" /> Publicar aviso del grupo
              </div>
              <p className="text-[11px] text-muted-foreground mb-3">
                El aviso aparece destacado para toda la comunidad en el chat. Solo tu cuenta de
                administrador puede publicar avisos.
              </p>
              <textarea
                value={announceText}
                onChange={(e) => {
                  setAnnounceText(e.target.value);
                  setAnnounceErr(null);
                }}
                rows={4}
                maxLength={500}
                placeholder="Escribe el aviso…"
                className="w-full bg-input/50 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 border border-border/60 mb-2 resize-none"
              />
              {announceErr && (
                <div className="mb-3 rounded-lg border border-rose-500/30 bg-rose-500/[0.06] px-3 py-2 text-[11px] text-rose-700 dark:text-rose-300 flex items-start gap-1.5">
                  <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                  <span>{announceErr}</span>
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => setAnnounceOpen(false)}
                  className="flex-1 py-2 rounded-xl border border-border bg-background text-xs font-display tracking-widest active:scale-[0.98] transition"
                >
                  CANCELAR
                </button>
                <button
                  onClick={() => void publishAnnouncement()}
                  disabled={announceBusy || !announceText.trim()}
                  className="flex-1 py-2 rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground text-xs font-display tracking-widest active:scale-[0.98] transition disabled:opacity-40 flex items-center justify-center gap-1.5"
                >
                  {announceBusy ? <Loader2 size={13} className="animate-spin" /> : <Megaphone size={13} />}
                  {announceBusy ? "PUBLICANDO…" : "PUBLICAR AVISO"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Diálogo: crear paquete de regalos (solo admin) */}
      <AnimatePresence>
        {giftOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[95] bg-black/55 backdrop-blur-md grid place-items-center p-4"
            onClick={() => setGiftOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.96, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 8 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-card border border-border rounded-2xl p-4 shadow-xl"
            >
              <div className="text-sm font-semibold mb-0.5 flex items-center gap-2">
                <PartyPopper size={15} className="text-primary" /> Crear paquete de regalos
              </div>
              <p className="text-[11px] text-muted-foreground mb-3">
                Regala orbes a la comunidad: elige cuántos orbes por persona (par, mínimo 100) y
                cuántas personas pueden abrirlo. Al llenarse, el paquete se cierra con animación.
              </p>
              <div className="mb-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-[11px] flex items-center gap-2">
                <Sparkles size={12} className="text-primary" />
                <span className="flex-1 text-muted-foreground">Tu saldo actual</span>
                <b>${myOrbes == null ? "…" : myOrbes.toLocaleString()}</b> orbes
              </div>
              <input
                value={giftTitle}
                onChange={(e) => {
                  setGiftTitle(e.target.value);
                  setGiftErr(null);
                }}
                maxLength={80}
                placeholder="Título (opcional) — p. ej. ¡Regalo por el evento!"
                className="w-full bg-input/50 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 border border-border/60 mb-2"
              />
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">
                    Orbes por persona (par, mín. 100)
                  </label>
                  <input
                    type="number"
                    min={100}
                    step={2}
                    value={giftAmount}
                    onChange={(e) => {
                      setGiftAmount(e.target.value);
                      setGiftErr(null);
                    }}
                    className="w-full bg-input/50 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 border border-border/60"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">Personas que pueden abrir</label>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={giftPeople}
                    onChange={(e) => {
                      setGiftPeople(e.target.value);
                      setGiftErr(null);
                    }}
                    className="w-full bg-input/50 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 border border-border/60"
                  />
                </div>
              </div>
              <div className="mb-3 rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-[11px] flex items-center gap-1.5">
                <Gift size={12} className="text-primary" />
                <span className="flex-1 text-muted-foreground">Total a descontar de tu saldo</span>
                <b className="text-primary">
                  ${(Math.floor(Number(giftAmount) || 0) * Math.floor(Number(giftPeople) || 0)).toLocaleString()}
                </b>{" "}
                orbes
              </div>
              {giftErr && (
                <div className="mb-3 rounded-lg border border-rose-500/30 bg-rose-500/[0.06] px-3 py-2 text-[11px] text-rose-700 dark:text-rose-300 flex items-start gap-1.5">
                  <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                  <span>{giftErr}</span>
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => setGiftOpen(false)}
                  className="flex-1 py-2 rounded-xl border border-border bg-background text-xs font-display tracking-widest active:scale-[0.98] transition"
                >
                  CANCELAR
                </button>
                <button
                  onClick={() => void createGiftPackage()}
                  disabled={giftBusy}
                  className="flex-1 py-2 rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground text-xs font-display tracking-widest active:scale-[0.98] transition disabled:opacity-40 flex items-center justify-center gap-1.5"
                >
                  {giftBusy ? <Loader2 size={13} className="animate-spin" /> : <Gift size={13} />}
                  {giftBusy ? "CREANDO…" : "CREAR REGALOS"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}


