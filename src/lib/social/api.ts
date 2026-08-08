// @ts-nocheck — Local DB adapter (types differ from Supabase generics)
import { supabase, isSchemaMissing } from "@/integrations/supabase/client";

export type SocialLinks = {
  youtube?: string;
  tiktok?: string;
  instagram?: string;
  twitter?: string;
  website?: string;
};

export type CreatorCardStyle = {
  theme?: "dark" | "light" | "neon" | "aurora" | "sunset";
  accent?: string;
  tagline?: string;
};

export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  orbes?: number;
  is_plus?: boolean;
  show_plus_badge?: boolean;
  avatar_frame?: string | null;
  social_links?: SocialLinks | null;
  last_plus_claim_at?: string | null;
  banner_url?: string | null;
  pronouns?: string | null;
  location?: string | null;
  status_text?: string | null;
  status_emoji?: string | null;
  accent_color?: string | null;
  favorite_genre?: string | null;
  custom_title?: string | null;
  birthday?: string | null;
  show_orbes?: boolean;
  theme_mode?: string | null;
  featured_post_id?: string | null;
  interests?: string[] | null;
  // Plus v2
  plus_expires_at?: string | null;
  name_effect?: string | null;
  profile_background?: string | null;
  post_effect?: string | null;
  creator_card_style?: CreatorCardStyle | null;
};

export function isPlusActive(p: Profile | null | undefined): boolean {
  // Plus es gratuito para todos: la barrera de suscripción se eliminó.
  return true;
}

export function daysUntilPlusExpires(p: Profile | null | undefined): number | null {
  if (!p?.plus_expires_at) return null;
  const ms = new Date(p.plus_expires_at).getTime() - Date.now();
  return Math.ceil(ms / 86400000);
}

export type MediaType = "none" | "image" | "video" | "link";

export type PollData = {
  id: string;
  question: string;
  options: string[];
  votes: number[];
  my_vote: number | null;
  total: number;
};

export type PostRow = {
  id: string;
  author_id: string;
  content: string;
  media_urls: string[];
  media_type: MediaType;
  link_url: string | null;
  category: string | null;
  cover_url: string | null;
  screenshots?: string[] | null;
  allow_remix?: boolean;
  price_orbes?: number;
  text_color?: string | null;
  html_content?: string | null;
  document_paths?: string[];
  document_names?: string[];
  pinned_game_id?: string | null;
  locked_content?: string | null;
  unlock_reactions_goal?: number | null;
  unlock_at?: string | null;
  entrance_effect?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type PostWithMeta = PostRow & {
  author: Profile | null;
  tags: string[];
  likes: number;
  favorites: number;
  comments_count: number;
  reposts_count: number;
  my_like: boolean;
  my_favorite: boolean;
  my_repost: boolean;
  signed_media: string[];
  signed_cover: string | null;
  signed_screenshots: string[];
  signed_documents?: { name: string; url: string }[];
  poll?: PollData | null;
  pinned_game?: { id: string; title: string; cover_url: string | null } | null;
  is_unlocked?: boolean;
  owned?: boolean;
};




export type CommentRow = {
  id: string;
  post_id: string;
  author_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  deleted_at: string | null;
  author?: Profile | null;
  likes?: number;
  my_like?: boolean;
  replies?: CommentRow[];
};

const MEDIA_BUCKET = "post-media";

export async function signMediaUrls(paths: string[]): Promise<string[]> {
  if (!paths.length) return [];
  // Paralelo: los chats con muchos stickers/audios firman todas las URLs a la vez.
  return Promise.all(
    paths.map(async (p) => {
      if (/^https?:\/\//.test(p)) return p;
      const { data } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrl(p, 60 * 60 * 24 * 7);
      return data?.signedUrl ?? "";
    })
  );
}

export async function uploadMedia(file: File, userId: string): Promise<string> {
  const ext = file.name.split(".").pop() || "bin";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });
  if (error) throw error;
  return path;
}

export async function fetchFeed(opts: { search?: string; tag?: string; category?: string; includeGames?: boolean } = {}): Promise<PostWithMeta[]> {
  let q = supabase.from("posts").select("*").is("deleted_at", null).order("created_at", { ascending: false }).limit(100);
  if (opts.search) q = q.ilike("content", `%${opts.search}%`);
  if (opts.category) q = q.eq("category", opts.category);
  else if (!opts.includeGames) q = q.or("category.is.null,category.neq.game");
  const { data: posts, error } = await q;
  if (error) {
    // Esquema aún sin crear en Supabase: degradar a lista vacía en vez de crashear.
    if (isSchemaMissing(error)) return [];
    throw error;
  }
  if (!posts || !posts.length) return [];

  const ids = posts.map(p => p.id);
  const authorIds = Array.from(new Set(posts.map(p => p.author_id)));
  const { data: { user } } = await supabase.auth.getUser();
  const me = user?.id ?? null;

  const [profiles, reactions, comments, reposts, tagsJoin, purchases] = await Promise.all([
    supabase.from("profiles").select("*").in("id", authorIds),
    supabase.from("reactions").select("post_id,user_id,type").in("post_id", ids),
    supabase.from("comments").select("post_id").in("post_id", ids).is("deleted_at", null),
    supabase.from("reposts").select("post_id,user_id").in("post_id", ids),
    supabase.from("post_tags").select("post_id,tags(name)").in("post_id", ids),
    me
      ? supabase.from("game_purchases").select("post_id").eq("user_id", me).in("post_id", ids)
      : Promise.resolve({ data: [] as { post_id: string }[] }),
  ]);

  const pmap = new Map((profiles.data ?? []).map(p => [p.id, p as Profile]));
  const ownedIds = new Set((purchases.data ?? []).map(x => x.post_id));
  const tagMap = new Map<string, string[]>();
  for (const row of (tagsJoin.data ?? []) as Array<{ post_id: string; tags: { name: string } | null }>) {
    const arr = tagMap.get(row.post_id) ?? [];
    if (row.tags?.name) arr.push(row.tags.name);
    tagMap.set(row.post_id, arr);
  }

  let tagFiltered = posts;
  if (opts.tag) tagFiltered = posts.filter(p => (tagMap.get(p.id) ?? []).includes(opts.tag!));

  const result: PostWithMeta[] = [];
  for (const p of tagFiltered) {
    const r = (reactions.data ?? []).filter(x => x.post_id === p.id);
    const likes = r.filter(x => x.type === "like").length;
    const favs = r.filter(x => x.type === "favorite").length;
    const my_like = !!me && r.some(x => x.user_id === me && x.type === "like");
    const my_favorite = !!me && r.some(x => x.user_id === me && x.type === "favorite");
    const c = (comments.data ?? []).filter(x => x.post_id === p.id).length;
    const reps = (reposts.data ?? []).filter(x => x.post_id === p.id);
    const my_repost = !!me && reps.some(x => x.user_id === me);
    const signed = await signMediaUrls(p.media_urls ?? []);
    const signedCover = p.cover_url ? (await signMediaUrls([p.cover_url]))[0] ?? null : null;
    const signedScreens = (p as PostRow).screenshots?.length ? await signMediaUrls((p as PostRow).screenshots) : [];
    const priceOrbes = (p as PostRow).price_orbes ?? 0;
    const owned = priceOrbes <= 0 || p.author_id === me || ownedIds.has(p.id);
    const post = p as PostRow;
    const docPaths = post.document_paths ?? [];
    const docNames = post.document_names ?? [];
    const signedDocs = docPaths.length
      ? (await signMediaUrls(docPaths)).map((url, i) => ({ url, name: docNames[i] ?? `Documento ${i + 1}` }))
      : [];
    // unlock check
    let isUnlocked = true;
    if (post.locked_content) {
      const goalHit = post.unlock_reactions_goal ? (likes + favs) >= post.unlock_reactions_goal : false;
      const dateHit = post.unlock_at ? new Date(post.unlock_at) <= new Date() : false;
      isUnlocked = post.author_id === me || goalHit || dateHit;
    }
    result.push({
      ...post,
      author: pmap.get(p.author_id) ?? null,
      tags: tagMap.get(p.id) ?? [],
      likes, favorites: favs, comments_count: c, reposts_count: reps.length,
      my_like, my_favorite, my_repost,
      signed_media: signed,
      signed_cover: signedCover,
      signed_screenshots: signedScreens,
      signed_documents: signedDocs,
      is_unlocked: isUnlocked,
      owned,
    });

  }
  // Hydrate polls + pinned games in one pass
  await hydratePollsAndGames(result, me);
  return result;
}

async function hydratePollsAndGames(list: PostWithMeta[], me: string | null) {
  const ids = list.map(p => p.id);
  const pinnedIds = Array.from(new Set(list.map(p => p.pinned_game_id).filter(Boolean))) as string[];
  const [pollsRes, votesRes, gamesRes] = await Promise.all([
    supabase.from("post_polls").select("*").in("post_id", ids),
    me
      ? supabase.from("post_poll_votes").select("*").in("poll_id", []).then(async () => {
          const { data: allPolls } = await supabase.from("post_polls").select("id").in("post_id", ids);
          const pollIds = (allPolls ?? []).map(p => p.id);
          if (!pollIds.length) return { data: [] as { poll_id: string; user_id: string; option_index: number }[] };
          return supabase.from("post_poll_votes").select("poll_id,user_id,option_index").in("poll_id", pollIds);
        })
      : Promise.resolve({ data: [] as { poll_id: string; user_id: string; option_index: number }[] }),
    pinnedIds.length
      ? supabase.from("posts").select("id,content,cover_url").in("id", pinnedIds)
      : Promise.resolve({ data: [] as { id: string; content: string; cover_url: string | null }[] }),
  ]);
  const pollByPost = new Map<string, { id: string; question: string; options: string[] }>();
  for (const row of (pollsRes.data ?? []) as { id: string; post_id: string; question: string; options: string[] }[]) {
    pollByPost.set(row.post_id, { id: row.id, question: row.question, options: row.options });
  }
  const votesByPoll = new Map<string, { user_id: string; option_index: number }[]>();
  for (const v of (votesRes.data ?? [])) {
    const arr = votesByPoll.get(v.poll_id) ?? [];
    arr.push({ user_id: v.user_id, option_index: v.option_index });
    votesByPoll.set(v.poll_id, arr);
  }
  const gameById = new Map<string, { id: string; content: string; cover_url: string | null }>();
  for (const g of (gamesRes.data ?? [])) gameById.set(g.id, g);
  const gameCovers = await Promise.all(
    Array.from(gameById.values()).map(async g => ({
      id: g.id,
      signed: g.cover_url ? (await signMediaUrls([g.cover_url]))[0] ?? null : null,
    })),
  );
  const gameCoverMap = new Map(gameCovers.map(x => [x.id, x.signed]));
  for (const post of list) {
    const p = pollByPost.get(post.id);
    if (p) {
      const votes = votesByPoll.get(p.id) ?? [];
      const counts = p.options.map((_, i) => votes.filter(v => v.option_index === i).length);
      const myVote = me ? (votes.find(v => v.user_id === me)?.option_index ?? null) : null;
      post.poll = { id: p.id, question: p.question, options: p.options, votes: counts, my_vote: myVote, total: votes.length };
    } else {
      post.poll = null;
    }
    if (post.pinned_game_id && gameById.has(post.pinned_game_id)) {
      const g = gameById.get(post.pinned_game_id)!;
      const title = (g.content.split("\n")[0] || "Juego").replace(/^🎮\s*/, "").trim() || "Juego";
      post.pinned_game = { id: g.id, title, cover_url: gameCoverMap.get(g.id) ?? null };
    } else {
      post.pinned_game = null;
    }
  }
}



export async function createPost(input: {
  content: string;
  files: File[];
  mediaType: MediaType;
  linkUrl?: string;
  category?: string;
  tags: string[];
  textColor?: string | null;
  htmlContent?: string | null;
  documents?: File[];
  pinnedGameId?: string | null;
  lockedContent?: string | null;
  unlockReactionsGoal?: number | null;
  unlockAt?: string | null;
  poll?: { question: string; options: string[] } | null;
}): Promise<PostRow> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const paths: string[] = [];
  for (const f of input.files) paths.push(await uploadMedia(f, user.id));

  const docPaths: string[] = [];
  const docNames: string[] = [];
  for (const f of input.documents ?? []) {
    docPaths.push(await uploadMedia(f, user.id));
    docNames.push(f.name);
  }

  // Auto-apply the author's Plus post_effect (if active) as entrance_effect.
  let entranceEffect: string | null = null;
  const { data: myProfile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (myProfile && isPlusActive(myProfile as Profile) && (myProfile as Profile).post_effect) {
    entranceEffect = (myProfile as Profile).post_effect!;
  }

  const { data: post, error } = await supabase.from("posts").insert({
    author_id: user.id,
    content: input.content,
    media_urls: paths,
    media_type: input.mediaType,
    link_url: input.linkUrl || null,
    category: input.category || null,
    text_color: input.textColor || null,
    html_content: input.htmlContent || null,
    document_paths: docPaths,
    document_names: docNames,
    pinned_game_id: input.pinnedGameId || null,
    locked_content: input.lockedContent || null,
    unlock_reactions_goal: input.unlockReactionsGoal ?? null,
    unlock_at: input.unlockAt || null,
    entrance_effect: entranceEffect,
  } as never).select().single();
  if (error) throw error;

  if (input.poll && input.poll.options.filter(o => o.trim()).length >= 2) {
    await supabase.from("post_polls").insert({
      post_id: post!.id,
      question: input.poll.question.trim() || "Encuesta",
      options: input.poll.options.map(o => o.trim()).filter(Boolean),
    });
  }

  if (input.tags.length) {
    const names = Array.from(new Set(input.tags.map(t => t.trim().toLowerCase()).filter(Boolean)));
    for (const name of names) {
      let { data: tag } = await supabase.from("tags").select("id").eq("name", name).maybeSingle();
      if (!tag) {
        const { data: created } = await supabase.from("tags").insert({ name }).select().single();
        tag = created;
      }
      if (tag) await supabase.from("post_tags").insert({ post_id: post!.id, tag_id: tag.id });
    }
  }
  return post as PostRow;
}


export async function updatePost(id: string, patch: { content?: string; category?: string | null }) {
  const { error } = await supabase.from("posts").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deletePost(id: string) {
  const { error } = await supabase.from("posts").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function toggleReaction(opts: { postId?: string; commentId?: string; type: "like" | "favorite" }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const q = supabase.from("reactions").select("id").eq("user_id", user.id).eq("type", opts.type);
  const { data: existing } = opts.postId
    ? await q.eq("post_id", opts.postId).maybeSingle()
    : await q.eq("comment_id", opts.commentId!).maybeSingle();
  if (existing) {
    await supabase.from("reactions").delete().eq("id", existing.id);
    return false;
  }
  await supabase.from("reactions").insert({
    user_id: user.id,
    post_id: opts.postId ?? null,
    comment_id: opts.commentId ?? null,
    type: opts.type,
  });
  // Notificar al autor del post/comentario (una sola vez hasta que se lea).
  void (async () => {
    try {
      const type = opts.type === "like" ? "like" : "favorite";
      if (opts.postId) {
        const { data: p } = await supabase.from("posts").select("author_id").eq("id", opts.postId).maybeSingle();
        if (p) await pushNotification({ userId: p.author_id, type, postId: opts.postId });
      } else if (opts.commentId) {
        const { data: c } = await supabase.from("comments").select("author_id").eq("id", opts.commentId).maybeSingle();
        if (c) await pushNotification({ userId: c.author_id, type, commentId: opts.commentId });
      }
    } catch { /* noop */ }
  })();
  return true;
}

export async function toggleRepost(postId: string, quote?: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: existing } = await supabase.from("reposts").select("id").eq("user_id", user.id).eq("post_id", postId).maybeSingle();
  if (existing) {
    await supabase.from("reposts").delete().eq("id", existing.id);
    return false;
  }
  await supabase.from("reposts").insert({ user_id: user.id, post_id: postId, quote: quote || null });
  // Notificar al autor del post.
  void (async () => {
    try {
      const { data: p } = await supabase.from("posts").select("author_id").eq("id", postId).maybeSingle();
      if (p) await pushNotification({ userId: p.author_id, type: "repost", postId });
    } catch { /* noop */ }
  })();
  return true;
}

export async function fetchComments(postId: string): Promise<CommentRow[]> {
  const { data, error } = await supabase.from("comments").select("*").eq("post_id", postId).order("created_at", { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as CommentRow[];
  const authorIds = Array.from(new Set(rows.map(r => r.author_id)));
  const { data: profiles } = await supabase.from("profiles").select("*").in("id", authorIds);
  const pmap = new Map((profiles ?? []).map(p => [p.id, p as Profile]));
  const { data: { user } } = await supabase.auth.getUser();
  const me = user?.id ?? null;
  const ids = rows.map(r => r.id);
  const { data: reactions } = await supabase.from("reactions").select("comment_id,user_id,type").in("comment_id", ids);

  const byId = new Map<string, CommentRow>();
  rows.forEach(r => {
    const rs = (reactions ?? []).filter(x => x.comment_id === r.id && x.type === "like");
    byId.set(r.id, {
      ...r,
      author: pmap.get(r.author_id) ?? null,
      likes: rs.length,
      my_like: !!me && rs.some(x => x.user_id === me),
      replies: [],
    });
  });
  const top: CommentRow[] = [];
  byId.forEach(r => {
    if (r.parent_id && byId.has(r.parent_id)) byId.get(r.parent_id)!.replies!.push(r);
    else top.push(r);
  });
  return top;
}

export async function addComment(postId: string, content: string, parentId?: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { error } = await supabase.from("comments").insert({
    post_id: postId, author_id: user.id, parent_id: parentId ?? null, content,
  });
  if (error) throw error;

  // Notificaciones (best-effort): respuesta → autor del comentario padre;
  // comentario → autor del post; y menciones @usuario dentro del texto.
  void (async () => {
    try {
      if (parentId) {
        const { data: c } = await supabase.from("comments").select("author_id").eq("id", parentId).maybeSingle();
        if (c) await pushNotification({ userId: c.author_id, type: "reply", postId, commentId: parentId });
      } else {
        const { data: p } = await supabase.from("posts").select("author_id").eq("id", postId).maybeSingle();
        if (p) await pushNotification({ userId: p.author_id, type: "comment", postId });
      }
    } catch { /* noop */ }
    try {
      const mentions = Array.from(new Set(
        (content.match(/@([a-zA-Z0-9_]{2,24})/g) ?? []).map(t => t.slice(1))
      ));
      if (mentions.length) {
        const { data: rows } = await supabase.from("profiles").select("id, username").in("username", mentions);
        for (const row of rows ?? []) {
          await pushNotification({ userId: row.id, type: "mention", postId, commentId: parentId ?? undefined });
        }
      }
    } catch { /* noop */ }
  })();
}

export async function deleteComment(id: string) {
  const { error } = await supabase.from("comments").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function reportContent(opts: { postId?: string; commentId?: string; reason: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { error } = await supabase.from("reports").insert({
    reporter_id: user.id,
    post_id: opts.postId ?? null,
    comment_id: opts.commentId ?? null,
    reason: opts.reason,
  });
  if (error) throw error;
}

export async function blockUser(blockedId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  await supabase.from("blocks").insert({ blocker_id: user.id, blocked_id: blockedId });
}

export type NotifType = "comment" | "reply" | "reaction" | "repost" | "mention" | "follow" | "like" | "favorite" | "game";

/** Crea una notificación para otro usuario (best-effort). `push_notification` (SQL, security definer) aplica las reglas de «solo lo importante». */
export async function pushNotification(opts: {
  userId: string;
  type: NotifType;
  postId?: string;
  commentId?: string;
  actorId?: string;
}): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.rpc("push_notification", {
      _user_id: opts.userId,
      _actor_id: opts.actorId ?? user.id,
      _type: opts.type,
      _post_id: opts.postId ?? null,
      _comment_id: opts.commentId ?? null,
    } as never);
  } catch {
    /* best effort */
  }
}

export async function fetchNotifications() {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  const rows = data ?? [];
  const actorIds = Array.from(new Set(rows.map(r => r.actor_id).filter(Boolean))) as string[];
  const { data: profiles } = await supabase.from("profiles").select("*").in("id", actorIds);
  const pmap = new Map((profiles ?? []).map(p => [p.id, p as Profile]));
  return rows.map(r => ({ ...r, actor: r.actor_id ? pmap.get(r.actor_id) ?? null : null }));
}

export async function markNotificationsRead() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
}

export async function getMyProfile(): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return (data as Profile) ?? null;
}

export async function isMod(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  return (data ?? []).some(r => r.role === "moderator" || r.role === "admin");
}

// ---------- Published games ----------
async function upsertTagsFor(postId: string, tags?: string[]) {
  if (!tags?.length) return;
  const names = Array.from(new Set(tags.map(t => t.trim().toLowerCase()).filter(Boolean)));
  for (const name of names) {
    let { data: tag } = await supabase.from("tags").select("id").eq("name", name).maybeSingle();
    if (!tag) {
      const { data: created } = await supabase.from("tags").insert({ name }).select().single();
      tag = created;
    }
    if (tag) await supabase.from("post_tags").insert({ post_id: postId, tag_id: tag.id }).select();
  }
}

export async function publishGame(input: {
  project: unknown;
  title: string;
  description?: string;
  tags?: string[];
  coverFile?: File | null;
  screenshotFiles?: File[];
  allowRemix?: boolean;
  priceOrbes?: number;
}): Promise<PostRow> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const json = JSON.stringify(input.project);
  const file = new File([json], `${input.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "game"}.asternal.json`, {
    type: "application/json",
  });
  const path = await uploadMedia(file, user.id);
  const coverPath = input.coverFile ? await uploadMedia(input.coverFile, user.id) : null;
  const screenshots = input.screenshotFiles?.length
    ? await Promise.all(input.screenshotFiles.map(f => uploadMedia(f, user.id)))
    : [];
  const content = `🎮 ${input.title}${input.description ? "\n\n" + input.description : ""}`;
  const { data: post, error } = await supabase.from("posts").insert({
    author_id: user.id,
    content,
    media_urls: [path],
    media_type: "none",
    link_url: null,
    category: "game",
    cover_url: coverPath,
    screenshots,
    allow_remix: input.allowRemix ?? true,
    price_orbes: Math.max(0, Math.floor(input.priceOrbes ?? 0)),
  } as never).select().single();
  if (error) throw error;
  await upsertTagsFor(post!.id, input.tags);
  // Notifica a tus seguidores (best-effort): publicaste un juego nuevo.
  void (async () => {
    try {
      const { data: followers } = await supabase
        .from("follows" as never)
        .select("follower_id" as never)
        .eq("following_id" as never, user.id);
      for (const f of (followers ?? []) as { follower_id: string }[]) {
        await pushNotification({ userId: f.follower_id, type: "game", postId: post!.id });
      }
    } catch { /* noop */ }
  })();
  return post as PostRow;
}

export async function updateGame(postId: string, input: {
  project?: unknown;
  title: string;
  description?: string;
  tags?: string[];
  coverFile?: File | null;
  removeCover?: boolean;
  screenshotFiles?: File[];
  keepScreenshots?: string[];
  allowRemix?: boolean;
  priceOrbes?: number;
}): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const patch: Record<string, unknown> = {
    content: `🎮 ${input.title}${input.description ? "\n\n" + input.description : ""}`,
  };
  if (input.project !== undefined) {
    const json = JSON.stringify(input.project);
    const file = new File([json], `${input.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "game"}.asternal.json`, { type: "application/json" });
    const path = await uploadMedia(file, user.id);
    patch.media_urls = [path];
  }
  if (input.coverFile) {
    patch.cover_url = await uploadMedia(input.coverFile, user.id);
  } else if (input.removeCover) {
    patch.cover_url = null;
  }
  if (input.screenshotFiles || input.keepScreenshots) {
    // Se reemplaza la lista: conserva las marcadas + sube las nuevas.
    const keep = input.keepScreenshots ?? [];
    const uploads = input.screenshotFiles?.length
      ? await Promise.all(input.screenshotFiles.map(f => uploadMedia(f, user.id)))
      : [];
    patch.screenshots = [...keep, ...uploads];
  }
  if (typeof input.allowRemix === "boolean") patch.allow_remix = input.allowRemix;
  if (typeof input.priceOrbes === "number") patch.price_orbes = Math.max(0, Math.floor(input.priceOrbes));
  const { error } = await supabase.from("posts").update(patch as never).eq("id", postId);
  if (error) throw error;
  if (input.tags) {
    await supabase.from("post_tags").delete().eq("post_id", postId);
    await upsertTagsFor(postId, input.tags);
  }
}

export async function purchaseGame(postId: string): Promise<{ ok: boolean; paid?: number; balance?: number; free?: boolean; already_owned?: boolean }> {
  const { data, error } = await supabase.rpc("purchase_game" as never, { _post_id: postId } as never);
  if (error) throw error;
  return (data as { ok: boolean; paid?: number; balance?: number; free?: boolean; already_owned?: boolean }) ?? { ok: false };
}

export async function getMyOrbes(): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;
  const { data } = await supabase.from("profiles").select("orbes").eq("id", user.id).maybeSingle();
  return (data as { orbes?: number } | null)?.orbes ?? 0;
}

export type OrbeTx = {
  id: string;
  user_id: string;
  amount: number;
  kind: "welcome_bonus" | "game_purchase" | "adjustment";
  post_id: string | null;
  description: string | null;
  created_at: string;
};

export async function fetchOrbeTransactions(limit = 100): Promise<OrbeTx[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("orbe_transactions" as never)
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as OrbeTx[];
}


export async function remixGame(post: PostWithMeta): Promise<{ cloudId: string; name: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  if (post.allow_remix === false) throw new Error("El autor no permite remixes de este juego");
  if (!post.signed_media[0]) throw new Error("Juego sin datos");
  const project = await loadGameProject(post.signed_media[0]);
  const title = (post.content.split("\n")[0] || "Juego").replace(/^🎮\s*/, "").trim() || "Juego";
  const name = `${title} (remix)`;
  try { (project as { name?: string }).name = name; } catch { /* ignore */ }
  const { data, error } = await supabase.from("user_projects")
    .insert({ user_id: user.id, name, data: project as never })
    .select().single();
  if (error) throw error;
  return { cloudId: (data as { id: string }).id, name };
}


export async function fetchGames(opts: { search?: string } = {}): Promise<PostWithMeta[]> {
  return fetchFeed({ ...opts, category: "game" });
}

export async function loadGameProject(signedUrl: string): Promise<unknown> {
  const res = await fetch(signedUrl);
  if (!res.ok) throw new Error("No se pudo cargar el juego");
  return await res.json();
}

// ---------- Cloud project sync ----------
export type CloudProject = {
  id: string;
  user_id: string;
  name: string;
  data: unknown;
  published_post_id: string | null;
  created_at: string;
  updated_at: string;
};

export async function cloudListProjects(): Promise<CloudProject[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase.from("user_projects").select("id,user_id,name,data,published_post_id,created_at,updated_at").eq("user_id", user.id).order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CloudProject[];
}

export async function cloudSaveProject(input: { id?: string; name: string; data: unknown }): Promise<CloudProject> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  if (input.id) {
    const { data, error } = await supabase.from("user_projects")
      .update({ name: input.name, data: input.data as never })
      .eq("id", input.id).eq("user_id", user.id)
      .select().single();
    if (error) throw error;
    return data as CloudProject;
  }
  const { data, error } = await supabase.from("user_projects")
    .insert({ user_id: user.id, name: input.name, data: input.data as never })
    .select().single();
  if (error) throw error;
  return data as CloudProject;
}

export async function cloudDeleteProject(id: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("user_projects").delete().eq("id", id).eq("user_id", user.id);
}

// ---------- Admin ----------
export type ManagedUser = { id: string; username: string; display_name: string | null; is_mod: boolean; is_admin: boolean };

export async function isAdmin(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  return (data ?? []).some(r => r.role === "admin");
}

export async function listManagedUsers(search?: string): Promise<ManagedUser[]> {
  let q = supabase.from("profiles").select("id,username,display_name").limit(200);
  if (search) q = q.ilike("username", `%${search}%`);
  const { data: profs, error } = await q;
  if (error) throw error;
  const ids = (profs ?? []).map(p => p.id);
  if (!ids.length) return [];
  const { data: roles } = await supabase.from("user_roles").select("user_id,role").in("user_id", ids);
  const rmap = new Map<string, string[]>();
  (roles ?? []).forEach(r => {
    const arr = rmap.get(r.user_id) ?? [];
    arr.push(r.role);
    rmap.set(r.user_id, arr);
  });
  return (profs ?? []).map(p => {
    const rs = rmap.get(p.id) ?? [];
    return { ...p, is_mod: rs.includes("moderator"), is_admin: rs.includes("admin") };
  });
}

export async function setUserModerator(userId: string, on: boolean): Promise<void> {
  if (on) {
    await supabase.from("user_roles").insert({ user_id: userId, role: "moderator" });
  } else {
    await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "moderator");
  }
}


// ---------- Profile ----------
export async function updateMyProfile(patch: {
  username?: string; display_name?: string; bio?: string; avatar_url?: string | null;
  banner_url?: string | null; pronouns?: string; location?: string;
  status_text?: string; status_emoji?: string; accent_color?: string | null;
  favorite_genre?: string; custom_title?: string; birthday?: string | null;
  show_orbes?: boolean; theme_mode?: string; interests?: string[];
}): Promise<Profile> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const clean: Record<string, unknown> = {};
  if (patch.username !== undefined) clean.username = patch.username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (patch.display_name !== undefined) clean.display_name = patch.display_name.trim();
  if (patch.bio !== undefined) clean.bio = patch.bio;
  if (patch.avatar_url !== undefined) clean.avatar_url = patch.avatar_url;
  if (patch.banner_url !== undefined) clean.banner_url = patch.banner_url;
  if (patch.pronouns !== undefined) clean.pronouns = patch.pronouns.trim() || null;
  if (patch.location !== undefined) clean.location = patch.location.trim() || null;
  if (patch.status_text !== undefined) clean.status_text = patch.status_text.trim() || null;
  if (patch.status_emoji !== undefined) clean.status_emoji = patch.status_emoji.trim() || null;
  if (patch.accent_color !== undefined) clean.accent_color = patch.accent_color;
  if (patch.favorite_genre !== undefined) clean.favorite_genre = patch.favorite_genre.trim() || null;
  if (patch.custom_title !== undefined) clean.custom_title = patch.custom_title.trim() || null;
  if (patch.birthday !== undefined) clean.birthday = patch.birthday;
  if (patch.show_orbes !== undefined) clean.show_orbes = patch.show_orbes;
  if (patch.theme_mode !== undefined) clean.theme_mode = patch.theme_mode;
  if (patch.interests !== undefined) clean.interests = patch.interests;
  const { data, error } = await supabase.from("profiles").update(clean as never).eq("id", user.id).select().single();
  if (error) throw error;
  return data as Profile;
}

export async function uploadBanner(file: File): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  // Resize banner to 1024×300 max for quality + speed
  const optimized = await resizeImage(file, 1024);
  const optimizedFile = new File([optimized], file.name.replace(/\.[^.]+$/, "") + ".webp", { type: "image/webp" });
  const path = await uploadMedia(optimizedFile, user.id);
  const { data } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrl(path, 60 * 60 * 24 * 365);
  return data?.signedUrl ?? path;
}

/** Resize an image file to target size (max dimension) for faster upload & crisp display */
async function resizeImage(file: File, maxDim: number = 384): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = URL.createObjectURL(file);
  });
  // Only resize if image is larger than maxDim
  if (img.naturalWidth <= maxDim && img.naturalHeight <= maxDim) {
    URL.revokeObjectURL(img.src);
    return file;
  }
  const ratio = Math.min(maxDim / img.naturalWidth, maxDim / img.naturalHeight);
  const w = Math.round(img.naturalWidth * ratio);
  const h = Math.round(img.naturalHeight * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);
  URL.revokeObjectURL(img.src);
  return new Promise(resolve => canvas.toBlob(blob => resolve(blob ?? file), "image/webp", 0.92));
}

export async function uploadAvatar(file: File): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  // Resize to 384×384 max for crisp display + fast upload
  const optimized = await resizeImage(file, 384);
  const optimizedFile = new File([optimized], file.name.replace(/\.[^.]+$/, "") + ".webp", { type: "image/webp" });
  const path = await uploadMedia(optimizedFile, user.id);
  const { data } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrl(path, 60 * 60 * 24 * 365);
  return data?.signedUrl ?? path;
}

export async function fetchProfileById(userId: string): Promise<Profile | null> {
  const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  return (data as Profile) ?? null;
}

export async function fetchUserPosts(userId: string, opts: { games?: boolean; artwork?: boolean } = {}): Promise<PostWithMeta[]> {
  let q = supabase.from("posts").select("*").eq("author_id", userId).is("deleted_at", null).order("created_at", { ascending: false }).limit(100);
  if (opts.artwork) q = q.eq("category", "artwork");
  else if (opts.games === true) q = q.eq("category", "game");
  else if (opts.games === false) q = q.or("category.is.null,category.neq.game,category.neq.artwork");
  const { data: posts, error } = await q;
  if (error) throw error;
  if (!posts?.length) return [];
  const ids = posts.map(p => p.id);
  const { data: { user } } = await supabase.auth.getUser();
  const me = user?.id ?? null;
  const [profile, reactions, comments] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("reactions").select("post_id,user_id,type").in("post_id", ids),
    supabase.from("comments").select("post_id").in("post_id", ids).is("deleted_at", null),
  ]);
  const author = (profile.data as Profile) ?? null;
  const out: PostWithMeta[] = [];
  for (const p of posts) {
    const r = (reactions.data ?? []).filter(x => x.post_id === p.id);
    const signed = await signMediaUrls(p.media_urls ?? []);
    const signedCover = p.cover_url ? (await signMediaUrls([p.cover_url]))[0] ?? null : null;
    const signedScreens = (p as PostRow).screenshots?.length ? await signMediaUrls((p as PostRow).screenshots) : [];
    out.push({
      ...(p as PostRow),
      author,
      tags: [],
      likes: r.filter(x => x.type === "like").length,
      favorites: r.filter(x => x.type === "favorite").length,
      comments_count: (comments.data ?? []).filter(x => x.post_id === p.id).length,
      reposts_count: 0,
      my_like: !!me && r.some(x => x.user_id === me && x.type === "like"),
      my_favorite: !!me && r.some(x => x.user_id === me && x.type === "favorite"),
      my_repost: false,
      signed_media: signed,
      signed_cover: signedCover,
      signed_screenshots: signedScreens,
    });
  }
  return out;
}

// ---------- Banned emails ----------
export type BannedEmail = { id: string; email: string; reason: string | null; created_at: string; banned_by: string | null };

export async function listBannedEmails(): Promise<BannedEmail[]> {
  const { data, error } = await supabase.from("banned_emails").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as BannedEmail[];
}
export async function banEmail(email: string, reason?: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const clean = email.trim().toLowerCase();
  if (!clean) throw new Error("Email requerido");
  const { error } = await supabase.from("banned_emails").insert({ email: clean, reason: reason || null, banned_by: user.id });
  if (error) throw error;
}
export async function unbanEmail(id: string): Promise<void> {
  const { error } = await supabase.from("banned_emails").delete().eq("id", id);
  if (error) throw error;
}

// ============ POLLS ============
export async function votePoll(pollId: string, optionIndex: number): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  await supabase.from("post_poll_votes").delete().eq("poll_id", pollId).eq("user_id", user.id);
  const { error } = await supabase.from("post_poll_votes").insert({
    poll_id: pollId, user_id: user.id, option_index: optionIndex,
  });
  if (error) throw error;
}

// ============ PLUS FEATURES ============
export async function claimPlusOrbes(): Promise<{ ok: boolean; amount?: number; reason?: string; next_at?: string }> {
  const { data, error } = await supabase.rpc("claim_plus_orbes" as never);
  if (error) throw error;
  return (data as { ok: boolean; amount?: number; reason?: string; next_at?: string }) ?? { ok: false };
}

export async function updatePlusSettings(patch: {
  show_plus_badge?: boolean;
  avatar_frame?: string | null;
  social_links?: SocialLinks;
  name_effect?: string | null;
  profile_background?: string | null;
  post_effect?: string | null;
  creator_card_style?: CreatorCardStyle;
}): Promise<Profile> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const clean: Record<string, unknown> = {};
  if (patch.show_plus_badge !== undefined) clean.show_plus_badge = patch.show_plus_badge;
  if (patch.avatar_frame !== undefined) clean.avatar_frame = patch.avatar_frame;
  if (patch.social_links !== undefined) clean.social_links = patch.social_links;
  if (patch.name_effect !== undefined) clean.name_effect = patch.name_effect;
  if (patch.profile_background !== undefined) clean.profile_background = patch.profile_background;
  if (patch.post_effect !== undefined) clean.post_effect = patch.post_effect;
  if (patch.creator_card_style !== undefined) clean.creator_card_style = patch.creator_card_style;
  const { data, error } = await supabase.from("profiles").update(clean as never).eq("id", user.id).select().single();
  if (error) throw error;
  return data as Profile;
}

// Activate Plus for N months (extends expiry). Server function verifies auth.
export async function activatePlus(months: number = 1): Promise<{ ok: boolean; expires_at?: string }> {
  const { data, error } = await supabase.rpc("activate_plus" as never, { _months: months } as never);
  if (error) throw error;
  return (data as { ok: boolean; expires_at?: string }) ?? { ok: false };
}

// Dev-only helper to force-disable Plus (simulate expiration).
export async function togglePlusStatus(on: boolean): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const patch = on
    ? { is_plus: true }
    : { is_plus: false, plus_expires_at: new Date(Date.now() - 1000).toISOString() };
  await supabase.from("profiles").update(patch as never).eq("id", user.id);
}

// ============ MY GAMES for pinning ============
export async function fetchMyGamesLite(): Promise<{ id: string; title: string }[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase.from("posts")
    .select("id,content")
    .eq("author_id", user.id).eq("category", "game").is("deleted_at", null)
    .order("created_at", { ascending: false }).limit(50);
  return (data ?? []).map(p => ({
    id: p.id,
    title: (p.content.split("\n")[0] || "Juego").replace(/^🎮\s*/, "").trim() || "Juego",
  }));
}

// ============ ARTWORK GALLERY ============
export async function fetchArtworks(opts: { search?: string } = {}): Promise<PostWithMeta[]> {
  return fetchFeed({ ...opts, category: "artwork" });
}

export async function publishArtwork(input: {
  title: string;
  imageDataUrl: string;
  priceOrbes: number;
}): Promise<PostRow> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Convert data URL to File and upload
  const blob = dataUrlToBlob(input.imageDataUrl);
  const file = new File([blob], `${input.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "artwork"}.png`, {
    type: "image/png",
  });
  const path = await uploadMedia(file, user.id);

  const content = `🎨 ${input.title}`;
  const { data: post, error } = await supabase.from("posts").insert({
    author_id: user.id,
    content,
    media_urls: [path],
    media_type: "image",
    category: "artwork",
    price_orbes: Math.max(0, Math.floor(input.priceOrbes)),
    cover_url: null,
  } as never).select().single();
  if (error) throw error;
  return post as PostRow;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(",");
  const mime = parts[0].match(/:(.*?);/)?.[1] || "image/png";
  const raw = atob(parts[1]);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export async function purchaseArtwork(postId: string): Promise<{ ok: boolean; paid?: number; balance?: number; free?: boolean; already_owned?: boolean }> {
  const { data, error } = await supabase.rpc("purchase_artwork" as never, { _post_id: postId } as never);
  if (error) throw error;
  return (data as { ok: boolean; paid?: number; balance?: number; free?: boolean; already_owned?: boolean }) ?? { ok: false };
}

// ============ DOCUMENT upload helper ============
export async function uploadDocument(file: File): Promise<{ path: string; name: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const path = await uploadMedia(file, user.id);
  return { path, name: file.name };
}

// ============ EVENTS ============
export type EventItem = {
  id: string;
  title: string;
  description: string;
  banner_url: string | null;
  starts_at: string;
  ends_at: string;
  prize_pool: number | null;
  prize_description: string | null;
  rules: string | null;
  status: "upcoming" | "active" | "completed";
  created_by: string;
  created_at: string;
  submission_count?: number;
  participant_count?: number;
  my_submission?: { id: string; post_id: string; status: string } | null;
};

export async function fetchEvents(): Promise<EventItem[]> {
  const { data, error } = await supabase
    .from("events" as never)
    .select("*")
    .order("starts_at", { ascending: false });
  if (error) throw error;
  const now = new Date().toISOString();
  const { data: { user } } = await supabase.auth.getUser();
  const me = user?.id ?? null;
  const events = (data ?? []) as EventItem[];
  // Enrich with submission counts and my submissions
  const enriched: EventItem[] = [];
  for (const ev of events) {
    const { count: subs } = await supabase
      .from("event_submissions" as never)
      .select("*", { count: "exact", head: true })
      .eq("event_id", ev.id);
    const { count: parts } = await supabase
      .from("event_submissions" as never)
      .select("author_id", { count: "exact", head: true })
      .eq("event_id", ev.id);
    let mySub = null;
    if (me) {
      const { data: subData } = await supabase
        .from("event_submissions" as never)
        .select("id,post_id,status")
        .eq("event_id", ev.id)
        .eq("author_id", me)
        .maybeSingle();
      mySub = subData as { id: string; post_id: string; status: string } | null;
    }
    enriched.push({
      ...ev,
      submission_count: subs ?? 0,
      participant_count: parts ?? 0,
      my_submission: mySub,
    });
  }
  return enriched;
}

export async function createEvent(input: {
  title: string;
  description: string;
  banner_url?: string | null;
  starts_at: string;
  ends_at: string;
  prize_pool?: number | null;
  prize_description?: string | null;
  rules?: string | null;
}): Promise<EventItem> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("events" as never)
    .insert({
      title: input.title,
      description: input.description,
      banner_url: input.banner_url ?? null,
      starts_at: input.starts_at,
      ends_at: input.ends_at,
      prize_pool: input.prize_pool ?? null,
      prize_description: input.prize_description ?? null,
      rules: input.rules ?? null,
      created_by: user.id,
      status: new Date(input.starts_at) > new Date() ? "upcoming" : "active",
    } as never)
    .select()
    .single();
  if (error) throw error;
  return data as EventItem;
}

export async function submitToEvent(eventId: string, postId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { error } = await supabase
    .from("event_submissions" as never)
    .insert({
      event_id: eventId,
      post_id: postId,
      author_id: user.id,
      status: "submitted",
    } as never);
  if (error) throw error;
}

export async function updateEventStatus(eventId: string, status: "upcoming" | "active" | "completed"): Promise<void> {
  const { error } = await supabase
    .from("events" as never)
    .update({ status } as never)
    .eq("id", eventId);
  if (error) throw error;
}

export async function deleteEvent(eventId: string): Promise<void> {
  // RLS: solo el staff (admin) puede borrar eventos (política events_delete).
  const { error } = await supabase
    .from("events" as never)
    .delete()
    .eq("id", eventId);
  if (error) throw error;
}

// ============ FOLLOWS ============
export type FollowStats = { followers: number; following: number; i_follow: boolean };

export async function getFollowStats(userId: string): Promise<FollowStats> {
  const { data: { user } } = await supabase.auth.getUser();
  const [{ count: followers }, { count: following }, mine] = await Promise.all([
    supabase.from("follows" as never).select("*", { count: "exact", head: true }).eq("following_id", userId),
    supabase.from("follows" as never).select("*", { count: "exact", head: true }).eq("follower_id", userId),
    user && user.id !== userId
      ? supabase.from("follows" as never).select("id").eq("follower_id", user.id).eq("following_id", userId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  return { followers: followers ?? 0, following: following ?? 0, i_follow: !!(mine as { data: unknown }).data };
}

export async function followUser(userId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  if (user.id === userId) return;
  const { error } = await supabase.from("follows" as never).insert({ follower_id: user.id, following_id: userId } as never);
  if (error && !String(error.message).includes("duplicate")) throw error;
  // Avisa al seguido (solo una vez hasta que lo lea).
  void pushNotification({ userId, type: "follow" }).catch(() => {});
}

export async function unfollowUser(userId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("follows" as never).delete().eq("follower_id", user.id).eq("following_id", userId);
}

// Lista de perfiles que SIGUEN a userId (sus seguidores).
export async function fetchFollowers(userId: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("follows" as never)
    .select("follower_id")
    .eq("following_id", userId)
    .order("created_at", { ascending: false }) as { data: { follower_id: string }[] | null; error: unknown };
  if (error) return [];
  const ids = Array.from(new Set((data ?? []).map(r => r.follower_id)));
  if (!ids.length) return [];
  const { data: profiles } = await supabase.from("profiles").select("*").in("id", ids);
  const byId = new Map((profiles ?? []).map(p => [p.id, p as Profile]));
  return ids.map(id => byId.get(id)).filter((p): p is Profile => !!p);
}

// Lista de perfiles a los que SIGUE userId (su "siguiendo").
export async function fetchFollowing(userId: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("follows" as never)
    .select("following_id")
    .eq("follower_id", userId)
    .order("created_at", { ascending: false }) as { data: { following_id: string }[] | null; error: unknown };
  if (error) return [];
  const ids = Array.from(new Set((data ?? []).map(r => r.following_id)));
  if (!ids.length) return [];
  const { data: profiles } = await supabase.from("profiles").select("*").in("id", ids);
  const byId = new Map((profiles ?? []).map(p => [p.id, p as Profile]));
  return ids.map(id => byId.get(id)).filter((p): p is Profile => !!p);
}

