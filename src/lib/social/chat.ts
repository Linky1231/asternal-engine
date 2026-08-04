// @ts-nocheck — Chat adapter (same Supabase client + helpers as api.ts)
import { supabase, hasSupabaseConfig } from "@/integrations/supabase/client";
import { signMediaUrls, uploadMedia } from "@/lib/social/api";

export type ChatMessage = {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string | null;
  media_url: string | null;
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

  let { data: chat } = await supabase
    .from("chats")
    .select("*")
    .eq("is_community", true)
    .limit(1)
    .maybeSingle();

  if (!chat) {
    // Nota: los builders de supabase-js implementan .then() pero no .catch(),
    // así que el manejo de errores debe hacerse con try/catch + await.
    let created: any = null;
    try {
      const res = await supabase
        .from("chats")
        .insert({
          id: COMMUNITY_CHAT_ID,
          type: "group",
          name: COMMUNITY_CHAT_NAME,
          created_by: me,
          is_community: true,
        })
        .select()
        .single();
      created = res.data;
    } catch {
      /* carrera: otro usuario lo creó justo en este instante */
    }
    if (created) {
      chat = created;
    } else {
      // Carrera: otro usuario lo creó justo en este instante → lo buscamos por ID fijo.
      const { data: existing } = await supabase.from("chats").select("*").eq("id", COMMUNITY_CHAT_ID).maybeSingle();
      chat = existing ?? null;
    }
  }
  if (!chat) throw new Error("No se pudo preparar el chat de la comunidad");

  // Auto-join (la política de chat_members permite a cada usuario añadirse a sí mismo).
  const { data: member } = await supabase
    .from("chat_members")
    .select("id")
    .eq("chat_id", chat.id)
    .eq("user_id", me)
    .maybeSingle();
  if (!member) {
    await supabase.from("chat_members").insert({ chat_id: chat.id, user_id: me, role: "member" });
  }

  const { data: members } = await supabase.from("chat_members").select("id").eq("chat_id", chat.id);
  return { id: chat.id, name: chat.name || COMMUNITY_CHAT_NAME, memberCount: (members ?? []).length };
}

export async function fetchChatMessages(chatId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as ChatMessage[];
}

export async function sendChatMessage(
  chatId: string,
  opts: { content?: string; mediaUrl?: string; replyToId?: string | null }
): Promise<ChatMessage> {
  const me = await requireMe();
  const { data, error } = await supabase
    .from("chat_messages")
    .insert({
      chat_id: chatId,
      sender_id: me,
      content: opts.content ?? null,
      media_url: opts.mediaUrl ?? null,
      reply_to_id: opts.replyToId ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  await supabase.from("chats").update({ updated_at: new Date().toISOString() }).eq("id", chatId);
  return data as ChatMessage;
}

export function subscribeToChat(chatId: string, onMessage: (msg: ChatMessage) => void): () => void {
  if (typeof supabase.channel !== "function") return () => {};
  const channel = supabase
    .channel(`chat-${chatId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "chat_messages", filter: `chat_id=eq.${chatId}` },
      (payload: any) => {
        onMessage(payload.new as ChatMessage);
      }
    )
    .subscribe();
  return () => {
    try {
      supabase.removeChannel(channel);
    } catch {
      /* noop */
    }
  };
}

export async function uploadSticker(file: File): Promise<string> {
  const me = await requireMe();
  return uploadMedia(file, me.id);
}

export async function fetchMyStickers(): Promise<{ path: string; title: string }[]> {
  const me = await getMeId();
  if (!me) return [];
  const { data, error } = await supabase
    .from("posts")
    .select("id, media_urls, content, price_orbes")
    .eq("author_id", me.id)
    .eq("category", "artwork")
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw error;
  const out: { path: string; title: string }[] = [];
  for (const p of data ?? []) {
    const path = Array.isArray(p.media_urls) ? p.media_urls[0] : null;
    if (path) out.push({ path, title: (p.content || "").replace(/^🎨\s*/, "").trim() || "Arte" });
  }
  return out;
}

export async function signMedia(paths: string[]): Promise<string[]> {
  return signMediaUrls(paths);
}
