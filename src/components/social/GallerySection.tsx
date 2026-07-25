import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Palette, Sparkles, X, Loader2, ImagePlus, CheckCircle2,
  Heart, MessageCircle, AlertTriangle, Search, Clock,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  type PostWithMeta, type Profile,
  fetchArtworks, purchaseArtwork, publishArtwork,
  getMyProfile, getMyOrbes,
} from "@/lib/social/api";
import { PaintEditor } from "@/components/engine/PaintEditor";
import type { SpriteAsset } from "@/lib/engine/core";

export function GallerySection({ myId, isMod: _isMod, onRefresh }: {
  myId: string | null; isMod: boolean; onRefresh?: () => void;
}) {
  const [artworks, setArtworks] = useState<PostWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [filter, setFilter] = useState<"all" | "mine">("all");
  const [searchQ, setSearchQ] = useState("");

  // Canvas overlay — direct mount/unmount, no AnimatePresence to avoid z-index issues
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

  // Filter & search
  const q = searchQ.toLowerCase().trim();
  const filtered = artworks.filter(a => {
    if (filter === "mine" && a.author_id !== myId) return false;
    if (q) {
      const title = a.content.replace(/^🎨\s*/, "").toLowerCase();
      const author = a.author?.username?.toLowerCase() ?? "";
      return title.includes(q) || author.includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* ====== HEADER ====== */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent grid place-items-center shadow-sm shrink-0">
            <Palette size={18} className="text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <div className="font-display text-sm font-semibold truncate">Galería</div>
            <div className="text-[10px] font-mono text-muted-foreground truncate">Arte de la comunidad</div>
          </div>
        </div>
        <button
          onClick={() => setCanvasOpen(true)}
          className="h-10 pl-3 pr-4 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground text-[10px] font-display tracking-widest flex items-center gap-1.5 active:scale-95 transition shadow-sm shrink-0"
        >
          <ImagePlus size={15} /> DIBUJAR
        </button>
      </div>

      {/* ====== SEARCH + FILTER TABS ====== */}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 bg-input/50 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-primary/40 transition">
          <Search size={14} className="text-muted-foreground shrink-0" />
          <input
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            placeholder="Buscar obras o artistas…"
            className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/60"
          />
          {searchQ && (
            <button onClick={() => setSearchQ("")} className="text-muted-foreground hover:text-foreground">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setFilter("all")}
          className={`px-4 py-1.5 rounded-full text-[10px] font-display tracking-widest transition active:scale-95 ${
            filter === "all"
              ? "bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-sm"
              : "bg-muted/40 text-muted-foreground hover:text-foreground border border-border/60"
          }`}
        >
          TODAS
        </button>
        <button
          onClick={() => setFilter("mine")}
          className={`px-4 py-1.5 rounded-full text-[10px] font-display tracking-widest transition active:scale-95 ${
            filter === "mine"
              ? "bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-sm"
              : "bg-muted/40 text-muted-foreground hover:text-foreground border border-border/60"
          }`}
        >
          MIS OBRAS
        </button>
      </div>

      {/* ====== ARTWORKS GRID ====== */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[0,1,2,3,4,5].map(i => (
            <div key={i} className="aspect-square rounded-2xl bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 panel rounded-2xl border border-dashed border-border">
          <Palette size={36} className="mx-auto text-muted-foreground/40 mb-3" />
          <div className="text-sm font-display text-muted-foreground">
            {q ? "Sin resultados" : filter === "mine" ? "Aún no has creado obras" : "Aún no hay obras"}
          </div>
          <div className="text-[11px] text-muted-foreground/60 mt-1">
            {filter === "mine"
              ? "Toca DIBUJAR para crear tu primera obra"
              : "¡Sé el primero en publicar!"}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {filtered.map((art, i) => {
            const imgUrl = art.signed_media?.[0] ?? art.signed_cover;
            const price = art.price_orbes ?? 0;
            const mine = art.author_id === myId;
            const owned = art.owned ?? false;
            const title = art.content.replace(/^🎨\s*/, "");
            return (
              <motion.div
                key={art.id}
                initial={{ opacity: 0, y: 16, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.3, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
                className="group panel rounded-2xl overflow-hidden border border-border/50 hover:border-primary/30 hover:shadow-md transition-all active:scale-[0.98]"
              >
                {/* Image area */}
                <div className="aspect-square bg-muted/20 relative overflow-hidden">
                  {imgUrl ? (
                    <img src={imgUrl} alt={title} className="w-full h-full object-contain p-3 group-hover:scale-[1.02] transition-transform duration-300" />
                  ) : (
                    <div className="w-full h-full grid place-items-center">
                      <Palette size={36} className="text-muted-foreground/20" />
                    </div>
                  )}

                  {/* Top-right badge */}
                  <div className="absolute top-2 right-2">
                    {mine ? (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-display tracking-widest bg-primary/20 text-primary-glow border border-primary/30">
                        TU OBRA
                      </span>
                    ) : owned ? (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-display tracking-widest bg-emerald-500/20 text-emerald-500 border border-emerald-500/30">
                        COLECTADA
                      </span>
                    ) : price > 0 ? (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-display tracking-widest bg-primary/20 text-primary-glow border border-primary/30 flex items-center gap-1">
                        <Sparkles size={9} /> {price}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-display tracking-widest bg-emerald-500/20 text-emerald-500 border border-emerald-500/30">
                        GRATIS
                      </span>
                    )}
                  </div>
                </div>

                {/* Info area */}
                <div className="p-2.5 space-y-1.5">
                  <div className="text-xs font-display truncate font-medium">{title}</div>
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

                  {/* Actions row */}
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground pt-0.5">
                    <span className="flex items-center gap-0.5"><Heart size={10} /> {art.likes}</span>
                    <span className="flex items-center gap-0.5"><MessageCircle size={10} /> {art.comments_count}</span>
                    {!mine && (
                      <button
                        onClick={e => { e.stopPropagation(); openBuy(art.id); }}
                        disabled={owned}
                        className={`ml-auto text-[9px] font-display tracking-widest px-2.5 py-0.5 rounded-full transition active:scale-90 ${
                          owned
                            ? "text-muted-foreground/40 cursor-default border border-transparent"
                            : "bg-gradient-to-r from-primary to-accent text-primary-foreground hover:shadow-sm"
                        }`}
                      >
                        {owned ? "✔" : price > 0 ? "COMPRAR" : "OBTENER"}
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ====== PAINT EDITOR OVERLAY ====== */}
      {/* Direct render, no AnimatePresence wrapper — PaintEditor has its own fixed positioning */}
      {canvasOpen && (
        <PaintEditor
          onSave={handleCanvasSave}
          onClose={() => setCanvasOpen(false)}
          size={512}
        />
      )}

      {/* ====== PUBLISH DIALOG ====== */}
      <AnimatePresence>
        {savedSprite && !pubDone && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm grid place-items-center p-4"
            onClick={() => { if (!publishing) setSavedSprite(null); }}
          >
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.96 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-sm panel border border-border rounded-2xl p-5 space-y-4 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent grid place-items-center">
                  <ImagePlus size={14} className="text-primary-foreground" />
                </div>
                <div className="font-display text-sm">Publicar obra</div>
                <button onClick={() => setSavedSprite(null)} className="ml-auto w-8 h-8 grid place-items-center rounded-lg border border-border hover:bg-muted/40">
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
                className="w-full bg-input/50 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
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
                    className="flex-1 bg-input/50 rounded-xl px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-primary/40"
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
            className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm grid place-items-center p-4"
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
            className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm grid place-items-center p-4"
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
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/25 to-accent/20 grid place-items-center mx-auto">
                    {buyState === "loading"
                      ? <Loader2 size={22} className="animate-spin text-primary" />
                      : <Palette size={22} className="text-primary" />}
                  </div>
                  <h3 className="font-display text-center text-sm">
                    {buyState === "loading" ? "Procesando…" : "¿Adquirir esta obra?"}
                  </h3>
                  {balance !== null && (() => {
                    const art = artworks.find(a => a.id === buyPostId);
                    const price = art?.price_orbes ?? 0;
                    const after = balance - price;
                    return (
                      <div className="rounded-xl bg-muted/40 border border-border/60 p-3 space-y-2 text-xs">
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
              )}
              {(buyState === "insufficient" || buyState === "error") && (
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
