// Cliente para Prexzy API — AI Writer Chat
// Docs en: https://prexzyapis.com/ai/aiwriter-chat?prompt=&model=
// Contrato real verificado: GET https://prexzyapis.com/ai/aiwriter-chat?prompt=hello&model=gpt-4o-mini
// → { status:true, result:{ text:string[], is_full_answer:boolean, model } }
// La IA conectada a scripts usa este proveedor como alternativa documentada a Manus.

export type PrexzyModel = string;

export interface PrexzyChatOptions {
  prompt: string;
  model?: PrexzyModel;
  signal?: AbortSignal;
}

export interface PrexzyChatResult {
  text: string;
  model: string;
  raw: unknown;
}

const PREXZY_BASE = "https://prexzyapis.com";
const DEFAULT_MODEL: PrexzyModel = "gpt-4o-mini";
/** En navegador usa el proxy del dev server / prod para evitar CORS. */
function prexzyUrl(prompt: string, model: string) {
  const q = `prompt=${encodeURIComponent(prompt)}&model=${encodeURIComponent(model)}`;
  if (typeof window !== "undefined") return `/api/prexzy/aiwriter?${q}`;
  return `${PREXZY_BASE}/ai/aiwriter-chat?${q}`;
}

// Modelos comunes vistos en la doc de AI Writer (no se valida en cliente — el servidor decide).
export const PREXZY_RECOMMENDED_MODELS: PrexzyModel[] = [
  "gpt-4o-mini",
  "gpt-4o",
  "gpt-3.5-turbo",
];

/**
 * Llama a Prexzy AI Writer Chat.
 * Úsalo para que una IA genere/edite scripts del motor: pásale en `prompt`
 * el ENGINE_KNOWLEDGE + la petición del usuario + el JSON del proyecto/entidad,
 * y pide que devuelva JSON de Script[] válido según src/lib/engine/scripts.ts.
 */
export async function prexzyChat(options: PrexzyChatOptions): Promise<PrexzyChatResult> {
  const prompt = options.prompt?.trim();
  if (!prompt) throw new Error("El prompt es obligatorio para Prexzy AI Writer.");
  const model = (options.model?.trim() || DEFAULT_MODEL) as PrexzyModel;
  const url = prexzyUrl(prompt, model);
  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: options.signal,
  });
  const payload = (await res.json().catch(() => ({}))) as {
    status?: boolean;
    statusCode?: number;
    result?: { text?: string[]; model?: string } | string;
    error?: string;
  };
  if (!res.ok || payload.status === false) {
    throw new Error(payload.error || `Prexzy AI Writer no respondió (${res.status}).`);
  }
  const rawText = payload.result;
  const text = Array.isArray((rawText as { text?: string[] })?.text)
    ? (rawText as { text: string[] }).text.join("\n")
    : typeof rawText === "string"
      ? rawText
      : Array.isArray(payload.result)
        ? (payload.result as string[]).join("\n")
        : "";
  if (!text.trim()) throw new Error("Prexzy devolvió una respuesta vacía.");
  return {
    text: text.trim(),
    model: (rawText as { model?: string })?.model || model,
    raw: payload,
  };
}

/** Prompt helper: pide a la IA que genere scripts válidos del motor. */
export function buildPrexzyScriptPrompt(args: {
  userRequest: string;
  engineKnowledge: string;
  targetEntityKind?: string;
  projectSummary?: string;
}): string {
  const { userRequest, engineKnowledge, targetEntityKind, projectSummary } = args;
  return [
    "Eres un programador del motor de Asternal. Solo puedes usar los tipos y bloques reales del motor que se listan abajo. No inventes APIs.",
    targetEntityKind ? `Entidad objetivo: ${targetEntityKind}.` : "",
    projectSummary ? `Resumen del proyecto:\n${projectSummary}` : "",
    "Conocimiento del motor (tipos, eventos, bloques, mapeo de capas 1-10):",
    engineKnowledge,
    "Petición del usuario:",
    userRequest,
    "Devuelve SOLO un JSON válido con un array de Script[] (ver tipo Script en el conocimiento). Sin markdown, sin explicación.",
  ]
    .filter(Boolean)
    .join("\n\n");
}
