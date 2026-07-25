import { createFileRoute, useNavigate, useParams, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Send, Smile, Trash2, MoreVertical, Users, Upload, X, LogOut, UserPlus, Loader2, Info, Crown, Calendar, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  getChat, fetchChatMessages, sendChatMessage, listStickers, uploadSticker,
  leaveChat, deleteChat, inviteToChat, searchUsers,
  type ChatSummary, type ChatMessageRow, type Profile, type Sticker,
} from "@/lib/social/api";

export const Route = createFileRoute("/chats/$chatId")({
  head: () => ({ meta: [{ title: "Chat · Asternal" }] }),
  component: ChatDetailPage,
});

type Msg = ChatMessageRow & { author: Profile | null };

function ChatDetailPage() {
  const navigate = useNavigate();
  const { chatId } = useParams({ from: "/chats/$chatId" });
  const [myId, setMyId] = useState<string | null>(null);
  const [chat, setChat] = useState<ChatSummary | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [newMsgIds, setNewMsgIds] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const load = async () => {
    const c = await getChat(chatId); setChat(c);
    if (c && c.my_status === "active") setMessages(await fetchChatMessages(chatId));
  };

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate({ to: "/auth" }); return; }
      setMyId(session.user.id);
      await load();
      setStickers(await listStickers());
    })();
    const channel = supabase
      .channel(`chat:${chatId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `chat_id=eq.${chatId}` },
        async (payload) => {
          const fresh = await fetchChatMessages(chatId);
          // Mark new messages for animation
          const newIds = new Set<string>();
          for (const m of fresh) {
            if (!messages.find(x => x.id === m.id)) newIds.add(m.id);
          }
          setNewMsgIds(newIds);
          setMessages(fresh);
          setTimeout(() => setNewMsgIds(new Set()), 500);
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [chatId, navigate]);

  useEffect(() => {
    if (newMsgIds.size > 0 || messages.length > 0) {
      const el = scrollRef.current;
      if (el) {
        // Auto-scroll with smooth behavior for new messages
        const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        if (isAtBottom || newMsgIds.size > 0) {
          requestAnimationFrame(() => {
            el.scrollTo({ top: el.scrollHeight, behavior: newMsgIds.size > 0 ? "smooth" : "instant" });
          });
        }
      }
    }
  }, [messages, newMsgIds]);

  const send = async () => {
    const content = text.trim(); if (!content) return;
    setText("");
    await sendChatMessage(chatId, { content });
    const fresh = await fetchChatMessages(chatId);
    const newIds = new Set<string>();
    for (const m of fresh) {
      if (!messages.find(x => x.id === m.id)) newIds.add(m.id);
    }
    setNewMsgIds(newIds);
    setMessages(fresh);
    setTimeout(() => setNewMsgIds(new Set()), 500);
  };

  const sendSticker = async (url: string) => {
    setPickerOpen(false);
    await sendChatMessage(chatId, { sticker_url: url });
    const fresh = await fetchChatMessages(chatId);
    const newIds = new Set<string>();
    for (const m of fresh) {
      if (!messages.find(x => x.id === m.id)) newIds.add(m.id);
    }
    setNewMsgIds(newIds);
    setMessages(fresh);
    setTimeout(() => setNewMsgIds(new Set()), 500);
  };

  const doUpload = async (f: File | null) => {
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) { alert("Máx 2MB"); return; }
    const s = await uploadSticker(f);
    setStickers(prev => [s, ...prev]);
  };

  const leave = async () => {
    if (!confirm("¿Salir de este chat?")) return;
    await leaveChat(chatId); navigate({ to: "/chats" });
  };

  const remove = async () => {
    if (!confirm("¿Borrar toda la conversación? Esto elimina el chat para todos.")) return;
    await deleteChat(chatId); navigate({ to: "/chats" });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  if (!chat) return <div className="min-h-screen grid place-items-center text-xs text-muted-foreground"><Loader2 className="animate-spin inline mr-2" size={14}/>Cargando…</div>;

  const title = chat.chat.type === "direct"
    ? (chat.other?.display_name ?? chat.other?.username ?? "Chat")
    : (chat.chat.name ?? "Grupo");
  const isCreator = chat.chat.created_by === myId;
  const activeMembers = chat.members.filter(m => m.status === "active");

  return (
    <div className="min-h-screen w-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-20 panel border-b backdrop-blur-xl">
        <div className="max-w-2xl mx-auto flex items-center gap-2 px-3 py-2.5">
          <Link to="/chats" className="w-9 h-9 rounded-xl border border-border grid place-items-center active:scale-95">
            <ArrowLeft size={16} />
          </Link>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setInfoOpen(true)}
            className="flex items-center gap-2 flex-1 min-w-0"
          >
            <div className="relative w-9 h-9 rounded-full bg-gradient-to-br from-primary/40 to-accent/30 grid place-items-center overflow-hidden shrink-0">
              {chat.chat.type === "direct" && chat.other?.avatar_url ? (
                <img src={chat.other.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : chat.chat.type === "group" ? (
                <div className="flex -space-x-1.5">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-primary/50 border border-background grid place-items-center">
                    <Users size={8} className="text-primary-foreground" />
                  </div>
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-accent/50 border border-background grid place-items-center">
                    <Users size={8} className="text-primary-foreground" />
                  </div>
                </div>
              ) : (
                <span className="text-[11px] font-display text-primary-glow">{title[0]?.toUpperCase()}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-display text-sm truncate flex items-center gap-1">
                {title}
                {chat.chat.type === "group" && <Users size={10} className="text-muted-foreground" />}
              </div>
              <div className="text-[10px] font-mono text-muted-foreground truncate">
                {chat.chat.type === "group" ? `${activeMembers.length} miembros` : `@${chat.other?.username ?? ""}`}
              </div>
            </div>
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setInfoOpen(true)}
            className="w-9 h-9 rounded-xl border border-border grid place-items-center hover:bg-muted/40 transition"
          >
            <Info size={14} />
          </motion.button>
          <div className="relative">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setMenuOpen(o => !o)}
              className="w-9 h-9 rounded-xl border border-border grid place-items-center hover:bg-muted/40 transition"
            >
              <MoreVertical size={14} />
            </motion.button>
            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-10 z-10 panel border border-border rounded-xl p-1 min-w-[180px] text-xs shadow-xl"
                >
                  {chat.chat.type === "group" && (
                    <button onClick={() => { setInviteOpen(true); setMenuOpen(false); }}
                      className="flex items-center gap-2 w-full text-left px-2 py-2 hover:bg-muted/40 rounded transition">
                      <UserPlus size={13}/> Invitar usuarios
                    </button>
                  )}
                  {chat.chat.type === "group" && !isCreator && (
                    <button onClick={leave}
                      className="flex items-center gap-2 w-full text-left px-2 py-2 hover:bg-muted/40 rounded transition">
                      <LogOut size={13}/> Salir del grupo
                    </button>
                  )}
                  <button onClick={remove}
                    className="flex items-center gap-2 w-full text-left px-2 py-2 text-destructive hover:bg-muted/40 rounded transition">
                    <Trash2 size={13}/> {chat.chat.type === "direct" ? "Borrar conversación" : "Eliminar grupo"}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* Messages */}
      <main ref={scrollRef} className="flex-1 max-w-2xl mx-auto w-full px-3 py-3 space-y-2 overflow-y-auto scrollbar-thin">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center text-xs text-muted-foreground py-10"
            >
              Sin mensajes aún. ¡Envía el primero!
            </motion.div>
          </div>
        )}
        <AnimatePresence initial={false}>
          {messages.map((m, i) => {
            const mine = m.author_id === myId;
            const isNew = newMsgIds.has(m.id);
            const showAvatar = !mine && (i === 0 || messages[i - 1]?.author_id !== m.author_id);
            return (
              <motion.div
                key={m.id}
                layout
                initial={isNew ? { opacity: 0, y: 20, scale: 0.95 } : { opacity: 1 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                className={`flex ${mine ? "justify-end" : "justify-start"} gap-2 ${isNew ? "pointer-events-none" : ""}`}
              >
                {!mine && (
                  <Link to="/profile/$userId" params={{ userId: m.author_id }}
                    className={`shrink-0 transition-all ${showAvatar ? "w-7 h-7" : "w-7 h-7 invisible"}`}>
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/40 to-accent/30 grid place-items-center overflow-hidden">
                      {m.author?.avatar_url ? <img src={m.author.avatar_url} alt="" className="w-full h-full object-cover"/> : (
                        <span className="text-[10px] font-display text-primary-glow">{(m.author?.username ?? "?")[0]?.toUpperCase()}</span>
                      )}
                    </div>
                  </Link>
                )}
                <div className={`max-w-[75%] ${m.sticker_url ? "" : "space-y-0.5"}`}>
                  {chat.chat.type === "group" && !mine && showAvatar && !m.sticker_url && (
                    <div className="text-[9px] font-mono text-primary-glow ml-1">@{m.author?.username ?? "?"}</div>
                  )}
                  <motion.div
                    layout
                    className={`rounded-2xl ${
                      m.sticker_url
                        ? "p-1 bg-transparent"
                        : `px-3 py-2 ${
                            mine
                              ? "bg-gradient-to-br from-primary to-accent text-primary-foreground"
                              : "bg-muted/40"
                          }`
                    } ${isNew ? "shadow-lg" : ""}`}
                  >
                    {m.sticker_url ? (
                      <motion.img
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        src={m.sticker_url} alt="sticker" className="w-24 h-24 object-contain"
                      />
                    ) : (
                      <div className="text-sm whitespace-pre-wrap break-words">{m.content}</div>
                    )}
                  </motion.div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </main>

      {/* Input bar */}
      <div className="max-w-2xl mx-auto w-full px-2 py-2 border-t panel pb-[calc(env(safe-area-inset-bottom)+0.5rem)]">
        <div className="flex items-end gap-1">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setPickerOpen(true)}
            className="w-10 h-10 grid place-items-center rounded-xl border border-border hover:bg-muted/40 transition"
          >
            <Smile size={16} />
          </motion.button>
          <textarea ref={inputRef} value={text} onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1} placeholder="Mensaje…"
            className="flex-1 bg-input/50 rounded-2xl px-3 py-2.5 text-sm outline-none resize-none max-h-32 focus:ring-2 focus:ring-primary/40 transition"
            style={{ minHeight: 40 }}
          />
          <motion.button
            whileHover={text.trim() ? { scale: 1.05 } : {}}
            whileTap={{ scale: 0.9 }}
            onClick={send}
            disabled={!text.trim()}
            className="w-10 h-10 grid place-items-center rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <Send size={16} />
          </motion.button>
        </div>
      </div>

      {/* Sticker picker */}
      <AnimatePresence>
        {pickerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm grid place-items-end"
            onClick={() => setPickerOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-2xl mx-auto panel border-t border-border rounded-t-2xl p-3 space-y-3 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center">
                <div className="font-display text-sm text-primary-glow">STICKERS</div>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => fileRef.current?.click()}
                  className="ml-auto px-3 py-1.5 rounded-xl border border-primary/40 bg-primary/10 text-primary-glow text-[10px] font-display tracking-widest flex items-center gap-1 hover:bg-primary/20 transition"
                >
                  <Upload size={12}/> SUBIR
                </motion.button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => doUpload(e.target.files?.[0] ?? null)} />
                <button onClick={() => setPickerOpen(false)} className="ml-2 w-8 h-8 grid place-items-center rounded-lg border border-border hover:bg-muted/40">
                  <X size={14}/>
                </button>
              </div>
              <div className="grid grid-cols-5 gap-2 max-h-[50vh] overflow-auto">
                {stickers.map(s => (
                  <motion.button key={s.id} whileTap={{ scale: 0.9 }}
                    onClick={() => sendSticker(s.url)}
                    className="aspect-square rounded-xl bg-muted/40 hover:bg-muted/70 p-1 transition">
                    <img src={s.url} alt={s.name ?? "sticker"} className="w-full h-full object-contain"/>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Info panel */}
      <AnimatePresence>
        {infoOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[85] bg-black/60 backdrop-blur-sm grid place-items-end sm:place-items-center p-3"
            onClick={() => setInfoOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.96 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-md panel border border-border rounded-2xl p-4 space-y-3 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-2">
                <Info size={14} className="text-primary-glow" />
                <div className="font-display text-sm text-primary-glow">INFO DEL CHAT</div>
                <button onClick={() => setInfoOpen(false)} className="ml-auto w-8 h-8 grid place-items-center rounded-lg border border-border hover:bg-muted/40">
                  <X size={14}/>
                </button>
              </div>

              <div className="flex flex-col items-center py-4 gap-2">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/40 to-accent/30 grid place-items-center overflow-hidden">
                  {chat.chat.type === "direct" && chat.other?.avatar_url ? (
                    <img src={chat.other.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : chat.chat.type === "group" ? (
                    <Users size={24} className="text-primary-glow" />
                  ) : (
                    <span className="text-xl font-display text-primary-glow">{title[0]?.toUpperCase()}</span>
                  )}
                </div>
                <div className="font-display text-base font-semibold">{title}</div>
                {chat.chat.type === "group" && chat.chat.name && (
                  <div className="text-[10px] font-mono text-muted-foreground">
                    Creado {new Date(chat.chat.created_at).toLocaleDateString()}
                  </div>
                )}
                {chat.chat.type === "direct" && (
                  <Link to="/profile/$userId" params={{ userId: chat.other?.id ?? "" }}
                    className="text-[11px] text-primary underline">
                    Ver perfil
                  </Link>
                )}
              </div>

              {chat.chat.type === "group" && (
                <>
                  <div className="border-t border-border/50 pt-3">
                    <div className="font-display text-[10px] tracking-widest text-muted-foreground mb-2 flex items-center gap-1">
                      <Users size={11} /> MIEMBROS · {activeMembers.length}
                    </div>
                    <div className="space-y-1 max-h-[30vh] overflow-auto">
                      {chat.members.filter(m => m.status === "active").map(m => {
                        const isOwner = m.user_id === chat.chat.created_by;
                        return (
                          <div key={m.user_id} className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-muted/30 transition">
                            <Link to="/profile/$userId" params={{ userId: m.user_id }}
                              className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/40 to-accent/30 grid place-items-center overflow-hidden shrink-0">
                              {m.profile?.avatar_url ? <img src={m.profile.avatar_url} alt="" className="w-full h-full object-cover"/> : (
                                <span className="text-[10px] font-display text-primary-glow">{(m.profile?.username ?? "?")[0]?.toUpperCase()}</span>
                              )}
                            </Link>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-display truncate flex items-center gap-1">
                                {m.profile?.display_name || m.profile?.username || "?"}
                                {isOwner && <Crown size={10} className="text-yellow-500" />}
                              </div>
                              <div className="text-[10px] font-mono text-muted-foreground truncate">@{m.profile?.username}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => { setInfoOpen(false); setInviteOpen(true); }}
                    className="w-full py-2.5 rounded-xl border border-dashed border-primary/40 text-primary-glow text-[10px] font-display tracking-widest flex items-center justify-center gap-1 hover:bg-primary/5 transition"
                  >
                    <UserPlus size={12} /> INVITAR MIEMBROS
                  </motion.button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {inviteOpen && <InviteDialog chatId={chatId} existing={chat.members.map(m => m.user_id)} onClose={() => { setInviteOpen(false); load(); }} />}
    </div>
  );
}

function InviteDialog({ chatId, existing, onClose }: { chatId: string; existing: string[]; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [selected, setSelected] = useState<Profile[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!q.trim()) { setResults([]); return; }
      const r = await searchUsers(q);
      setResults(r.filter(u => !existing.includes(u.id)));
    }, 250);
    return () => clearTimeout(t);
  }, [q, existing]);

  const send = async () => {
    setBusy(true);
    try { await inviteToChat(chatId, selected.map(s => s.id)); onClose(); }
    finally { setBusy(false); }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[85] bg-black/60 backdrop-blur-sm grid place-items-end sm:place-items-center p-3"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30, scale: 0.96 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md panel border border-border rounded-2xl p-4 space-y-3 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <UserPlus size={14} className="text-primary-glow" />
          <div className="font-display text-sm text-primary-glow">INVITAR</div>
          <button onClick={onClose} className="ml-auto w-8 h-8 grid place-items-center rounded-lg border border-border hover:bg-muted/40">
            <X size={14}/>
          </button>
        </div>
        <div className="flex items-center gap-2 bg-input/50 rounded-xl px-3 focus-within:ring-2 focus-within:ring-primary/40 transition">
          <Search size={14} className="text-muted-foreground shrink-0" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar usuarios…"
            className="flex-1 bg-transparent py-2 text-sm outline-none" />
        </div>
        <AnimatePresence>
          {selected.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-wrap gap-1"
            >
              {selected.map(s => (
                <motion.button key={s.id} layout initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                  onClick={() => setSelected(sel => sel.filter(x => x.id !== s.id))}
                  className="text-[10px] font-mono px-2 py-1 rounded-full bg-primary/20 text-primary-glow border border-primary/40 flex items-center gap-1 hover:bg-primary/30 transition">
                  @{s.username} <X size={10}/>
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
        <div className="max-h-[40vh] overflow-auto space-y-1">
          <AnimatePresence>
            {results.map(u => (
              <motion.button key={u.id} layout
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                onClick={() => setSelected(sel => sel.find(x => x.id === u.id) ? sel : [...sel, u])}
                className="w-full flex items-center gap-2 px-2 py-2 rounded-xl border border-border/50 active:scale-[0.99] transition hover:border-primary/40">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/40 to-accent/30 grid place-items-center overflow-hidden shrink-0">
                  {u.avatar_url ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover"/> : (
                    <span className="text-[11px] font-display text-primary-glow">{(u.username ?? "?")[0]?.toUpperCase()}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-sm font-display truncate">{u.display_name || u.username}</div>
                  <div className="text-[10px] font-mono text-muted-foreground truncate">@{u.username}</div>
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.97 }}
          onClick={send} disabled={busy || !selected.length}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-display tracking-widest text-xs disabled:opacity-50 transition"
        >
          {busy ? <Loader2 size={14} className="animate-spin mx-auto" /> : `INVITAR (${selected.length})`}
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
