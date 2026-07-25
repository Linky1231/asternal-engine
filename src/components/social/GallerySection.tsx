import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Palette, Sparkles, X, Loader2, ImagePlus, CheckCircle2,
  Heart, MessageCircle, AlertTriangle,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  type PostWithMeta, type Profile,
  fetchArtworks, purchaseArtwork, publishArtwork,
  getMyProfile, getMyOrbes, isPlusActive,
} from "@/lib/social/api";
import { PaintEditor } from "@/components/engine/PaintEditor";
import type { SpriteAsset } from "@/lib/engine/core";
import { UserName } from "./UserName";

export function GallerySection({ myId, isMod: _isMod, onRefresh }: {
  myId: string | null; isMod: boolean; onRefresh?: () => void;
}) {
  const [artworks, setArtworks] = useState<PostWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  // Canvas overlay
  const [canvasOpen, setCanvasOpen] = useState(false);
  const [savedSprite, setSavedSprite] = useState<SpriteAsset | null>(null);

  // Publish dialog
  const [pubTitle, setPubTitle] = useState("");
  const [pubPrice, setPubPrice] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [pubErr, setPubErr] = useState<string | null>(null);
  const [pubDone, setPubDone] = useState(false);

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

  // --- Canvas save handler ---
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
    setPublishing(true);
    setPubErr(null);
    try {
      const composite = savedSprite.frames?.[0]?.composite;
      if (!composite) throw new Error("No hay imagen en el dibujo");
      await publishArtwork({
        title: pubTitle.trim(),
        imageDataUrl: composite,
        priceOrbes: pubPrice,
      });
      setPubDone(true);
      setTimeout(() => {
        setSavedSprite(null);
        setPubDone(false);
        setPublishing(false);
        load();
      }, 1200);
    } catch (e) {
      setPubErr((e as Error).message);
      setPublishing(false);
    }
  };

  // --- Buy ---
  const openBuy = async (postId: string) => {
    setBuyPostId(postId);
    setBuyState("idle");
    try { setBalance(await getMyOrbes()); } catch { setBalance(0); }
  };
  const confirmBuy = async () => {
    if (!buyPostId) return;
    setBuyState("loading");
    try {
      const res = await purchaseArtwork(buyPostId);
      if (res.already_owned) {
        setBuyState("success");
        setBuyMsg("Ya tienes esta obra.");
      } else if (res.free || (res.ok && (res.paid ?? 0) >= 0)) {
        setBuyState("success");
        setBuyMsg(res.free ? "¡Obra gratuita!" : `Comprada por ${res.paid} orbes.`);
        load();
      } else {
        setBuyState("insufficient");
        setBuyMsg(`Te faltan ${(res.balance ?? 0) < 0 ? Math.abs(res.balance ?? 0) : "algunos"} orbes.`);
      }
    } catch (e) {
      setBuyState("error");
      setBuyMsg((e as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-purple-500 grid place-items-center shadow-sm">
            <Palette size={16} className="text-white" />
          </div>
          <div>
            <div className="font-display text-sm font-semibold">Galería de Arte</div>
            <div className="text-[10px] font-mono text-muted-foreground">Crea, vende y colecciona arte</div>
          </div>
        </div>
        <button
          onClick={() => setCanvasOpen(true)}
          className="h-9 pl-3 pr-4 rounded-xl bg-gradient-to-r from-rose-500 to-purple-500 text-white text-[10px] font-display tracking-widest flex items-center gap-1.5 active:scale-95 transition shadow-sm"
        >
          <ImagePlus size={14} /> CREAR
        </button>
      </div>

      {/* Artworks grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[0, 1, 2, 3, 4, 5].map(i => (
            <div key={i} className="aspect-square rounded-2xl bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : artworks.length === 0 ? (
        <div className="text-center py-16 panel rounded-2xl border border-dashed border-border">
          <Palette size={32} className="mx-auto text-muted-foreground/50 mb-3" />
          <div className="text-sm font-display text-muted-foreground">Aún no hay obras</div>
          <div className="text-[11px] text-muted-foreground/60 mt-1">¡Sé el primero en crear una!</div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {artworks.map((art, i) => {
            const imgUrl = art.signed_media?.[0] ?? art.signed_cover;
            const price = art.price_orbes ?? 0;
            const mine = art.author_id === myId;
            const owned = art.owned ?? false;
            return (
              <motion.div
                key={art.id}
                initial={{ opacity: 0, y: 16, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.3, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
                className="group panel rounded-2xl overflow-hidden border border-border/50 hover:border-primary/30 transition-all active:scale-[0.98]"
              >
                <div className="aspect-square bg-muted/30 relative overflow-hidden">
                  {imgUrl ? (
                    <img src={imgUrl} alt={art.content.replace(/^🎨\s*/, "")} className="w-full h-full object-contain p-2" />
                  ) : (
                    <div className="w-full h-full grid place-items-center">
                      <Palette size={32} className="text-muted-foreground/30" />
                    </div>
                  )}
                  {/* Price badge */}
                  <div className="absolute top-2 right-2">
                    {mine ? (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-display tracking-widest bg-emerald-500/20 text-emerald-500 border border-emerald-500/30">
                        TU OBRA
                      </span>
                    ) : owned ? (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-display tracking-widest bg-emerald-500/20 text-emerald-500 border border-emerald-500/30">
                        COLECTADA
                      </span>
                    ) : price > 0 ? (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-display tracking-widest bg-amber-500/20 text-amber-500 border border-amber-500/30 flex items-center gap-0.5">
                        <Sparkles size={9} /> {price}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-display tracking-widest bg-primary/20 text-primary-glow border border-primary/30">
                        GRATIS
                      </span>
                    )}
                  </div>
                </div>
                <div className="p-2.5 space-y-1.5">
                  <div className="text-xs font-display truncate">
                    {art.content.replace(/^🎨\s*/, "")}
                  </div>
                  <Link
                    to="/profile/$userId" params={{ userId: art.author_id }}
                    className="flex items-center gap-1.5 group/author"
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-primary/40 to-accent/30 grid place-items-center overflow-hidden shrink-0">
                      {art.author?.avatar_url ? (
                        <img src={art.author.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[7px] font-display text-primary-glow">
                          {(art.author?.username ?? "?")[0]?.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <span className="text-[9px] font-mono text-muted-foreground truncate group-hover/author:text-foreground transition">
                      @{art.author?.username ?? "anon"}
                    </span>
                  </Link>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-0.5"><Heart size={10} /> {art.likes}</span>
                    <span className="flex items-center gap-0.5"><MessageCircle size={10} /> {art.comments_count}</span>
                    {!mine && (
                      <button
                        onClick={e => { e.stopPropagation(); openBuy(art.id); }}
                        disabled={owned}
                        className={`ml-auto text-[9px] font-display tracking-widest px-2 py-0.5 rounded-full transition active:scale-95 ${
                          owned
                            ? "text-muted-foreground/40 cursor-default"
                            : "bg-gradient-to-r from-rose-500 to-purple-500 text-white hover:shadow-sm"
                        }`}
                      >
                        {owned ? "✔" : price > 0 ? `COMPRAR` : "OBTENER"}
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* PaintEditor overlay */}
      <AnimatePresence>
        {canvasOpen && (
          <PaintEditor
            onSave={handleCanvasSave}
            onClose={() => setCanvasOpen(false)}
            size={512}
          />
        )}
      </AnimatePresence>

      {/* Publish dialog */}
      <AnimatePresence>
        {savedSprite && !pubDone && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm grid place-items-center p-4"
            onClick={() => { if (!publishing) setSavedSprite(null); }}
          >
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.96 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-sm panel border border-border rounded-2xl p-4 space-y-3 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-2">
                <Palette size={16} className="text-rose-500" />
                <div className="font-display text-sm">Publicar obra</div>
                <button onClick={() => setSavedSprite(null)} className="ml-auto w-8 h-8 grid place-items-center rounded-lg border border-border hover:bg-muted/40">
                  <X size={14} />
                </button>
              </div>

              {/* Preview */}
              <div className="aspect-square max-h-40 rounded-xl bg-muted/30 overflow-hidden border border-border/50">
                {savedSprite.frames?.[0]?.composite && (
                  <img src={savedSprite.frames[0].composite} alt="preview" className="w-full h-full object-contain" />
                )}
              </div>

              <input
                value={pubTitle}
                onChange={e => setPubTitle(e.target.value)}
                placeholder="Título de la obra"
                maxLength={60}
                className="w-full bg-input/50 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-500/40"
              />

              <div>
                <div className="text-[10px] font-display tracking-widest text-muted-foreground mb-1 flex items-center gap-1">
                  <Sparkles size={10} className="text-amber-500" /> PRECIO EN ORBES
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={9999}
                    value={pubPrice}
                    onChange={e => setPubPrice(Math.max(0, Number(e.target.value)))}
                    className="flex-1 bg-input/50 rounded-xl px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-rose-500/40"
                  />
                  <span className="text-xs text-muted-foreground">orbes</span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">0 = gratuita</div>
              </div>

              {pubErr && <div className="text-xs text-destructive">{pubErr}</div>}

              <div className="flex gap-2">
                <button
                  onClick={() => setSavedSprite(null)}
                  disabled={publishing}
                  className="flex-1 h-10 rounded-xl border border-border text-xs font-display tracking-widest active:scale-95 disabled:opacity-50"
                >
                  CANCELAR
                </button>
                <button
                  onClick={doPublish}
                  disabled={publishing || !pubTitle.trim()}
                  className="flex-1 h-10 rounded-xl bg-gradient-to-r from-rose-500 to-purple-500 text-white text-xs font-display tracking-widest active:scale-95 disabled:opacity-50 transition"
                >
                  {publishing ? <Loader2 size={14} className="animate-spin mx-auto" /> : "PUBLICAR"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
        {pubDone && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm grid place-items-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-xs panel rounded-2xl p-6 text-center space-y-2"
            >
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 grid place-items-center mx-auto">
                <CheckCircle2 size={28} className="text-emerald-500" />
              </div>
              <div className="font-display text-base">¡Obra publicada!</div>
              <div className="text-xs text-muted-foreground">Tu obra ya está en la galería</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Buy modal */}
      <AnimatePresence>
        {buyPostId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm grid place-items-center p-4"
            onClick={() => buyState !== "loading" && setBuyPostId(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.96 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-sm panel border border-border rounded-2xl p-5 space-y-3 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              {(buyState === "idle" || buyState === "loading") && (
                <>
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500/25 to-purple-500/20 grid place-items-center mx-auto">
                    {buyState === "loading"
                      ? <Loader2 size={22} className="animate-spin text-rose-500" />
                      : <Palette size={22} className="text-rose-500" />}
                  </div>
                  <h3 className="font-display text-center text-sm">
                    {buyState === "loading" ? "Procesando…" : "¿Adquirir esta obra?"}
                  </h3>
                  {balance !== null && (
                    <div className="rounded-xl bg-muted/40 border border-border/60 p-3 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Tu saldo</span>
                        <span className="font-mono tabular-nums flex items-center gap-1">
                          <Sparkles size={10} className="text-primary" /> {balance}
                        </span>
                      </div>
                      {(() => {
                        const art = artworks.find(a => a.id === buyPostId);
                        const price = art?.price_orbes ?? 0;
                        return (
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Precio</span>
                            <span className="font-mono tabular-nums flex items-center gap-1">
                              <Sparkles size={10} className="text-amber-500" /> {price}
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                  <button
                    onClick={confirmBuy}
                    disabled={buyState === "loading"}
                    className="w-full h-10 rounded-xl bg-gradient-to-r from-rose-500 to-purple-500 text-white text-xs font-display tracking-widest disabled:opacity-50 active:scale-[0.98] transition"
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
              )}
              {(buyState === "insufficient" || buyState === "error") && (
                <div className="text-center py-2">
                  <div className="w-12 h-12 rounded-2xl bg-rose-500/15 grid place-items-center mx-auto mb-2">
                    <AlertTriangle size={22} className="text-rose-500" />
                  </div>
                  <h3 className="font-display text-sm">
                    {buyState === "insufficient" ? "Orbes insuficientes" : "Error"}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">{buyMsg}</p>
                </div>
              )}
              {buyState !== "loading" && (
                <button
                  onClick={() => setBuyPostId(null)}
                  className="w-full h-9 rounded-xl border border-border text-[10px] font-display tracking-widest active:scale-95 transition"
                >
                  {buyState === "success" ? "ENTENDIDO" : "CANCELAR"}
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
