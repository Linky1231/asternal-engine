// Orión — asistente IA de Asternal. Usa Gemini BYOK (clave del usuario en navegador).
import { ENGINE_KNOWLEDGE } from "./engine-knowledge";
import { loadGeminiConfig, geminiChat, geminiChatStream, type GeminiRole } from "./gemini-provider";

export function getOrionApiKey(): string {
  return "gemini-byok";
}

export type OrionRole = "system" | "user" | "assistant";

export interface OrionMessage { role: OrionRole; content: string }
export interface OrionResult { content: string; model: string; costUsd: number; balanceUsd: number }
export interface OrionError { error: string }

// ─── Persistencia de chats ───
export interface OrionStoredMsg { role: "user" | "assistant"; content: string; model?: string; cost?: number }
export interface OrionStoredChat { id: string; title: string; createdAt: string; updatedAt: string; messages: OrionStoredMsg[] }

const CHATS_KEY = "orion_chats_v1";
const ACTIVE_KEY = "orion_active_chat_v1";
const MAX_CHATS = 50;

function safeGet(key: string): string | null { try { return localStorage.getItem(key); } catch { return null; } }
function safeSet(key: string, value: string): void { try { localStorage.setItem(key, value); } catch { /* quota */ } }

export function loadOrionChats(): OrionStoredChat[] {
  const raw = safeGet(CHATS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as OrionStoredChat[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(c => c && typeof c.id === "string" && Array.isArray(c.messages)).sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
  } catch { return []; }
}

export function saveOrionChats(chats: OrionStoredChat[]): void { safeSet(CHATS_KEY, JSON.stringify(chats.slice(0, MAX_CHATS))); }
export function loadOrionActiveChat(): string | null { return safeGet(ACTIVE_KEY); }
export function saveOrionActiveChat(id: string | null): void { if (id) safeSet(ACTIVE_KEY, id); else safeSet(ACTIVE_KEY, ""); }

export function createOrionChat(title = "Nueva conversación"): OrionStoredChat {
  const now = new Date().toISOString();
  return { id: `orion_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`, title, createdAt: now, updatedAt: now, messages: [] };
}

export function orionTitleFrom(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "Nueva conversación";
  return clean.length > 42 ? `${clean.slice(0, 42)}…` : clean;
}

const SYSTEM_PROMPT = `Eres Orión, el asistente de IA de Asternal para desarrolladores de videojuegos. Hablas en español. Conoces el motor completo de Asternal. Ayuda a crear juegos, resolver bugs y dar consejos profesionales. Usa markdown simple. Si algo no existe en el motor, dilo honestamente.

=== CONOCIMIENTO DEL MOTOR ===
${ENGINE_KNOWLEDGE}`;

export function buildOrionMessages(history: OrionMessage[]): OrionMessage[] {
  return [{ role: "system", content: SYSTEM_PROMPT }, ...history];
}

export function needsCodingModel(q: string): boolean {
  return /(c[oó]digo|code|script|function|api|funci[oó]n|clase|class|typescript|tsx|error|bug|debug|import|export)/i.test(q);
}

/** Envía chat a Orión usando Gemini directamente desde el navegador. */
export async function orionChat(
  history: OrionMessage[],
  opts: { coding?: boolean; maxTokens?: number; temperature?: number; signal?: AbortSignal } = {}
): Promise<OrionResult> {
  const cfg = loadGeminiConfig();
  if (!cfg) throw new Error("Configura tu clave de Gemini en Ajustes de IA para usar Orión.");
  const geminiHistory = history
    .filter(m => m.role !== "system")
    .map(m => ({ role: m.role === "assistant" ? "model" : "user", content: m.content }));
  const systemPrompt = buildOrionMessages([]).find(m => m.role === "system")?.content ?? "";
  const r = await geminiChat(geminiHistory, {
    systemPrompt,
    temperature: typeof opts.temperature === "number" ? opts.temperature : 0.7,
    maxTokens: opts.maxTokens ?? 2048,
    signal: opts.signal,
  });
  return { content: r.text, model: r.model, costUsd: 0, balanceUsd: 0 };
}

/** Chat con streaming sintético. */
export async function orionChatStream(
  history: OrionMessage[],
  onDelta: (delta: string) => void,
  opts: { coding?: boolean; maxTokens?: number; temperature?: number; signal?: AbortSignal } = {}
): Promise<OrionResult> {
  const r = await orionChat(history, opts);
  onDelta(r.content);
  return r;
}
