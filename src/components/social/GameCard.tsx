import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Avatar } from "./Avatar";
import { Play, Heart, MessageCircle, Share2, Trash2, MoreHorizontal, Pencil, GitFork, Loader2, Sparkles, Lock, X, CheckCircle2, AlertTriangle, ChevronLeft, ChevronRight, Gamepad2, Flag } from "lucide-react";
import { useNavigate, Link } from "@tanstack/react-router";
import { type PostWithMeta, toggleReaction, deletePost, loadGameProject, reportContent, remixGame, purchaseGame, getMyOrbes, recordGamePlay } from "@/lib/social/api";
import { logPlaySession } from "@/lib/social/history";
import type { Project, Scene } from "@/lib/engine/core";
import { GameRuntime } from "@/components/engine/GameRuntime";
import { CommentSection } from "./CommentSection";
import { CardMenu, CardMenuItem, useCardMenuAnchor } from "./CardMenu";
import { PublishGameDialog } from "@/components/engine/PublishGameDialog";
import { createProject, saveProjectById, setProjectCloudId, setCurrentProjectId } from "@/lib/engine/storage";

function timeAgo(iso: string) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60); if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function extractTitle(content: string): { title: string; body: string } {
  const line = content.split("\n")[0] || "Juego";
  const title = line.replace(/^🎮\s*/, "").trim() || "Juego";
  const body = content.split("\n").slice(1).join("\n").trim();
  return { title, body };
}

export function GameCard({
  post, myId, isMod, onChange, squareCover,
}: {
  post: PostWithMeta; myId: string | null; isMod: boolean; onChange: () => void; squareCover?: boolean;
}) {
  const navigate = useNavigate();
  const [playing, setPlaying] = useState<Scene | null>(null);
  // Marca de inicio de la partida actual (para registrar la sesión en el historial).
  const sessionRef = useRef<{ startedAt: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [openComments, setOpenComments] = useState(false);
  const menu = useCardMenuAnchor<HTMLButtonElement>();
  const [editOpen, setEditOpen] = useState(false);
  const [viewer, setViewer] = useState<number | null>(null);
  const [remixing, setRemixing] = useState(false);
  const { title, body } = extractTitle(post.content);
  const mine = myId === post.author_id;
  const canRemix = post.allow_remix !== false;
  const price = post.price_orbes ?? 0;
  const [owned, setOwned] = useState<boolean>(post.owned ?? (price <= 0 || mine));
  useEffect(() => { setOwned(post.owned ?? (price <= 0 || mine)); }, [post.owned, price, mine]);
  const needsPurchase = !owned && price > 0 && !mine;

  // Purchase modal state
  const [buyOpen, setBuyOpen] = useState(false);
  const [buyState, setBuyState] = useState<"idle" | "loading" | "success" | "insufficient" | "error">("idle");
  const [buyMsg, setBuyMsg] = useState<string>("");
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!playing) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.requestFullscreen?.().catch(() => {/* ignore */});
    return () => {
      document.body.style.overflow = prev;
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {/* ignore */});
    };
  }, [playing]);

  // Cierra la sesión de juego y la guarda en el historial real (historial panel).
  // Se ignora si duró menos de 3 segundos (abrir y salir al instante no cuenta).
  const endSession = () => {
    const s = sessionRef.current;
    if (!s) return;
    sessionRef.current = null;
    const dur = Math.round((Date.now() - s.startedAt) / 1000);
    if (dur < 3) return;
    const endedAt = new Date().toISOString();
    try {
      logPlaySession({
        gameId: post.id,
        gameTitle: title,
        coverUrl: post.signed_cover ?? null,
        startedAt: new Date(s.startedAt).toISOString(),
        endedAt,
        durationSeconds: dur,
      });
    } catch { /* el historial nunca debe romper la partida */ }
  };

  const closeGame = () => { endSession(); setPlaying(null); };

  // Si el componente se desmonta con la partida abierta (navegar, cerrar feed),
  // igualmente se registra la sesión con lo jugado hasta ese momento.
  useEffect(() => () => { endSession(); }, []);

  const launchScene = async () => {
    if (!post.signed_media[0]) { setErr("Sin datos"); return; }
    const proj = (await loadGameProject(post.signed_media[0])) as Project;
    const scene = proj.scenes.find(s => s.id === proj.activeSceneId) ?? proj.scenes[0];
    if (!scene) throw new Error("Escena inválida");
    setPlaying(scene);
    sessionRef.current = { startedAt: Date.now() };
    // Registra la jugada para el ranking de «más jugados (24h)».
    void recordGamePlay(post.id);
  };

  const play = async () => {
    if (!post.signed_media[0]) { setErr("Sin datos"); return; }
    if (needsPurchase) {
      // Open confirm modal, fetch balance in parallel
      setBuyOpen(true);
      setBuyState("idle");
      setBuyMsg("");
      setBalance(null);
      getMyOrbes().then(setBalance).catch(() => setBalance(null));
      return;
    }
    setLoading(true); setErr(null);
    try { await launchScene(); }
    catch (e) { setErr((e as Error).message); }
    finally { setLoading(false); }
  };

  const confirmPurchase = async () => {
    setBuyState("loading");
    setBuyMsg("");
    try {
      const res = await purchaseGame(post.id);
      if (!res.ok) throw new Error("No se pudo completar la compra");
      setOwned(true);
      setBuyState("success");
      setBuyMsg(`¡Compra realizada! ${typeof res.balance === "number" ? `Te quedan ${res.balance} orbes.` : ""}`);
      onChange();
      // Auto-launch after brief success flash
      setTimeout(async () => {
        setBuyOpen(false);
        setLoading(true);
        try { await launchScene(); } catch (e) { setErr((e as Error).message); }
        finally { setLoading(false); }
      }, 900);
    } catch (e) {
      const msg = (e as Error).message || "";
      if (/insufficient/i.test(msg)) {
        setBuyState("insufficient");
        setBuyMsg("No tienes suficientes orbes para comprar este juego.");
      } else {
        setBuyState("error");
        setBuyMsg(msg || "Ocurrió un error al procesar la compra.");
      }
    }
  };

  const like = async () => {
    try {
      await toggleReaction({ postId: post.id, type: "like" });
      onChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo dar Me gusta");
    }
  };
  const remove = () => {
    toast("¿Borrar juego publicado?", {
      description: "Esta acción no se puede deshacer.",
      action: {
        label: "Borrar",
        onClick: async () => {
          try {
            await deletePost(post.id);
            toast.success("Juego eliminado");
            onChange();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Error al borrar");
          }
        },
      },
    });
  };
  const share = async () => {
    const url = window.location.origin + "/?g=" + post.id;
    try { await navigator.share({ url, title, text: body.slice(0, 80) }); }
    catch { await navigator.clipboard.writeText(url); }
  };
  const report = () => {
    menu.close();
    toast("Reportar juego", {
      description: "Señalará este juego a los moderadores.",
      action: {
        label: "Reportar",
        onClick: async () => {
          try {
            await reportContent({ postId: post.id, reason: "Reporte desde juegos" });
            toast.success("Reporte enviado");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Error al reportar");
          }
        },
      },
    });
  };
  const doRemix = async () => {
    if (!canRemix) { setErr("El autor no permite remixes"); return; }
    setRemixing(true); setErr(null);
    try {
      const { cloudId, name } = await remixGame(post);
      // Auto-import locally so aparece en "Mis juegos" del editor al instante
      const project = (await loadGameProject(post.signed_media[0])) as Project;
      try { (project as { name?: string }).name = name; } catch { /* ignore */ }
      const localId = createProject(name);
      saveProjectById(localId, project);
      setProjectCloudId(localId, cloudId);
      setCurrentProjectId(localId);
      menu.close();
      navigate({ to: "/editor" });
    } catch (e) { setErr((e as Error).message); }
    finally { setRemixing(false); }
  };

  if (playing) {
    return (
      <div className="fixed inset-0 z-[100] bg-background" style={{ height: "100dvh", width: "100vw" }}>
        <GameRuntime
          scene={playing}
          fpsCap={60}
          showHUD={true}
          onExit={closeGame}
        />
        <button
          onClick={closeGame}
          className="fixed top-3 right-3 z-[110] px-3 py-2 rounded-xl glass text-xs font-display tracking-widest active:scale-95"
        >SALIR</button>
      </div>
    );
  }

  return (
    <article className="panel rounded-2xl overflow-hidden border border-border/50 shadow-sm">
      {squareCover ? (
        /* Modo página aislada: portada limpia, sin elementos encima del arte */
        <div className="relative aspect-square bg-muted/30">
          {post.signed_cover ? (
            <img src={post.signed_cover} alt={title} className="absolute inset-0 w-full h-full object-contain" />
          ) : (
            <div className="absolute inset-0 grid place-items-center" style={{ background: "var(--gradient-asternal-soft)" }}>
              <Gamepad2 size={72} className="text-primary/25" />
            </div>
          )}
          {price > 0 && !owned && (
            <div className="absolute top-2 right-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/95 shadow-md backdrop-blur border border-primary/20">
              <Sparkles size={12} className="text-primary" fill="currentColor" />
              <span className="text-[11px] font-display font-semibold tracking-wide">{price}</span>
            </div>
          )}
        </div>
      ) : (
      <div
        onClick={play}
        className="relative aspect-[16/10] grid place-items-center cursor-pointer active:scale-[0.99] transition overflow-hidden"
        style={post.signed_cover ? undefined : { background: "var(--gradient-asternal-soft)" }}
      >
        {post.signed_cover ? (
          <>
            <img src={post.signed_cover} alt={title} className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          </>
        ) : null}
        <button
          className="relative w-16 h-16 rounded-2xl bg-card grid place-items-center shadow-md active:scale-95 hover:scale-105 transition-transform duration-200"
          aria-label={needsPurchase ? "Comprar y jugar" : "Jugar"}
        >
          {loading ? <Loader2 size={20} className="animate-spin text-primary" /> :
            needsPurchase ? <Lock size={22} className="text-primary" /> :
            <Play size={26} className="text-primary translate-x-[2px]" fill="currentColor" />}
        </button>
        {/* Top-right price badge */}
        <div className="absolute top-2 right-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/95 shadow-md backdrop-blur border border-primary/20">
          {price > 0 ? (
            <>
              <Sparkles size={12} className={owned ? "text-emerald-500" : "text-primary"} fill="currentColor" />
              <span className="text-[11px] font-display font-semibold tracking-wide">
                {owned ? "TUYO" : `${price}`}
              </span>
            </>
          ) : (
            <>
              <Sparkles size={12} className="text-emerald-500" fill="currentColor" />
              <span className="text-[11px] font-display font-semibold tracking-wide text-emerald-600">GRATIS</span>
            </>
          )}
        </div>
        <div className="absolute bottom-2 left-3 right-3 flex items-end justify-between gap-2">
          <div className="min-w-0 flex items-end gap-2">
            <Link
              to="/profile/$userId" params={{ userId: post.author_id }}
              onClick={e => e.stopPropagation()}
              className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-white/30 block"
            >
              <Avatar p={post.author} className="w-full h-full" />
            </Link>
            <div className="min-w-0">
              <div className={`font-display text-base truncate drop-shadow ${post.signed_cover ? "text-white" : "text-foreground"}`}>{title}</div>
              <Link
                to="/profile/$userId" params={{ userId: post.author_id }}
                onClick={e => e.stopPropagation()}
                className={`text-[10px] font-mono truncate hover:underline ${post.signed_cover ? "text-white/80" : "text-muted-foreground"}`}
              >
                @{post.author?.username ?? "jugador"} · {timeAgo(post.created_at)}
              </Link>
            </div>
          </div>
          <span className="text-[9px] font-display tracking-widest px-2 py-0.5 rounded-full bg-primary/20 text-primary-glow border border-primary/40">JUEGO</span>
        </div>
      </div>
      )}

      {/* Botón principal — estilo tienda, solo en página aislada */}
      {squareCover && (
        <div className="px-3 pt-3">
          <button
            type="button"
            onClick={play}
            disabled={loading}
            className="w-full h-12 rounded-2xl grad-brand text-primary-foreground font-display tracking-[0.2em] text-sm shadow-md flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.98] transition-transform duration-200"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : needsPurchase ? (
              <>
                <Lock size={16} /> COMPRAR Y JUGAR
              </>
            ) : (
              <>
                <Play size={18} fill="currentColor" /> JUGAR
              </>
            )}
          </button>
        </div>
      )}

      {/* Galería de capturas */}
      {post.signed_screenshots.length > 0 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar px-3 pt-2.5">
          {post.signed_screenshots.map((src, i) => (
            <button
              key={i}
              onClick={() => setViewer(i)}
              className="relative w-28 h-[72px] shrink-0 rounded-xl overflow-hidden border border-border/60 group active:scale-95 transition"
              aria-label={`Ver captura ${i + 1}`}
            >
              <img src={src} alt={`Captura ${i + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent opacity-0 group-hover:opacity-100 transition" />
            </button>
          ))}
        </div>
      )}


      {(body || err) && (
        <div className="px-3 pt-2 text-sm whitespace-pre-wrap break-words">
          {body}
          {err && <div className="text-xs text-destructive mt-1">{err}</div>}
        </div>
      )}

      {post.game_genre && (
        <div className="px-3 pt-2.5">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-display tracking-wide text-primary-glow">
            <Gamepad2 size={11} /> {post.game_genre}
          </span>
        </div>
      )}

      <footer className="flex items-center gap-1 px-2 py-1.5 text-[11px] text-muted-foreground">
        <button onClick={like} className={`flex items-center gap-1 px-2 py-1.5 rounded-lg active:scale-95 transition ${post.my_like ? "text-primary-glow" : ""}`}>
          <Heart size={15} fill={post.my_like ? "currentColor" : "none"} /> {post.likes}
        </button>
        <button onClick={() => setOpenComments(o => !o)} className="flex items-center gap-1 px-2 py-1.5 rounded-lg active:scale-95 transition">
          <MessageCircle size={15} /> {post.comments_count}
        </button>
        {canRemix && !mine && (
          <button onClick={doRemix} disabled={remixing} title="Hacer remix"
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg active:scale-95 transition ml-auto text-primary-glow disabled:opacity-60">
            {remixing ? <Loader2 size={14} className="animate-spin" /> : <GitFork size={14} />}
            <span className="text-[10px] font-display tracking-widest">REMIX</span>
          </button>
        )}
        <button onClick={share} className={`flex items-center gap-1 px-2 py-1.5 rounded-lg active:scale-95 transition ${canRemix && !mine ? "" : "ml-auto"}`}>
          <Share2 size={15} />
        </button>
        <button ref={menu.anchorRef} onClick={menu.toggle}
          className="w-8 h-8 grid place-items-center rounded-lg border border-border text-primary-glow transition-[transform,background-color,color] duration-150 ease-out pointer-fine:hover:bg-primary/10 pointer-fine:hover:text-primary active:scale-95"
          aria-label="Menú del juego">
          <MoreHorizontal size={16} />
        </button>
        <CardMenu rect={menu.rect} onClose={menu.close} width={150}>
          {mine && <CardMenuItem onClick={() => { setEditOpen(true); menu.close(); }} icon={<Pencil size={13} />}>Editar</CardMenuItem>}
          {(mine || isMod) && <CardMenuItem onClick={remove} danger icon={<Trash2 size={13} />}>Borrar</CardMenuItem>}
          {!mine && <CardMenuItem onClick={report} icon={<Flag size={13} />}>Reportar</CardMenuItem>}
        </CardMenu>
      </footer>

      {openComments && (
        <div className="px-3 pb-3">
          <CommentSection postId={post.id} myId={myId} isMod={isMod} onChange={onChange} />
        </div>
      )}

      {editOpen && (
        <PublishGameDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          defaultTitle={title}
          mode="edit"
          editPostId={post.id}
          initialTitle={title}
          initialDescription={body}
          initialTags={post.tags}
          initialCoverUrl={post.signed_cover}
          initialScreenshots={(post.screenshots ?? []).map((path, i) => ({ path, url: post.signed_screenshots[i] ?? "" }))}
          initialAllowRemix={post.allow_remix !== false}
          initialPriceOrbes={post.price_orbes ?? 0}
          initialGenre={post.game_genre ?? null}
          onSaved={onChange}
        />
      )}

      {/* Visor de capturas a pantalla completa */}
      {viewer !== null && post.signed_screenshots.length > 0 && (
        <div
          className="fixed inset-0 z-[130] bg-black/90  grid place-items-center p-4 animate-in fade-in duration-200"
          onClick={() => setViewer(null)}
        >
          <button
            onClick={() => setViewer(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-xl bg-white/10 text-white grid place-items-center hover:bg-white/20 active:scale-90 transition z-10"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
          {post.signed_screenshots.length > 1 && (
            <>
              <button
                onClick={e => { e.stopPropagation(); setViewer(v => (v! - 1 + post.signed_screenshots.length) % post.signed_screenshots.length); }}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-white/10 text-white grid place-items-center hover:bg-white/20 active:scale-90 transition z-10"
                aria-label="Anterior"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={e => { e.stopPropagation(); setViewer(v => (v! + 1) % post.signed_screenshots.length); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-white/10 text-white grid place-items-center hover:bg-white/20 active:scale-90 transition z-10"
                aria-label="Siguiente"
              >
                <ChevronRight size={20} />
              </button>
            </>
          )}
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[80vh] rounded-2xl overflow-hidden shadow-lg animate-in zoom-in-95 duration-200"
          >
            <img
              src={post.signed_screenshots[viewer]}
              alt={`Captura ${viewer + 1}`}
              className="w-full h-full max-h-[80vh] object-contain bg-black"
            />
          </div>
          <div className="absolute bottom-4 inset-x-0 text-center text-[11px] font-mono text-white/70">
            {viewer + 1} / {post.signed_screenshots.length}
          </div>
        </div>
      )}

      {buyOpen && (
        <div
          className="fixed inset-0 z-[120] bg-black/60  grid place-items-center p-4 animate-in fade-in duration-200"
          onClick={() => buyState !== "loading" && setBuyOpen(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-sm panel rounded-3xl border border-primary/30 p-5 shadow-lg animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 relative"
          >
            {buyState !== "loading" && (
              <button
                onClick={() => setBuyOpen(false)}
                className="absolute top-3 right-3 w-8 h-8 rounded-lg grid place-items-center hover:bg-muted/60 active:scale-90 transition"
                aria-label="Cerrar"
              >
                <X size={16} />
              </button>
            )}

            {(buyState === "idle" || buyState === "loading") && (
              <>
                <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 grid place-items-center mb-3">
                  {buyState === "loading"
                    ? <Loader2 size={26} className="animate-spin text-primary" />
                    : <Sparkles size={26} className="text-primary" fill="currentColor" />}
                </div>
                <h3 className="font-display text-center text-lg">{buyState === "loading" ? "Procesando compra…" : "Comprar juego"}</h3>
                <p className="text-xs text-center text-muted-foreground mt-1 truncate">{title}</p>
                <div className="mt-4 rounded-2xl bg-muted/40 border border-border/60 p-3 space-y-1.5">
                  <Row label="Precio" value={<span className="flex items-center gap-1"><Sparkles size={12} className="text-primary" fill="currentColor" /> {price}</span>} />
                  <Row label="Saldo actual" value={balance === null ? "…" : <span className="tabular-nums">{balance}</span>} />
                  <div className="border-t border-border/50 my-1" />
                  <Row
                    label="Saldo tras compra"
                    value={
                      balance === null
                        ? "…"
                        : <span className={`tabular-nums font-semibold ${balance - price < 0 ? "text-rose-500" : "text-emerald-500"}`}>{balance - price}</span>
                    }
                  />
                </div>
                <button
                  onClick={confirmPurchase}
                  disabled={buyState === "loading" || (balance !== null && balance < price)}
                  className="mt-4 w-full h-11 rounded-2xl grad-brand text-primary-foreground font-display tracking-widest text-xs disabled:opacity-50 active:scale-[0.99] transition"
                >
                  {buyState === "loading" ? <Loader2 size={16} className="animate-spin mx-auto" /> : "CONFIRMAR COMPRA"}
                </button>
                {balance !== null && balance < price && buyState === "idle" && (
                  <div className="mt-2 text-[11px] text-center text-rose-500">Saldo insuficiente. Te faltan {price - balance} orbes.</div>
                )}
              </>
            )}

            {buyState === "success" && (
              <div className="text-center py-2">
                <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-500/15 grid place-items-center mb-3 animate-in zoom-in-50 duration-300">
                  <CheckCircle2 size={30} className="text-emerald-500" />
                </div>
                <h3 className="font-display text-lg">¡Juego desbloqueado!</h3>
                <p className="text-xs text-muted-foreground mt-1">{buyMsg}</p>
              </div>
            )}

            {(buyState === "insufficient" || buyState === "error") && (
              <div className="text-center py-2">
                <div className="mx-auto w-14 h-14 rounded-2xl bg-rose-500/15 grid place-items-center mb-3">
                  <AlertTriangle size={26} className="text-rose-500" />
                </div>
                <h3 className="font-display text-lg">{buyState === "insufficient" ? "Orbes insuficientes" : "No se pudo comprar"}</h3>
                <p className="text-xs text-muted-foreground mt-1">{buyMsg}</p>
                <button
                  onClick={() => setBuyOpen(false)}
                  className="mt-4 w-full h-10 rounded-2xl border border-border font-display tracking-widest text-xs active:scale-[0.99] transition"
                >
                  ENTENDIDO
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
