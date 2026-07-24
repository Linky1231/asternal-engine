import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  initForumCategories, getForumCategories, getForumThreads, getForumThread,
  createForumThread, createForumPost, getForumPosts, deleteForumThread,
  deleteForumPost, editForumPost, voteForumPost, togglePinThread,
  toggleCloseThread, incrementThreadView, searchForumThreads,
  type ForumCategory, type ForumThread, type ForumPost,
} from "@/lib/social/forum-storage";
import {
  MessageSquare, Pin, Lock, ArrowLeft, Plus, ThumbsUp, ThumbsDown,
  Reply, Quote, Trash2, Edit3, Send, Loader2, Eye, Clock, Hash,
  X, Check, BookMarked, AlertTriangle, MessageCircle, Search,
  Globe, LifeBuoy, Trophy, Coffee, MessageCircleMore,
} from "lucide-react";

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

/* ─── User avatar mini ─── */
function AvatarMini({ username }: { username: string }) {
  return (
    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 grid place-items-center text-[10px] font-display font-semibold text-primary shrink-0">
      {username[0]?.toUpperCase() ?? "?"}
    </div>
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
    <div className="space-y-3 animate-in fade-in duration-300">
      {view.type === "categories" && <CategoryListView onSelect={(id, name) => setView({ type: "threads", categoryId: id, categoryName: name })} />}
      {view.type === "threads" && (
        <ThreadListView
          categoryId={view.categoryId}
          categoryName={view.categoryName}
          myId={myId}
          myUsername={myUsername}
          adminOrMod={adminOrMod}
          onBack={() => setView({ type: "categories" })}
          onSelect={(threadId) => setView({ type: "thread", threadId })}
        />
      )}
      {view.type === "thread" && (
        <ThreadDetailView
          threadId={view.threadId}
          myId={myId}
          myUsername={myUsername}
          adminOrMod={adminOrMod}
          onBack={() => setView({ type: "categories" })}
          onCategoryBack={(catId, catName) => setView({ type: "threads", categoryId: catId, categoryName: catName })}
        />
      )}
    </div>
  );
}

/* ─── Category List ─── */
function CategoryListView({ onSelect }: { onSelect: (id: string, name: string) => void }) {
  const cats = initForumCategories();
  return (
    <div className="space-y-2">
      <div className="text-[10px] font-display tracking-[0.2em] text-muted-foreground/60 flex items-center gap-2 px-1">
        <Hash size={12} /> CATEGORÍAS
      </div>
      <div className="grid gap-1.5">
        {cats.map((cat, i) => (
          <button key={cat.id}
            onClick={() => onSelect(cat.id, cat.name)}
            className="group w-full text-left p-3 rounded-xl border border-border/50 bg-white/40 hover:bg-white/80 hover:border-primary/30 transition-all duration-300 active:scale-[0.99]"
            style={{ animation: `fade-in-up 500ms ${i * 60}ms cubic-bezier(0.16,1,0.3,1) both` }}>
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-lg bg-primary/10 grid place-items-center shrink-0 text-primary">
                {CAT_ICONS[cat.icon] ?? <MessageSquare size={16} />}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-display font-semibold text-foreground group-hover:text-primary transition-colors">{cat.name}</div>
                <div className="text-[10px] text-muted-foreground/70 mt-0.5">{cat.description}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs font-display tabular-nums text-primary">{cat.threadCount}</div>
                <div className="text-[9px] text-muted-foreground/50">hilos</div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Thread List ─── */
function ThreadListView({
  categoryId, categoryName, myId, myUsername, adminOrMod, onBack, onSelect,
}: {
  categoryId: string; categoryName: string; myId: string | null; myUsername: string; adminOrMod: boolean;
  onBack: () => void; onSelect: (threadId: string) => void;
}) {
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [searchQ, setSearchQ] = useState("");

  const load = () => setThreads(searchQ ? searchForumThreads(searchQ, categoryId) : getForumThreads(categoryId));
  useEffect(load, [categoryId, searchQ]);

  const create = async () => {
    if (!title.trim() || !content.trim() || !myId) return;
    setBusy(true);
    createForumThread(categoryId, title, content, { id: myId, username: myUsername });
    setTitle(""); setContent(""); setShowNew(false); setBusy(false);
    load();
  };

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="w-8 h-8 rounded-lg border border-border grid place-items-center active:scale-95 transition shrink-0">
          <ArrowLeft size={14} />
        </button>
        <div className="flex-1 text-sm font-display font-semibold truncate">{categoryName}</div>
        {myId && (
          <button onClick={() => setShowNew(s => !s)}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-[10px] font-display tracking-widest active:scale-95 transition">
            <Plus size={13} /> NUEVO HILO
          </button>
        )}
      </div>

      {/* Search bar */}
      <div className="flex items-center gap-2 bg-input/40 rounded-xl px-3 py-1.5 border border-border/40">
        <Search size={14} className="text-muted-foreground shrink-0" />
        <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
          placeholder="Buscar hilos…"
          className="flex-1 bg-transparent text-xs outline-none py-1" />
        {searchQ && (
          <button onClick={() => setSearchQ("")} className="text-muted-foreground/50 hover:text-muted-foreground">
            <X size={12} />
          </button>
        )}
      </div>

      {/* New thread form */}
      {showNew && (
        <div className="p-3 rounded-xl border border-primary/30 bg-primary/[0.02] space-y-2">
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Título del hilo…"
            maxLength={120}
            className="w-full bg-white/60 rounded-lg px-3 py-2 text-sm outline-none border border-border/50 focus:border-primary/40" />
          <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Escribe tu mensaje…"
            rows={4} maxLength={5000}
            className="w-full bg-white/60 rounded-lg px-3 py-2 text-sm outline-none border border-border/50 focus:border-primary/40 resize-none" />
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowNew(false)} className="px-3 py-1.5 rounded-lg border border-border text-[11px]">Cancelar</button>
            <button disabled={busy || !title.trim() || !content.trim()} onClick={create}
              className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-[11px] font-display tracking-widest disabled:opacity-40 active:scale-95 transition flex items-center gap-1.5">
              {busy ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} PUBLICAR
            </button>
          </div>
        </div>
      )}

      {/* Thread list */}
      <div className="space-y-1">
        {threads.length === 0 ? (
          <div className="text-center text-xs text-muted-foreground py-10">
            {searchQ ? "No se encontraron hilos." : (myId ? "No hay hilos aún. ¡Crea el primero!" : "Inicia sesión para ver y crear hilos.")}
          </div>
        ) : threads.map(t => (
          <button key={t.id} onClick={() => onSelect(t.id)}
            className="group w-full text-left p-3 rounded-xl border border-border/40 bg-white/40 hover:bg-white/80 hover:border-primary/20 transition-all active:scale-[0.99]">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 grid place-items-center shrink-0 text-[11px] font-display">
                {t.authorUsername[0]?.toUpperCase() ?? "?"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  {t.pinned && <Pin size={11} className="text-primary shrink-0" />}
                  {t.closed && <Lock size={11} className="text-destructive/60 shrink-0" />}
                  <span className="text-sm font-display font-medium truncate group-hover:text-primary transition-colors">{t.title}</span>
                </div>
                <div className="text-[10px] text-muted-foreground/70 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                  <span>@{t.authorUsername}</span>
                  <span className="flex items-center gap-1"><Clock size={9} />{timeAgo(t.createdAt)}</span>
                  <span className="flex items-center gap-1"><MessageSquare size={9} />{t.postCount}</span>
                  <span className="flex items-center gap-1"><Eye size={9} />{t.views}</span>
                </div>
              </div>
              <div className="text-[10px] text-muted-foreground/50 text-right shrink-0 hidden sm:block">
                <div>último</div>
                <div>{timeAgo(t.lastPostAt)}</div>
              </div>
            </div>
          </button>
        ))}
      </div>
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
  const thread = getForumThread(threadId);
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [replyContent, setReplyContent] = useState("");
  const [quotePost, setQuotePost] = useState<{ id: string; content: string; author: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingPost, setEditingPost] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const replyRef = useRef<HTMLTextAreaElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const isOwner = myId === thread?.authorId;
  const isClosed = thread?.closed ?? false;
  const canPin = isOwner || adminOrMod;

  const loadPosts = () => setPosts(getForumPosts(threadId));
  useEffect(() => {
    incrementThreadView(threadId);
    loadPosts();
  }, [threadId]);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [posts.length]);

  const sendReply = async () => {
    if (!replyContent.trim() || !myId || isClosed) return;
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
    loadPosts();
  };

  const handleVote = async (postId: string, vote: "up" | "down") => {
    if (!myId) return;
    voteForumPost(postId, myId, vote);
    loadPosts();
  };

  const handleEdit = async (postId: string) => {
    if (!editContent.trim()) return;
    editForumPost(postId, editContent);
    setEditingPost(null);
    loadPosts();
  };

  const handleDelete = async (postId: string) => {
    if (!confirm("¿Borrar este mensaje?")) return;
    deleteForumPost(postId);
    loadPosts();
  };

  const handleQuote = (p: ForumPost) => {
    setQuotePost({ id: p.id, content: p.content.slice(0, 300), author: p.authorUsername });
    replyRef.current?.focus();
  };

  const cats = getForumCategories();
  const cat = cats.find(c => c.id === thread?.categoryId);
  const catIcon = cat ? CAT_ICONS[cat.icon] ?? <MessageSquare size={14} /> : <MessageSquare size={14} />;

  if (!thread) return (
    <div className="text-center text-xs text-muted-foreground py-10">
      Hilo no encontrado.
      <button onClick={onBack} className="block mx-auto mt-2 text-primary underline">Volver</button>
    </div>
  );

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="w-8 h-8 rounded-lg border border-border grid place-items-center active:scale-95 transition shrink-0">
          <ArrowLeft size={14} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {thread.pinned && <Pin size={12} className="text-primary shrink-0" />}
            {thread.closed && <Lock size={12} className="text-destructive/60 shrink-0" />}
            <h3 className="text-sm font-display font-semibold truncate">{thread.title}</h3>
          </div>
          <button onClick={() => onCategoryBack(thread.categoryId, cat?.name ?? "Foros")}
            className="text-[10px] text-muted-foreground/60 hover:text-primary transition-colors flex items-center gap-1">
            <ArrowLeft size={10} /> {catIcon} {cat?.name ?? "Foros"}
          </button>
        </div>
        {isOwner && !isClosed && (
          <button onClick={() => { toggleCloseThread(threadId); loadPosts(); }}
            className="h-8 px-2.5 rounded-lg border border-border text-[10px] flex items-center gap-1 active:scale-95 transition">
            <Lock size={11} /> CERRAR
          </button>
        )}
      </div>

      {/* Thread body */}
      <div ref={contentRef} className="space-y-2 max-h-[60vh] overflow-y-auto pr-1 no-scrollbar">
        {/* First post — thread content */}
        <div className="p-3 rounded-xl border border-border/50 bg-white/40">
          <div className="flex items-center gap-2 mb-2">
            <AvatarMini username={thread.authorUsername} />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-display font-semibold">@{thread.authorUsername}</div>
              <div className="text-[9px] text-muted-foreground/60">{timeAgo(thread.createdAt)}</div>
            </div>
            {/* Only admin/owner can pin */}
            {canPin && (
              <button onClick={() => { togglePinThread(threadId); loadPosts(); }}
                className="text-[10px] text-muted-foreground/60 hover:text-primary flex items-center gap-1 px-2 py-1 rounded-lg border border-border/30 active:scale-95 transition">
                <Pin size={10} /> {thread.pinned ? "DESFIJAR" : "FIJAR"}
              </button>
            )}
          </div>
          <p className="text-sm whitespace-pre-wrap break-words">{thread.content}</p>
        </div>

        {/* Replies */}
        {posts.filter(p => p.id !== posts[0]?.id).map(p => (
          <div key={p.id} className="p-3 rounded-xl border border-border/40 bg-white/40 hover:bg-white/60 transition-colors group">
            {p.quoteContent && (
              <div className="mb-2 pl-3 border-l-2 border-primary/30 bg-primary/[0.02] rounded-r-md py-1.5 px-2 text-xs text-muted-foreground">
                <span className="text-[10px] font-semibold text-primary/70">@{p.quoteAuthor} escribió:</span>
                <p className="mt-0.5 italic line-clamp-2">{p.quoteContent}</p>
              </div>
            )}
            <div className="flex gap-2">
              <AvatarMini username={p.authorUsername} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-display font-semibold">@{p.authorUsername}</span>
                  <span className="text-[9px] text-muted-foreground/50">{timeAgo(p.createdAt)}</span>
                  {p.editedAt && <span className="text-[8px] text-muted-foreground/40">(editado)</span>}
                </div>
                {editingPost === p.id ? (
                  <div className="space-y-1.5">
                    <textarea value={editContent} onChange={e => setEditContent(e.target.value)}
                      rows={3} className="w-full bg-white rounded-lg px-2 py-1.5 text-sm outline-none border border-primary/40 resize-none" />
                    <div className="flex gap-1.5 justify-end">
                      <button onClick={() => setEditingPost(null)} className="text-[10px] px-2 py-1 rounded border border-border">Cancelar</button>
                      <button onClick={() => handleEdit(p.id)} className="text-[10px] px-2 py-1 rounded bg-primary text-primary-foreground"><Check size={10} /> Guardar</button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap break-words">{p.content}</p>
                )}
                <div className="flex items-center gap-1.5 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleVote(p.id, "up")}
                    className={`flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded ${p.myVote === "up" ? "text-primary bg-primary/10" : "text-muted-foreground/60 hover:text-primary"}`}>
                    <ThumbsUp size={10} />{p.upvotes > 0 && <span className="tabular-nums">{p.upvotes}</span>}
                  </button>
                  <button onClick={() => handleVote(p.id, "down")}
                    className={`flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded ${p.myVote === "down" ? "text-destructive bg-destructive/10" : "text-muted-foreground/60 hover:text-destructive"}`}>
                    <ThumbsDown size={10} />{p.downvotes > 0 && <span className="tabular-nums">{p.downvotes}</span>}
                  </button>
                  {!isClosed && myId && (
                    <>
                      <button onClick={() => handleQuote(p)}
                        className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded text-muted-foreground/60 hover:text-primary transition-colors">
                        <Quote size={10} /> Citar
                      </button>
                      {myId === p.authorId && (
                        <>
                          <button onClick={() => { setEditingPost(p.id); setEditContent(p.content); }}
                            className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded text-muted-foreground/60 hover:text-primary transition-colors">
                            <Edit3 size={10} />
                          </button>
                          <button onClick={() => handleDelete(p.id)}
                            className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded text-muted-foreground/60 hover:text-destructive transition-colors">
                            <Trash2 size={10} />
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Reply box */}
      {myId && !isClosed ? (
        <div className="space-y-2 pt-1">
          {quotePost && (
            <div className="flex items-start gap-2 p-2 rounded-lg bg-primary/[0.03] border border-primary/20 text-xs">
              <Quote size={12} className="text-primary shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-primary/70">@{quotePost.author}</span>
                <p className="text-muted-foreground truncate mt-0.5">{quotePost.content}</p>
              </div>
              <button onClick={() => setQuotePost(null)} className="text-muted-foreground/50 hover:text-destructive shrink-0">
                <X size={12} />
              </button>
            </div>
          )}
          <textarea ref={replyRef} value={replyContent} onChange={e => setReplyContent(e.target.value)}
            placeholder={quotePost ? "Escribe tu respuesta…" : "Escribe un comentario…"}
            rows={2} maxLength={5000}
            onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); sendReply(); } }}
            className="w-full bg-white/60 rounded-xl px-3 py-2 text-sm outline-none border border-border/50 focus:border-primary/40 resize-none transition-colors" />
          <div className="flex justify-between items-center">
            <span className="text-[9px] text-muted-foreground/40">Cmd/Ctrl + Enter para enviar</span>
            <button disabled={busy || !replyContent.trim()} onClick={sendReply}
              className="flex items-center gap-1.5 h-8 px-4 rounded-lg bg-primary text-primary-foreground text-[10px] font-display tracking-widest disabled:opacity-40 active:scale-95 transition">
              {busy ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} ENVIAR
            </button>
          </div>
        </div>
      ) : !myId ? (
        <div className="text-center text-xs text-muted-foreground py-3 border border-dashed border-border/50 rounded-xl">
          Inicia sesión para participar en el foro.
        </div>
      ) : isClosed && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-3 px-3 border border-border/40 rounded-xl bg-muted/20">
          <Lock size={12} /> Este hilo está cerrado. No se pueden añadir nuevos mensajes.
        </div>
      )}
    </div>
  );
}
