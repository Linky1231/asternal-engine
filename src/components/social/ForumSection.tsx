import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { fileToDataURL } from "@/lib/engine/images";
import {
  initForumCategories, getForumCategories, getForumThreads, getForumThread,
  createForumThread, createForumPost, getForumPosts, deleteForumThread,
  deleteForumPost, editForumPost, voteForumPost, togglePinThread,
  toggleCloseThread, incrementThreadView, searchForumThreads,
  voteForumThread, getForumThreadsWithVotes,
  type ForumCategory, type ForumThread, type ForumPost,
} from "@/lib/social/forum-storage";
import {
  MessageSquare, Pin, Lock, ArrowLeft, Plus, ThumbsUp, ThumbsDown,
  Reply, Quote, Trash2, Edit3, Send, Loader2, Eye, Clock, Hash,
  X, Check, MessageCircle, Search,
  Globe, LifeBuoy, Trophy, Coffee, MessageCircleMore, Tag,
  Image, FileText, Film,
} from "lucide-react";

/* ─── Motion variants (reduced timing) ─── */
const stagger = {
  container: { initial: {}, animate: { transition: { staggerChildren: 0.04 } } },
  item: {
    initial: { opacity: 0, y: 12, scale: 0.98, filter: "blur(3px)" },
    animate: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)", transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as const } },
  },
};

const fadeSlide = {
  initial: { opacity: 0, y: 8, filter: "blur(1px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] as const } },
  exit: { opacity: 0, y: -4, filter: "blur(1px)", transition: { duration: 0.15 } },
};

/* ─── Time ago helper ─── */
function timeAgo(iso: string) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60); if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24); if (d < 30) return `${d}d`;
  return new Date(iso).toLocaleDateString();
}

/* ─── Icon map ─── */
const CAT_ICONS: Record<string, React.ReactNode> = {
  "globe": <Globe size={16} />,
  "life-buoy": <LifeBuoy size={16} />,
  "trophy": <Trophy size={16} />,
  "message-circle-more": <MessageCircleMore size={16} />,
  "coffee": <Coffee size={16} />,
};

/* ─── Tag color map ─── */
const TAG_STYLES: Record<string, string> = {
  "Programación": "bg-blue-100/60 text-blue-700 border-blue-200/50 dark:bg-blue-900/20 dark:text-blue-300",
  "IA": "bg-purple-100/60 text-purple-700 border-purple-200/50 dark:bg-purple-900/20 dark:text-purple-300",
  "UI": "bg-cyan-100/60 text-cyan-700 border-cyan-200/50 dark:bg-cyan-900/20 dark:text-cyan-300",
  "Pixel Art": "bg-emerald-100/60 text-emerald-700 border-emerald-200/50 dark:bg-emerald-900/20 dark:text-emerald-300",
  "Música": "bg-rose-100/60 text-rose-700 border-rose-200/50 dark:bg-rose-900/20 dark:text-rose-300",
  "Física": "bg-amber-100/60 text-amber-700 border-amber-200/50 dark:bg-amber-900/20 dark:text-amber-300",
  "Animación": "bg-orange-100/60 text-orange-700 border-orange-200/50 dark:bg-orange-900/20 dark:text-orange-300",
  "Assets": "bg-teal-100/60 text-teal-700 border-teal-200/50 dark:bg-teal-900/20 dark:text-teal-300",
  "Publicación": "bg-indigo-100/60 text-indigo-700 border-indigo-200/50 dark:bg-indigo-900/20 dark:text-indigo-300",
  "Render": "bg-pink-100/60 text-pink-700 border-pink-200/50 dark:bg-pink-900/20 dark:text-pink-300",
  "General": "bg-neutral-100/60 text-neutral-600 border-neutral-200/50 dark:bg-neutral-800/20 dark:text-neutral-400",
};

const DEFAULT_TAG_STYLE = "bg-neutral-100/60 text-neutral-600 border-neutral-200/50 dark:bg-neutral-800/20 dark:text-neutral-400";

/* ─── User avatar mini ─── */
function AvatarMini({ username }: { username: string }) {
  return (
    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 grid place-items-center text-[10px] font-display font-semibold text-primary shrink-0">
      {username[0]?.toUpperCase() ?? "?"}
    </div>
  );
}

/* ─── Vote button ─── */
function VoteBtn({ dir, active, count, onClick }: { dir: "up" | "down"; active: boolean; count: number; onClick: () => void }) {
  const Icon = dir === "up" ? ThumbsUp : ThumbsDown;
  const activeColors = dir === "up"
    ? "text-primary bg-primary/10 border-primary/20"
    : "text-destructive bg-destructive/10 border-destructive/20";
  return (
    <button onClick={e => { e.stopPropagation(); onClick(); }}
      className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border transition-all duration-200 active:scale-90 ${
        active
          ? activeColors
          : "text-muted-foreground/50 border-transparent hover:border-border/50 hover:text-foreground/70"
      }`}>
      <Icon size={11} className={active ? "fill-current" : ""} />
      {count > 0 && <span className="tabular-nums font-medium">{count}</span>}
    </button>
  );
}

/* ─── Tag pill ─── */
function TagPill({ tag, small }: { tag: string; small?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md font-medium border ${
      TAG_STYLES[tag] ?? DEFAULT_TAG_STYLE
    } ${small ? "text-[9px] px-1.5 py-0.5" : "text-[10px] px-2 py-0.5"}`}>
      <Tag size={small ? 8 : 9} className="opacity-60" />
      {tag}
    </span>
  );
}

/* ─── Main Forums Component ─── */
type View = { type: "categories" } | { type: "threads"; categoryId: string; categoryName: string } | { type: "thread"; threadId: string };

export function ForumSection({ isAdmin: isAdminProp, isMod: isModProp }: { isAdmin?: boolean; isMod?: boolean }) {
  const [view, setView] = useState<View>({ type: "categories" });
  const [myId, setMyId] = useState<string | null>(null);
  const [myUsername, setMyUsername] = useState("");
  const adminOrMod = !!(isAdminProp || isModProp);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: d }) => {
      if (d?.session?.user) {
        setMyId(d.session.user.id);
        const user = d.session.user;
        const meta = (user as Record<string, unknown>)?.user_metadata as Record<string, string> | undefined;
        if (meta?.username) {
          setMyUsername(meta.username);
        } else {
          try {
            const users = JSON.parse(localStorage.getItem('_local_auth_users') || '[]');
            const u = users.find((u: Record<string, unknown>) => u.id === user.id);
            setMyUsername((u?.username as string) ?? user.email?.split("@")[0] ?? "user");
          } catch {
            setMyUsername(user.email?.split("@")[0] ?? "user");
          }
        }
      }
    });
  }, []);

  return (
    <div className="space-y-3">
      <AnimatePresence mode="wait">
        {view.type === "categories" && (
          <motion.div key="categories" {...fadeSlide}>
            <CategoryListView onSelect={(id, name) => setView({ type: "threads", categoryId: id, categoryName: name })} />
          </motion.div>
        )}
        {view.type === "threads" && (
          <motion.div key="threads" {...fadeSlide}>
            <ThreadListView
              categoryId={view.categoryId}
              categoryName={view.categoryName}
              myId={myId}
              myUsername={myUsername}
              adminOrMod={adminOrMod}
              onBack={() => setView({ type: "categories" })}
              onSelect={(threadId) => setView({ type: "thread", threadId })}
            />
          </motion.div>
        )}
        {view.type === "thread" && (
          <motion.div key="thread" {...fadeSlide}>
            <ThreadDetailView
              threadId={view.threadId}
              myId={myId}
              myUsername={myUsername}
              adminOrMod={adminOrMod}
              onBack={() => setView({ type: "categories" })}
              onCategoryBack={(catId, catName) => setView({ type: "threads", categoryId: catId, categoryName: catName })}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Category List ─── */
function CategoryListView({ onSelect }: { onSelect: (id: string, name: string) => void }) {
  const cats = initForumCategories();
  return (
    <motion.div initial="initial" animate="animate" variants={stagger.container} className="space-y-2">
      <motion.div variants={stagger.item} className="text-[10px] font-display tracking-[0.2em] text-muted-foreground/60 flex items-center gap-2 px-1">
        <Hash size={12} /> CATEGORÍAS
      </motion.div>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {cats.map(cat => (
          <motion.button key={cat.id} variants={stagger.item}
            onClick={() => onSelect(cat.id, cat.name)}
            className="group w-full text-left p-3.5 rounded-xl border border-border/40 bg-white/50 hover:bg-white/90 hover:border-primary/25 hover:shadow-sm hover:shadow-primary/5 transition-all duration-300 active:scale-[0.98]">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary/[0.08] to-accent/[0.08] grid place-items-center shrink-0 text-primary group-hover:scale-110 transition-transform duration-300">
                {CAT_ICONS[cat.icon] ?? <MessageSquare size={17} />}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-display font-semibold text-foreground group-hover:text-primary transition-colors">{cat.name}</div>
                <div className="text-[10px] text-muted-foreground/60 mt-0.5 line-clamp-1">{cat.description}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs font-display tabular-nums text-primary">{cat.threadCount}</div>
                <div className="text-[9px] text-muted-foreground/40 uppercase tracking-wider">hilos</div>
              </div>
            </div>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}

/* ─── Thread List ─── */
function ThreadListView({
  categoryId, categoryName, myId, myUsername, adminOrMod, onBack, onSelect,
}: {
  categoryId: string; categoryName: string; myId: string | null; myUsername: string; adminOrMod: boolean;
  onBack: () => void; onSelect: (threadId: string) => void;
}) {
  const [threads, setThreads] = useState<(ForumThread & { myVote: "up" | "down" | null })[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([]);
  const [docFiles, setDocFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const load = () => setThreads(getForumThreadsWithVotes(categoryId, myId));
  useEffect(load, [categoryId, myId]);

  useEffect(() => {
    const urls = mediaFiles.map(f => URL.createObjectURL(f));
    setMediaPreviews(urls);
    return () => { urls.forEach(URL.revokeObjectURL); };
  }, [mediaFiles]);

  const filtered = searchQ.trim()
    ? threads.filter(t => t.title.toLowerCase().includes(searchQ.toLowerCase()) || t.content.toLowerCase().includes(searchQ.toLowerCase()))
    : threads;

  const create = async () => {
    if (!title.trim() || !content.trim() || !myId) return;
    setBusy(true);
    try {
      const processed: { mediaUrls: string[]; mediaType: "image" | "video" | "none"; documentUrls: string[]; documentNames: string[] } = {
        mediaUrls: [], mediaType: "none", documentUrls: [], documentNames: [],
      };
      if (mediaFiles.length > 0) {
        processed.mediaType = mediaFiles[0].type.startsWith("video") ? "video" : "image";
        processed.mediaUrls = await Promise.all(mediaFiles.map(f => fileToDataURL(f)));
      }
      if (docFiles.length > 0) {
        processed.documentUrls = await Promise.all(docFiles.map(f => fileToDataURL(f)));
        processed.documentNames = docFiles.map(f => f.name);
      }
      createForumThread(categoryId, title, content, { id: myId, username: myUsername }, undefined, processed);
      setTitle(""); setContent(""); setMediaFiles([]); setDocFiles([]); setShowNew(false);
    } finally { setBusy(false); load(); }
  };

  const handleThreadVote = (threadId: string, vote: "up" | "down") => {
    if (!myId) return;
    voteForumThread(threadId, myId, vote);
    load();
  };

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="w-8 h-8 rounded-lg border border-border grid place-items-center active:scale-90 transition shrink-0 hover:bg-muted/30">
          <ArrowLeft size={14} />
        </button>
        <div className="flex-1 text-sm font-display font-semibold truncate flex items-center gap-2">
          {CAT_ICONS[categoryId === "general" ? "globe" : categoryId === "help" ? "life-buoy" : categoryId === "showcase" ? "trophy" : categoryId === "feedback" ? "message-circle-more" : "coffee"] ?? <MessageSquare size={14} className="text-primary" />}
          {categoryName}
        </div>
        {myId && (
          <button onClick={() => setShowNew(s => !s)}
            className="flex items-center gap-1.5 h-8 px-3.5 rounded-lg bg-primary text-primary-foreground text-[10px] font-display tracking-widest active:scale-95 transition shadow-sm shadow-primary/20 hover:shadow-md hover:shadow-primary/30">
            <Plus size={13} /> NUEVO HILO
          </button>
        )}
      </div>

      {/* Search bar */}
      <div className="flex items-center gap-2 bg-white/60 rounded-xl px-3 py-1.5 border border-border/40 focus-within:border-primary/30 focus-within:shadow-sm focus-within:shadow-primary/5 transition-all">
        <Search size={14} className="text-muted-foreground/60 shrink-0" />
        <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
          placeholder="Buscar hilos…"
          className="flex-1 bg-transparent text-xs outline-none py-1 placeholder:text-muted-foreground/40" />
        {searchQ && (
          <button onClick={() => setSearchQ("")} className="text-muted-foreground/40 hover:text-muted-foreground transition-colors">
            <X size={12} />
          </button>
        )}
      </div>

      {/* New thread form */}
      <AnimatePresence>
        {showNew && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden">
            <motion.div initial={{ y: -8 }} animate={{ y: 0 }} exit={{ y: -8 }}
              className="p-4 rounded-xl border border-primary/20 bg-gradient-to-b from-primary/[0.02] to-transparent shadow-sm space-y-3">
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Título del hilo…"
                maxLength={120} autoFocus
                className="w-full bg-white/80 rounded-lg px-3.5 py-2.5 text-sm outline-none border border-border/50 focus:border-primary/40 focus:shadow-sm transition-all placeholder:text-muted-foreground/40" />
              <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Escribe tu mensaje…"
                rows={4} maxLength={5000}
                className="w-full bg-white/80 rounded-lg px-3.5 py-2.5 text-sm outline-none border border-border/50 focus:border-primary/40 resize-none transition-all placeholder:text-muted-foreground/40" />

              {/* Media previews */}
              {mediaPreviews.length > 0 && (
                <div className={`grid gap-2 ${mediaPreviews.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                  {mediaPreviews.map((url, i) => (
                    <div key={i} className="relative rounded-xl overflow-hidden bg-muted/30 border border-border/50">
                      {mediaFiles[i]?.type.startsWith("video") ? (
                        <video src={url} className="w-full rounded-lg" controls muted />
                      ) : (
                        <img src={url} alt="" className="w-full rounded-lg" loading="lazy" />
                      )}
                      <button onClick={() => {
                        setMediaFiles(f => f.filter((_, idx) => idx !== i));
                      }} className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/50 text-white grid place-items-center active:scale-90 transition">
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Documents preview */}
              {docFiles.length > 0 && (
                <div className="space-y-1">
                  {docFiles.map((d, i) => (
                    <div key={i} className="flex items-center gap-2 bg-white/60 rounded-lg px-3 py-2 text-xs border border-border/40">
                      <FileText size={13} className="text-primary shrink-0" />
                      <span className="flex-1 truncate">{d.name}</span>
                      <span className="text-muted-foreground tabular-nums">{(d.size / 1024).toFixed(0)}KB</span>
                      <button onClick={() => setDocFiles(f => f.filter((_, idx) => idx !== i))} className="text-muted-foreground/50 hover:text-destructive">
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload bar */}
              <div className="flex items-center gap-1.5">
                <input ref={mediaInputRef} type="file" hidden accept="image/*,image/gif,video/*" multiple onChange={e => {
                  const list = Array.from(e.target.files ?? []);
                  if (list.length) { setMediaFiles(prev => [...prev, ...list]); }
                  e.target.value = "";
                }} />
                <button onClick={() => mediaInputRef.current?.click()}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border/60 text-[10px] text-muted-foreground/70 hover:text-primary hover:border-primary/30 transition active:scale-95">
                  <Image size={12} /> Imagen
                </button>
                <input ref={docInputRef} type="file" hidden multiple accept=".pdf,.doc,.docx,.txt,.zip,.json" onChange={e => {
                  const list = Array.from(e.target.files ?? []);
                  if (list.length) { setDocFiles(prev => [...prev, ...list]); }
                  e.target.value = "";
                }} />
                <button onClick={() => docInputRef.current?.click()}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border/60 text-[10px] text-muted-foreground/70 hover:text-primary hover:border-primary/30 transition active:scale-95">
                  <FileText size={12} /> Documento
                </button>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => { setShowNew(false); setMediaFiles([]); setDocFiles([]); }} className="px-3.5 py-1.5 rounded-lg border border-border text-[11px] hover:bg-muted/20 transition-colors">Cancelar</button>
                <button disabled={busy || !title.trim() || !content.trim()} onClick={create}
                  className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-[11px] font-display tracking-widest disabled:opacity-40 active:scale-95 transition flex items-center gap-1.5 shadow-sm shadow-primary/20">
                  {busy ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} PUBLICAR
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Thread list */}
      <motion.div initial="initial" animate="animate" variants={stagger.container} className="space-y-1.5">
        {filtered.length === 0 ? (
          <motion.div variants={stagger.item} className="text-center text-xs text-muted-foreground/60 py-12">
            <MessageSquare size={24} className="mx-auto mb-2 opacity-20" />
            {searchQ ? "No se encontraron hilos." : (myId ? "No hay hilos aún. ¡Crea el primero!" : "Inicia sesión para ver y crear hilos.")}
          </motion.div>
        ) : filtered.map(t => (
          <motion.button key={t.id} variants={stagger.item} layout
            onClick={() => onSelect(t.id)}
            className="group w-full text-left p-3.5 rounded-xl border border-border/30 bg-white/50 hover:bg-white/90 hover:border-primary/15 hover:shadow-sm hover:shadow-primary/5 transition-all duration-200 active:scale-[0.99]">
            <div className="flex items-start gap-3">
              {/* Vote column */}
              <div className="flex flex-col items-center gap-0.5 shrink-0 pt-0.5">
                <VoteBtn dir="up" active={t.myVote === "up"} count={t.upvotes} onClick={() => handleThreadVote(t.id, "up")} />
                <VoteBtn dir="down" active={t.myVote === "down"} count={t.downvotes} onClick={() => handleThreadVote(t.id, "down")} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {t.pinned && <Pin size={11} className="text-primary shrink-0" />}
                  {t.closed && <Lock size={11} className="text-destructive/50 shrink-0" />}
                  <span className="text-sm font-display font-semibold truncate group-hover:text-primary transition-colors">{t.title}</span>
                </div>

                {/* Tags row */}
                {t.tags && t.tags.length > 0 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                    className="flex flex-wrap gap-1 mt-1.5">
                    {t.tags.map(tag => <TagPill key={tag} tag={tag} small />)}
                  </motion.div>
                )}

                <div className="text-[10px] text-muted-foreground/60 mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
                  <span className="font-medium text-foreground/70">@{t.authorUsername}</span>
                  <span className="flex items-center gap-1"><Clock size={9} />{timeAgo(t.createdAt)}</span>
                  <span className="flex items-center gap-1"><MessageSquare size={9} />{t.postCount}</span>
                  <span className="flex items-center gap-1"><Eye size={9} />{t.views}</span>
                </div>
              </div>

              <div className="text-[9px] text-muted-foreground/40 text-right shrink-0 hidden sm:block pt-0.5">
                <div className="uppercase tracking-wider">último</div>
                <div className="tabular-nums mt-0.5">{timeAgo(t.lastPostAt)}</div>
              </div>
            </div>
          </motion.button>
        ))}
      </motion.div>
    </div>
  );
}

/* ─── Thread Detail ─── */
function ThreadDetailView({
  threadId, myId, myUsername, adminOrMod, onBack, onCategoryBack,
}: {
  threadId: string; myId: string | null; myUsername: string; adminOrMod: boolean;
  onBack: () => void; onCategoryBack: (catId: string, catName: string) => void;
}) {
  const [thread, setThread] = useState<(ForumThread & { myVote: "up" | "down" | null }) | null>(null);
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [replyContent, setReplyContent] = useState("");
  const [quotePost, setQuotePost] = useState<{ id: string; content: string; author: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingPost, setEditingPost] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const replyRef = useRef<HTMLTextAreaElement>(null);

  const load = () => {
    setThread(getForumThread(threadId));
    setPosts(getForumPosts(threadId));
  };
  useEffect(() => {
    incrementThreadView(threadId);
    load();
  }, [threadId]);

  const sendReply = async () => {
    if (!replyContent.trim() || !myId || thread?.closed) return;
    setBusy(true);
    createForumPost(
      threadId,
      replyContent,
      { id: myId, username: myUsername },
      { postId: quotePost?.id ?? null, content: quotePost?.content ?? null, author: quotePost?.author ?? null },
    );
    setReplyContent("");
    setQuotePost(null);
    setBusy(false);
    load();
  };

  const handlePostVote = (postId: string, vote: "up" | "down") => {
    if (!myId) return;
    voteForumPost(postId, myId, vote);
    setPosts(getForumPosts(threadId));
  };

  const handleThreadVote = (vote: "up" | "down") => {
    if (!myId || !thread) return;
    voteForumThread(threadId, myId, vote);
    setThread(getForumThread(threadId));
  };

  const handleEdit = (postId: string) => {
    const p = posts.find(po => po.id === postId);
    if (!p) return;
    setEditingPost(postId);
    setEditContent(p.content);
  };

  const saveEdit = async (postId: string) => {
    if (!editContent.trim()) return;
    editForumPost(postId, editContent);
    setEditingPost(null);
    setPosts(getForumPosts(threadId));
  };

  const handleDelete = (postId: string) => {
    if (!confirm("¿Borrar este mensaje?")) return;
    deleteForumPost(postId);
    setPosts(getForumPosts(threadId));
  };

  const handleQuote = (p: ForumPost) => {
    setQuotePost({ id: p.id, content: p.content.slice(0, 300), author: p.authorUsername });
    replyRef.current?.focus();
  };

  const cats = getForumCategories();
  const cat = cats.find(c => c.id === thread?.categoryId);
  const catIcon = cat ? CAT_ICONS[cat.icon] ?? <MessageSquare size={14} /> : <MessageSquare size={14} />;
  const isOwner = myId === thread?.authorId;
  const isClosed = thread?.closed ?? false;
  const canPin = adminOrMod;

  if (!thread) return (
    <div className="text-center text-xs text-muted-foreground/60 py-12">
      <MessageSquare size={28} className="mx-auto mb-2 opacity-20" />
      Hilo no encontrado.
      <button onClick={onBack} className="block mx-auto mt-2 text-primary underline hover:no-underline">Volver</button>
    </div>
  );

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="w-8 h-8 rounded-lg border border-border grid place-items-center active:scale-90 transition shrink-0 hover:bg-muted/30">
          <ArrowLeft size={14} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {thread.pinned && <Pin size={12} className="text-primary shrink-0" />}
            {thread.closed && <Lock size={12} className="text-destructive/50 shrink-0" />}
            <h3 className="text-sm font-display font-semibold truncate">{thread.title}</h3>
          </div>
          <button onClick={() => onCategoryBack(thread.categoryId, cat?.name ?? "Foros")}
            className="text-[10px] text-muted-foreground/50 hover:text-primary transition-colors flex items-center gap-1 mt-0.5">
            <ArrowLeft size={10} /> {catIcon} {cat?.name ?? "Foros"}
          </button>
        </div>
        {canPin && (
          <button onClick={() => { togglePinThread(threadId); load(); }}
            className={`h-8 px-2.5 rounded-lg border text-[10px] flex items-center gap-1 active:scale-95 transition ${
              thread.pinned ? "border-primary/30 bg-primary/5 text-primary" : "border-border text-muted-foreground/60 hover:text-primary"
            }`}>
            <Pin size={11} /> {thread.pinned ? "FIJADO" : "FIJAR"}
          </button>
        )}
        {isOwner && !isClosed && (
          <button onClick={() => { toggleCloseThread(threadId); load(); }}
            className="h-8 px-2.5 rounded-lg border border-border text-[10px] flex items-center gap-1 active:scale-95 transition hover:text-destructive">
            <Lock size={11} /> CERRAR
          </button>
        )}
      </div>

      {/* Thread body */}
      <motion.div initial="initial" animate="animate" variants={stagger.container} className="space-y-2 max-h-[65vh] overflow-y-auto pr-1 no-scrollbar">
        {/* First post — thread content */}
        <motion.div variants={stagger.item} className="p-4 rounded-xl border border-border/40 bg-white/60 shadow-sm">
          <div className="flex items-center gap-2.5 mb-3">
            <AvatarMini username={thread.authorUsername} />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-display font-semibold">@{thread.authorUsername}</div>
              <div className="text-[9px] text-muted-foreground/50">{timeAgo(thread.createdAt)}</div>
            </div>
            {/* Thread vote buttons */}
            <div className="flex items-center gap-1">
              <VoteBtn dir="up" active={thread.myVote === "up"} count={thread.upvotes} onClick={() => handleThreadVote("up")} />
              <VoteBtn dir="down" active={thread.myVote === "down"} count={thread.downvotes} onClick={() => handleThreadVote("down")} />
            </div>
          </div>

          {/* Tags */}
          {thread.tags && thread.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {thread.tags.map(tag => <TagPill key={tag} tag={tag} />)}
            </div>
          )}

          <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{thread.content}</p>

          {/* Media display */}
          {thread.mediaUrls && thread.mediaUrls.length > 0 && (
            <div className={`grid gap-2 mt-3 ${thread.mediaUrls.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
              {thread.mediaUrls.map((url, i) => (
                thread.mediaType === "video" ? (
                  <video key={i} src={url} controls className="rounded-lg w-full bg-black" />
                ) : (
                  <img key={i} src={url} alt="" className="rounded-lg w-full" loading="lazy" />
                )
              ))}
            </div>
          )}

          {/* Documents display */}
          {thread.documentUrls && thread.documentUrls.length > 0 && (
            <div className="space-y-1 mt-3">
              {thread.documentUrls.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noreferrer" download={thread.documentNames[i]}
                  className="flex items-center gap-2 bg-muted/30 hover:bg-muted/50 rounded-lg px-3 py-2 text-xs transition border border-border/30">
                  <FileText size={14} className="text-primary shrink-0" />
                  <span className="flex-1 truncate">{thread.documentNames[i] ?? `Documento ${i + 1}`}</span>
                  <span className="text-[10px] text-muted-foreground/60">Descargar</span>
                </a>
              ))}
            </div>
          )}
        </motion.div>

        {/* Replies */}
        {posts.filter(p => p.id !== posts[0]?.id).length === 0 ? (
          <motion.div variants={stagger.item} className="text-center text-[10px] text-muted-foreground/40 py-8 border border-dashed border-border/30 rounded-xl">
            Sin respuestas aún. ¡Sé el primero en comentar!
          </motion.div>
        ) : posts.filter(p => p.id !== posts[0]?.id).map(p => (
          <motion.div key={p.id} variants={stagger.item} layout>
            {p.quoteContent && (
              <div className="mb-2.5 pl-3 border-l-2 border-primary/30 bg-primary/[0.02] rounded-r-md py-1.5 px-2.5 text-xs text-muted-foreground">
                <span className="text-[9px] font-semibold text-primary/60 uppercase tracking-wider">@{p.quoteAuthor} escribió:</span>
                <p className="mt-0.5 italic line-clamp-2 text-muted-foreground/70">{p.quoteContent}</p>
              </div>
            )}
            <div className="flex gap-2.5">
              <AvatarMini username={p.authorUsername} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[11px] font-display font-semibold">@{p.authorUsername}</span>
                  <span className="text-[8px] text-muted-foreground/40">{timeAgo(p.createdAt)}</span>
                  {p.editedAt && <span className="text-[7px] text-muted-foreground/30 uppercase tracking-wider">· editado</span>}
                </div>
                {editingPost === p.id ? (
                  <div className="space-y-1.5">
                    <textarea value={editContent} onChange={e => setEditContent(e.target.value)}
                      rows={3} className="w-full bg-white rounded-lg px-2.5 py-1.5 text-sm outline-none border border-primary/40 resize-none focus:shadow-sm transition-all" />
                    <div className="flex gap-1.5 justify-end">
                      <button onClick={() => setEditingPost(null)} className="text-[10px] px-2.5 py-1 rounded-lg border border-border hover:bg-muted/20 transition-colors">Cancelar</button>
                      <button onClick={() => saveEdit(p.id)} className="text-[10px] px-2.5 py-1 rounded-lg bg-primary text-primary-foreground active:scale-95 transition flex items-center gap-1"><Check size={10} /> Guardar</button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{p.content}</p>
                )}
                <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <button onClick={() => handlePostVote(p.id, "up")}
                    className={`flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-lg border transition-all ${
                      p.myVote === "up" ? "text-primary bg-primary/10 border-primary/20" : "text-muted-foreground/50 border-transparent hover:text-primary hover:border-border/50"
                    }`}>
                    <ThumbsUp size={10} />{p.upvotes > 0 && <span className="tabular-nums">{p.upvotes}</span>}
                  </button>
                  <button onClick={() => handlePostVote(p.id, "down")}
                    className={`flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-lg border transition-all ${
                      p.myVote === "down" ? "text-destructive bg-destructive/10 border-destructive/20" : "text-muted-foreground/50 border-transparent hover:text-destructive hover:border-border/50"
                    }`}>
                    <ThumbsDown size={10} />{p.downvotes > 0 && <span className="tabular-nums">{p.downvotes}</span>}
                  </button>
                  {!isClosed && myId && (
                    <>
                      <button onClick={() => handleQuote(p)}
                        className="flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-lg border border-transparent text-muted-foreground/50 hover:text-primary hover:border-border/50 transition-all">
                        <Quote size={10} /> Citar
                      </button>
                      {myId === p.authorId && (
                        <>
                          <button onClick={() => handleEdit(p.id)}
                            className="flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-lg border border-transparent text-muted-foreground/50 hover:text-primary hover:border-border/50 transition-all">
                            <Edit3 size={10} />
                          </button>
                          <button onClick={() => handleDelete(p.id)}
                            className="flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-lg border border-transparent text-muted-foreground/50 hover:text-destructive hover:border-destructive/20 transition-all">
                            <Trash2 size={10} />
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Reply box */}
      {myId && !isClosed ? (
        <div className="space-y-2 pt-1">
          {quotePost && (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-primary/[0.03] border border-primary/20 text-xs">
              <Quote size={12} className="text-primary shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-primary/70 text-[10px] uppercase tracking-wider">@{quotePost.author}</span>
                <p className="text-muted-foreground/70 truncate mt-0.5">{quotePost.content}</p>
              </div>
              <button onClick={() => setQuotePost(null)} className="text-muted-foreground/40 hover:text-destructive shrink-0 transition-colors">
                <X size={12} />
              </button>
            </div>
          )}
          <textarea ref={replyRef} value={replyContent} onChange={e => setReplyContent(e.target.value)}
            placeholder={quotePost ? "Escribe tu respuesta…" : "Escribe un comentario…"}
            rows={2} maxLength={5000}
            onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); sendReply(); } }}
            className="w-full bg-white/70 rounded-xl px-3.5 py-2.5 text-sm outline-none border border-border/40 focus:border-primary/30 focus:shadow-sm transition-all resize-none placeholder:text-muted-foreground/40" />
          <div className="flex justify-between items-center">
            <span className="text-[8px] text-muted-foreground/30 uppercase tracking-wider">Cmd/Ctrl + Enter</span>
            <button disabled={busy || !replyContent.trim()} onClick={sendReply}
              className="flex items-center gap-1.5 h-8 px-4 rounded-lg bg-primary text-primary-foreground text-[10px] font-display tracking-widest disabled:opacity-40 active:scale-95 transition shadow-sm shadow-primary/20 hover:shadow-md">
              {busy ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} ENVIAR
            </button>
          </div>
        </div>
      ) : !myId ? (
        <div className="text-center text-[10px] text-muted-foreground/50 py-4 border border-dashed border-border/30 rounded-xl">
          Inicia sesión para participar en el foro.
        </div>
      ) : isClosed && (
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60 py-3 px-3.5 border border-border/30 rounded-xl bg-muted/10">
          <Lock size={11} className="shrink-0" /> Este hilo está cerrado. No se pueden añadir nuevos mensajes.
        </div>
      )}
    </div>
  );
}
