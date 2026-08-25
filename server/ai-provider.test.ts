import { describe, expect, it } from "vitest";
import { chatCompletionEndpoint, resolveAIProvider } from "./ai-provider";

describe("configuración portable de Orión", () => {
  it("prioriza un proveedor externo compatible con OpenAI cuando está completamente configurado", () => {
    const provider = resolveAIProvider({
      ORION_AI_BASE_URL: "https://provider.example/v1/",
      ORION_AI_API_KEY: "clave-secreta",
      ORION_AI_MODEL: "modelo-portable",
    });

    expect(provider).toEqual({
      mode: "external",
      baseUrl: "https://provider.example/v1",
      apiKey: "clave-secreta",
      model: "modelo-portable",
    });
    expect(chatCompletionEndpoint(provider.baseUrl)).toBe("https://provider.example/v1/chat/completions");
  });

  it("rechaza una configuración externa incompleta en vez de volver a una dependencia oculta", () => {
    expect(() => resolveAIProvider({ ORION_AI_API_KEY: "clave-incompleta" })).toThrow("ORION_AI_BASE_URL");
  });

  it("mantiene el modo integrado solo cuando no hay variables externas", () => {
    const provider = resolveAIProvider({
      BUILT_IN_FORGE_API_URL: "https://forge.example/",
      BUILT_IN_FORGE_API_KEY: "clave-integrada",
    });

    expect(provider.mode).toBe("manus");
    expect(provider.baseUrl).toBe("https://forge.example");
    expect(provider.model).toBe("gpt-5-mini");
  });
});
