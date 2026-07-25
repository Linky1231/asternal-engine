import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, MessageCircle, Users, Plus, Loader2, X, Search, Check, Camera, Info, Hash } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  listMyChats, respondChatInvite, createGroupChat, createDirectChat, searchUsers,
  type ChatSummary, type Profile,
} from "@/lib/social/api";

export const Route = createFileRoute("/chats")({
  head: () => ({ meta: [{ title: "Mensajes · Asternal" }] }),
  component: ChatsPage,
});

function ChatsPage() {
  const navigate = useNavigate();
  const [myId, setMyId] = useState<string | null>(null);
  const [active, setActive] = useState<ChatSummary[]>([]);
  const [pending, setPending] = useState<ChatSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [newOpen, setNewOpen] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const { active, pending } = await listMyChats();
      setActive(active); setPending(pending);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate({ to: "/auth" }); return; }
      setMyId(session.user.id);
      await reload();
    })();
  }, [navigate]);

  const accept = async (chatId: string) => { await respondChatInvite(chatId, true); reload(); };
  const reject = async (chatId: string) => { await respondChatInvite(chatId, false); reload(); };

  const chatLabel = (s: ChatSummary): string => {
    if (s.chat.type === "direct") return s.other?.display_name ?? s.other?.username ?? "Chat";
    return s.chat.name ?? "Grupo";
  };

  const timeAgo = (dateStr: string | null): string => {
    if (!dateStr) return "";
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "ahora";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    return `${days}d`;
  };

  return (
    <div className="min-h-screen w-screen flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-20 panel border-b backdrop-blur-xl">
        <div className="max-w-2xl mx-auto flex items-center gap-2 px-3 py-2.5">
          <Link to="/" className="w-9 h-9 rounded-xl border border-border grid place-items-center active:scale-95">
            <ArrowLeft size={16} />
          </Link>
          <div className="flex-1 font-display text-sm text-primary-glow glow-text flex items-center gap-1.5">
            <MessageCircle size={14} /> MENSAJES
          </div>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setNewOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground text-[10px] font-display tracking-widest flex items-center gap-1"
          >
            <Plus size={12} /> NUEVO
          </motion.button>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-3 py-3 space-y-4 pb-24">
        {loading ? (
          <div className="text-center text-xs text-muted-foreground py-10"><Loader2 className="animate-spin inline mr-2" size={14} />Cargando…</div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
            {/* ── Invitaciones animadas ── */}
            <AnimatePresence>
              {pending.length > 0 && (
                <motion.section
                  key="invites"
                  initial={{ opacity: 0, y: -20, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, y: -20, height: 0 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  className="space-y-2 overflow-hidden"
                >
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 }}
                    className="font-display text-[10px] tracking-widest text-primary-glow px-1 flex items-center gap-1.5"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    INVITACIONES · {pending.length}
                  </motion.div>
                  {pending.map((s, i) => (
                    <motion.div
                      key={s.chat.id}
                      initial={{ opacity: 0, y: -16, scale: 0.97, filter: "blur(3px)" }}
                      animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                      transition={{ duration: 0.4, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                      className="panel border border-primary/40 rounded-2xl p-3 space-y-2 shadow-sm"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/40 to-accent/30 grid place-items-center shrink-0">
                          {s.chat.type === "group" ? <Users size={16} className="text-primary-glow"/> : <MessageCircle size={16} className="text-primary-glow"/>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-display text-sm truncate flex items-center gap-1.5">
                            {chatLabel(s)}
                            {s.chat.type === "group" && <Hash size={10} className="text-muted-foreground" />}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            Te invitó {s.members.find(m => m.user_id === s.chat.created_by)?.profile?.username ?? "alguien"}
                            {s.chat.type === "group" && ` · ${s.members.length} miembros`}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => accept(s.chat.id)}
                          className="flex-1 py-2 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground text-[10px] font-display tracking-widest flex items-center justify-center gap-1"
                        >
                          <Check size={12} /> ACEPTAR
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => reject(s.chat.id)}
                          className="flex-1 py-2 rounded-xl border border-border text-[10px] font-display tracking-widest flex items-center justify-center gap-1"
                        >
                          <X size={12} /> RECHAZAR
                        </motion.button>
                      </div>
                    </motion.div>
                  ))}
                </motion.section>
              )}
            </AnimatePresence>

            {/* ── Chats activos ── */}
            <motion.section
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: pending.length > 0 ? 0.5 : 0.1 }}
              className="space-y-2"
            >
              <div className="font-display text-[10px] tracking-widest text-muted-foreground px-1">
                CHATS · {active.length}
              </div>
              {active.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="panel rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground"
                >
                  Sin chats aún. Pulsa <b className="text-primary-glow">NUEVO</b> para empezar.
                </motion.div>
              ) : (
                <div className="space-y-1.5">
                  {active.map((s, i) => (
                    <motion.div
                      key={s.chat.id}
                      initial={{ opacity: 0, y: 10, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.3, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <Link
                        to="/chats/$chatId"
                        params={{ chatId: s.chat.id }}
                        className="panel border border-border/50 rounded-2xl p-3 flex items-center gap-3 active:scale-[0.99] transition hover:shadow-md hover:border-primary/30 group"
                      >
                        <div className="relative w-11 h-11 rounded-full bg-gradient-to-br from-primary/40 to-accent/30 grid place-items-center overflow-hidden shrink-0">
                          {s.chat.type === "direct" && s.other?.avatar_url ? (
                            <img src={s.other.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : s.chat.type === "group" ? (
                            <div className="flex -space-x-2">
                              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/50 to-accent/40 border-2 border-background grid place-items-center">
                                <Users size={12} className="text-primary-foreground" />
                              </div>
                              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-accent/50 to-primary/40 border-2 border-background grid place-items-center">
                                <Users size={12} className="text-primary-foreground" />
                              </div>
                            </div>
                          ) : (
                            <span className="text-sm font-display text-primary-glow">{chatLabel(s)[0]?.toUpperCase()}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="font-display text-sm truncate group-hover:text-primary transition-colors">
                              {chatLabel(s)}
                              {s.chat.type === "group" && (
                                <span className="ml-1 text-[10px] text-muted-foreground font-normal">
                                  · {s.members.filter(m => m.status === "active").length}
                                </span>
                              )}
                            </div>
                            {s.last_message?.created_at && (
                              <span className="text-[9px] font-mono text-muted-foreground shrink-0">
                                {timeAgo(s.last_message.created_at)}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] font-mono text-muted-foreground truncate flex items-center gap-1.5">
                            <span className="truncate">
                              {s.last_message?.content ?? (s.last_message?.sticker_url ? "🖼 sticker" : "Sin mensajes")}
                            </span>
                          </div>
                        </div>
                        <ChevronRight size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </Link>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.section>
          </motion.div>
        )}
      </main>

      {newOpen && myId && (
        <NewChatDialog myId={myId} onClose={() => setNewOpen(false)}
          onCreated={id => { setNewOpen(false); navigate({ to: "/chats/$chatId", params: { chatId: id } }); }} />
      )}
    </div>
  );
}

function NewChatDialog({ myId, onClose, onCreated }: { myId: string; onClose: () => void; onCreated: (chatId: string) => void }) {
  const [mode, setMode] = useState<"direct" | "group">("direct");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [selected, setSelected] = useState<Profile[]>([]);
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");
  const [groupPhoto, setGroupPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!q.trim()) { setResults([]); return; }
      try { setResults((await searchUsers(q)).filter(u => u.id !== myId)); }
      catch (e) { setErr((e as Error).message); }
    }, 250);
    return () => clearTimeout(t);
  }, [q, myId]);

  const toggleSel = (p: Profile) => {
    setSelected(sel => sel.find(x => x.id === p.id) ? sel.filter(x => x.id !== p.id) : [...sel, p]);
  };

  const pickPhoto = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const f = input.files?.[0];
      if (f) {
        if (f.size > 2 * 1024 * 1024) { setErr("Máx 2MB"); return; }
        setGroupPhoto(URL.createObjectURL(f));
      }
    };
    input.click();
  };

  const create = async () => {
    setBusy(true); setErr(null);
    try {
      if (mode === "direct") {
        if (selected.length !== 1) throw new Error("Selecciona 1 usuario");
        onCreated(await createDirectChat(selected[0].id));
      } else {
        if (!selected.length) throw new Error("Añade al menos 1 miembro");
        onCreated(await createGroupChat(groupName || "Grupo", selected.map(s => s.id)));
      }
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm grid place-items-end sm:place-items-center p-3"
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
          <div className="font-display text-sm text-primary-glow">NUEVO CHAT</div>
          <button onClick={onClose} className="ml-auto w-8 h-8 grid place-items-center rounded-lg border border-border hover:bg-muted/40">
            <X size={14}/>
          </button>
        </div>

        {/* Toggle individual / grupo */}
        <div className="grid grid-cols-2 gap-1 bg-muted/40 rounded-xl p-1">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => { setMode("direct"); setSelected([]); }}
            className={`py-2 rounded-lg text-[10px] font-display tracking-widest transition-colors ${mode === "direct" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            <MessageCircle size={12} className="inline mr-1"/> INDIVIDUAL
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setMode("group")}
            className={`py-2 rounded-lg text-[10px] font-display tracking-widest transition-colors ${mode === "group" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Users size={12} className="inline mr-1"/> GRUPO
          </motion.button>
        </div>

        <AnimatePresence mode="wait">
          {mode === "group" && (
            <motion.div
              key="group-fields"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-2 overflow-hidden"
            >
              {/* Foto del grupo */}
              <div className="flex items-center gap-3">
                <button onClick={pickPhoto}
                  className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/30 to-accent/20 border-2 border-dashed border-primary/30 grid place-items-center hover:border-primary/60 transition-colors overflow-hidden shrink-0"
                >
                  {groupPhoto ? (
                    <img src={groupPhoto} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Camera size={18} className="text-primary-glow" />
                  )}
                </button>
                <div className="flex-1 space-y-1">
                  <input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="Nombre del grupo" maxLength={60}
                    className="w-full bg-input/50 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40" />
                  <input value={groupDesc} onChange={e => setGroupDesc(e.target.value)} placeholder="Descripción (opcional)" maxLength={120}
                    className="w-full bg-input/50 rounded-xl px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Buscador */}
        <div className="flex items-center gap-2 bg-input/50 rounded-xl px-3 focus-within:ring-2 focus-within:ring-primary/40 transition">
          <Search size={14} className="text-muted-foreground shrink-0" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar usuarios…"
            className="flex-1 bg-transparent py-2 text-sm outline-none" />
        </div>

        {/* Seleccionados */}
        <AnimatePresence>
          {selected.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-wrap gap-1"
            >
              {selected.map(s => (
                <motion.button
                  key={s.id}
                  layout
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  onClick={() => toggleSel(s)}
                  className="text-[10px] font-mono px-2 py-1 rounded-full bg-primary/20 text-primary-glow border border-primary/40 flex items-center gap-1 hover:bg-primary/30 transition"
                >
                  @{s.username} <X size={10} />
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Resultados */}
        <div className="max-h-[40vh] overflow-auto space-y-1 scrollbar-thin">
          <AnimatePresence>
            {results.map(u => {
              const sel = !!selected.find(x => x.id === u.id);
              return (
                <motion.button
                  key={u.id}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  onClick={() => toggleSel(u)}
                  className={`w-full flex items-center gap-2 px-2 py-2 rounded-xl border ${sel ? "border-primary bg-primary/10" : "border-border/50"} active:scale-[0.99] transition hover:border-primary/40`}
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/40 to-accent/30 grid place-items-center overflow-hidden shrink-0">
                    {u.avatar_url ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover"/> : (
                      <span className="text-[11px] font-display text-primary-glow">{(u.display_name ?? u.username ?? "?")[0]?.toUpperCase()}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="text-sm font-display truncate">{u.display_name || u.username}</div>
                    <div className="text-[10px] font-mono text-muted-foreground truncate">@{u.username}</div>
                  </div>
                  {sel && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                      <Check size={14} className="text-primary-glow" />
                    </motion.div>
                  )}
                </motion.button>
              );
            })}
          </AnimatePresence>
          {q && !results.length && <div className="text-center text-xs text-muted-foreground py-4">Sin resultados</div>}
        </div>

        {err && <div className="text-xs text-destructive">{err}</div>}

        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.97 }}
          onClick={create}
          disabled={busy || (mode === "direct" ? selected.length !== 1 : selected.length === 0)}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-display tracking-widest text-xs disabled:opacity-50 transition"
        >
          {busy ? <Loader2 size={14} className="animate-spin mx-auto" /> : mode === "direct" ? "ABRIR CHAT" : `CREAR GRUPO (${selected.length})`}
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

function ChevronRight({ size, className }: { size: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}
