import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  isMod, isAdmin, listManagedUsers, setUserModerator, type ManagedUser,
  listBannedEmails, banEmail, unbanEmail, type BannedEmail,
} from "@/lib/social/api";
import {
  getForumThreads, getForumCategories, deleteForumThread,
  createForumCategory, deleteForumCategory,
  getForumPosts, type ForumThread, type ForumCategory,
} from "@/lib/social/forum-storage";
import {
  ArrowLeft, Shield, ShieldCheck, Loader2, Search, Ban, Trash2, Plus,
  MessageSquare, Hash, Globe, Edit3, X, Check, Star, Gamepad2, Trophy,
} from "lucide-react";
import {
  fetchGames, getFeaturedGames, setFeaturedGame, unsetFeaturedGame,
  type PostWithMeta,
} from "@/lib/social/api";
import Smooth3DSlideshow from "@/components/social/Smooth3DSlideshow";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin · Asternal" }] }),
  component: AdminPage,
});

type Tab = "mods" | "bans" | "foros" | "destacados";

function AdminPage() {
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [admin, setAdmin] = useState(false);
  const [tab, setTab] = useState<Tab>("mods");
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [bans, setBans] = useState<BannedEmail[]>([]);
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [newReason, setNewReason] = useState("");
  const [banErr, setBanErr] = useState<string | null>(null);
  // New category form
  const [showNewCat, setShowNewCat] = useState(false);
  const [catName, setCatName] = useState("");
  const [catDesc, setCatDesc] = useState("");
  const [catIcon, setCatIcon] = useState("globe");
  // Featured games
  const [featuredGames, setFeaturedGames] = useState<PostWithMeta[]>([]);
  const [allGames, setAllGames] = useState<PostWithMeta[]>([]);
  const [gameSearch, setGameSearch] = useState("");
  const [gameResults, setGameResults] = useState<PostWithMeta[]>([]);

  const load = async (search?: string) => {
    setLoading(true);
    try {
      if (tab === "mods") setUsers(await listManagedUsers(search));
      else if (tab === "bans") setBans(await listBannedEmails());
      else if (tab === "destacados") {
        const [games, featured] = await Promise.all([
          fetchGames({ search: undefined }),
          getFeaturedGames(),
        ]);
        setAllGames(games);
        setFeaturedGames(featured);
      } else {
        setThreads(getForumThreads());
        setCategories(getForumCategories());
      }
    } finally { setLoading(false); }
  };

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate({ to: "/auth" }); return; }
      const isA = await isAdmin();
      const isM = await isMod();
      setAdmin(isA);
      setAllowed(isA || isM);
      if (isA || isM) await load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (allowed) load(q); /* eslint-disable-next-line */ }, [tab]);

  const toggleMod = async (u: ManagedUser) => {
    setBusy(u.id);
    try { await setUserModerator(u.id, !u.is_mod); await load(q); }
    finally { setBusy(null); }
  };

  const addBan = async () => {
    setBanErr(null);
    try { await banEmail(newEmail, newReason || undefined); setNewEmail(""); setNewReason(""); await load(); }
    catch (e) { setBanErr((e as Error).message); }
  };

  const removeBan = async (id: string) => {
    if (!confirm("¿Quitar del baneo?")) return;
    setBusy(id);
    try { await unbanEmail(id); await load(); } finally { setBusy(null); }
  };

  const handleDeleteThread = (threadId: string) => {
    if (!confirm("¿Borrar este hilo permanentemente? También se borrarán todas sus respuestas.")) return;
    deleteForumThread(threadId);
    load();
  };

  const handleDeleteCategory = (categoryId: string) => {
    const cat = categories.find(c => c.id === categoryId);
    if (!cat) return;
    if (!confirm(`¿Borrar la categoría "${cat.name}"? También se borrarán TODOS los hilos dentro de ella.`)) return;
    deleteForumCategory(categoryId);
    load();
  };

  const handleNewCategory = () => {
    if (!catName.trim()) return;
    createForumCategory(catName.trim(), catDesc.trim(), catIcon);
    setCatName(""); setCatDesc(""); setCatIcon("globe"); setShowNewCat(false);
    load();
  };

  function extractGameTitle(content: string): string {
    const line = content.split("\n")[0] || "Juego";
    return line.replace(/^🎮\s*/, "").trim() || "Juego";
  }

  if (allowed === null) return <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Cargando…</div>;
  if (!allowed) return (
    <div className="min-h-screen grid place-items-center px-6 text-center">
      <div>
        <Shield size={32} className="mx-auto text-destructive" />
        <div className="mt-3 font-display text-sm">Acceso restringido</div>
        <div className="text-xs text-muted-foreground mt-1">Solo moderadores o el administrador pueden entrar.</div>
        <Link to="/" className="inline-block mt-4 px-4 py-2 rounded-xl border border-border text-xs font-display tracking-widest">← VOLVER</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 panel border-b">
        <div className="max-w-2xl mx-auto flex items-center gap-2 px-3 py-2.5">
          <Link to="/" className="w-9 h-9 rounded-xl border border-border grid place-items-center active:scale-95"><ArrowLeft size={16} /></Link>
          <div className="flex-1 min-w-0">
            <div className="font-display text-sm text-primary-glow glow-text leading-none flex items-center gap-1.5"><ShieldCheck size={14}/> MODERACIÓN</div>
            <div className="text-[10px] font-mono text-muted-foreground">{admin ? "Administrador" : "Moderador"}</div>
          </div>
        </div>
        <div className="max-w-2xl mx-auto px-3 pb-2">
          <div className="relative flex bg-muted/40 rounded-2xl p-1">
            {(["mods", "bans", "foros", "destacados"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`relative z-10 flex-1 py-2 rounded-xl text-[11px] font-display tracking-widest transition-colors ${
                  tab === t ? "text-primary-foreground" : "text-muted-foreground"
                }`}>
                {t === "mods" ? "MODS" : t === "bans" ? "BANEOS" : t === "foros" ? "FOROS" : "DESTACADOS"}
              </button>
            ))}
            <div className="absolute top-1 bottom-1 w-[calc(25%-5px)] rounded-xl bg-gradient-to-r from-primary to-accent transition-transform duration-300"
              style={{
                transform: `translateX(${tab === "mods" ? "0%" : tab === "bans" ? "calc(100% + 7px)" : tab === "foros" ? "calc(200% + 14px)" : "calc(300% + 21px)"})`,
              }}
            />
          </div>
        </div>
        {tab === "mods" && admin && (
          <div className="max-w-2xl mx-auto px-3 pb-3 flex gap-2">
            <div className="flex-1 flex items-center gap-2 bg-input/50 rounded-xl px-3">
              <Search size={14} className="text-muted-foreground" />
              <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === "Enter" && load(q)}
                placeholder="Buscar por usuario…" className="flex-1 bg-transparent py-2 text-sm outline-none" />
            </div>
            <button onClick={() => load(q)} className="px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-display tracking-widest active:scale-95">IR</button>
          </div>
        )}
      </header>

      <main className="max-w-2xl mx-auto px-3 py-3 space-y-2">
        {loading ? (
          <div className="text-center text-xs text-muted-foreground py-10"><Loader2 className="inline animate-spin mr-2" size={14}/>Cargando…</div>
        ) : tab === "mods" ? (
          !admin ? (
            <div className="text-center text-xs text-muted-foreground py-10">Solo el administrador puede asignar moderadores.</div>
          ) : users.length === 0 ? (
            <div className="text-center text-xs text-muted-foreground py-10">Sin resultados.</div>
          ) : users.map(u => (
            <div key={u.id} className="panel border border-border/50 rounded-xl px-3 py-2.5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent grid place-items-center text-primary-foreground font-display">
                {(u.display_name?.[0] ?? u.username[0] ?? "?").toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-display text-sm truncate">{u.display_name || u.username}</div>
                <div className="text-[10px] font-mono text-muted-foreground truncate">@{u.username}</div>
              </div>
              {u.is_admin ? (
                <span className="text-[9px] font-display tracking-widest px-2 py-0.5 rounded-full bg-accent/20 text-primary-glow border border-accent/40">ADMIN</span>
              ) : (
                <button onClick={() => toggleMod(u)} disabled={busy === u.id}
                  className={`text-[10px] font-display tracking-widest px-3 py-1.5 rounded-lg border flex items-center gap-1.5 active:scale-95 transition disabled:opacity-60 ${u.is_mod ? "bg-primary/15 border-primary/40 text-primary-glow" : "border-border text-muted-foreground"}`}>
                  {busy === u.id ? <Loader2 size={12} className="animate-spin"/> : <Shield size={12}/>}
                  {u.is_mod ? "MOD" : "HACER MOD"}
                </button>
              )}
            </div>
          ))
        ) : tab === "bans" ? (
          <>
            {admin && (
              <div className="panel border border-border/50 rounded-xl p-3 space-y-2">
                <div className="font-display text-[10px] tracking-widest text-primary-glow flex items-center gap-1"><Ban size={12}/> AÑADIR EMAIL</div>
                <input value={newEmail} onChange={e => setNewEmail(e.target.value)} type="email" placeholder="usuario@ejemplo.com"
                  className="w-full bg-input/50 rounded-lg px-3 py-2 text-sm outline-none" />
                <input value={newReason} onChange={e => setNewReason(e.target.value)} placeholder="Motivo (opcional)" maxLength={200}
                  className="w-full bg-input/50 rounded-lg px-3 py-2 text-sm outline-none" />
                {banErr && <div className="text-xs text-destructive">{banErr}</div>}
                <button onClick={addBan} disabled={!newEmail.trim()}
                  className="w-full py-2 rounded-lg bg-gradient-to-r from-destructive to-accent text-primary-foreground text-[10px] font-display tracking-widest disabled:opacity-50 flex items-center justify-center gap-1 active:scale-95">
                  <Plus size={12}/> BANEAR EMAIL
                </button>
              </div>
            )}
            {bans.length === 0 ? (
              <div className="text-center text-xs text-muted-foreground py-10">No hay emails baneados.</div>
            ) : bans.map(b => (
              <div key={b.id} className="panel border border-border/50 rounded-xl px-3 py-2.5 flex items-center gap-3">
                <Ban size={16} className="text-destructive shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-mono truncate">{b.email}</div>
                  {b.reason && <div className="text-[10px] text-muted-foreground truncate">{b.reason}</div>}
                </div>
                <button onClick={() => removeBan(b.id)} disabled={busy === b.id}
                  className="w-9 h-9 grid place-items-center rounded-lg border border-destructive/40 text-destructive active:scale-95 disabled:opacity-60">
                  {busy === b.id ? <Loader2 size={12} className="animate-spin"/> : <Trash2 size={13}/>}
                </button>
              </div>
            ))}
          </>
        ) : tab === "destacados" ? (
          /* ── DESTACADOS TAB ── */
          <>
            <div className="flex items-center gap-1.5 px-1 mb-2">
              <Trophy size={16} className="text-primary" />
              <span className="font-display text-xs tracking-widest text-primary/70">JUEGOS DESTACADOS</span>
              <span className="text-[10px] text-muted-foreground font-mono ml-auto">{featuredGames.length} seleccionados</span>
            </div>

            {/* Selected featured games preview */}
            {featuredGames.length > 0 ? (
              <div className="glass rounded-2xl border-glass-border overflow-hidden mb-3">
                <Smooth3DSlideshow
                  slides={featuredGames.map(g => ({
                    id: g.id,
                    image: { src: g.signed_cover || undefined },
                    title: extractGameTitle(g.content),
                  }))}
                  autoplay={false}
                />
              </div>
            ) : (
              <div className="text-center text-xs text-muted-foreground py-8 glass rounded-2xl border-glass-border mb-3">
                <Star size={24} className="mx-auto mb-2 opacity-40" />
                No hay juegos destacados. Selecciona juegos abajo para añadirlos.
              </div>
            )}

            {/* Current featured list */}
            <div className="font-display text-[10px] tracking-widest text-primary/70 flex items-center gap-1 px-1 mb-1">
              <Gamepad2 size={12} /> SELECCIONADOS ({featuredGames.length})
            </div>
            <div className="space-y-1.5 mb-4">
              {featuredGames.length === 0 ? (
                <div className="text-[11px] text-muted-foreground/60 px-1">Aún no has seleccionado ningún juego destacado.</div>
              ) : featuredGames.map((g, idx) => (
                <div key={g.id} className="glass border-glass-border rounded-xl px-3 py-2.5 flex items-center gap-3">
                  <span className="text-[9px] font-mono text-muted-foreground w-5 shrink-0 tabular-nums">#{idx + 1}</span>
                  <div className="w-10 h-10 rounded-xl shrink-0 overflow-hidden border border-border/40 bg-gradient-to-br from-primary/20 to-accent/20">
                    {g.signed_cover ? (
                      <img src={g.signed_cover} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full grid place-items-center text-muted-foreground/40">
                        <Gamepad2 size={16} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-display truncate">{extractGameTitle(g.content)}</div>
                    <div className="text-[10px] font-mono text-muted-foreground truncate">@{g.author?.username ?? "?"}</div>
                  </div>
                  <button
                    onClick={async () => {
                      await unsetFeaturedGame(g.id);
                      await load();
                    }}
                    className="w-8 h-8 grid place-items-center rounded-lg border border-destructive/30 text-destructive/70 hover:bg-destructive/10 active:scale-90 transition"
                    title="Quitar de destacados"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>

            {/* Search & add games */}
            <div className="font-display text-[10px] tracking-widest text-primary/70 flex items-center gap-1 px-1 mb-1">
              <Search size={12} /> BUSCAR JUEGOS
            </div>
            <div className="flex items-center gap-2 bg-input/50 rounded-xl px-3 mb-2">
              <Search size={14} className="text-muted-foreground shrink-0" />
              <input
                value={gameSearch}
                onChange={e => {
                  setGameSearch(e.target.value);
                  const q = e.target.value.toLowerCase().trim();
                  if (!q) { setGameResults([]); return; }
                  setGameResults(
                    allGames
                      .filter(g => !featuredGames.find(fg => fg.id === g.id))
                      .filter(g => extractGameTitle(g.content).toLowerCase().includes(q) || g.author?.username?.toLowerCase().includes(q))
                      .slice(0, 20)
                  );
                }}
                placeholder="Buscar juegos para destacar…"
                className="flex-1 bg-transparent py-2 text-sm outline-none"
              />
            </div>
            {gameResults.length > 0 && (
              <div className="space-y-1 mb-3">
                {gameResults.map(g => (
                  <div key={g.id} className="glass border-glass-border rounded-xl px-3 py-2 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl shrink-0 overflow-hidden border border-border/40 bg-gradient-to-br from-primary/20 to-accent/20">
                      {g.signed_cover ? (
                        <img src={g.signed_cover} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full grid place-items-center text-muted-foreground/40">
                          <Gamepad2 size={14} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-display truncate">{extractGameTitle(g.content)}</div>
                      <div className="text-[10px] font-mono text-muted-foreground truncate">@{g.author?.username ?? "?"} · {g.likes} ❤️</div>
                    </div>
                    <button
                      onClick={async () => {
                        await setFeaturedGame(g.id);
                        setGameSearch("");
                        setGameResults([]);
                        await load();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-primary to-accent text-primary-foreground text-[10px] font-display tracking-widest flex items-center gap-1 active:scale-95 transition"
                    >
                      <Plus size={11} /> DESTACAR
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          /* ── FOROS TAB ── */
          <>
            {/* ── Categories management ── */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between px-1">
                <div className="font-display text-[10px] tracking-widest text-primary/70 flex items-center gap-1">
                  <Hash size={12} /> CATEGORÍAS
                </div>
                {admin && (
                  <button onClick={() => setShowNewCat(s => !s)}
                    className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg border border-border/50 hover:bg-muted/20 active:scale-95 transition">
                    <Plus size={11} /> AÑADIR
                  </button>
                )}
              </div>

              {showNewCat && (
                <div className="p-3 rounded-xl border border-primary/20 bg-primary/[0.03] space-y-2">
                  <input value={catName} onChange={e => setCatName(e.target.value)} placeholder="Nombre de la categoría"
                    maxLength={30} className="w-full bg-white/70 rounded-lg px-3 py-2 text-sm outline-none border border-border/50 focus:border-primary/40" />
                  <input value={catDesc} onChange={e => setCatDesc(e.target.value)} placeholder="Descripción"
                    maxLength={100} className="w-full bg-white/70 rounded-lg px-3 py-2 text-sm outline-none border border-border/50 focus:border-primary/40" />
                  <div className="flex items-center gap-2">
                    <select value={catIcon} onChange={e => setCatIcon(e.target.value)}
                      className="flex-1 bg-white/70 rounded-lg px-3 py-2 text-xs outline-none border border-border/50">
                      <option value="globe">🌍 General</option>
                      <option value="life-buoy">🛟 Ayuda</option>
                      <option value="trophy">🏆 Showcase</option>
                      <option value="message-circle-more">💬 Feedback</option>
                      <option value="coffee">☕ Off-Topic</option>
                    </select>
                    <button onClick={() => { setShowNewCat(false); setCatName(""); setCatDesc(""); }}
                      className="px-3 py-2 rounded-lg border border-border/50 text-[10px] hover:bg-muted/20 transition-colors">
                      <X size={13} />
                    </button>
                    <button onClick={handleNewCategory} disabled={!catName.trim()}
                      className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-[10px] font-display tracking-wider disabled:opacity-40 active:scale-95 transition">
                      <Check size={13} />
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-1.5">
                {categories.map(cat => (
                  <div key={cat.id}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border/30 bg-white/60 text-xs">
                    <span className="font-display font-medium">{cat.name}</span>
                    <span className="text-[10px] text-muted-foreground/50">{cat.threadCount} hilos</span>
                    {admin && (
                      <button onClick={() => handleDeleteCategory(cat.id)}
                        className="text-muted-foreground/30 hover:text-destructive transition-colors p-0.5 active:scale-90"
                        title="Eliminar categoría">
                        <X size={11} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* ── Threads list ── */}
            <div className="font-display text-[10px] tracking-widest text-primary/70 flex items-center gap-1 px-1 pt-2">
              <MessageSquare size={12} /> TODOS LOS HILOS ({threads.length})
            </div>

            {threads.length === 0 ? (
              <div className="text-center text-xs text-muted-foreground py-10">No hay hilos en el foro.</div>
            ) : threads.map(t => (
              <div key={t.id} className="panel border border-border/50 rounded-xl px-3 py-2.5 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-muted/40 to-muted/20 border border-border/30 grid place-items-center shrink-0 text-muted-foreground/60">
                  <MessageSquare size={15} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-display truncate flex items-center gap-1.5">
                    {t.pinned && <span className="text-[8px] text-primary uppercase tracking-wider font-semibold">📌</span>}
                    {t.closed && <span className="text-[8px] text-rose-500 uppercase tracking-wider font-semibold">🔒</span>}
                    {t.title}
                  </div>
                  <div className="text-[10px] text-muted-foreground/60 mt-0.5 flex items-center gap-2">
                    <span>@{t.authorUsername}</span>
                    <span>{t.postCount} respuestas</span>
                    <span>{t.views} vistas</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-muted/30 text-muted-foreground/60 border border-border/30">
                    {categories.find(c => c.id === t.categoryId)?.name ?? "?"}
                  </span>
                  {admin && (
                    <button onClick={() => handleDeleteThread(t.id)}
                      className="w-8 h-8 grid place-items-center rounded-lg border border-destructive/30 text-destructive/70 hover:bg-destructive/10 hover:border-destructive/50 active:scale-90 transition"
                      title="Eliminar hilo">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </>
        )}
      </main>
    </div>
  );
}
