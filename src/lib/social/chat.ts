// @ts-nocheck — Chat adapter (same Supabase client + helpers as api.ts)
import { supabase, hasSupabaseConfig, isSchemaMissing } from "@/integrations/supabase/client";
import { signMediaUrls, uploadMedia } from "@/lib/social/api";
import type { Profile } from "@/lib/social/api";

export type ChatMessage = {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  reply_to_id: string | null;
  kind?: string | null;
  gift_id?: string | null;
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
 * Devuelve `isLocal: true` SOLO cuando la app tiene credenciales de Supabase
 * pero la sesión activa sigue siendo la cuenta local (entonces el chat opera
 * contra el almacenamiento local en vez de bloquearse).
 */
async function getMeId(): Promise<{ id: string; isLocal: boolean } | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.id) return { id: user.id, isLocal: false };
  } catch {
    /* Credenciales rotas/inaccesibles → se comprueba la cuenta local */
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
 * Igual que getMeId pero lanza un error con código cuando no hay NINGUNA
 * identidad (ni real ni local) para que la UI muestre la acción correcta.
 * Nota: ya NO bloquea la cuenta local cuando Supabase está conectado; en ese
 * caso el chat degrada a modo local (los datos viven en el navegador) en vez
 * de dejar al usuario sin chat.
 */
async function requireMe(): Promise<{ id: string; isLocal: boolean }> {
  const me = await getMeId();
  if (!me) throw chatError(CHAT_ERR.AUTH_REQUIRED, "Inicia sesión para usar el chat");
  return me;
}

/**
 * ¿La sesión activa es la cuenta local del navegador mientras la app tiene
 * credenciales de Supabase? En ese caso el chat debe operar contra el
 * almacenamiento local (modo local) porque las políticas RLS de Supabase
 * exigen un usuario real.
 */
async function isLocalIdentity(): Promise<boolean> {
  const me = await getMeId();
  return !!me?.isLocal;
}

// ───── Adaptador local (localStorage) ─────
// Mismo formato de claves que el cliente local de integrations/supabase/client.ts
// (`_local_data_<tabla>` y `_local_storage_<bucket>_<ruta>`), para que el chat
// funcione igual cuando la cuenta activa es local aunque haya credenciales.

function localRows<T = Record<string, unknown>>(table: string): T[] {
  try {
    const raw = localStorage.getItem(`_local_data_${table}`);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function localSave(table: string, rows: unknown[]): void {
  try {
    localStorage.setItem(`_local_data_${table}`, JSON.stringify(rows));
  } catch {
    /* sin espacio (modo local): se ignora */
  }
}

function localStorePath(path: string): string | null {
  try {
    return localStorage.getItem(`_local_storage_post-media_${path}`);
  } catch {
    return null;
  }
}

async function localUploadMedia(file: File, userId: string): Promise<string> {
  const ext = file.name.split(".").pop() || "bin";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const url = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });
  try {
    localStorage.setItem(`_local_storage_post-media_${path}`, url);
  } catch {
    throw new Error("Sin espacio de almacenamiento local");
  }
  return path;
}

/**
 * Devuelve el chat compartido de la comunidad. Si no existe (primer usuario),
 * lo crea con el ID fijo; en cualquier caso añade al usuario actual como miembro
 * (auto-join) y devuelve el número de miembros.
 */
export async function getCommunityChat(): Promise<{ id: string; name: string; memberCount: number; memberOk: boolean; local: boolean }> {
  const me = await requireMe();
  const meId = me.id;

  // ── Modo local (cuenta local + Supabase conectado) ──
  if (me.isLocal) {
    const chats = localRows<Record<string, unknown>>("chats");
    let chatRow = chats.find((c) => c.is_community === true) ?? null;
    if (!chatRow) {
      chatRow = {
        id: COMMUNITY_CHAT_ID,
        type: "group",
        name: COMMUNITY_CHAT_NAME,
        created_by: meId,
        is_community: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      chats.push(chatRow);
      localSave("chats", chats);
    }
    const members = localRows<Record<string, unknown>>("chat_members");
    if (!members.some((m) => m.chat_id === chatRow.id && m.user_id === meId)) {
      members.push({ chat_id: chatRow.id, user_id: meId, role: "member", joined_at: new Date().toISOString() });
      localSave("chat_members", members);
    }
    const count = members.filter((m) => m.chat_id === chatRow.id).length;
    return { id: chatRow.id as string, name: String(chatRow.name || COMMUNITY_CHAT_NAME), memberCount: count, memberOk: true, local: true };
  }

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
  // chat_members NO tiene columna "id" (la clave es chat_id+user_id), así que
  // las consultas usan user_id. Además, si una instalación anterior dejó
  // políticas RLS rotas («infinite recursion»/permisos), el chat no debe
  // quedarse bloqueado: chat_messages sigue siendo legible/escribible, así que
  // degradamos a «miembro no registrado» (memberOk=false) y la UI muestra un
  // aviso para reparar las políticas con «Instalar chat».
  const RLS_RE = /infinite recursion|recursion detected|permission denied|row-level security|42501|PGRST301/i;
  let memberOk = true;
  const { data: member, error: memberErr } = await supabase
    .from("chat_members")
    .select("user_id")
    .eq("chat_id", chatRow.id)
    .eq("user_id", meId)
    .maybeSingle();
  if (memberErr && !isSchemaMissing(memberErr) && !RLS_RE.test(memberErr.message)) throw memberErr;
  if (memberErr) memberOk = false;
  if (!member) {
    const { error: joinErr } = await supabase
      .from("chat_members")
      .insert({ chat_id: chatRow.id, user_id: meId, role: "member" });
    if (joinErr && !isSchemaMissing(joinErr) && !RLS_RE.test(joinErr.message)) throw joinErr;
    if (joinErr) memberOk = false;
  }

  let memberCount = 0;
  const { data: members, error: countErr } = await supabase
    .from("chat_members")
    .select("user_id")
    .eq("chat_id", chatRow.id);
  if (countErr && !isSchemaMissing(countErr) && !RLS_RE.test(countErr.message)) throw countErr;
  if (countErr) memberOk = false;
  else memberCount = (members ?? []).length;

  return { id: chatRow.id, name: chatRow.name || COMMUNITY_CHAT_NAME, memberCount, memberOk, local: false };
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
  const me = await getMeId();

  // ── Modo local ──
  if (me?.isLocal) {
    let rows = localRows<ChatMessage>("chat_messages").filter((m) => m.chat_id === chatId);
    if (opts.before) {
      const b = opts.before;
      rows = rows.filter(
        (m) => m.created_at < b.created_at || (m.created_at === b.created_at && m.id < b.id)
      );
    }
    rows.sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
    const hasMore = rows.length > limit;
    return { messages: rows.slice(0, limit).reverse(), hasMore };
  }

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

  // ── Modo local ──
  if (me.isLocal) {
    const row: ChatMessage = {
      id: crypto.randomUUID(),
      chat_id: chatId,
      sender_id: me.id,
      content: opts.content ?? null,
      media_url: opts.mediaUrl ?? null,
      media_type: opts.mediaType ?? (opts.mediaUrl ? "image" : null),
      reply_to_id: opts.replyToId ?? null,
      created_at: new Date().toISOString(),
    };
    const rows = localRows<ChatMessage>("chat_messages");
    rows.push(row);
    localSave("chat_messages", rows);
    return row;
  }

  // Construimos el payload sin `media_type` salvo en audio: así los mensajes de
  // texto y los stickers funcionan aunque la base tenga la tabla con un esquema
  // antiguo (sin la columna media_type, añadida para el audio de voz). La
  // columna solo es imprescindible para el audio; si falta, el error resultante
  // se detecta en la UI para avisar de reinstalar el esquema.
  const payload: Record<string, unknown> = {
    chat_id: chatId,
    sender_id: me.id,
    content: opts.content ?? null,
    media_url: opts.mediaUrl ?? null,
    reply_to_id: opts.replyToId ?? null,
  };
  if (opts.mediaType === "audio") payload.media_type = "audio";

  const { data, error } = await supabase
    .from("chat_messages")
    .insert(payload)
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
 * En modo local no hay realtime (los datos viven en este navegador).
 */
export function subscribeToChat(chatId: string, onEvent: (ev: ChatEvent) => void): () => void {
  let cleanup: () => void = () => {};
  void getMeId().then((me) => {
    if (me?.isLocal) return; // sin realtime en modo local
    cleanup = realSubscribe(chatId, onEvent);
  });
  return () => cleanup();
}

function realSubscribe(chatId: string, onEvent: (ev: ChatEvent) => void): () => void {
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

  // ── Modo local ──
  if (me.isLocal) {
    const path = await localUploadMedia(file, me.id);
    const id = crypto.randomUUID();
    const rows = localRows<Record<string, unknown>>("stickers");
    rows.push({ id, user_id: me.id, path, created_at: new Date().toISOString() });
    localSave("stickers", rows);
    return { path, id };
  }

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

  // ── Modo local ──
  if (me.isLocal) {
    const rows = localRows<Record<string, unknown>>("stickers")
      .filter((s) => s.user_id === me.id)
      .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))
      .slice(0, 60);
    return rows.map((s) => ({ id: String(s.id), path: String(s.path), title: "Sticker" }));
  }

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

  // ── Modo local ──
  if (me.isLocal) {
    const rows = localRows<Record<string, unknown>>("stickers").filter(
      (s) => !(s.id === id && s.user_id === me.id)
    );
    localSave("stickers", rows);
    return;
  }

  const { error } = await supabase.from("stickers").delete().eq("id", id).eq("user_id", me.id);
  if (error) throw error;
}

/** Resuelve rutas de media a URLs listas para <img>/<audio>. En modo local usa los data-URLs guardados. */
export async function signMedia(paths: string[]): Promise<string[]> {
  const me = await getMeId();
  if (me?.isLocal) {
    return paths.map((p) => {
      if (/^https?:/.test(p) || /^data:/.test(p)) return p;
      return localStorePath(p) ?? "";
    });
  }
  return signMediaUrls(paths);
}

/** Sube un media (sticker/audio) respetando el modo activo del chat. */
export async function uploadChatMedia(file: File, userId: string): Promise<string> {
  const me = await getMeId();
  if (me?.isLocal) return localUploadMedia(file, me.id);
  return uploadMedia(file, userId);
}

/** Perfiles de los remitentes respetando el modo activo del chat. */
export async function fetchChatProfiles(ids: string[]): Promise<Map<string, Profile>> {
  if (!ids.length) return new Map();
  const me = await getMeId();
  if (me?.isLocal) {
    const rows = localRows<Profile>("profiles").filter((p) => ids.includes(p.id));
    return new Map(rows.map((p) => [p.id, p]));
  }
  const { data } = await supabase.from("profiles").select("*").in("id", ids);
  return new Map(((data ?? []) as Profile[]).map((p) => [p.id, p]));
}

// ───── Cola de mensajes pendientes ─────
// Si un envío falla porque el servidor no responde (red), el mensaje se guarda
// en esta cola local y se reenvía automáticamente cuando vuelve la conexión o
// al abrir el chat de nuevo. Así el usuario nunca pierde un mensaje ni ve un
// aviso de «sin internet» cuando su conexión está bien.
type PendingSend = {
  chatId: string;
  content?: string;
  mediaUrl?: string;
  mediaType?: "image" | "audio";
  replyToId?: string | null;
  queuedAt: string;
};

const PENDING_KEY = "_chat_pending_queue";

/** ¿Es un fallo de red (el servidor no respondió) en lugar de un error de la app? */
export function isNetworkError(err: unknown): boolean {
  const msg = (err as Error)?.message ?? "";
  return /failed to fetch|networkerror|load failed|network request failed|err_|abort|timeout/i.test(msg);
}

/** Guarda un mensaje en la cola local para reenviarlo cuando haya conexión. */
export function queuePendingMessage(
  chatId: string,
  opts: { content?: string; mediaUrl?: string; mediaType?: "image" | "audio"; replyToId?: string | null }
): void {
  try {
    const list: PendingSend[] = JSON.parse(localStorage.getItem(PENDING_KEY) || "[]");
    list.push({
      chatId,
      content: opts.content,
      mediaUrl: opts.mediaUrl,
      mediaType: opts.mediaType,
      replyToId: opts.replyToId ?? null,
      queuedAt: new Date().toISOString(),
    });
    localStorage.setItem(PENDING_KEY, JSON.stringify(list.slice(-50)));
  } catch {
    /* noop */
  }
}

/**
 * Reenvía los mensajes pendientes. Devuelve cuántos se enviaron.
 * - Si la red sigue caída, los no enviados permanecen en la cola.
 * - Los que fallan por un motivo permanente (permisos, clave inválida…) se
 *   descartan para no quedarse reintentando en bucle.
 */
export async function flushPendingMessages(): Promise<number> {
  let list: PendingSend[] = [];
  try {
    list = JSON.parse(localStorage.getItem(PENDING_KEY) || "[]") as PendingSend[];
  } catch {
    /* noop */
  }
  if (!list.length) return 0;
  let sent = 0;
  const remaining: PendingSend[] = [];
  for (const item of list) {
    try {
      await sendChatMessage(item.chatId, {
        content: item.content,
        mediaUrl: item.mediaUrl,
        mediaType: item.mediaType,
        replyToId: item.replyToId ?? null,
      });
      sent += 1;
    } catch (err) {
      if (isNetworkError(err)) {
        remaining.push(item);
        break; // la red sigue caída: no machacar con más peticiones
      }
      // Error permanente (permisos, clave…): se descarta para evitar bucle.
    }
  }
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(remaining));
  } catch {
    /* noop */
  }
  return sent;
}

/**
 * ¿La tabla del chat está desactualizada (sin la columna media_type)?
 * Se usa al abrir el chat para avisar de reinstalar el esquema antes de que
 * falle el envío de audios. En modo local no aplica (no hay esquema real).
 */
export async function isChatSchemaOutdated(): Promise<boolean> {
  const me = await getMeId();
  if (me?.isLocal) return false;
  try {
    const { error } = await supabase.from("chat_messages").select("media_type").limit(1);
    if (!error) return false;
    const msg = (error as Error)?.message ?? "";
    return error.code === "PGRST204" || /schema cache/i.test(msg) || /could not find the .* column/i.test(msg);
  } catch {
    return false;
  }
}

// ───── Avisos del grupo y paquetes de regalo ─────
// Los avisos solo los publica el administrador (linkyteam989@gmail.com) y son
// visibles para todos. Los paquetes de regalo reparten orbes: el admin elige
// la cantidad por persona (par, mínimo 100) y cuántas personas pueden abrirlo;
// al llenarse, el paquete se cierra automáticamente.

export function isAnnouncement(m: Pick<ChatMessage, "kind">): boolean {
  return m.kind === "announcement";
}

export function isGiftMessage(m: Pick<ChatMessage, "kind">): boolean {
  return m.kind === "gift";
}

export type OrbGift = {
  id: string;
  chat_id: string;
  created_by: string;
  amount_per_person: number;
  max_claims: number;
  claims: number;
  total_orbes: number;
  status: "open" | "closed";
  created_at: string;
  closed_at: string | null;
  claimed_by_me?: boolean;
};

/** Publica un aviso del grupo en el chat (solo el administrador). */
export async function createAnnouncement(
  chatId: string,
  content: string
): Promise<{ ok: boolean; message?: ChatMessage; error?: string }> {
  const { data, error } = await supabase.rpc("create_announcement", {
    _chat_id: chatId,
    _content: content,
  } as never);
  if (error) return { ok: false, error: error.message };
  return (data as { ok: boolean; message?: ChatMessage; error?: string }) ?? { ok: false, error: "Error desconocido" };
}

/** Crea un paquete de regalos de orbes en el chat (solo el administrador). */
export async function createOrbGift(
  chatId: string,
  opts: { title?: string; amountPerPerson: number; maxClaims: number }
): Promise<{ ok: boolean; giftId?: string; message?: ChatMessage; error?: string }> {
  const { data, error } = await supabase.rpc("create_orb_gift", {
    _chat_id: chatId,
    _title: opts.title ?? "",
    _amount_per_person: Math.floor(opts.amountPerPerson),
    _max_claims: Math.floor(opts.maxClaims),
  } as never);
  if (error) return { ok: false, error: error.message };
  const r = (data as { ok: boolean; gift_id?: string; message?: ChatMessage; error?: string }) ?? {};
  return { ok: !!r.ok, giftId: r.gift_id, message: r.message, error: r.error };
}

/** Abre un regalo del paquete y acredita los orbes al usuario. */
export async function claimOrbGift(
  giftId: string
): Promise<{ ok: boolean; amount?: number; claims?: number; closed?: boolean; error?: string }> {
  const { data, error } = await supabase.rpc("claim_orb_gift", { _gift_id: giftId } as never);
  if (error) return { ok: false, error: error.message };
  return (
    (data as { ok: boolean; amount?: number; claims?: number; closed?: boolean; error?: string }) ??
    { ok: false, error: "Error desconocido" }
  );
}

/** Estado actual de un paquete de regalo (para renderizar la tarjeta). */
export async function fetchOrbGift(giftId: string): Promise<OrbGift | null> {
  const { data, error } = await supabase.rpc("get_orb_gift", { _gift_id: giftId } as never);
  if (error || !data) return null;
  return data as OrbGift;
}

/**
 * Realtime de los paquetes de regalo: cuando alguien abre un regalo o el
 * paquete se cierra, todos los clientes conectados lo ven al instante.
 */
export function subscribeToOrbGifts(
  onChange: (type: "INSERT" | "UPDATE" | "DELETE", gift: OrbGift) => void
): () => void {
  if (typeof supabase.channel !== "function") return () => {};
  try {
    const base: any = supabase.channel("orb-gifts");
    if (!base || typeof base.on !== "function") {
      if (typeof base?.subscribe === "function") base.subscribe();
      return () => {};
    }
    base.on(
      "postgres_changes",
      { schema: "public", table: "orb_gifts", event: "INSERT" },
      (p: any) => onChange("INSERT", p.new as OrbGift)
    );
    base.on(
      "postgres_changes",
      { schema: "public", table: "orb_gifts", event: "UPDATE" },
      (p: any) => onChange("UPDATE", p.new as OrbGift)
    );
    base.on(
      "postgres_changes",
      { schema: "public", table: "orb_gifts", event: "DELETE" },
      (p: any) => onChange("DELETE", p.old as OrbGift)
    );
    base.subscribe();
    return () => {
      try {
        (supabase as any).removeChannel?.(base);
      } catch {
        /* noop */
      }
    };
  } catch {
    return () => {};
  }
}
