// @ts-nocheck
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const COMMUNITY_CHAT_ID = "c0000000-0000-4000-8000-000000000000";

// ── GET or create community chat ──
export const ensureCommunityChat = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("chats")
      .withIndex("by_isCommunity", (q) => q.eq("isCommunity", true))
      .unique();
    if (existing) return existing._id;
    const now = Date.now();
    return await ctx.db.insert("chats", {
      type: "group", name: "Asternal · Comunidad", isCommunity: true,
      createdBy: undefined, createdAt: now, updatedAt: now,
    });
  },
});

// ── GET community chat info ──
export const getCommunityChat = query({
  args: {},
  handler: async (ctx) => {
    const chat = await ctx.db
      .query("chats")
      .withIndex("by_isCommunity", (q) => q.eq("isCommunity", true))
      .unique();
    if (!chat) return null;
    const members = await ctx.db
      .query("chatMembers")
      .withIndex("by_chatId", (q) => q.eq("chatId", chat._id))
      .collect();
    return { ...chat, memberCount: members.length };
  },
});

// ── JOIN community chat ──
export const joinCommunity = mutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    // Ensure chat exists
    const chat = await ctx.db
      .query("chats")
      .withIndex("by_isCommunity", (q) => q.eq("isCommunity", true))
      .unique();
    if (!chat) throw new Error("Community chat not found");

    const existing = await ctx.db
      .query("chatMembers")
      .withIndex("by_chatId_userId", (q) => q.eq("chatId", chat._id).eq("userId", args.userId))
      .unique();
    if (!existing) {
      await ctx.db.insert("chatMembers", {
        chatId: chat._id, userId: args.userId, role: "member", joinedAt: Date.now(),
      });
    }
    return chat._id;
  },
});

// ── GET chat messages ──
export const getMessages = query({
  args: { chatId: v.string(), limit: v.optional(v.number()), before: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    let q = ctx.db
      .query("chatMessages")
      .withIndex("by_chatId_createdAt", (q) => q.eq("chatId", args.chatId));
    if (args.before) q = q.filter((f) => f.lt(f.field("createdAt"), args.before));
    const msgs = await q.order("desc").collect();
    return msgs.slice(0, limit);
  },
});

// ── SEND message ──
export const sendMessage = mutation({
  args: {
    chatId: v.string(), senderId: v.string(), content: v.optional(v.string()),
    mediaUrl: v.optional(v.string()), mediaType: v.optional(v.string()),
    replyToId: v.optional(v.string()), kind: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("chatMessages", {
      chatId: args.chatId, senderId: args.senderId, content: args.content,
      mediaUrl: args.mediaUrl, mediaType: args.mediaType, replyToId: args.replyToId,
      kind: args.kind, createdAt: now,
    });
    await ctx.db.patch(args.chatId, { updatedAt: now });
    return id;
  },
});

// ── GET my chats ──
export const getMyChats = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const memberships = await ctx.db
      .query("chatMembers")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();
    const chats: any[] = [];
    for (const m of memberships) {
      const chat = await ctx.db.get(m.chatId);
      if (chat) chats.push(chat);
    }
    return chats.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

// ── CREATE DM chat ──
export const createDM = mutation({
  args: { userA: v.string(), userB: v.string() },
  handler: async (ctx, args) => {
    // Check if DM already exists
    const myChats = await ctx.db.query("chatMembers").withIndex("by_userId", (q) => q.eq("userId", args.userA)).collect();
    for (const m of myChats) {
      const chat = await ctx.db.get(m.chatId);
      if (chat && chat.type === "dm") {
        const otherMember = await ctx.db
          .query("chatMembers")
          .withIndex("by_chatId_userId", (q) => q.eq("chatId", chat._id).eq("userId", args.userB))
          .unique();
        if (otherMember) return chat._id;
      }
    }
    const now = Date.now();
    const chatId = await ctx.db.insert("chats", {
      type: "dm", isCommunity: false, createdBy: args.userA, createdAt: now, updatedAt: now,
    });
    await ctx.db.insert("chatMembers", { chatId, userId: args.userA, role: "member", joinedAt: now });
    await ctx.db.insert("chatMembers", { chatId, userId: args.userB, role: "member", joinedAt: now });
    return chatId;
  },
});

// ── CHECK schema exists (for local mode fallback) ──
export const checkSchema = query({
  args: {},
  handler: async (ctx) => {
    try {
      await ctx.db.query("chats").first();
      return true;
    } catch {
      return false;
    }
  },
});
