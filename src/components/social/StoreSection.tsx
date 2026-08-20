import { useEffect, useState, useCallback } from "react";
import { Avatar } from "./Avatar";
import { motion, AnimatePresence } from "framer-motion";
import {
  Store, Palette, Package, Sparkles, X, Loader2, Heart, Search,
  DollarSign, Gift, Eye, ShoppingCart, Star, TrendingUp, Clock,
  Upload, Plus, CheckCircle2, AlertTriangle, ExternalLink, EyeOff, ShieldCheck,
  Gamepad2, Layers,
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
   ASSET CARD — for the Shop sub-tab
   ═══════════════════════════════════════════════════════ */
function AssetCard({
  post, myId, onBuy, onLike,
}: {
  post: PostWithMeta; myId: string | null;
  onBuy: (p: PostWithMeta) => void; onLike: (p: PostWithMeta) => void;
}) {
  const author = post.author;
  const isFree = !post.price_orbes || post.price_orbes === 0;
  const isOwn = post.author_id === myId;

  return (
    <div className="rounded-xl border border-border/40 bg-card overflow-hidden hover:border-primary/25 transition-all duration-200 group">
      {/* Cover image */}
      <div className="relative w-full aspect-[4/3] bg-gradient-to-br from-primary/5 to-primary/10 overflow-hidden">
        {post.signed_cover ? (
          <img src={post.signed_cover} alt="" className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300" />
        ) : post.signed_media?.[0] ? (
          <img src={post.signed_media[0]} alt="" className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300" />
        ) : (
          <div className="w-full h-full grid place-items-center">
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

      {/* Info */}
      <div className="p-3 space-y-2">
        <div className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
          {          (post.content.split("\n")[0] || "Asset").replace(/^🎮🎨\s*/, "").slice(0, 50)}
        </div>

        {author && (
          <div className="flex items-center gap-2">
            <Avatar p={author} className="w-5 h-5" />
            <span className="text-[11px] text-muted-foreground truncate">@{author.username}</span>
          </div>
        )}

        <div className="flex items-center gap-3 text-[10px] text-muted-foreground/60">
          <span className="flex items-center gap-0.5"><Heart size={9} /> {post.likes}</span>
          <span className="flex items-center gap-0.5"><Eye size={9} /> {post.comments_count}</span>
        </div>

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
            <div className="flex flex-wrap gap-1 pt-0.5">
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

        {/* Action */}
        <div className="flex gap-2 pt-1">
          {isOwn ? (
            <span className="flex-1 h-8 rounded-lg bg-muted/50 grid place-items-center text-[10px] text-muted-foreground font-medium">
              Tu asset
            </span>
          ) : (
            <button
              onClick={() => isFree ? onBuy(post) : onBuy(post)}
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
          <button
            onClick={() => onLike(post)}
            className="w-8 h-8 rounded-lg border border-border/40 grid place-items-center hover:bg-muted/50 transition"
          >
            <Heart size={13} className={post.my_like ? "text-red-500 fill-red-500" : "text-muted-foreground/50"} />
          </button>
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
      await publishArtwork({
        title: title.trim(),
        imageDataUrl: coverDataUrl,
        priceOrbes: price,
        assetPreset: { ...selectedItem.preset, id: undefined },
      });
      setDone(true);
      setTimeout(() => {
        onPublished();
        onClose();
        setDone(false); setTitle(""); setDescription(""); setPrice(0); setSelectedItemId(null);
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
                    rows={2} className="w-full px-3 mt-1 rounded-lg bg-muted/40 border border-border/40 text-sm outline-none focus:border-primary/40 transition resize-none" />
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
  const [balance, setBalance] = useState<number | null>(null);

  // Dialogs
  const [publishOpen, setPublishOpen] = useState(false);
  const [buyPost, setBuyPost] = useState<PostWithMeta | null>(null);
  const [detailPost, setDetailPost] = useState<PostWithMeta | null>(null);

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

            {/* Filter pills */}
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
                      onLike={() => toggleReaction({ postId: p.id, type: "like" }).then(load)}
                    />
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div key="gallery" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
            <GallerySubSection artworks={galleryItems} loading={loading} myId={myId} profile={profile} onRefresh={load} />
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
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   GALLERY SUB-SECTION — inside the Store
   ═══════════════════════════════════════════════════════ */
function GallerySubSection({
  artworks, loading, myId, profile, onRefresh,
}: {
  artworks: PostWithMeta[]; loading: boolean; myId: string | null;
  profile: Profile | null; onRefresh: () => void;
}) {
  const [detailPost, setDetailPost] = useState<PostWithMeta | null>(null);
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
        <div className="space-y-2">
          {items.map(p => (
            <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/40 bg-card hover:border-primary/20 transition-all group">
              {p.signed_cover ? (
                <img src={p.signed_cover} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" />
              ) : p.signed_media?.[0] ? (
                <img src={p.signed_media[0]} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" />
              ) : (
                <div className="w-14 h-14 rounded-lg bg-primary/5 grid place-items-center shrink-0">
                  <Palette size={18} className="text-primary/20" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                  {(p.content.split("\n")[0] || "Sin título").replace(/^🎮🎨\s*/, "").slice(0, 50)}
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground/60">
                  <span>@{p.author?.username ?? "…"}</span>
                  <span>·</span>
                  <span className="flex items-center gap-0.5"><Heart size={8} /> {p.likes}</span>
                  {(p.price_orbes ?? 0) > 0 && (
                    <span className="flex items-center gap-0.5"><Sparkles size={8} className="text-primary" /> {p.price_orbes}</span>
                  )}
                </div>
              </div>
              <button onClick={() => setDetailPost(p)}
                className="w-7 h-7 rounded-lg border border-border/40 grid place-items-center hover:bg-muted/50 transition shrink-0">
                <Eye size={12} className="text-muted-foreground/40" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {detailPost && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={() => setDetailPost(null)}>
          <div className="w-full max-w-lg max-h-[85vh] bg-card rounded-t-2xl sm:rounded-2xl overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-card/90 backdrop-blur-sm border-b border-border/30 px-4 py-3 flex items-center justify-between z-10">
              <h3 className="font-display text-sm font-bold truncate">Detalle</h3>
              <button onClick={() => setDetailPost(null)} className="w-7 h-7 rounded-lg hover:bg-muted grid place-items-center"><X size={14} /></button>
            </div>
            <div className="p-4">
              <CommentSection postId={detailPost.id} myId={myId} isMod={false} onChange={() => {}} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
