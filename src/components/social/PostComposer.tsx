import { useState, useEffect } from "react";
import { createPost, fetchMyGamesLite, type MediaType } from "@/lib/social/api";
import {
  Image as ImageIcon, Film, Link as LinkIcon, X, Send, Loader2, Tag,
  FileText, Code2, Palette, BarChart3, Lock, Gamepad2, Plus, Trash2,
} from "lucide-react";

type Poll = { question: string; options: string[] };

export function PostComposer({ onCreated }: { onCreated: () => void }) {
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
      className={`shrink-0 h-9 px-3 rounded-full grid grid-flow-col auto-cols-max items-center gap-1.5 text-[11px] font-medium transition active:scale-95 ${active ? "bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-sm" : "bg-muted/40 text-muted-foreground hover:text-primary hover:bg-primary/10"}`}>
      {children}
    </button>
  );

  return (
    <div className="panel rounded-2xl p-3 space-y-3 border border-border/60 shadow-sm transition-all">
      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        onFocus={() => setExpanded(true)}
        placeholder="¿Qué quieres compartir?"
        rows={expanded ? 3 : 1}
        maxLength={2000}
        style={textColor ? { color: textColor } : undefined}
        className="w-full bg-transparent rounded-md text-sm resize-none outline-none placeholder:text-muted-foreground transition-all"
      />

      {previews.length > 0 && (
        <div className={`grid gap-2 ${previews.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
          {previews.map((url, i) => (
            <div key={url} className="relative rounded-xl overflow-hidden bg-muted/30 border border-border/50">
              {mediaType === "video" ? <video src={url} className="w-full max-h-64 object-cover" muted /> : <img src={url} alt="" className="w-full max-h-64 object-cover" />}
              <button onClick={() => removeFile(i)} className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/60 text-white grid place-items-center active:scale-90 transition">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {documents.length > 0 && (
        <div className="space-y-1.5">
          {documents.map((d, i) => (
            <div key={i} className="flex items-center gap-2 bg-input/40 rounded-xl px-3 py-2 text-xs">
              <FileText size={14} className="text-primary shrink-0" />
              <span className="flex-1 truncate">{d.name}</span>
              <span className="text-muted-foreground tabular-nums">{(d.size / 1024).toFixed(0)}KB</span>
              <button onClick={() => setDocuments(documents.filter((_, idx) => idx !== i))}>
                <X size={14} className="text-muted-foreground" />
              </button>
            </div>
          ))}
        </div>
      )}

      {panel === "link" && (
        <div className="flex items-center gap-2 bg-input/40 rounded-xl px-3 py-2 animate-in fade-in slide-in-from-top-1">
          <LinkIcon size={14} className="text-muted-foreground" />
          <input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://…"
            className="flex-1 bg-transparent text-xs outline-none" />
        </div>
      )}

      {panel === "tags" && (
        <div className="flex items-center gap-2 bg-input/40 rounded-xl px-3 py-2">
          <Tag size={14} className="text-muted-foreground" />
          <input value={tagInput} onChange={e => setTagInput(e.target.value)} placeholder="etiquetas separadas por coma"
            className="flex-1 bg-transparent text-xs outline-none" />
        </div>
      )}

      {panel === "color" && (
        <div className="flex items-center gap-3 bg-input/40 rounded-xl px-3 py-2 text-xs">
          <Palette size={14} className="text-muted-foreground" />
          <span>Color del texto:</span>
          <input type="color" value={textColor || "#111827"} onChange={e => setTextColor(e.target.value)}
            className="w-8 h-8 rounded cursor-pointer" />
          {textColor && <button onClick={() => setTextColor("")} className="text-muted-foreground underline">quitar</button>}
        </div>
      )}

      {panel === "html" && (
        <div className="space-y-2">
          <textarea value={htmlContent} onChange={e => setHtmlContent(e.target.value)}
            placeholder="Pega HTML aquí (se mostrará en un visor seguro)…"
            rows={4}
            className="w-full bg-input/40 rounded-xl px-3 py-2 text-xs font-mono outline-none resize-y" />
          {htmlContent.trim() && (
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="text-[10px] px-2 py-1 bg-muted/40 text-muted-foreground">Vista previa</div>
              <iframe srcDoc={htmlContent} sandbox="" className="w-full h-40 bg-white" title="html-preview" />
            </div>
          )}
        </div>
      )}

      {panel === "game" && myGames.length > 0 && (
        <div className="bg-input/40 rounded-xl px-3 py-2 space-y-2">
          <div className="text-xs flex items-center gap-2"><Gamepad2 size={14} /> Fijar un juego tuyo</div>
          <select value={pinnedGameId} onChange={e => setPinnedGameId(e.target.value)}
            className="w-full bg-background rounded px-2 py-1.5 text-xs">
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
        <div className="bg-input/40 rounded-xl px-3 py-2 space-y-2">
          <div className="flex items-center gap-2 text-xs"><Lock size={13} /> Contenido desbloqueable</div>
          <textarea value={lockedContent} onChange={e => setLockedContent(e.target.value)}
            placeholder="Este texto quedará oculto hasta cumplir la condición…"
            rows={2}
            className="w-full bg-background rounded px-2 py-1.5 text-xs outline-none" />
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <label className="space-y-1">
              <span className="text-muted-foreground">Meta de reacciones</span>
              <input type="number" min={1} value={unlockGoal}
                onChange={e => setUnlockGoal(e.target.value ? Number(e.target.value) : "")}
                placeholder="ej. 50"
                className="w-full bg-background rounded px-2 py-1.5" />
            </label>
            <label className="space-y-1">
              <span className="text-muted-foreground">O fecha</span>
              <input type="datetime-local" value={unlockAt} onChange={e => setUnlockAt(e.target.value)}
                className="w-full bg-background rounded px-2 py-1.5" />
            </label>
          </div>
          <div className="text-[10px] text-muted-foreground">Se desbloquea al cumplir cualquiera de las dos.</div>
        </div>
      )}

      {err && <div className="text-xs text-destructive">{err}</div>}

      {expanded && (
        <div className="text-[10px] font-display tracking-widest text-muted-foreground px-1">AÑADIR A TU PUBLICACIÓN</div>
      )}

      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1">
        <label title="Imagen o GIF" className="shrink-0 h-9 px-3 rounded-full grid grid-flow-col auto-cols-max items-center gap-1.5 bg-muted/40 text-muted-foreground text-[11px] font-medium hover:text-primary hover:bg-primary/10 cursor-pointer active:scale-95 transition">
          <ImageIcon size={15} /> {expanded && <span>Imagen</span>}
          <input type="file" hidden accept="image/*,image/gif" multiple onChange={e => onMedia(e, "image")} />
        </label>
        <label title="Vídeo" className="shrink-0 h-9 px-3 rounded-full grid grid-flow-col auto-cols-max items-center gap-1.5 bg-muted/40 text-muted-foreground text-[11px] font-medium hover:text-primary hover:bg-primary/10 cursor-pointer active:scale-95 transition">
          <Film size={15} /> {expanded && <span>Vídeo</span>}
          <input type="file" hidden accept="video/*" onChange={e => onMedia(e, "video")} />
        </label>
        <label title="Documentos" className="shrink-0 h-9 px-3 rounded-full grid grid-flow-col auto-cols-max items-center gap-1.5 bg-muted/40 text-muted-foreground text-[11px] font-medium hover:text-primary hover:bg-primary/10 cursor-pointer active:scale-95 transition">
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

      <div className="flex items-center justify-end gap-2 pt-1">
        <button onClick={submit} disabled={!canSubmit}
          className="h-10 pl-4 pr-5 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground font-display tracking-widest text-xs flex items-center gap-1.5 active:scale-95 transition disabled:opacity-40 disabled:pointer-events-none shadow-sm">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={13} />}
          {busy ? "…" : "PUBLICAR"}
        </button>
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
    <div className="bg-input/40 rounded-xl px-3 py-2 space-y-2">
      <div className="flex items-center gap-2 text-xs"><BarChart3 size={13} /> Encuesta</div>
      <input value={poll.question} onChange={e => setPoll({ ...poll, question: e.target.value })}
        placeholder="Pregunta…" className="w-full bg-background rounded px-2 py-1.5 text-xs" />
      {poll.options.map((o, i) => (
        <div key={i} className="flex items-center gap-2">
          <input value={o} onChange={e => setOpt(i, e.target.value)}
            placeholder={`Opción ${i + 1}`}
            className="flex-1 bg-background rounded px-2 py-1.5 text-xs" />
          {poll.options.length > 2 && (
            <button onClick={() => setPoll({ ...poll, options: poll.options.filter((_, idx) => idx !== i) })}>
              <Trash2 size={14} className="text-muted-foreground" />
            </button>
          )}
        </div>
      ))}
      <div className="flex items-center gap-2">
        {poll.options.length < 4 && (
          <button onClick={() => setPoll({ ...poll, options: [...poll.options, ""] })}
            className="text-[11px] flex items-center gap-1 text-primary">
            <Plus size={12} /> añadir opción
          </button>
        )}
        <button onClick={() => setPoll(null)} className="ml-auto text-[11px] text-muted-foreground underline">
          quitar encuesta
        </button>
      </div>
    </div>
  );
}
