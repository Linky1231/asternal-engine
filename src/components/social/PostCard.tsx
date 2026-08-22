import { memo, useState } from "react";
import { toast } from "sonner";
import { Avatar } from "./Avatar";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { type PostWithMeta, toggleReaction, toggleRepost, deletePost, updatePost, reportContent, votePoll, isPlusActive } from "@/lib/social/api";
import { CommentSection } from "./CommentSection";
import { SharePostModal } from "./SharePostModal";
import { UserName } from "./UserName";
import { CardMenu, CardMenuItem, useCardMenuAnchor } from "./CardMenu";
import {
  Heart, Star, MessageCircle, Repeat2, MoreHorizontal, Pencil, Trash2, Flag, Share2,
  FileText, Download, Lock, Gamepad2, Code2, Link2,
} from "lucide-react";

function timeAgo(iso: string) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60); if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24); return `${d}d`;
}

export const PostCard = memo(function PostCard({
  post, myId, isMod, onChange,
}: {
  post: PostWithMeta; myId: string | null; isMod: boolean; onChange: () => void;
}) {
  const [openComments, setOpenComments] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [showHtml, setShowHtml] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const menu = useCardMenuAnchor<HTMLButtonElement>();

  const mine = myId === post.author_id;
  const canDelete = mine || isMod;
  const author = post.author;
  const authorPlus = isPlusActive(author);
  const frame = authorPlus ? author?.avatar_frame : null;

  // Entrance effect only during the first ~30s after publishing.
  const ageMs = Date.now() - new Date(post.created_at).getTime();
  const showEntrance = !!post.entrance_effect && authorPlus && ageMs < 30_000;
  const entranceClass = showEntrance ? `post-fx-${post.entrance_effect}` : "";

  const react = async (type: "like" | "favorite") => { await toggleReaction({ postId: post.id, type }); onChange(); };
  const repost = async () => { await toggleRepost(post.id); onChange(); };
  const remove = () => {
    toast("¿Eliminar publicación?", {
      description: "Esta acción no se puede deshacer.",
      action: {
        label: "Eliminar",
        onClick: async () => {
          setDeleting(true);
          try {
            await deletePost(post.id);
            toast.success("Publicación eliminada");
            onChange();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Error al borrar");
          } finally {
            setDeleting(false);
          }
        },
      },
    });
  };
  const saveEdit = async () => { await updatePost(post.id, { content: editContent }); setEditing(false); onChange(); };
  const report = () => {
    menu.close();
    toast("Reportar publicación", {
      description: "Señalará esta publicación a los moderadores.",
      action: {
        label: "Reportar",
        onClick: async () => {
          try {
            await reportContent({ postId: post.id, reason: "Reporte desde el feed" });
            toast.success("Reporte enviado");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Error al reportar");
          }
        },
      },
    });
  };
  const share = () => { setShowShare(true); menu.close(); };
  const vote = async (i: number) => {
    if (!post.poll) return;
    await votePoll(post.poll.id, i);
    onChange();
  };

  const avatarInner = <Avatar p={author} className="w-full h-full" />;

  const categoryChip = post.category ? (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
      {post.category}
    </span>
  ) : null;

  const postType = (post as Record<string, unknown>).post_type as string | undefined;
  const postTypeLabels: Record<string, { label: string; color: string }> = {
    update: { label: "Actualización", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
    progress: { label: "Progreso", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
    tutorial: { label: "Tutorial", color: "bg-violet-500/10 text-violet-600 border-violet-500/20" },
    question: { label: "Pregunta", color: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
    resource: { label: "Recurso", color: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20" },
    achievement: { label: "Logro", color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" },
    announcement: { label: "Anuncio", color: "bg-rose-500/10 text-rose-600 border-rose-500/20" },
  };
  const postTypeInfo = postType && postType !== "general" ? postTypeLabels[postType] : null;
  const postTypeLabel = postTypeInfo ? (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold border ${postTypeInfo.color}`}>
      {postTypeInfo.label}
    </div>
  ) : null;

  return (
    <article className={`group panel rounded-2xl border border-border/60 transition-[border-color,box-shadow] duration-200 ease-out pointer-fine:hover:border-primary/30 pointer-fine:hover:shadow-sm ${entranceClass}`}>
      {/* Hairline degradado superior */}
      <div className="h-[3px] w-full rounded-t-2xl grad-brand-fade opacity-70 pointer-fine:group-hover:opacity-100 transition-opacity duration-300" />

      <div className="p-3 space-y-3">
        <header className="flex items-center gap-2.5">
          <Link to="/profile/$userId" params={{ userId: post.author_id }}
            className="relative shrink-0 transition-transform duration-150 ease-out active:scale-95 pointer-fine:group-hover:scale-[1.06]">
            {frame ? (
              <div className="w-10 h-10 rounded-full p-[2px] " style={{ background: frameCss(frame) }}>
                <div className="w-full h-full rounded-full overflow-hidden bg-background font-display text-xs text-primary-glow">
                  {avatarInner}
                </div>
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full overflow-hidden ring-1 ring-line-strong shadow-xs">
                {avatarInner}
              </div>
            )}
          </Link>
          <Link to="/profile/$userId" params={{ userId: post.author_id }} className="flex-1 min-w-0 pointer-fine:hover:opacity-80 transition-opacity duration-300">
            <div className="flex items-center gap-1.5">
              <UserName p={author} size="sm" />
              {categoryChip}
            </div>
            <div className="text-[10px] font-mono text-ink-3 mt-0.5">
              @{author?.username ?? "?"} · <span className="text-primary font-medium">{timeAgo(post.created_at)}</span>
            </div>
          </Link>
          <button type="button" ref={menu.anchorRef} onClick={menu.toggle}
            className="w-8 h-8 rounded-lg border border-border text-primary-glow grid place-items-center transition-[transform,background-color,color] duration-150 ease-out pointer-fine:hover:bg-primary/10 pointer-fine:hover:text-primary active:scale-[0.94]"
            aria-label="Menú de la publicación">
            <MoreHorizontal size={15} />
          </button>
          <CardMenu rect={menu.rect} onClose={menu.close} width={164}>
            {mine && <CardMenuItem onClick={() => { setEditing(true); menu.close(); }} icon={<Pencil size={13} />}>Editar</CardMenuItem>}
            {canDelete && <CardMenuItem onClick={remove} danger icon={<Trash2 size={13} />}>Borrar</CardMenuItem>}
            {!mine && <CardMenuItem onClick={report} icon={<Flag size={13} />}>Reportar</CardMenuItem>}
            <CardMenuItem onClick={share} icon={<Share2 size={13} />}>Compartir</CardMenuItem>
          </CardMenu>
        </header>

        {postTypeLabel}

        {editing ? (
          <div className="space-y-2">
            <textarea value={editContent} onChange={e => setEditContent(e.target.value)} rows={3}
              className="w-full bg-input/40 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40" />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setEditing(false)}
                className="text-xs px-3.5 py-1.5 rounded-xl border border-border hover:bg-muted/40 transition-colors duration-200">Cancelar</button>
              <button type="button" onClick={saveEdit}
                className="text-xs px-3.5 py-1.5 rounded-xl bg-primary text-white active:scale-[0.96] transition-transform duration-300 ease-out">Guardar</button>
            </div>
          </div>
        ) : (
          post.content && (
            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words"
              style={post.text_color ? { color: post.text_color } : undefined}>
              {post.content}
            </p>
          )
        )}

        {post.signed_media.length > 0 && (
          <div className={`grid gap-1.5 ${post.signed_media.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
            {post.signed_media.map((url, i) => post.media_type === "video" ? (
              <div key={i} className="relative rounded-xl overflow-hidden bg-black border border-border/60">
                <video src={url} controls className="w-full max-h-[420px] bg-black" />
              </div>
            ) : (
              <div key={i} className="relative rounded-xl overflow-hidden bg-muted/40 border border-border/60 group/media">
                <img src={url} alt="" className="w-full max-h-[420px] object-cover transition-transform duration-500 ease-out pointer-fine:group-hover/media:scale-[1.02]" loading="lazy" />
              </div>
            ))}
          </div>
        )}

        {/* Documentos */}
        {post.signed_documents && post.signed_documents.length > 0 && (
          <div className="space-y-1.5">
            {post.signed_documents.map((d, i) => (
              <a key={i} href={d.url} target="_blank" rel="noreferrer" download={d.name}
                className="flex items-center gap-2.5 bg-muted/30 pointer-fine:hover:bg-primary/10 rounded-xl px-3 py-2.5 text-xs border border-border/50 pointer-fine:hover:border-primary/30 transition-[background-color,border-color] duration-300 ease-out group/doc">
                <span className="w-8 h-8 rounded-lg bg-primary/10 grid place-items-center shrink-0">
                  <FileText size={14} className="text-primary" />
                </span>
                <span className="flex-1 truncate font-medium">{d.name}</span>
                <Download size={13} className="text-muted-foreground pointer-fine:group-hover/doc:text-primary transition-colors duration-300" />
              </a>
            ))}
          </div>
        )}

        {/* HTML embebido */}
        {post.html_content && (
          <div className="border border-border rounded-xl overflow-hidden">
            <button type="button" onClick={() => setShowHtml(s => !s)}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs bg-muted/30 pointer-fine:hover:bg-muted/50 transition-colors duration-300">
              <Code2 size={13} className="text-primary" />
              <span className="flex-1 text-left font-medium">Contenido HTML {showHtml ? "(ocultar)" : "(mostrar)"}</span>
              <span className="text-muted-foreground transition-transform duration-300 ease-out" style={{ transform: showHtml ? "rotate(180deg)" : "none" }}>▼</span>
            </button>
            {showHtml && (
              <>
                <iframe srcDoc={post.html_content} sandbox="" className="w-full h-64 bg-white" title="html-content" />
                <div className="text-[9px] text-muted-foreground px-2 py-1 bg-muted/20">Contenido de terceros · sandbox seguro</div>
              </>
            )}
          </div>
        )}

        {/* Juego fijado */}
        {post.pinned_game && (
          <Link to="/" search={{ p: post.pinned_game.id } as never}
            className="group/game flex items-center gap-3 rounded-2xl p-2 pr-3 bg-primary/[0.04] border border-primary/20 pointer-fine:hover:border-primary/40 transition-[border-color,box-shadow] duration-300 ease-out pointer-fine:hover:shadow-md">
            {post.pinned_game.cover_url ? (
              <img src={post.pinned_game.cover_url} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0 ring-1 ring-border/50" />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-primary/10 border border-primary/20 grid place-items-center shrink-0">
                <Gamepad2 size={22} className="text-primary" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-[9px] font-display tracking-[0.18em] text-primary-glow uppercase">Juego fijado</div>
              <div className="text-sm font-display truncate mt-0.5">{post.pinned_game.title}</div>
            </div>
            <span className="w-7 h-7 rounded-full bg-primary/10 grid place-items-center text-primary-glow transition-transform duration-300 ease-out pointer-fine:group-hover/game:translate-x-0.5">▶</span>
          </Link>
        )}

        {/* Encuesta */}
        {post.poll && <PollView poll={post.poll} onVote={vote} />}

        {/* Contenido desbloqueable */}
        {post.locked_content && (
          <div className={`rounded-2xl border p-3.5 transition-[border-color,background-color] duration-500 ease-out ${post.is_unlocked ? "border-primary/40 bg-primary/[0.05]" : "border-dashed border-border bg-muted/20"}`}>
            <div className="flex items-center gap-2 text-[11px] font-display tracking-[0.15em] mb-2">
              <span className={`w-6 h-6 rounded-full grid place-items-center ${post.is_unlocked ? "bg-primary/15 text-primary-glow" : "bg-muted text-muted-foreground"}`}>
                <Lock size={11} />
              </span>
              {post.is_unlocked ? "DESBLOQUEADO" : "CONTENIDO OCULTO"}
            </div>
            {post.is_unlocked ? (
              <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{post.locked_content}</p>
            ) : (
              <div className="text-xs text-muted-foreground space-y-1.5">
                {post.unlock_reactions_goal && (
                  <div className="flex items-center gap-2">
                    <span className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <span className="block h-full bg-primary rounded-full transition-[width] duration-700 ease-out"
                        style={{ width: `${Math.min(100, Math.round(((post.likes + post.favorites) / post.unlock_reactions_goal) * 100))}%` }} />
                    </span>
                    <span className="tabular-nums">{post.likes + post.favorites} / {post.unlock_reactions_goal}</span>
                  </div>
                )}
                {post.unlock_at && (
                  <div className="flex items-center gap-1.5">🔓 Se desbloquea el {new Date(post.unlock_at).toLocaleString()}</div>
                )}
              </div>
            )}
          </div>
        )}

        {post.link_url && (
          <a href={post.link_url} target="_blank" rel="noreferrer"
            className="flex items-center gap-2 text-xs text-primary-glow hover:underline break-all transition-colors duration-300">
            <Link2 size={13} className="shrink-0" /> {post.link_url}
          </a>
        )}

        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {post.tags.map(t => (
              <span key={t}
                className="text-[10px] font-mono px-2 py-1 rounded-full bg-muted/40 text-muted-foreground border border-border/40 transition-[color,border-color] duration-300 ease-out pointer-fine:hover:text-primary-glow pointer-fine:hover:border-primary/30">
                #{t}
              </span>
            ))}
          </div>
        )}
      </div>

      <footer className="flex items-center border-t border-border/50 bg-muted/15 px-1 py-0.5 text-[11px] text-muted-foreground">
        <button type="button" onClick={() => react("like")}
          className={`flex-1 flex items-center justify-center gap-1.5 px-1 py-2 rounded-lg transition-[transform,color,background-color] duration-150 ease-out active:scale-[0.93] ${post.my_like ? "text-rose-500" : "pointer-fine:hover:bg-rose-500/10 pointer-fine:hover:text-rose-500"}`}>
          <motion.span
            key={post.my_like ? "liked" : "unliked"}
            initial={{ scale: 0.4, rotate: -18 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 520, damping: 17 }}
            className="inline-flex"
          >
            <Heart size={15} className={post.my_like ? "fill-rose-500" : ""} />
          </motion.span>
          <span className="tabular-nums font-medium">{post.likes}</span>
        </button>
        <button type="button" onClick={() => react("favorite")}
          className={`flex-1 flex items-center justify-center gap-1.5 px-1 py-2 rounded-lg transition-[transform,color,background-color] duration-150 ease-out active:scale-[0.93] ${post.my_favorite ? "text-amber-500" : "pointer-fine:hover:bg-amber-500/10 pointer-fine:hover:text-amber-500"}`}>
          <motion.span
            key={post.my_favorite ? "favd" : "unfavd"}
            initial={{ scale: 0.4, rotate: 18 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 520, damping: 17 }}
            className="inline-flex"
          >
            <Star size={15} className={post.my_favorite ? "fill-amber-500" : ""} />
          </motion.span>
          <span className="tabular-nums font-medium">{post.favorites}</span>
        </button>
        <button type="button" onClick={() => setOpenComments(o => !o)}
          className={`flex-1 flex items-center justify-center gap-1.5 px-1 py-2 rounded-lg transition-[transform,color,background-color] duration-150 ease-out active:scale-[0.93] ${openComments ? "text-primary-glow bg-primary/10" : "pointer-fine:hover:bg-primary/10 pointer-fine:hover:text-primary-glow"}`}>
          <MessageCircle size={15} className={openComments ? "fill-primary/20" : ""} />
          <span className="tabular-nums font-medium">{post.comments_count}</span>
        </button>
        <button type="button" onClick={repost}
          className={`flex-1 flex items-center justify-center gap-1.5 px-1 py-2 rounded-lg transition-[transform,color,background-color] duration-150 ease-out active:scale-[0.93] ${post.my_repost ? "text-emerald-600" : "pointer-fine:hover:bg-emerald-500/10 pointer-fine:hover:text-emerald-600"}`}>
          <motion.span
            key={post.my_repost ? "reposted" : "unreposted"}
            initial={{ scale: 0.6, rotate: -25 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 480, damping: 16 }}
            className="inline-flex"
          >
            <Repeat2 size={15} className={post.my_repost ? "stroke-emerald-600" : ""} />
          </motion.span>
          <span className="tabular-nums font-medium">{post.reposts_count}</span>
        </button>
      </footer>

      {openComments && <div className="border-t border-border/50 bg-muted/10 px-3 py-2.5"><CommentSection postId={post.id} myId={myId} isMod={isMod} onChange={onChange} /></div>}

      <SharePostModal postId={post.id} postContent={post.content} open={showShare} onClose={() => setShowShare(false)} />
    </article>
  );
});

function frameCss(id: string): string {
  switch (id) {
    case "aurora": return "linear-gradient(135deg, #1AA6D6, #2FD9D2, #7BE7FF)";
    case "ocean": return "linear-gradient(135deg, #0F6C9E, #1AA6D6, #2FD9D2)";
    case "ice": return "linear-gradient(135deg, #B8ECFF, #7BE7FF, #2FD9D2)";
    case "neon": return "linear-gradient(135deg, #2FD9D2, #B8ECFF, #1AA6D6)";
    default: return "linear-gradient(135deg, #1AA6D6, #2FD9D2)";
  }
}

function PollView({ poll, onVote }: { poll: NonNullable<PostWithMeta["poll"]>; onVote: (i: number) => void }) {
  const voted = poll.my_vote !== null;
  return (
    <div className="rounded-2xl border border-border bg-muted/20 p-3.5 space-y-2.5">
      <div className="flex items-start gap-2">
        <span className="w-7 h-7 rounded-lg bg-primary/10 grid place-items-center shrink-0 mt-0.5">
          <span className="text-primary-foreground text-[11px]">📊</span>
        </span>
        <div className="text-sm font-display leading-snug">{poll.question}</div>
      </div>
      {poll.options.map((opt, i) => {
        const count = poll.votes[i] ?? 0;
        const pct = poll.total ? Math.round((count / poll.total) * 100) : 0;
        const mine = poll.my_vote === i;
        return (
          <button key={i} onClick={() => onVote(i)}
            className={`relative w-full text-left rounded-xl overflow-hidden border transition-[transform,border-color,box-shadow] duration-300 ease-out active:scale-[0.98] ${mine ? "border-primary/50 shadow-sm" : "border-border/60 pointer-fine:hover:border-primary/30"}`}>
            {voted && (
              <div className="absolute inset-y-0 left-0 bg-primary/15 transition-[width] duration-700 ease-out"
                style={{ width: `${pct}%` }} />
            )}
            <div className="relative flex items-center justify-between px-3 py-2.5 text-xs gap-2">
              <span className={`flex items-center gap-2 ${mine ? "font-semibold text-primary-glow" : ""}`}>
                {mine && <span className="w-4 h-4 rounded-full bg-primary grid place-items-center"><span className="w-1.5 h-1.5 rounded-full bg-white" /></span>}
                {opt}
              </span>
              {voted && <span className="tabular-nums text-muted-foreground font-medium">{pct}% · {count}</span>}
            </div>
          </button>
        );
      })}
      <div className="text-[10px] text-muted-foreground flex items-center justify-between">
        <span>{poll.total} votos</span>
        {!voted && <span className="text-primary-glow/70">toca una opción para votar</span>}
      </div>
    </div>
  );
}
