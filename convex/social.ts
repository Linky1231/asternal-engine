// @ts-nocheck
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ── FOLLOW / UNFOLLOW ──
export const toggleFollow = mutation({
  args: { followerId: v.string(), followingId: v.string() },
  handler: async (ctx, args) => {
    if (args.followerId === args.followingId) throw new Error("Cannot follow yourself");
    const existing = await ctx.db
      .query("follows")
      .withIndex("by_pair", (q) => q.eq("followerId", args.followerId).eq("followingId", args.followingId))
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
      return false;
    }
    await ctx.db.insert("follows", {
      followerId: args.followerId, followingId: args.followingId, createdAt: Date.now(),
    });
    // Create notification
    await ctx.db.insert("notifications", {
      userId: args.followingId, actorId: args.followerId, type: "follow",
      read: false, createdAt: Date.now(),
    });
    return true;
  },
});

// ── GET follow stats ──
export const getFollowStats = query({
  args: { userId: v.string(), myId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const followers = await ctx.db
      .query("follows")
      .withIndex("by_followingId", (q) => q.eq("followingId", args.userId))
      .collect();
    const following = await ctx.db
      .query("follows")
      .withIndex("by_followerId", (q) => q.eq("followerId", args.userId))
      .collect();
    let iFollow = false;
    if (args.myId) {
      const r = await ctx.db
        .query("follows")
        .withIndex("by_pair", (q) => q.eq("followerId", args.myId).eq("followingId", args.userId))
        .unique();
      iFollow = !!r;
    }
    return { followers: followers.length, following: following.length, iFollow };
  },
});

// ── GET followers ──
export const getFollowers = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("follows")
      .withIndex("by_followingId", (q) => q.eq("followingId", args.userId))
      .collect();
    const ids = rows.map((r) => r.followerId);
    const profiles = await Promise.all(ids.map(async (id) => {
      return await ctx.db.query("profiles").withIndex("by_userId", (q) => q.eq("userId", id)).unique();
    }));
    return profiles.filter(Boolean);
  },
});

// ── GET following ──
export const getFollowing = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("follows")
      .withIndex("by_followerId", (q) => q.eq("followerId", args.userId))
      .collect();
    const ids = rows.map((r) => r.followingId);
    const profiles = await Promise.all(ids.map(async (id) => {
      return await ctx.db.query("profiles").withIndex("by_userId", (q) => q.eq("userId", id)).unique();
    }));
    return profiles.filter(Boolean);
  },
});

// ── BLOCK ──
export const blockUser = mutation({
  args: { blockerId: v.string(), blockedId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("blocks")
      .withIndex("by_pair", (q) => q.eq("blockerId", args.blockerId).eq("blockedId", args.blockedId))
      .unique();
    if (existing) return;
    await ctx.db.insert("blocks", { blockerId: args.blockerId, blockedId: args.blockedId, createdAt: Date.now() });
  },
});

// ── UNBLOCK ──
export const unblockUser = mutation({
  args: { blockerId: v.string(), blockedId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("blocks")
      .withIndex("by_pair", (q) => q.eq("blockerId", args.blockerId).eq("blockedId", args.blockedId))
      .unique();
    if (existing) await ctx.db.delete(existing._id);
  },
});

// ── CHECK if blocked ──
export const isBlocked = query({
  args: { blockerId: v.string(), blockedId: v.string() },
  handler: async (ctx, args) => {
    const r = await ctx.db
      .query("blocks")
      .withIndex("by_pair", (q) => q.eq("blockerId", args.blockerId).eq("blockedId", args.blockedId))
      .unique();
    return !!r;
  },
});

// ── CREATE report ──
export const createReport = mutation({
  args: { reporterId: v.string(), postId: v.optional(v.string()), commentId: v.optional(v.string()), reason: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.insert("reports", {
      reporterId: args.reporterId, postId: args.postId, commentId: args.commentId,
      reason: args.reason, status: "open", createdAt: Date.now(),
    });
  },
});

// ── GET notifications ──
export const getNotifications = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("notifications")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

// ── MARK notification read ──
export const markRead = mutation({
  args: { notificationId: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.notificationId, { read: true });
  },
});

// ── MARK ALL notifications read ──
export const markAllRead = mutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const notifs = await ctx.db
      .query("notifications")
      .withIndex("by_userId_read", (q) => q.eq("userId", args.userId).eq("read", false))
      .collect();
    for (const n of notifs) {
      await ctx.db.patch(n._id, { read: true });
    }
  },
});

// ── COUNT unread notifications ──
export const countUnread = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_userId_read", (q) => q.eq("userId", args.userId).eq("read", false))
      .collect();
    return unread.length;
  },
});
