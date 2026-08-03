// @ts-nocheck — Chat adapter (same Supabase client + helpers as api.ts)
import { supabase } from "@/integrations/supabase/client";
import { signMediaUrls, uploadMedia, type Profile } from "@/lib/social/api";

export type ChatMessage = {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string | null;
  media_url: string | null;
  reply_to_id: string | null;
  created_at: string;
};

export type ChatWithMeta = {
  chat: Record<string, any>;
  members: Profile[];
  other: Profile | null;
  last_message: ChatMessage | null;
  unread: number;
  last_read_at: string | null;
};

async function getMeId(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function listMyChats(): Promise<ChatWithMeta[]> {
  const me = await getMeId();
  if (!me) return [];
  const { data: myMemberships } = await supabase
    .from("chat_members")
    .select("chat_id")
    .eq("user_id", me);
  const chatIds = (myMemberships ?? []).map((m) => m.chat_id);
  if (!chatIds.length) return [];

  const [{ data: chats }, { data: members }, { data: messages }] = await Promise.all([
    supabase.from("chats").select("*").in("id", chatIds).order("updated_at", { ascending: false }).limit(100),
    supabase.from("chat_members").select("*").in("chat_id", chatIds),
    supabase
      .from("chat_messages")
      .select("id, chat_id, sender_id, content, media_url, reply_to_id, created_at")
      .in("chat_id", chatIds)
      .order("created_at", { ascending: false })
      .limit(300),
  ]);

  const memberIds = Array.from(new Set((members ?? []).map((m) => m.user_id)));
  const { data: profiles } = await supabase.from("profiles").select("*").in("id", memberIds);
  const pmap = new Map((profiles ?? []).map((p) => [p.id, p]));

  const membersByChat = new Map<string, Profile[]>();
  for (const m of members ?? []) {
    const arr = membersByChat.get(m.chat_id) ?? [];
    arr.push((pmap.get(m.user_id) ?? { id: m.user_id }) as Profile);
    membersByChat.set(m.chat_id, arr);
  }

  const lastReadByChat = new Map<string, string>();
  for (const m of members ?? []) {
    if (m.user_id === me && m.last_read_at) lastReadByChat.set(m.chat_id, m.last_read_at);
  }

  const lastByChat = new Map<string, ChatMessage>();
  const unreadByChat = new Map<string, number>();
  for (const msg of (messages ?? []) as ChatMessage[]) {
    if (!lastByChat.has(msg.chat_id)) lastByChat.set(msg.chat_id, msg);
    const lastRead = lastReadByChat.get(msg.chat_id);
    if (msg.sender_id !== me && (!lastRead || new Date(msg.created_at) > new Date(lastRead))) {
      unreadByChat.set(msg.chat_id, (unreadByChat.get(msg.chat_id) ?? 0) + 1);
    }
  }

  return (chats ?? []).map((c) => {
    const ms = membersByChat.get(c.id) ?? [];
    const other = c.type === "direct" ? (ms.find((m) => m.id !== me) ?? null) : null;
    return {
      chat: c,
      members: ms,
      other,
      last_message: lastByChat.get(c.id) ?? null,
      unread: unreadByChat.get(c.id) ?? 0,
      last_read_at: lastReadByChat.get(c.id) ?? null,
    };
  });
}

export async function getOrCreateDirectChat(otherUserId: string): Promise<string> {
  const me = await getMeId();
  if (!me) throw new Error("Not authenticated");
  if (otherUserId === me) throw new Error("No puedes chatear contigo mismo");

  const { data: mine } = await supabase.from("chat_members").select("chat_id").eq("user_id", me);
  const myIds = (mine ?? []).map((m) => m.chat_id);
  if (myIds.length) {
    const { data: theirs } = await supabase
      .from("chat_members")
      .select("chat_id")
      .eq("user_id", otherUserId)
      .in("chat_id", myIds);
    if ((theirs ?? []).length) {
      const { data: existing } = await supabase
        .from("chats")
        .select("*")
        .eq("id", theirs[0].chat_id)
        .maybeSingle();
      if (existing) return existing.id;
    }
  }

  const { data: chat, error: chatErr } = await supabase
    .from("chats")
    .insert({ type: "direct", created_by: me })
    .select()
    .single();
  if (chatErr) throw chatErr;
  await supabase.from("chat_members").insert([
    { chat_id: chat.id, user_id: me, role: "admin" },
    { chat_id: chat.id, user_id: otherUserId, role: "member" },
  ]);
  return chat.id;
}

export async function createGroupChat(name: string, memberIds: string[]): Promise<string> {
  const me = await getMeId();
  if (!me) throw new Error("Not authenticated");
  const { data: chat, error: chatErr } = await supabase
    .from("chats")
    .insert({ type: "group", name: name.trim() || "Chat grupal", created_by: me })
    .select()
    .single();
  if (chatErr) throw chatErr;
  const rows = [
    { chat_id: chat.id, user_id: me, role: "admin" },
    ...Array.from(new Set(memberIds))
      .filter((id) => id !== me)
      .map((id) => ({ chat_id: chat.id, user_id: id, role: "member" })),
  ];
  await supabase.from("chat_members").insert(rows);
  return chat.id;
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
  const me = await getMeId();
  if (!me) throw new Error("Not authenticated");
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

export async function markChatRead(chatId: string): Promise<void> {
  const me = await getMeId();
  if (!me) return;
  await supabase
    .from("chat_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("chat_id", chatId)
    .eq("user_id", me);
}

export async function searchUsers(query: string): Promise<Profile[]> {
  const me = await getMeId();
  const q = query.trim();
  if (!q) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
    .neq("id", me ?? "")
    .limit(20);
  if (error) throw error;
  return (data ?? []) as Profile[];
}

export async function uploadSticker(file: File): Promise<string> {
  const me = await getMeId();
  if (!me) throw new Error("Not authenticated");
  return uploadMedia(file, me);
}

export async function fetchMyStickers(): Promise<{ path: string; title: string }[]> {
  const me = await getMeId();
  if (!me) return [];
  const { data, error } = await supabase
    .from("posts")
    .select("id, media_urls, content, price_orbes")
    .eq("author_id", me)
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
