/**
 * Auto-instalación del esquema Supabase.
 * Con la URL + anon key la app funciona; este módulo permite crear el esquema
 * (tablas, RLS, funciones, bucket, triggers) automáticamente desde el navegador
 * usando la Management API de Supabase con un token de acceso personal (sbp_...).
 */
import { supabase } from "@/integrations/supabase/client";
// Importa el script SQL completo como texto crudo (Vite ?raw)
import schemaSql from "../../../supabase-setup.sql?raw";

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const SUPABASE_ACCESS_TOKEN = import.meta.env.VITE_SUPABASE_ACCESS_TOKEN as string | undefined;

/** ¿Está configurado el modo real (URL + anon key)? */
export const isRealConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

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
  if (!isRealConfigured) return false;
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
  if (!SUPABASE_URL) return { ok: false, message: "Falta VITE_SUPABASE_URL en las claves." };
  const ref = projectRefFromUrl(SUPABASE_URL);
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
    return { ok: false, message: (e as Error).message };
  }
}
