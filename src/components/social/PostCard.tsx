import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { type PostWithMeta, toggleReaction, toggleRepost, deletePost, updatePost, reportContent, votePoll, isPlusActive } from "@/lib/social/api";
import { CommentSection } from "./CommentSection";
import { UserName } from "./UserName";
import { FileText, Download, Lock, Gamepad2, Code2 } from "lucide-react";

function timeAgo(iso: string) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60); if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24); return `${d}d`;
}

export function PostCard({
  post, myId, isMod, onChange,
}: {
  post: PostWithMeta; myId: string | null; isMod: boolean; onChange: () => void;
}) {
  const [openComments, setOpenComments] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showHtml, setShowHtml] = useState(false);

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
  const remove = async () => { if (!confirm("¿Borrar publicación?")) return; await deletePost(post.id); onChange(); };
  const saveEdit = async () => { await updatePost(post.id, { content: editContent }); setEditing(false); onChange(); };
  const report = async () => {
    const reason = prompt("Motivo del reporte:");
    if (!reason) return;
    await reportContent({ postId: post.id, reason });
    alert("Reporte enviado");
    setMenuOpen(false);
  };
  const share = async () => {
    const url = window.location.origin + "/feed?p=" + post.id;
    try { await navigator.share({ url, text: post.content.slice(0, 80) }); }
    catch { navigator.clipboard.writeText(url); alert("Enlace copiado"); }
  };
  const vote = async (i: number) => {
    if (!post.poll) return;
    await votePoll(post.poll.id, i);
    onChange();
  };

  const avatarInner = (
    <>
      {author?.avatar_url ? (
        <img src={author.avatar_url} alt="" className="w-full h-full object-cover" />
      ) : (
        <span className="grid place-items-center w-full h-full">
          {(author?.display_name ?? author?.username ?? "?")[0]?.toUpperCase()}
        </span>
      )}
    </>
  );

  return (
    <article className={`panel rounded-xl p-3 border border-border/40 space-y-2 ${entranceClass}`}>
      <header className="flex items-center gap-2">
        <Link to="/profile/$userId" params={{ userId: post.author_id }}
          className="relative shrink-0">
          {frame ? (
            <div className="w-10 h-10 rounded-full p-[2px]" style={{ background: frameCss(frame) }}>
              <div className="w-full h-full rounded-full overflow-hidden bg-background font-display text-xs text-primary-glow">
                {avatarInner}
              </div>
            </div>
          ) : (
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/40 to-accent/30 grid place-items-center font-display text-xs text-primary-glow overflow-hidden">
              {avatarInner}
            </div>
          )}
        </Link>
        <Link to="/profile/$userId" params={{ userId: post.author_id }} className="flex-1 min-w-0 hover:opacity-80">
          <UserName p={author} size="sm" />
          <div className="text-[10px] font-mono text-muted-foreground">@{author?.username ?? "?"} · {timeAgo(post.created_at)}{post.category ? ` · ${post.category}` : ""}</div>
        </Link>
        <div className="relative">
          <button onClick={() => setMenuOpen(o => !o)} className="w-8 h-8 rounded-md border border-border text-muted-foreground">⋯</button>
          {menuOpen && (
            <div className="absolute right-0 top-9 z-10 panel border border-border rounded-md p-1 min-w-[140px] text-xs">
              {mine && <button onClick={() => { setEditing(true); setMenuOpen(false); }} className="block w-full text-left px-2 py-1.5 hover:bg-muted/40">Editar</button>}
              {canDelete && <button onClick={remove} className="block w-full text-left px-2 py-1.5 text-destructive hover:bg-muted/40">Borrar</button>}
              {!mine && <button onClick={report} className="block w-full text-left px-2 py-1.5 hover:bg-muted/40">Reportar</button>}
              <button onClick={share} className="block w-full text-left px-2 py-1.5 hover:bg-muted/40">Compartir</button>
            </div>
          )}
        </div>
      </header>

      {editing ? (
        <div className="space-y-2">
          <textarea value={editContent} onChange={e => setEditContent(e.target.value)} rows={3} className="w-full bg-input/40 rounded p-2 text-sm" />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setEditing(false)} className="text-xs px-3 py-1.5 rounded border border-border">Cancelar</button>
            <button onClick={saveEdit} className="text-xs px-3 py-1.5 rounded bg-primary text-primary-foreground">Guardar</button>
          </div>
        </div>
      ) : (
        post.content && (
          <p className="text-sm whitespace-pre-wrap break-words"
            style={post.text_color ? { color: post.text_color } : undefined}>
            {post.content}
          </p>
        )
      )}

      {post.signed_media.length > 0 && (
        <div className={`grid gap-1 ${post.signed_media.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
          {post.signed_media.map((url, i) => post.media_type === "video" ? (
            <video key={i} src={url} controls className="rounded-md w-full max-h-[420px] bg-black" />
          ) : (
            <img key={i} src={url} alt="" className="rounded-md w-full max-h-[420px] object-cover" loading="lazy" />
          ))}
        </div>
      )}

      {/* Documentos */}
      {post.signed_documents && post.signed_documents.length > 0 && (
        <div className="space-y-1.5">
          {post.signed_documents.map((d, i) => (
            <a key={i} href={d.url} target="_blank" rel="noreferrer" download={d.name}
              className="flex items-center gap-2 bg-muted/30 hover:bg-muted/50 rounded-xl px-3 py-2 text-xs transition">
              <FileText size={14} className="text-primary shrink-0" />
              <span className="flex-1 truncate">{d.name}</span>
              <Download size={13} className="text-muted-foreground" />
            </a>
          ))}
        </div>
      )}

      {/* HTML embebido */}
      {post.html_content && (
        <div className="border border-border rounded-xl overflow-hidden">
          <button onClick={() => setShowHtml(s => !s)}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs bg-muted/30 hover:bg-muted/50">
            <Code2 size={13} />
            <span className="flex-1 text-left">Contenido HTML {showHtml ? "(ocultar)" : "(mostrar)"}</span>
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
          className="flex items-center gap-3 border border-primary/30 rounded-xl p-2 bg-primary/5 hover:bg-primary/10 transition">
          {post.pinned_game.cover_url ? (
            <img src={post.pinned_game.cover_url} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" />
          ) : (
            <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-primary/30 to-accent/30 grid place-items-center shrink-0">
              <Gamepad2 size={22} className="text-primary-glow" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-mono text-muted-foreground">JUEGO FIJADO</div>
            <div className="text-sm font-display truncate">{post.pinned_game.title}</div>
          </div>
          <div className="text-xs text-primary-glow">▶</div>
        </Link>
      )}

      {/* Encuesta */}
      {post.poll && <PollView poll={post.poll} onVote={vote} />}

      {/* Contenido desbloqueable */}
      {post.locked_content && (
        <div className={`rounded-xl border p-3 ${post.is_unlocked ? "border-primary/40 bg-primary/5" : "border-border bg-muted/30"}`}>
          <div className="flex items-center gap-2 text-[11px] font-display tracking-widest mb-1.5">
            <Lock size={12} />
            {post.is_unlocked ? "DESBLOQUEADO" : "CONTENIDO OCULTO"}
          </div>
          {post.is_unlocked ? (
            <p className="text-sm whitespace-pre-wrap break-words">{post.locked_content}</p>
          ) : (
            <div className="text-xs text-muted-foreground space-y-1">
              {post.unlock_reactions_goal && (
                <div>Reacciones: {post.likes + post.favorites} / {post.unlock_reactions_goal}</div>
              )}
              {post.unlock_at && (
                <div>Se desbloquea el {new Date(post.unlock_at).toLocaleString()}</div>
              )}
            </div>
          )}
        </div>
      )}

      {post.link_url && (
        <a href={post.link_url} target="_blank" rel="noreferrer" className="block text-xs text-primary-glow underline break-all">
          🔗 {post.link_url}
        </a>
      )}

      {post.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {post.tags.map(t => <span key={t} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted/40 text-muted-foreground">#{t}</span>)}
        </div>
      )}

      <footer className="flex items-center justify-between gap-0.5 pt-1 text-[11px] text-muted-foreground">
        <button onClick={() => react("like")} className={`flex-1 flex items-center justify-center gap-1 px-1 py-1.5 rounded-md transition-colors ${post.my_like ? "text-primary-glow" : "hover:bg-muted/40"}`}>♥ <span className="tabular-nums">{post.likes}</span></button>
        <button onClick={() => react("favorite")} className={`flex-1 flex items-center justify-center gap-1 px-1 py-1.5 rounded-md transition-colors ${post.my_favorite ? "text-primary-glow" : "hover:bg-muted/40"}`}>★ <span className="tabular-nums">{post.favorites}</span></button>
        <button onClick={() => setOpenComments(o => !o)} className="flex-1 flex items-center justify-center gap-1 px-1 py-1.5 rounded-md transition-colors hover:bg-muted/40">💬 <span className="tabular-nums">{post.comments_count}</span></button>
        <button onClick={repost} className={`flex-1 flex items-center justify-center gap-1 px-1 py-1.5 rounded-md transition-colors ${post.my_repost ? "text-primary-glow" : "hover:bg-muted/40"}`}>↻ <span className="tabular-nums">{post.reposts_count}</span></button>
      </footer>

      {openComments && <CommentSection postId={post.id} myId={myId} isMod={isMod} onChange={onChange} />}
    </article>
  );
}

function PollView({ poll, onVote }: { poll: NonNullable<PostWithMeta["poll"]>; onVote: (i: number) => void }) {
  const voted = poll.my_vote !== null;
  return (
    <div className="border border-border rounded-xl p-3 bg-muted/20 space-y-2">
      <div className="text-sm font-display">{poll.question}</div>
      {poll.options.map((opt, i) => {
        const count = poll.votes[i] ?? 0;
        const pct = poll.total ? Math.round((count / poll.total) * 100) : 0;
        const mine = poll.my_vote === i;
        return (
          <button key={i} onClick={() => onVote(i)}
            className={`relative w-full text-left rounded-lg overflow-hidden border transition ${mine ? "border-primary" : "border-border"} active:scale-[0.99]`}>
            {voted && (
              <div className="absolute inset-y-0 left-0 bg-primary/15" style={{ width: `${pct}%` }} />
            )}
            <div className="relative flex items-center justify-between px-3 py-2 text-xs">
              <span className={mine ? "font-semibold" : ""}>{opt}</span>
              {voted && <span className="tabular-nums text-muted-foreground">{pct}% · {count}</span>}
            </div>
          </button>
        );
      })}
      <div className="text-[10px] text-muted-foreground">{poll.total} votos{voted ? "" : " · toca una opción para votar"}</div>
    </div>
  );
}

function frameCss(id: string): string {
  switch (id) {
    case "aurora": return "linear-gradient(135deg, #1AA6D6, #2FD9D2, #7BE7FF)";
    case "ocean": return "linear-gradient(135deg, #0F6C9E, #1AA6D6, #2FD9D2)";
    case "ice": return "linear-gradient(135deg, #B8ECFF, #7BE7FF, #2FD9D2)";
    case "neon": return "linear-gradient(135deg, #2FD9D2, #B8ECFF, #1AA6D6)";
    default: return "linear-gradient(135deg, #1AA6D6, #2FD9D2)";
  }
}
