import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Copy, Check, Reply, SmilePlus, ImagePlus, Loader2, Users, WifiOff, Database, Plug, RefreshCw, KeyRound, CheckCircle2, AlertTriangle } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  getCommunityChat,
  fetchChatMessages,
  sendChatMessage,
  subscribeToChat,
  uploadSticker,
  fetchMyStickers,
  signMedia,
  COMMUNITY_CHAT_NAME,
  type ChatMessage,
} from "@/lib/social/chat";
import { supabase, hasSupabaseConfig, saveSupabaseCredentials, isSchemaMissing } from "@/integrations/supabase/client";
import { UserName } from "./UserName";
import { getMyProfile } from "@/lib/social/api";
import type { Profile } from "@/lib/social/api";
import { runChatSchemaSetup, SUPABASE_ACCESS_TOKEN } from "@/lib/supabase/setup";

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

function MessageBubble({
  m,
  mine,
  sender,
  reply,
  copied,
  onCopy,
  onReply,
}: {
  m: ChatMessage;
  mine: boolean;
  sender?: Profile | null;
  reply?: ChatMessage | null;
  copied: boolean;
  onCopy: () => void;
  onReply: () => void;
}) {
  return (
    <div className={`group relative flex gap-2 ${mine ? "justify-end pl-10" : "justify-start pr-10"}`}>
      {!mine && <Avatar p={sender} size={28} />}
      <div className={`flex flex-col min-w-0 max-w-[78%] ${mine ? "items-end" : "items-start"}`}>
        <div className={`mb-0.5 ${mine ? "pr-1" : "pl-1"}`}>
          <Link to="/profile/$userId" params={{ userId: m.sender_id }} className="hover:opacity-80 transition-opacity">
            <UserName p={sender} size="xs" />
          </Link>
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
              {reply.media_url ? "🖼️ Sticker" : reply.content || "Mensaje"}
            </div>
          )}
          {m.content && <div className="text-[13px] leading-snug whitespace-pre-wrap break-words">{m.content}</div>}
          {m.media_url && (
            <img src={m.media_url} alt="Sticker" className="max-w-44 max-h-44 rounded-xl mt-0.5 object-contain" draggable={false} />
          )}
          <div className={`text-[9px] mt-1 ${mine ? "text-primary-foreground/70" : "text-muted-foreground/70"} text-right`}>{fmtTime(m.created_at)}</div>
        </div>
      </div>
      {mine && <Avatar p={sender} size={28} />}
      <BubbleActions mine={mine} copied={copied} onCopy={onCopy} onReply={onReply} />
    </div>
  );
}

export default function ChatSection({ myId, onClose }: { myId: string | null; onClose: () => void }) {
  const [chatInfo, setChatInfo] = useState<{ id: string; name: string; memberCount: number } | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [senders, setSenders] = useState<Map<string, Profile>>(new Map());
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [stickersOpen, setStickersOpen] = useState(false);
  const [myStickers, setMyStickers] = useState<{ path: string; title: string }[]>([]);
  const [signedStickers, setSignedStickers] = useState<Map<string, string>>(new Map());
  const [stickerUploading, setStickerUploading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isLocal, setIsLocal] = useState<boolean>(() => !hasSupabaseConfig());
  const [connecting, setConnecting] = useState(false);
  const [connectUrl, setConnectUrl] = useState("https://gxpgczwkovertezeydkt.supabase.co");
  const [connectKey, setConnectKey] = useState("");
  const [connectError, setConnectError] = useState<string | null>(null);
  const [initError, setInitError] = useState<"schema" | "conn" | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [installOpen, setInstallOpen] = useState(false);
  const [installToken, setInstallToken] = useState(SUPABASE_ACCESS_TOKEN ?? "");
  const [installing, setInstalling] = useState(false);
  const [installResult, setInstallResult] = useState<string | null>(null);
  const [installOk, setInstallOk] = useState(false);

  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const sendersRef = useRef<Set<string>>(new Set());

  // Load senders for a batch of messages
  const loadSenders = useCallback(async (msgs: ChatMessage[]) => {
    const ids = Array.from(new Set(msgs.map((m) => m.sender_id).filter(Boolean))) as string[];
    const missing = ids.filter((id) => !sendersRef.current.has(id));
    if (!missing.length) return;
    try {
      const pmap = await fetchProfiles(missing);
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
    setLoading(true);
    (async () => {
      try {
        const info = await getCommunityChat();
        if (cancelled) return;
        setChatInfo(info);
        const msgs = await fetchChatMessages(info.id);
        if (cancelled) return;
        setMessages(msgs);
        await loadSenders(msgs);
      } catch (err) {
        if (cancelled) return;
        setInitError(isSchemaMissing(err) ? "schema" : "conn");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadSenders, retryKey]);

  // Suscripción en tiempo real una vez que conocemos el chat
  useEffect(() => {
    if (!chatInfo) return;
    const unsub = subscribeToChat(chatInfo.id, (msg) => {
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      loadSenders([msg]);
    });
    return unsub;
  }, [chatInfo, loadSenders]);

  // Auto-scroll al final
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, loading]);

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
      } catch {
        toast.error("No se pudo enviar el mensaje", {
          description: "Comprueba tu conexión e inténtalo de nuevo.",
        });
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

  const onPickStickerFile = useCallback(
    async (file: File | null) => {
      if (!file || !chatInfo) return;
      setStickerUploading(true);
      try {
        const path = await uploadSticker(file);
        const [signed] = await signMedia([path]);
        const sent = await sendChatMessage(chatInfo.id, { mediaUrl: signed, replyToId: replyTo?.id ?? null });
        setMessages((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]));
        setReplyTo(null);
      } catch {
        toast.error("No se pudo subir el sticker");
      } finally {
        setStickerUploading(false);
      }
    },
    [chatInfo, replyTo]
  );

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
      className="fixed inset-0 z-[90] bg-background/97 backdrop-blur-xl flex flex-col"
      style={{ height: "100dvh" }}
    >
      {/* ───── Header ───── */}
      <header className="shrink-0 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="max-w-2xl mx-auto flex items-center gap-2 px-4 py-3">
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
                  ? `${chatInfo.memberCount} ${chatInfo.memberCount === 1 ? "miembro" : "miembros"} · chat compartido`
                  : loading
                    ? "Conectando…"
                    : initError
                      ? "Sin conexión"
                      : "Conectando…"}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl border border-border/70 bg-background grid place-items-center active:scale-95 transition shrink-0">
            <X size={16} />
          </button>
        </div>
      </header>

      {/* Aviso de modo local */}
      {isLocal && (
        <div className="shrink-0 mx-3 mt-2 px-3 py-2 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-center gap-2">
          <span className="flex-1 text-[11px] text-amber-700 dark:text-amber-300">
            Modo local: los mensajes no se comparten entre dispositivos. Conecta tu base de datos para el chat comunitario.
          </span>
          <button
            onClick={() => setConnecting(true)}
            className="shrink-0 px-2.5 py-1 rounded-lg bg-gradient-to-br from-primary to-accent text-primary-foreground text-[10px] font-display tracking-widest active:scale-95 transition"
          >
            CONECTAR
          </button>
        </div>
      )}

      {/* Error de conexión / esquema del chat */}
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
              ) : (
                <>
                  <span className="font-semibold text-foreground">No se pudo conectar al chat.</span>{" "}
                  Revisa que la URL y la anon key de Supabase sean correctas y vuelve a intentarlo.
                </>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {initError === "schema" && (
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
            <button
              onClick={() => setRetryKey((k) => k + 1)}
              className="flex-1 py-2 rounded-xl border border-border bg-background text-[10px] font-display tracking-widest active:scale-[0.98] transition flex items-center justify-center gap-1.5"
            >
              <RefreshCw size={12} /> REINTENTAR
            </button>
          </div>
        </div>
      )}

      {/* ───── Mensajes ───── */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3 no-scrollbar min-h-0">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 size={18} className="animate-spin text-muted-foreground" />
          </div>
        ) : !chatInfo ? null : !messages.length ? (
          <div className="text-center text-xs text-muted-foreground py-10">
            Sé el primero en saludar a la comunidad 👋
          </div>
        ) : (
          messages.map((m) => (
            <MessageBubble
              key={m.id}
              m={m}
              mine={m.sender_id === myId}
              sender={senders.get(m.sender_id)}
              reply={m.reply_to_id ? messages.find((x) => x.id === m.reply_to_id) ?? null : null}
              copied={copiedId === m.id}
              onCopy={() => void copyMessage(m)}
              onReply={() => {
                setReplyTo(m);
                setStickersOpen(false);
                inputRef.current?.focus();
              }}
            />
          ))
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
                {replyTo.media_url ? "🖼️ Sticker" : replyTo.content || ""}
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
                  <div className="text-[11px] text-muted-foreground text-center py-4">
                    Aún no tienes dibujos en la galería.
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {myStickers.map((s) => (
                      <button
                        key={s.path}
                        onClick={() => void handleSend(signedStickers.get(s.path) ?? s.path)}
                        title={s.title}
                        className="aspect-square rounded-xl overflow-hidden border border-border hover:border-primary/50 hover:scale-105 active:scale-95 transition"
                      >
                        <img src={signedStickers.get(s.path) ?? s.path} alt={s.title} className="w-full h-full object-cover" />
                      </button>
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Local helper: fetch profiles for a set of ids
async function fetchProfiles(ids: string[]): Promise<Map<string, Profile>> {
  const { data } = await supabase.from("profiles").select("*").in("id", ids);
  const rows = (data ?? []) as Profile[];
  return new Map(rows.map((p) => [p.id, p]));
}
