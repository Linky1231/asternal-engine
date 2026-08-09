/**
 * Orión — asistente de IA para desarrolladores de juegos de Asternal.
 *
 * Se conecta a Yielding Bear (gateway OpenAI-compatible) con enrutado
 * inteligente Grizzly para minimizar costes. La clave se lee de la variable
 * del proyecto en orden: YIELDINGBEAR_API_KEY → VITE_YIELDINGBEAR_API_KEY,
 * con respaldo a la clave por defecto del proyecto.
 */
import { ENGINE_KNOWLEDGE } from "./engine-knowledge";

export const ORION_BASE_URL = "https://yieldingbear.com/api/v1";
export const ORION_PROXY_URL =
  "https://gxpgczwkovertezeydkt.supabase.co/functions/v1/orion-proxy";
export const ORION_MODEL = "yieldingbear/grizzly-1.0g";
export const ORION_MODEL_CODING = "yieldingbear/grizzly-1.0g-coding";

/** Clave por defecto del proyecto (la del tab Keys si existe la variable). */
const DEFAULT_KEY =
  "yb_live_sk_bdf8187db17e80a81fe265fc5691b7a22d1f8530a93a2e3aefff166e5e670ba4";

export function getOrionApiKey(): string {
  if (typeof window !== "undefined") {
    const ls = window.localStorage.getItem("orion_api_key");
    if (ls) return ls;
  }
  if (typeof import.meta !== "undefined") {
    const v = (import.meta as unknown as Record<string, unknown>).env as Record<string, unknown> | undefined;
    const direct = v?.YIELDINGBEAR_API_KEY;
    const vite = v?.VITE_YIELDINGBEAR_API_KEY;
    if (typeof direct === "string" && direct) return direct;
    if (typeof vite === "string" && vite) return vite;
  }
  return DEFAULT_KEY;
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

/**
 * Envía una petición de chat a Yielding Bear (OpenAI-compatible).
 * Devuelve el texto de la respuesta. Lanza OrionError con mensaje legible.
 */
export async function orionChat(
  history: OrionMessage[],
  opts: { coding?: boolean; maxTokens?: number; temperature?: number } = {}
): Promise<OrionResult> {
  const key = getOrionApiKey();
  if (!key) {
    throw new Error("Falta la clave de la API de Orión (Yielding Bear).");
  }
  const messages = buildOrionMessages(history);

  const payload = {
    model: opts.coding ? ORION_MODEL_CODING : ORION_MODEL,
    messages,
    max_tokens: opts.maxTokens ?? 1200,
    temperature: opts.temperature ?? 0.7,
  };

  let res: Response;
  try {
    // Vía Edge Function de Supabase (CORS habilitado desde el navegador).
    res = await fetch(ORION_PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok && res.status !== 401 && res.status !== 403 && res.status !== 429) {
      // Si el proxy falla por una razón distinta a la clave, reintenta directo.
      const direct = await fetch(`${ORION_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify(payload),
      });
      res = direct;
    }
  } catch {
    try {
      res = await fetch(`${ORION_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify(payload),
      });
    } catch {
      throw new Error(
        "No se pudo conectar con Orión. Comprueba tu conexión a internet e inténtalo de nuevo."
      );
    }
  }

  if (!res.ok) {
    let detail = "";
    try {
      const j = (await res.json()) as { error?: { message?: string } | string; message?: string };
      detail = typeof j.error === "string" ? j.error : j.error?.message ?? j.message ?? "";
    } catch {
      /* noop */
    }
    const code = res.status;
    if (code === 401 || code === 403) {
      throw new Error("La clave de la API de Orión no es válida o no tiene permisos.");
    }
    if (code === 429) {
      throw new Error("Límite de peticiones alcanzado. Espera unos segundos y reintenta.");
    }
    throw new Error(`Orión respondió con un error (${code}).${detail ? ` ${detail}` : ""}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    model?: string;
    usage?: { total_tokens?: number };
    cost_usd?: number;
    balance_remaining_usd?: number;
  };
  const content = data.choices?.[0]?.message?.content ?? "";
  if (!content) throw new Error("Orión no devolvió ninguna respuesta.");
  return {
    content,
    model: data.model ?? ORION_MODEL,
    costUsd: data.cost_usd ?? 0,
    balanceUsd: data.balance_remaining_usd ?? 0,
  };
}
