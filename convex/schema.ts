import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ── PROFILES ──
  profiles: defineTable({
    userId: v.string(),
    username: v.string(),
    displayName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    avatarSpec: v.optional(v.any()),
    userCode: v.optional(v.string()),
    bio: v.optional(v.string()),
    bannerUrl: v.optional(v.string()),
    pronouns: v.optional(v.string()),
    location: v.optional(v.string()),
    statusText: v.optional(v.string()),
    statusEmoji: v.optional(v.string()),
    accentColor: v.optional(v.string()),
    favoriteGenre: v.optional(v.string()),
    customTitle: v.optional(v.string()),
    birthday: v.optional(v.string()),
    showOrbes: v.boolean(),
    themeMode: v.string(),
    interests: v.array(v.string()),
    orbes: v.number(),
    isPlus: v.boolean(),
    showPlusBadge: v.boolean(),
    avatarFrame: v.optional(v.string()),
    socialLinks: v.optional(v.any()),
    lastPlusClaimAt: v.optional(v.number()),
    plusExpiresAt: v.optional(v.number()),
    nameEffect: v.optional(v.string()),
    profileBackground: v.optional(v.string()),
    postEffect: v.optional(v.string()),
    creatorCardStyle: v.optional(v.any()),
    qrStyle: v.optional(v.any()),
    featuredPostId: v.optional(v.string()),
    trustPoints: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_userId", ["userId"])
    .index("by_username", ["username"])
    .index("by_userCode", ["userCode"]),

  // ── USER ROLES ──
  userRoles: defineTable({
    userId: v.string(),
    role: v.union(v.literal("admin"), v.literal("moderator"), v.literal("user")),
    createdAt: v.number(),
  }).index("by_userId_role", ["userId", "role"]),

  // ── TAGS ──
  tags: defineTable({
    name: v.string(),
    createdAt: v.number(),
  }).index("by_name", ["name"]),

  // ── POSTS (games, artworks, feed posts) ──
  posts: defineTable({
    authorId: v.string(),
    content: v.string(),
    mediaUrls: v.array(v.string()),
    mediaType: v.union(v.literal("none"), v.literal("image"), v.literal("video"), v.literal("link")),
    linkUrl: v.optional(v.string()),
    category: v.optional(v.string()),
    coverUrl: v.optional(v.string()),
    screenshots: v.array(v.string()),
    gameGenre: v.optional(v.string()),
    allowRemix: v.boolean(),
    priceOrbes: v.number(),
    textColor: v.optional(v.string()),
    htmlContent: v.optional(v.string()),
    documentPaths: v.array(v.string()),
    documentNames: v.array(v.string()),
    pinnedGameId: v.optional(v.string()),
    lockedContent: v.optional(v.string()),
    unlockReactionsGoal: v.optional(v.number()),
    unlockAt: v.optional(v.number()),
    entranceEffect: v.optional(v.string()),
    sellerId: v.optional(v.string()),
    resalePriceOrbes: v.optional(v.number()),
    currentOwnerId: v.optional(v.string()),
    likes: v.number(),
    commentsCount: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  }).index("by_authorId", ["authorId"])
    .index("by_category", ["category"])
    .index("by_createdAt", ["createdAt"])
    .index("by_deletedAt", ["deletedAt"]),

  // ── COMMENTS ──
  comments: defineTable({
    postId: v.string(),
    authorId: v.string(),
    parentId: v.optional(v.string()),
    content: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  }).index("by_postId", ["postId"])
    .index("by_authorId", ["authorId"]),

  // ── REACTIONS ──
  reactions: defineTable({
    userId: v.string(),
    postId: v.optional(v.string()),
    commentId: v.optional(v.string()),
    type: v.union(v.literal("like"), v.literal("favorite")),
    createdAt: v.number(),
  }).index("by_userId_postId", ["userId", "postId"])
    .index("by_postId", ["postId"])
    .index("by_commentId", ["commentId"]),

  // ── REPOSTS ──
  reposts: defineTable({
    userId: v.string(),
    postId: v.string(),
    quote: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_userId", ["userId"])
    .index("by_postId", ["postId"]),

  // ── POST TAGS ──
  postTags: defineTable({
    postId: v.string(),
    tagId: v.string(),
  }).index("by_postId", ["postId"])
    .index("by_tagId", ["tagId"]),

  // ── NOTIFICATIONS ──
  notifications: defineTable({
    userId: v.string(),
    actorId: v.optional(v.string()),
    type: v.string(),
    postId: v.optional(v.string()),
    commentId: v.optional(v.string()),
    read: v.boolean(),
    createdAt: v.number(),
  }).index("by_userId", ["userId"])
    .index("by_userId_read", ["userId", "read"]),

  // ── FOLLOWS ──
  follows: defineTable({
    followerId: v.string(),
    followingId: v.string(),
    createdAt: v.number(),
  }).index("by_followerId", ["followerId"])
    .index("by_followingId", ["followingId"])
    .index("by_pair", ["followerId", "followingId"]),

  // ── BLOCKS ──
  blocks: defineTable({
    blockerId: v.string(),
    blockedId: v.string(),
    createdAt: v.number(),
  }).index("by_blockerId", ["blockerId"])
    .index("by_pair", ["blockerId", "blockedId"]),

  // ── REPORTS ──
  reports: defineTable({
    reporterId: v.string(),
    postId: v.optional(v.string()),
    commentId: v.optional(v.string()),
    reason: v.string(),
    status: v.union(v.literal("open"), v.literal("reviewed"), v.literal("dismissed"), v.literal("actioned")),
    resolvedBy: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_status", ["status"]),

  // ── GAME PURCHASES ──
  gamePurchases: defineTable({
    userId: v.string(),
    postId: v.string(),
    pricePaid: v.number(),
    purchasedAt: v.number(),
  }).index("by_userId_postId", ["userId", "postId"])
    .index("by_userId", ["userId"]),

  // ── GAME PLAYS ──
  gamePlays: defineTable({
    userId: v.optional(v.string()),
    postId: v.string(),
    createdAt: v.number(),
  }).index("by_postId_createdAt", ["postId", "createdAt"]),

  // ── ORBE TRANSACTIONS ──
  orbeTransactions: defineTable({
    userId: v.string(),
    amount: v.number(),
    kind: v.string(),
    postId: v.optional(v.string()),
    description: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_userId", ["userId"]),

  // ── POST POLLS ──
  postPolls: defineTable({
    postId: v.string(),
    question: v.string(),
    options: v.array(v.any()),
    createdAt: v.number(),
  }).index("by_postId", ["postId"]),

  // ── POST POLL VOTES ──
  postPollVotes: defineTable({
    pollId: v.string(),
    userId: v.string(),
    optionIndex: v.number(),
    createdAt: v.number(),
  }).index("by_pollId_userId", ["pollId", "userId"]),

  // ── USER PROJECTS ──
  userProjects: defineTable({
    userId: v.string(),
    name: v.string(),
    data: v.any(),
    publishedPostId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),

  // ── BANNED EMAILS ──
  bannedEmails: defineTable({
    email: v.string(),
    reason: v.optional(v.string()),
    bannedBy: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_email", ["email"]),

  // ── EVENTS ──
  events: defineTable({
    title: v.string(),
    description: v.string(),
    bannerUrl: v.optional(v.string()),
    startsAt: v.number(),
    endsAt: v.number(),
    prizePool: v.optional(v.number()),
    prizeDescription: v.optional(v.string()),
    rules: v.optional(v.string()),
    status: v.string(),
    createdBy: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_status", ["status"]),

  // ── EVENT SUBMISSIONS ──
  eventSubmissions: defineTable({
    eventId: v.string(),
    postId: v.string(),
    authorId: v.string(),
    status: v.string(),
    createdAt: v.number(),
  }).index("by_eventId", ["eventId"])
    .index("by_eventId_authorId", ["eventId", "authorId"]),

  // ── EVENT PARTICIPANTS ──
  eventParticipants: defineTable({
    eventId: v.string(),
    userId: v.string(),
    createdAt: v.number(),
  }).index("by_eventId", ["eventId"])
    .index("by_eventId_userId", ["eventId", "userId"]),

  // ── TRUST POINTS HISTORY ──
  trustPointsHistory: defineTable({
    userId: v.string(),
    modifierId: v.optional(v.string()),
    action: v.union(v.literal("deduct"), v.literal("restore")),
    amount: v.number(),
    reason: v.string(),
    pointsBefore: v.number(),
    pointsAfter: v.number(),
    createdAt: v.number(),
  }).index("by_userId", ["userId"]),

  // ── CHATS ──
  chats: defineTable({
    type: v.union(v.literal("group"), v.literal("dm")),
    name: v.optional(v.string()),
    isCommunity: v.boolean(),
    createdBy: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_isCommunity", ["isCommunity"]),

  // ── CHAT MEMBERS ──
  chatMembers: defineTable({
    chatId: v.string(),
    userId: v.string(),
    role: v.string(),
    joinedAt: v.number(),
  }).index("by_chatId", ["chatId"])
    .index("by_userId", ["userId"])
    .index("by_chatId_userId", ["chatId", "userId"]),

  // ── CHAT MESSAGES ──
  chatMessages: defineTable({
    chatId: v.string(),
    senderId: v.string(),
    content: v.optional(v.string()),
    mediaUrl: v.optional(v.string()),
    mediaType: v.optional(v.string()),
    replyToId: v.optional(v.string()),
    kind: v.optional(v.string()),
    giftId: v.optional(v.string()),
    pollId: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_chatId_createdAt", ["chatId", "createdAt"])
    .index("by_senderId", ["senderId"]),

  // ── CHAT POLLS ──
  chatPolls: defineTable({
    chatId: v.string(),
    question: v.string(),
    options: v.array(v.any()),
    createdBy: v.string(),
    closed: v.boolean(),
    createdAt: v.number(),
  }).index("by_chatId", ["chatId"]),

  // ── FORUM CATEGORIES ──
  forumCategories: defineTable({
    name: v.string(),
    description: v.string(),
    icon: v.string(),
    sortOrder: v.number(),
    createdAt: v.number(),
  }).index("by_sortOrder", ["sortOrder"]),

  // ── FORUM THREADS ──
  forumThreads: defineTable({
    categoryId: v.string(),
    title: v.string(),
    content: v.string(),
    authorId: v.string(),
    authorUsername: v.string(),
    tags: v.array(v.string()),
    upvotes: v.number(),
    downvotes: v.number(),
    mediaUrls: v.array(v.string()),
    mediaType: v.string(),
    documentUrls: v.array(v.string()),
    documentNames: v.array(v.string()),
    pinned: v.boolean(),
    closed: v.boolean(),
    solutionPostId: v.optional(v.string()),
    views: v.number(),
    postCount: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
    lastPostAt: v.number(),
    lastPostAuthor: v.string(),
  }).index("by_categoryId", ["categoryId"])
    .index("by_authorId", ["authorId"]),

  // ── FORUM POSTS ──
  forumPosts: defineTable({
    threadId: v.string(),
    content: v.string(),
    authorId: v.string(),
    authorUsername: v.string(),
    parentPostId: v.optional(v.string()),
    quotePostId: v.optional(v.string()),
    quoteContent: v.optional(v.string()),
    quoteAuthor: v.optional(v.string()),
    upvotes: v.number(),
    downvotes: v.number(),
    createdAt: v.number(),
    editedAt: v.optional(v.number()),
  }).index("by_threadId", ["threadId"]),

  // ── FORUM VOTES ──
  forumVotes: defineTable({
    postId: v.string(),
    userId: v.string(),
    vote: v.union(v.literal("up"), v.literal("down")),
    createdAt: v.number(),
  }).index("by_postId_userId", ["postId", "userId"]),

  // ── FORUM THREAD VOTES ──
  forumThreadVotes: defineTable({
    threadId: v.string(),
    userId: v.string(),
    vote: v.union(v.literal("up"), v.literal("down")),
    createdAt: v.number(),
  }).index("by_threadId_userId", ["threadId", "userId"]),

  // ── GIFT PACKAGES (chat gifts) ──
  giftPackages: defineTable({
    chatId: v.string(),
    createdBy: v.string(),
    title: v.string(),
    amountPerPerson: v.number(),
    totalSlots: v.number(),
    takenSlots: v.number(),
    totalOrbes: v.number(),
    closed: v.boolean(),
    createdAt: v.number(),
  }).index("by_chatId", ["chatId"]),

  // ── GIFT CLAIMS ──
  giftClaims: defineTable({
    giftId: v.string(),
    userId: v.string(),
    claimedAt: v.number(),
  }).index("by_giftId", ["giftId"])
    .index("by_giftId_userId", ["giftId", "userId"]),
});
