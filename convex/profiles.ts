// @ts-nocheck
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ── GET profile by userId ──
export const getByUserId = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
  },
});

// ── GET profile by username ──
export const getByUsername = query({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("profiles")
      .withIndex("by_username", (q) => q.eq("username", args.username))
      .unique();
  },
});

// ── GET my profile (from auth) ──
export const getMyProfile = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .unique();
  },
});

// ── CREATE profile (on signup) ──
export const createProfile = mutation({
  args: {
    userId: v.string(),
    username: v.string(),
    displayName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
    if (existing) return existing._id;

    // Generate unique user code
    let userCode: string;
    let attempts = 0;
    do {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      userCode = "AST-";
      for (let i = 0; i < 6; i++) userCode += chars[Math.floor(Math.random() * chars.length)];
      attempts++;
    } while (
      (await ctx.db.query("profiles").withIndex("by_userCode", (q) => q.eq("userCode", userCode)).unique()) &&
      attempts < 10
    );

    const now = Date.now();
    const id = await ctx.db.insert("profiles", {
      userId: args.userId,
      username: args.username,
      displayName: args.displayName,
      userCode,
      bio: null,
      avatarUrl: null,
      bannerUrl: null,
      pronouns: null,
      location: null,
      statusText: null,
      statusEmoji: null,
      accentColor: null,
      favoriteGenre: null,
      customTitle: null,
      birthday: null,
      showOrbes: true,
      themeMode: "dark",
      interests: [],
      orbes: 100,
      isPlus: true,
      showPlusBadge: false,
      avatarFrame: null,
      socialLinks: null,
      lastPlusClaimAt: null,
      plusExpiresAt: null,
      nameEffect: null,
      profileBackground: null,
      postEffect: null,
      creatorCardStyle: null,
      qrStyle: null,
      featuredPostId: null,
      trustPoints: 10,
      createdAt: now,
      updatedAt: now,
    });

    // Auto-assign admin role for owner email
    const email = identity.email?.toLowerCase?.() ?? "";
    if (email === "linkyteam989@gmail.com") {
      await ctx.db.insert("userRoles", { userId: args.userId, role: "admin", createdAt: now });
    }

    return id;
  },
});

// ── UPDATE profile ──
export const updateProfile = mutation({
  args: {
    userId: v.string(),
    patch: v.any(),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
    if (!profile) throw new Error("Profile not found");
    await ctx.db.patch(profile._id, { ...args.patch, updatedAt: Date.now() });
    return profile._id;
  },
});

// ── CHECK if username is taken ──
export const isUsernameTaken = query({
  args: { username: v.string(), excludeUserId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_username", (q) => q.eq("username", args.username))
      .unique();
    if (!existing) return false;
    if (args.excludeUserId && existing.userId === args.excludeUserId) return false;
    return true;
  },
});

// ── GET user role ──
export const getRole = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const roles = await ctx.db
      .query("userRoles")
      .withIndex("by_userId_role", (q) => q.eq("userId", args.userId))
      .collect();
    return roles.map((r) => r.role);
  },
});

// ── GET trust points history ──
export const getTrustHistory = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("trustPointsHistory")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

// ── DEDUCT trust points ──
export const deductTrustPoints = mutation({
  args: {
    userId: v.string(),
    modifierId: v.string(),
    amount: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
    if (!profile) throw new Error("User not found");

    const newPoints = Math.max(0, profile.trustPoints - args.amount);
    await ctx.db.patch(profile._id, { trustPoints: newPoints, updatedAt: Date.now() });

    await ctx.db.insert("trustPointsHistory", {
      userId: args.userId,
      modifierId: args.modifierId,
      action: "deduct",
      amount: args.amount,
      reason: args.reason,
      pointsBefore: profile.trustPoints,
      pointsAfter: newPoints,
      createdAt: Date.now(),
    });

    // Ban if 0
    if (newPoints <= 0) {
      await ctx.db.patch(profile._id, { isPlus: false });
    }

    return { newPoints, banned: newPoints <= 0 };
  },
});

// ── RESTORE trust points ──
export const restoreTrustPoints = mutation({
  args: {
    userId: v.string(),
    modifierId: v.string(),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
    if (!profile) throw new Error("User not found");

    const newPoints = Math.min(10, profile.trustPoints + args.amount);
    await ctx.db.patch(profile._id, { trustPoints: newPoints, updatedAt: Date.now() });

    await ctx.db.insert("trustPointsHistory", {
      userId: args.userId,
      modifierId: args.modifierId,
      action: "restore",
      amount: args.amount,
      reason: "",
      pointsBefore: profile.trustPoints,
      pointsAfter: newPoints,
      createdAt: Date.now(),
    });

    return newPoints;
  },
});

// ── SEARCH profiles ──
export const search = query({
  args: { query: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const q = args.query.toLowerCase().trim();
    if (!q) return [];
    const all = await ctx.db.query("profiles").collect();
    const limit = args.limit ?? 30;
    return all
      .filter((p) =>
        p.username.toLowerCase().includes(q) ||
        (p.displayName?.toLowerCase().includes(q)) ||
        (p.bio?.toLowerCase().includes(q))
      )
      .slice(0, limit);
  },
});
