/**
 * Forum storage — Asternal
 * Sistema de foros con hilos, categorías y comentarios anidados.
 * Todo almacenado en localStorage.
 */

import { uid } from "@/lib/engine/core";

/* ─── Types ─── */

export interface ForumCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  sortOrder: number;
  threadCount: number;
  createdAt: string;
}

export interface ForumThread {
  id: string;
  categoryId: string;
  title: string;
  content: string;
  authorId: string;
  authorUsername: string;
  tags: string[];
  upvotes: number;
  downvotes: number;
  mediaUrls: string[];
  mediaType: "image" | "video" | "none";
  documentUrls: string[];
  documentNames: string[];
  pinned: boolean;
  closed: boolean;
  solutionPostId: string | null;
  views: number;
  postCount: number;
  createdAt: string;
  updatedAt: string;
  lastPostAt: string;
  lastPostAuthor: string;
}

export interface ForumThreadVote {
  threadId: string;
  userId: string;
  vote: "up" | "down";
}

export interface ForumPost {
  id: string;
  threadId: string;
  content: string;
  authorId: string;
  authorUsername: string;
  parentPostId: string | null;
  quotePostId: string | null;
  quoteContent: string | null;
  quoteAuthor: string | null;
  upvotes: number;
  downvotes: number;
  myVote: "up" | "down" | null;
  createdAt: string;
  editedAt: string | null;
}

export interface ForumVote {
  postId: string;
  userId: string;
  vote: "up" | "down";
}

/* ─── Available tags ─── */

export const FORUM_TAGS = [
  "Programación",
  "IA",
  "UI",
  "Pixel Art",
  "Música",
  "Física",
  "Animación",
  "Assets",
  "Publicación",
  "Render",
  "General",
] as const;

/* ─── Auto-tagging ─── */

const TAG_KEYWORDS: Record<string, string[]> = {
  "Programación": ["código", "programar", "script", "javascript", "typescript", "función", "variable", "bucle", "condición", "lógica", "algoritmo", "depurar", "debug", "compilar", "api", "backend", "frontend", "librería"],
  "IA": ["inteligencia artificial", "ai", "machine learning", "aprendizaje", "gpt", "claude", "gemini", "modelo", "red neuronal", "prompt", "entrenar", "clasificar", "predicción", "automático"],
  "UI": ["interfaz", "botón", "menú", "pantalla", "diseño", "ui", "ux", "usuario", "layout", "componente", "responsive", "css", "html", "tema", "oscuro", "claro"],
  "Pixel Art": ["pixel", "arte", "sprite", "gráfico", "dibujo", "spritesheet", "tileset", "resolución", "paleta", "color", "png", "animación sprite", "personaje pixel"],
  "Música": ["música", "sonido", "audio", "melodía", "canción", "efecto de sonido", "sfx", "bso", "banda sonora", "instrumento", "nota", "volumen", "reproducir"],
  "Física": ["física", "gravedad", "colisión", "movimiento", "velocidad", "aceleración", "fuerza", "impulso", "rebote", "detección", "hitbox", "cuerpo rígido", "simulación"],
  "Animación": ["animación", "animar", "keyframe", "cuadro", "frame", "transición", "interpolación", "easing", "esqueleto", "rig", "walk", "idle", "run", "salto"],
  "Assets": ["asset", "recurso", "imagen", "modelo", "pack", "kit", "descargar", "textura", "material", "fuente", "icono", "logos", "prefab"],
  "Publicación": ["publicar", "lanzar", "subir", "compartir", "exportar", "build", "compilar", "distribuir", "app store", "google play", "itch", "steam", "web", "desplegar"],
  "Render": ["render", "renderizar", "efecto", "visual", "shader", "iluminación", "sombra", "partícula", "postprocess", "glow", "blur", "filtro", "cámara", "3d", "perspectiva"],
};

const DEFAULT_TAGS = ["General"];

function normalize(text: string): string {
  return text.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[^a-z0-9\s]/g, " ");
}

export function autoDetectTags(title: string, content: string): string[] {
  const combined = normalize(title + " " + content);
  const found = new Set<string>();

  for (const [tag, keywords] of Object.entries(TAG_KEYWORDS)) {
    for (const kw of keywords) {
      if (combined.includes(kw)) {
        found.add(tag);
        break;
      }
    }
    if (found.size >= 4) break;
  }

  return found.size > 0 ? Array.from(found) : [...DEFAULT_TAGS];
}

/* ─── Keys ─── */

const KEYS = {
  categories: "_forum_categories",
  threads: "_forum_threads",
  posts: "_forum_posts",
  votes: "_forum_votes",
  threadVotes: "_forum_thread_votes",
};

function read<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; }
  catch { return fallback; }
}
function write<T>(key: string, data: T) {
  localStorage.setItem(key, JSON.stringify(data));
}

/* ─── Categories ─── */

export function getDefaultCategories(): ForumCategory[] {
  return [
    { id: "general",    name: "General",      description: "Charlas, anuncios y temas generales de la comunidad", icon: "globe", sortOrder: 0, threadCount: 0, createdAt: new Date(0).toISOString() },
    { id: "help",       name: "Ayuda",         description: "Dudas sobre el editor, scripts, física y más",          icon: "life-buoy", sortOrder: 1, threadCount: 0, createdAt: new Date(0).toISOString() },
    { id: "showcase",   name: "Showcase",      description: "Comparte tus juegos, arte y creaciones",               icon: "trophy", sortOrder: 2, threadCount: 0, createdAt: new Date(0).toISOString() },
    { id: "feedback",   name: "Feedback",       description: "Sugerencias y mejoras para Asternal",                  icon: "message-circle-more", sortOrder: 3, threadCount: 0, createdAt: new Date(0).toISOString() },
    { id: "offtopic",   name: "Off-Topic",      description: "Todo lo demás: memes, música, charla libre",           icon: "coffee", sortOrder: 4, threadCount: 0, createdAt: new Date(0).toISOString() },
  ];
}

export function initForumCategories(): ForumCategory[] {
  let cats = read<ForumCategory[]>(KEYS.categories, []);
  if (cats.length === 0) {
    cats = getDefaultCategories();
    write(KEYS.categories, cats);
  }
  return cats;
}

export function getForumCategories(): ForumCategory[] {
  return read<ForumCategory[]>(KEYS.categories, getDefaultCategories());
}

export function createForumCategory(name: string, description: string, icon: string): ForumCategory {
  const cats = read<ForumCategory[]>(KEYS.categories, getDefaultCategories());
  const maxOrder = cats.reduce((max, c) => Math.max(max, c.sortOrder), 0);
  const cat: ForumCategory = {
    id: uid(),
    name: name.trim(),
    description: description.trim(),
    icon: icon || "globe",
    sortOrder: maxOrder + 1,
    threadCount: 0,
    createdAt: new Date().toISOString(),
  };
  cats.push(cat);
  write(KEYS.categories, cats);
  return cat;
}

export function deleteForumCategory(categoryId: string): boolean {
  const defaultIds = getDefaultCategories().map(c => c.id);
  if (defaultIds.includes(categoryId)) return false; // can't delete defaults
  let cats = read<ForumCategory[]>(KEYS.categories, getDefaultCategories());
  cats = cats.filter(c => c.id !== categoryId);
  write(KEYS.categories, cats);
  // Delete all threads in this category
  const threads = read<ForumThread[]>(KEYS.threads, []);
  const deletedThreads = threads.filter(t => t.categoryId === categoryId);
  const deletedIds = new Set(deletedThreads.map(t => t.id));
  const remaining = threads.filter(t => t.categoryId !== categoryId);
  write(KEYS.threads, remaining);
  // Delete all posts in those threads
  const posts = read<ForumPost[]>(KEYS.posts, []);
  write(KEYS.posts, posts.filter(p => !deletedIds.has(p.threadId)));
  return true;
}

/* ─── Threads ─── */

export function getForumThreads(categoryId?: string): ForumThread[] {
  const threads = read<ForumThread[]>(KEYS.threads, []);
  let filtered = categoryId ? threads.filter(t => t.categoryId === categoryId) : threads;
  // Hot algorithm: score = postCount*3 + views*1 + upvotes_weighted, decayed by age
  // Pinned always first
  return filtered.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return getThreadHotScore(b) - getThreadHotScore(a);
  });
}

function getThreadHotScore(t: ForumThread): number {
  const posts = read<ForumPost[]>(KEYS.posts, []);
  const threadPosts = posts.filter(p => p.threadId === t.id);
  const totalPostUpvotes = threadPosts.reduce((s, p) => s + p.upvotes, 0);
  const totalPostDownvotes = threadPosts.reduce((s, p) => s + p.downvotes, 0);
  const interactions = t.postCount * 5 + t.views + (totalPostUpvotes + t.upvotes) * 3 - (totalPostDownvotes + t.downvotes);
  const ageHours = Math.max(1, (Date.now() - new Date(t.createdAt).getTime()) / 3600000);
  return Math.round(interactions / Math.pow(ageHours + 2, 0.6));
}

export function searchForumThreads(query: string, categoryId?: string): ForumThread[] {
  if (!query.trim()) return getForumThreads(categoryId);
  const q = query.toLowerCase().trim();
  const threads = read<ForumThread[]>(KEYS.threads, []);
  let filtered = categoryId ? threads.filter(t => t.categoryId === categoryId) : threads;
  return filtered
    .filter(t => t.title.toLowerCase().includes(q) || t.content.toLowerCase().includes(q))
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return getThreadHotScore(b) - getThreadHotScore(a);
    });
}

export function getForumThreadsWithVotes(categoryId?: string, userId?: string | null): (ForumThread & { myVote: "up" | "down" | null })[] {
  const threads = getForumThreads(categoryId);
  const threadVotes = userId ? read<ForumThreadVote[]>(KEYS.threadVotes, []).filter(v => v.userId === userId) : [];
  return threads.map(t => ({
    ...t,
    myVote: (threadVotes.find(v => v.threadId === t.id)?.vote ?? null) as "up" | "down" | null,
  }));
}

export function getForumThread(threadId: string): (ForumThread & { myVote: "up" | "down" | null }) | null {
  const threads = read<ForumThread[]>(KEYS.threads, []);
  const t = threads.find(th => th.id === threadId) ?? null;
  if (!t) return null;
  const threadVotes = read<ForumThreadVote[]>(KEYS.threadVotes, []);
  return {
    ...t,
    myVote: (threadVotes.find(v => v.threadId === t.id)?.vote ?? null) as "up" | "down" | null,
  };
}

export function voteForumThread(threadId: string, userId: string, vote: "up" | "down"): { upvotes: number; downvotes: number } {
  const threads = read<ForumThread[]>(KEYS.threads, []);
  const thread = threads.find(t => t.id === threadId);
  if (!thread) return { upvotes: 0, downvotes: 0 };

  let votes = read<ForumThreadVote[]>(KEYS.threadVotes, []);
  const existing = votes.find(v => v.threadId === threadId && v.userId === userId);

  if (existing) {
    if (existing.vote === "up") thread.upvotes = Math.max(0, thread.upvotes - 1);
    if (existing.vote === "down") thread.downvotes = Math.max(0, thread.downvotes - 1);
    votes = votes.filter(v => !(v.threadId === threadId && v.userId === userId));
  }

  if (existing?.vote === vote) {
    write(KEYS.threads, threads);
    write(KEYS.threadVotes, votes);
    return { upvotes: thread.upvotes, downvotes: thread.downvotes };
  }

  votes.push({ threadId, userId, vote });
  if (vote === "up") thread.upvotes += 1;
  if (vote === "down") thread.downvotes += 1;
  write(KEYS.threads, threads);
  write(KEYS.threadVotes, votes);
  return { upvotes: thread.upvotes, downvotes: thread.downvotes };
}

export function createForumThread(
  categoryId: string,
  title: string,
  content: string,
  author: { id: string; username: string },
  tags?: string[],
  media?: { mediaUrls: string[]; mediaType: "image" | "video" | "none"; documentUrls: string[]; documentNames: string[] },
): ForumThread {
  const autoTags = autoDetectTags(title, content);
  const finalTags = tags && tags.length > 0 ? tags.slice(0, 4) : autoTags;
  const now = new Date().toISOString();
  const thread: ForumThread = {
    id: uid(),
    categoryId,
    title: title.trim(),
    content: content.trim(),
    authorId: author.id,
    authorUsername: author.username,
    tags: finalTags,
    upvotes: 0,
    downvotes: 0,
    mediaUrls: media?.mediaUrls ?? [],
    mediaType: media?.mediaType ?? "none",
    documentUrls: media?.documentUrls ?? [],
    documentNames: media?.documentNames ?? [],
    pinned: false,
    closed: false,
    solutionPostId: null,
    views: 0,
    postCount: 0,
    createdAt: now,
    updatedAt: now,
    lastPostAt: now,
    lastPostAuthor: author.username,
  };
  const threads = read<ForumThread[]>(KEYS.threads, []);
  threads.push(thread);
  write(KEYS.threads, threads);

  // Update thread count in category
  const cats = read<ForumCategory[]>(KEYS.categories, getDefaultCategories());
  const cat = cats.find(c => c.id === categoryId);
  if (cat) { cat.threadCount = threads.filter(t => t.categoryId === categoryId).length; }
  write(KEYS.categories, cats);

  // Create initial post
  createForumPost(thread.id, content, author);

  return thread;
}

export function incrementThreadView(threadId: string) {
  const threads = read<ForumThread[]>(KEYS.threads, []);
  const t = threads.find(th => th.id === threadId);
  if (t) { t.views += 1; write(KEYS.threads, threads); }
}

/* ─── Solutions ─── */

export function markAsSolution(threadId: string, postId: string): boolean {
  const threads = read<ForumThread[]>(KEYS.threads, []);
  const t = threads.find(th => th.id === threadId);
  if (!t) return false;
  t.solutionPostId = postId;
  write(KEYS.threads, threads);
  return true;
}

export function unmarkSolution(threadId: string): boolean {
  const threads = read<ForumThread[]>(KEYS.threads, []);
  const t = threads.find(th => th.id === threadId);
  if (!t) return false;
  t.solutionPostId = null;
  write(KEYS.threads, threads);
  return true;
}

export function togglePinThread(threadId: string): boolean {
  const threads = read<ForumThread[]>(KEYS.threads, []);
  const t = threads.find(th => th.id === threadId);
  if (!t) return false;
  t.pinned = !t.pinned;
  write(KEYS.threads, threads);
  return t.pinned;
}

export function toggleCloseThread(threadId: string): boolean {
  const threads = read<ForumThread[]>(KEYS.threads, []);
  const t = threads.find(th => th.id === threadId);
  if (!t) return false;
  t.closed = !t.closed;
  write(KEYS.threads, threads);
  return t.closed;
}

export function deleteForumThread(threadId: string) {
  let threads = read<ForumThread[]>(KEYS.threads, []);
  const t = threads.find(th => th.id === threadId);
  threads = threads.filter(th => th.id !== threadId);
  write(KEYS.threads, threads);

  // Delete all posts
  let posts = read<ForumPost[]>(KEYS.posts, []);
  posts = posts.filter(p => p.threadId !== threadId);
  write(KEYS.posts, posts);

  if (t) {
    const cats = read<ForumCategory[]>(KEYS.categories, getDefaultCategories());
    const cat = cats.find(c => c.id === t.categoryId);
    if (cat) { cat.threadCount = threads.filter(th => th.categoryId === t.categoryId).length; }
    write(KEYS.categories, cats);
  }
}

/* ─── Posts ─── */

export function getForumPosts(threadId: string): ForumPost[] {
  const posts = read<ForumPost[]>(KEYS.posts, []);
  const votes = read<ForumVote[]>(KEYS.votes, []);
  return posts
    .filter(p => p.threadId === threadId)
    .map(p => ({
      ...p,
      myVote: (votes.find(v => v.postId === p.id)?.vote ?? null) as "up" | "down" | null,
    }))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export function createForumPost(
  threadId: string,
  content: string,
  author: { id: string; username: string },
  quote: { postId: string | null; content: string | null; author: string | null } = { postId: null, content: null, author: null },
): ForumPost {
  const now = new Date().toISOString();
  const post: ForumPost = {
    id: uid(),
    threadId,
    content: content.trim(),
    authorId: author.id,
    authorUsername: author.username,
    parentPostId: null,
    quotePostId: quote.postId,
    quoteContent: quote.content,
    quoteAuthor: quote.author,
    upvotes: 0,
    downvotes: 0,
    myVote: null,
    createdAt: now,
    editedAt: null,
  };
  const posts = read<ForumPost[]>(KEYS.posts, []);
  posts.push(post);
  write(KEYS.posts, posts);

  // Update thread post count & lastPostAt
  const threads = read<ForumThread[]>(KEYS.threads, []);
  const t = threads.find(th => th.id === threadId);
  if (t) {
    t.postCount = posts.filter(p => p.threadId === threadId).length;
    t.lastPostAt = now;
    t.lastPostAuthor = author.username;
    t.updatedAt = now;
    write(KEYS.threads, threads);
  }

  return post;
}

export function editForumPost(postId: string, newContent: string): boolean {
  const posts = read<ForumPost[]>(KEYS.posts, []);
  const p = posts.find(po => po.id === postId);
  if (!p) return false;
  p.content = newContent.trim();
  p.editedAt = new Date().toISOString();
  write(KEYS.posts, posts);
  return true;
}

export function deleteForumPost(postId: string): boolean {
  let posts = read<ForumPost[]>(KEYS.posts, []);
  const exists = posts.some(p => p.id === postId);
  if (!exists) return false;
  posts = posts.filter(p => p.id !== postId);
  write(KEYS.posts, posts);

  // Update thread post count and clear solution if needed
  const threads = read<ForumThread[]>(KEYS.threads, []);
  const affected = threads.filter(t => t.postCount > 0);
  for (const t of affected) {
    if (t.solutionPostId === postId) t.solutionPostId = null;
    t.postCount = posts.filter(p => p.threadId === t.id).length;
  }
  write(KEYS.threads, threads);
  return true;
}

/* ─── Votes ─── */

export function voteForumPost(postId: string, userId: string, vote: "up" | "down"): { upvotes: number; downvotes: number } {
  const posts = read<ForumPost[]>(KEYS.posts, []);
  const post = posts.find(p => p.id === postId);
  if (!post) return { upvotes: 0, downvotes: 0 };

  let votes = read<ForumVote[]>(KEYS.votes, []);
  const existing = votes.find(v => v.postId === postId && v.userId === userId);

  // Remove previous vote counts
  if (existing) {
    if (existing.vote === "up") post.upvotes = Math.max(0, post.upvotes - 1);
    if (existing.vote === "down") post.downvotes = Math.max(0, post.downvotes - 1);
    votes = votes.filter(v => !(v.postId === postId && v.userId === userId));
  }

  // If same vote as existing, toggle off
  if (existing?.vote === vote) {
    write(KEYS.posts, posts);
    write(KEYS.votes, votes);
    return { upvotes: post.upvotes, downvotes: post.downvotes };
  }

  // Add new vote
  votes.push({ postId, userId, vote });
  if (vote === "up") post.upvotes += 1;
  if (vote === "down") post.downvotes += 1;
  write(KEYS.posts, posts);
  write(KEYS.votes, votes);
  return { upvotes: post.upvotes, downvotes: post.downvotes };
}
