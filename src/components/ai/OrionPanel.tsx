import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Send, Sparkles, Loader2, Trash2, Bot, Rocket, Zap, HelpCircle,
} from "lucide-react";
import { orionChat, type OrionMessage } from "@/lib/ai/orion";

/** Renders texto con bloques de código y markdown básico sin dependencias. */
function RichText({ text }: { text: string }) {
  const blocks = text.split(/(```[\s\S]*?```)/g);
  return (
    <div className="space-y-1.5 text-[13px] leading-relaxed whitespace-pre-wrap break-words">
      {blocks.map((b, i) => {
        if (b.startsWith("```")) {
          const code = b.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
          return (
            <pre
              key={i}
              className="bg-muted/70 border border-border rounded-lg p-2.5 text-[11px] leading-relaxed overflow-x-auto font-mono"
            >
              {code}
            </pre>
          );
        }
        return <p key={i}>{b}</p>;
      })}
    </div>
  );
}

const QUICK_PROMPTS = [
  "¿Cómo funciona el motor de Asternal? Explícamelo",
  "Quiero crear un juego de plataformas: ¿por dónde empiezo?",
  "¿Qué puedo hacer con los scripts del motor?",
  "¿Cómo se crean escenas y personajes?",
];

const WELCOME = `¡Hola! 👋 Soy **Orión**, tu asistente de desarrollo de juegos.

Conozco a fondo el **motor de Asternal** (entidades, escenas, scripting, animaciones, sonido y nube). Estoy aquí para ayudarte a crear tu juego de forma profesional, paso a paso.

Pregúntame lo que quieras: cómo funciona el motor, ideas para tu juego, o cómo resolver algo concreto. 🚀`;

interface Msg {
  role: "user" | "assistant";
  content: string;
  model?: string;
  cost?: number;
}

export default function OrionPanel({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<Msg[]>([{ role: "assistant", content: WELCOME }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const busyRef = useRef(false);

  const scrollBottom = useCallback(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, []);

  useEffect(() => {
    scrollBottom();
  }, [messages, busy, scrollBottom]);

  useEffect(() => {
    taRef.current?.focus();
  }, []);

  const send = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      setErr(null);
      setMessages((prev) => [...prev, { role: "user", content: q }]);
      setInput("");
      try {
        const history: OrionMessage[] = messages
          .filter((m) => m.role !== "assistant" || m.content !== WELCOME)
          .concat({ role: "user", content: q })
          .map((m) => ({ role: m.role, content: m.content }));
        const res = await orionChat(history, { coding: true });
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: res.content, model: res.model, cost: res.costUsd },
        ]);
        if (res.balanceUsd > 0) setBalance(res.balanceUsd);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Ocurrió un error inesperado.");
      } finally {
        busyRef.current = false;
        setBusy(false);
        taRef.current?.focus();
      }
    },
    [messages]
  );

  const clear = useCallback(() => {
    setMessages([{ role: "assistant", content: WELCOME }]);
    setErr(null);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="fixed inset-0 z-[90] bg-background/97 backdrop-blur-xl flex flex-col"
      style={{ height: "100dvh" }}
    >
      {/* Cabecera */}
      <header className="shrink-0 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="max-w-2xl md:max-w-3xl mx-auto flex items-center gap-3 px-4 py-3">
          <div
            className="relative shrink-0 rounded-full grid place-items-center text-primary-foreground"
            style={{
              width: 44,
              height: 44,
              padding: 2,
              background: "conic-gradient(from 210deg, var(--color-primary), var(--color-accent), var(--color-primary))",
              boxShadow: "0 4px 16px -6px oklch(0.55 0.22 258/0.55)",
            }}
          >
            <div
              className="w-full h-full rounded-full grid place-items-center"
              style={{ background: "linear-gradient(135deg, var(--color-primary), var(--color-accent))" }}
            >
              <Bot size={20} strokeWidth={2.2} className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)]" />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] leading-tight font-semibold flex items-center gap-1.5">
              Orión
              <span className="shrink-0 text-[8px] font-display tracking-widest px-1.5 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                ASISTENTE IA
              </span>
            </div>
            <div className="text-[10px] text-muted-foreground truncate flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              Ayuda profesional para crear juegos · motor de Asternal
              {balance !== null && (
                <span className="ml-1 text-[9px] font-mono text-muted-foreground/70">
                  · saldo ${balance.toFixed(2)}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={clear}
            title="Limpiar conversación"
            className="w-9 h-9 rounded-xl border border-border/70 bg-background grid place-items-center active:scale-95 transition shrink-0 text-muted-foreground hover:text-rose-500"
          >
            <Trash2 size={15} />
          </button>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl border border-border/70 bg-background grid place-items-center active:scale-95 transition shrink-0"
          >
            <X size={16} />
          </button>
        </div>
      </header>

      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="max-w-2xl md:max-w-3xl mx-auto px-4 py-4 space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              {m.role === "assistant" && (
                <div
                  className="shrink-0 rounded-full grid place-items-center text-primary-foreground"
                  style={{ width: 28, height: 28, background: "linear-gradient(135deg, var(--color-primary), var(--color-accent))" }}
                >
                  <Bot size={14} />
                </div>
              )}
              <div
                className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 shadow-sm ${
                  m.role === "user"
                    ? "bg-gradient-to-br from-primary to-accent text-primary-foreground rounded-br-md shadow-[0_4px_14px_-6px_oklch(0.55_0.22_258/0.45)]"
                    : "bg-card border border-border rounded-bl-md"
                }`}
              >
                <RichText text={m.content} />
                {m.model && (
                  <div className="mt-1.5 flex items-center gap-1 text-[8px] font-mono text-muted-foreground/60">
                    <Zap size={8} /> {m.model}
                    {typeof m.cost === "number" && m.cost > 0 && ` · $${m.cost.toFixed(5)}`}
                  </div>
                )}
              </div>
            </div>
          ))}

          {busy && (
            <div className="flex gap-2 justify-start">
              <div
                className="shrink-0 rounded-full grid place-items-center text-primary-foreground"
                style={{ width: 28, height: 28, background: "linear-gradient(135deg, var(--color-primary), var(--color-accent))" }}
              >
                <Bot size={14} />
              </div>
              <div className="bg-card border border-border rounded-2xl rounded-bl-md px-3.5 py-3 shadow-sm flex items-center gap-2">
                <Loader2 size={13} className="animate-spin text-primary" />
                <span className="text-[11px] text-muted-foreground">Orión está pensando…</span>
              </div>
            </div>
          )}

          {err && (
            <div className="flex justify-center">
              <div className="max-w-[85%] rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-600 dark:text-rose-300">
                {err}
              </div>
            </div>
          )}

          {messages.length <= 1 && !busy && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {QUICK_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => void send(p)}
                  className="text-left px-3 py-2.5 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-primary/[0.04] active:scale-[0.98] transition text-[11px] text-muted-foreground hover:text-foreground flex items-start gap-2"
                >
                  <Sparkles size={12} className="text-primary shrink-0 mt-0.5" />
                  <span>{p}</span>
                </button>
              ))}
            </div>
          )}

          <div ref={endRef} />
        </div>
      </div>

      {/* Barra de escritura */}
      <div className="shrink-0 border-t border-border/60 bg-background/80 backdrop-blur-md">
        <div className="max-w-2xl md:max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-1.5 shadow-sm">
            <textarea
              ref={taRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              rows={1}
              placeholder="Pregúntale a Orión sobre tu juego…"
              className="flex-1 bg-transparent outline-none resize-none px-2.5 py-2 text-[13px] placeholder:text-muted-foreground/50 max-h-28"
              style={{ fieldSizing: "content" as never }}
            />
            <button
              onClick={() => void send(input)}
              disabled={busy || !input.trim()}
              className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground grid place-items-center active:scale-95 transition shrink-0 disabled:opacity-40 disabled:active:scale-100 shadow-[0_4px_12px_-5px_oklch(0.55_0.22_258/0.5)]"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            </button>
          </div>
          <div className="flex items-center justify-center gap-1 pt-2 text-[9px] text-muted-foreground/50">
            <Rocket size={9} /> Orión conoce el motor de Asternal · responde en español
            <HelpCircle size={9} className="ml-1" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
