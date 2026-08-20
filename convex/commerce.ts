// @ts-nocheck
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ══════ COMMERCE ══════

// ── PURCHASE game ──
export const purchaseGame = mutation({
  args: { postId: v.string(), buyerId: v.string() },
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.postId);
    if (!post || post.deletedAt) return { ok: false };

    const already = await ctx.db
      .query("gamePurchases")
      .withIndex("by_userId_postId", (q) => q.eq("userId", args.buyerId).eq("postId", args.postId))
      .unique();
    if (already) return { ok: false, alreadyOwned: true };

    const price = post.sellerId ? (post.resalePriceOrbes ?? 0) : post.priceOrbes;
    const sellerId = post.sellerId ?? post.authorId;

    if (sellerId === args.buyerId) return { ok: true, free: true, alreadyOwned: true };

    if (price <= 0) {
      await ctx.db.insert("gamePurchases", { userId: args.buyerId, postId: args.postId, pricePaid: 0, purchasedAt: Date.now() });
      await ctx.db.patch(args.postId, { currentOwnerId: args.buyerId, sellerId: null, updatedAt: Date.now() });
      return { ok: true, free: true, paid: 0 };
    }

    // Check balance
    const buyer = await ctx.db.query("profiles").withIndex("by_userId", (q) => q.eq("userId", args.buyerId)).unique();
    if (!buyer || buyer.orbes < price) return { ok: false, balance: buyer?.orbes ?? 0 };

    // Transfer orbes
    await ctx.db.patch(buyer._id, { orbes: buyer.orbes - price, updatedAt: Date.now() });
    const seller = await ctx.db.query("profiles").withIndex("by_userId", (q) => q.eq("userId", sellerId)).unique();
    if (seller) await ctx.db.patch(seller._id, { orbes: seller.orbes + price, updatedAt: Date.now() });

    // Record
    await ctx.db.insert("gamePurchases", { userId: args.buyerId, postId: args.postId, pricePaid: price, purchasedAt: Date.now() });
    const now = Date.now();
    await ctx.db.insert("orbeTransactions", { userId: args.buyerId, amount: -price, kind: "game_purchase", postId: args.postId, description: "Compra de juego", createdAt: now });
    await ctx.db.insert("orbeTransactions", { userId: sellerId, amount: price, kind: "game_purchase", postId: args.postId, description: "Venta de juego", createdAt: now });
    await ctx.db.patch(args.postId, { currentOwnerId: args.buyerId, sellerId: null, updatedAt: now });

    return { ok: true, paid: price, balance: buyer.orbes - price };
  },
});

// ── RESALE artwork ──
export const resellArtwork = mutation({
  args: { postId: v.string(), userId: v.string(), price: v.number() },
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.postId);
    if (!post) return { ok: false, error: "not_found" };
    if (post.category !== "artwork") return { ok: false, error: "not_artwork" };
    const owns = post.authorId === args.userId || post.currentOwnerId === args.userId;
    if (!owns) return { ok: false, error: "not_owner" };
    if (args.price <= 0) {
      await ctx.db.patch(args.postId, { sellerId: null, resalePriceOrbes: null, updatedAt: Date.now() });
      return { ok: true, onSale: false };
    }
    await ctx.db.patch(args.postId, { sellerId: args.userId, resalePriceOrbes: args.price, updatedAt: Date.now() });
    return { ok: true, onSale: true, price: args.price };
  },
});

// ── CLAIM monthly orbes ──
export const claimPlusOrbes = mutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const profile = await ctx.db.query("profiles").withIndex("by_userId", (q) => q.eq("userId", args.userId)).unique();
    if (!profile) return { ok: false };
    const now = Date.now();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    if (profile.lastPlusClaimAt && now - profile.lastPlusClaimAt < thirtyDays) {
      return { ok: false, alreadyClaimed: true, nextAt: profile.lastPlusClaimAt + thirtyDays };
    }
    await ctx.db.patch(profile._id, { orbes: profile.orbes + 10000, lastPlusClaimAt: now, updatedAt: now });
    await ctx.db.insert("orbeTransactions", { userId: args.userId, amount: 10000, kind: "welcome_bonus", description: "Reclamo mensual", createdAt: now });
    return { ok: true, amount: 10000 };
  },
});

// ── GET orbe transactions ──
export const getOrbeHistory = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db.query("orbeTransactions").withIndex("by_userId", (q) => q.eq("userId", args.userId)).order("desc").collect();
  },
});

// ── CHECK if user owns game ──
export const ownsGame = query({
  args: { userId: v.string(), postId: v.string() },
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.postId);
    if (!post) return false;
    if (post.authorId === args.userId) return true;
    if (post.priceOrbes <= 0) return true;
    const purchase = await ctx.db.query("gamePurchases").withIndex("by_userId_postId", (q) => q.eq("userId", args.userId).eq("postId", args.postId)).unique();
    return !!purchase;
  },
});

// ══════ EVENTS ══════

export const getEvents = query({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, args) => {
    let q = ctx.db.query("events");
    if (args.status) q = q.withIndex("by_status", (q) => q.eq("status", args.status));
    return await q.order("desc").collect();
  },
});

export const joinEvent = mutation({
  args: { eventId: v.string(), userId: v.string() },
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    if (!event || event.status === "completed") throw new Error("event_completed");
    const existing = await ctx.db.query("eventParticipants").withIndex("by_eventId_userId", (q) => q.eq("eventId", args.eventId).eq("userId", args.userId)).unique();
    if (!existing) await ctx.db.insert("eventParticipants", { eventId: args.eventId, userId: args.userId, createdAt: Date.now() });
  },
});

export const leaveEvent = mutation({
  args: { eventId: v.string(), userId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("eventParticipants").withIndex("by_eventId_userId", (q) => q.eq("eventId", args.eventId).eq("userId", args.userId)).unique();
    if (existing) await ctx.db.delete(existing._id);
  },
});

export const countParticipants = query({
  args: { eventId: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db.query("eventParticipants").withIndex("by_eventId", (q) => q.eq("eventId", args.eventId)).collect();
    return rows.length;
  },
});

// ══════ FORUM ══════

export const getForumCategories = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("forumCategories").withIndex("by_sortOrder").collect();
  },
});

export const getForumThreads = query({
  args: { categoryId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db.query("forumThreads").withIndex("by_categoryId", (q) => q.eq("categoryId", args.categoryId)).order("desc").collect();
  },
});

export const getForumThread = query({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.threadId);
  },
});

export const getForumPosts = query({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db.query("forumPosts").withIndex("by_threadId", (q) => q.eq("threadId", args.threadId)).order("asc").collect();
  },
});

export const createForumThread = mutation({
  args: {
    categoryId: v.string(), title: v.string(), content: v.string(),
    authorId: v.string(), authorUsername: v.string(), tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const threadId = await ctx.db.insert("forumThreads", {
      categoryId: args.categoryId, title: args.title, content: args.content,
      authorId: args.authorId, authorUsername: args.authorUsername, tags: args.tags ?? [],
      upvotes: 0, downvotes: 0, mediaUrls: [], mediaType: "none",
      documentUrls: [], documentNames: [], pinned: false, closed: false,
      views: 0, postCount: 1, createdAt: now, updatedAt: now,
      lastPostAt: now, lastPostAuthor: args.authorUsername,
    });
    await ctx.db.insert("forumPosts", {
      threadId, content: args.content, authorId: args.authorId,
      authorUsername: args.authorUsername, upvotes: 0, downvotes: 0, createdAt: now,
    });
    return threadId;
  },
});

export const createForumPost = mutation({
  args: {
    threadId: v.string(), content: v.string(), authorId: v.string(), authorUsername: v.string(),
    parentPostId: v.optional(v.string()), quotePostId: v.optional(v.string()),
    quoteContent: v.optional(v.string()), quoteAuthor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("forumPosts", {
      threadId: args.threadId, content: args.content, authorId: args.authorId,
      authorUsername: args.authorUsername, parentPostId: args.parentPostId,
      quotePostId: args.quotePostId, quoteContent: args.quoteContent, quoteAuthor: args.quoteAuthor,
      upvotes: 0, downvotes: 0, createdAt: now,
    });
    const thread = await ctx.db.get(args.threadId);
    if (thread) {
      const postCount = (await ctx.db.query("forumPosts").withIndex("by_threadId", (q) => q.eq("threadId", args.threadId)).collect()).length;
      await ctx.db.patch(args.threadId, { postCount, lastPostAt: now, lastPostAuthor: args.authorUsername, updatedAt: now });
    }
    return id;
  },
});

export const bumpViews = mutation({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId);
    if (thread) await ctx.db.patch(args.threadId, { views: thread.views + 1 });
  },
});

// ══════ BANNED EMAILS ══════

export const isEmailBanned = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const r = await ctx.db.query("bannedEmails").withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase())).unique();
    return !!r;
  },
});
