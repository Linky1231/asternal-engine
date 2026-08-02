/**
 * Auto-instalación del esquema Supabase.
 * Con la URL + anon key la app funciona; este módulo permite crear el esquema
 * (tablas, RLS, funciones, bucket, triggers) automáticamente desde el navegador
 * usando la Management API de Supabase con un token de acceso personal (sbp_...).
 *
 * Las credenciales se leen de forma dinámica (override en localStorage o
 * variables de entorno inyectadas al compilar), por lo que el usuario puede
 * pegarlas directamente en el diálogo si el entorno no las inyecta.
 */
import { supabase, getSupabaseUrl, getSupabaseAnonKey } from "@/integrations/supabase/client";
// Importa el script SQL completo como texto crudo (Vite ?raw)
import schemaSql from "../../../supabase-setup.sql?raw";

export const SUPABASE_ACCESS_TOKEN = import.meta.env.VITE_SUPABASE_ACCESS_TOKEN as string | undefined;

export { getSupabaseUrl, getSupabaseAnonKey };

/** El script SQL completo del esquema (para copiar en el SQL Editor). */
export function getSchemaSql(): string {
  return schemaSql;
}

/**
 * Divide el script en bloques pequeños (~secciones naturales del archivo).
 * El script es idempotente, por lo que puede ejecutarse completo o por partes.
 */
export function getSchemaSqlBlocks(): { title: string; sql: string }[] {
  const lines = schemaSql.split("\n");
  // Líneas (1-based) donde empieza cada gran sección: PROFILES, POLLS, FOLLOWS,
  // RLS POLICIES, FUNCIONES RPC, TRIGGER. Si el archivo cambia, el fallback
  // devuelve un único bloque con todo el SQL.
  const cutLines = [46, 208, 295, 381, 496, 666].filter(c => c > 0 && c < lines.length);
  if (!cutLines.length) return [{ title: "Bloque 1 · Todo el esquema", sql: schemaSql }];

  const ranges: [number, number][] = [];
  let start = 0;
  for (const c of cutLines) {
    ranges.push([start, c - 1]);
    start = c - 1;
  }
  ranges.push([start, lines.length]);

  return ranges.map(([s, e], i) => {
    const part = lines.slice(s, e);
    const names = part
      .filter(l => /^--\s*─/.test(l))
      .map(l => (l.match(/──\s*(.+?)\s*──/) ?? [null, ""])[1])
      .filter(Boolean)
      .slice(0, 3);
    return {
      title: `Bloque ${i + 1}${names.length ? " · " + names.join(", ") : ""}`,
      sql: part.join("\n"),
    };
  });
}

/** Enlace directo al SQL Editor del proyecto (para pegar el script). */
export function sqlEditorUrl(url: string): string | null {
  const ref = projectRefFromUrl(url);
  return ref ? `https://supabase.com/dashboard/project/${ref}/sql/new` : null;
}

/** ¿Está configurado el modo real (URL + anon key)? */
export function hasSupabaseConfig(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey());
}

/** Extrae el project ref de una URL tipo https://xxxx.supabase.co */
export function projectRefFromUrl(url: string): string | null {
  const m = url.match(/^https?:\/\/([^.]+)\.supabase\.co/);
  return m ? m[1] : null;
}

/**
 * Comprueba si el esquema existe. Verifica dos tablas clave: `posts` (creada al
 * inicio del script) y `forum_categories` (casi al final), para detectar tanto
 * esquemas inexistentes como instalaciones parciales.
 */
export async function checkSchemaReady(): Promise<boolean> {
  if (!hasSupabaseConfig()) return false;
  try {
    const { error } = await supabase.from("posts").select("id").limit(1);
    if (error) return false;
    const { error: err2 } = await supabase.from("forum_categories").select("id").limit(1);
    return !err2;
  } catch {
    return false;
  }
}

export type SetupResult = { ok: boolean; message: string };

/**
 * Ejecuta todo el script SQL (esquema completo) vía Management API.
 * @param accessToken Token de acceso personal de Supabase (sbp_...).
 */
export async function runSchemaSetup(accessToken: string): Promise<SetupResult> {
  const url = getSupabaseUrl();
  if (!url) return { ok: false, message: "Falta la URL de Supabase. Pégala en el paso anterior o añádela en Keys (VITE_SUPABASE_URL)." };
  const ref = projectRefFromUrl(url);
  if (!ref) return { ok: false, message: "No se pudo extraer el project ref de la URL." };
  const token = accessToken.trim();
  if (!token.startsWith("sbp_")) {
    return { ok: false, message: "El token debe empezar por sbp_ (token de acceso personal)." };
  }
  try {
    const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query: schemaSql, read_only: false, parameters: [] }),
    });
    const text = await res.text();
    if (!res.ok) {
      let msg = text;
      try { msg = (JSON.parse(text) as { message?: string })?.message ?? text; } catch { /* noop */ }
      return { ok: false, message: msg.slice(0, 500) };
    }
    return { ok: true, message: "Esquema creado correctamente. Ya puedes usar la plataforma." };
  } catch (e) {
    const err = e as Error;
    // CORS / red: la Management API solo acepta llamadas desde supabase.com.
    if (/Failed to fetch|NetworkError|Load failed|CORS/i.test(err?.message ?? "")) {
      return {
        ok: false,
        message: "El navegador no puede llamar a la Management API de Supabase (bloqueo CORS). Usa la opción 'Copiar SQL' y pégalo en el SQL Editor de tu proyecto.",
      };
    }
    return { ok: false, message: err?.message ?? "Error desconocido" };
  }
}
