// @ts-nocheck
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ── GENERATE upload URL ──
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

// ── SAVE file metadata after upload ──
export const saveFile = mutation({
  args: {
    storageId: v.id("_storage"),
    userId: v.string(),
    purpose: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const url = await ctx.storage.getUrl(args.storageId);
    return { storageId: args.storageId, url };
  },
});

// ── GET file URL ──
export const getFileUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});
