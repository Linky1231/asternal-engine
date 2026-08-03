import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  X,
  Send,
  Copy,
  Check,
  Reply,
  SmilePlus,
  Plus,
  Users,
  Search,
  Loader2,
  ImagePlus,
  MessageCircle,
} from "lucide-react";
import {
  listMyChats,
  getOrCreateDirectChat,
  createGroupChat,
  fetchChatMessages,
  sendChatMessage,
  subscribeToChat,
  markChatRead,
  searchUsers,
  uploadSticker,
  fetchMyStickers,
  signMedia,
  type ChatMessage,
  type ChatWithMeta,
} from "@/lib/social/chat";
import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/lib/social/api";

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtDay(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  if (sameDay) return fmtTime(iso);
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
    <div className={`absolute -top-3 ${mine ? "-left-2" : "-right-2"} hidden group-hover:flex gap-0.5 bg-background border border-border rounded-lg p-0.5 shadow-md z-10`}>
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
      <div className="max-w-[78%]">
        <div
          className={
            mine
              ? "bg-gradient-to-br from-primary to-accent text-primary-foreground rounded-2xl rounded-br-md px-3 py-2 shadow-[0_4px_14px_-6px_oklch(0.488_0.185_264/0.45)]"
              : "bg-card border border-border rounded-2xl rounded-bl-md px-3 py-2 shadow-sm"
          }
        >
          {!mine && (
            <div className="text-[10px] font-display tracking-wider text-primary mb-0.5">
              {sender?.display_name || sender?.username || "Usuario"}
            </div>
          )}
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
      <BubbleActions mine={mine} copied={copied} onCopy={onCopy} onReply={onReply} />
    </div>
  );
}

export default function ChatSection({ myId, onClose }: { myId: string | null; onClose: () => void }) {
  const [chats, setChats] = useState<ChatWithMeta[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeChat, setActiveChat] = useState<ChatWithMeta | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [senders, setSenders] = useState<Map<string, Profile>>(new Map());
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [stickersOpen, setStickersOpen] = useState(false);
  const [myStickers, setMyStickers] = useState<{ path: string; title: string }[]>([]);
  const [signedStickers, setSignedStickers] = useState<Map<string, string>>(new Map());
  const [stickerUploading, setStickerUploading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [mode, setMode] = useState<"direct" | "group">("direct");
  const [searchQ, setSearchQ] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [selected, setSelected] = useState<Profile[]>([]);
  const [groupName, setGroupName] = useState("");
  const [creating, setCreating] = useState(false);

  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const sendersRef = useRef<Set<string>>(new Set());

  const refreshList = useCallback(async () => {
    const list = await listMyChats();
    setChats(list);
    setLoadingList(false);
    setActiveChat((cur) => cur && list.find((c) => c.chat.id === cur.chat.id) ? list.find((c) => c.chat.id === cur.chat.id)! : cur);
  }, []);

  useEffect(() => {
    refreshList();
  }, [refreshList]);

  // Load senders for a batch of messages
  const loadSenders = useCallback(async (msgs: ChatMessage[]) => {
    const ids = Array.from(new Set(msgs.map((m) => m.sender_id).filter(Boolean))) as string[];
    const missing = ids.filter((id) => !sendersRef.current.has(id));
    if (!missing.length) return;
    const pmap = await fetchProfiles(missing);
    for (const id of missing) sendersRef.current.add(id);
    setSenders((prev) => {
      const next = new Map(prev);
      for (const [id, p] of pmap) next.set(id, p);
      return next;
    });
  }, []);

  // Open a conversation
  const openChat = useCallback(
    (chat: ChatWithMeta) => {
      setActiveChat(chat);
      setActiveChatId(chat.chat.id);
      setMessages([]);
      setReplyTo(null);
      setStickersOpen(false);
    },
    []
  );

  // Load messages + subscribe realtime
  useEffect(() => {
    if (!activeChatId) return;
    let cancelled = false;
    setLoadingMsgs(true);
    (async () => {
      try {
        const msgs = await fetchChatMessages(activeChatId);
        if (cancelled) return;
        setMessages(msgs);
        await loadSenders(msgs);
        await markChatRead(activeChatId);
      } catch {
        /* schema missing / offline */
      } finally {
        if (!cancelled) setLoadingMsgs(false);
      }
    })();
    const unsub = subscribeToChat(activeChatId, (msg) => {
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      if (msg.sender_id !== myId) void markChatRead(activeChatId);
      loadSenders([msg]);
      refreshList();
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [activeChatId, myId, loadSenders, refreshList]);

  // Auto-scroll on new messages
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, activeChatId, loadingMsgs]);

  // Load my stickers when the picker opens
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

  const goBackToList = useCallback(() => {
    setActiveChatId(null);
    setActiveChat(null);
    setMessages([]);
    refreshList();
  }, [refreshList]);

  const handleSend = useCallback(
    async (mediaUrl?: string) => {
      const content = draft.trim();
      if (!activeChatId) return;
      if (!content && !mediaUrl) return;
      try {
        const sent = await sendChatMessage(activeChatId, {
          content: content || undefined,
          mediaUrl: mediaUrl ?? undefined,
          replyToId: replyTo?.id ?? null,
        });
        // Echo inmediato (el realtime lo confirmará; se deduplica por id).
        setMessages((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]));
        setDraft("");
        setReplyTo(null);
        setStickersOpen(false);
        refreshList();
        if (inputRef.current) inputRef.current.style.height = "auto";
      } catch {
        /* noop */
      }
    },
    [activeChatId, draft, replyTo, refreshList]
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

  // User search in new-chat view
  useEffect(() => {
    if (!newChatOpen || searchQ.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await searchUsers(searchQ);
        setResults(res);
      } catch {
        setResults([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [searchQ, newChatOpen]);

  const pickDirect = useCallback(
    async (u: Profile) => {
      if (!u.id || u.id === myId) return;
      setCreating(true);
      try {
        const chatId = await getOrCreateDirectChat(u.id);
        await refreshList();
        const found = chats.find((c) => c.chat.id === chatId) ?? null;
        if (found) {
          setNewChatOpen(false);
          setSearchQ("");
          openChat(found);
        } else {
          // Refetch a second time to ensure membership visibility
          const list = await listMyChats();
          setChats(list);
          const f2 = list.find((c) => c.chat.id === chatId) ?? null;
          if (f2) {
            setNewChatOpen(false);
            openChat(f2);
          } else {
            setNewChatOpen(false);
            refreshList();
          }
        }
      } catch {
        /* noop */
      } finally {
        setCreating(false);
      }
    },
    [chats, myId, openChat, refreshList]
  );

  const createGroup = useCallback(async () => {
    if (selected.length < 1) return;
    setCreating(true);
    try {
      const chatId = await createGroupChat(groupName || "Chat grupal", selected.map((s) => s.id));
      await refreshList();
      const list = await listMyChats();
      setChats(list);
      const found = list.find((c) => c.chat.id === chatId) ?? null;
      setNewChatOpen(false);
      setSearchQ("");
      setSelected([]);
      setGroupName("");
      if (found) openChat(found);
    } catch {
      /* noop */
    } finally {
      setCreating(false);
    }
  }, [selected, groupName, openChat, refreshList]);

  const onPickStickerFile = useCallback(
    async (file: File | null) => {
      if (!file || !activeChatId) return;
      setStickerUploading(true);
      try {
        const path = await uploadSticker(file);
        const [signed] = await signMedia([path]);
        await sendChatMessage(activeChatId, { mediaUrl: signed, replyToId: replyTo?.id ?? null });
        setReplyTo(null);
        refreshList();
      } catch {
        /* noop */
      } finally {
        setStickerUploading(false);
      }
    },
    [activeChatId, replyTo, refreshList]
  );

  const textareaAutoGrow = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  const conversationTitle = activeChat
    ? activeChat.chat.type === "group"
      ? activeChat.chat.name || "Chat grupal"
      : activeChat.other?.display_name || activeChat.other?.username || "Chat"
    : "";

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
          {activeChatId ? (
            <button onClick={goBackToList} className="w-9 h-9 rounded-xl border border-border/70 bg-background grid place-items-center active:scale-95 transition shrink-0">
              <ArrowLeft size={16} />
            </button>
          ) : null}
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            {activeChatId && activeChat ? (
              <>
                {activeChat.chat.type === "group" ? (
                  <div
                    className="rounded-full grid place-items-center shrink-0 font-display font-semibold text-primary-foreground"
                    style={{ width: 36, height: 36, fontSize: 15, background: "linear-gradient(135deg, var(--color-primary), var(--color-accent))" }}
                  >
                    <Users size={16} />
                  </div>
                ) : (
                  <Avatar p={activeChat.other} size={36} />
                )}
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{conversationTitle}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {activeChat.chat.type === "group"
                      ? `${activeChat.members.length} miembros`
                      : activeChat.other?.username ? `@${activeChat.other.username}` : "Chat directo"}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <MessageCircle size={18} className="text-primary" />
                <span className="font-display text-xs tracking-[0.18em] text-foreground">CHATS</span>
                {loadingList ? <Loader2 size={12} className="animate-spin text-muted-foreground" /> : null}
              </div>
            )}
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl border border-border/70 bg-background grid place-items-center active:scale-95 transition shrink-0">
            <X size={16} />
          </button>
        </div>
      </header>

      {/* ───── Body ───── */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <AnimatePresence mode="wait" initial={false}>
          {newChatOpen ? (
            <motion.div
              key="new"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Nuevo chat</div>
                <button onClick={() => { setNewChatOpen(false); setSearchQ(""); setSelected([]); }} className="text-xs text-muted-foreground hover:text-foreground transition">
                  Cancelar
                </button>
              </div>

              <div className="flex gap-1 bg-muted/50 rounded-xl p-1">
                {(["direct", "group"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`flex-1 py-1.5 rounded-lg text-[11px] font-display tracking-widest transition-all ${
                      mode === m ? "bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-sm" : "text-muted-foreground"
                    }`}
                  >
                    {m === "direct" ? "DIRECTO" : "GRUPO"}
                  </button>
                ))}
              </div>

              {mode === "group" && (
                <input
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Nombre del grupo…"
                  className="w-full bg-input/50 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40 border border-border/60"
                />
              )}

              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  placeholder="Buscar usuarios…"
                  className="w-full bg-input/50 rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40 border border-border/60"
                />
              </div>

              {mode === "group" && selected.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selected.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSelected((sel) => sel.filter((x) => x.id !== s.id))}
                      className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full border border-primary/30 bg-primary/10 text-[11px] active:scale-95 transition"
                    >
                      <Avatar p={s} size={18} />
                      <span className="font-medium">{s.display_name || s.username}</span>
                      <X size={11} className="text-muted-foreground" />
                    </button>
                  ))}
                </div>
              )}

              <div className="space-y-1">
                {results.map((u) => {
                  const isSel = selected.some((s) => s.id === u.id);
                  return (
                    <button
                      key={u.id}
                      onClick={() => {
                        if (mode === "direct") void pickDirect(u);
                        else setSelected((sel) => (isSel ? sel.filter((s) => s.id !== u.id) : [...sel, u]));
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border bg-background hover:bg-muted/60 active:scale-[0.99] transition text-left"
                    >
                      <Avatar p={u} size={36} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{u.display_name || u.username}</div>
                        {u.username && <div className="text-[11px] text-muted-foreground truncate">@{u.username}</div>}
                      </div>
                      {mode === "group" && (
                        <div
                          className={`w-5 h-5 rounded-md border grid place-items-center text-[10px] ${
                            isSel ? "bg-gradient-to-br from-primary to-accent text-primary-foreground border-transparent" : "border-border"
                          }`}
                        >
                          {isSel ? <Check size={12} /> : null}
                        </div>
                      )}
                    </button>
                  );
                })}
                {searchQ.trim().length >= 2 && !results.length && !creating && (
                  <div className="text-center text-xs text-muted-foreground py-6">Sin resultados</div>
                )}
              </div>

              {mode === "group" && (
                <button
                  onClick={createGroup}
                  disabled={selected.length < 1 || creating}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground text-xs font-display tracking-widest shadow-[0_4px_14px_-6px_oklch(0.488_0.185_264/0.45)] active:scale-[0.98] transition disabled:opacity-40 disabled:active:scale-100 flex items-center justify-center gap-2"
                >
                  {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  CREAR GRUPO ({selected.length})
                </button>
              )}
            </motion.div>
          ) : activeChatId ? (
            <motion.div
              key="conv"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="flex-1 flex flex-col min-h-0"
            >
              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3 no-scrollbar">
                {loadingMsgs && !messages.length ? (
                  <div className="flex justify-center py-10">
                    <Loader2 size={18} className="animate-spin text-muted-foreground" />
                  </div>
                ) : !messages.length ? (
                  <div className="text-center text-xs text-muted-foreground py-10">
                    Di hola 👋 — los mensajes llegan al instante.
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

              {/* Reply bar */}
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
                      <div className="text-[10px] font-display tracking-wider text-primary">RESPONDIENDO A {senders.get(replyTo.sender_id)?.display_name?.toUpperCase() || senders.get(replyTo.sender_id)?.username?.toUpperCase() || ""}</div>
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

              {/* Input bar */}
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

                  {/* Sticker panel */}
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
            </motion.div>
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5 no-scrollbar"
            >
              <button
                onClick={() => setNewChatOpen(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground text-xs font-display tracking-widest shadow-[0_4px_14px_-6px_oklch(0.488_0.185_264/0.45)] active:scale-[0.98] transition mb-2"
              >
                <Plus size={14} /> NUEVO CHAT
              </button>

              {loadingList ? (
                <div className="flex justify-center py-10">
                  <Loader2 size={18} className="animate-spin text-muted-foreground" />
                </div>
              ) : chats.length === 0 ? (
                <div className="text-center text-xs text-muted-foreground py-12 space-y-1">
                  <MessageCircle size={26} className="mx-auto text-muted-foreground/50 mb-2" />
                  <div>No tienes conversaciones todavía.</div>
                  <div className="text-[11px] opacity-70">Crea un chat directo o un grupo para empezar.</div>
                </div>
              ) : (
                chats.map((c) => {
                  const lm = c.last_message;
                  const preview = lm
                    ? lm.media_url
                      ? "🖼️ Sticker"
                      : lm.content || ""
                    : c.chat.type === "group"
                    ? "Grupo creado"
                    : "Nuevo chat";
                  return (
                    <button
                      key={c.chat.id}
                      onClick={() => openChat(c)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border bg-background hover:bg-muted/50 active:scale-[0.99] transition text-left"
                    >
                      {c.chat.type === "group" ? (
                        <div
                          className="rounded-full grid place-items-center shrink-0 font-display font-semibold text-primary-foreground"
                          style={{ width: 44, height: 44, fontSize: 16, background: "linear-gradient(135deg, var(--color-primary), var(--color-accent))" }}
                        >
                          <Users size={18} />
                        </div>
                      ) : (
                        <Avatar p={c.other} size={44} />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold truncate">
                            {c.chat.type === "group" ? c.chat.name || "Chat grupal" : c.other?.display_name || c.other?.username || "Chat"}
                          </span>
                          {lm && <span className="text-[10px] text-muted-foreground shrink-0">{fmtDay(lm.created_at)}</span>}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-[11px] truncate ${c.unread ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                            {preview}
                          </span>
                          {c.unread > 0 && (
                            <span className="shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground text-[10px] font-display font-semibold grid place-items-center">
                              {c.unread > 99 ? "99+" : c.unread}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// Local helper: fetch profiles for a set of ids
async function fetchProfiles(ids: string[]): Promise<Map<string, Profile>> {
  const { data } = await supabase.from("profiles").select("*").in("id", ids);
  const rows = (data ?? []) as Profile[];
  return new Map(rows.map((p) => [p.id, p]));
}
