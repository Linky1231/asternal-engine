import { chatCompletionEndpoint, resolveAIProvider } from "../ai-provider";

export type LLMTextContent = { type: "text"; text: string };
export type LLMImageContent = { type: "image_url"; image_url: { url: string; detail?: "auto" | "low" | "high" } };

export type LLMMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | Array<LLMTextContent | LLMImageContent>;
};

export type LLMRequest = {
  model?: string;
  messages: LLMMessage[];
  temperature?: number;
};

/**
 * Invoca Orión desde el servidor. Si se definen ORION_AI_*, usa un endpoint
 * compatible con OpenAI; en la instalación actual conserva la integración de
 * Manus hasta completar la migración.
 */
export async function invokeLLM(request: LLMRequest) {
  const provider = resolveAIProvider();
  const endpoint = provider.mode === "manus"
    ? `${provider.baseUrl}/v1/chat/completions`
    : chatCompletionEndpoint(provider.baseUrl);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${provider.apiKey}` },
    body: JSON.stringify({ ...request, model: provider.mode === "external" ? provider.model : request.model ?? provider.model }),
  });
  if (!response.ok) {
    const source = provider.mode === "external" ? "El proveedor de IA configurado" : "La IA integrada de Manus";
    throw new Error(`${source} no respondió (${response.status}).`);
  }
  return response.json() as Promise<{ choices?: Array<{ message?: { content?: string } }>; model?: string }>;
}

/** Lista el modelo configurado de Orión sin exponer credenciales al cliente. */
export async function listLLMModels() {
  const provider = resolveAIProvider();
  if (provider.mode === "external") return { data: [{ id: provider.model }] };

  const response = await fetch(`${provider.baseUrl}/v1/models`, { headers: { Authorization: `Bearer ${provider.apiKey}` } });
  if (!response.ok) throw new Error("No se pudo consultar el catálogo de modelos de Manus.");
  return response.json() as Promise<{ data: Array<{ id: string }> }>;
}
