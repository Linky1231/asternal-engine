import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  X,
  ClipboardList,
  FolderOpen,
  MessagesSquare,
  Plus,
  Trash2,
  Download,
  Paperclip,
  Send,
  Loader2,
  ChevronRight,
  ArrowLeft,
  Play,
  Check,
  RotateCcw,
  User,
} from "lucide-react";
import {
  listTasks,
  createTask,
  setTaskStatus,
  deleteTask,
  listFiles,
  addFile,
  deleteFile,
  listThreads,
  createThread,
  deleteThread,
  listThreadMessages,
  addThreadMessage,
  formatBytes,
  fileExt,
  fileEmoji,
  type WorkTask,
  type WorkFile,
  type WorkThread,
  type ThreadMessage,
} from "@/lib/social/work";
import { fetchGroupMembers } from "@/lib/social/chat";
import type { GroupMember } from "@/lib/social/chat";
import type { Profile } from "@/lib/social/api";

const MAX_FILE = 4 * 1024 * 1024; // 4 MB: límite práctico de localStorage

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { day: "2-digit", month: "short" });
}

/** Marco común de los paneles del chat de trabajo (overlay centrado). */
function Overlay({
  title,
  icon,
  onClose,
  children,
}: {
  title: string;
  icon: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-[96] bg-black/55 backdrop-blur-md grid place-items-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, y: 8 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.96, y: 8 }}
        transition={{ duration: 0.16, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-card border border-border rounded-2xl p-4 shadow-xl max-h-[85vh] overflow-y-auto"
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent text-primary-foreground grid place-items-center shrink-0">
            {icon}
          </div>
          <div className="text-sm font-semibold flex-1">{title}</div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg border border-border grid place-items-center active:scale-95 shrink-0"
          >
            <X size={14} />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

// ───── Gestor de tareas ─────

export function TaskManager({
  chatId,
  myId,
  myName,
  canAssign,
  onClose,
}: {
  chatId: string;
  myId: string;
  myName: string;
  canAssign: boolean;
  onClose: () => void;
}) {
  const [tasks, setTasks] = useState<WorkTask[]>(() => listTasks(chatId));
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [assignee, setAssignee] = useState("");
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    setTasks(listTasks(chatId));
    void fetchGroupMembers(chatId)
      .then((m) => setMembers(m))
      .catch(() => setMembers([]));
  }, [chatId]);

  const refresh = () => setTasks(listTasks(chatId));

  const submit = () => {
    if (!title.trim()) {
      toast.error("Ponle un título a la tarea");
      return;
    }
    setCreating(true);
    const member = members.find((m) => m.profile.id === assignee);
    createTask({
      chat_id: chatId,
      title,
      description: desc,
      assignee_id: assignee || null,
      assignee_name: member ? member.profile.display_name || member.profile.username || "Miembro" : "",
      created_by: myId,
      created_by_name: myName,
    });
    setCreating(false);
    setTitle("");
    setDesc("");
    setAssignee("");
    setFormOpen(false);
    refresh();
    toast.success("Tarea creada ✓");
  };

  const setStatus = (id: string, status: WorkTask["status"]) => {
    setBusyId(id);
    setTaskStatus(id, status);
    refresh();
    setBusyId(null);
  };

  const remove = (id: string) => {
    deleteTask(id);
    refresh();
    toast.success("Tarea eliminada");
  };

  const canDeleteTask = (t: WorkTask) => canAssign || t.created_by === myId;

  const section = (status: WorkTask["status"], label: string, empty: string) => {
    const list = tasks.filter((t) => t.status === status);
    return (
      <div className="mb-2">
        <div className="text-[9px] font-display tracking-[0.18em] text-muted-foreground/70 mb-1.5">{label}</div>
        {list.length === 0 ? (
          <div className="text-[11px] text-muted-foreground/50 px-2 py-1.5 rounded-xl border border-dashed border-border/60">
            {empty}
          </div>
        ) : (
          <div className="space-y-1.5">
            {list.map((t) => (
              <div key={t.id} className="px-3 py-2 rounded-xl bg-background border border-border/60">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-semibold leading-snug break-words">{t.title}</div>
                    {t.description && (
                      <div className="text-[11px] text-muted-foreground mt-0.5 whitespace-pre-wrap break-words leading-snug">
                        {t.description}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold ${
                          t.assignee_id
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <User size={9} /> {t.assignee_name || "Sin asignar"}
                      </span>
                      <span className="text-[9px] text-muted-foreground/60">
                        por {t.created_by_name || "alguien"} · {fmtWhen(t.created_at)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {status === "todo" && (
                      <button
                        onClick={() => setStatus(t.id, "doing")}
                        disabled={busyId === t.id}
                        title="Empezar"
                        className="w-7 h-7 rounded-lg border border-primary/30 bg-primary/10 text-primary grid place-items-center active:scale-95 transition disabled:opacity-40"
                      >
                        {busyId === t.id ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
                      </button>
                    )}
                    {status === "doing" && (
                      <button
                        onClick={() => setStatus(t.id, "done")}
                        disabled={busyId === t.id}
                        title="Completar"
                        className="w-7 h-7 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 grid place-items-center active:scale-95 transition disabled:opacity-40"
                      >
                        {busyId === t.id ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                      </button>
                    )}
                    {status === "done" && (
                      <button
                        onClick={() => setStatus(t.id, "todo")}
                        disabled={busyId === t.id}
                        title="Reabrir"
                        className="w-7 h-7 rounded-lg border border-border text-muted-foreground grid place-items-center active:scale-95 transition disabled:opacity-40"
                      >
                        <RotateCcw size={11} />
                      </button>
                    )}
                    {canDeleteTask(t) && (
                      <button
                        onClick={() => remove(t.id)}
                        title="Eliminar"
                        className="w-7 h-7 rounded-lg border border-border text-muted-foreground hover:text-destructive hover:border-rose-300 grid place-items-center active:scale-95 transition"
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Overlay title="Gestor de tareas" icon={<ClipboardList size={14} />} onClose={onClose}>
      <p className="text-[11px] text-muted-foreground mb-3">
        {canAssign
          ? "Asigna tareas al equipo. Las crean los administradores y moderadores; todos las ven."
          : "Las tareas las asignan los administradores y moderadores del grupo."}
      </p>

      {canAssign && !formOpen && (
        <button
          onClick={() => setFormOpen(true)}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground text-[11px] font-display tracking-widest active:scale-[0.98] transition mb-3"
        >
          <Plus size={13} /> NUEVA TAREA
        </button>
      )}

      {canAssign && formOpen && (
        <div className="mb-3 rounded-xl border border-primary/25 bg-primary/5 p-3 space-y-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder="Título de la tarea"
            className="w-full bg-input/50 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 border border-border/60"
          />
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            maxLength={300}
            rows={2}
            placeholder="Descripción (opcional)"
            className="w-full bg-input/50 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 border border-border/60 resize-none"
          />
          <div>
            <label className="text-[10px] text-muted-foreground mb-1 block">Asignar a</label>
            <select
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              className="w-full bg-input/50 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 border border-border/60"
            >
              <option value="">Sin asignar</option>
              {members
                .filter((m) => m.profile.id !== myId)
                .map((m) => (
                  <option key={m.profile.id} value={m.profile.id}>
                    {m.profile.display_name || m.profile.username || "Miembro"}
                  </option>
                ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFormOpen(false)}
              disabled={creating}
              className="flex-1 py-2 rounded-xl border border-border bg-background text-[10px] font-display tracking-widest active:scale-[0.98] transition disabled:opacity-40"
            >
              CANCELAR
            </button>
            <button
              onClick={submit}
              disabled={creating}
              className="flex-1 py-2 rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground text-[10px] font-display tracking-widest active:scale-[0.98] transition disabled:opacity-40 flex items-center justify-center gap-1.5"
            >
              {creating ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
              {creating ? "CREANDO…" : "CREAR TAREA"}
            </button>
          </div>
        </div>
      )}

      {section("todo", "PENDIENTES", "Sin tareas pendientes 🎉")}
      {section("doing", "EN PROGRESO", "Nada en progreso ahora mismo")}
      {section("done", "COMPLETADAS", "Aún no hay tareas completadas")}
    </Overlay>
  );
}

// ───── Gestor de archivos ─────

export function FileManager({
  chatId,
  myId,
  canDelete,
  onClose,
}: {
  chatId: string;
  myId: string;
  canDelete: boolean;
  onClose: () => void;
}) {
  const [files, setFiles] = useState<WorkFile[]>(() => listFiles(chatId));
  const [reading, setReading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = () => setFiles(listFiles(chatId));

  const pick = (f: File) => {
    if (f.size > MAX_FILE) {
      toast.error("Archivo demasiado grande", {
        description: "Máximo 4 MB en este modo. Sube un archivo más pequeño.",
      });
      return;
    }
    setReading(true);
    const reader = new FileReader();
    reader.onload = () => {
      addFile({
        chat_id: chatId,
        name: f.name,
        mime: f.type,
        size: f.size,
        dataUrl: String(reader.result ?? ""),
        uploaded_by: myId,
        uploaded_by_name: "",
      });
      setReading(false);
      refresh();
      toast.success("Archivo guardado ✓");
    };
    reader.onerror = () => {
      setReading(false);
      toast.error("No se pudo leer el archivo");
    };
    reader.readAsDataURL(f);
  };

  const remove = (f: WorkFile) => {
    deleteFile(f.id);
    refresh();
    toast.success("Archivo eliminado");
  };

  const canDeleteFile = (f: WorkFile) => canDelete || f.uploaded_by === myId;

  return (
    <Overlay title="Gestor de archivos" icon={<FolderOpen size={14} />} onClose={onClose}>
      <p className="text-[11px] text-muted-foreground mb-3">
        Guarda archivos de cualquier tipo (documentos, imágenes, vídeos, código…) y quedarán guardados
        en este chat. Máximo 4 MB por archivo.
      </p>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          e.target.value = "";
          if (f) pick(f);
        }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={reading}
        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground text-[11px] font-display tracking-widest active:scale-[0.98] transition disabled:opacity-40 mb-3"
      >
        {reading ? <Loader2 size={13} className="animate-spin" /> : <Paperclip size={13} />}
        {reading ? "GUARDANDO…" : "SUBIR ARCHIVO"}
      </button>

      {files.length === 0 ? (
        <div className="text-center text-[11px] text-muted-foreground/60 py-8 px-4 leading-relaxed rounded-xl border border-dashed border-border/60">
          Todavía no hay archivos en este chat.
          <br />
          Sube el primero con el botón de arriba.
        </div>
      ) : (
        <div className="space-y-1.5">
          {files.map((f) => {
            const ext = fileExt(f.name);
            const canDel = canDeleteFile(f);
            return (
              <div key={f.id} className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-background border border-border/60">
                <span className="text-lg shrink-0">{fileEmoji(ext)}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-semibold truncate">{f.name}</div>
                  <div className="text-[10px] text-muted-foreground/70">
                    {formatBytes(f.size)}
                    {ext ? ` · .${ext}` : ""} · {f.uploaded_by_name || "yo"} · {fmtWhen(f.created_at)}
                  </div>
                </div>
                <a
                  href={f.dataUrl}
                  download={f.name}
                  title="Descargar"
                  className="w-8 h-8 rounded-lg border border-border text-muted-foreground hover:text-primary hover:border-primary/40 grid place-items-center active:scale-95 transition shrink-0"
                >
                  <Download size={13} />
                </a>
                {canDel && (
                  <button
                    onClick={() => remove(f)}
                    title="Eliminar"
                    className="w-8 h-8 rounded-lg border border-border text-muted-foreground hover:text-destructive hover:border-rose-300 grid place-items-center active:scale-95 transition shrink-0"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Overlay>
  );
}

// ───── Gestor de hilos ─────

export function ThreadsManager({
  chatId,
  myId,
  canDelete,
  onClose,
  onOpen,
}: {
  chatId: string;
  myId: string;
  canDelete: boolean;
  onClose: () => void;
  onOpen: (t: WorkThread) => void;
}) {
  const [threads, setThreads] = useState<WorkThread[]>(() => listThreads(chatId));
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const refresh = () => setThreads(listThreads(chatId));

  const submit = () => {
    if (!title.trim()) {
      toast.error("Ponle un nombre al hilo");
      return;
    }
    setCreating(true);
    const t = createThread(chatId, title, myId, "");
    setCreating(false);
    setTitle("");
    setFormOpen(false);
    refresh();
    toast.success("Hilo creado ✓");
    onOpen(t);
  };

  const remove = (id: string) => {
    deleteThread(id);
    refresh();
    toast.success("Hilo eliminado");
  };

  return (
    <Overlay title="Hilos del chat" icon={<MessagesSquare size={14} />} onClose={onClose}>
      <p className="text-[11px] text-muted-foreground mb-3">
        Crea hilos para organizar conversaciones por tema sin mezclarlas con el chat principal.
      </p>
      {!formOpen && (
        <button
          onClick={() => setFormOpen(true)}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground text-[11px] font-display tracking-widest active:scale-[0.98] transition mb-3"
        >
          <Plus size={13} /> NUEVO HILO
        </button>
      )}
      {formOpen && (
        <div className="mb-3 rounded-xl border border-primary/25 bg-primary/5 p-3 space-y-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            placeholder="Nombre del hilo — p. ej. «Ideas para la próxima actualización»"
            className="w-full bg-input/50 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 border border-border/60"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setFormOpen(false)}
              disabled={creating}
              className="flex-1 py-2 rounded-xl border border-border bg-background text-[10px] font-display tracking-widest active:scale-[0.98] transition disabled:opacity-40"
            >
              CANCELAR
            </button>
            <button
              onClick={submit}
              disabled={creating}
              className="flex-1 py-2 rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground text-[10px] font-display tracking-widest active:scale-[0.98] transition disabled:opacity-40 flex items-center justify-center gap-1.5"
            >
              {creating ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
              {creating ? "CREANDO…" : "CREAR HILO"}
            </button>
          </div>
        </div>
      )}
      {threads.length === 0 ? (
        <div className="text-center text-[11px] text-muted-foreground/60 py-8 px-4 leading-relaxed rounded-xl border border-dashed border-border/60">
          Aún no hay hilos en este chat.
          <br />
          Crea el primero para empezar una conversación organizada.
        </div>
      ) : (
        <div className="space-y-1.5">
          {threads.map((t) => {
            const msgs = listThreadMessages(t.id);
            const last = msgs[msgs.length - 1];
            const canDel = canDelete || t.created_by === myId;
            return (
              <button
                key={t.id}
                onClick={() => onOpen(t)}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-background border border-border/60 hover:border-primary/40 hover:bg-primary/5 transition text-left active:scale-[0.99]"
              >
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-accent text-primary-foreground grid place-items-center shrink-0">
                  <MessagesSquare size={14} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-semibold truncate">{t.title}</div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {msgs.length} {msgs.length === 1 ? "mensaje" : "mensajes"}
                    {last ? ` · ${last.content.slice(0, 40)}` : " · sin mensajes aún"}
                  </div>
                </div>
                {canDel && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(t.id);
                    }}
                    className="w-7 h-7 rounded-lg border border-border text-muted-foreground hover:text-destructive hover:border-rose-300 grid place-items-center shrink-0"
                  >
                    <Trash2 size={11} />
                  </span>
                )}
                <ChevronRight size={14} className="text-muted-foreground/60 shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </Overlay>
  );
}

// ───── Vista de un hilo ─────

export function ThreadView({
  thread,
  chatId,
  myId,
  senders,
  onBack,
  onClose,
}: {
  thread: WorkThread;
  chatId: string;
  myId: string;
  senders: Map<string, Profile>;
  onBack: () => void;
  onClose: () => void;
}) {
  const [msgs, setMsgs] = useState<ThreadMessage[]>(() => listThreadMessages(thread.id));
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMsgs(listThreadMessages(thread.id));
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thread.id]);

  const send = () => {
    if (!draft.trim()) return;
    addThreadMessage(thread.id, chatId, myId, draft);
    setDraft("");
    setMsgs(listThreadMessages(thread.id));
    requestAnimationFrame(() => {
      const el = listRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  };

  const nameOf = (id: string) => {
    if (id === myId) return "Tú";
    const p = senders.get(id);
    return p ? p.display_name || p.username || "Usuario" : "Usuario";
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-[96] bg-black/55 backdrop-blur-md grid place-items-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, y: 8 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.96, y: 8 }}
        transition={{ duration: 0.16, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-xl flex flex-col overflow-hidden max-h-[85vh]"
      >
        <div className="flex items-center gap-2 p-3 border-b border-border/60">
          <button
            onClick={onBack}
            title="Volver a los hilos"
            className="w-8 h-8 rounded-lg border border-border grid place-items-center active:scale-95 shrink-0"
          >
            <ArrowLeft size={14} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold truncate flex items-center gap-1.5">
              <MessagesSquare size={13} className="text-primary shrink-0" /> {thread.title}
            </div>
            <div className="text-[10px] text-muted-foreground/70">
              {msgs.length} {msgs.length === 1 ? "mensaje" : "mensajes"} en el hilo
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg border border-border grid place-items-center active:scale-95 shrink-0"
          >
            <X size={14} />
          </button>
        </div>

        <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-2 no-scrollbar">
          {msgs.length === 0 ? (
            <div className="text-center text-[11px] text-muted-foreground/60 py-10 px-4">
              Sin mensajes todavía.
              <br />
              Escribe el primero para empezar el hilo.
            </div>
          ) : (
            msgs.map((m) => {
              const mine = m.sender_id === myId;
              return (
                <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                  <div className="text-[9px] text-muted-foreground/70 mb-0.5 px-1">{nameOf(m.sender_id)}</div>
                  <div
                    className={
                      mine
                        ? "bg-gradient-to-br from-primary to-accent text-primary-foreground rounded-2xl rounded-br-md px-3 py-2 shadow-sm max-w-[85%]"
                        : "bg-background border border-border rounded-2xl rounded-bl-md px-3 py-2 shadow-sm max-w-[85%]"
                    }
                  >
                    <div className="text-[13px] leading-snug whitespace-pre-wrap break-words">{m.content}</div>
                    <div className={`text-[9px] mt-1 ${mine ? "text-primary-foreground/70" : "text-muted-foreground/70"} text-right`}>
                      {fmtWhen(m.created_at)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="shrink-0 p-3 border-t border-border/60">
          <div className="flex items-end gap-2 bg-background border border-border rounded-2xl px-3 py-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              placeholder="Escribe en el hilo…"
              className="flex-1 bg-transparent outline-none resize-none text-sm max-h-24 py-1"
            />
            <button
              onClick={send}
              disabled={!draft.trim()}
              className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground grid place-items-center active:scale-95 transition shrink-0 disabled:opacity-40"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
