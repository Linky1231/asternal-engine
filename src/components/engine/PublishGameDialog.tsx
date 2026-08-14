import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { publishGame, updateGame, GAME_GENRES } from "@/lib/social/api";
import { Upload, Loader2, CheckCircle2, ImagePlus, Images, X, GitFork, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import type { Project } from "@/lib/engine/core";

export function PublishGameDialog({
  open, onOpenChange, project, defaultTitle,
  mode = "publish",
  editPostId,
  initialTitle,
  initialDescription,
  initialTags,
  initialCoverUrl,
  initialScreenshots,
  initialAllowRemix,
  initialPriceOrbes,
  initialGenre,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  project?: Project;
  defaultTitle: string;
  mode?: "publish" | "edit";
  editPostId?: string;
  initialTitle?: string;
  initialDescription?: string;
  initialTags?: string[];
  initialCoverUrl?: string | null;
  /** Capturas existentes (modo edición): ruta de almacenamiento + URL firmada para mostrar. */
  initialScreenshots?: { path: string; url: string }[];
  initialAllowRemix?: boolean;
  initialPriceOrbes?: number;
  initialGenre?: string | null;
  onSaved?: () => void;
}) {
  const navigate = useNavigate();
  const [title, setTitle] = useState(initialTitle ?? defaultTitle);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [tagInput, setTagInput] = useState((initialTags ?? []).join(", "));
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(initialCoverUrl ?? null);
  const [removeCover, setRemoveCover] = useState(false);
  const [screens, setScreens] = useState<{ id: string; file?: File; url: string; path?: string; existing?: boolean }[]>([]);
  const [allowRemix, setAllowRemix] = useState<boolean>(initialAllowRemix ?? true);
  const [priceOrbes, setPriceOrbes] = useState<number>(initialPriceOrbes ?? 0);
  const [genre, setGenre] = useState<string>(initialGenre ?? "");
  const fileRef = useRef<HTMLInputElement>(null);
  const shotsRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(initialTitle ?? defaultTitle);
      setDescription(initialDescription ?? "");
      setTagInput((initialTags ?? []).join(", "));
      setCoverPreview(initialCoverUrl ?? null);
      setCoverFile(null);
      setRemoveCover(false);
      setScreens((initialScreenshots ?? []).map((s, i) => ({ id: `existing-${i}`, url: s.url, path: s.path, existing: true })));
      setAllowRemix(initialAllowRemix ?? true);
      setPriceOrbes(initialPriceOrbes ?? 0);
      setGenre(initialGenre ?? "");
      setErr(null); setDone(false);
    }
  }, [open, initialTitle, defaultTitle, initialDescription, initialTags, initialCoverUrl, initialScreenshots, initialAllowRemix, initialPriceOrbes, initialGenre]);

  const pickCover = (f: File | null) => {
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { setErr("La imagen no puede pesar más de 5MB"); return; }
    setCoverFile(f);
    setRemoveCover(false);
    const url = URL.createObjectURL(f);
    setCoverPreview(url);
  };

  const clearCover = () => {
    setCoverFile(null);
    setCoverPreview(null);
    setRemoveCover(true);
  };

  const pickScreens = (files: FileList | null) => {
    if (!files?.length) return;
    const valid = Array.from(files).filter(f => f.size <= 5 * 1024 * 1024);
    if (valid.length < files.length) { setErr("Cada captura debe pesar máximo 5MB"); return; }
    const room = Math.max(0, 6 - screens.length);
    const next = valid.slice(0, room);
    if (next.length < valid.length) { setErr("Máximo 6 capturas por juego"); return; }
    const items = next.map(f => ({ id: crypto.randomUUID(), file: f, url: URL.createObjectURL(f) }));
    setScreens(s => [...s, ...items]);
    setErr(null);
  };

  const removeScreen = (id: string, url: string, existing?: boolean) => {
    if (!existing) URL.revokeObjectURL(url);
    setScreens(s => s.filter(x => x.id !== id));
  };

  const newShotFiles = () => screens.filter(s => s.file).map(s => s.file!);
  const keptShotPaths = () => screens.filter(s => s.existing && s.path).map(s => s.path!);

  const submit = async () => {
    if (!title.trim()) { setErr("Título requerido"); return; }
    setBusy(true); setErr(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate({ to: "/auth" }); return; }
      const tags = tagInput.split(/[,\s#]+/).map(t => t.trim()).filter(Boolean);
      const newShots = newShotFiles();
      if (mode === "edit" && editPostId) {
        await updateGame(editPostId, {
          title: title.trim(),
          description: description.trim(),
          tags,
          coverFile,
          removeCover,
          screenshotFiles: newShots,
          keepScreenshots: keptShotPaths(),
          allowRemix,
          priceOrbes,
          gameGenre: genre.trim() || null,
        });
      } else if (project) {
        await publishGame({ project, title: title.trim(), description: description.trim(), tags, coverFile, screenshotFiles: newShots, allowRemix, priceOrbes, gameGenre: genre.trim() || null });
      }
      setDone(true);
      setTimeout(() => {
        onOpenChange(false);
        setDone(false);
        onSaved?.();
        if (mode === "publish") navigate({ to: "/" });
      }, 700);
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  const isEdit = mode === "edit";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload size={18} /> {isEdit ? "Editar juego" : "Publicar juego"}
          </DialogTitle>
          <DialogDescription>
            {isEdit ? "Actualiza la información y la portada de tu juego." : "Comparte tu juego en la pantalla de inicio. Cualquiera podrá jugarlo con un toque."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <span className="text-[10px] font-display tracking-widest text-muted-foreground">PORTADA</span>
            <div className="mt-1 flex items-center gap-3">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="relative w-20 h-20 rounded-xl border border-border overflow-hidden bg-input/50 grid place-items-center active:scale-95 transition group"
              >
                {coverPreview ? (
                  <img src={coverPreview} alt="portada" className="w-full h-full object-cover" />
                ) : (
                  <ImagePlus size={22} className="text-muted-foreground group-hover:text-primary-glow" />
                )}
              </button>
              <div className="flex-1 text-[11px] text-muted-foreground">
                Desde tu galería (JPG/PNG, máx 5MB). Aparecerá como icono del juego en el inicio.
                {coverPreview && (
                  <button onClick={clearCover} className="mt-1 flex items-center gap-1 text-destructive text-[11px]">
                    <X size={12} /> quitar
                  </button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => pickCover(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-display tracking-widest text-muted-foreground">CAPTURAS DE JUEGO</span>
              <span className="text-[10px] text-muted-foreground/60 font-mono">{screens.length}/6</span>
            </div>
            <div className="mt-1.5 flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {screens.map(s => (
                <div key={s.id} className="relative w-20 h-20 shrink-0 rounded-xl border border-border overflow-hidden group">
                  <img src={s.url} alt="captura" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeScreen(s.id, s.url, s.existing)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white grid place-items-center active:scale-90 transition opacity-0 group-hover:opacity-100"
                    aria-label="Quitar captura"
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
              {screens.length < 6 && (
                <button
                  type="button"
                  onClick={() => shotsRef.current?.click()}
                  className="w-20 h-20 shrink-0 rounded-xl border border-dashed border-border bg-input/40 grid place-items-center text-muted-foreground hover:text-primary-glow hover:border-primary/40 active:scale-95 transition"
                >
                  <Images size={20} />
                </button>
              )}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              Hasta 6 imágenes (JPG/PNG, máx 5MB c/u). Se mostrarán como galería en tu juego.
            </div>
            <input
              ref={shotsRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={e => { pickScreens(e.target.files); e.target.value = ""; }}
            />
          </div>
          <label className="block">
            <span className="text-[10px] font-display tracking-widest text-muted-foreground">TÍTULO</span>
            <input value={title} onChange={e => setTitle(e.target.value)} maxLength={80}
              className="w-full mt-1 bg-input/50 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40" />
          </label>
          <label className="block">
            <span className="text-[10px] font-display tracking-widest text-muted-foreground">DESCRIPCIÓN</span>
            <textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={500} rows={3}
              placeholder="Cuenta de qué va tu juego…"
              className="w-full mt-1 bg-input/50 rounded-lg px-3 py-2 text-sm outline-none resize-none focus:ring-2 focus:ring-primary/40" />
          </label>
          <label className="block">
            <span className="text-[10px] font-display tracking-widest text-muted-foreground">ETIQUETAS</span>
            <input value={tagInput} onChange={e => setTagInput(e.target.value)} placeholder="plataformas, retro, aventura"
              className="w-full mt-1 bg-input/50 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40" />
          </label>
          <div>
            <span className="text-[10px] font-display tracking-widest text-muted-foreground">CATEGORÍA DEL JUEGO</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {GAME_GENRES.map(g => (
                <button key={g} type="button" onClick={() => setGenre(genre === g ? "" : g)}
                  className={`px-2.5 h-7 rounded-full text-[10px] font-display tracking-wide transition active:scale-95 border ${
                    genre === g
                      ? "border-transparent bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-sm"
                      : "border-border/60 bg-muted/30 text-muted-foreground hover:text-primary-glow hover:border-primary/30"
                  }`}>
                  {g}
                </button>
              ))}
            </div>
            <input value={genre} onChange={e => setGenre(e.target.value)} maxLength={24}
              placeholder={genre ? "" : "o escribe otra categoría…"}
              className="w-full mt-1.5 bg-input/50 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
          <label className="flex items-center gap-3 p-2.5 rounded-xl border border-border bg-input/30 cursor-pointer active:scale-[0.99] transition">
            <div className={`w-10 h-6 rounded-full relative transition-colors ${allowRemix ? "bg-primary" : "bg-muted"}`}>
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${allowRemix ? "left-[18px]" : "left-0.5"}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-display tracking-widest flex items-center gap-1.5"><GitFork size={12}/> PERMITIR REMIX</div>
              <div className="text-[10px] text-muted-foreground leading-tight">Otras personas podrán copiar tu juego para modificarlo.</div>
            </div>
            <input type="checkbox" checked={allowRemix} onChange={e => setAllowRemix(e.target.checked)} className="sr-only" />
          </label>
          <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5 p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-accent grid place-items-center shadow-sm">
                <Sparkles size={14} className="text-primary-foreground" />
              </div>
              <div className="flex-1">
                <div className="text-xs font-display tracking-widest">PRECIO EN ORBES</div>
                <div className="text-[10px] text-muted-foreground leading-tight">Cuántos orbes cuesta jugar tu juego. Deja 0 para que sea gratis.</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={10000}
                step={1}
                value={priceOrbes}
                onChange={e => setPriceOrbes(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                className="w-24 bg-input/60 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/40 font-mono text-center"
              />
              <span className="text-xs text-muted-foreground font-mono">orbes</span>
              <div className="ml-auto flex gap-1">
                {[0, 10, 50, 100].map(v => (
                  <button key={v} type="button" onClick={() => setPriceOrbes(v)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-display tracking-widest transition active:scale-95 ${priceOrbes === v ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}>
                    {v === 0 ? "FREE" : v}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {err && <div className="text-xs text-destructive">{err}</div>}
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => onOpenChange(false)} disabled={busy}
              className="px-4 py-2 rounded-xl border border-border text-xs font-display tracking-widest">CANCELAR</button>
            <button onClick={submit} disabled={busy || done}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground text-xs font-display tracking-widest flex items-center gap-2 active:scale-95 transition disabled:opacity-60">
              {done ? <><CheckCircle2 size={14}/> {isEdit ? "GUARDADO" : "PUBLICADO"}</> : busy ? <><Loader2 size={14} className="animate-spin"/> …</> : <><Upload size={14}/> {isEdit ? "GUARDAR" : "PUBLICAR"}</>}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
