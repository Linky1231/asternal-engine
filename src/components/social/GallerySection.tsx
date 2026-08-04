import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Palette, Sparkles, X, Loader2, ImagePlus, CheckCircle2,
  Heart, MessageCircle, AlertTriangle, Search, Clock, TrendingUp,
  DollarSign, Gift, Eye, ExternalLink,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  type PostWithMeta, type Profile,
  fetchArtworks, purchaseArtwork, publishArtwork,
  getMyProfile, getMyOrbes, toggleReaction,
} from "@/lib/social/api";
import { CommentSection } from "@/components/social/CommentSection";
import type { SpriteAsset } from "@/lib/engine/core";
import { GalleryCanvasPanel } from "@/components/social/GalleryCanvasPanel";

const TABS: { id: string; label: string; icon: typeof Clock }[] = [
  { id: "recent", label: "Recientes", icon: Clock },
  { id: "popular", label: "Populares", icon: TrendingUp },
  { id: "free", label: "Gratis", icon: Gift },
  { id: "paid", label: "De pago", icon: DollarSign },
];

export function GallerySection({ myId, isMod: _isMod, onRefresh }: {
  myId: string | null; isMod: boolean; onRefresh?: () => void;
}) {
  const [artworks, setArtworks] = useState<PostWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tab, setTab] = useState("recent");
  const [searchQ, setSearchQ] = useState("");

  // Paint editor overlay state
  const [canvasOpen, setCanvasOpen] = useState(false);

  // Detail modal
  const [detailPost, setDetailPost] = useState<PostWithMeta | null>(null);

  // Publish dialog
  const [savedSprite, setSavedSprite] = useState<SpriteAsset | null>(null);
  const [pubTitle, setPubTitle] = useState("");
  const [pubPrice, setPubPrice] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [pubErr, setPubErr] = useState<string | null>(null);
  const [pubDone, setPubDone] = useState(false);

  // Like state
  const [likingId, setLikingId] = useState<string | null>(null);

  // Buy modal
  const [buyPostId, setBuyPostId] = useState<string | null>(null);
  const [buyState, setBuyState] = useState<"idle" | "loading" | "success" | "error" | "insufficient">("idle");
  const [balance, setBalance] = useState<number | null>(null);
  const [buyMsg, setBuyMsg] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [arts, p] = await Promise.all([
        fetchArtworks(),
        getMyProfile(),
      ]);
      setArtworks(arts);
      setProfile(p);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  // --- Canvas save ---
  const handleCanvasSave = (sprite: SpriteAsset) => {
    setCanvasOpen(false);
    setSavedSprite(sprite);
    setPubTitle(sprite.name || "Mi obra");
    setPubPrice(0);
    setPubDone(false);
    setPubErr(null);
  };

  // --- Publish ---
  const doPublish = async () => {
    if (!savedSprite) return;
    if (!pubTitle.trim()) { setPubErr("Escribe un título"); return; }
    setPublishing(true); setPubErr(null);
    try {
      const composite = savedSprite.frames?.[0]?.composite;
      if (!composite) throw new Error("No hay imagen en el dibujo");
      await publishArtwork({ title: pubTitle.trim(), imageDataUrl: composite, priceOrbes: pubPrice });
      setPubDone(true);
      setTimeout(() => { setSavedSprite(null); setPubDone(false); setPublishing(false); load(); }, 1200);
    } catch (e) { setPubErr((e as Error).message); setPublishing(false); }
  };

  // --- Like ---
  const likeArt = async (postId: string) => {
    if (!myId) return;
    setLikingId(postId);
    try {
      await toggleReaction({ postId, type: "like" });
      await load();
    } finally { setLikingId(null); }
  };

  // --- Buy ---
  const openBuy = async (postId: string) => {
    setBuyPostId(postId); setBuyState("idle");
    try { setBalance(await getMyOrbes()); } catch { setBalance(0); }
  };
  const confirmBuy = async () => {
    if (!buyPostId) return;
    setBuyState("loading");
    try {
      const res = await purchaseArtwork(buyPostId);
      if (res.already_owned) { setBuyState("success"); setBuyMsg("Ya tienes esta obra."); }
      else if (res.free || (res.ok && (res.paid ?? 0) >= 0)) { setBuyState("success"); setBuyMsg(res.free ? "¡Obra gratuita!" : `Comprada por ${res.paid} orbes.`); load(); }
      else { setBuyState("insufficient"); setBuyMsg(`Te faltan ${(res.balance ?? 0) < 0 ? Math.abs(res.balance ?? 0) : "algunos"} orbes.`); }
    } catch (e) { setBuyState("error"); setBuyMsg((e as Error).message); }
  };

  // Filter & sort
  const q = searchQ.toLowerCase().trim();
  const filtered = useMemo(() => {
    let list = [...artworks];

    // Search filter
    if (q) {
      list = list.filter(a => {
        const title = a.content.replace(/^🎨\s*/, "").toLowerCase();
        const author = a.author?.username?.toLowerCase() ?? "";
        return title.includes(q) || author.includes(q);
      });
    }

    // Tab filter & sort
    switch (tab) {
      case "recent":
        list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case "popular":
        list.sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0));
        break;
      case "free":
        list = list.filter(a => (a.price_orbes ?? 0) === 0);
        list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case "paid":
        list = list.filter(a => (a.price_orbes ?? 0) > 0);
        list.sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0));
        break;
    }

    return list;
  }, [artworks, q, tab]);

  const mineCount = artworks.filter(a => a.author_id === myId).length;

  return (
    <div className="space-y-5">
      {/* ====== HEADER ====== */}
      <div className="flex items-center justify-between gap-3 panel rounded-2xl p-3 border border-border/40">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-accent grid place-items-center shadow-md shrink-0">
            <Palette size={22} className="text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <div className="font-display text-base font-semibold truncate tracking-tight flex items-center gap-2">
              Galería
              <span className="text-[9px] font-mono text-muted-foreground/60 bg-muted/50 px-2 py-0.5 rounded-full border border-border/30">
                Comunidad
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground/70 mt-0.5">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                {artworks.length} obra{artworks.length !== 1 ? "s" : ""}
              </span>
              <span>·</span>
              <span className="flex items-center gap-1">
                {mineCount} tuya{mineCount !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={() => setCanvasOpen(true)}
          className="h-10 pl-4 pr-5 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground text-[10px] font-display tracking-widest flex items-center gap-1.5 active:scale-95 hover:shadow-lg hover:shadow-primary/25 transition-all shrink-0 font-semibold"
        >
          <ImagePlus size={16} /> NUEVA OBRA
        </button>
      </div>

      {/* ====== SEARCH BAR ====== */}
      <div className="flex items-center gap-2 bg-input/40 border border-border/50 rounded-2xl px-3.5 py-2.5 focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary/40 transition-all">
        <Search size={15} className="text-muted-foreground shrink-0" />
        <input
          value={searchQ}
          onChange={e => setSearchQ(e.target.value)}
          placeholder="Buscar obras o artistas…"
          className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/50"
        />
        {searchQ && (
          <button onClick={() => setSearchQ("")} className="w-6 h-6 grid place-items-center rounded-full hover:bg-muted/50 text-muted-foreground transition">
            <X size={13} />
          </button>
        )}
      </div>

      {/* ====== NAVIGATION TABS ====== */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
        {TABS.map(t => {
          const Icon = t.icon;
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[10px] font-display tracking-widest transition-all active:scale-95 whitespace-nowrap ${
                isActive
                  ? "bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-sm shadow-primary/20"
                  : "text-muted-foreground hover:text-foreground bg-muted/30 hover:bg-muted/60 border border-border/40"
              }`}
            >
              <Icon size={13} />
              {t.label}
            </button>
          );
        })}
        <div className="flex-1" />
        <button
          onClick={() => setTab("all")}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[10px] font-display tracking-widest transition-all active:scale-95 ${
            tab === "all"
              ? "bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-sm shadow-primary/20"
              : "text-muted-foreground hover:text-foreground bg-muted/30 hover:bg-muted/60 border border-border/40"
          }`}
        >
          <Eye size={13} />
          TODO
        </button>
      </div>

      {/* ====== ARTWORKS GRID ====== */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="aspect-square rounded-2xl bg-muted/30 animate-pulse" />
              <div className="h-3 w-3/4 rounded-lg bg-muted/20 animate-pulse" />
              <div className="h-2.5 w-1/2 rounded-lg bg-muted/15 animate-pulse" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-20 panel rounded-3xl border border-dashed border-border/60"
        >
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-primary/10 to-accent/10 grid place-items-center mx-auto mb-4">
            <Palette size={32} className="text-muted-foreground/40" />
          </div>
          <div className="text-base font-display text-muted-foreground">
            {q ? `Sin resultados para "${q}"` : "Aún no hay obras aquí"}
          </div>
          <div className="text-xs text-muted-foreground/60 mt-1.5 max-w-xs mx-auto leading-relaxed">
            {q
              ? "Prueba con otro término de búsqueda"
              : tab === "free"
                ? "No hay obras gratuitas todavía"
                : tab === "paid"
                  ? "No hay obras de pago todavía"
                  : "¡Sé el primero en compartir tu arte con la comunidad!"}
          </div>
          <button
            onClick={() => setCanvasOpen(true)}
            className="mt-5 h-10 px-5 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground text-[10px] font-display tracking-widest active:scale-95 transition shadow-sm"
          >
            <ImagePlus size={14} className="inline mr-1.5" />CREAR OBRA
          </button>
        </motion.div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {filtered.map((art, i) => {
            const imgUrl = art.signed_media?.[0] ?? art.signed_cover;
            const price = art.price_orbes ?? 0;
            const mine = art.author_id === myId;
            const owned = art.owned ?? false;
            const title = art.content.replace(/^🎨\s*/, "");
            return (
              <motion.button
                key={art.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: Math.min(i * 0.04, 0.3), ease: [0.22, 1, 0.36, 1] }}
                onClick={() => setDetailPost(art)}
                className="group text-left w-full"
              >
                <div className="relative panel rounded-2xl overflow-hidden border border-border/40 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10 transition-all duration-300 active:scale-[0.97]">
                  {/* Image area with decorative gradient border */}
                  <div className="aspect-square bg-gradient-to-br from-muted/20 to-muted/5 relative overflow-hidden">
                    {imgUrl ? (
                      <>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        <img
                          src={imgUrl}
                          alt={title}
                          className="w-full h-full object-contain p-3 group-hover:scale-105 transition-transform duration-500 ease-out"
                        />
                      </>
                    ) : (
                      <div className="w-full h-full grid place-items-center">
                        <Palette size={44} className="text-muted-foreground/12" />
                      </div>
                    )}

                    {/* Premium hover overlay with glass effect */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/0 via-black/0 to-black/0 group-hover:from-black/30 group-hover:via-black/10 group-hover:to-transparent transition-all duration-300 flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/15 backdrop-blur-md text-white text-[10px] font-display tracking-widest shadow-lg translate-y-3 group-hover:translate-y-0 border border-white/20">
                        <Eye size={12} /> VER DETALLE
                      </div>
                    </div>

                    {/* Badge row */}
                    <div className="absolute top-2.5 right-2.5 flex gap-1.5">
                      {mine ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[8px] font-display tracking-widest bg-primary/30 text-white border border-white/20 backdrop-blur-md shadow-sm">
                          TUYA
                        </span>
                      ) : owned ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[8px] font-display tracking-widest bg-emerald-500/30 text-emerald-300 border border-emerald-400/30 backdrop-blur-md shadow-sm">
                          COLECTADA
                        </span>
                      ) : price > 0 ? null : (
                        <span className="px-2.5 py-0.5 rounded-full text-[8px] font-display tracking-widest bg-emerald-500/30 text-emerald-300 border border-emerald-400/30 backdrop-blur-md shadow-sm">
                          GRATIS
                        </span>
                      )}
                    </div>

                    {/* Price pill - floating at bottom */}
                    {price > 0 && !mine && !owned && (
                      <div className="absolute bottom-2.5 left-2.5">
                        <span className="px-3 py-1 rounded-full text-[10px] font-display tracking-widest bg-gradient-to-r from-primary to-accent text-white backdrop-blur-md flex items-center gap-1.5 shadow-lg shadow-primary/20">
                          <Sparkles size={10} /> {price}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Info area */}
                  <div className="p-3.5 space-y-2">
                    <div className="text-sm font-display truncate font-semibold tracking-tight">{title}</div>
                    
                    {/* Author + actions in a row */}
                    <div className="flex items-center justify-between gap-2">
                      <Link
                        to="/profile/$userId" params={{ userId: art.author_id }}
                        onClick={e => e.stopPropagation()}
                        className="flex items-center gap-1.5 group/author min-w-0 flex-1"
                      >
                        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-primary/50 to-accent/30 grid place-items-center overflow-hidden shrink-0 ring-2 ring-border/40 group-hover/author:ring-primary/40 transition-all">
                          {art.author?.avatar_url ? (
                            <img src={art.author.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[7px] font-display text-white font-bold">
                              {(art.author?.username ?? "?")[0]?.toUpperCase()}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-muted-foreground truncate group-hover/author:text-foreground transition">
                          @{art.author?.username ?? "jugador"}
                        </span>
                      </Link>

                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60 shrink-0">
                        <button
                          onClick={e => { e.stopPropagation(); likeArt(art.id); }}
                          disabled={likingId === art.id || !myId}
                          title={myId ? (art.my_like ? "Quitar like" : "Me gusta") : "Inicia sesión para dar like"}
                          className={`flex items-center gap-0.5 rounded-md px-1 py-0.5 transition active:scale-90 disabled:opacity-50 ${
                            art.my_like ? "text-rose-400 fill-rose-400/30" : "hover:text-rose-400"
                          }`}
                        >
                          {likingId === art.id
                            ? <Loader2 size={10} className="animate-spin" />
                            : <Heart size={10} className={art.my_like ? "fill-rose-400 text-rose-400" : ""} />}
                          {art.likes}
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); setDetailPost(art); }}
                          className="flex items-center gap-0.5 rounded-md px-1 py-0.5 transition hover:text-primary active:scale-90"
                          title="Comentarios"
                        >
                          <MessageCircle size={10} />
                          {art.comments_count}
                        </button>
                      </div>
                    </div>

                    {/* Buy/Get button */}
                    {!mine && (
                      <div className="flex gap-1.5 pt-0.5">
                        {!owned && price > 0 && (
                          <span
                            onClick={e => { e.stopPropagation(); openBuy(art.id); }}
                            className="flex-1 py-1.5 rounded-lg bg-gradient-to-r from-primary to-accent text-primary-foreground text-[9px] font-display tracking-widest active:scale-95 transition text-center cursor-pointer shadow-sm"
                          >
                            COMPRAR CON <Sparkles size={8} className="inline" /> {price}
                          </span>
                        )}
                        {!owned && price === 0 && (
                          <span
                            onClick={e => { e.stopPropagation(); openBuy(art.id); }}
                            className="flex-1 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-[9px] font-display tracking-widest border border-emerald-500/20 active:scale-95 transition text-center cursor-pointer"
                          >
                            OBTENER GRATIS
                          </span>
                        )}
                        {owned && (
                          <span className="flex-1 py-1.5 rounded-lg bg-muted/30 text-muted-foreground/50 text-[9px] font-display tracking-widest text-center border border-border/30 cursor-default">
                            ✔ COLECTADA
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      )}

      {/* ====== DETAIL MODAL ====== */}
      <AnimatePresence>
        {detailPost && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[130] bg-black/70 backdrop-blur-md grid place-items-center p-4"
            onClick={() => setDetailPost(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-lg max-h-[90vh] overflow-y-auto panel border border-border/60 rounded-3xl shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              {/* Image */}
              <div className="relative bg-muted/20 rounded-2xl overflow-hidden mx-3 mt-3">
                {(detailPost.signed_media?.[0] ?? detailPost.signed_cover) ? (
                  <img
                    src={detailPost.signed_media?.[0] ?? detailPost.signed_cover}
                    alt={detailPost.content.replace(/^🎨\s*/, "")}
                    className="w-full object-contain max-h-[50vh]"
                  />
                ) : (
                  <div className="aspect-square grid place-items-center">
                    <Palette size={48} className="text-muted-foreground/20" />
                  </div>
                )}
                <button
                  onClick={() => setDetailPost(null)}
                  className="absolute top-3 right-3 w-8 h-8 grid place-items-center rounded-full bg-black/40 text-white hover:bg-black/60 transition backdrop-blur-sm"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Info */}
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-display text-base font-semibold tracking-tight">
                      {detailPost.content.replace(/^🎨\s*/, "")}
                    </div>
                    <Link
                      to="/profile/$userId" params={{ userId: detailPost.author_id }}
                      onClick={e => e.stopPropagation()}
                      className="flex items-center gap-1.5 mt-1 group/author"
                    >
                      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-primary/40 to-accent/30 grid place-items-center overflow-hidden shrink-0 ring-1 ring-border/50">
                        {detailPost.author?.avatar_url ? (
                          <img src={detailPost.author.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[7px] font-display text-primary-glow">
                            {(detailPost.author?.username ?? "?")[0]?.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-mono text-muted-foreground group-hover/author:text-foreground transition">
                        @{detailPost.author?.username ?? "anon"}
                      </span>
                      <ExternalLink size={10} className="text-muted-foreground/40" />
                    </Link>
                  </div>

                  {/* Price / Buy */}
                  {detailPost.author_id !== myId && (
                    <button
                      onClick={e => { e.stopPropagation(); setDetailPost(null); openBuy(detailPost.id); }}
                      disabled={detailPost.owned}
                      className={`shrink-0 px-4 py-2 rounded-xl text-[10px] font-display tracking-widest transition active:scale-95 ${
                        detailPost.owned
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                          : (detailPost.price_orbes ?? 0) > 0
                            ? "bg-gradient-to-r from-primary to-accent text-primary-foreground hover:shadow-lg hover:shadow-primary/20"
                            : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25"
                      }`}
                    >
                      {detailPost.owned
                        ? "✔ COLECTADA"
                        : (detailPost.price_orbes ?? 0) > 0
                          ? <span className="flex items-center gap-1"><Sparkles size={11} /> {detailPost.price_orbes}</span>
                          : "OBTENER GRATIS"}
                    </button>
                  )}
                </div>

                {/* Stats */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <button
                    onClick={e => { e.stopPropagation(); likeArt(detailPost.id); }}
                    disabled={likingId === detailPost.id || !myId}
                    title={myId ? (detailPost.my_like ? "Quitar like" : "Me gusta") : "Inicia sesión para dar like"}
                    className={`flex items-center gap-1 rounded-lg px-2 py-1.5 border transition active:scale-95 disabled:opacity-50 ${
                      detailPost.my_like
                        ? "border-rose-400/40 bg-rose-500/10 text-rose-400"
                        : "border-border hover:border-rose-400/40 hover:text-rose-400"
                    }`}
                  >
                    {likingId === detailPost.id
                      ? <Loader2 size={13} className="animate-spin" />
                      : <Heart size={13} className={detailPost.my_like ? "fill-rose-400 text-rose-400" : ""} />}
                    <span className="font-semibold tabular-nums">{detailPost.likes}</span>
                  </button>
                  <span className="flex items-center gap-1 text-muted-foreground/80">
                    <MessageCircle size={13} />
                    {detailPost.comments_count} comentario{detailPost.comments_count !== 1 ? "s" : ""}
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground/50">
                    {new Date(detailPost.created_at).toLocaleDateString("es", { month: "short", day: "numeric" })}
                  </span>
                </div>

                {/* Comments */}
                <div className="border-t border-border/40 pt-1">
                  <CommentSection
                    postId={detailPost.id}
                    myId={myId}
                    isMod={false}
                    onChange={load}
                  />
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ====== DRAWING OVERLAY (full-screen) ====== */}
      <AnimatePresence>
        {canvasOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-md flex items-center justify-center p-0"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}            className="w-full h-full overflow-hidden"
          >
              <GalleryCanvasPanel
                onSave={handleCanvasSave}
                onClose={() => setCanvasOpen(false)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ====== PUBLISH DIALOG ====== */}
      <AnimatePresence>
        {savedSprite && !pubDone && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[160] bg-black/70 backdrop-blur-md grid place-items-center p-4"
            onClick={() => { if (!publishing) setSavedSprite(null); }}
          >
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.96 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-sm panel border border-border/60 rounded-2xl p-5 space-y-4 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-accent grid place-items-center">
                  <ImagePlus size={14} className="text-primary-foreground" />
                </div>
                <div className="font-display text-sm">Publicar obra</div>
                <button onClick={() => setSavedSprite(null)} className="ml-auto w-8 h-8 grid place-items-center rounded-xl border border-border hover:bg-muted/40 transition">
                  <X size={14} />
                </button>
              </div>

              <div className="aspect-square max-h-36 rounded-xl bg-muted/20 overflow-hidden border border-border/50">
                {savedSprite.frames?.[0]?.composite && (
                  <img src={savedSprite.frames[0].composite} alt="preview" className="w-full h-full object-contain" />
                )}
              </div>

              <input
                value={pubTitle}
                onChange={e => setPubTitle(e.target.value)}
                placeholder="Título de la obra"
                maxLength={60}
                className="w-full bg-input/50 border border-border/50 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 transition"
              />

              <div>
                <div className="text-[10px] font-display tracking-widest text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Sparkles size={10} /> PRECIO EN ORBES
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number" min={0} max={9999}
                    value={pubPrice}
                    onChange={e => setPubPrice(Math.max(0, Number(e.target.value)))}
                    className="flex-1 bg-input/50 border border-border/50 rounded-xl px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <span className="text-xs text-muted-foreground">orbes</span>
                </div>
                <div className="text-[10px] text-muted-foreground/60 mt-1">0 = gratuita</div>
              </div>

              {pubErr && <div className="text-xs text-destructive">{pubErr}</div>}

              <div className="flex gap-2">
                <button
                  onClick={() => setSavedSprite(null)}
                  disabled={publishing}
                  className="flex-1 h-10 rounded-xl border border-border text-xs font-display tracking-widest active:scale-95 disabled:opacity-50 transition"
                >CANCELAR</button>
                <button
                  onClick={doPublish}
                  disabled={publishing || !pubTitle.trim()}
                  className="flex-1 h-10 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground text-xs font-display tracking-widest active:scale-95 disabled:opacity-50 transition shadow-sm"
                >
                  {publishing ? <Loader2 size={14} className="animate-spin mx-auto" /> : "PUBLICAR"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {pubDone && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[160] bg-black/70 backdrop-blur-md grid place-items-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-xs panel rounded-2xl p-6 text-center space-y-2"
            >
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 grid place-items-center mx-auto">
                <CheckCircle2 size={28} className="text-emerald-500" />
              </div>
              <div className="font-display text-base">¡Publicada!</div>
              <div className="text-xs text-muted-foreground">Tu obra ya está en la galería</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ====== BUY MODAL ====== */}
      <AnimatePresence>
        {buyPostId && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[140] bg-black/70 backdrop-blur-md grid place-items-center p-4"
            onClick={() => buyState !== "loading" && setBuyPostId(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.96 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-sm panel border border-border/60 rounded-2xl p-5 space-y-3 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              {(buyState === "idle" || buyState === "loading") && (
                <>
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/25 to-accent/20 grid place-items-center mx-auto">
                    {buyState === "loading"
                      ? <Loader2 size={22} className="animate-spin text-primary" />
                      : <Sparkles size={22} className="text-primary" />}
                  </div>
                  <h3 className="font-display text-center text-sm">
                    {buyState === "loading" ? "Procesando…" : "¿Adquirir esta obra?"}
                  </h3>
                  {balance !== null && (() => {
                    const art = artworks.find(a => a.id === buyPostId);
                    const price = art?.price_orbes ?? 0;
                    const after = balance - price;
                    return (
                      <div className="rounded-xl bg-muted/30 border border-border/60 p-3 space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Tu saldo</span>
                          <span className="font-mono tabular-nums flex items-center gap-1">
                            <Sparkles size={10} className="text-primary" /> {balance}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Precio</span>
                          <span className="font-mono tabular-nums flex items-center gap-1">
                            <Sparkles size={10} className="text-primary" /> {price}
                          </span>
                        </div>
                        <div className="border-t border-border/50 pt-2 flex items-center justify-between font-semibold">
                          <span className="text-foreground">Después</span>
                          <span className={`font-mono tabular-nums ${after < 0 ? "text-destructive" : "text-emerald-500"}`}>
                            {after < 0 ? "—" : <span className="flex items-center gap-1"><Sparkles size={10} /> {after}</span>}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                  <button
                    onClick={confirmBuy}
                    disabled={buyState === "loading" || (balance !== null && (balance - (artworks.find(a => a.id === buyPostId)?.price_orbes ?? 0) < 0))}
                    className="w-full h-10 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground text-xs font-display tracking-widest disabled:opacity-50 active:scale-[0.98] transition shadow-sm"
                  >
                    {buyState === "loading" ? <Loader2 size={14} className="animate-spin mx-auto" /> : "CONFIRMAR"}
                  </button>
                </>
              )}
              {buyState === "success" && (
                <div className="text-center py-2">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 grid place-items-center mx-auto mb-2">
                    <CheckCircle2 size={24} className="text-emerald-500" />
                  </div>
                  <h3 className="font-display text-sm">¡Adquirida!</h3>
                  <p className="text-xs text-muted-foreground mt-1">{buyMsg}</p>
                </div>
              )}        {(buyState === "insufficient" || buyState === "error") && (
                <div className="text-center py-2">
                  <div className="w-12 h-12 rounded-2xl bg-destructive/15 grid place-items-center mx-auto mb-2">
                    <AlertTriangle size={22} className="text-destructive" />
                  </div>
                  <h3 className="font-display text-sm">{buyState === "insufficient" ? "Orbes insuficientes" : "Error"}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{buyMsg}</p>
                </div>
              )}
              {buyState !== "loading" && (
                <button
                  onClick={() => setBuyPostId(null)}
                  className="w-full h-9 rounded-xl border border-border text-[10px] font-display tracking-widest active:scale-95 transition"
                >{buyState === "success" ? "ENTENDIDO" : "CANCELAR"}</button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
