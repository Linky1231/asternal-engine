/**
 * Asternal API — Convex-backed
 * Maintains same exports for component compatibility.
 */
import { ConvexClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";

const CONVEX_URL = import.meta.env.VITE_CONVEX_URL ?? "https://default.convex.cloud";
const convex = new ConvexClient(CONVEX_URL);

// ════ TYPES ════

export type SocialLinks = { youtube?: string; tiktok?: string; instagram?: string; website?: string };
export type CreatorCardStyle = { theme?: "dark"|"light"|"neon"|"aurora"|"sunset"; accent?: string; tagline?: string };
export type QRStyle = { fg?: string; bg?: string; size?: number; cornerStyle?: "square"|"rounded"|"dots" };

export type Profile = {
  id: string; username: string; display_name: string | null; avatar_url: string | null;
  user_code?: string | null; bio: string | null; orbes?: number; is_plus?: boolean;
  show_plus_badge?: boolean; avatar_frame?: string | null; social_links?: SocialLinks | null;
  last_plus_claim_at?: string | null; banner_url?: string | null; pronouns?: string | null;
  location?: string | null; status_text?: string | null; status_emoji?: string | null;
  accent_color?: string | null; favorite_genre?: string | null; custom_title?: string | null;
  birthday?: string | null; show_orbes?: boolean; theme_mode?: string | null;
  featured_post_id?: string | null; interests?: string[] | null; plus_expires_at?: string | null;
  name_effect?: string | null; profile_background?: string | null; post_effect?: string | null;
  creator_card_style?: CreatorCardStyle | null; qr_style?: QRStyle | null; trust_points?: number | null;
  created_at?: string;
};

export function isPlusActive(_p: Profile | null | undefined): boolean { return true; }
export function daysUntilPlusExpires(p: Profile | null | undefined): number | null {
  if (!p?.plus_expires_at) return null;
  return Math.ceil((new Date(p.plus_expires_at).getTime() - Date.now()) / 86400000);
}

export type MediaType = "none"|"image"|"video"|"link";
export type PollData = { question: string; options: { label: string; votes: number }[]; myVote?: number };
export type PostRow = {
  id: string; author_id: string; content: string; media_urls: string[]; media_type: MediaType;
  link_url?: string|null; category?: string|null; cover_url?: string|null; screenshots: string[];
  game_genre?: string|null; allow_remix: boolean; price_orbes: number; text_color?: string|null;
  html_content?: string|null; document_paths: string[]; document_names: string[];
  pinned_game_id?: string|null; entrance_effect?: string|null; seller_id?: string|null;
  resale_price_orbes?: number|null; current_owner_id?: string|null; likes: number;
  comments_count: number; created_at: string; updated_at: string; deleted_at?: string|null;
};
export type PostWithMeta = PostRow & {
  author?: Profile|null; signed_media?: string[]; signed_cover?: string|null;
  is_repost?: boolean; repost_by?: Profile|null; repost_quote?: string|null;
  poll?: PollData|null; tags?: string[]; my_reaction?: string|null;
};
export type CommentRow = {
  id: string; post_id: string; author_id: string; parent_id?: string|null;
  content: string; created_at: string; updated_at: string; deleted_at?: string|null;
  author?: Profile|null;
};

// ════ HELPERS ════

function docToProfile(doc: any): Profile {
  if (!doc) return null as any;
  return {
    id: doc.userId ?? doc._id, username: doc.username, display_name: doc.displayName ?? null,
    avatar_url: doc.avatarUrl ?? null, user_code: doc.userCode ?? null, bio: doc.bio ?? null,
    orbes: doc.orbes ?? 0, is_plus: doc.isPlus ?? false, show_plus_badge: doc.showPlusBadge ?? false,
    avatar_frame: doc.avatarFrame ?? null, social_links: doc.socialLinks ?? null,
    last_plus_claim_at: doc.lastPlusClaimAt ? new Date(doc.lastPlusClaimAt).toISOString() : null,
    banner_url: doc.bannerUrl ?? null, pronouns: doc.pronouns ?? null, location: doc.location ?? null,
    status_text: doc.statusText ?? null, status_emoji: doc.statusEmoji ?? null,
    accent_color: doc.accentColor ?? null, favorite_genre: doc.favoriteGenre ?? null,
    custom_title: doc.customTitle ?? null, birthday: doc.birthday ?? null,
    show_orbes: doc.showOrbes ?? true, theme_mode: doc.themeMode ?? "dark",
    featured_post_id: doc.featuredPostId ?? null, interests: doc.interests ?? [],
    plus_expires_at: doc.plusExpiresAt ? new Date(doc.plusExpiresAt).toISOString() : null,
    name_effect: doc.nameEffect ?? null, profile_background: doc.profileBackground ?? null,
    post_effect: doc.postEffect ?? null, creator_card_style: doc.creatorCardStyle ?? null,
    qr_style: doc.qrStyle ?? null, trust_points: doc.trustPoints ?? 10,
    created_at: doc.createdAt ? new Date(doc.createdAt).toISOString() : undefined,
  };
}

function docToPost(doc: any): PostRow {
  if (!doc) return null as any;
  return {
    id: doc._id, author_id: doc.authorId, content: doc.content ?? "",
    media_urls: doc.mediaUrls ?? [], media_type: (doc.mediaType ?? "none") as MediaType,
    link_url: doc.linkUrl ?? null, category: doc.category ?? null,
    cover_url: doc.coverUrl ?? null, screenshots: doc.screenshots ?? [],
    game_genre: doc.gameGenre ?? null, allow_remix: doc.allowRemix ?? true,
    price_orbes: doc.priceOrbes ?? 0, text_color: doc.textColor ?? null,
    html_content: doc.htmlContent ?? null, document_paths: doc.documentPaths ?? [],
    document_names: doc.documentNames ?? [], pinned_game_id: doc.pinnedGameId ?? null,
    entrance_effect: doc.entranceEffect ?? null, seller_id: doc.sellerId ?? null,
    resale_price_orbes: doc.resalePriceOrbes ?? null, current_owner_id: doc.currentOwnerId ?? null,
    likes: doc.likes ?? 0, comments_count: doc.commentsCount ?? 0,
    created_at: new Date(doc.createdAt).toISOString(),
    updated_at: new Date(doc.updatedAt).toISOString(),
    deleted_at: doc.deletedAt ? new Date(doc.deletedAt).toISOString() : null,
  };
}

async function getMeId(): Promise<string | null> {
  try { const p = await convex.query(api.profiles.getMyProfile, {}); return p?.userId ?? null; }
  catch { return null; }
}

// ════ STORAGE ════

export async function signMediaUrls(paths: string[]): Promise<string[]> { return paths.filter(Boolean); }

export async function uploadMedia(file: File, userId: string): Promise<string> {
  const uploadUrl = await convex.mutation(api.storage.generateUploadUrl, {});
  const result = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": file.type }, body: file });
  const { storageId } = await result.json();
  const resp = await convex.mutation(api.storage.saveFile, { storageId, userId, purpose: "media" });
  return resp.url ?? String(storageId);
}

export async function uploadDocument(file: File): Promise<{ path: string; name: string }> {
  const uploadUrl = await convex.mutation(api.storage.generateUploadUrl, {});
  const result = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": file.type }, body: file });
  const { storageId } = await result.json();
  const url = await convex.query(api.storage.getFileUrl, { storageId });
  return { path: url ?? String(storageId), name: file.name };
}

// ════ FEED ════

export async function fetchFeed(opts: { search?: string; tag?: string; category?: string; includeGames?: boolean } = {}): Promise<PostWithMeta[]> {
  const raw = await convex.query(api.posts.getFeed, { limit: 50 });
  const myId = await getMeId();
  const posts: PostWithMeta[] = [];
  for (const doc of raw) {
    const post = docToPost(doc) as PostWithMeta;
    if (opts.category && post.category !== opts.category) continue;
    if (opts.search && !post.content.toLowerCase().includes(opts.search.toLowerCase())) continue;
    post.author = docToProfile(await convex.query(api.profiles.getByUserId, { userId: post.author_id }));
    if (myId) post.my_reaction = await convex.query(api.posts.hasLiked, { userId: myId, postId: post.id }) ? "like" : null;
    posts.push(post);
  }
  return posts;
}

export async function createPost(input: {
  content: string; files?: File[]; coverFile?: File; screenshotFiles?: File[];
  category?: string; text_color?: string; html_content?: string; link_url?: string;
}): Promise<string> {
  const meId = await getMeId(); if (!meId) throw new Error("Not authenticated");
  const mediaUrls: string[] = [];
  if (input.files) for (const f of input.files) mediaUrls.push(await uploadMedia(f, meId));
  let coverUrl: string | undefined;
  if (input.coverFile) coverUrl = await uploadMedia(input.coverFile, meId);
  const screenshots: string[] = [];
  if (input.screenshotFiles) for (const f of input.screenshotFiles) screenshots.push(await uploadMedia(f, meId));
  return convex.mutation(api.posts.create, {
    authorId: meId, content: input.content, mediaUrls,
    mediaType: mediaUrls.length ? (mediaUrls[0]?.includes("video") ? "video" : "image") : "none",
    category: input.category, coverUrl, screenshots, textColor: input.text_color,
    htmlContent: input.html_content, linkUrl: input.link_url,
  });
}

export async function updatePost(id: string, patch: { content?: string; category?: string | null }) {
  await convex.mutation(api.posts.update, { postId: id, patch });
}
export async function deletePost(id: string) { await convex.mutation(api.posts.softDelete, { postId: id }); }
export async function toggleReaction(opts: { postId?: string; commentId?: string; type: "like" | "favorite" }) {
  const meId = await getMeId(); if (!meId) throw new Error("Not authenticated");
  if (opts.postId) await convex.mutation(api.posts.toggleLike, { userId: meId, postId: opts.postId });
}
export async function toggleRepost(postId: string, quote?: string) {
  const meId = await getMeId(); if (!meId) throw new Error("Not authenticated");
  await convex.mutation(api.posts.toggleRepost, { userId: meId, postId, quote });
}
export async function fetchComments(postId: string): Promise<CommentRow[]> {
  const raw = await convex.query(api.posts.getComments, { postId });
  return raw.map((d: any) => ({
    id: d._id, post_id: d.postId, author_id: d.authorId, parent_id: d.parentId,
    content: d.content, created_at: new Date(d.createdAt).toISOString(),
    updated_at: new Date(d.updatedAt).toISOString(),
    deleted_at: d.deletedAt ? new Date(d.deletedAt).toISOString() : null, author: null,
  }));
}
export async function addComment(postId: string, content: string, parentId?: string) {
  const meId = await getMeId(); if (!meId) throw new Error("Not authenticated");
  await convex.mutation(api.posts.addComment, { postId, authorId: meId, content, parentId });
}
export async function deleteComment(_id: string) {}
export async function reportContent(opts: { postId?: string; commentId?: string; reason: string }) {
  const meId = await getMeId(); if (!meId) throw new Error("Not authenticated");
  await convex.mutation(api.social.createReport, { reporterId: meId, postId: opts.postId, commentId: opts.commentId, reason: opts.reason });
}
export async function blockUser(blockedId: string) {
  const meId = await getMeId(); if (!meId) throw new Error("Not authenticated");
  await convex.mutation(api.social.blockUser, { blockerId: meId, blockedId });
}

// ════ NOTIFICATIONS ════

export type NotifType = "comment"|"reply"|"reaction"|"repost"|"mention"|"follow"|"like"|"favorite"|"game";
export async function pushNotification(_opts: { user_id: string; type: NotifType; post_id?: string; comment_id?: string }) {}
export async function fetchNotifications() {
  const meId = await getMeId(); return meId ? convex.query(api.social.getNotifications, { userId: meId }) : [];
}
export async function markNotificationsRead() {
  const meId = await getMeId(); if (meId) await convex.mutation(api.social.markAllRead, { userId: meId });
}
export async function countUnreadNotifications(): Promise<number> {
  const meId = await getMeId(); return meId ? convex.query(api.social.countUnread, { userId: meId }) : 0;
}
export async function fetchAllNotifications() { return fetchNotifications(); }

// ════ PROFILES ════

export async function getMyProfile(): Promise<Profile | null> { return docToProfile(await convex.query(api.profiles.getMyProfile, {})); }
export async function isMod(): Promise<boolean> { const meId = await getMeId(); return meId ? (await convex.query(api.profiles.getRole, { userId: meId })).some(r => r === "admin" || r === "moderator") : false; }
export async function isAdmin(): Promise<boolean> { const meId = await getMeId(); return meId ? (await convex.query(api.profiles.getRole, { userId: meId })).includes("admin") : false; }

export async function updateMyProfile(patch: { display_name?: string; bio?: string; pronouns?: string; location?: string; status_text?: string; status_emoji?: string; accent_color?: string; favorite_genre?: string; custom_title?: string; birthday?: string; show_orbes?: boolean; theme_mode?: string; interests?: string[]; social_links?: SocialLinks; show_plus_badge?: boolean; avatar_frame?: string | null; name_effect?: string | null; profile_background?: string | null; post_effect?: string | null; creator_card_style?: CreatorCardStyle; qr_style?: QRStyle | null }) {
  const meId = await getMeId(); if (!meId) throw new Error("Not authenticated");
  const cp: Record<string, unknown> = {};
  const map: [string, string][] = [["display_name","displayName"],["bio","bio"],["pronouns","pronouns"],["location","location"],["status_text","statusText"],["status_emoji","statusEmoji"],["accent_color","accentColor"],["favorite_genre","favoriteGenre"],["custom_title","customTitle"],["birthday","birthday"],["show_orbes","showOrbes"],["theme_mode","themeMode"],["interests","interests"],["social_links","socialLinks"],["show_plus_badge","showPlusBadge"],["avatar_frame","avatarFrame"],["name_effect","nameEffect"],["profile_background","profileBackground"],["post_effect","postEffect"],["creator_card_style","creatorCardStyle"],["qr_style","qrStyle"]];
  for (const [src, dst] of map) { if ((patch as any)[src] !== undefined) (cp as any)[dst] = (patch as any)[src]; }
  await convex.mutation(api.profiles.updateProfile, { userId: meId, patch: cp });
}

export async function updatePlusSettings(patch: { show_plus_badge?: boolean; avatar_frame?: string | null; social_links?: SocialLinks; name_effect?: string | null; profile_background?: string | null; post_effect?: string | null; creator_card_style?: CreatorCardStyle; qr_style?: QRStyle | null }): Promise<Profile> { await updateMyProfile(patch); return (await getMyProfile())!; }

export async function fetchProfileById(userId: string): Promise<Profile | null> { return docToProfile(await convex.query(api.profiles.getByUserId, { userId })); }
export async function fetchUserPosts(userId: string, opts: { games?: boolean; artwork?: boolean } = {}): Promise<PostWithMeta[]> { const category = opts.games ? "game" : opts.artwork ? "artwork" : undefined; return (await convex.query(api.posts.getByAuthor, { authorId: userId, category, limit: 50 })).map(docToPost) as PostWithMeta[]; }
export async function fetchUserGames(userId: string): Promise<PostWithMeta[]> { return fetchUserPosts(userId, { games: true }); }

// ════ GAMES ════

export const GAME_GENRES = ["Acción","Aventura","Puzzle","RPG","Estrategia","Deportes","Carreras","Simulación","Terror","Plataformas","Retro","Casual"];

export async function publishGame(input: { title: string; description: string; files?: File[]; coverFile?: File; screenshotFiles?: File[]; genre?: string; price_orbes?: number }): Promise<string> { return createPost({ content: `🎮 ${input.title}\n\n${input.description}`, files: input.files, coverFile: input.coverFile, screenshotFiles: input.screenshotFiles, category: "game" }); }
export async function updateGame(postId: string, input: { title?: string; description?: string; genre?: string; price_orbes?: number }) { if (input.title || input.description) await convex.mutation(api.posts.update, { postId, patch: { content: `🎮 ${input.title}\n\n${input.description ?? ""}` } }); }
export async function purchaseGame(postId: string): Promise<{ ok: boolean; paid?: number; balance?: number; free?: boolean; already_owned?: boolean }> { const meId = await getMeId(); if (!meId) throw new Error("Not authenticated"); return convex.mutation(api.commerce.purchaseGame, { postId, buyerId: meId }); }
export async function recordGamePlay(postId: string): Promise<void> { const meId = await getMeId(); await convex.mutation(api.posts.recordPlay, { userId: meId ?? undefined, postId }); }
export async function fetchGamePlayCounts24h(_ids: string[]): Promise<{ counts: Record<string, number>; cloud: boolean }> { return { counts: {}, cloud: true }; }
export async function remixGame(post: PostWithMeta): Promise<{ cloudId: string; name: string }> { const id = await createPost({ content: `🎮 Remix: ${post.content.split("\n")[0] ?? "Untitled"}`, category: "game" }); return { cloudId: id, name: post.content.split("\n")[0] ?? "Untitled" }; }
export async function loadGameProject(url: string): Promise<unknown> { return (await fetch(url)).json(); }

// ════ CLOUD PROJECTS ════

export type CloudProject = { id: string; name: string; data: unknown; updated_at: string };
export async function cloudListProjects(): Promise<CloudProject[]> { return []; }
export async function cloudSaveProject(i: { id?: string; name: string; data: unknown }): Promise<CloudProject> { return { id: i.id ?? "local", name: i.name, data: i.data, updated_at: new Date().toISOString() }; }
export async function cloudDeleteProject(_id: string): Promise<void> {}

// ════ MODERATION ════

export type ManagedUser = { id: string; username: string; display_name: string | null; avatar_url: string | null; is_mod: boolean; is_admin: boolean; trust_points: number | null };
export async function listManagedUsers(search?: string): Promise<ManagedUser[]> { const results = await convex.query(api.profiles.search, { query: search ?? "" }); return Promise.all(results.map(async u => { const roles = await convex.query(api.profiles.getRole, { userId: u.userId }); return { id: u.userId, username: u.username, display_name: u.displayName ?? null, avatar_url: u.avatarUrl ?? null, is_mod: roles.includes("moderator"), is_admin: roles.includes("admin"), trust_points: u.trustPoints ?? 10 }; })); }
export async function setUserModerator(_userId: string, _on: boolean): Promise<void> {}

// ════ TRUST POINTS ════

export const DEFAULT_TRUST_POINTS = 10;
export async function getTrustPoints(userId: string): Promise<number> { return (await convex.query(api.profiles.getByUserId, { userId }))?.trustPoints ?? 10; }
export async function deductTrustPoints(userId: string, amount: number, reason: string): Promise<{ newPoints: number; banned: boolean }> { const meId = await getMeId(); if (!meId) throw new Error("Not authenticated"); return convex.mutation(api.profiles.deductTrustPoints, { userId, modifierId: meId, amount, reason }); }
export async function restoreTrustPoints(userId: string, amount: number): Promise<number> { const meId = await getMeId(); if (!meId) throw new Error("Not authenticated"); return convex.mutation(api.profiles.restoreTrustPoints, { userId, modifierId: meId, amount }); }
export type TrustHistoryEntry = { id: string; user_id: string; modifier_id: string | null; action: string; amount: number; reason: string; points_before: number; points_after: number; created_at: string };
export async function fetchTrustHistory(userId: string): Promise<TrustHistoryEntry[]> { return (await convex.query(api.profiles.getTrustHistory, { userId })).map((d: any) => ({ id: d._id, user_id: d.userId, modifier_id: d.modifierId ?? null, action: d.action, amount: d.amount, reason: d.reason, points_before: d.pointsBefore, points_after: d.pointsAfter, created_at: new Date(d.createdAt).toISOString() })); }

// ════ POLLS ════
export async function votePoll(_pollId: string, _idx: number): Promise<void> {}

// ════ PLUS ════

export async function claimPlusOrbes(): Promise<{ ok: boolean; amount?: number; reason?: string; next_at?: string }> { const meId = await getMeId(); if (!meId) throw new Error("Not authenticated"); return convex.mutation(api.commerce.claimPlusOrbes, { userId: meId }) as any; }
export async function activatePlus(_months: number = 1): Promise<{ ok: boolean; expires_at?: string }> { return { ok: true }; }
export async function togglePlusStatus(on: boolean): Promise<void> { const meId = await getMeId(); if (meId) await convex.mutation(api.profiles.updateProfile, { userId: meId, patch: { isPlus: on } }); }
export async function fetchMyGamesLite(): Promise<{ id: string; title: string }[]> { const meId = await getMeId(); return meId ? (await convex.query(api.posts.getByAuthor, { authorId: meId, category: "game", limit: 50 })).map((d: any) => ({ id: d._id, title: d.content.split("\n")[0]?.replace(/^🎮\s*/, "") ?? "Untitled" })) : []; }

// ════ ARTWORKS ════

export async function fetchArtworks(_opts: { search?: string } = {}): Promise<PostWithMeta[]> { return (await convex.query(api.posts.getGames, { category: "artwork", limit: 50 })).map(docToPost) as PostWithMeta[]; }
export async function publishArtwork(input: { title: string; description: string; files?: File[]; coverFile?: File; price_orbes?: number }): Promise<string> { return createPost({ content: `🎨 ${input.title}\n\n${input.description}`, files: input.files, coverFile: input.coverFile, category: "artwork" }); }
export async function purchaseArtwork(postId: string) { return purchaseGame(postId); }
export async function resellArtwork(postId: string, price: number) { const meId = await getMeId(); if (!meId) throw new Error("Not authenticated"); return convex.mutation(api.commerce.resellArtwork, { postId, userId: meId, price }); }
export async function fetchMyArtworks(): Promise<PostWithMeta[]> { return fetchUserPosts((await getMeId()) ?? "", { artwork: true }); }

// ════ EVENTS ════

export type EventItem = { id: string; title: string; description: string; banner_url: string | null; starts_at: string; ends_at: string; prize_pool: number | null; prize_description: string | null; rules: string | null; status: string; created_by: string | null; created_at: string };
export async function fetchEvents(): Promise<EventItem[]> { return (await convex.query(api.commerce.getEvents, {})).map((d: any) => ({ id: d._id, title: d.title, description: d.description, banner_url: d.bannerUrl ?? null, starts_at: new Date(d.startsAt).toISOString(), ends_at: new Date(d.endsAt).toISOString(), prize_pool: d.prizePool ?? null, prize_description: d.prizeDescription ?? null, rules: d.rules ?? null, status: d.status, created_by: d.createdBy ?? null, created_at: new Date(d.createdAt).toISOString() })); }
export async function createEvent(_input: any): Promise<string> { return ""; }
export async function submitToEvent(_eid: string, _pid: string): Promise<void> {}
export async function updateEventStatus(_eid: string, _s: string): Promise<void> {}
export async function deleteEvent(_eid: string): Promise<void> {}
export type EventParticipant = { user_id: string; display_name: string | null; username: string; avatar_url: string | null; joined_at: string };
export async function joinEvent(eventId: string): Promise<void> { const meId = await getMeId(); if (!meId) throw new Error("Not authenticated"); await convex.mutation(api.commerce.joinEvent, { eventId, userId: meId }); }
export async function leaveEvent(eventId: string): Promise<void> { const meId = await getMeId(); if (!meId) throw new Error("Not authenticated"); await convex.mutation(api.commerce.leaveEvent, { eventId, userId: meId }); }
export async function listEventParticipants(_eid: string): Promise<EventParticipant[]> { return []; }

// ════ FOLLOWS ════

export type FollowStats = { followers: number; following: number; i_follow: boolean };
export async function getFollowStats(userId: string): Promise<FollowStats> { const meId = await getMeId(); return convex.query(api.social.getFollowStats, { userId, myId: meId ?? undefined }); }
export async function followUser(userId: string): Promise<void> { const meId = await getMeId(); if (!meId) throw new Error("Not authenticated"); await convex.mutation(api.social.toggleFollow, { followerId: meId, followingId: userId }); }
export async function unfollowUser(userId: string): Promise<void> { return followUser(userId); }
export async function fetchFollowers(userId: string): Promise<Profile[]> { return (await convex.query(api.social.getFollowers, { userId })).map(docToProfile); }
export async function fetchFollowing(userId: string): Promise<Profile[]> { return (await convex.query(api.social.getFollowing, { userId })).map(docToProfile); }

// ════ BANNED ════

export type BannedEmail = { id: string; email: string; reason: string | null; created_at: string; banned_by: string | null };
export async function listBannedEmails(): Promise<BannedEmail[]> { return []; }
export async function banEmail(_email: string, _reason?: string): Promise<void> {}
export async function unbanEmail(_id: string): Promise<void> {}

// ════ AUTH compatibility ════

export { convex as supabase };
