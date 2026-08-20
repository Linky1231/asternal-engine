// @ts-nocheck
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ── GET feed posts ──
export const getFeed = query({
  args: { limit: v.optional(v.number()), before: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    let q = ctx.db.query("posts").withIndex("by_createdAt");
    if (args.before) q = q.filter((f) => f.lt(f.field("createdAt"), args.before));
    const posts = await q.order("desc").collect();
    return posts.filter((p) => !p.deletedAt).slice(0, limit);
  },
});

// ── GET games by category ──
export const getGames = query({
  args: { category: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 30;
    let q = ctx.db.query("posts").withIndex("by_category");
    if (args.category) q = q.eq("category", args.category);
    const posts = await q.order("desc").collect();
    return posts.filter((p) => !p.deletedAt).slice(0, limit);
  },
});

// ── GET posts by author ──
export const getByAuthor = query({
  args: { authorId: v.string(), category: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const posts = await ctx.db
      .query("posts")
      .withIndex("by_authorId", (q) => q.eq("authorId", args.authorId))
      .order("desc")
      .collect();
    return posts
      .filter((p) => !p.deletedAt && (!args.category || p.category === args.category))
      .slice(0, limit);
  },
});

// ── GET single post ──
export const getById = query({
  args: { postId: v.string() },
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.postId);
    if (!post || post.deletedAt) return null;
    return post;
  },
});

// ── CREATE post ──
export const create = mutation({
  args: {
    authorId: v.string(),
    content: v.string(),
    mediaUrls: v.optional(v.array(v.string())),
    mediaType: v.optional(v.string()),
    category: v.optional(v.string()),
    coverUrl: v.optional(v.string()),
    screenshots: v.optional(v.array(v.string())),
    gameGenre: v.optional(v.string()),
    priceOrbes: v.optional(v.number()),
    textColor: v.optional(v.string()),
    htmlContent: v.optional(v.string()),
    linkUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("posts", {
      authorId: args.authorId,
      content: args.content,
      mediaUrls: args.mediaUrls ?? [],
      mediaType: (args.mediaType as any) ?? "none",
      category: args.category,
      coverUrl: args.coverUrl,
      screenshots: args.screenshots ?? [],
      gameGenre: args.gameGenre,
      allowRemix: true,
      priceOrbes: args.priceOrbes ?? 0,
      textColor: args.textColor,
      htmlContent: args.htmlContent,
      documentPaths: [],
      documentNames: [],
      pinnedGameId: null,
      lockedContent: null,
      unlockReactionsGoal: null,
      unlockAt: null,
      entranceEffect: null,
      sellerId: null,
      resalePriceOrbes: null,
      currentOwnerId: null,
      likes: 0,
      commentsCount: 0,
      linkUrl: args.linkUrl,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// ── UPDATE post ──
export const update = mutation({
  args: { postId: v.string(), patch: v.any() },
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.postId);
    if (!post) throw new Error("Post not found");
    await ctx.db.patch(args.postId, { ...args.patch, updatedAt: Date.now() });
  },
});

// ── DELETE post (soft) ──
export const softDelete = mutation({
  args: { postId: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.postId, { deletedAt: Date.now(), updatedAt: Date.now() });
  },
});

// ── LIKE / UNLIKE ──
export const toggleLike = mutation({
  args: { userId: v.string(), postId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("reactions")
      .withIndex("by_userId_postId", (q) => q.eq("userId", args.userId).eq("postId", args.postId))
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
      const post = await ctx.db.get(args.postId);
      if (post) await ctx.db.patch(args.postId, { likes: Math.max(0, post.likes - 1) });
      return false;
    } else {
      await ctx.db.insert("reactions", {
        userId: args.userId, postId: args.postId, type: "like", createdAt: Date.now(),
      });
      const post = await ctx.db.get(args.postId);
      if (post) await ctx.db.patch(args.postId, { likes: post.likes + 1 });
      return true;
    }
  },
});

// ── GET reactions for a post ──
export const getReactions = query({
  args: { postId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("reactions")
      .withIndex("by_postId", (q) => q.eq("postId", args.postId))
      .collect();
  },
});

// ── CHECK if user liked a post ──
export const hasLiked = query({
  args: { userId: v.string(), postId: v.string() },
  handler: async (ctx, args) => {
    const r = await ctx.db
      .query("reactions")
      .withIndex("by_userId_postId", (q) => q.eq("userId", args.userId).eq("postId", args.postId))
      .unique();
    return !!r;
  },
});

// ── SEARCH posts ──
export const searchPosts = query({
  args: { query: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const q = args.query.toLowerCase().trim();
    if (!q) return [];
    const all = await ctx.db.query("posts").collect();
    return all
      .filter((p) => !p.deletedAt && p.content.toLowerCase().includes(q))
      .slice(0, args.limit ?? 30);
  },
});

// ── GET trending (most played last 24h) ──
export const getTrending = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const since = Date.now() - 24 * 60 * 60 * 1000;
    const plays = await ctx.db.query("gamePlays").collect();
    const recentPlays = plays.filter((p) => p.createdAt >= since);
    const countByPost = new Map<string, number>();
    for (const p of recentPlays) {
      countByPost.set(p.postId, (countByPost.get(p.postId) ?? 0) + 1);
    }
    const sorted = [...countByPost.entries()].sort((a, b) => b[1] - a[1]).slice(0, args.limit ?? 10);
    const posts: any[] = [];
    for (const [postId] of sorted) {
      const post = await ctx.db.get(postId);
      if (post && !post.deletedAt) posts.push(post);
    }
    return posts;
  },
});

// ── RECORD game play ──
export const recordPlay = mutation({
  args: { userId: v.optional(v.string()), postId: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.insert("gamePlays", {
      userId: args.userId, postId: args.postId, createdAt: Date.now(),
    });
  },
});

// ── PIN game to profile ──
export const pinGame = mutation({
  args: { userId: v.string(), postId: v.string() },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
    if (profile) await ctx.db.patch(profile._id, { featuredPostId: args.postId, updatedAt: Date.now() });
  },
});

// ── CREATE comment ──
export const addComment = mutation({
  args: { postId: v.string(), authorId: v.string(), content: v.string(), parentId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("comments", {
      postId: args.postId, authorId: args.authorId, content: args.content,
      parentId: args.parentId, createdAt: now, updatedAt: now,
    });
    const post = await ctx.db.get(args.postId);
    if (post) await ctx.db.patch(args.postId, { commentsCount: post.commentsCount + 1 });
    return id;
  },
});

// ── GET comments for post ──
export const getComments = query({
  args: { postId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("comments")
      .withIndex("by_postId", (q) => q.eq("postId", args.postId))
      .order("asc")
      .collect();
  },
});

// ── REPOST ──
export const toggleRepost = mutation({
  args: { userId: v.string(), postId: v.string(), quote: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("reposts")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();
    const already = existing.find((r) => r.postId === args.postId);
    if (already) {
      await ctx.db.delete(already._id);
      return false;
    }
    await ctx.db.insert("reposts", {
      userId: args.userId, postId: args.postId, quote: args.quote, createdAt: Date.now(),
    });
    return true;
  },
});

// ── GET reposts for post ──
export const getReposts = query({
  args: { postId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("reposts")
      .withIndex("by_postId", (q) => q.eq("postId", args.postId))
      .collect();
  },
});
