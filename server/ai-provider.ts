export type AIProviderMode = "external" | "manus";

export type AIProviderSettings = {
  mode: AIProviderMode;
  baseUrl: string;
  apiKey: string;
  model: string;
};

type Environment = Record<string, string | undefined>;

function value(env: Environment, key: string) {
  return env[key]?.trim() || undefined;
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

/**
 * Resuelve Orión contra un endpoint compatible con OpenAI cuando se definen
 * las tres variables ORION_AI_*. Mantiene el modo integrado solo para que la
 * instalación actual siga operando durante una migración gradual.
 */
export function resolveAIProvider(env: Environment = process.env): AIProviderSettings {
  const externalBaseUrl = value(env, "ORION_AI_BASE_URL");
  const externalApiKey = value(env, "ORION_AI_API_KEY");
  const externalModel = value(env, "ORION_AI_MODEL");
  const hasExternalConfiguration = Boolean(externalBaseUrl || externalApiKey || externalModel);

  if (hasExternalConfiguration) {
    if (!externalBaseUrl || !externalApiKey || !externalModel) {
      throw new Error("Configura ORION_AI_BASE_URL, ORION_AI_API_KEY y ORION_AI_MODEL para ejecutar Orión fuera de Manus.");
    }
    return {
      mode: "external",
      baseUrl: normalizeBaseUrl(externalBaseUrl),
      apiKey: externalApiKey,
      model: externalModel,
    };
  }

  const forgeUrl = value(env, "BUILT_IN_FORGE_API_URL");
  const forgeKey = value(env, "BUILT_IN_FORGE_API_KEY");
  if (!forgeUrl || !forgeKey) {
    throw new Error("Orión no está configurado. Define ORION_AI_BASE_URL, ORION_AI_API_KEY y ORION_AI_MODEL en el servidor.");
  }

  return {
    mode: "manus",
    baseUrl: normalizeBaseUrl(forgeUrl),
    apiKey: forgeKey,
    model: "gpt-5-mini",
  };
}

export function chatCompletionEndpoint(baseUrl: string) {
  const normalized = normalizeBaseUrl(baseUrl);
  return normalized.endsWith("/chat/completions") ? normalized : `${normalized}/chat/completions`;
}
