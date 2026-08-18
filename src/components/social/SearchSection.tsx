import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Search, X, Gamepad2, Newspaper, Users, MessageSquare, FolderOpen,
  Palette, Trophy, Loader2, ChevronRight, FileText, Image, Film,
  Hash, Clock, Sparkles, MessageCircle,
} from "lucide-react";
import { Avatar } from "./Avatar";
import { supabase } from "@/integrations/supabase/client";
import { fetchGames, fetchFeed, fetchArtworks, fetchEvents, type PostWithMeta, type Profile } from "@/lib/social/api";
import {
  buildChannels, searchMessages, searchUsers, searchProjects, searchFiles,
  messagePreview, type SearchChannel, type SearchMessage, type SearchProject,
} from "@/lib/social/global-search";
import { searchForumThreads, type ForumThread } from "@/lib/social/forum-storage";
import type { WorkFile } from "@/lib/social/work";

/* ─── Types ─── */
type Tab = "all" | "games" | "posts" | "users" | "messages" | "files" | "gallery" | "forums" | "events";

interface SearchResult {
  games: PostWithMeta[];
  posts: PostWithMeta[];
  users: Profile[];
  messages: SearchMessage[];
  files: WorkFile[];
  gallery: PostWithMeta[];
  forums: ForumThread[];
  events: { id: string; title: string; starts_at: string }[];
}

/* ─── Helpers ─── */
function timeAgo(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60); if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24); if (d < 30) return `${d}d`;
  return new Date(iso).toLocaleDateString();
}

function extractTitle(content: string): string {
  return (content.split("\n")[0] || "Sin título").replace(/^[🎮🎨]\s*/, "").trim() || "Sin título";
}

function TabButton({ active, onClick, icon, label, count }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string; count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 h-8 rounded-lg text-[11px] font-medium transition-colors duration-200 ${
        active
          ? "grad-brand text-primary-foreground"
          : "bg-card border border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/20"
      }`}
    >
      {icon} {label}
      {typeof count === "number" && count > 0 && (
        <span className={`ml-0.5 text-[9px] font-mono ${active ? "text-primary-foreground/70" : "text-muted-foreground/60"}`}>
          {count}
        </span>
      )}
    </button>
  );
}

/* ─── Section Header ─── */
function SectionHeader({ icon, label, count }: { icon: React.ReactNode; label: string; count: number }) {
  return (
    <div className="flex items-center gap-2 pt-4 pb-2 first:pt-0">
      <span className="text-primary shrink-0">{icon}</span>
      <span className="font-display text-sm font-semibold text-foreground">{label}</span>
      <span className="text-[10px] font-mono text-muted-foreground">{count}</span>
      <div className="flex-1 h-px bg-border/40" />
    </div>
  );
}

/* ─── Game Row ─── */
function GameRow({ post }: { post: PostWithMeta }) {
  const title = extractTitle(post.content);
  return (
    <Link
      to="/"
      className="flex items-center gap-3 p-3 rounded-xl border border-border/40 bg-card hover:border-primary/20 transition-colors group"
    >
      <div className="relative w-12 h-12 shrink-0 rounded-lg overflow-hidden border border-border/50 bg-surface">
        {post.signed_cover ? (
          <img src={post.signed_cover} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full grid place-items-center text-muted-foreground/40">
            <Gamepad2 size={18} />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold truncate group-hover:text-primary transition-colors">{title}</div>
        <div className="text-[10px] font-mono text-muted-foreground truncate">
          @{post.author?.username ?? "jugador"} · {post.likes} likes
        </div>
      </div>
      <ChevronRight size={14} className="text-muted-foreground/30 shrink-0" />
    </Link>
  );
}

/* ─── Post Row ─── */
function PostRow({ post }: { post: PostWithMeta }) {
  return (
    <Link
      to="/"
      className="flex items-start gap-3 p-3 rounded-xl border border-border/40 bg-card hover:border-primary/20 transition-colors group"
    >
      <Avatar p={post.author} size={32} className="shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-foreground/80 truncate">{post.author?.display_name || post.author?.username}</span>
          <span className="text-[9px] font-mono text-muted-foreground/50">@{post.author?.username}</span>
          <span className="text-[9px] text-muted-foreground/40">{timeAgo(post.created_at)}</span>
        </div>
        <p className="text-[12px] text-foreground/70 mt-1 line-clamp-2 leading-relaxed">{post.content}</p>
        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground/50">
          {post.likes > 0 && <span className="flex items-center gap-1">♥ {post.likes}</span>}
          {post.comments_count > 0 && <span className="flex items-center gap-1">💬 {post.comments_count}</span>}
          {post.media_type === "image" && <Image size={10} />}
          {post.media_type === "video" && <Film size={10} />}
        </div>
      </div>
    </Link>
  );
}

/* ─── User Row ─── */
function UserRow({ user }: { user: Profile }) {
  return (
    <Link
      to="/profile/$userId"
      params={{ userId: user.id }}
      className="flex items-center gap-3 p-3 rounded-xl border border-border/40 bg-card hover:border-primary/20 transition-colors group"
    >
      <Avatar p={user} size={36} className="shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold truncate group-hover:text-primary transition-colors">
          {user.display_name || user.username}
        </div>
        <div className="text-[10px] font-mono text-muted-foreground truncate">@{user.username}</div>
        {user.bio && (
          <div className="text-[11px] text-muted-foreground/60 mt-0.5 line-clamp-1">{user.bio}</div>
        )}
      </div>
      {typeof user.orbes === "number" && user.show_orbes !== false && (
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-mono shrink-0">
          <Sparkles size={9} fill="currentColor" /> {user.orbes}
        </div>
      )}
    </Link>
  );
}

/* ─── Message Row ─── */
function MessageRow({ msg, channels, senders }: {
  msg: SearchMessage; channels: SearchChannel[]; senders: Map<string, Profile>;
}) {
  const ch = channels.find(c => c.id === msg.chat_id);
  const sender = msg.sender_id ? senders.get(msg.sender_id) : null;
  const preview = messagePreview(msg);
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl border border-border/40 bg-card">
      <Avatar p={sender} size={28} className="shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-foreground/80 truncate">
            {sender?.display_name || sender?.username || "Anónimo"}
          </span>
          {ch && (
            <span className="flex items-center gap-1 text-[9px] font-mono text-muted-foreground/50">
              <MessageCircle size={8} /> {ch.name}
            </span>
          )}
          <span className="text-[9px] text-muted-foreground/40">{timeAgo(msg.created_at)}</span>
        </div>
        <p className="text-[12px] text-foreground/70 mt-1 line-clamp-2 leading-relaxed">{preview}</p>
      </div>
    </div>
  );
}

/* ─── File Row ─── */
function FileRow({ file }: { file: WorkFile }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-border/40 bg-card">
      <div className="w-10 h-10 shrink-0 rounded-lg bg-surface border border-border/50 grid place-items-center">
        <FileText size={16} className="text-muted-foreground/60" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium truncate">{file.name}</div>
        <div className="text-[10px] text-muted-foreground truncate">
          {file.uploaded_by_name || "Desconocido"} · {new Date(file.created_at).toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}

/* ─── Gallery Row ─── */
function GalleryRow({ post }: { post: PostWithMeta }) {
  const title = extractTitle(post.content);
  return (
    <Link
      to="/"
      className="flex items-center gap-3 p-3 rounded-xl border border-border/40 bg-card hover:border-primary/20 transition-colors group"
    >
      <div className="relative w-14 h-14 shrink-0 rounded-lg overflow-hidden border border-border/50 bg-surface">
        {post.signed_media?.[0] ? (
          <img src={post.signed_media[0]} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full grid place-items-center text-muted-foreground/40">
            <Palette size={16} />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold truncate group-hover:text-primary transition-colors">{title}</div>
        <div className="text-[10px] font-mono text-muted-foreground truncate">
          @{post.author?.username} · {post.likes} likes
        </div>
      </div>
    </Link>
  );
}

/* ─── Forum Row ─── */
function ForumRow({ thread }: { thread: ForumThread }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl border border-border/40 bg-card">
      <div className="w-9 h-9 shrink-0 rounded-lg bg-primary/10 border border-primary/10 grid place-items-center">
        <Hash size={14} className="text-primary/60" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-foreground/80 leading-snug">{thread.title}</div>
        <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground/50">
          <span>@{thread.authorUsername}</span>
          <span className="flex items-center gap-1"><MessageSquare size={8} /> {thread.postCount}</span>
          <span className="flex items-center gap-1"><Clock size={8} /> {timeAgo(thread.createdAt)}</span>
        </div>
      </div>
    </div>
  );
}

/* ═══════════ SEARCH SECTION ═══════════ */
export function SearchSection() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const [results, setResults] = useState<SearchResult>({
    games: [], posts: [], users: [], messages: [], files: [], gallery: [], forums: [], events: [],
  });
  const [counts, setCounts] = useState<Record<Tab, number>>({
    all: 0, games: 0, posts: 0, users: 0, messages: 0, files: 0, gallery: 0, forums: 0, events: 0,
  });

  const [channels, setChannels] = useState<SearchChannel[]>([]);
  const [senders, setSenders] = useState<Map<string, Profile>>(new Map());

  // Focus input on mount
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Load channels for message search
  useEffect(() => {
    buildChannels().then(setChannels).catch(() => {});
  }, []);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  // Run search
  const doSearch = useCallback(async (query: string) => {
    if (!query) {
      setResults({ games: [], posts: [], users: [], messages: [], files: [], gallery: [], forums: [], events: [] });
      setCounts({ all: 0, games: 0, posts: 0, users: 0, messages: 0, files: 0, gallery: 0, forums: 0, events: 0 });
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);

    try {
      const [games, posts, users, messages, files, gallery, forums, events] = await Promise.all([
        fetchGames({ search: query }).catch(() => [] as PostWithMeta[]),
        fetchFeed({ search: query }).catch(() => [] as PostWithMeta[]),
        searchUsers(query).catch(() => [] as Profile[]),
        searchMessages(query, channels, { scope: "all", channelId: "", personId: "", dateFrom: "", dateTo: "" }).catch(() => [] as SearchMessage[]),
        Promise.resolve(searchProjects(query)).catch(() => [] as SearchProject[]),
        fetchArtworks({ search: query }).catch(() => [] as PostWithMeta[]),
        searchForumThreads(query).catch(() => [] as ForumThread[]),
        fetchEvents().then(ev => ev.filter(e =>
          e.title.toLowerCase().includes(query.toLowerCase())
        )).catch(() => [] as { id: string; title: string; starts_at: string }[]),
      ]);

      // Resolve senders for messages
      const senderIds = [...new Set(messages.map(m => m.sender_id).filter(Boolean))] as string[];
      if (senderIds.length) {
        try {
          const { data } = await supabase.from("profiles").select("*").in("id", senderIds);
          if (data) {
            setSenders(prev => {
              const next = new Map(prev);
              for (const p of data as Profile[]) next.set(p.id, p);
              return next;
            });
          }
        } catch { /* noop */ }
      }

      // Filter files to only work files (searchFiles is sync)
      const workFiles = searchFiles(query, channels, { scope: "all", channelId: "", personId: "", dateFrom: "", dateTo: "" });

      const newResults = { games, posts, users, messages, files: workFiles, gallery, forums, events };
      setResults(newResults);

      const total = games.length + posts.length + users.length + messages.length + workFiles.length + gallery.length + forums.length + events.length;
      setCounts({
        all: total,
        games: games.length,
        posts: posts.length,
        users: users.length,
        messages: messages.length,
        files: workFiles.length,
        gallery: gallery.length,
        forums: forums.length,
        events: events.length,
      });
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, [channels]);

  useEffect(() => { doSearch(debounced); }, [debounced, doSearch]);

  const filtered = (() => {
    if (tab === "all") return results;
    return {
      games: tab === "games" ? results.games : [],
      posts: tab === "posts" ? results.posts : [],
      users: tab === "users" ? results.users : [],
      messages: tab === "messages" ? results.messages : [],
      files: tab === "files" ? results.files : [],
      gallery: tab === "gallery" ? results.gallery : [],
      forums: tab === "forums" ? results.forums : [],
      events: tab === "events" ? results.events : [],
    };
  })();

  const hasAny = counts.all > 0;

  return (
    <div className="space-y-4">
      {/* Search input */}
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 pointer-events-none" />
        <input
          ref={inputRef}
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Buscar juegos, usuarios, mensajes, archivos, arte, foros…"
          className="w-full h-11 pl-10 pr-10 rounded-xl bg-card border border-border/50 text-sm outline-none focus:border-primary/40 transition-colors placeholder:text-muted-foreground/40"
        />
        {q && (
          <button
            onClick={() => { setQ(""); inputRef.current?.focus(); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md bg-muted/60 grid place-items-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Category tabs */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1">
        <TabButton active={tab === "all"} onClick={() => setTab("all")} icon={<Search size={12} />} label="Todo" count={counts.all} />
        <TabButton active={tab === "games"} onClick={() => setTab("games")} icon={<Gamepad2 size={12} />} label="Juegos" count={counts.games} />
        <TabButton active={tab === "posts"} onClick={() => setTab("posts")} icon={<Newspaper size={12} />} label="Publicaciones" count={counts.posts} />
        <TabButton active={tab === "users"} onClick={() => setTab("users")} icon={<Users size={12} />} label="Usuarios" count={counts.users} />
        <TabButton active={tab === "messages"} onClick={() => setTab("messages")} icon={<MessageSquare size={12} />} label="Mensajes" count={counts.messages} />
        <TabButton active={tab === "gallery"} onClick={() => setTab("gallery")} icon={<Palette size={12} />} label="Galería" count={counts.gallery} />
        <TabButton active={tab === "forums"} onClick={() => setTab("forums")} icon={<Hash size={12} />} label="Foros" count={counts.forums} />
        <TabButton active={tab === "events"} onClick={() => setTab("events")} icon={<Trophy size={12} />} label="Eventos" count={counts.events} />
        <TabButton active={tab === "files"} onClick={() => setTab("files")} icon={<FolderOpen size={12} />} label="Archivos" count={counts.files} />
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-[12px]">Buscando…</span>
        </div>
      )}

      {/* Empty state */}
      {!loading && !searched && (
        <div className="text-center py-12 space-y-3">
          <div className="w-14 h-14 mx-auto rounded-xl bg-surface border border-border/40 grid place-items-center">
            <Search size={22} className="text-muted-foreground/30" />
          </div>
          <div className="text-sm text-muted-foreground/60">Escribe algo para buscar en toda la app</div>
          <div className="text-[10px] font-mono text-muted-foreground/40 max-w-xs mx-auto">
            Juegos · Publicaciones · Usuarios · Mensajes · Galería · Foros · Eventos · Archivos
          </div>
        </div>
      )}

      {/* No results */}
      {!loading && searched && !hasAny && (
        <div className="text-center py-12 space-y-2">
          <div className="text-sm text-muted-foreground/60">No se encontraron resultados para «{q}»</div>
          <div className="text-[10px] text-muted-foreground/40">Prueba con otros términos</div>
        </div>
      )}

      {/* Results */}
      {!loading && hasAny && (
        <div className="space-y-1">
          {/* Games */}
          {filtered.games.length > 0 && (
            <div>
              <SectionHeader icon={<Gamepad2 size={13} />} label="Juegos" count={filtered.games.length} />
              <div className="space-y-2">
                {filtered.games.slice(0, tab === "all" ? 5 : 30).map(g => <GameRow key={g.id} post={g} />)}
              </div>
            </div>
          )}

          {/* Posts */}
          {filtered.posts.length > 0 && (
            <div>
              <SectionHeader icon={<Newspaper size={13} />} label="Publicaciones" count={filtered.posts.length} />
              <div className="space-y-2">
                {filtered.posts.slice(0, tab === "all" ? 5 : 30).map(p => <PostRow key={p.id} post={p} />)}
              </div>
            </div>
          )}

          {/* Users */}
          {filtered.users.length > 0 && (
            <div>
              <SectionHeader icon={<Users size={13} />} label="Usuarios" count={filtered.users.length} />
              <div className="space-y-2">
                {filtered.users.slice(0, tab === "all" ? 5 : 30).map(u => <UserRow key={u.id} user={u} />)}
              </div>
            </div>
          )}

          {/* Messages */}
          {filtered.messages.length > 0 && (
            <div>
              <SectionHeader icon={<MessageSquare size={13} />} label="Mensajes" count={filtered.messages.length} />
              <div className="space-y-2">
                {filtered.messages.slice(0, tab === "all" ? 5 : 30).map(m => (
                  <MessageRow key={m.id} msg={m} channels={channels} senders={senders} />
                ))}
              </div>
            </div>
          )}

          {/* Gallery */}
          {filtered.gallery.length > 0 && (
            <div>
              <SectionHeader icon={<Palette size={13} />} label="Galería" count={filtered.gallery.length} />
              <div className="space-y-2">
                {filtered.gallery.slice(0, tab === "all" ? 5 : 30).map(a => <GalleryRow key={a.id} post={a} />)}
              </div>
            </div>
          )}

          {/* Forums */}
          {filtered.forums.length > 0 && (
            <div>
              <SectionHeader icon={<Hash size={13} />} label="Foros" count={filtered.forums.length} />
              <div className="space-y-2">
                {filtered.forums.slice(0, tab === "all" ? 5 : 30).map(t => <ForumRow key={t.id} thread={t} />)}
              </div>
            </div>
          )}

          {/* Events */}
          {filtered.events.length > 0 && (
            <div>
              <SectionHeader icon={<Trophy size={13} />} label="Eventos" count={filtered.events.length} />
              <div className="space-y-2">
                {filtered.events.slice(0, tab === "all" ? 5 : 30).map(ev => (
                  <Link
                    key={ev.id}
                    to="/"
                    className="flex items-center gap-3 p-3 rounded-xl border border-border/40 bg-card hover:border-primary/20 transition-colors group"
                  >
                    <div className="w-9 h-9 shrink-0 rounded-lg bg-amber-500/10 border border-amber-500/20 grid place-items-center">
                      <Trophy size={14} className="text-amber-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold truncate group-hover:text-primary transition-colors">{ev.title}</div>
                      <div className="text-[10px] text-muted-foreground">{timeAgo(ev.starts_at)}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Files */}
          {filtered.files.length > 0 && (
            <div>
              <SectionHeader icon={<FolderOpen size={13} />} label="Archivos" count={filtered.files.length} />
              <div className="space-y-2">
                {filtered.files.slice(0, tab === "all" ? 5 : 30).map((f, i) => <FileRow key={`${f.chat_id}-${i}`} file={f} />)}
              </div>
            </div>
          )}

          {/* "See more" hint for all tab */}
          {tab === "all" && counts.all > 25 && (
            <div className="text-center pt-4 text-[11px] text-muted-foreground/50">
              Mostrando los primeros resultados de cada categoría
            </div>
          )}
        </div>
      )}
    </div>
  );
}
