// Gemini BYOK — Google AI Studio (generativelanguage.googleapis.com)
// La clave NUNCA sale de este navegador: solo se envía directa a Google.
// Se guarda ofuscada en localStorage (aislada por origen) y nunca se
// sube a nuestros servidores.

export const GEMINI_MODELS = [
  { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash (recomendado)" },
  { id: "gemini-2.0-flash-lite", label: "Gemini 2.0 Flash-Lite" },
  { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
  { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
  { id: "gemini-1.5-flash-8b", label: "Gemini 1.5 Flash-8B" },
] as const;

export type GeminiModelId = (typeof GEMINI_MODELS)[number]["id"] | string;

const LS_KEY = "asternal_gemini_config_v1";

// ——— ofuscación reversible (no es cifrado criptográfico, es anti-shoulder-surf;
// el aislamiento real lo da el origen del navegador — solo tu dominio ve el LS)
function obfuscate(s: string): string {
  try {
    const salt = "asternal-gemini-v1:";
    return btoa(salt + s).split("").reverse().join("");
  } catch { return btoa(s); }
}
function deobfuscate(s: string): string {
  try {
    const rev = s.split("").reverse().join("");
    const decoded = atob(rev);
    const prefix = "asternal-gemini-v1:";
    return decoded.startsWith(prefix) ? decoded.slice(prefix.length) : decoded;
  } catch { try { return atob(s); } catch { return ""; } }
}

export interface GeminiConfig {
  apiKey: string;
  model: string;
}

export function loadGeminiConfig(): GeminiConfig | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { k?: string; m?: string };
    if (!parsed.k) return null;
    const apiKey = deobfuscate(parsed.k).trim();
    if (!apiKey) return null;
    return { apiKey, model: (parsed.m || GEMINI_MODELS[0].id).trim() };
  } catch { return null; }
}

export function saveGeminiConfig(cfg: GeminiConfig): void {
  const apiKey = cfg.apiKey.trim();
  if (!apiKey) throw new Error("Pega tu clave de Gemini.");
  if (apiKey.length < 20) throw new Error("La clave parece demasiado corta.");
  const model = (cfg.model || GEMINI_MODELS[0].id).trim();
  localStorage.setItem(LS_KEY, JSON.stringify({ k: obfuscate(apiKey), m: model }));
}

export function clearGeminiConfig(): void {
  try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
}

export function hasGeminiConfig(): boolean {
  return loadGeminiConfig() !== null;
}

export function getGeminiModel(): string {
  return loadGeminiConfig()?.model ?? GEMINI_MODELS[0].id;
}

// ——— llamada directa a Google (clave solo viaja a generativelanguage.googleapis.com)

export type GeminiRole = "user" | "model";
export interface GeminiChatMessage { role: GeminiRole; text: string }

function toGeminiContents(history: { role: string; content: string }[], systemPrompt?: string) {
  const contents: { role: GeminiRole; parts: { text: string }[] }[] = [];
  if (systemPrompt) {
    contents.push({ role: "user", parts: [{ text: systemPrompt }] });
    contents.push({ role: "model", parts: [{ text: "Entendido. Responderé como Orión, en español, ayudando con el motor de Asternal." }] });
  }
  for (const m of history) {
    if (m.role === "system") continue;
    const role: GeminiRole = m.role === "assistant" ? "model" : "user";
    const text = m.content?.trim();
    if (!text) continue;
    contents.push({ role, parts: [{ text }] });
  }
  return contents;
}

export async function geminiChat(
  history: { role: string; content: string }[],
  opts: { systemPrompt?: string; temperature?: number; maxTokens?: number; signal?: AbortSignal } = {}
): Promise<{ text: string; model: string }> {
  const cfg = loadGeminiConfig();
  if (!cfg) throw new Error("Configura tu clave de Gemini en Ajustes de IA para usar Orión.");
  const model = cfg.model || GEMINI_MODELS[0].id;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`;
  const body = {
    contents: toGeminiContents(history, opts.systemPrompt),
    generationConfig: {
      temperature: typeof opts.temperature === "number" ? opts.temperature : 0.7,
      maxOutputTokens: typeof opts.maxTokens === "number" ? opts.maxTokens : 2048,
    },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: opts.signal,
  });
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data as { error?: { message?: string } })?.error?.message || `Gemini no respondió (${res.status}). Verifica tu clave y modelo.`;
    throw new Error(msg);
  }
  const candidates = (data as { candidates?: { content?: { parts?: { text?: string }[] } }[] })?.candidates;
  const text = candidates?.[0]?.content?.parts?.map(p => p.text ?? "").join("")?.trim() ?? "";
  if (!text) throw new Error("Gemini devolvió una respuesta vacía.");
  return { text, model };
}

export async function geminiChatStream(
  history: { role: string; content: string }[],
  onDelta: (delta: string) => void,
  opts: { systemPrompt?: string; temperature?: number; maxTokens?: number; signal?: AbortSignal } = {}
): Promise<{ text: string; model: string }> {
  const r = await geminiChat(history, opts);
  onDelta(r.text);
  return r;
}

// Valida la clave probando listar modelos (no gasta tokens de generación)
export async function testGeminiKey(apiKey: string): Promise<string[]> {
  const key = apiKey.trim();
  if (!key) throw new Error("Pega tu clave primero.");
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`;
  const res = await fetch(url);
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data as { error?: { message?: string } })?.error?.message || `Clave rechazada (${res.status}).`;
    throw new Error(msg);
  }
  const models = (data as { models?: { name?: string }[] })?.models ?? [];
  return models.map(m => m.name ?? "").filter(Boolean);
}

export function buildGeminiScriptPrompt(args: {
  userRequest: string;
  engineKnowledge: string;
  targetEntityKind?: string;
  projectSummary?: string;
}): string {
  const { userRequest, engineKnowledge, targetEntityKind, projectSummary } = args;
  return [
    "Eres un programador del motor de Asternal. Solo puedes usar los tipos y bloques reales del motor listados abajo. No inventes APIs.",
    targetEntityKind ? `Entidad objetivo: ${targetEntityKind}.` : "",
    projectSummary ? `Resumen del proyecto:\n${projectSummary}` : "",
    "Conocimiento del motor:",
    engineKnowledge,
    "Petición del usuario:",
    userRequest,
    "Devuelve SOLO un JSON válido con un array de Script[] (tipo Script del conocimiento). Sin markdown, sin explicación.",
  ].filter(Boolean).join("\n\n");
}
