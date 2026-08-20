import { useEffect, useState, useCallback } from "react";
import { Avatar } from "./Avatar";
import { motion, AnimatePresence } from "framer-motion";
import {
  Store, Palette, Package, Sparkles, X, Loader2, Heart, Search,
  DollarSign, Gift, Eye, ShoppingCart, Star, TrendingUp, Clock,
  Upload, Plus, CheckCircle2, AlertTriangle, ExternalLink, EyeOff, ShieldCheck,
  Gamepad2, Layers, User, Box, Skull, CircleDollarSign, Flag, Flower2,
  MessageCircle, Bookmark, Download, ZoomIn,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  type PostWithMeta, type Profile,
  fetchArtworks, fetchMyArtworks, purchaseArtwork, publishArtwork,
  getMyProfile, getMyOrbes, toggleReaction,
} from "@/lib/social/api";
import { CommentSection } from "@/components/social/CommentSection";

type StoreTab = "shop" | "gallery";

/* ═══════════════════════════════════════════════════════
   IMAGE VIEWER — Lightbox para ver imágenes completas
   ═══════════════════════════════════════════════════════ */
function ImageViewer({
  src, alt, onClose,
}: {
  src: string; alt: string; onClose: () => void;
}) {
  if (!src) return null;
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex flex-col"
      onClick={onClose}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <span className="text-white/60 text-xs font-medium truncate max-w-[70%]">{alt || "Vista completa"}</span>
        <div className="flex items-center gap-2">
          <a href={src} download target="_blank" rel="noopener"
            onClick={e => e.stopPropagation()}
            className="w-8 h-8 rounded-lg bg-white/10 grid place-items-center hover:bg-white/20 transition">
            <Download size={14} className="text-white/70" />
          </a>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 grid place-items-center hover:bg-white/20 transition">
            <X size={14} className="text-white/70" />
          </button>
        </div>
      </div>
      {/* Image — se adapta al tamaño de pantalla sin recortar */}
      <div className="flex-1 flex items-center justify-center px-4 pb-4 overflow-auto" onClick={e => e.stopPropagation()}>
        <img
          src={src} alt={alt}
          className="max-w-full max-h-full object-contain rounded-lg select-none"
          style={{ width: "auto", height: "auto" }}
          draggable={false}
        />
      </div>
    </motion.div>
  );
}

function timeAgo(iso: string) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60); if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24); return `${d}d`;
}

/* ═══════════════════════════════════════════════════════
   ASSET CARD — Mini-publicación completa
   ═══════════════════════════════════════════════════════ */
function AssetCard({
  post, myId, onBuy, onRefresh, onViewImage,
}: {
  post: PostWithMeta; myId: string | null;
  onBuy: (p: PostWithMeta) => void; onRefresh: () => void;
  onViewImage: (src: string, alt: string) => void;
}) {
  const [openComments, setOpenComments] = useState(false);
  const author = post.author;
  const isFree = !post.price_orbes || post.price_orbes === 0;
  const isOwn = post.author_id === myId;

  // Parse content: first line = title, rest = description + hashtags
  const lines = post.content.split("\n");
  const titleText = (lines[0] || "Asset").replace(/^🎮🎨\s*/, "").slice(0, 60);
  const descLines = lines.slice(1).filter(l => l.trim() && !l.startsWith("#"));
  const description = descLines.join(" ").trim();
  const hashtags = post.tags?.length
    ? post.tags
    : lines.filter(l => l.startsWith("#")).flatMap(l => l.match(/#[\w-]+/g) ?? []);
  const imgSrc = post.signed_cover || post.signed_media?.[0] || null;

  const react = async (type: "like" | "favorite") => {
    await toggleReaction({ postId: post.id, type });
    onRefresh();
  };

  return (
    <div className="rounded-xl border border-border/40 bg-card overflow-hidden hover:border-primary/25 transition-all duration-200 group">
      {/* Cover image — se adapta sin recortar */}
      <div className="relative w-full bg-gradient-to-br from-primary/5 to-primary/10 overflow-hidden">
        {imgSrc ? (
          <div className="relative w-full cursor-pointer" onClick={() => onViewImage(imgSrc, titleText)}>
            <img src={imgSrc} alt=""
              className="w-full h-auto max-h-[320px] object-contain group-hover:opacity-90 transition-opacity duration-300" />
            {/* Zoom badge */}
            <div className="absolute bottom-2 right-2 w-7 h-7 rounded-lg bg-black/40 backdrop-blur-sm grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity">
              <ZoomIn size={13} className="text-white" />
            </div>
          </div>
        ) : (
          <div className="w-full h-40 grid place-items-center">
            <Package size={32} className="text-primary/20" />
          </div>
        )}
        {/* Price badge */}
        <div className="absolute top-2 right-2">
          {isFree ? (
            <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-500/90 text-white backdrop-blur-sm">
              GRATIS
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-primary/90 text-white backdrop-blur-sm flex items-center gap-1">
              <Sparkles size={10} /> {post.price_orbes}
            </span>
          )}
        </div>
      </div>

      {/* Info — mini-publicación */}
      <div className="p-3 space-y-2">
        {/* Author */}
        {author && (
          <Link to="/profile/$userId" params={{ userId: post.author_id }} className="flex items-center gap-2 hover:opacity-80 transition">
            <Avatar p={author} className="w-6 h-6" />
            <div>
              <div className="text-[11px] font-semibold leading-tight">@{author.username}</div>
              <div className="text-[9px] text-muted-foreground/50">{timeAgo(post.created_at)}</div>
            </div>
          </Link>
        )}

        {/* Title */}
        <div className="text-sm font-bold leading-snug group-hover:text-primary transition-colors">
          {titleText}
        </div>

        {/* Description */}
        {description && (
          <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-3">
            {description}
          </p>
        )}

        {/* Hashtags */}
        {hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {hashtags.slice(0, 5).map((tag, i) => (
              <span key={i} className="text-[9px] text-primary/70 font-medium">{tag.startsWith("#") ? tag : `#${tag}`}</span>
            ))}
          </div>
        )}

        {/* Asset preset attributes */}
        {(() => {
          const ap = post.asset_preset as Record<string, unknown> | null | undefined;
          if (!ap) return null;
          const k = ap.kind as string | undefined;
          const c = ap.color as string | undefined;
          const w = ap.w as number | undefined;
          const h = ap.h as number | undefined;
          const hasScripts = Array.isArray(ap.scripts) && ap.scripts.length > 0;
          return (
            <div className="flex flex-wrap gap-1">
              {k && <span className="px-1.5 py-0.5 rounded text-[8px] font-semibold uppercase tracking-wider bg-primary/8 text-primary/70 border border-primary/10">{k.toUpperCase()}</span>}
              {c && <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-medium bg-muted/40 border border-border/30"><span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: c }} />color</span>}
              {w && h && <span className="px-1.5 py-0.5 rounded text-[8px] font-mono text-muted-foreground/50 bg-muted/30 border border-border/20">{w}×{h}</span>}
              {!!ap.solid && <span className="px-1.5 py-0.5 rounded text-[8px] font-medium bg-amber-500/8 text-amber-600 border border-amber-500/10">solid</span>}
              {!!ap.texture && <span className="px-1.5 py-0.5 rounded text-[8px] font-medium bg-violet-500/8 text-violet-600 border border-violet-500/10">textura</span>}
              {!!ap.moving && <span className="px-1.5 py-0.5 rounded text-[8px] font-medium bg-cyan-500/8 text-cyan-600 border border-cyan-500/10">móvil</span>}
              {hasScripts && <span className="px-1.5 py-0.5 rounded text-[8px] font-medium bg-emerald-500/8 text-emerald-600 border border-emerald-500/10">scripts</span>}
            </div>
          );
        })()}

        {/* Stats */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground/70 pt-1">
          <button onClick={() => react("like")} className={`flex items-center gap-1.5 transition ${post.my_like ? "text-red-500" : "hover:text-red-400"}`}>
            <Heart size={14} className={post.my_like ? "fill-current" : ""} /> {post.likes}
          </button>
          <button onClick={() => setOpenComments(!openComments)} className="flex items-center gap-1.5 hover:text-primary transition">
            <MessageCircle size={14} /> {post.comments_count}
          </button>
          <button onClick={() => react("favorite")} className={`flex items-center gap-1.5 transition ${post.my_favorite ? "text-amber-500" : "hover:text-amber-400"}`}>
            <Bookmark size={14} className={post.my_favorite ? "fill-current" : ""} /> {post.favorites}
          </button>
        </div>

        {/* Comments section */}
        {openComments && (
          <div className="pt-2 border-t border-border/30">
            <CommentSection postId={post.id} myId={myId} isMod={false} onChange={onRefresh} />
          </div>
        )}

        {/* Buy / Info */}
        <div className="flex gap-2 pt-1">
          {isOwn ? (
            <span className="flex-1 h-8 rounded-lg bg-muted/50 grid place-items-center text-[10px] text-muted-foreground font-medium">
              Tu asset
            </span>
          ) : (
            <button
              onClick={() => onBuy(post)}
              className={`flex-1 h-8 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition active:scale-[0.97] ${
                isFree
                  ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/15 border border-emerald-500/20"
                  : "bg-primary/10 text-primary hover:bg-primary/15 border border-primary/20"
              }`}
            >
              {isFree ? <Gift size={12} /> : <ShoppingCart size={12} />}
              {isFree ? "Descargar" : `${post.price_orbes} orbes`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   PUBLISH ASSET DIALOG
   ═══════════════════════════════════════════════════════ */
function PublishAssetDialog({
  open, onClose, onPublished,
}: {
  open: boolean; onClose: () => void; onPublished: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [price, setPrice] = useState(0);
  const [libraryItems, setLibraryItems] = useState<Array<{ id: string; name: string; preset: Record<string, unknown> }>>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [loadingLib, setLoadingLib] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoadingLib(true);
    (async () => {
      try {
        const { pullAssetLibraryFromCloud } = await import("@/lib/engine/cloud-sync");
        const items = await pullAssetLibraryFromCloud();
        setLibraryItems((items ?? []).map((i) => ({ id: i.id, name: i.name, preset: i.preset as Record<string, unknown> })));
      } catch {
        setLibraryItems([]);
      } finally {
        setLoadingLib(false);
      }
    })();
  }, [open]);

  const selectedItem = libraryItems.find(i => i.id === selectedItemId);

  const handlePublish = async () => {
    if (!selectedItem) { setError("Selecciona un asset de tu biblioteca"); return; }
    if (!title.trim()) { setError("Escribe un título"); return; }
    setPublishing(true); setError(null);
    try {
      const texture = selectedItem.preset.texture as string | undefined | null;
      const coverDataUrl = texture || "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      const parsedTags = tagsInput.split(/[, ]+/).map(t => t.replace(/^#/, '').trim()).filter(Boolean);
      await publishArtwork({
        title: title.trim(),
        description: description.trim() || undefined,
        imageDataUrl: coverDataUrl,
        priceOrbes: price,
        assetPreset: { ...selectedItem.preset, id: undefined },
        tags: parsedTags.length ? parsedTags : undefined,
      });
      setDone(true);
      setTimeout(() => {
        onPublished();
        onClose();
        setDone(false); setTitle(""); setDescription(""); setTagsInput(""); setPrice(0); setSelectedItemId(null);
      }, 1200);
    } catch (e) { setError((e as Error).message); setPublishing(false); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md max-h-[85vh] rounded-2xl bg-card border border-border/50 flex flex-col shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 pb-3 shrink-0">
          <div>
            <h3 className="font-display text-sm font-bold">Publicar en la Tienda</h3>
            <p className="text-[10px] text-muted-foreground/60 mt-0.5">Solo se pueden publicar assets de tu biblioteca del editor</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-muted grid place-items-center"><X size={14} /></button>
        </div>

        {done ? (
          <div className="py-8 text-center space-y-2">
            <CheckCircle2 size={32} className="text-emerald-500 mx-auto" />
            <div className="text-sm font-semibold">¡Publicado!</div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 pt-0 space-y-3">
            {/* Library assets selector */}
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Asset de la biblioteca *</label>
              {loadingLib ? (
                <div className="flex items-center justify-center py-8 gap-2">
                  <Loader2 size={16} className="animate-spin text-primary/40" />
                  <span className="text-xs text-muted-foreground/50">Cargando biblioteca…</span>
                </div>
              ) : libraryItems.length === 0 ? (
                <div className="py-8 text-center space-y-2">
                  <div className="w-12 h-12 mx-auto rounded-xl bg-muted/30 border border-border/30 grid place-items-center">
                    <Package size={18} className="text-muted-foreground/25" />
                  </div>
                  <div className="text-xs text-muted-foreground/60">No tienes assets en la biblioteca</div>
                  <div className="text-[10px] text-muted-foreground/40">Guarda recursos en el editor para venderlos aquí</div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 mt-1.5 max-h-[180px] overflow-y-auto pr-1">
                  {libraryItems.map(item => {
                    const tex = item.preset.texture as string | undefined | null;
                    const kind = (item.preset.kind as string) || "entity";
                    const isSelected = selectedItemId === item.id;
                    return (
                      <button key={item.id} onClick={() => setSelectedItemId(item.id)}
                        className={`relative rounded-xl border p-2 text-left transition-all ${
                          isSelected
                            ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20"
                            : "border-border/40 bg-muted/20 hover:border-primary/20"
                        }`}>
                        <div className="w-full aspect-square rounded-lg bg-muted/40 flex items-center justify-center overflow-hidden mb-1.5">
                          {tex ? (
                            <img src={tex} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            <Layers size={16} className="text-muted-foreground/30" />
                          )}
                        </div>
                        <div className="text-[10px] font-medium truncate" title={item.name}>{item.name}</div>
                        <div className="text-[9px] text-muted-foreground/40 uppercase">{kind}</div>
                        {isSelected && (
                          <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-primary grid place-items-center">
                            <CheckCircle2 size={10} className="text-white" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {selectedItem && (
              <>
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Título *</label>
                  <input value={title} onChange={e => setTitle(e.target.value)} placeholder={selectedItem.name || "Nombre del asset"}
                    className="w-full h-10 px-3 mt-1 rounded-lg bg-muted/40 border border-border/40 text-sm outline-none focus:border-primary/40 transition" />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Descripción</label>
                  <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe tu asset..."
                    rows={3} className="w-full px-3 mt-1 rounded-lg bg-muted/40 border border-border/40 text-sm outline-none focus:border-primary/40 transition resize-none" />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Hashtags</label>
                  <input value={tagsInput} onChange={e => setTagsInput(e.target.value)} placeholder="plataforma, pixel-art, aventura..."
                    className="w-full h-9 px-3 mt-1 rounded-lg bg-muted/40 border border-border/40 text-sm outline-none focus:border-primary/40 transition" />
                  <div className="text-[9px] text-muted-foreground/40 mt-1">Separados por comas. Se publicarán como #hashtags</div>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Precio en orbes</label>
                  <div className="flex items-center gap-2 mt-1">
                    <input type="number" min={0} value={price} onChange={e => setPrice(Number(e.target.value))}
                      className="w-24 h-10 px-3 rounded-lg bg-muted/40 border border-border/40 text-sm outline-none focus:border-primary/40 transition" />
                    <span className="text-xs text-muted-foreground">0 = Gratis</span>
                  </div>
                </div>
              </>
            )}

            {error && <div className="text-xs text-red-500 flex items-center gap-1.5"><AlertTriangle size={12} /> {error}</div>}

            <button onClick={handlePublish} disabled={publishing || !selectedItem || !title.trim()}
              className="w-full h-10 rounded-lg bg-primary text-white text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition disabled:opacity-50">
              {publishing ? <><Loader2 size={14} className="animate-spin" /> Publicando…</> : <><Upload size={14} /> Publicar</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   BUY CONFIRMATION DIALOG
   ═══════════════════════════════════════════════════════ */
function BuyDialog({
  post, myId, balance, onClose, onBought,
}: {
  post: PostWithMeta; myId: string; balance: number;
  onClose: () => void; onBought: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<"ok" | "insufficient" | "error" | null>(null);

  const isFree = !post.price_orbes || post.price_orbes === 0;
  const canAfford = isFree || balance >= (post.price_orbes ?? 0);

  const handleBuy = async () => {
    setLoading(true);
    try {
      await purchaseArtwork(post.id);
      setResult("ok");
      onBought();
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes("insufficient") || msg.includes("insuficiente")) setResult("insufficient");
      else setResult("error");
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-card border border-border/50 p-5 space-y-4 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-display text-sm font-bold">{isFree ? "Descargar" : "Comprar asset"}</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-muted grid place-items-center"><X size={14} /></button>
        </div>
        {result === "ok" ? (
          <div className="py-6 text-center space-y-2">
            <CheckCircle2 size={32} className="text-emerald-500 mx-auto" />
            <div className="text-sm font-semibold">{isFree ? "¡Descargado!" : "¡Comprado!"}</div>
          </div>
        ) : result === "insufficient" ? (
          <div className="py-6 text-center space-y-2">
            <AlertTriangle size={32} className="text-amber-500 mx-auto" />
            <div className="text-sm font-semibold">Orbes insuficientes</div>
            <div className="text-xs text-muted-foreground">Tienes {balance} orbes. Necesitas {post.price_orbes}.</div>
          </div>
        ) : (
          <>
            <div className="text-sm text-muted-foreground">
              {isFree
                ? `Descargar "${(post.content.split("\n")[0] || "Asset").slice(0, 40)}" gratis`
                : `Comprar "${(post.content.split("\n")[0] || "Asset").slice(0, 40)}" por ${post.price_orbes} orbes`
              }
            </div>
            {!isFree && (
              <div className="text-xs text-muted-foreground/70">Tu saldo: {balance} orbes</div>
            )}
            {result === "error" && <div className="text-xs text-red-500">Error al procesar. Intenta de nuevo.</div>}
            <button onClick={handleBuy} disabled={loading || !canAfford}
              className="w-full h-10 rounded-lg bg-primary text-white text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.97] transition disabled:opacity-50">
              {loading ? <Loader2 size={14} className="animate-spin" /> : isFree ? <Gift size={14} /> : <ShoppingCart size={14} />}
              {isFree ? "Descargar gratis" : `Pagar ${post.price_orbes} orbes`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   STORE SECTION — Main component
   ═══════════════════════════════════════════════════════ */
export function StoreSection({ myId, isMod: _isMod, onRefresh }: {
  myId: string | null; isMod: boolean; onRefresh?: () => void;
}) {
  const [storeTab, setStoreTab] = useState<StoreTab>("shop");
  const [artworks, setArtworks] = useState<PostWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [shopFilter, setShopFilter] = useState<"all" | "free" | "paid" | "popular">("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "player" | "platform" | "enemy" | "coin" | "goal" | "decor">("all");
  const [balance, setBalance] = useState<number | null>(null);

  // Dialogs
  const [publishOpen, setPublishOpen] = useState(false);
  const [buyPost, setBuyPost] = useState<PostWithMeta | null>(null);
  const [detailPost, setDetailPost] = useState<PostWithMeta | null>(null);
  const [viewImageSrc, setViewImageSrc] = useState<string | null>(null);
  const [viewImageAlt, setViewImageAlt] = useState("");
  const openImageViewer = (src: string, alt: string) => { setViewImageSrc(src); setViewImageAlt(alt); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [arts, p] = await Promise.all([
        fetchArtworks(),
        getMyProfile(),
      ]);
      setArtworks(arts);
      if (p) { setProfile(p); setBalance(p.orbes ?? 0); }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleBuy = () => { setBuyPost(null); load(); onRefresh?.(); };

  // Tienda: solo assets del editor (tienen asset_preset)
  const shopItems = artworks
    .filter(a => !!a.asset_preset)
    .filter(a => {
      if (categoryFilter !== "all") {
        const kind = (a.asset_preset as Record<string, unknown> | null)?.kind;
        if (kind !== categoryFilter) return false;
      }
      return true;
    })
    .filter(a => {
      if (shopFilter === "free") return !a.price_orbes || a.price_orbes === 0;
      if (shopFilter === "paid") return (a.price_orbes ?? 0) > 0;
      return true;
    }).filter(a => {
      if (!searchQ.trim()) return true;
      const q = searchQ.toLowerCase();
      return a.content.toLowerCase().includes(q) || a.author?.username?.toLowerCase().includes(q);
    }).sort((a, b) => {
      if (shopFilter === "popular") return (b.likes ?? 0) - (a.likes ?? 0);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  // Galería: solo obras de arte tradicionales (sin asset_preset)
  const galleryItems = artworks
    .filter(a => !a.asset_preset)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div className="space-y-4">
      {/* Sub-tabs: Tienda / Galería */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1 p-1 bg-muted/40 rounded-xl flex-1">
          <button
            onClick={() => setStoreTab("shop")}
            className={`flex-1 h-9 rounded-lg text-[11px] font-semibold tracking-wide flex items-center justify-center gap-1.5 transition-all ${
              storeTab === "shop" ? "grad-brand text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Store size={13} /> Tienda
          </button>
          <button
            onClick={() => setStoreTab("gallery")}
            className={`flex-1 h-9 rounded-lg text-[11px] font-semibold tracking-wide flex items-center justify-center gap-1.5 transition-all ${
              storeTab === "gallery" ? "grad-brand text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Palette size={13} /> Galería
          </button>
        </div>

        {/* Publish button */}
        {myId && (
          <button
            onClick={() => setPublishOpen(true)}
            className="h-9 px-3 rounded-lg bg-primary/10 text-primary text-[11px] font-semibold flex items-center gap-1.5 hover:bg-primary/15 transition border border-primary/15 shrink-0"
          >
            <Plus size={13} /> Vender
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {storeTab === "shop" ? (
          <motion.div key="shop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }} className="space-y-4">
            {/* Search + Filters */}
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/30 pointer-events-none" />
              <input
                value={searchQ} onChange={e => setSearchQ(e.target.value)}
                placeholder="Buscar assets, textures, plantillas…"
                className="w-full h-10 pl-10 pr-4 rounded-xl bg-muted/40 border border-border/40 text-sm outline-none focus:border-primary/40 transition placeholder:text-muted-foreground/35"
              />
            </div>

            {/* Price filter pills */}
            <div className="flex gap-1.5 flex-wrap">
              {([["all", "Todos"], ["free", "Gratis"], ["paid", "De pago"], ["popular", "Populares"]] as const).map(([id, label]) => (
                <button
                  key={id} onClick={() => setShopFilter(id)}
                  className={`h-7 px-3 rounded-lg text-[10px] font-semibold tracking-wide transition-all ${
                    shopFilter === id
                      ? "bg-primary/10 text-primary border border-primary/20"
                      : "bg-muted/40 text-muted-foreground border border-transparent hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Category filter — tipo de asset */}
            <div className="flex gap-1.5 flex-wrap">
              {([
                ["all", "Todos", Package],
                ["player", "Jugadores", User],
                ["platform", "Plataformas", Box],
                ["enemy", "Enemigos", Skull],
                ["coin", "Monedas", CircleDollarSign],
                ["goal", "Metas", Flag],
                ["decor", "Decoración", Flower2],
              ] as const).map(([id, label, Icon]) => (
                <button
                  key={id} onClick={() => setCategoryFilter(id)}
                  className={`h-7 px-2.5 rounded-lg text-[10px] font-semibold tracking-wide flex items-center gap-1 transition-all ${
                    categoryFilter === id
                      ? "bg-primary/10 text-primary border border-primary/20"
                      : "bg-muted/40 text-muted-foreground border border-transparent hover:text-foreground"
                  }`}
                >
                  <Icon size={10} /> {label}
                </button>
              ))}
            </div>

            {/* Stats bar */}
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground/60">
              <span>{shopItems.length} assets</span>
              {balance !== null && (
                <span className="flex items-center gap-1 ml-auto">
                  <Sparkles size={10} className="text-primary" /> {balance} orbes
                </span>
              )}
            </div>

            {/* Grid */}
            {loading ? (
              <div className="flex items-center justify-center py-12 gap-2">
                <Loader2 size={18} className="animate-spin text-primary/40" />
                <span className="text-xs text-muted-foreground/50">Cargando tienda…</span>
              </div>
            ) : shopItems.length === 0 ? (
              <div className="text-center py-16 space-y-3">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-muted/30 border border-border/30 grid place-items-center">
                  <Store size={22} className="text-muted-foreground/25" />
                </div>
                <div className="text-sm text-muted-foreground/60 font-medium">No hay assets aún</div>
                <div className="text-[11px] text-muted-foreground/40">Sé el primero en publicar en la tienda</div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {shopItems.map(p => (
                  <div key={p.id} className="card-enter" style={{ animationDelay: "0ms" }}>
                    <AssetCard
                      post={p} myId={myId}
                      onBuy={setBuyPost}
                      onRefresh={load}
                      onViewImage={openImageViewer}
                    />
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div key="gallery" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
            <GallerySubSection artworks={galleryItems} loading={loading} myId={myId} profile={profile} onRefresh={load} onViewImage={openImageViewer} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Publish Dialog */}
      <PublishAssetDialog open={publishOpen} onClose={() => setPublishOpen(false)} onPublished={load} />

      {/* Buy Dialog */}
      {buyPost && myId && balance !== null && (
        <BuyDialog post={buyPost} myId={myId} balance={balance} onClose={() => setBuyPost(null)} onBought={handleBuy} />
      )}

      {/* Detail Modal */}
      {detailPost && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={() => setDetailPost(null)}>
          <div className="w-full max-w-lg max-h-[85vh] bg-card rounded-t-2xl sm:rounded-2xl overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-card/90 backdrop-blur-sm border-b border-border/30 px-4 py-3 flex items-center justify-between z-10">
              <h3 className="font-display text-sm font-bold truncate">Detalle del asset</h3>
              <button onClick={() => setDetailPost(null)} className="w-7 h-7 rounded-lg hover:bg-muted grid place-items-center"><X size={14} /></button>
            </div>
            <div className="p-4">
              <CommentSection postId={detailPost.id} myId={myId} isMod={false} onChange={() => {}} />
            </div>
          </div>
        </div>
      )}

      {/* Image Viewer / Lightbox */}
      <AnimatePresence>
        {viewImageSrc && (
          <ImageViewer src={viewImageSrc} alt={viewImageAlt} onClose={() => setViewImageSrc(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   GALLERY SUB-SECTION — inside the Store
   ═══════════════════════════════════════════════════════ */
function GallerySubSection({
  artworks, loading, myId, profile, onRefresh, onViewImage,
}: {
  artworks: PostWithMeta[]; loading: boolean; myId: string | null;
  profile: Profile | null; onRefresh: () => void;
  onViewImage: (src: string, alt: string) => void;
}) {
  const [openCommentsId, setOpenCommentsId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"recent" | "popular" | "free">("recent");

  const items = artworks
    .filter(a => {
      if (filter === "free") return !a.price_orbes || a.price_orbes === 0;
      return true;
    })
    .sort((a, b) => {
      if (filter === "popular") return (b.likes ?? 0) - (a.likes ?? 0);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const react = async (postId: string, type: "like" | "favorite") => {
    await toggleReaction({ postId, type });
    onRefresh();
  };

  return (
    <div className="space-y-4">
      {/* Filter pills */}
      <div className="flex gap-1.5">
        {([["recent", "Recientes", Clock], ["popular", "Populares", TrendingUp], ["free", "Gratis", Gift]] as const).map(([id, label, Icon]) => (
          <button
            key={id} onClick={() => setFilter(id)}
            className={`h-7 px-3 rounded-lg text-[10px] font-semibold tracking-wide flex items-center gap-1 transition-all ${
              filter === id
                ? "bg-primary/10 text-primary border border-primary/20"
                : "bg-muted/40 text-muted-foreground border border-transparent hover:text-foreground"
            }`}
          >
            <Icon size={10} /> {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 gap-2">
          <Loader2 size={18} className="animate-spin text-primary/40" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-xs text-muted-foreground/50">
          No hay obras en la galería aún
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(p => {
            const lines = p.content.split("\n");
            const titleText = (lines[0] || "Sin título").replace(/^🎮🎨\s*/, "").slice(0, 60);
            const descLines = lines.slice(1).filter(l => l.trim() && !l.startsWith("#"));
            const description = descLines.join(" ").trim();
            const hashtags = p.tags?.length
              ? p.tags
              : lines.filter(l => l.startsWith("#")).flatMap(l => l.match(/#[\w-]+/g) ?? []);
            const isOpen = openCommentsId === p.id;

            return (
              <div key={p.id} className="rounded-xl border border-border/40 bg-card overflow-hidden hover:border-primary/20 transition-all group">
                {/* Image — se adapta sin recortar */}
                {(p.signed_cover || p.signed_media?.[0]) && (
                  <div className="relative w-full bg-gradient-to-br from-primary/5 to-primary/10 overflow-hidden cursor-pointer"
                    onClick={() => onViewImage(p.signed_cover || p.signed_media?.[0] || '', (lines[0] || 'Obra').replace(/^🎮🎨\s*/, '').slice(0, 60))}>
                    <img src={p.signed_cover || p.signed_media?.[0]} alt=""
                      className="w-full h-auto max-h-[400px] object-contain group-hover:opacity-90 transition-opacity duration-300" />
                    {/* Zoom badge */}
                    <div className="absolute bottom-2 right-2 w-7 h-7 rounded-lg bg-black/40 backdrop-blur-sm grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <ZoomIn size={13} className="text-white" />
                    </div>
                    {(p.price_orbes ?? 0) > 0 && (
                      <div className="absolute top-2 right-2">
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-primary/90 text-white backdrop-blur-sm flex items-center gap-1">
                          <Sparkles size={10} /> {p.price_orbes}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <div className="p-3 space-y-2">
                  {/* Author */}
                  <Link to="/profile/$userId" params={{ userId: p.author_id }} className="flex items-center gap-2 hover:opacity-80 transition">
                    <Avatar p={p.author} className="w-6 h-6" />
                    <div>
                      <div className="text-[11px] font-semibold leading-tight">@{p.author?.username ?? "…"}</div>
                      <div className="text-[9px] text-muted-foreground/50">{timeAgo(p.created_at)}</div>
                    </div>
                  </Link>

                  {/* Title */}
                  <div className="text-sm font-bold leading-snug group-hover:text-primary transition-colors">
                    {titleText}
                  </div>

                  {/* Description */}
                  {description && (
                    <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-3">
                      {description}
                    </p>
                  )}

                  {/* Hashtags */}
                  {hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {hashtags.slice(0, 5).map((tag, i) => (
                        <span key={i} className="text-[9px] text-primary/70 font-medium">{tag.startsWith("#") ? tag : `#${tag}`}</span>
                      ))}
                    </div>
                  )}

                  {/* Stats + Actions */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground/70 pt-1">
                    <button onClick={() => react(p.id, "like")} className={`flex items-center gap-1.5 transition ${p.my_like ? "text-red-500" : "hover:text-red-400"}`}>
                      <Heart size={14} className={p.my_like ? "fill-current" : ""} /> {p.likes}
                    </button>
                    <button onClick={() => setOpenCommentsId(isOpen ? null : p.id)} className={`flex items-center gap-1.5 transition ${isOpen ? "text-primary" : "hover:text-primary"}`}>
                      <MessageCircle size={14} /> {p.comments_count}
                    </button>
                    <button onClick={() => react(p.id, "favorite")} className={`flex items-center gap-1.5 transition ${p.my_favorite ? "text-amber-500" : "hover:text-amber-400"}`}>
                      <Bookmark size={14} className={p.my_favorite ? "fill-current" : ""} /> {p.favorites}
                    </button>
                    {(p.price_orbes ?? 0) > 0 && (
                      <span className="flex items-center gap-0.5 ml-auto"><Sparkles size={10} className="text-primary" /> {p.price_orbes}</span>
                    )}
                  </div>

                  {/* Comments */}
                  {isOpen && (
                    <div className="pt-2 border-t border-border/30">
                      <CommentSection postId={p.id} myId={myId} isMod={false} onChange={onRefresh} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

          </div>
  );
}
