// @ts-nocheck — Chat adapter (same Supabase client + helpers as api.ts)
import { supabase, hasSupabaseConfig, isSchemaMissing } from "@/integrations/supabase/client";
import { signMediaUrls, uploadMedia } from "@/lib/social/api";

export type ChatMessage = {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  reply_to_id: string | null;
  created_at: string;
};

// Chat único de la comunidad: un ID fijo evita duplicados en carreras de creación.
export const COMMUNITY_CHAT_ID = "c0000000-0000-4000-8000-000000000000";
export const COMMUNITY_CHAT_NAME = "Asternal · Comunidad";

export const CHAT_ERR = {
  AUTH_REQUIRED: "AUTH_REQUIRED",
  REAL_AUTH_REQUIRED: "REAL_AUTH_REQUIRED",
} as const;

function chatError(code: string, message: string): Error {
  return Object.assign(new Error(message), { code });
}

/**
 * Identidad actual del usuario. Distingue si viene de una sesión real de
 * Supabase o de la cuenta local del navegador (creada antes de conectar).
 */
async function getMeId(): Promise<{ id: string; isLocal: boolean } | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.id) return { id: user.id, isLocal: false };
  } catch {
    /* noop */
  }
  // Puente: si la app ya usa Supabase real pero la sesión activa es la local
  // (cuenta creada antes de conectar), mantenemos la misma identidad.
  try {
    const raw = localStorage.getItem("_local_auth_session");
    if (raw) {
      const s = JSON.parse(raw) as { userId?: string; expiresAt?: string };
      if (s.userId && s.expiresAt && new Date(s.expiresAt) > new Date()) return { id: s.userId, isLocal: true };
    }
  } catch {
    /* noop */
  }
  return null;
}

/**
 * Igual que getMeId pero lanza errores con código para que la UI muestre la
 * acción correcta: iniciar sesión (sin sesión) o entrar con la cuenta real
 * cuando la base está conectada pero la sesión activa sigue siendo local
 * (los permisos RLS de Supabase exigen un usuario real de auth).
 */
async function requireMe(): Promise<{ id: string; isLocal: boolean }> {
  const me = await getMeId();
  if (!me) throw chatError(CHAT_ERR.AUTH_REQUIRED, "Inicia sesión para usar el chat");
  if (me.isLocal && hasSupabaseConfig()) {
    throw chatError(
      CHAT_ERR.REAL_AUTH_REQUIRED,
      "Tu base de datos está conectada, pero esta cuenta es local. Entra con tu cuenta para usar el chat comunitario."
    );
  }
  return me;
}

/**
 * Devuelve el chat compartido de la comunidad. Si no existe (primer usuario),
 * lo crea con el ID fijo; en cualquier caso añade al usuario actual como miembro
 * (auto-join) y devuelve el número de miembros.
 */
export async function getCommunityChat(): Promise<{ id: string; name: string; memberCount: number }> {
  const me = await requireMe();
  const meId = me.id;

  // Si las tablas no existen (esquema sin instalar) o la anon key es inválida,
  // el error real se propaga para que la UI muestre la acción correcta
  // («Instalar chat» o revisar las claves) en lugar de un mensaje genérico.
  const { data: chat, error: findErr } = await supabase
    .from("chats")
    .select("*")
    .eq("is_community", true)
    .limit(1)
    .maybeSingle();
  if (findErr) throw findErr;

  let chatRow = chat;
  if (!chatRow) {
    // Nota: los builders de supabase-js implementan .then() pero no .catch(),
    // así que el manejo de errores debe hacerse con try/catch + await.
    try {
      const res = await supabase
        .from("chats")
        .insert({
          id: COMMUNITY_CHAT_ID,
          type: "group",
          name: COMMUNITY_CHAT_NAME,
          created_by: meId,
          is_community: true,
        })
        .select()
        .single();
      if (res.error) throw res.error;
      chatRow = res.data;
    } catch (err) {
      // Esquema ausente, clave inválida o RLS → propagar para mostrar la acción
      // correcta. Solo se trata como carrera de creación cuando es un duplicado.
      const msg = (err as Error)?.message ?? "";
      if (!/duplicate key|already exists/i.test(msg)) throw err;
    }
    if (!chatRow) {
      // Carrera: otro usuario lo creó justo en este instante → lo buscamos por ID fijo.
      const { data: existing, error: existingErr } = await supabase
        .from("chats")
        .select("*")
        .eq("id", COMMUNITY_CHAT_ID)
        .maybeSingle();
      if (existingErr) throw existingErr;
      chatRow = existing ?? null;
    }
  }
  if (!chatRow) throw new Error("No se pudo preparar el chat de la comunidad");

  // Auto-join (la política de chat_members permite a cada usuario añadirse a sí mismo).
  const { data: member, error: memberErr } = await supabase
    .from("chat_members")
    .select("id")
    .eq("chat_id", chatRow.id)
    .eq("user_id", meId)
    .maybeSingle();
  if (memberErr && !isSchemaMissing(memberErr)) throw memberErr;
  if (!member) {
    const { error: joinErr } = await supabase
      .from("chat_members")
      .insert({ chat_id: chatRow.id, user_id: meId, role: "member" });
    if (joinErr && !isSchemaMissing(joinErr) && !/permission denied|row-level security/i.test(joinErr.message)) throw joinErr;
  }

  const { data: members } = await supabase.from("chat_members").select("id").eq("chat_id", chatRow.id);
  return { id: chatRow.id, name: chatRow.name || COMMUNITY_CHAT_NAME, memberCount: (members ?? []).length };
}

/** Cursor de paginación: el mensaje más antiguo de la página actual. */
export type MessageCursor = { created_at: string; id: string };

/**
 * Paginación por cursor: devuelve la página de mensajes MÁS RECIENTES (o los
 * anteriores a `before`) ordenados de antiguo a nuevo, listos para renderizar.
 * `hasMore` indica si existen mensajes más antiguos que cargar.
 */
export async function fetchChatMessages(
  chatId: string,
  opts: { before?: MessageCursor; limit?: number } = {}
): Promise<{ messages: ChatMessage[]; hasMore: boolean }> {
  const limit = opts.limit ?? 60;
  let q = supabase
    .from("chat_messages")
    .select("*")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1); // +1 para detectar si hay más páginas
  if (opts.before) q = q.lt("created_at", opts.before.created_at);
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as ChatMessage[];
  const hasMore = rows.length > limit;
  return { messages: rows.slice(0, limit).reverse(), hasMore };
}

export async function sendChatMessage(
  chatId: string,
  opts: { content?: string; mediaUrl?: string; mediaType?: "image" | "audio"; replyToId?: string | null }
): Promise<ChatMessage> {
  const me = await requireMe();
  const { data, error } = await supabase
    .from("chat_messages")
    .insert({
      chat_id: chatId,
      sender_id: me.id,
      content: opts.content ?? null,
      media_url: opts.mediaUrl ?? null,
      media_type: opts.mediaType ?? (opts.mediaUrl ? "image" : null),
      reply_to_id: opts.replyToId ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  await supabase.from("chats").update({ updated_at: new Date().toISOString() }).eq("id", chatId);
  return data as ChatMessage;
}

export function isAudioMessage(m: Pick<ChatMessage, "media_type" | "media_url">): boolean {
  return !!m.media_url && (m.media_type === "audio" || /^audio\//.test(m.media_url ?? ""));
}

export type ChatEvent =
  | { type: "INSERT"; message: ChatMessage }
  | { type: "UPDATE"; message: ChatMessage }
  | { type: "DELETE"; message: ChatMessage };

/**
 * Realtime del chat: INSERT (mensajes nuevos), UPDATE (ediciones) y DELETE
 * (eliminaciones) llegan al instante y la UI los aplica sin recargar.
 */
export function subscribeToChat(chatId: string, onEvent: (ev: ChatEvent) => void): () => void {
  if (typeof supabase.channel !== "function") return () => {};
  const filter = `chat_id=eq.${chatId}`;
  const listeners: Array<{ event: "INSERT" | "UPDATE" | "DELETE"; cb: (p: any) => void }> = [
    { event: "INSERT", cb: (p) => onEvent({ type: "INSERT", message: p.new as ChatMessage }) },
    { event: "UPDATE", cb: (p) => onEvent({ type: "UPDATE", message: p.new as ChatMessage }) },
    { event: "DELETE", cb: (p) => onEvent({ type: "DELETE", message: p.old as ChatMessage }) },
  ];
  try {
    const base: any = supabase.channel(`chat-${chatId}`);
    if (!base || typeof base.on !== "function") return () => {};

    const first: any = base.on(
      "postgres_changes",
      { schema: "public", table: "chat_messages", filter, event: "INSERT" },
      listeners[0].cb
    );
    // Adaptador local: .on() devuelve { subscribe, unsubscribe } sin .on().
    if (!first || typeof first.on !== "function") {
      if (typeof first?.subscribe === "function") first.subscribe();
      const single = first;
      return () => {
        try {
          supabase.removeChannel(single);
        } catch {
          /* noop */
        }
      };
    }
    // supabase-js real: encadenamos los 3 eventos y suscribimos.
    const chained: any = first
      .on("postgres_changes", { schema: "public", table: "chat_messages", filter, event: "UPDATE" }, listeners[1].cb)
      .on("postgres_changes", { schema: "public", table: "chat_messages", filter, event: "DELETE" }, listeners[2].cb);
    chained.subscribe();
    return () => {
      try {
        supabase.removeChannel(chained);
      } catch {
        /* noop */
      }
    };
  } catch {
    return () => {};
  }
}

export type ChatSticker = { id: string; path: string; title: string };

/**
 * Sube un sticker y lo guarda en la biblioteca de stickers de la cuenta.
 * Devuelve la ruta del archivo y el id de la fila creada en la tabla stickers.
 */
export async function uploadSticker(file: File): Promise<{ path: string; id: string }> {
  const me = await requireMe();
  const path = await uploadMedia(file, me.id);
  const { data, error } = await supabase
    .from("stickers")
    .insert({ user_id: me.id, path })
    .select("id")
    .single();
  if (error) throw error;
  const row = data as { id?: string } | null;
  return { path, id: row?.id ?? "" };
}

/** Stickers guardados de la cuenta actual (persisten entre sesiones y dispositivos). */
export async function fetchMyStickers(): Promise<ChatSticker[]> {
  const me = await getMeId();
  if (!me) return [];
  const { data, error } = await supabase
    .from("stickers")
    .select("id, path")
    .eq("user_id", me.id)
    .order("created_at", { ascending: false })
    .limit(60);
  if (error) throw error;
  return (data ?? []).map((s) => {
    const row = s as { id: string; path: string };
    return { id: row.id, path: row.path, title: "Sticker" };
  });
}

/** Elimina un sticker de la biblioteca de la cuenta actual. */
export async function deleteSticker(id: string): Promise<void> {
  const me = await requireMe();
  const { error } = await supabase.from("stickers").delete().eq("id", id).eq("user_id", me.id);
  if (error) throw error;
}

export async function signMedia(paths: string[]): Promise<string[]> {
  return signMediaUrls(paths);
}
