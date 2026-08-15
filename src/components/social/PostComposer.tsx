import { useState, useEffect } from "react";
import { Avatar } from "./Avatar";
import { createPost, fetchMyGamesLite, getMyProfile, type MediaType, type Profile } from "@/lib/social/api";
import {
  Image as ImageIcon, Film, Link as LinkIcon, X, Send, Loader2, Tag,
  FileText, Code2, Palette, BarChart3, Lock, Gamepad2, Plus, Trash2, Sparkles,
} from "lucide-react";

type Poll = { question: string; options: string[] };

export function PostComposer({ onCreated }: { onCreated: () => void }) {
  const [me, setMe] = useState<Profile | null>(null);
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [mediaType, setMediaType] = useState<MediaType>("none");
  const [linkUrl, setLinkUrl] = useState("");
  const [tagInput, setTagInput] = useState("");

  const [documents, setDocuments] = useState<File[]>([]);
  const [htmlContent, setHtmlContent] = useState("");
  const [textColor, setTextColor] = useState<string>("");
  const [poll, setPoll] = useState<Poll | null>(null);
  const [lockedContent, setLockedContent] = useState("");
  const [unlockGoal, setUnlockGoal] = useState<number | "">("");
  const [unlockAt, setUnlockAt] = useState("");
  const [pinnedGameId, setPinnedGameId] = useState<string>("");
  const [myGames, setMyGames] = useState<{ id: string; title: string }[]>([]);

  const [panel, setPanel] = useState<null | "link" | "tags" | "html" | "poll" | "unlock" | "game" | "color">(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const urls = files.map(f => URL.createObjectURL(f));
    setPreviews(urls);
    return () => { urls.forEach(URL.revokeObjectURL); };
  }, [files]);

  useEffect(() => { fetchMyGamesLite().then(setMyGames).catch(() => { /* ignore */ }); }, []);
  useEffect(() => { getMyProfile().then(setMe).catch(() => { /* ignore */ }); }, []);

  const onMedia = (e: React.ChangeEvent<HTMLInputElement>, kind: "image" | "video") => {
    const list = Array.from(e.target.files ?? []);
    if (!list.length) return;
    setFiles(list); setMediaType(kind); setExpanded(true);
    e.target.value = "";
  };
  const onDocs = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files ?? []);
    if (!list.length) return;
    const oversize = list.find(f => f.size > 25 * 1024 * 1024);
    if (oversize) { setErr(`"${oversize.name}" supera 25 MB`); return; }
    setDocuments(prev => [...prev, ...list]); setExpanded(true);
    e.target.value = "";
  };

  const removeFile = (i: number) => {
    const next = files.filter((_, idx) => idx !== i);
    setFiles(next);
    if (!next.length) setMediaType("none");
  };

  const canSubmit = (content.trim() || files.length || linkUrl.trim() || htmlContent.trim() || documents.length || poll || pinnedGameId) && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true); setErr(null);
    try {
      const tags = tagInput.split(/[,\s#]+/).map(t => t.trim()).filter(Boolean);
      await createPost({
        content: content.trim(),
        files,
        mediaType: files.length ? mediaType : linkUrl ? "link" : "none",
        linkUrl: linkUrl.trim() || undefined,
        tags,
        textColor: textColor || null,
        htmlContent: htmlContent.trim() || null,
        documents,
        pinnedGameId: pinnedGameId || null,
        lockedContent: lockedContent.trim() || null,
        unlockReactionsGoal: typeof unlockGoal === "number" ? unlockGoal : null,
        unlockAt: unlockAt || null,
        poll: poll && poll.options.filter(o => o.trim()).length >= 2 ? poll : null,
      });
      // reset
      setContent(""); setFiles([]); setLinkUrl(""); setTagInput("");
      setDocuments([]); setHtmlContent(""); setTextColor("");
      setPoll(null); setLockedContent(""); setUnlockGoal(""); setUnlockAt("");
      setPinnedGameId(""); setPanel(null); setExpanded(false);
      onCreated();
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  const Chip = ({ active, onClick, title, children }: { active?: boolean; onClick: () => void; title: string; children: React.ReactNode }) => (
    <button onClick={onClick} title={title}
      className={`relative shrink-0 h-9 px-3 rounded-xl grid grid-flow-col auto-cols-max items-center gap-1.5 text-[11px] font-medium transition-[transform,color,border-color,background-color,box-shadow] duration-300 ease-out active:scale-[0.95] ${active ? "text-primary-foreground shadow-[0_2px_10px_-2px_oklch(0.52_0.19_258/0.45)] border border-transparent" : "bg-muted/50 text-muted-foreground hover:text-primary hover:bg-primary/10 hover:border-primary/25 border border-transparent"}`}>
      <span aria-hidden className={`absolute inset-0 rounded-xl bg-gradient-to-br from-primary to-accent transition-opacity duration-300 ease-out ${active ? "opacity-100" : "opacity-0"}`} />
      <span className="relative z-10 flex items-center gap-1.5">{children}</span>
    </button>
  );

  const avatarEl = <Avatar p={me} size={40} className="ring-1 ring-border/60" />;

  return (
    <div className={`panel rounded-2xl border bg-gradient-to-b from-card to-muted/20 transition-all duration-300 ${expanded ? "border-primary/35 shadow-lg" : "border-border/60 shadow-sm hover:border-primary/25 hover:shadow-md"}`}>
      <div className="h-[3px] w-full bg-gradient-to-r from-primary via-accent to-transparent rounded-t-2xl opacity-80" />
      <div className="p-3 space-y-3">
        <div className="flex items-start gap-2.5">
          {avatarEl}
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            onFocus={() => setExpanded(true)}
            placeholder="¿Qué quieres compartir?"
            rows={expanded ? 3 : 1}
            maxLength={2000}
            style={textColor ? { color: textColor } : undefined}
            className="flex-1 bg-transparent rounded-md text-sm resize-none outline-none placeholder:text-muted-foreground pt-2 leading-relaxed transition-all"
          />
        </div>

        {previews.length > 0 && (
          <div className={`grid gap-2 ${previews.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
            {previews.map((url, i) => (
              <div key={url} className="relative rounded-xl overflow-hidden bg-muted/30 border border-border/50 group/media">
                {mediaType === "video" ? <video src={url} className="w-full max-h-64 object-cover" muted /> : <img src={url} alt="" className="w-full max-h-64 object-cover transition-transform duration-500 group-hover/media:scale-[1.02]" />}
                <button onClick={() => removeFile(i)} className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-black/60 text-white grid place-items-center active:scale-[0.92] transition-transform duration-200 ease-out shadow-md backdrop-blur-sm">
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {documents.length > 0 && (
          <div className="space-y-1.5">
            {documents.map((d, i) => (
              <div key={i} className="flex items-center gap-2.5 bg-input/40 rounded-xl px-3 py-2 text-xs border border-border/50">
                <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary/20 to-accent/15 grid place-items-center shrink-0">
                  <FileText size={13} className="text-primary" />
                </span>
                <span className="flex-1 truncate font-medium">{d.name}</span>
                <span className="text-muted-foreground tabular-nums">{(d.size / 1024).toFixed(0)}KB</span>
                <button onClick={() => setDocuments(documents.filter((_, idx) => idx !== i))}
                  className="text-muted-foreground hover:text-destructive transition-[transform,color] duration-200 ease-out active:scale-[0.92]">
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {panel === "link" && (
          <div className="flex items-center gap-2 bg-input/40 rounded-xl px-3 py-2 animate-in fade-in slide-in-from-top-1 border border-border/50">
            <LinkIcon size={14} className="text-muted-foreground" />
            <input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://…"
              className="flex-1 bg-transparent text-xs outline-none" />
          </div>
        )}

        {panel === "tags" && (
          <div className="flex items-center gap-2 bg-input/40 rounded-xl px-3 py-2 border border-border/50">
            <Tag size={14} className="text-muted-foreground" />
            <input value={tagInput} onChange={e => setTagInput(e.target.value)} placeholder="etiquetas separadas por coma"
              className="flex-1 bg-transparent text-xs outline-none" />
          </div>
        )}

        {panel === "color" && (
          <div className="flex items-center gap-3 bg-input/40 rounded-xl px-3 py-2 text-xs border border-border/50">
            <Palette size={14} className="text-muted-foreground" />
            <span>Color del texto:</span>
            <input type="color" value={textColor || "#111827"} onChange={e => setTextColor(e.target.value)}
              className="w-8 h-8 rounded-lg cursor-pointer border border-border/50" />
            {textColor && <button onClick={() => setTextColor("")} className="text-muted-foreground underline hover:text-primary transition-colors">quitar</button>}
          </div>
        )}

        {panel === "html" && (
          <div className="space-y-2">
            <textarea value={htmlContent} onChange={e => setHtmlContent(e.target.value)}
              placeholder="Pega HTML aquí (se mostrará en un visor seguro)…"
              rows={4}
              className="w-full bg-input/40 rounded-xl px-3 py-2 text-xs font-mono outline-none resize-y border border-border/50 focus:border-primary/40" />
            {htmlContent.trim() && (
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="text-[10px] px-2 py-1 bg-muted/40 text-muted-foreground">Vista previa</div>
                <iframe srcDoc={htmlContent} sandbox="" className="w-full h-40 bg-white" title="html-preview" />
              </div>
            )}
          </div>
        )}

        {panel === "game" && myGames.length > 0 && (
          <div className="bg-input/40 rounded-xl px-3 py-2 space-y-2 border border-border/50">
            <div className="text-xs flex items-center gap-2 font-medium"><Gamepad2 size={14} className="text-primary" /> Fijar un juego tuyo</div>
            <select value={pinnedGameId} onChange={e => setPinnedGameId(e.target.value)}
              className="w-full bg-background rounded-lg px-2 py-2 text-xs border border-border/50 focus:border-primary/40">
              <option value="">— sin juego —</option>
              {myGames.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
            </select>
          </div>
        )}
        {panel === "game" && myGames.length === 0 && (
          <div className="text-xs text-muted-foreground px-2">Aún no tienes juegos publicados.</div>
        )}

        {panel === "poll" && (
          <PollEditor poll={poll} setPoll={setPoll} />
        )}

        {panel === "unlock" && (
          <div className="bg-input/40 rounded-xl px-3 py-2 space-y-2 border border-border/50">
            <div className="flex items-center gap-2 text-xs font-medium"><Lock size={13} className="text-primary" /> Contenido desbloqueable</div>
            <textarea value={lockedContent} onChange={e => setLockedContent(e.target.value)}
              placeholder="Este texto quedará oculto hasta cumplir la condición…"
              rows={2}
              className="w-full bg-background rounded-lg px-2.5 py-2 text-xs outline-none border border-border/50 focus:border-primary/40" />
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <label className="space-y-1">
                <span className="text-muted-foreground">Meta de reacciones</span>
                <input type="number" min={1} value={unlockGoal}
                  onChange={e => setUnlockGoal(e.target.value ? Number(e.target.value) : "")}
                  placeholder="ej. 50"
                  className="w-full bg-background rounded-lg px-2.5 py-2 border border-border/50 focus:border-primary/40" />
              </label>
              <label className="space-y-1">
                <span className="text-muted-foreground">O fecha</span>
                <input type="datetime-local" value={unlockAt} onChange={e => setUnlockAt(e.target.value)}
                  className="w-full bg-background rounded-lg px-2.5 py-2 border border-border/50 focus:border-primary/40" />
              </label>
            </div>
            <div className="text-[10px] text-muted-foreground">Se desbloquea al cumplir cualquiera de las dos.</div>
          </div>
        )}

        {err && <div className="text-xs text-destructive bg-destructive/5 rounded-lg px-3 py-2">{err}</div>}

        {expanded && (
          <div className="text-[10px] font-display tracking-[0.2em] px-1 flex items-center gap-2">
            <Sparkles size={11} className="text-primary-glow shrink-0" />
            <span className="bg-gradient-to-br from-primary to-accent bg-clip-text text-transparent">AÑADIR A TU PUBLICACIÓN</span>
            <span className="flex-1 h-px bg-gradient-to-r from-primary/25 to-transparent" />
          </div>
        )}

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1">
          <label title="Imagen o GIF" className="shrink-0 h-9 px-3 rounded-xl grid grid-flow-col auto-cols-max items-center gap-1.5 bg-muted/50 text-muted-foreground text-[11px] font-medium hover:text-primary hover:bg-primary/10 cursor-pointer active:scale-[0.95] transition-[transform,color,background-color,border-color] duration-300 ease-out border border-transparent hover:border-primary/25">
            <ImageIcon size={15} /> {expanded && <span>Imagen</span>}
            <input type="file" hidden accept="image/*,image/gif" multiple onChange={e => onMedia(e, "image")} />
          </label>
          <label title="Vídeo" className="shrink-0 h-9 px-3 rounded-xl grid grid-flow-col auto-cols-max items-center gap-1.5 bg-muted/50 text-muted-foreground text-[11px] font-medium hover:text-primary hover:bg-primary/10 cursor-pointer active:scale-[0.95] transition-[transform,color,background-color,border-color] duration-300 ease-out border border-transparent hover:border-primary/25">
            <Film size={15} /> {expanded && <span>Vídeo</span>}
            <input type="file" hidden accept="video/*" onChange={e => onMedia(e, "video")} />
          </label>
          <label title="Documentos" className="shrink-0 h-9 px-3 rounded-xl grid grid-flow-col auto-cols-max items-center gap-1.5 bg-muted/50 text-muted-foreground text-[11px] font-medium hover:text-primary hover:bg-primary/10 cursor-pointer active:scale-[0.95] transition-[transform,color,background-color,border-color] duration-300 ease-out border border-transparent hover:border-primary/25">
            <FileText size={15} /> {expanded && <span>Documento</span>}
            <input type="file" hidden multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z,.json,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,application/zip"
              onChange={onDocs} />
          </label>
          <Chip active={panel === "link"} onClick={() => setPanel(panel === "link" ? null : "link")} title="Enlace"><LinkIcon size={15} />{expanded && <span>Enlace</span>}</Chip>
          <Chip active={panel === "poll"} onClick={() => { setPanel(panel === "poll" ? null : "poll"); if (!poll) setPoll({ question: "", options: ["", ""] }); }} title="Encuesta"><BarChart3 size={15} />{expanded && <span>Encuesta</span>}</Chip>
          <Chip active={panel === "game"} onClick={() => setPanel(panel === "game" ? null : "game")} title="Fijar juego"><Gamepad2 size={15} />{expanded && <span>Juego</span>}</Chip>
          <Chip active={panel === "color"} onClick={() => setPanel(panel === "color" ? null : "color")} title="Color del texto"><Palette size={15} />{expanded && <span>Color</span>}</Chip>
          <Chip active={panel === "html"} onClick={() => setPanel(panel === "html" ? null : "html")} title="HTML"><Code2 size={15} />{expanded && <span>HTML</span>}</Chip>
          <Chip active={panel === "unlock"} onClick={() => setPanel(panel === "unlock" ? null : "unlock")} title="Desbloqueable"><Lock size={15} />{expanded && <span>Desbloqueable</span>}</Chip>
          <Chip active={panel === "tags"} onClick={() => setPanel(panel === "tags" ? null : "tags")} title="Etiquetas"><Tag size={15} />{expanded && <span>Etiquetas</span>}</Chip>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/40">
          <span className="text-[8px] font-mono text-muted-foreground/30 mr-auto" title="marcador compositor">ast-composer-v1</span>
          <span className={`text-[10px] font-mono text-muted-foreground ${content.length > 1900 ? "text-destructive" : ""}`}>{content.length}/2000</span>
          <button onClick={submit} disabled={!canSubmit}
            className="h-10 pl-4 pr-5 rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground font-display tracking-[0.15em] text-xs flex items-center gap-1.5 active:scale-[0.97] transition-[transform,box-shadow,opacity] duration-300 ease-out shadow-[0_4px_14px_-4px_oklch(0.52_0.19_258/0.5)] disabled:opacity-40 disabled:pointer-events-none hover:-translate-y-0.5 hover:shadow-[0_8px_20px_-5px_oklch(0.52_0.19_258/0.65)]">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={13} />}
            {busy ? "…" : "PUBLICAR"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PollEditor({ poll, setPoll }: { poll: Poll | null; setPoll: (p: Poll | null) => void }) {
  if (!poll) return null;
  const setOpt = (i: number, v: string) => {
    const next = [...poll.options];
    next[i] = v;
    setPoll({ ...poll, options: next });
  };
  return (
    <div className="bg-input/40 rounded-xl px-3 py-2 space-y-2 border border-border/50">
      <div className="flex items-center gap-2 text-xs font-medium"><BarChart3 size={13} className="text-primary" /> Encuesta</div>
      <input value={poll.question} onChange={e => setPoll({ ...poll, question: e.target.value })}
        placeholder="Pregunta…" className="w-full bg-background rounded-lg px-2.5 py-2 text-xs border border-border/50 focus:border-primary/40 outline-none" />
      {poll.options.map((o, i) => (
        <div key={i} className="flex items-center gap-2">
          <input value={o} onChange={e => setOpt(i, e.target.value)}
            placeholder={`Opción ${i + 1}`}
            className="flex-1 bg-background rounded-lg px-2.5 py-2 text-xs border border-border/50 focus:border-primary/40 outline-none" />
          {poll.options.length > 2 && (
            <button onClick={() => setPoll({ ...poll, options: poll.options.filter((_, idx) => idx !== i) })}
              className="text-muted-foreground hover:text-destructive transition-[transform,color] duration-200 ease-out active:scale-[0.92]">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ))}
      <div className="flex items-center gap-2">
        {poll.options.length < 4 && (
          <button onClick={() => setPoll({ ...poll, options: [...poll.options, ""] })}
            className="text-[11px] flex items-center gap-1 text-primary-glow hover:underline">
            <Plus size={12} /> añadir opción
          </button>
        )}            <button onClick={() => setPoll(null)} className="ml-auto text-[11px] text-muted-foreground underline hover:text-primary transition-colors duration-300">
          quitar encuesta
        </button>
      </div>
    </div>
  );
}
