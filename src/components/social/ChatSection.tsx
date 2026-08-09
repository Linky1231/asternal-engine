import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Send, Copy, Check, Reply, SmilePlus, ImagePlus, Film, Loader2, Users, Users2, Settings2,
  UserPlus, UserMinus, Camera, Pencil, LogOut, MessageCircle, AtSign, BarChart3, Shield, ShieldCheck,
  ArrowLeft, WifiOff, RefreshCw, CheckCircle2, AlertTriangle, Mic, Play, Pause, Trash2, ArrowDown,
  Megaphone, Gift, PartyPopper, Lock, Sparkles, Timer, Undo2, ChevronRight, CalendarClock, Clock, Pin,
  Briefcase, ClipboardList, FolderOpen, MessagesSquare, Download, Paperclip, MessageSquarePlus, Search,
  KeyRound, ExternalLink,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import logo from "@/assets/logo.svg";
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
  isVideoMessage,
  isImageMessage,
  uploadChatMedia,
  fetchChatProfiles,
  isNetworkError,
  queuePendingMessage,
  flushPendingMessages,
  createAnnouncement,
  createOrbGift,
  claimOrbGift,
  fetchOrbGift,
  expireOrbGifts,
  subscribeToOrbGifts,
  isAnnouncement,
  isGiftMessage,
  isPollMessage,
  createPoll,
  fetchPoll,
  votePoll,
  closePoll,
  subscribeToPolls,
  searchProfilesForMention,
  getOrCreateDm,
  fetchMyDmChats,
  fetchMutualFollows,
  markDmRead,
  createGroupChat,
  fetchMyGroupChats,
  fetchGroupMembers,
  updateGroupChat,
  addGroupMember,
  removeGroupMember,
  leaveGroupChat,
  setGroupRole,
  deleteGroupChat,
  COMMUNITY_CHAT_ID,
  COMMUNITY_CHAT_NAME,
  type ChatMessage,
  type DmChat,
  type GroupChat,
  type GroupMember,
  type ChatPoll,
  type OrbGift,
  type ChatSticker,
  type ScheduledMessage,
  listScheduledMessages,
  scheduleChatMessage,
  cancelScheduledMessage,
  sendDueScheduledMessages,
  type PinnedMessage,
  listPinnedMessages,
  isMessagePinned,
  pinChatMessage,
  unpinChatMessage,
} from "@/lib/social/chat";
import { supabase, hasSupabaseConfig, saveSupabaseCredentials } from "@/integrations/supabase/client";
import { getMyProfile, pushNotification } from "@/lib/social/api";
import type { Profile } from "@/lib/social/api";
import {
  isWorkChat,
  markWorkChat,
  listWorkChats,
  listThreads,
  createThread,
  deleteThread,
  listThreadMessages,
  addThreadMessage,
  type WorkThread,
} from "@/lib/social/work";
import { TaskManager, FileManager, ThreadsManager, ThreadView, ProjectsManager } from "./WorkChatPanel";
import { GlobalSearchPanel } from "./GlobalSearchPanel";
import { UserName } from "./UserName";

/* ─────────────────────────── Helpers ─────────────────────────── */

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

/** Formatea la hora de un mensaje programado: «hoy 14:30» o «12 ago, 09:00». */
function fmtScheduledAt(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const sameDay = d.toDateString() === new Date().toDateString();
  if (sameDay) return `hoy ${hh}:${mm}`;
  return `${d.getDate()} ${d.toLocaleDateString("es", { month: "short" })}, ${hh}:${mm}`;
}

function textareaAutoGrow(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 120) + "px";
}

/** Etiqueta corta de un mensaje según su contenido/media. */
function mediaLabel(m: { content: string | null; media_url: string | null; media_type?: string | null }): string {
  if (isAudioMessage(m as ChatMessage)) return "🎤 Audio de voz";
  if (isVideoMessage(m as ChatMessage)) return "🎬 Vídeo";
  if (isImageMessage(m as ChatMessage)) return "🖼️ Foto";
  if (m.media_url) return "🖼️ Sticker";
  return m.content || "Mensaje";
}

/** Enlace de perfil embebido en un mensaje (URL https://…/profile/<uuid>). */
function extractProfileLink(content: string): string | null {
  const m = content.match(
    /(?:https?:\/\/[^\s]*)?\/profile\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
  );
  return m ? m[1] : null;
}

/** Resalta las menciones @usuario dentro del texto. */
function renderContentWithMentions(content: string, mine: boolean): ReactNode {
  const parts = content.split(/(@[\w.]{1,32})/g);
  return parts.map((p, i) =>
    p.startsWith("@") ? (
      <span key={i} className={`font-semibold ${mine ? "text-primary-foreground/95" : "text-primary"}`}>
        {p}
      </span>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}

function Avatar({ p, name, size = 40 }: { p?: Profile | null; name?: string; size?: number }) {
  const label = (p?.display_name || p?.username || name || "?").trim().charAt(0).toUpperCase();
  return (
    <div
      className="rounded-full overflow-hidden shrink-0 grid place-items-center font-display font-semibold text-primary-foreground"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: "linear-gradient(135deg, var(--color-primary), var(--color-accent))",
      }}
    >
      {p?.avatar_url ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover" /> : label}
    </div>
  );
}

/** Tarjeta de perfil compartido (enlace directo a un perfil). */
function ProfileLinkCard({ userId, name }: { userId: string; name?: string }) {
  return (
    <Link
      to="/profile/$userId"
      params={{ userId }}
      className="mt-1.5 flex items-center gap-2.5 rounded-xl border border-primary/25 bg-primary/[0.06] px-2.5 py-2 hover:bg-primary/10 active:scale-[0.99] transition group/link"
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="rounded-full grid place-items-center shrink-0 font-display font-semibold text-primary-foreground"
        style={{ width: 30, height: 30, fontSize: 12, background: "linear-gradient(135deg, var(--color-primary), var(--color-accent))" }}
      >
        {(name || "P")[0]?.toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold truncate">{name || "Perfil compartido"}</div>
        <div className="text-[9px] font-mono text-muted-foreground truncate flex items-center gap-1">
          <ExternalLink size={9} className="shrink-0" /> Ver perfil
        </div>
      </div>
      <ChevronRight size={13} className="text-muted-foreground/50 group-hover/link:text-primary transition" />
    </Link>
  );
}

/* ─────────────────────── Acciones de burbuja ─────────────────────── */

function BubbleActions({
  mine,
  copied,
  canPin,
  pinned,
  onCopy,
  onReply,
  onPin,
}: {
  mine: boolean;
  copied: boolean;
  canPin: boolean;
  pinned: boolean;
  onCopy: () => void;
  onReply: () => void;
  onPin: () => void;
}) {
  return (
    <div className={`absolute top-1/2 -translate-y-1/2 ${mine ? "-left-2" : "-right-2"} hidden group-hover:flex gap-0.5 bg-background border border-border rounded-lg p-0.5 shadow-md z-10`}>
      <button onClick={onCopy} title="Copiar" className="w-6 h-6 grid place-items-center rounded-md hover:bg-muted/70 text-muted-foreground">
        {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
      </button>
      <button onClick={onReply} title="Responder" className="w-6 h-6 grid place-items-center rounded-md hover:bg-muted/70 text-muted-foreground">
        <Reply size={12} />
      </button>
      {canPin && (
        <button
          onClick={onPin}
          title={pinned ? "Desfijar" : "Fijar"}
          className="w-6 h-6 grid place-items-center rounded-md hover:bg-muted/70 text-muted-foreground"
        >
          <Pin size={12} className={pinned ? "text-primary fill-current" : ""} />
        </button>
      )}
    </div>
  );
}

/* ─────────────────────── Reproductor de audio ─────────────────────── */

function AudioBubble({ url, mine, duration }: { url: string; mine: boolean; duration: number }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dur, setDur] = useState(duration);
  const ref = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const a = ref.current;
    a.onloadedmetadata = () => setDur(a.duration || duration);
    a.ontimeupdate = () => setProgress(a.currentTime);
    a.onended = () => {
      setPlaying(false);
      setProgress(0);
    };
  }, [url, duration]);
  const toggle = () => {
    const a = ref.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      void a.play();
      setPlaying(true);
    }
  };
  const pct = dur > 0 ? Math.min(100, (progress / dur) * 100) : 0;
  return (
    <div className={`flex items-center gap-2 mt-0.5 min-w-[190px] ${mine ? "flex-row" : "flex-row"}`}>
      <audio ref={ref} src={url} preload="metadata" />
      <button
        onClick={toggle}
        className={`w-8 h-8 rounded-full grid place-items-center shrink-0 active:scale-95 transition ${
          mine ? "bg-primary-foreground/15 text-primary-foreground hover:bg-primary-foreground/25" : "bg-primary/10 text-primary hover:bg-primary/20"
        }`}
      >
        {playing ? <Pause size={13} /> : <Play size={13} />}
      </button>
      <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${mine ? "bg-primary-foreground/20" : "bg-muted"}`}>
        <div
          className={`h-full rounded-full ${mine ? "bg-primary-foreground/80" : "bg-primary"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-[9px] font-mono tabular-nums ${mine ? "text-primary-foreground/70" : "text-muted-foreground/70"}`}>
        {fmtDur(dur)}
      </span>
    </div>
  );
}

function fmtDur(s: number): string {
  if (!isFinite(s) || s < 0) s = 0;
  const secs = Math.round(s);
  return `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;
}

/* ─────────────────────── Burbuja de mensaje ─────────────────────── */

function MessageBubble({
  m,
  mine,
  sender,
  senders,
  reply,
  mediaUrl,
  copied,
  pinned,
  canPin,
  onCopy,
  onReply,
  onPin,
}: {
  m: ChatMessage;
  mine: boolean;
  sender?: Profile | null;
  senders: Map<string, Profile>;
  reply?: ChatMessage | null;
  mediaUrl: string | null;
  copied: boolean;
  pinned: boolean;
  canPin: boolean;
  onCopy: () => void;
  onReply: () => void;
  onPin: () => void;
}) {
  const contentProfileId = m.content ? extractProfileLink(m.content) : null;
  const displayContent =
    contentProfileId && m.content
      ? m.content
          .replace(/[^\s]*\/profile\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[^\s]*/gi, "")
          .trim()
      : m.content;
  return (
    <div className={`group relative flex gap-2 ${mine ? "justify-end pl-10" : "justify-start pr-10"}`}>
      {!mine &&
        (m.sender_id ? (
          <Link to="/profile/$userId" params={{ userId: m.sender_id }} className="shrink-0" onClick={(e) => e.stopPropagation()}>
            <Avatar p={sender} size={28} />
          </Link>
        ) : (
          <div className="shrink-0">
            <Avatar p={sender} size={28} />
          </div>
        ))}
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
              {mediaLabel(reply)}
            </div>
          )}
          {displayContent && (
            <div className="text-[13px] leading-snug whitespace-pre-wrap break-words">
              {renderContentWithMentions(displayContent, mine)}
            </div>
          )}
          {contentProfileId && <ProfileLinkCard userId={contentProfileId} name={sender?.display_name || sender?.username} />}
          {mediaUrl && isAudioMessage(m) ? (
            <AudioBubble url={mediaUrl} mine={mine} duration={0} />
          ) : m.media_url && !mediaUrl ? (
            <div className="text-[10px] text-muted-foreground/70 py-1.5 flex items-center gap-1.5">
              <Loader2 size={11} className="animate-spin" /> Cargando media…
            </div>
          ) : mediaUrl && isVideoMessage(m) ? (
            <video
              src={mediaUrl}
              controls
              playsInline
              className="max-w-72 max-h-72 rounded-xl mt-0.5 bg-black object-contain"
              preload="metadata"
            />
          ) : mediaUrl && isImageMessage(m) ? (
            <img src={mediaUrl} alt="Foto" className="max-w-72 max-h-72 rounded-xl mt-0.5 object-contain" draggable={false} />
          ) : mediaUrl ? (
            <img src={mediaUrl} alt="Sticker" className="max-w-44 max-h-44 rounded-xl mt-0.5 object-contain" draggable={false} />
          ) : null}
          <div className={`text-[9px] mt-1 ${mine ? "text-primary-foreground/70" : "text-muted-foreground/70"} flex items-center justify-end gap-1`}>
            {pinned && <Pin size={9} className="fill-current opacity-80" />}
            {fmtTime(m.created_at)}
          </div>
        </div>
      </div>
      {mine &&
        (m.sender_id ? (
          <Link to="/profile/$userId" params={{ userId: m.sender_id }} className="shrink-0" onClick={(e) => e.stopPropagation()}>
            <Avatar p={sender} size={28} />
          </Link>
        ) : (
          <div className="shrink-0">
            <Avatar p={sender} size={28} />
          </div>
        ))}
      <BubbleActions mine={mine} copied={copied} canPin={canPin} pinned={pinned} onCopy={onCopy} onReply={onReply} onPin={onPin} />
    </div>
  );
}

/** Aísla cada mensaje: si uno falla al renderizar, muestra un hueco en vez de tumbar el chat entero. */
class SafeRow extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) {
      return (
        <div className="text-center text-[10px] text-muted-foreground/50 py-2">
          Este mensaje no se pudo mostrar
        </div>
      );
    }
    return this.props.children;
  }
}

/* ─────────────────────── Aviso de la comunidad ─────────────────────── */

function AnnouncementCard({ m, sender }: { m: ChatMessage; sender?: Profile | null }) {
  return (
    <div className="flex justify-center">
      <div className="w-full max-w-[85%] rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/[0.08] to-orange-500/[0.04] px-3.5 py-2.5 shadow-sm">
        <div className="flex items-center gap-1.5 text-[9px] font-display tracking-[0.18em] text-amber-600 dark:text-amber-400 mb-1">
          <Megaphone size={10} className="shrink-0" /> AVISO DE LA COMUNIDAD
        </div>
        <p className="text-[13px] leading-snug whitespace-pre-wrap break-words">{m.content || ""}</p>
        <div className="text-[9px] text-muted-foreground/70 mt-1 flex items-center justify-between gap-2">
          <span className="truncate">{sender?.display_name || sender?.username || "Administración"}</span>
          <span className="shrink-0">{fmtTime(m.created_at)}</span>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────── Paquete de regalos ─────────────────────── */

function GiftCard({
  gift,
  claiming,
  expiring,
  claimedAmount,
  onClaim,
  onExpire,
}: {
  gift: OrbGift | null;
  claiming: boolean;
  expiring: boolean;
  claimedAmount?: number;
  onClaim: () => void;
  onExpire: () => void;
}) {
  const [countdown, setCountdown] = useState<number | null>(null);
  useEffect(() => {
    if (!gift?.expires_at) return;
    const t = setInterval(() => {
      const ms = new Date(gift.expires_at!).getTime() - Date.now();
      setCountdown(Math.max(0, ms));
    }, 1000);
    return () => clearInterval(t);
  }, [gift?.expires_at]);
  const done = !gift || gift.status !== "open" || (gift.max_claims > 0 && gift.claims >= gift.max_claims);
  const claimed = !!claimedAmount;
  return (
    <div className="flex justify-center">
      <div className="w-full max-w-[85%] rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/[0.08] to-accent/[0.05] px-3.5 py-3 shadow-sm relative overflow-hidden">
        <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-primary/10 blur-xl" />
        <div className="flex items-center gap-1.5 text-[9px] font-display tracking-[0.18em] text-primary mb-1">
          <Gift size={10} className="shrink-0" /> PAQUETE DE REGALOS
        </div>
        <div className="text-sm font-semibold flex items-center gap-2">
          <PartyPopper size={14} className="text-primary" />
          {gift ? `¡${gift.amount_per_person} orbes para ti!` : "Paquete de regalos"}
        </div>
        {gift && (
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {gift.claims}/{gift.max_claims} reclamados · {gift.total_orbes} orbes en total
          </div>
        )}
        {gift && gift.expires_at && countdown !== null && (
          <div className="text-[10px] font-mono text-muted-foreground/70 mt-1 flex items-center gap-1">
            <Timer size={9} /> caduca en {String(Math.floor(countdown / 60000)).padStart(2, "0")}:
            {String(Math.floor((countdown % 60000) / 1000)).padStart(2, "0")}
          </div>
        )}
        <div className="mt-2.5 flex gap-2">
          {!claimed && !done ? (
            <button
              onClick={onClaim}
              disabled={claiming}
              className="flex-1 py-2 rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground text-[10px] font-display tracking-widest active:scale-[0.98] transition disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {claiming ? <Loader2 size={12} className="animate-spin" /> : <Gift size={12} />}
              {claiming ? "ABRIENDO…" : "ABRIR REGALO"}
            </button>
          ) : (
            <div className="flex-1 py-2 rounded-xl border border-border bg-background/60 text-center text-[10px] font-display tracking-widest text-muted-foreground">
              {claimed ? "RECLAMADO ✓" : done ? "AGOTADO" : ""}
            </div>
          )}
          {!done && (
            <button
              onClick={onExpire}
              disabled={expiring}
              title="Cerrar paquete"
              className="px-3 py-2 rounded-xl border border-border text-muted-foreground hover:text-rose-500 hover:border-rose-400/40 active:scale-95 transition text-[10px] font-display"
            >
              {expiring ? <Loader2 size={12} className="animate-spin" /> : <Lock size={12} />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────── Encuesta del chat ─────────────────────── */

function PollCard({
  poll,
  sender,
  votingId,
  closingId,
  canClose,
  onVote,
  onClose,
}: {
  poll: ChatPoll | null;
  sender?: Profile | null;
  votingId: string | null;
  closingId: string | null;
  canClose: boolean;
  onVote: (optionIndex: number) => void;
  onClose: () => void;
}) {
  const voted = (poll?.my_votes ?? []).length > 0;
  const closed = !poll || poll.status === "closed";
  const total = poll?.total_votes ?? 0;
  return (
    <div className="flex justify-center">
      <div className="w-full max-w-[85%] rounded-2xl border border-border bg-card/70 backdrop-blur-sm px-3.5 py-3 shadow-sm">
        <div className="flex items-center gap-1.5 text-[9px] font-display tracking-[0.18em] text-primary mb-1">
          <BarChart3 size={10} className="shrink-0" /> ENCUESTA{poll?.status === "closed" ? " · CERRADA" : ""}
        </div>
        <div className="text-[13px] font-semibold leading-snug">{poll?.question ?? "Encuesta"}</div>
        <div className="text-[10px] text-muted-foreground mb-2">
          {sender?.display_name || sender?.username || "Admin"} · {total} voto{total === 1 ? "" : "s"}
        </div>
        <div className="space-y-1.5">
          {(poll?.options ?? []).map((opt, i) => {
            const count = poll?.votes.find((v) => v.option_index === i)?.count ?? 0;
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            const mine = (poll?.my_votes ?? []).includes(i);
            return (
              <button
                key={i}
                onClick={() => !voted && !closed && onVote(i)}
                disabled={closed || !!votingId || voted}
                className={`relative w-full text-left rounded-xl border px-3 py-2 overflow-hidden transition active:scale-[0.99] disabled:active:scale-100 ${
                  mine
                    ? "border-primary/50 bg-primary/10"
                    : voted || closed
                      ? "border-border bg-muted/30"
                      : "border-border bg-muted/40 hover:border-primary/40 hover:bg-primary/5"
                }`}
              >
                {closed || voted ? (
                  <div
                    className={`absolute inset-y-0 left-0 rounded-l-xl ${mine ? "bg-primary/15" : "bg-primary/[0.07]"}`}
                    style={{ width: `${pct}%` }}
                  />
                ) : null}
                <div className="relative flex items-center justify-between gap-2">
                  <span className="text-[12px] font-medium flex items-center gap-1.5 min-w-0">
                    {mine && <Check size={11} className="text-primary shrink-0" />}
                    <span className="truncate">{opt}</span>
                  </span>
                  {(closed || voted) && (
                    <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                      {count} · {pct}%
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        {canClose && !closed && poll && (
          <button
            onClick={onClose}
            disabled={!!closingId}
            className="mt-2.5 w-full py-1.5 rounded-xl border border-border text-[10px] font-display tracking-widest text-muted-foreground hover:text-rose-500 hover:border-rose-400/40 active:scale-[0.98] transition disabled:opacity-50"
          >
            {closingId === poll.id ? <Loader2 size={11} className="animate-spin mx-auto" /> : "CERRAR ENCUESTA"}
          </button>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────── Componente principal ─────────────────────── */

type View = "group" | "groups" | "dms";

export default function ChatSection({ myId, onClose, initialText }: { myId: string | null; onClose: () => void; initialText?: string }) {
  const [chatInfo, setChatInfo] = useState<{ id: string; name: string; memberCount: number; local?: boolean } | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [senders, setSenders] = useState<Map<string, Profile>>(new Map());
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isLocal, setIsLocal] = useState<boolean>(() => !hasSupabaseConfig());
  const [initError, setInitError] = useState<"conn" | null>(null);
  // ¿Soy el administrador de la comunidad? (cuenta propietaria)
  const [isOwner, setIsOwner] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [connecting, setConnecting] = useState(false);
  const [connectUrl, setConnectUrl] = useState("");
  const [connectKey, setConnectKey] = useState("");
  const [unseen, setUnseen] = useState(0);

  // Pestañas / conversaciones
  const [view, setView] = useState<View>("group");
  const [dmList, setDmList] = useState<DmChat[]>([]);
  const [groupList, setGroupList] = useState<GroupChat[]>([]);
  const [activeDm, setActiveDm] = useState<DmChat | null>(null);
  const [activeGroup, setActiveGroup] = useState<GroupChat | null>(null);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [mutualFollows, setMutualFollows] = useState<Profile[]>([]);

  // Stickers
  const [stickersOpen, setStickersOpen] = useState(false);
  const [myStickers, setMyStickers] = useState<ChatSticker[]>([]);
  const [signedStickers, setSignedStickers] = useState<Map<string, string>>(new Map());
  const [stickerUploading, setStickerUploading] = useState(false);

  // Media (fotos/vídeos)
  const [pendingMedia, setPendingMedia] = useState<{ file: File; kind: "image" | "video" } | null>(null);
  const [mediaUploading, setMediaUploading] = useState(false);

  // Audio
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [sendingAudio, setSendingAudio] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const recChunksRef = useRef<Blob[]>([]);

  // Menciones
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionCandidates, setMentionCandidates] = useState<Profile[]>([]);
  const mentionRef = useRef<{ start: number; end: number } | null>(null);

  // Regalos / encuestas
  const [gifts, setGifts] = useState<Map<string, OrbGift>>(new Map());
  const [polls, setPolls] = useState<Map<string, ChatPoll>>(new Map());
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [expiringId, setExpiringId] = useState<string | null>(null);
  const [votingId, setVotingId] = useState<string | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);

  // Diálogos
  const [giftOpen, setGiftOpen] = useState(false);
  const [giftTitle, setGiftTitle] = useState("");
  const [giftAmount, setGiftAmount] = useState("50");
  const [giftClaims, setGiftClaims] = useState("5");
  const [giftBusy, setGiftBusy] = useState(false);
  const [announceOpen, setAnnounceOpen] = useState(false);
  const [announceText, setAnnounceText] = useState("");
  const [announceBusy, setAnnounceBusy] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [pollErr, setPollErr] = useState<string | null>(null);
  const [groupInfoOpen, setGroupInfoOpen] = useState(false);
  const [rolePicker, setRolePicker] = useState<{ userId: string; role: string } | null>(null);
  const [deleteGroupOpen, setDeleteGroupOpen] = useState(false);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [cgName, setCgName] = useState("");
  const [cgDesc, setCgDesc] = useState("");
  const [cgSelected, setCgSelected] = useState<string[]>([]);
  const [cgAvatar, setCgAvatar] = useState<string | null>(null);
  const [cgBusy, setCgBusy] = useState(false);
  const [cgErr, setCgErr] = useState<string | null>(null);
  const [editGroupOpen, setEditGroupOpen] = useState(false);
  const [egName, setEgName] = useState("");
  const [egDesc, setEgDesc] = useState("");
  const [egAvatar, setEgAvatar] = useState<string | null>(null);
  const [egBusy, setEgBusy] = useState(false);
  const [newDmOpen, setNewDmOpen] = useState(false);

  // Chats de trabajo
  const [workChatIds, setWorkChatIds] = useState<string[]>([]);
  const [threads, setThreads] = useState<WorkThread[]>([]);
  const [threadView, setThreadView] = useState<WorkThread | null>(null);
  const [taskOpen, setTaskOpen] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const [threadsOpen, setThreadsOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);

  // Búsqueda global + programados + fijados
  const [searchOpen, setSearchOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const [scheduledMsgs, setScheduledMsgs] = useState<ScheduledMessage[]>([]);
  const [pinnedMsgs, setPinnedMsgs] = useState<PinnedMessage[]>([]);

  // Refs
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const cgAvatarRef = useRef<HTMLInputElement>(null);
  const egAvatarRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const sendersRef = useRef<Set<string>>(new Set());
  const signedMediaRef = useRef<Map<string, string>>(new Map());
  const [signedMedia, setSignedMedia] = useState<Map<string, string>>(new Map());
  const cursorRef = useRef<{ created_at: string; id: string } | null>(null);
  const stickToBottomRef = useRef(true);
  const lastSeenRef = useRef<string>(new Date(0).toISOString());
  const activeDmRef = useRef<DmChat | null>(null);
  const activeGroupRef = useRef<GroupChat | null>(null);
  const chatInfoRef = useRef<{ id: string } | null>(null);

  // Hilo activo: chat de la comunidad (grupo), chat individual (DM) o grupo personalizado.
  const currentChatId = activeGroup ? activeGroup.chat_id : activeDm ? activeDm.chat_id : chatInfo?.id ?? null;
  const totalDmUnread = dmList.reduce((s, d) => s + (d.unread || 0), 0);
  const totalGroupUnread = groupList.reduce((s, g) => s + (g.unread || 0), 0);
  const groupRole = activeGroup?.my_role ?? null;
  const canAnnounce =
    view === "group" ? isOwner : groupRole === "owner" || groupRole === "admin" || groupRole === "moderator";
  const canPoll = view === "group" ? isOwner : groupRole === "owner" || groupRole === "admin";
  const canManageMembers = groupRole === "owner" || groupRole === "admin";
  const canDeleteGroup = groupRole === "owner" || groupRole === "admin";
  const canManageRoles = groupRole === "owner";
  const isWork = !!activeGroup && workChatIds.includes(activeGroup.chat_id);
  const myName = myId
    ? senders.get(myId)?.display_name || senders.get(myId)?.username || "Yo"
    : "Yo";
  const searchDefaultScope: "all" | "community" | "work" =
    view === "groups" && activeGroup && isWork
      ? "work"
      : view === "group"
        ? "community"
        : "all";

  // Sincronizar refs con el estado (los handlers/efectos dependen de ellos)
  activeDmRef.current = activeDm;
  activeGroupRef.current = activeGroup;
  chatInfoRef.current = chatInfo;

  useEffect(() => {
    lastSeenRef.current = new Date(0).toISOString();
    setUnseen(0);
  }, [currentChatId]);

  useEffect(() => {
    if (!initialText) return;
    setDraft(initialText);
  }, [initialText]);

  /** Carga los perfiles de los remitentes de un lote de mensajes. */
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
      try {
        const p = await getMyProfile();
        if (cancelled || !p) return;
        sendersRef.current.add(p.id);
        setSenders((prev) => {
          if (prev.has(p.id)) return prev;
          const next = new Map(prev);
          next.set(p.id, p);
          return next;
        });
      } catch {
        /* noop */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [myId]);

  // Permiso de administración de la comunidad: solo la cuenta propietaria.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!hasSupabaseConfig()) {
        // Modo local: la cuenta local creó el chat comunitario.
        if (!cancelled) setIsOwner(true);
        return;
      }
      try {
        const { data } = await supabase.auth.getUser();
        const email = data.user?.email?.toLowerCase() ?? "";
        if (!cancelled) setIsOwner(email === "linkyteam989@gmail.com");
      } catch {
        if (!cancelled) setIsOwner(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Firma los media locales (los que no son URLs http/data). */
  const resolveSigned = useCallback(async (msgs: ChatMessage[]) => {
    const paths = Array.from(
      new Set(msgs.map((m) => m.media_url).filter((u): u is string => !!u && !/^(https?:|data:)/.test(u)))
    );
    const missing = paths.filter((p) => !signedMediaRef.current.has(p));
    if (!missing.length) return;
    try {
      const signed = await signMedia(missing);
      const next = new Map(signedMediaRef.current);
      missing.forEach((p, i) => next.set(p, signed[i] ?? p));
      signedMediaRef.current = next;
      setSignedMedia(next);
    } catch {
      /* noop */
    }
  }, []);

  const resolveMediaUrl = useCallback(
    (url: string | null): string | null => {
      if (!url) return null;
      if (/^(https?:|data:)/.test(url)) return url;
      return signedMediaRef.current.get(url) ?? null;
    },
    [signedMedia]
  );

  // Preparar el chat comunitario + cargar mensajes del hilo activo
  useEffect(() => {
    let cancelled = false;
    setInitError(null);
    setLoading(true);
    setMessages([]);
    setGifts(new Map());
    setPolls(new Map());
    (async () => {
      try {
        if (!chatInfoRef.current && !activeDmRef.current && !activeGroupRef.current) {
          const info = await getCommunityChat();
          if (cancelled) return;
          setChatInfo(info);
          setIsLocal(!hasSupabaseConfig() || !!info.local);
        }
        if (cancelled) return;
        const threadId = activeGroupRef.current
          ? activeGroupRef.current.chat_id
          : activeDmRef.current
            ? activeDmRef.current.chat_id
            : chatInfoRef.current?.id ?? null;
        if (!threadId) {
          if (!cancelled) setLoading(false);
          return;
        }
        const { messages: msgs, hasMore: more } = await fetchChatMessages(threadId);
        if (cancelled) return;
        setMessages(msgs);
        setHasMore(more);
        if (msgs.length) cursorRef.current = { created_at: msgs[0].created_at, id: msgs[0].id };
        stickToBottomRef.current = true;
        await loadSenders(msgs);
        void resolveSigned(msgs);
        if (activeDmRef.current) {
          const unread = activeDmRef.current.unread || 0;
          if (unread > 0) {
            const last = msgs[msgs.length - 1];
            if (last) lastSeenRef.current = last.created_at;
          }
          void markDmRead(threadId).catch(() => {});
        }
        // Regalos y encuestas de los mensajes cargados
        const gids = Array.from(new Set(msgs.map((m) => m.gift_id).filter((x): x is string => !!x)));
        if (gids.length) {
          void Promise.all(gids.map((g) => fetchOrbGift(g)))
            .then((list) => {
              if (cancelled) return;
              setGifts((prev) => {
                const next = new Map(prev);
                list.forEach((g) => g && next.set(g.id, g));
                return next;
              });
            })
            .catch(() => {});
        }
        const pids = Array.from(new Set(msgs.map((m) => m.poll_id).filter((x): x is string => !!x)));
        if (pids.length) {
          void Promise.all(pids.map((p) => fetchPoll(p)))
            .then((list) => {
              if (cancelled) return;
              setPolls((prev) => {
                const next = new Map(prev);
                list.forEach((p) => p && next.set(p.id, p));
                return next;
              });
            })
            .catch(() => {});
        }
      } catch (err) {
        if (cancelled) return;
        setInitError("conn");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadSenders, resolveSigned, retryKey, currentChatId]);

  // Caducar regalos abiertos al entrar
  useEffect(() => {
    void expireOrbGifts().catch(() => {});
  }, [currentChatId]);

  // Suscripción en tiempo real del chat activo
  useEffect(() => {
    if (!currentChatId) return;
    const unsub = subscribeToChat(currentChatId, (ev) => {
      if (ev.type === "INSERT") {
        setMessages((prev) => (prev.some((m) => m.id === ev.message.id) ? prev : [...prev, ev.message]));
        void loadSenders([ev.message]);
        void resolveSigned([ev.message]);
        if (ev.message.sender_id !== myId && !stickToBottomRef.current) {
          setUnseen((u) => u + 1);
        }
        if (ev.message.gift_id) {
          void fetchOrbGift(ev.message.gift_id)
            .then((g) => g && setGifts((prev) => new Map(prev).set(g.id, g)))
            .catch(() => {});
        }
        if (ev.message.poll_id) {
          void fetchPoll(ev.message.poll_id)
            .then((p) => p && setPolls((prev) => new Map(prev).set(p.id, p)))
            .catch(() => {});
        }
      } else if (ev.type === "UPDATE") {
        setMessages((prev) => prev.map((m) => (m.id === ev.message.id ? { ...m, ...ev.message } : m)));
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== ev.message.id));
      }
    });
    return unsub;
  }, [currentChatId, myId, loadSenders, resolveSigned]);

  // Realtime de encuestas
  useEffect(() => {
    if (!currentChatId) return;
    const unsub = subscribeToPolls(currentChatId, (type, pollId) => {
      if (type === "DELETE") {
        setPolls((prev) => {
          const next = new Map(prev);
          next.delete(pollId);
          return next;
        });
        return;
      }
      void fetchPoll(pollId)
        .then((p) => p && setPolls((prev) => new Map(prev).set(p.id, p)))
        .catch(() => {});
    });
    return unsub;
  }, [currentChatId]);

  // Realtime de paquetes de regalos
  useEffect(() => {
    const unsub = subscribeToOrbGifts((type, gift) => {
      if (type === "DELETE") {
        setGifts((prev) => {
          const next = new Map(prev);
          next.delete(gift.id);
          return next;
        });
        return;
      }
      setGifts((prev) => new Map(prev).set(gift.id, gift));
    });
    return unsub;
  }, []);

  // Contador de no leídos del chat activo
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last && stickToBottomRef.current && last.sender_id !== myId) {
      lastSeenRef.current = last.created_at;
      setUnseen(0);
    }
  }, [messages, myId]);

  // Auto-scroll al final cuando se pega abajo
  useEffect(() => {
    if (stickToBottomRef.current) {
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages.length, loading]);

  /** Paginación hacia atrás (mensajes más antiguos). */
  const loadOlderMessages = useCallback(async () => {
    if (!currentChatId || !cursorRef.current || loadingMore) return;
    setLoadingMore(true);
    try {
      const { messages: older, hasMore: more } = await fetchChatMessages(currentChatId, {
        before: cursorRef.current,
      });
      if (!older.length) {
        setHasMore(false);
        return;
      }
      cursorRef.current = { created_at: older[0].created_at, id: older[0].id };
      setHasMore(more);
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        return [...older.filter((m) => !seen.has(m.id)), ...prev];
      });
      void loadSenders(older);
      void resolveSigned(older);
    } catch {
      /* noop */
    } finally {
      setLoadingMore(false);
    }
  }, [currentChatId, loadingMore, loadSenders, resolveSigned]);

  const onScrollList = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
      if (nearBottom) {
        stickToBottomRef.current = true;
        const last = messages[messages.length - 1];
        if (last && last.sender_id !== myId) {
          lastSeenRef.current = last.created_at;
          setUnseen(0);
        }
        if (activeDm && !isLocal) void markDmRead(activeDm.chat_id).catch(() => {});
      } else {
        stickToBottomRef.current = false;
      }
      if (el.scrollTop < 60 && hasMore && !loadingMore) void loadOlderMessages();
    },
    [hasMore, loadingMore, loadOlderMessages, messages, activeDm, isLocal]
  );

  const jumpToBottom = useCallback(() => {
    stickToBottomRef.current = true;
    const last = messages[messages.length - 1];
    if (last) lastSeenRef.current = last.created_at;
    setUnseen(0);
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  /** Carga los stickers al abrir el panel. */
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

  /** Envía el borrador actual (o un media). */
  const handleSend = useCallback(
    async (mediaUrl?: string, mediaType?: "image" | "video" | "audio" | "sticker") => {
      const content = draft.trim();
      if (!currentChatId) {
        toast.error("El chat aún no está conectado", {
          description: "Reintenta en unos segundos.",
        });
        return;
      }
      if (!content && !mediaUrl) return;
      try {
        const sent = await sendChatMessage(currentChatId, {
          content: content || undefined,
          mediaUrl: mediaUrl ?? undefined,
          mediaType,
          replyToId: replyTo?.id ?? null,
        });
        setMessages((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]));
        setDraft("");
        setReplyTo(null);
        setStickersOpen(false);
        if (activeDmRef.current) {
          setDmList((prev) => prev.map((d) => (d.chat_id === sent.chat_id ? { ...d, last_message: sent, last_at: sent.created_at, unread: 0 } : d)));
          void markDmRead(sent.chat_id).catch(() => {});
        } else if (activeGroupRef.current) {
          setGroupList((prev) => prev.map((g) => (g.chat_id === sent.chat_id ? { ...g, last_message: sent, last_at: sent.created_at, unread: 0 } : g)));
          void markDmRead(sent.chat_id).catch(() => {});
        } else if (content) {
          void notifyMentions(content);
        }
        if (inputRef.current) inputRef.current.style.height = "auto";
        void flushPendingMessages()
          .then((n) => {
            if (n > 0)
              toast.success(n === 1 ? "Tu mensaje pendiente se envió ✓" : `Se enviaron ${n} mensajes pendientes ✓`);
          })
          .catch(() => {});
      } catch (err) {
        if (isNetworkError(err) && currentChatId) {
          queuePendingMessage(currentChatId, {
            content: content || undefined,
            mediaUrl,
            mediaType,
            replyToId: replyTo?.id ?? null,
          });
          toast.info("Sin conexión: tu mensaje se enviará solo cuando vuelva la red");
        } else {
          toast.error("No se pudo enviar el mensaje", {
            description: "Comprueba tu conexión e inténtalo de nuevo.",
          });
        }
      }
    },
    [currentChatId, draft, replyTo]
  );

  /** Notifica a los usuarios mencionados con @usuario. */
  const notifyMentions = useCallback(
    async (content: string) => {
      const handles = Array.from(new Set(content.match(/@([\w.]+)/g)?.map((h) => h.slice(1).toLowerCase()) ?? []));
      if (!handles.length || !myId) return;
      for (const h of handles) {
        try {
          const found = await searchProfilesForMention(h);
          for (const p of found) {
            if (p.id !== myId && (p.username?.toLowerCase() === h || p.display_name?.toLowerCase() === h)) {
              void pushNotification({ userId: p.id, type: "mention" }).catch(() => {});
            }
          }
        } catch {
          /* noop */
        }
      }
    },
    [myId]
  );

  /** Inserta la mención @usuario en el cuadro de texto (en el cursor). */
  const insertMention = useCallback(
    (p: Profile) => {
      const r = mentionRef.current;
      const name = `@${p.username || p.display_name || "usuario"}`;
      setDraft((prev) => {
        if (!r) return prev + name;
        return prev.slice(0, r.start) + name + " " + prev.slice(r.end);
      });
      setMentionOpen(false);
      mentionRef.current = null;
      inputRef.current?.focus();
    },
    []
  );

  /** Busca candidatos de mención al escribir @. */
  const searchMentions = useCallback(async (q: string) => {
    if (!q) {
      setMentionCandidates([]);
      setMentionOpen(false);
      return;
    }
    try {
      const found = await searchProfilesForMention(q);
      setMentionCandidates(found);
      setMentionIndex(0);
      setMentionOpen(found.length > 0);
    } catch {
      setMentionCandidates([]);
      setMentionOpen(false);
    }
  }, []);

  // Debounce de la búsqueda de menciones
  useEffect(() => {
    if (!mentionQuery) return;
    const t = setTimeout(() => void searchMentions(mentionQuery), 220);
    return () => clearTimeout(t);
  }, [mentionQuery, searchMentions]);

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

  // ───── Fotos y vídeos ─────

  const pickMedia = useCallback((file: File | null) => {
    if (!file) return;
    setPendingMedia({ file, kind: file.type.startsWith("video/") ? "video" : "image" });
  }, []);

  const sendPendingMedia = useCallback(async () => {
    if (!pendingMedia || !currentChatId) return;
    setMediaUploading(true);
    try {
      const path = await uploadChatMedia(pendingMedia.file, myId ?? "me");
      await handleSend(path, pendingMedia.kind);
      setPendingMedia(null);
    } catch {
      toast.error("No se pudo subir la imagen/vídeo");
    } finally {
      setMediaUploading(false);
    }
  }, [pendingMedia, currentChatId, myId, handleSend]);

  // ───── Audio de voz ─────

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      recChunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) recChunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
      };
      rec.start();
      recRef.current = rec;
      setRecording(true);
      setRecSeconds(0);
    } catch {
      toast.error("No se pudo acceder al micrófono");
    }
  }, []);

  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setRecSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

  const stopRecording = useCallback(
    async (send: boolean) => {
      const rec = recRef.current;
      if (!rec || rec.state === "inactive") {
        setRecording(false);
        return;
      }
      setSendingAudio(true);
      try {
        const blob = await new Promise<Blob>((resolve) => {
          const prev = rec.onstop;
          rec.onstop = () => {
            if (prev) prev.call(rec, new Event("stop"));
            resolve(new Blob(recChunksRef.current, { type: "audio/webm" }));
          };
          rec.stop();
        });
        recRef.current = null;
        setRecording(false);
        if (!send) return;
        if (!currentChatId) return;
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: "audio/webm" });
        const path = await uploadChatMedia(file, myId ?? "me");
        await handleSend(path, "audio");
      } catch {
        setRecording(false);
        toast.error("No se pudo enviar el audio");
      } finally {
        setSendingAudio(false);
      }
    },
    [currentChatId, myId, handleSend]
  );

  // ───── Stickers ─────

  const onPickStickerFile = useCallback(
    async (file: File | null) => {
      if (!file || !currentChatId) return;
      setStickerUploading(true);
      try {
        const up = await uploadSticker(file);
        const [signed] = await signMedia([up.path]);
        const sent = await sendChatMessage(currentChatId, { mediaUrl: signed, mediaType: "sticker", replyToId: replyTo?.id ?? null });
        setMessages((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]));
        setReplyTo(null);
        const st = await fetchMyStickers();
        setMyStickers(st);
      } catch {
        toast.error("No se pudo subir el sticker");
      } finally {
        setStickerUploading(false);
      }
    },
    [currentChatId, replyTo]
  );

  const handleDeleteSticker = useCallback(
    async (s: ChatSticker) => {
      try {
        await deleteSticker(s.id);
        setMyStickers((prev) => prev.filter((x) => x.id !== s.id));
      } catch {
        /* noop */
      }
    },
    []
  );

  // ───── Regalos ─────

  const handleCreateGift = useCallback(async () => {
    const amount = Math.max(1, parseInt(giftAmount, 10) || 0);
    const claims = Math.max(1, parseInt(giftClaims, 10) || 0);
    if (!currentChatId || amount <= 0) return;
    setGiftBusy(true);
    try {
      const r = await createOrbGift(currentChatId, { title: giftTitle, amountPerPerson: amount, maxClaims: claims });
      if (!r.ok) {
        toast.error(r.error ?? "No se pudo crear el paquete");
        return;
      }
      if (r.message) {
        setMessages((prev) => (prev.some((m) => m.id === r.message!.id) ? prev : [...prev, r.message!]));
      }
      if (r.giftId) {
        const g = await fetchOrbGift(r.giftId);
        if (g) setGifts((prev) => new Map(prev).set(g.id, g));
      }
      setGiftOpen(false);
      setGiftTitle("");
      toast.success("¡Paquete de regalos creado! 🎁");
    } catch {
      toast.error("No se pudo crear el paquete");
    } finally {
      setGiftBusy(false);
    }
  }, [currentChatId, giftAmount, giftClaims, giftTitle]);

  const handleClaimGift = useCallback(
    async (giftId: string) => {
      setClaimingId(giftId);
      try {
        const r = await claimOrbGift(giftId);
        if (r.ok) {
          toast.success(r.amount ? `¡+${r.amount} orbes! 🎉` : "¡Regalo reclamado!");
        } else {
          toast.error(r.error ?? "No se pudo abrir el regalo");
        }
        const g = await fetchOrbGift(giftId);
        if (g) setGifts((prev) => new Map(prev).set(g.id, g));
      } catch {
        toast.error("No se pudo abrir el regalo");
      } finally {
        setClaimingId(null);
      }
    },
    []
  );

  const handleExpireGift = useCallback(
    async (giftId: string) => {
      setExpiringId(giftId);
      try {
        await expireOrbGifts();
        const g = await fetchOrbGift(giftId);
        if (g) setGifts((prev) => new Map(prev).set(g.id, g));
      } catch {
        /* noop */
      } finally {
        setExpiringId(null);
      }
    },
    []
  );

  // ───── Avisos ─────

  const publishAnnouncement = useCallback(async () => {
    const text = announceText.trim();
    if (!currentChatId || !text) return;
    setAnnounceBusy(true);
    try {
      const r = await createAnnouncement(currentChatId, text);
      if (!r.ok) {
        toast.error(r.error ?? "No se pudo publicar el aviso");
        return;
      }
      if (r.message) {
        setMessages((prev) => (prev.some((m) => m.id === r.message!.id) ? prev : [...prev, r.message!]));
      }
      setAnnounceOpen(false);
      setAnnounceText("");
      toast.success("Aviso publicado para toda la comunidad");
    } catch {
      toast.error("No se pudo publicar el aviso");
    } finally {
      setAnnounceBusy(false);
    }
  }, [currentChatId, announceText]);

  // ───── Encuestas ─────

  const handleCreatePoll = useCallback(async () => {
    const question = pollQuestion.trim();
    const options = pollOptions.map((o) => o.trim()).filter(Boolean);
    if (!currentChatId) return;
    if (!question || options.length < 2) {
      setPollErr("Escribe la pregunta y al menos 2 opciones");
      return;
    }
    setPollErr(null);
    try {
      const r = await createPoll(currentChatId, { question, options });
      if (!r.ok) {
        setPollErr(r.error ?? "No se pudo crear la encuesta");
        return;
      }
      if (r.message) {
        setMessages((prev) => (prev.some((m) => m.id === r.message!.id) ? prev : [...prev, r.message!]));
      }
      if (r.pollId) {
        const p = await fetchPoll(r.pollId);
        if (p) setPolls((prev) => new Map(prev).set(p.id, p));
      }
      setPollOpen(false);
      setPollQuestion("");
      setPollOptions(["", ""]);
      toast.success("Encuesta creada 📊");
    } catch {
      setPollErr("No se pudo crear la encuesta");
    }
  }, [currentChatId, pollQuestion, pollOptions]);

  const handleVotePoll = useCallback(
    async (poll: ChatPoll, optionIndex: number) => {
      setVotingId(poll.id);
      try {
        const r = await votePoll(poll.id, optionIndex);
        if (!r.ok) {
          toast.error(r.error ?? "No se pudo votar");
          return;
        }
        const p = await fetchPoll(poll.id);
        if (p) setPolls((prev) => new Map(prev).set(p.id, p));
      } catch {
        toast.error("No se pudo votar");
      } finally {
        setVotingId(null);
      }
    },
    []
  );

  const handleClosePoll = useCallback(async (poll: ChatPoll) => {
    setClosingId(poll.id);
    try {
      const r = await closePoll(poll.id);
      if (!r.ok) {
        toast.error(r.error ?? "No se pudo cerrar");
        return;
      }
      const p = await fetchPoll(poll.id);
      if (p) setPolls((prev) => new Map(prev).set(p.id, p));
    } catch {
      toast.error("No se pudo cerrar la encuesta");
    } finally {
      setClosingId(null);
    }
  }, []);

  // ───── DMs ─────

  const loadDmList = useCallback(async () => {
    try {
      const list = await fetchMyDmChats();
      setDmList(list);
      const ids = list.map((d) => d.other?.id).filter((x): x is string => !!x);
      void loadSenders(
        list
          .map((d) => d.other)
          .filter((p): p is Profile => !!p)
          .map((p) => ({ id: p.id, sender_id: p.id, chat_id: "", content: null, media_url: null, media_type: null, reply_to_id: null, created_at: "" }))
      );
      if (ids.length) {
        const pmap = await fetchChatProfiles(ids);
        setSenders((prev) => {
          const next = new Map(prev);
          for (const [id, p] of pmap) next.set(id, p);
          return next;
        });
      }
    } catch {
      /* noop */
    }
  }, [loadSenders]);

  const openDm = useCallback(
    async (d: DmChat) => {
      setActiveDm(d);
      setActiveGroup(null);
      setStickersOpen(false);
      const other = d.other;
      if (other) {
        sendersRef.current.add(other.id);
        setSenders((prev) => {
          if (prev.has(other.id)) return prev;
          const next = new Map(prev);
          next.set(other.id, other);
          return next;
        });
      }
      if (d.unread > 0) void markDmRead(d.chat_id).catch(() => {});
    },
    [loadSenders]
  );

  const startDmWith = useCallback(
    async (p: Profile) => {
      try {
        const r = await getOrCreateDm(p.id);
        if (!r.ok || !r.chatId) {
          toast.error(r.error ?? "No se pudo abrir el chat");
          return;
        }
        const dm: DmChat = { chat_id: r.chatId, other: p, last_message: null, last_at: null, unread: 0 };
        setDmList((prev) => (prev.some((d) => d.chat_id === r.chatId) ? prev : [dm, ...prev]));
        setActiveDm(dm);
        setActiveGroup(null);
        setNewDmOpen(false);
      } catch {
        toast.error("No se pudo abrir el chat");
      }
    },
    []
  );

  // ───── Grupos ─────

  const loadGroupList = useCallback(async () => {
    try {
      const list = await fetchMyGroupChats();
      setGroupList(list);
      const ids = list.map((g) => g.chat_id);
      if (ids.length) {
        void Promise.all(ids.map((id) => fetchGroupMembers(id).catch(() => [] as GroupMember[])))
          .then((all) => {
            const profs = new Map<string, Profile>();
            all.flat().forEach((m) => profs.set(m.profile.id, m.profile));
            const ids2 = Array.from(profs.keys());
            if (ids2.length) {
              void fetchChatProfiles(ids2)
                .then((pmap) => {
                  setSenders((prev) => {
                    const next = new Map(prev);
                    for (const [id, p] of pmap) next.set(id, p);
                    return next;
                  });
                })
                .catch(() => {});
            }
          })
          .catch(() => {});
      }
    } catch {
      /* noop */
    }
  }, []);

  const openGroup = useCallback(
    (g: GroupChat) => {
      setActiveGroup(g);
      setActiveDm(null);
      setStickersOpen(false);
      setView("groups");
      void fetchGroupMembers(g.chat_id)
        .then((m) => {
          setGroupMembers(m);
          void fetchChatProfiles(m.map((x) => x.profile.id)).then((pmap) => {
            setSenders((prev) => {
              const next = new Map(prev);
              for (const [id, p] of pmap) next.set(id, p);
              return next;
            });
          });
        })
        .catch(() => {});
    },
    []
  );

  const reloadGroupInfo = useCallback(async (chatId: string) => {
    try {
      const m = await fetchGroupMembers(chatId);
      setGroupMembers(m);
    } catch {
      /* noop */
    }
  }, []);

  const handleCreateGroup = useCallback(async () => {
    const name = cgName.trim();
    if (!name) {
      setCgErr("Ponle un nombre al grupo");
      return;
    }
    setCgBusy(true);
    setCgErr(null);
    try {
      const r = await createGroupChat({
        name,
        description: cgDesc.trim() || undefined,
        avatarUrl: cgAvatar,
        memberIds: cgSelected,
      });
      if (!r.ok || !r.chatId) {
        setCgErr(r.error ?? "No se pudo crear el grupo");
        return;
      }
      setCreateGroupOpen(false);
      setCgName("");
      setCgDesc("");
      setCgSelected([]);
      setCgAvatar(null);
      toast.success("Grupo creado ✓");
      await loadGroupList();
      const list = await fetchMyGroupChats();
      const g = list.find((x) => x.chat_id === r.chatId);
      if (g) openGroup(g);
    } catch {
      setCgErr("No se pudo crear el grupo");
    } finally {
      setCgBusy(false);
    }
  }, [cgName, cgDesc, cgAvatar, cgSelected, loadGroupList, openGroup]);

  const handleEditGroup = useCallback(async () => {
    if (!activeGroup) return;
    const name = egName.trim();
    if (!name) return;
    setEgBusy(true);
    try {
      const r = await updateGroupChat(activeGroup.chat_id, {
        name,
        description: egDesc.trim() || undefined,
        avatarUrl: egAvatar,
      });
      if (!r.ok) {
        toast.error(r.error ?? "No se pudo editar el grupo");
        return;
      }
      setEditGroupOpen(false);
      setActiveGroup((g) => (g ? { ...g, name, description: egDesc.trim() || null, avatar_url: egAvatar } : g));
      void loadGroupList();
      toast.success("Grupo actualizado ✓");
    } catch {
      toast.error("No se pudo editar el grupo");
    } finally {
      setEgBusy(false);
    }
  }, [activeGroup, egName, egDesc, egAvatar, loadGroupList]);

  const handleSetRole = useCallback(
    async (userId: string, role: "admin" | "moderator" | "member") => {
      if (!activeGroup) return;
      setRolePicker(null);
      try {
        const r = await setGroupRole(activeGroup.chat_id, userId, role);
        if (!r.ok) {
          toast.error(r.error ?? "No se pudo cambiar el rol");
          return;
        }
        await reloadGroupInfo(activeGroup.chat_id);
        toast.success("Rol actualizado ✓");
      } catch {
        toast.error("No se pudo cambiar el rol");
      }
    },
    [activeGroup, reloadGroupInfo]
  );

  const handleAddMember = useCallback(
    async (p: Profile) => {
      if (!activeGroup) return;
      try {
        const r = await addGroupMember(activeGroup.chat_id, p.id);
        if (!r.ok) {
          toast.error(r.error ?? "No se pudo añadir");
          return;
        }
        await reloadGroupInfo(activeGroup.chat_id);
        toast.success("Miembro añadido ✓");
      } catch {
        toast.error("No se pudo añadir el miembro");
      }
    },
    [activeGroup, reloadGroupInfo]
  );

  const handleRemoveMember = useCallback(
    async (userId: string) => {
      if (!activeGroup) return;
      try {
        const r = await removeGroupMember(activeGroup.chat_id, userId);
        if (!r.ok) {
          toast.error(r.error ?? "No se pudo quitar");
          return;
        }
        await reloadGroupInfo(activeGroup.chat_id);
      } catch {
        toast.error("No se pudo quitar el miembro");
      }
    },
    [activeGroup, reloadGroupInfo]
  );

  const handleLeaveGroup = useCallback(async () => {
    if (!activeGroup) return;
    try {
      const r = await leaveGroupChat(activeGroup.chat_id);
      if (!r.ok) {
        toast.error(r.error ?? "No se pudo salir del grupo");
        return;
      }
      setGroupInfoOpen(false);
      setActiveGroup(null);
      await loadGroupList();
      toast.success("Saliste del grupo");
    } catch {
      toast.error("No se pudo salir del grupo");
    }
  }, [activeGroup, loadGroupList]);

  const handleDeleteGroup = useCallback(async () => {
    if (!activeGroup) return;
    try {
      const r = await deleteGroupChat(activeGroup.chat_id);
      if (!r.ok) {
        toast.error(r.error ?? "No se pudo eliminar el grupo");
        return;
      }
      setDeleteGroupOpen(false);
      setGroupInfoOpen(false);
      setActiveGroup(null);
      markWorkChat(activeGroup.chat_id, false);
      await loadGroupList();
      toast.success("Grupo eliminado");
    } catch {
      toast.error("No se pudo eliminar el grupo");
    }
  }, [activeGroup, loadGroupList]);

  const toggleWorkChat = useCallback(() => {
    if (!activeGroup || !canManageMembers) return;
    const on = !isWork;
    markWorkChat(activeGroup.chat_id, on);
    setWorkChatIds(listWorkChats());
    toast.success(on ? "Grupo marcado como chat de trabajo 💼" : "Ya no es chat de trabajo");
  }, [activeGroup, canManageMembers, isWork]);

  // ───── Chats de trabajo: hilos ─────

  const reloadWork = useCallback(() => {
    setWorkChatIds(listWorkChats());
    if (activeGroupRef.current) setThreads(listThreads(activeGroupRef.current.chat_id));
  }, []);

  useEffect(() => {
    reloadWork();
  }, [reloadWork, currentChatId]);

  const openThread = useCallback((t: WorkThread) => {
    setThreadView(t);
  }, []);

  // ───── Mensajes programados ─────

  const reloadScheduled = useCallback(() => {
    setScheduledMsgs(currentChatId ? listScheduledMessages(currentChatId) : []);
  }, [currentChatId]);

  const handleScheduleMessage = useCallback(async () => {
    const content = draft.trim();
    if (!currentChatId || !content || !scheduleAt) {
      toast.error("Escribe el mensaje y elige fecha y hora");
      return;
    }
    const when = new Date(scheduleAt);
    if (when.getTime() <= Date.now()) {
      toast.error("Elige una hora futura para programar");
      return;
    }
    try {
      await scheduleChatMessage(currentChatId, { content, scheduledAt: when.toISOString() });
      setDraft("");
      setScheduleOpen(false);
      reloadScheduled();
      toast.success("Mensaje programado 📌");
    } catch {
      toast.error("No se pudo programar el mensaje");
    }
  }, [currentChatId, draft, scheduleAt, reloadScheduled]);

  const handleCancelScheduled = useCallback(
    (id: string) => {
      cancelScheduledMessage(id);
      reloadScheduled();
    },
    [reloadScheduled]
  );

  const refreshMessagesAfterSend = useCallback(async () => {
    if (!currentChatId) return;
    try {
      const { messages: msgs, hasMore: more } = await fetchChatMessages(currentChatId);
      setMessages(msgs);
      setHasMore(more);
    } catch {
      /* noop */
    }
  }, [currentChatId]);

  useEffect(() => {
    reloadScheduled();
    const t = setInterval(() => {
      void sendDueScheduledMessages()
        .then((r) => {
          if (r.count <= 0) return;
          reloadScheduled();
          if (currentChatId && r.chats.includes(currentChatId)) void refreshMessagesAfterSend();
        })
        .catch(() => {});
    }, 15000);
    return () => clearInterval(t);
  }, [reloadScheduled, currentChatId, refreshMessagesAfterSend]);

  // ───── Mensajes fijados ─────

  const reloadPinned = useCallback(() => {
    setPinnedMsgs(currentChatId ? listPinnedMessages(currentChatId) : []);
  }, [currentChatId]);

  useEffect(() => {
    reloadPinned();
  }, [reloadPinned]);

  const handleTogglePin = useCallback(
    (m: ChatMessage) => {
      if (!currentChatId || !myId) return;
      if (isMessagePinned(currentChatId, m.id)) {
        unpinChatMessage(currentChatId, m.id);
        reloadPinned();
        toast.success("Mensaje desfijado");
      } else {
        const ok = pinChatMessage(currentChatId, m.id, myId);
        reloadPinned();
        if (ok) toast.success("Mensaje fijado 📌");
        else toast.info("Ese mensaje ya está fijado");
      }
    },
    [currentChatId, myId, reloadPinned]
  );

  const handleUnpinById = useCallback(
    (messageId: string) => {
      if (!currentChatId) return;
      unpinChatMessage(currentChatId, messageId);
      reloadPinned();
      toast.success("Mensaje desfijado");
    },
    [currentChatId, reloadPinned]
  );

  // ───── Conexión ─────

  const doConnect = useCallback(() => {
    saveSupabaseCredentials(connectUrl.trim(), connectKey.trim());
    window.location.reload();
  }, [connectUrl, connectKey]);

  // Carga listas al entrar en pestañas
  useEffect(() => {
    if (view === "dms" && !activeDm) void loadDmList();
  }, [view, activeDm, loadDmList]);

  useEffect(() => {
    if (view === "groups" && !activeGroup) void loadGroupList();
  }, [view, activeGroup, loadGroupList]);

  useEffect(() => {
    if (view === "groups" && !activeGroup) {
      void fetchMutualFollows()
        .then((f) => setMutualFollows(f))
        .catch(() => {});
    }
  }, [view, activeGroup]);

  // Reset del panel de menciones al cambiar de chat
  useEffect(() => {
    setMentionOpen(false);
    setStickersOpen(false);
    setScheduleOpen(false);
  }, [currentChatId]);

  const groupOf = (chatId: string): GroupChat | null => groupList.find((g) => g.chat_id === chatId) ?? null;
  const dmOf = (chatId: string): DmChat | null => dmList.find((d) => d.chat_id === chatId) ?? null;

  /** Abre un chat desde la búsqueda global. */
  const openSearchResult = useCallback(
    (chatId: string) => {
      setSearchOpen(false);
      if (chatId === COMMUNITY_CHAT_ID || chatId === chatInfo?.id) {
        setView("group");
        setActiveDm(null);
        setActiveGroup(null);
        return;
      }
      const g = groupOf(chatId);
      if (g) {
        openGroup(g);
        setView("groups");
        return;
      }
      const d = dmOf(chatId);
      if (d) {
        void openDm(d);
        setView("dms");
        return;
      }
      // Si no está en las listas, cargamos y buscamos
      void fetchMyGroupChats()
        .then((list) => {
          const found = list.find((x) => x.chat_id === chatId);
          if (found) {
            openGroup(found);
            setView("groups");
          }
        })
        .catch(() => {});
      void fetchMyDmChats()
        .then((list) => {
          const found = list.find((x) => x.chat_id === chatId);
          if (found) {
            void openDm(found);
            setView("dms");
          }
        })
        .catch(() => {});
    },
    [chatInfo, groupList, dmList, openGroup, openDm]
  );

  /* ─────────────────────────── Render ─────────────────────────── */

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="fixed inset-0 z-[90] bg-background/97 backdrop-blur-xl flex flex-col"
      style={{ height: "100dvh" }}
    >
      {/* ───── Cabecera ───── */}
      <header className="shrink-0 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="max-w-2xl md:max-w-full mx-auto flex items-center gap-2 px-4 py-3">
          {view !== "group" && (activeDm || activeGroup) && (
            <button
              onClick={() => {
                setActiveDm(null);
                setActiveGroup(null);
                setReplyTo(null);
              }}
              title="Volver"
              className="w-9 h-9 rounded-xl border border-border/70 bg-background grid place-items-center active:scale-95 transition shrink-0"
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            {view === "group" ? (
              <div
                className="relative shrink-0 rounded-full grid place-items-center"
                style={{
                  width: 46,
                  height: 46,
                  padding: 2,
                  background: "conic-gradient(from 210deg, var(--color-primary), var(--color-accent), var(--color-primary))",
                  boxShadow: "0 4px 16px -6px oklch(0.488 0.185 264/0.55)",
                }}
              >
                <div className="w-full h-full rounded-full bg-background grid place-items-center overflow-hidden">
                  <img
                    src={logo}
                    alt="Asternal"
                    draggable={false}
                    className="w-[34px] h-[34px] object-contain rounded-[10px]"
                  />
                </div>
              </div>
            ) : view === "dms" && activeDm ? (
              <Avatar p={activeDm.other} size={36} />
            ) : activeGroup ? (
              activeGroup.avatar_url ? (
                <img src={activeGroup.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
              ) : (
                <div
                  className="rounded-full grid place-items-center shrink-0 font-display font-semibold text-primary-foreground"
                  style={{ width: 36, height: 36, fontSize: 15, background: "linear-gradient(135deg, var(--color-primary), var(--color-accent))" }}
                >
                  {(activeGroup.name || "G")[0]?.toUpperCase()}
                </div>
              )
            ) : (
              <div
                className="rounded-full grid place-items-center shrink-0 font-display font-semibold text-primary-foreground"
                style={{ width: 36, height: 36, fontSize: 15, background: "linear-gradient(135deg, var(--color-primary), var(--color-accent))" }}
              >
                {view === "dms" ? <MessageCircle size={16} /> : <Users2 size={16} />}
              </div>
            )}
            <div className="min-w-0">
              <div className="text-[15px] leading-tight font-semibold truncate flex items-center gap-1.5">
                {view === "dms"
                  ? activeDm
                    ? activeDm.other?.display_name || activeDm.other?.username || "Chat individual"
                    : "Chats individuales"
                  : view === "groups"
                    ? activeGroup?.name ?? "Mis grupos"
                    : chatInfo?.name ?? COMMUNITY_CHAT_NAME}
                {isWork ? (
                  <span className="shrink-0 text-[8px] font-display tracking-widest px-1.5 py-0.5 rounded-md bg-primary/15 text-primary border border-primary/25">
                    TRABAJO
                  </span>
                ) : view === "group" ? (
                  <span className="shrink-0 text-[8px] font-display tracking-widest px-1.5 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                    COMUNIDAD
                  </span>
                ) : null}
              </div>
              <div className="text-[10px] text-muted-foreground truncate">
                {view === "group"
                  ? chatInfo
                    ? `${chatInfo.memberCount} ${chatInfo.memberCount === 1 ? "miembro" : "miembros"} · chat compartido`
                    : loading
                      ? "Conectando…"
                      : "Sin conexión"
                  : view === "dms"
                    ? activeDm
                      ? "Chat individual · os seguís mutuamente"
                      : "Personas con las que te sigues mutuamente"
                    : activeGroup
                      ? `${activeGroup.member_count || groupMembers.length} miembros${activeGroup.description ? ` · ${activeGroup.description}` : ""}`
                      : "Tus grupos con amigos"}
              </div>
            </div>
          </div>
          <button
            onClick={() => setSearchOpen(true)}
            title="Búsqueda global"
            className="w-9 h-9 rounded-xl border border-border/70 bg-background grid place-items-center active:scale-95 transition shrink-0 text-muted-foreground hover:text-primary"
          >
            <Search size={15} />
          </button>
          <button onClick={onClose} className="w-9 h-9 rounded-xl border border-border/70 bg-background grid place-items-center active:scale-95 transition shrink-0">
            <X size={16} />
          </button>
        </div>

        {/* Barra de acciones del chat activo */}
        {currentChatId && (view === "group" || activeDm || activeGroup) && (
          <div className="max-w-2xl md:max-w-full mx-auto px-4 pb-2.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {isWork && (
              <>
                <button
                  onClick={() => setTaskOpen(true)}
                  className="shrink-0 px-3 py-1.5 rounded-xl bg-card border border-border text-[10px] font-display tracking-[0.12em] text-muted-foreground hover:text-foreground hover:border-primary/40 active:scale-95 transition flex items-center gap-1.5"
                >
                  <ClipboardList size={12} /> TAREAS
                </button>
                <button
                  onClick={() => setFilesOpen(true)}
                  className="shrink-0 px-3 py-1.5 rounded-xl bg-card border border-border text-[10px] font-display tracking-[0.12em] text-muted-foreground hover:text-foreground hover:border-primary/40 active:scale-95 transition flex items-center gap-1.5"
                >
                  <FolderOpen size={12} /> ARCHIVOS
                </button>
                <button
                  onClick={() => setThreadsOpen(true)}
                  className="shrink-0 px-3 py-1.5 rounded-xl bg-card border border-border text-[10px] font-display tracking-[0.12em] text-muted-foreground hover:text-foreground hover:border-primary/40 active:scale-95 transition flex items-center gap-1.5"
                >
                  <MessagesSquare size={12} /> HILOS
                </button>
                <button
                  onClick={() => setProjectsOpen(true)}
                  className="shrink-0 px-3 py-1.5 rounded-xl bg-card border border-border text-[10px] font-display tracking-[0.12em] text-muted-foreground hover:text-foreground hover:border-primary/40 active:scale-95 transition flex items-center gap-1.5"
                >
                  <Briefcase size={12} /> PROYECTOS
                </button>
              </>
            )}
            {canAnnounce && (
              <button
                onClick={() => setAnnounceOpen(true)}
                className="shrink-0 px-3 py-1.5 rounded-xl bg-card border border-border text-[10px] font-display tracking-[0.12em] text-muted-foreground hover:text-amber-500 hover:border-amber-400/40 active:scale-95 transition flex items-center gap-1.5"
              >
                <Megaphone size={12} /> AVISO
              </button>
            )}
            {canPoll && (
              <button
                onClick={() => setPollOpen(true)}
                className="shrink-0 px-3 py-1.5 rounded-xl bg-card border border-border text-[10px] font-display tracking-[0.12em] text-muted-foreground hover:text-primary hover:border-primary/40 active:scale-95 transition flex items-center gap-1.5"
              >
                <BarChart3 size={12} /> ENCUESTA
              </button>
            )}
            {view === "group" && (
              <button
                onClick={() => setGiftOpen(true)}
                className="shrink-0 px-3 py-1.5 rounded-xl bg-card border border-border text-[10px] font-display tracking-[0.12em] text-muted-foreground hover:text-primary hover:border-primary/40 active:scale-95 transition flex items-center gap-1.5"
              >
                <Gift size={12} /> REGALO
              </button>
            )}
            {activeGroup && (
              <button
                onClick={() => {
                  setGroupInfoOpen(true);
                  void reloadGroupInfo(activeGroup.chat_id);
                }}
                className="shrink-0 px-3 py-1.5 rounded-xl bg-card border border-border text-[10px] font-display tracking-[0.12em] text-muted-foreground hover:text-primary hover:border-primary/40 active:scale-95 transition flex items-center gap-1.5"
              >
                <Settings2 size={12} /> INFO
              </button>
            )}
            {view === "group" && isLocal && (
              <button
                onClick={() => setConnecting(true)}
                className="shrink-0 px-3 py-1.5 rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground text-[10px] font-display tracking-[0.12em] active:scale-95 transition flex items-center gap-1.5"
              >
                <WifiOff size={12} /> CONECTAR
              </button>
            )}
          </div>
        )}
      </header>

      {/* Pestañas: chat comunitario ↔ grupos ↔ chats individuales */}
      {!isLocal && (
        <div className="max-w-2xl md:max-w-full mx-auto flex items-center gap-1.5 px-4 pb-2.5">
          <button
            onClick={() => {
              setView("group");
              setActiveDm(null);
              setActiveGroup(null);
            }}
            className={`flex-1 py-1.5 rounded-xl text-[10px] font-display tracking-[0.14em] flex items-center justify-center gap-1.5 transition active:scale-[0.98] ${view === "group" ? "bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-[0_4px_12px_-5px_oklch(0.488_0.185_264/0.5)]" : "bg-card border border-border text-muted-foreground hover:text-foreground"}`}
          >
            <img src={logo} alt="" draggable={false} className="w-3.5 h-3.5 object-contain rounded-[3px] shrink-0" /> CHAT COMUNITARIO
          </button>
          <button
            onClick={() => {
              setView("groups");
              setActiveGroup(null);
              setActiveDm(null);
              void loadGroupList();
            }}
            className={`relative flex-1 py-1.5 rounded-xl text-[10px] font-display tracking-[0.14em] flex items-center justify-center gap-1.5 transition active:scale-[0.98] ${view === "groups" ? "bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-[0_4px_12px_-5px_oklch(0.488_0.185_264/0.5)]" : "bg-card border border-border text-muted-foreground hover:text-foreground"}`}
          >
            <Users2 size={12} /> GRUPOS
            {totalGroupUnread > 0 && (
              <span className="shrink-0 min-w-[16px] h-4 px-1 rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground text-[9px] font-display grid place-items-center">
                {totalGroupUnread >= 100 ? "99" : totalGroupUnread}
              </span>
            )}
          </button>
          <button
            onClick={() => {
              setView("dms");
              setActiveDm(null);
              void loadDmList();
            }}
            className={`relative flex-1 py-1.5 rounded-xl text-[10px] font-display tracking-[0.14em] flex items-center justify-center gap-1.5 transition active:scale-[0.98] ${view === "dms" ? "bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-[0_4px_12px_-5px_oklch(0.488_0.185_264/0.5)]" : "bg-card border border-border text-muted-foreground hover:text-foreground"}`}
          >
            <MessageCircle size={12} /> DIRECTOS
            {totalDmUnread > 0 && (
              <span className="shrink-0 min-w-[16px] h-4 px-1 rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground text-[9px] font-display grid place-items-center">
                {totalDmUnread >= 100 ? "99" : totalDmUnread}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Aviso de modo local */}
      {isLocal && view === "group" && (
        <div className="shrink-0 max-w-2xl md:max-w-full mx-auto w-full px-4 pb-2">
          <div className="px-3 py-2 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-center gap-2">
            <span className="flex-1 text-[11px] text-amber-700 dark:text-amber-300">
              Chat local: tu cuenta actual no está en Supabase, así que los mensajes se guardan solo en este dispositivo.
            </span>
          </div>
        </div>
      )}

      {/* Error de conexión */}
      {initError && !chatInfo && !loading && (
        <div className="shrink-0 max-w-2xl md:max-w-full mx-auto w-full px-4 pb-2">
          <div className="px-3 py-3 rounded-xl border border-rose-500/25 bg-rose-500/[0.06] space-y-2.5">
            <div className="flex items-start gap-2.5">
              <WifiOff size={15} className="text-rose-500 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed text-muted-foreground">
                <span className="font-semibold text-foreground">No se pudo conectar al chat.</span>{" "}
                Revisa que la URL y la anon key de Supabase sean correctas y vuelve a intentarlo.
              </div>
            </div>
            <button
              onClick={() => setRetryKey((k) => k + 1)}
              className="w-full py-2 rounded-xl border border-border bg-background text-[10px] font-display tracking-widest active:scale-[0.98] transition flex items-center justify-center gap-1.5"
            >
              <RefreshCw size={12} /> REINTENTAR
            </button>
          </div>
        </div>
      )}

      {/* ───── Listas (grupos / dms) ───── */}
      {view === "groups" && !activeGroup ? (
        <div className="flex-1 overflow-y-auto no-scrollbar min-h-0 px-4 py-3">
          <div className="max-w-2xl md:max-w-full mx-auto">
            <div className="flex items-center justify-between mb-2.5">
              <div className="text-[10px] font-display tracking-[0.18em] text-muted-foreground flex items-center gap-1.5">
                <Users2 size={11} /> MIS GRUPOS · {groupList.length}
              </div>
              <button
                onClick={() => setCreateGroupOpen(true)}
                className="shrink-0 px-3 py-1.5 rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground text-[10px] font-display tracking-widest active:scale-95 transition flex items-center gap-1.5 shadow-[0_4px_12px_-5px_oklch(0.488_0.185_264/0.5)]"
              >
                <UserPlus size={12} /> NUEVO GRUPO
              </button>
            </div>
            {groupList.length === 0 ? (
              <div className="text-center text-xs text-muted-foreground py-12 px-6">
                Aún no tienes grupos. Crea uno con tus amigos que se siguen mutuamente 🫂
              </div>
            ) : (
              <div className="space-y-2">
                {groupList.map((g) => (
                  <button
                    key={g.chat_id}
                    onClick={() => openGroup(g)}
                    className="w-full flex items-center gap-3 rounded-2xl bg-card border border-border px-3 py-2.5 hover:border-primary/40 hover:bg-muted/40 active:scale-[0.99] transition group"
                  >
                    {g.avatar_url ? (
                      <img src={g.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" />
                    ) : (
                      <div
                        className="rounded-full grid place-items-center shrink-0 font-display font-semibold text-primary-foreground"
                        style={{ width: 44, height: 44, fontSize: 17, background: "linear-gradient(135deg, var(--color-primary), var(--color-accent))" }}
                      >
                        {(g.name || "G")[0]?.toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1 text-left">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px] font-semibold truncate">{g.name}</span>
                        {isWorkChat(g.chat_id) && (
                          <span className="shrink-0 text-[8px] font-display tracking-widest px-1.5 py-0.5 rounded-md bg-primary/15 text-primary border border-primary/25">
                            TRABAJO
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {g.last_message ? mediaLabel(g.last_message) : g.description || `${g.member_count} miembros`}
                      </div>
                    </div>
                    {g.unread > 0 && (
                      <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground text-[9px] font-display grid place-items-center">
                        {g.unread >= 100 ? "99" : g.unread}
                      </span>
                    )}
                    <ChevronRight size={14} className="text-muted-foreground/40 group-hover:text-primary shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : view === "dms" && !activeDm ? (
        <div className="flex-1 overflow-y-auto no-scrollbar min-h-0 px-4 py-3">
          <div className="max-w-2xl md:max-w-full mx-auto">
            <div className="flex items-center justify-between mb-2.5">
              <div className="text-[10px] font-display tracking-[0.18em] text-muted-foreground flex items-center gap-1.5">
                <MessageCircle size={11} /> CHATS INDIVIDUALES · {dmList.length}
              </div>
              <button
                onClick={() => {
                  setNewDmOpen(true);
                  void fetchMutualFollows()
                    .then((f) => setMutualFollows(f))
                    .catch(() => {});
                }}
                className="shrink-0 px-3 py-1.5 rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground text-[10px] font-display tracking-widest active:scale-95 transition flex items-center gap-1.5 shadow-[0_4px_12px_-5px_oklch(0.488_0.185_264/0.5)]"
              >
                <UserPlus size={12} /> NUEVO CHAT
              </button>
            </div>
            {dmList.length === 0 ? (
              <div className="text-center text-xs text-muted-foreground py-12 px-6">
                Sin conversaciones todavía. Toca «Nuevo chat» y elige a alguien que te siga mutuamente 💬
              </div>
            ) : (
              <div className="space-y-2">
                {dmList.map((d) => (
                  <button
                    key={d.chat_id}
                    onClick={() => void openDm(d)}
                    className="w-full flex items-center gap-3 rounded-2xl bg-card border border-border px-3 py-2.5 hover:border-primary/40 hover:bg-muted/40 active:scale-[0.99] transition group"
                  >
                    <Avatar p={d.other} size={44} />
                    <div className="min-w-0 flex-1 text-left">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[13px] font-semibold truncate">{d.other?.display_name || d.other?.username}</span>
                        <span className="text-[9px] text-muted-foreground/70 shrink-0">{d.last_at ? fmtDay(d.last_at) : ""}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <span className="text-[11px] text-muted-foreground truncate">
                          {d.last_message ? mediaLabel(d.last_message) : "Se siguen mutuamente · inicia la conversación"}
                        </span>
                        {d.unread > 0 && (
                          <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground text-[9px] font-display grid place-items-center">
                            {d.unread >= 100 ? "99" : d.unread}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight size={14} className="text-muted-foreground/40 group-hover:text-primary shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* ───── Mensajes ───── */}
          {unseen > 0 && (
            <div className="shrink-0 max-w-2xl md:max-w-full mx-auto w-full px-4 mt-2">
              <button
                onClick={jumpToBottom}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground text-[11px] font-display tracking-wide shadow-lg shadow-primary/25 active:scale-[0.98] transition"
              >
                <ArrowDown size={12} /> {unseen >= 100 ? "99" : unseen} mensaje{unseen === 1 ? "" : "s"} nuevo{unseen === 1 ? "" : "s"}
              </button>
            </div>
          )}

          <div ref={listRef} onScroll={onScrollList} className="relative flex-1 overflow-y-auto px-3 py-4 space-y-3 no-scrollbar min-h-0">
            {loadingMore && (
              <div className="flex justify-center py-1">
                <Loader2 size={14} className="animate-spin text-muted-foreground" />
              </div>
            )}
            {/* Mensajes fijados por administradores/moderadores */}
            {currentChatId && pinnedMsgs.length > 0 && (
              <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-sm p-2.5 space-y-1.5">
                <div className="text-[9px] font-display tracking-[0.18em] text-muted-foreground/70 flex items-center gap-1.5">
                  <Pin size={10} className="text-primary" /> FIJADOS · {pinnedMsgs.length}
                </div>
                {pinnedMsgs.map((p) => {
                  const pm = messages.find((x) => x.id === p.message_id) ?? null;
                  const ps = pm ? senders.get(pm.sender_id) : null;
                  return (
                    <div key={p.id} className="flex items-center gap-2 rounded-xl bg-muted/40 px-2.5 py-2">
                      <Pin size={11} className="text-primary shrink-0 rotate-45" />
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-semibold truncate">
                          {ps?.display_name || ps?.username || "Miembro"}
                          <span className="font-mono text-[9px] text-muted-foreground/70 font-normal">
                            {" · "}
                            {pm ? fmtTime(pm.created_at) : fmtTime(p.pinned_at)}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">{pm ? mediaLabel(pm) : "Mensaje no disponible"}</div>
                      </div>
                      {canAnnounce && (
                        <button
                          onClick={() => handleUnpinById(p.message_id)}
                          className="shrink-0 w-7 h-7 rounded-lg grid place-items-center text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 active:scale-95 transition"
                          title="Desfijar"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {/* Mensajes programados pendientes de enviar */}
            {currentChatId && scheduledMsgs.length > 0 && (
              <div className="space-y-2 pb-1">
                {scheduledMsgs.map((s) => (
                  <div key={s.id} className="flex items-center gap-2.5 rounded-2xl border border-dashed border-primary/40 bg-primary/5 px-3 py-2.5">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 grid place-items-center shrink-0">
                      <Clock size={15} className="text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-display tracking-widest text-primary">
                        PROGRAMADO · {fmtScheduledAt(s.scheduled_at)}
                      </div>
                      <div className="text-[12px] text-muted-foreground truncate">{s.content ?? "Mensaje programado"}</div>
                    </div>
                    <button
                      onClick={() => handleCancelScheduled(s.id)}
                      className="shrink-0 w-7 h-7 rounded-lg grid place-items-center text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 active:scale-95 transition"
                      title="Cancelar envío"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 size={18} className="animate-spin text-muted-foreground" />
              </div>
            ) : !currentChatId ? null : !messages.length ? (
              <div className="text-center text-xs text-muted-foreground py-10 px-6">
                {activeDm ? "Sin mensajes todavía · saluda a esta persona 👋" : "Sé el primero en saludar a la comunidad 👋"}
              </div>
            ) : (
              messages.map((m) => (
                <SafeRow key={m.id}>
                  {isAnnouncement(m) ? (
                    <AnnouncementCard m={m} sender={senders.get(m.sender_id)} />
                  ) : isGiftMessage(m) ? (
                    <GiftCard
                      gift={m.gift_id ? gifts.get(m.gift_id) ?? null : null}
                      claiming={claimingId === m.gift_id}
                      expiring={expiringId === m.gift_id}
                      claimedAmount={m.gift_id ? (gifts.get(m.gift_id)?.claimed_by_me ? gifts.get(m.gift_id)?.amount_per_person : undefined) : undefined}
                      onClaim={() => m.gift_id && void handleClaimGift(m.gift_id)}
                      onExpire={() => m.gift_id && void handleExpireGift(m.gift_id)}
                    />
                  ) : isPollMessage(m) ? (
                    <PollCard
                      poll={m.poll_id ? polls.get(m.poll_id) ?? null : null}
                      sender={senders.get(m.sender_id)}
                      votingId={votingId}
                      closingId={closingId}
                      canClose={!!m.poll_id && (view === "group" ? isOwner : groupRole === "owner" || groupRole === "admin")}
                      onVote={(oi) => {
                        const p = m.poll_id ? polls.get(m.poll_id) ?? null : null;
                        if (p) void handleVotePoll(p, oi);
                      }}
                      onClose={() => {
                        const p = m.poll_id ? polls.get(m.poll_id) ?? null : null;
                        if (p) void handleClosePoll(p);
                      }}
                    />
                  ) : (
                    <MessageBubble
                      m={m}
                      mine={m.sender_id === myId}
                      sender={senders.get(m.sender_id)}
                      senders={senders}
                      reply={m.reply_to_id ? messages.find((x) => x.id === m.reply_to_id) ?? null : null}
                      mediaUrl={resolveMediaUrl(m.media_url)}
                      copied={copiedId === m.id}
                      pinned={!!currentChatId && isMessagePinned(currentChatId, m.id)}
                      canPin={canAnnounce}
                      onPin={() => handleTogglePin(m)}
                      onCopy={() => void copyMessage(m)}
                      onReply={() => {
                        setReplyTo(m);
                        setStickersOpen(false);
                        inputRef.current?.focus();
                      }}
                    />
                  )}
                </SafeRow>
              ))
            )}
            {isWork && threads.length > 0 && (
              <div className="pt-1">
                <div className="text-[9px] font-display tracking-[0.18em] text-muted-foreground/70 mb-1.5 flex items-center gap-1.5">
                  <MessagesSquare size={10} /> HILOS DEL CHAT
                </div>
                <div className="space-y-1.5">
                  {threads.map((t) => {
                    const tCount = listThreadMessages(t.id).length;
                    return (
                      <button
                        key={t.id}
                        onClick={() => openThread(t)}
                        className="w-full flex items-center gap-2.5 rounded-2xl bg-card border border-border px-3 py-2 hover:border-primary/40 active:scale-[0.99] transition"
                      >
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/15 to-accent/15 grid place-items-center shrink-0">
                          <MessagesSquare size={14} className="text-primary" />
                        </div>
                        <div className="min-w-0 flex-1 text-left">
                          <div className="text-[12px] font-semibold truncate">{t.title}</div>
                          <div className="text-[10px] text-muted-foreground truncate">
                            {t.created_by_name} · {tCount} mensaje{tCount === 1 ? "" : "s"}
                          </div>
                        </div>
                        <ChevronRight size={14} className="text-muted-foreground/40 shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* ───── Barra de respuesta ───── */}
          <AnimatePresence>
            {replyTo && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.15 }}
                className="shrink-0 max-w-2xl md:max-w-full mx-auto w-full px-4 mb-1.5"
              >
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-primary/25 bg-primary/5">
                  <Reply size={12} className="text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-display tracking-wider text-primary">
                      RESPONDIENDO A{" "}
                      {senders.get(replyTo.sender_id)?.display_name?.toUpperCase() ||
                        senders.get(replyTo.sender_id)?.username?.toUpperCase() ||
                        ""}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">{mediaLabel(replyTo)}</div>
                  </div>
                  <button onClick={() => setReplyTo(null)} className="w-6 h-6 grid place-items-center rounded-md hover:bg-muted/70 text-muted-foreground shrink-0">
                    <X size={12} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ───── Barra de escritura ───── */}
          <div className="shrink-0 px-3 pb-[max(env(safe-area-inset-bottom),12px)] pt-1.5">
            <div className="max-w-2xl md:max-w-full mx-auto relative flex items-end gap-2 bg-card border border-border rounded-2xl px-3 py-2 shadow-sm">
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
                    onClick={() => photoInputRef.current?.click()}
                    disabled={mediaUploading}
                    title="Enviar foto"
                    className={`w-9 h-9 rounded-xl grid place-items-center active:scale-95 transition shrink-0 disabled:opacity-40 ${pendingMedia?.kind === "image" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/60"}`}
                  >
                    <ImagePlus size={18} />
                  </button>
                  <button
                    onClick={() => videoInputRef.current?.click()}
                    disabled={mediaUploading}
                    title="Enviar vídeo"
                    className={`w-9 h-9 rounded-xl grid place-items-center active:scale-95 transition shrink-0 disabled:opacity-40 ${pendingMedia?.kind === "video" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/60"}`}
                  >
                    <Film size={18} />
                  </button>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      e.target.value = "";
                      if (f) pickMedia(f);
                    }}
                  />
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      e.target.value = "";
                      if (f) pickMedia(f);
                    }}
                  />
                  <button
                    onClick={() => setStickersOpen((o) => !o)}
                    className={`w-9 h-9 rounded-xl grid place-items-center active:scale-95 transition shrink-0 ${stickersOpen ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/60"}`}
                  >
                    <SmilePlus size={18} />
                  </button>
                  <button
                    onClick={() => {
                      setScheduleOpen((o) => !o);
                      setStickersOpen(false);
                    }}
                    className={`w-9 h-9 rounded-xl grid place-items-center active:scale-95 transition shrink-0 ${scheduleOpen ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/60"}`}
                    title="Programar mensaje"
                  >
                    <CalendarClock size={18} />
                  </button>

                  {pendingMedia && (
                    <div className="absolute bottom-full left-0 right-0 mb-2 bg-card border border-border rounded-2xl p-2.5 shadow-xl z-20 flex items-center gap-2">
                      {pendingMedia.kind === "image" ? (
                        <img src={URL.createObjectURL(pendingMedia.file)} alt="Foto" className="w-14 h-14 rounded-xl object-cover shrink-0" />
                      ) : (
                        <video src={URL.createObjectURL(pendingMedia.file)} className="w-14 h-14 rounded-xl object-cover shrink-0" muted />
                      )}
                      <span className="flex-1 text-[11px] text-muted-foreground truncate">
                        {pendingMedia.kind === "image" ? "Foto lista" : "Vídeo listo"} · {draft.trim() ? `«${draft.trim()}»` : "añade un subtítulo opcional"}
                      </span>
                      <button
                        onClick={() => setPendingMedia(null)}
                        className="w-7 h-7 rounded-lg grid place-items-center text-muted-foreground hover:text-rose-500 active:scale-95 transition shrink-0"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  )}

                  <textarea
                    ref={inputRef}
                    value={draft}
                    onChange={(e) => {
                      const v = e.target.value;
                      setDraft(v);
                      textareaAutoGrow(e.target);
                      const caret = e.target.selectionStart ?? v.length;
                      const before = v.slice(0, caret);
                      const m = before.match(/(?:^|\s)@([\w.]*)$/);
                      if (m) {
                        mentionRef.current = { start: caret - m[0].length + (m[0].startsWith("@") ? 0 : 1), end: caret };
                        setMentionQuery(m[1]);
                        setMentionOpen(true);
                      } else {
                        setMentionOpen(false);
                        mentionRef.current = null;
                        setMentionQuery("");
                      }
                    }}
                    onKeyDown={(e) => {
                      if (mentionOpen && mentionCandidates.length > 0) {
                        if (e.key === "ArrowDown") {
                          e.preventDefault();
                          setMentionIndex((i) => (i + 1) % mentionCandidates.length);
                          return;
                        }
                        if (e.key === "ArrowUp") {
                          e.preventDefault();
                          setMentionIndex((i) => (i - 1 + mentionCandidates.length) % mentionCandidates.length);
                          return;
                        }
                        if (e.key === "Enter" || e.key === "Tab") {
                          const p = mentionCandidates[mentionIndex];
                          if (p) {
                            e.preventDefault();
                            insertMention(p);
                            return;
                          }
                        }
                        if (e.key === "Escape") {
                          setMentionOpen(false);
                          return;
                        }
                      }
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void (pendingMedia ? sendPendingMedia() : handleSend());
                      }
                    }}
                    enterKeyHint="send"
                    rows={1}
                    placeholder="Escribe un mensaje… usa @ para mencionar"
                    className="flex-1 resize-none bg-transparent outline-none text-sm leading-snug py-1.5 max-h-[120px] placeholder:text-muted-foreground/60"
                  />
                  {/* Sugerencias de menciones @usuario */}
                  <AnimatePresence>
                    {mentionOpen && mentionCandidates.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.98 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        className="absolute bottom-full left-0 right-0 mb-2 bg-card border border-border rounded-2xl shadow-xl p-1.5 z-20 max-h-56 overflow-y-auto no-scrollbar"
                      >
                        <div className="px-2 py-1 text-[10px] font-display tracking-widest text-muted-foreground flex items-center gap-1.5">
                          <AtSign size={11} /> MENCIONAR · @{mentionQuery || "…"}
                        </div>
                        {mentionCandidates.map((p, i) => (
                          <button
                            key={p.id}
                            onClick={() => insertMention(p)}
                            onMouseEnter={() => setMentionIndex(i)}
                            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-xl text-left transition ${i === mentionIndex ? "bg-primary/10" : "hover:bg-muted/60"}`}
                          >
                            <Avatar p={p} size={26} />
                            <div className="min-w-0 flex-1">
                              <div className="text-[12px] font-semibold truncate">{p.display_name || p.username}</div>
                              <div className="text-[10px] font-mono text-muted-foreground truncate">@{p.username ?? "?"}</div>
                            </div>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <button
                    onClick={() => void (pendingMedia ? sendPendingMedia() : handleSend())}
                    disabled={!draft.trim() && !pendingMedia}
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
                    <div className="text-[10px] font-display tracking-widest text-muted-foreground mb-2">TUS DIBUJOS DE GALERÍA</div>
                    {myStickers.length === 0 ? (
                      <div className="text-[11px] text-muted-foreground text-center py-4">Aún no tienes dibujos en la galería.</div>
                    ) : (
                      <div className="grid grid-cols-4 gap-2">
                        {myStickers.map((s) => (
                          <div key={s.path} className="relative">
                            <button
                              onClick={() => void handleSend(signedStickers.get(s.path) ?? s.path, "sticker")}
                              title={s.title}
                              className="aspect-square w-full rounded-xl overflow-hidden border border-border hover:border-primary/50 hover:scale-105 active:scale-95 transition"
                            >
                              <img src={signedStickers.get(s.path) ?? s.path} alt={s.title} className="w-full h-full object-cover" />
                            </button>
                            <button
                              onClick={() => void handleDeleteSticker(s)}
                              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-background border border-border grid place-items-center text-muted-foreground hover:text-rose-500 active:scale-90 transition shadow-sm"
                            >
                              <X size={9} />
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

              {/* Panel de mensaje programado */}
              <AnimatePresence>
                {scheduleOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.98 }}
                    transition={{ duration: 0.16, ease: "easeOut" }}
                    className="absolute bottom-full left-0 right-0 mb-2 bg-card border border-border rounded-2xl shadow-xl p-3 z-20"
                  >
                    <div className="flex items-center gap-1.5 text-[10px] font-display tracking-widest text-muted-foreground mb-2">
                      <CalendarClock size={11} /> PROGRAMAR MENSAJE
                    </div>
                    <input
                      type="datetime-local"
                      value={scheduleAt}
                      min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                      onChange={(e) => setScheduleAt(e.target.value)}
                      className="w-full rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm outline-none focus:border-primary/50 mb-2"
                    />
                    <p className="text-[11px] text-muted-foreground mb-2 truncate">
                      {draft.trim() ? `Se enviará: «${draft.trim()}»` : "Escribe el mensaje que quieres programar"}
                    </p>
                    <button
                      onClick={() => void handleScheduleMessage()}
                      disabled={!draft.trim() || !scheduleAt}
                      className="w-full py-2 rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground text-[11px] font-display tracking-wide active:scale-[0.98] transition disabled:opacity-40"
                    >
                      PROGRAMAR
                    </button>
                    {scheduledMsgs.length > 0 && (
                      <div className="mt-3 space-y-1.5 max-h-36 overflow-y-auto no-scrollbar">
                        <div className="text-[10px] font-display tracking-widest text-muted-foreground">
                          PROGRAMADOS · {scheduledMsgs.length}
                        </div>
                        {scheduledMsgs.map((s) => (
                          <div key={s.id} className="flex items-center gap-2 rounded-xl bg-muted/40 px-2.5 py-1.5">
                            <Clock size={11} className="text-primary shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="text-[10px] font-mono text-primary">{fmtScheduledAt(s.scheduled_at)}</div>
                              <div className="text-[11px] truncate">{s.content ?? "…"}</div>
                            </div>
                            <button
                              onClick={() => handleCancelScheduled(s.id)}
                              className="shrink-0 w-7 h-7 rounded-lg grid place-items-center text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 active:scale-95 transition"
                              title="Cancelar"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </>
      )}

      {/* ───── Diálogo: conectar Supabase ───── */}
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
                Pega la URL y la anon key de tu proyecto (están en Keys como V1 y V2). Los mensajes y la comunidad se sincronizarán entre dispositivos.
              </p>
              <input
                value={connectUrl}
                onChange={(e) => setConnectUrl(e.target.value)}
                placeholder="https://xxxx.supabase.co"
                className="w-full bg-input/50 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 border border-border/60 mb-2"
              />
              <input
                value={connectKey}
                onChange={(e) => setConnectKey(e.target.value)}
                placeholder="eyJhbGciOi… (anon key)"
                className="w-full bg-input/50 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 border border-border/60 mb-3"
              />
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

      {/* ───── Diálogo: nuevo chat individual ───── */}
      <AnimatePresence>
        {newDmOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[95] bg-black/55 backdrop-blur-md grid place-items-center p-4"
            onClick={() => setNewDmOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.96, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 8 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-card border border-border rounded-2xl p-4 shadow-xl max-h-[85vh] overflow-y-auto no-scrollbar"
            >
              <div className="text-sm font-semibold mb-0.5 flex items-center gap-2">
                <MessageCircle size={15} className="text-primary" /> Nuevo chat individual
              </div>
              <p className="text-[11px] text-muted-foreground mb-3">
                Elige a alguien que te siga mutuamente para empezar a chatear.
              </p>
              {mutualFollows.length === 0 ? (
                <div className="text-center text-xs text-muted-foreground py-8">
                  Nadie te sigue mutuamente todavía. Cuando alguien te siga y lo sigas, podrás chatear aquí.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {mutualFollows.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => void startDmWith(p)}
                      className="w-full flex items-center gap-2.5 rounded-xl px-2 py-2 hover:bg-muted/60 active:scale-[0.99] transition text-left"
                    >
                      <Avatar p={p} size={36} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-semibold truncate">{p.display_name || p.username}</div>
                        <div className="text-[10px] font-mono text-muted-foreground truncate">@{p.username}</div>
                      </div>
                      <ChevronRight size={14} className="text-muted-foreground/40 shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ───── Diálogo: crear grupo ───── */}
      <AnimatePresence>
        {createGroupOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[95] bg-black/55 backdrop-blur-md grid place-items-center p-4"
            onClick={() => !cgBusy && setCreateGroupOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.96, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 8 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-card border border-border rounded-2xl p-4 shadow-xl max-h-[85vh] overflow-y-auto no-scrollbar"
            >
              <div className="text-sm font-semibold mb-0.5 flex items-center gap-2">
                <Users2 size={15} className="text-primary" /> Crear grupo
              </div>
              <p className="text-[11px] text-muted-foreground mb-3">
                Un chat solo para ti y tus amigos. Solo pueden entrar personas que te siguen mutuamente.
              </p>
              <div className="flex items-center gap-3 mb-3">
                <button
                  onClick={() => cgAvatarRef.current?.click()}
                  className="relative w-16 h-16 rounded-full overflow-hidden grid place-items-center shrink-0 font-display font-semibold text-primary-foreground active:scale-95 transition border-2 border-primary/30"
                  style={{ background: "linear-gradient(135deg, var(--color-primary), var(--color-accent))" }}
                >
                  {cgAvatar ? (
                    <img src={cgAvatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    (cgName.trim() || "G")[0]?.toUpperCase()
                  )}
                  <span className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-background border border-border grid place-items-center">
                    <Camera size={11} />
                  </span>
                </button>
                <input
                  ref={cgAvatarRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    e.target.value = "";
                    if (f) {
                      const reader = new FileReader();
                      reader.onload = () => setCgAvatar(String(reader.result));
                      reader.readAsDataURL(f);
                    }
                  }}
                />
                <div className="flex-1 space-y-2">
                  <input
                    value={cgName}
                    onChange={(e) => setCgName(e.target.value)}
                    placeholder="Nombre del grupo"
                    className="w-full bg-input/50 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 border border-border/60"
                  />
                  <input
                    value={cgDesc}
                    onChange={(e) => setCgDesc(e.target.value)}
                    placeholder="Descripción (opcional)"
                    className="w-full bg-input/50 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 border border-border/60"
                  />
                </div>
              </div>
              <div className="text-[10px] font-display tracking-widest text-muted-foreground mb-1.5">
                MIEMBROS ({cgSelected.length}) · SOLO SEGUIMIENTO MUTUO
              </div>
              {mutualFollows.length === 0 ? (
                <div className="text-center text-[11px] text-muted-foreground py-4">
                  No tienes contactos de seguimiento mutuo todavía.
                </div>
              ) : (
                <div className="space-y-1 max-h-44 overflow-y-auto no-scrollbar">
                  {mutualFollows.map((p) => {
                    const sel = cgSelected.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        onClick={() => setCgSelected((prev) => (sel ? prev.filter((x) => x !== p.id) : [...prev, p.id]))}
                        className={`w-full flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition text-left ${sel ? "bg-primary/10 border border-primary/30" : "border border-transparent hover:bg-muted/60"}`}
                      >
                        <Avatar p={p} size={30} />
                        <div className="min-w-0 flex-1">
                          <div className="text-[12px] font-semibold truncate">{p.display_name || p.username}</div>
                          <div className="text-[9px] font-mono text-muted-foreground truncate">@{p.username}</div>
                        </div>
                        <span
                          className={`w-5 h-5 rounded-md grid place-items-center shrink-0 transition ${sel ? "bg-gradient-to-br from-primary to-accent text-primary-foreground" : "border border-border text-transparent"}`}
                        >
                          <Check size={11} />
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              {cgErr && <div className="mt-2 text-[11px] text-rose-500">{cgErr}</div>}
              <button
                onClick={() => void handleCreateGroup()}
                disabled={cgBusy || !cgName.trim()}
                className="mt-3 w-full py-2.5 rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground text-xs font-display tracking-widest active:scale-[0.98] transition disabled:opacity-40 flex items-center justify-center gap-1.5"
              >
                {cgBusy ? <Loader2 size={13} className="animate-spin" /> : <Users2 size={13} />}
                {cgBusy ? "CREANDO…" : "CREAR GRUPO"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ───── Diálogo: editar grupo ───── */}
      <AnimatePresence>
        {editGroupOpen && activeGroup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[95] bg-black/55 backdrop-blur-md grid place-items-center p-4"
            onClick={() => !egBusy && setEditGroupOpen(false)}
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
                <Pencil size={15} className="text-primary" /> Editar grupo
              </div>
              <div className="flex items-center gap-3 mb-3 mt-3">
                <button
                  onClick={() => egAvatarRef.current?.click()}
                  className="relative w-14 h-14 rounded-full overflow-hidden grid place-items-center shrink-0 font-display font-semibold text-primary-foreground active:scale-95 transition border-2 border-primary/30"
                  style={{ background: "linear-gradient(135deg, var(--color-primary), var(--color-accent))" }}
                >
                  {egAvatar ? (
                    <img src={egAvatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    (egName.trim() || "G")[0]?.toUpperCase()
                  )}
                  <span className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-background border border-border grid place-items-center">
                    <Camera size={9} />
                  </span>
                </button>
                <input
                  ref={egAvatarRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    e.target.value = "";
                    if (f) {
                      const reader = new FileReader();
                      reader.onload = () => setEgAvatar(String(reader.result));
                      reader.readAsDataURL(f);
                    }
                  }}
                />
                <div className="flex-1 space-y-2">
                  <input
                    value={egName}
                    onChange={(e) => setEgName(e.target.value)}
                    placeholder="Nombre del grupo"
                    className="w-full bg-input/50 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 border border-border/60"
                  />
                  <input
                    value={egDesc}
                    onChange={(e) => setEgDesc(e.target.value)}
                    placeholder="Descripción (opcional)"
                    className="w-full bg-input/50 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 border border-border/60"
                  />
                </div>
              </div>
              <button
                onClick={() => void handleEditGroup()}
                disabled={egBusy || !egName.trim()}
                className="w-full py-2.5 rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground text-xs font-display tracking-widest active:scale-[0.98] transition disabled:opacity-40 flex items-center justify-center gap-1.5"
              >
                {egBusy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                {egBusy ? "GUARDANDO…" : "GUARDAR"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ───── Diálogo: info del grupo (miembros, roles, ajustes) ───── */}
      <AnimatePresence>
        {groupInfoOpen && activeGroup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[95] bg-black/55 backdrop-blur-md grid place-items-center p-4"
            onClick={() => setGroupInfoOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.96, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 8 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-card border border-border rounded-2xl p-4 shadow-xl max-h-[85vh] overflow-y-auto no-scrollbar"
            >
              <div className="flex items-center gap-2.5 mb-3">
                {activeGroup.avatar_url ? (
                  <img src={activeGroup.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover shrink-0" />
                ) : (
                  <div
                    className="rounded-full grid place-items-center shrink-0 font-display font-semibold text-primary-foreground"
                    style={{ width: 48, height: 48, fontSize: 18, background: "linear-gradient(135deg, var(--color-primary), var(--color-accent))" }}
                  >
                    {(activeGroup.name || "G")[0]?.toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate flex items-center gap-1.5">
                    {activeGroup.name}
                    {isWork && (
                      <span className="shrink-0 text-[8px] font-display tracking-widest px-1.5 py-0.5 rounded-md bg-primary/15 text-primary border border-primary/25">
                        TRABAJO
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {groupMembers.length} miembros · tu rol: {groupRole ?? "miembro"}
                  </div>
                </div>
              </div>

              {canManageMembers && (
                <>
                  <div className="flex gap-2 mb-2">
                    <button
                      onClick={() => {
                        setEditGroupOpen(true);
                        setEgName(activeGroup.name);
                        setEgDesc(activeGroup.description ?? "");
                        setEgAvatar(activeGroup.avatar_url);
                      }}
                      className="flex-1 py-1.5 rounded-xl border border-border text-[10px] font-display tracking-widest text-muted-foreground hover:text-primary hover:border-primary/40 active:scale-95 transition flex items-center justify-center gap-1"
                    >
                      <Pencil size={10} /> EDITAR
                    </button>
                    <button
                      onClick={toggleWorkChat}
                      className="flex-1 py-1.5 rounded-xl border border-border text-[10px] font-display tracking-widest text-muted-foreground hover:text-primary hover:border-primary/40 active:scale-95 transition flex items-center justify-center gap-1"
                    >
                      <Briefcase size={10} /> {isWork ? "QUITAR TRABAJO" : "CHAT DE TRABAJO"}
                    </button>
                  </div>
                  <div className="text-[10px] font-display tracking-widest text-muted-foreground mb-1.5">MIEMBROS</div>
                  <div className="space-y-1 max-h-48 overflow-y-auto no-scrollbar mb-2">
                    {groupMembers.map((m) => {
                      const mine = m.profile.id === myId;
                      return (
                        <div key={m.profile.id} className="flex items-center gap-2 rounded-xl bg-muted/40 px-2 py-1.5">
                          <Link to="/profile/$userId" params={{ userId: m.profile.id }} className="shrink-0">
                            <Avatar p={m.profile} size={30} />
                          </Link>
                          <div className="min-w-0 flex-1">
                            <div className="text-[12px] font-semibold truncate">{m.profile.display_name || m.profile.username}</div>
                            <div className="text-[9px] font-mono text-muted-foreground truncate">@{m.profile.username}</div>
                          </div>
                          {canManageRoles && !mine && m.role !== "owner" ? (
                            <button
                              onClick={() => setRolePicker(rolePicker?.userId === m.profile.id ? null : { userId: m.profile.id, role: m.role })}
                              className={`shrink-0 px-2 py-1 rounded-lg text-[9px] font-display tracking-wider active:scale-95 transition ${
                                m.role === "admin"
                                  ? "bg-primary/15 text-primary border border-primary/30"
                                  : m.role === "moderator"
                                    ? "bg-accent/15 text-accent-foreground border border-accent/30"
                                    : "border border-border text-muted-foreground"
                              }`}
                            >
                              {m.role.toUpperCase()}
                            </button>
                          ) : (
                            <span
                              className={`shrink-0 px-2 py-1 rounded-lg text-[9px] font-display tracking-wider ${
                                m.role === "owner"
                                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                                  : m.role === "admin"
                                    ? "bg-primary/15 text-primary border border-primary/30"
                                    : m.role === "moderator"
                                      ? "bg-accent/15 text-accent-foreground border border-accent/30"
                                      : "border border-border text-muted-foreground"
                              }`}
                            >
                              {m.role.toUpperCase()}
                            </span>
                          )}
                          {canManageMembers && !mine && m.role !== "owner" && (
                            <button
                              onClick={() => void handleRemoveMember(m.profile.id)}
                              className="shrink-0 w-7 h-7 rounded-lg grid place-items-center text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 active:scale-95 transition"
                              title="Quitar del grupo"
                            >
                              <UserMinus size={12} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {rolePicker && (
                    <div className="flex gap-1.5 mb-2">
                      {(["admin", "moderator", "member"] as const).map((r) => (
                        <button
                          key={r}
                          onClick={() => void handleSetRole(rolePicker.userId, r)}
                          className={`flex-1 py-1.5 rounded-xl text-[10px] font-display tracking-wider border active:scale-95 transition ${
                            rolePicker.role === r ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted-foreground"
                          }`}
                        >
                          {r.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2 mb-2">
                    <button
                      onClick={() => {
                        void fetchMutualFollows().then((f) => setMutualFollows(f));
                      }}
                      className="flex-1 py-1.5 rounded-xl border border-border text-[10px] font-display tracking-widest text-muted-foreground hover:text-primary hover:border-primary/40 active:scale-95 transition flex items-center justify-center gap-1"
                    >
                      <UserPlus size={10} /> AÑADIR
                    </button>
                    {groupRole !== "owner" && (
                      <button
                        onClick={() => void handleLeaveGroup()}
                        className="flex-1 py-1.5 rounded-xl border border-border text-[10px] font-display tracking-widest text-muted-foreground hover:text-amber-500 hover:border-amber-400/40 active:scale-95 transition flex items-center justify-center gap-1"
                      >
                        <LogOut size={10} /> SALIR
                      </button>
                    )}
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto no-scrollbar mb-2">
                    {mutualFollows
                      .filter((p) => !groupMembers.some((m) => m.profile.id === p.id))
                      .map((p) => (
                        <button
                          key={p.id}
                          onClick={() => void handleAddMember(p)}
                          className="w-full flex items-center gap-2 rounded-xl bg-muted/40 px-2 py-1.5 hover:bg-muted/70 active:scale-[0.99] transition text-left"
                        >
                          <Avatar p={p} size={26} />
                          <span className="min-w-0 flex-1 text-[12px] font-semibold truncate">{p.display_name || p.username}</span>
                          <UserPlus size={12} className="text-primary shrink-0" />
                        </button>
                      ))}
                  </div>
                </>
              )}

              {canDeleteGroup && (
                <div className="pt-2 border-t border-border/60">
                  {deleteGroupOpen ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setDeleteGroupOpen(false)}
                        className="flex-1 py-2 rounded-xl border border-border text-[10px] font-display tracking-widest active:scale-[0.98] transition"
                      >
                        CANCELAR
                      </button>
                      <button
                        onClick={() => void handleDeleteGroup()}
                        className="flex-1 py-2 rounded-xl bg-rose-600 text-white text-[10px] font-display tracking-widest active:scale-[0.98] transition"
                      >
                        ELIMINAR
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteGroupOpen(true)}
                      className="w-full py-2 rounded-xl border border-rose-500/30 bg-rose-500/[0.06] text-rose-500 text-[10px] font-display tracking-widest active:scale-[0.98] transition flex items-center justify-center gap-1.5"
                    >
                      <Trash2 size={11} /> ELIMINAR GRUPO
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ───── Diálogo: aviso ───── */}
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
                <Megaphone size={15} className="text-amber-500" /> Publicar aviso
              </div>
              <p className="text-[11px] text-muted-foreground mb-3">
                El aviso lo ven todos los miembros destacado en el chat.
              </p>
              <textarea
                value={announceText}
                onChange={(e) => setAnnounceText(e.target.value)}
                placeholder="Escribe el aviso…"
                rows={3}
                className="w-full bg-input/50 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 border border-border/60 mb-3 resize-none"
              />
              <button
                onClick={() => void publishAnnouncement()}
                disabled={announceBusy || !announceText.trim()}
                className="w-full py-2.5 rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground text-xs font-display tracking-widest active:scale-[0.98] transition disabled:opacity-40 flex items-center justify-center gap-1.5"
              >
                {announceBusy ? <Loader2 size={13} className="animate-spin" /> : <Megaphone size={13} />}
                {announceBusy ? "PUBLICANDO…" : "PUBLICAR"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ───── Diálogo: paquete de regalos ───── */}
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
                <Gift size={15} className="text-primary" /> Paquete de regalos
              </div>
              <p className="text-[11px] text-muted-foreground mb-3">
                Reparte orbes a la comunidad: cada persona podrá abrir el paquete una vez.
              </p>
              <div className="space-y-2 mb-3">
                <div>
                  <label className="text-[10px] font-display tracking-widest text-muted-foreground mb-1 block">ORBES POR PERSONA</label>
                  <input
                    value={giftAmount}
                    onChange={(e) => setGiftAmount(e.target.value.replace(/[^0-9]/g, ""))}
                    type="number"
                    inputMode="numeric"
                    className="w-full bg-input/50 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 border border-border/60"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-display tracking-widest text-muted-foreground mb-1 block">Nº DE PERSONAS</label>
                  <input
                    value={giftClaims}
                    onChange={(e) => setGiftClaims(e.target.value.replace(/[^0-9]/g, ""))}
                    type="number"
                    inputMode="numeric"
                    className="w-full bg-input/50 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 border border-border/60"
                  />
                </div>
              </div>
              <button
                onClick={() => void handleCreateGift()}
                disabled={giftBusy}
                className="w-full py-2.5 rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground text-xs font-display tracking-widest active:scale-[0.98] transition disabled:opacity-40 flex items-center justify-center gap-1.5"
              >
                {giftBusy ? <Loader2 size={13} className="animate-spin" /> : <Gift size={13} />}
                {giftBusy ? "CREANDO…" : "CREAR PAQUETE"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ───── Diálogo: crear encuesta ───── */}
      <AnimatePresence>
        {pollOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[95] bg-black/55 backdrop-blur-md grid place-items-center p-4"
            onClick={() => setPollOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.96, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 8 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-card border border-border rounded-2xl p-4 shadow-xl max-h-[85vh] overflow-y-auto no-scrollbar"
            >
              <div className="text-sm font-semibold mb-0.5 flex items-center gap-2">
                <BarChart3 size={15} className="text-primary" /> Nueva encuesta
              </div>
              <p className="text-[11px] text-muted-foreground mb-3">
                Cualquier miembro podrá votar una vez y ver los resultados en vivo.
              </p>
              <input
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value)}
                placeholder="¿Cuál es la pregunta?"
                className="w-full bg-input/50 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 border border-border/60 mb-2"
              />
              <div className="space-y-1.5 mb-2">
                {pollOptions.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={opt}
                      onChange={(e) => setPollOptions((prev) => prev.map((o, j) => (j === i ? e.target.value : o)))}
                      placeholder={`Opción ${i + 1}`}
                      className="flex-1 bg-input/50 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 border border-border/60"
                    />
                    {pollOptions.length > 2 && (
                      <button
                        onClick={() => setPollOptions((prev) => prev.filter((_, j) => j !== i))}
                        className="w-8 h-8 rounded-lg grid place-items-center text-muted-foreground hover:text-rose-500 active:scale-95 transition shrink-0"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {pollOptions.length < 6 && (
                <button
                  onClick={() => setPollOptions((prev) => [...prev, ""])}
                  className="w-full py-1.5 rounded-xl border border-dashed border-primary/40 text-primary text-[11px] font-display tracking-widest hover:bg-primary/5 active:scale-[0.98] transition mb-2"
                >
                  + AÑADIR OPCIÓN
                </button>
              )}
              {pollErr && <div className="text-[11px] text-rose-500 mb-2">{pollErr}</div>}
              <button
                onClick={() => void handleCreatePoll()}
                className="w-full py-2.5 rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground text-xs font-display tracking-widest active:scale-[0.98] transition flex items-center justify-center gap-1.5"
              >
                <BarChart3 size={13} /> CREAR ENCUESTA
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ───── Gestores del chat de trabajo ───── */}
      <AnimatePresence>
        {taskOpen && currentChatId && (
          <TaskManager
            chatId={currentChatId}
            myId={myId ?? "me"}
            myName={myName}
            canAssign={canAnnounce}
            onClose={() => setTaskOpen(false)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {filesOpen && currentChatId && (
          <FileManager
            chatId={currentChatId}
            myId={myId ?? "me"}
            canDelete={canAnnounce}
            onClose={() => setFilesOpen(false)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {threadsOpen && currentChatId && (
          <ThreadsManager
            chatId={currentChatId}
            myId={myId ?? "me"}
            canDelete={canAnnounce}
            onClose={() => setThreadsOpen(false)}
            onOpen={(t) => {
              setThreadsOpen(false);
              openThread(t);
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {projectsOpen && currentChatId && (
          <ProjectsManager
            chatId={currentChatId}
            myId={myId ?? "me"}
            myName={myName}
            canManage={canAnnounce}
            onClose={() => setProjectsOpen(false)}
          />
        )}
      </AnimatePresence>
      {threadView && currentChatId && myId && (
        <ThreadView
          thread={threadView}
          chatId={currentChatId}
          myId={myId}
          senders={senders}
          onBack={() => {
            setThreadView(null);
            setThreads(listThreads(currentChatId));
          }}
          onClose={() => {
            setThreadView(null);
            setThreads(listThreads(currentChatId));
          }}
        />
      )}

      {/* ───── Búsqueda global ───── */}
      <AnimatePresence>
        {searchOpen && (
          <GlobalSearchPanel
            defaultScope={searchDefaultScope}
            onClose={() => setSearchOpen(false)}
            onOpenMessage={openSearchResult}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

