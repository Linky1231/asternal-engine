/**
 * Orión — asistente de IA para desarrolladores de juegos de Asternal.
 *
 * Se conecta a OmegaTech (API gratuita, sin clave) que usa GPT-4-mini.
 */
import { ENGINE_KNOWLEDGE } from "./engine-knowledge";

/** OmegaTech — API gratuita sin clave */
const OMEGATECH_DIRECT = "https://api.omegatech.app/api/ai/Gpt-4-mini";
const OMEGATECH_PROXY =
  "https://gxpgczwkovertezeydkt.supabase.co/functions/v1/omega-proxy";

/** La API de OmegaTech no requiere clave. Se mantiene getOrionApiKey por compatibilidad. */
export function getOrionApiKey(): string {
  return "omegatech-free";
}

export type OrionRole = "system" | "user" | "assistant";

export interface OrionMessage {
  role: OrionRole;
  content: string;
}

export interface OrionResult {
  content: string;
  model: string;
  costUsd: number;
  balanceUsd: number;
}

export interface OrionError {
  error: string;
}

// ───────────────────────── Persistencia de chats ─────────────────────────

export interface OrionStoredMsg {
  role: "user" | "assistant";
  content: string;
  model?: string;
  cost?: number;
}

export interface OrionStoredChat {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: OrionStoredMsg[];
}

const CHATS_KEY = "orion_chats_v1";
const ACTIVE_KEY = "orion_active_chat_v1";
const MAX_CHATS = 50;

function safeGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

function safeSet(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* quota */ }
}

/** Carga todos los chats guardados de Orión, más reciente primero. */
export function loadOrionChats(): OrionStoredChat[] {
  const raw = safeGet(CHATS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as OrionStoredChat[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(c => c && typeof c.id === "string" && Array.isArray(c.messages))
      .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
  } catch { return []; }
}

/** Guarda la lista completa de chats. */
export function saveOrionChats(chats: OrionStoredChat[]): void {
  safeSet(CHATS_KEY, JSON.stringify(chats.slice(0, MAX_CHATS)));
}

/** Devuelve el id del chat activo guardado (o null). */
export function loadOrionActiveChat(): string | null {
  return safeGet(ACTIVE_KEY);
}

/** Recuerda qué chat estaba abierto. */
export function saveOrionActiveChat(id: string | null): void {
  if (id) safeSet(ACTIVE_KEY, id);
  else safeSet(ACTIVE_KEY, "");
}

/** Crea un chat nuevo con título derivado de la primera pregunta. */
export function createOrionChat(title = "Nueva conversación"): OrionStoredChat {
  const now = new Date().toISOString();
  return {
    id: `orion_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    title,
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

/** Genera un título corto a partir del primer mensaje del usuario. */
export function orionTitleFrom(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "Nueva conversación";
  return clean.length > 42 ? `${clean.slice(0, 42)}…` : clean;
}

const SYSTEM_PROMPT = `Eres Orión, el asistente de inteligencia artificial de Asternal: una herramienta profesional para desarrolladores de videojuegos, pensada especialmente para creadores independientes (indie). Hablas siempre en español (aunque el usuario escriba en otro idioma, responde en el idioma del usuario).

Tu misión es ayudar a los desarrolladores a crear juegos de forma profesional usando el motor de Asternal. Tienes acceso al código fuente completo del motor (tipos de entidades, escenas, scripting, animaciones, sonido, imágenes, almacenamiento y sincronización en la nube).

Reglas de comportamiento:
- Explica con claridad y con ejemplos prácticos de código.
- Cuando hables de entidades, escenas, scripts o APIs del motor, apóyate en el código que se te proporciona; cita los nombres exactos de los tipos y funciones.
- Da consejos de diseño de videojuegos, optimización, estructura de proyectos, buenas prácticas y patrones de desarrollo.
- Si el usuario describe un juego que quiere crear, proponle un plan concreto paso a paso usando las capacidades del motor.
- Sé amable, cercano y profesional. Usa formato markdown simple (negritas, listas, bloques de código) para que las respuestas sean fáciles de leer en el chat.
- Si algo no se puede hacer con el motor, dilo con honestidad y sugiere una alternativa viable.

A continuación tienes el conocimiento del motor (código fuente). Úsalo como referencia.

=== CONOCIMIENTO DEL MOTOR ===

${ENGINE_KNOWLEDGE}`;

/** Construye los mensajes con el system prompt + historial. */
export function buildOrionMessages(history: OrionMessage[]): OrionMessage[] {
  return [{ role: "system", content: SYSTEM_PROMPT }, ...history];
}

/** Detecta si la pregunta pide resolver código (usa el router de código). */
export function needsCodingModel(q: string): boolean {
  return /(c[oó]digo|code|script|function|api|funci[oó]n|clase|class|typescript|tsx|error|bug|debug|consola|console\.|import|export|variable|m[oó]dulo|componente|hook)/i.test(
    q
  );
}

/**
 * Combina el system prompt + historial en un solo `message` para OmegaTech.
 * OmegaTech no acepta array de mensajes, solo un campo `message`.
 */
function buildSingleMessage(history: OrionMessage[]): string {
  const systemMsg = buildOrionMessages(history).find(m => m.role === "system")?.content ?? "";
  const userMsgs = history
    .filter(m => m.role === "user")
    .map(m => m.content)
    .join("\n\n");
  const assistantMsgs = history
    .filter(m => m.role === "assistant")
    .map(m => `Asistente: ${m.content}`)
    .join("\n\n");
  const parts = [systemMsg];
  if (assistantMsgs) parts.push(assistantMsgs);
  if (userMsgs) parts.push(`Usuario: ${userMsgs}`);
  return parts.join("\n\n---\n\n");
}

/**
 * Envía una petición de chat a OmegaTech (gratuita, sin clave API).
 * OmegaTech usa un endpoint simple: POST con { message } → { answer }.
 */
export async function orionChat(
  history: OrionMessage[],
  opts: { coding?: boolean; maxTokens?: number; temperature?: number } = {}
): Promise<OrionResult> {
  const message = buildSingleMessage(history);

  let res: Response;
  // Intentar vía proxy de Supabase (CORS-safe), luego directo como respaldo.
  try {
    const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4cGdjendrb3ZlcnRlemV5ZGt0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2MTk5NTUsImV4cCI6MjEwMTE5NTk1NX0.GGGjdgi2l2NmQBQ1pS8k37npT3p6hx9Sl5JF0DdQ9cM";
    res = await fetch(OMEGATECH_PROXY, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ message }),
    });
  } catch {
    try {
      res = await fetch(OMEGATECH_DIRECT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
    } catch {
      throw new Error(
        "No se pudo conectar con Orión. Comprueba tu conexión a internet e inténtalo de nuevo."
      );
    }
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    const code = res.status;
    if (code === 429) {
      throw new Error("Límite de peticiones alcanzado. Espera unos segundos y reintenta.");
    }
    throw new Error(`Orión respondió con un error (${code}).${detail ? ` ${detail}` : ""}`);
  }

  const data = (await res.json()) as {
    success?: boolean;
    answer?: string;
    model?: string;
    error?: string;
  };

  if (data.error) {
    throw new Error(`Orión: ${data.error}`);
  }

  const content = data.answer ?? "";
  if (!content) throw new Error("Orión no devolvió ninguna respuesta.");

  return {
    content,
    model: data.model ?? "gpt-4-mini",
    costUsd: 0,
    balanceUsd: 0,
  };
}

/**
 * Chat con "streaming" sintético: OmegaTech no soporta SSE,
 * así que hace la petición completa y entrega el texto de una vez.
 * onDelta recibe el texto completo como un solo fragmento.
 */
export async function orionChatStream(
  history: OrionMessage[],
  onDelta: (delta: string) => void,
  opts: { coding?: boolean; maxTokens?: number; temperature?: number; signal?: AbortSignal } = {}
): Promise<OrionResult> {
  const r = await orionChat(history, opts);
  onDelta(r.content);
  return r;
}
