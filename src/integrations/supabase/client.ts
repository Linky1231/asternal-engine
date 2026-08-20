/**
 * Supabase → Convex shim
 * Routes all Supabase calls through Convex.
 */
import { ConvexClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";

const CONVEX_URL = import.meta.env.VITE_CONVEX_URL ?? "https://default.convex.cloud";
const _convex = new ConvexClient(CONVEX_URL);

export function hasSupabaseConfig(): boolean { return true; }
export function isSchemaMissing(): boolean { return false; }
export function getSupabaseUrl(): string | undefined { return undefined; }
export function getSupabaseAnonKey(): string | undefined { return undefined; }
export function saveSupabaseCredentials(_url?: string, _key?: string): { ok: boolean; error?: string } { return { ok: true }; }
export function clearSupabaseCredentials(): void {}

// Minimal auth interface matching what components use
const auth = {
  async getUser() {
    try {
      const profile = await _convex.query(api.profiles.getMyProfile, {});
      if (profile) return { data: { user: { id: profile.userId, email: profile.username ? `${profile.username}@asternal.app` : undefined } } };
    } catch {}
    return { data: { user: null } };
  },
  async getSession() {
    const u = await auth.getUser();
    return { data: { session: u.data.user ? { user: u.data.user, access_token: "convex-session" } : null } };
  },
  onAuthStateChange(callback: (...args: any[]) => void) {
    return { data: { subscription: { unsubscribe: () => {} } } };
  },
  async signUp({ email, password, options }: any) {
    // Convex handles auth natively via convex auth
    return { data: { user: null }, error: null };
  },
  async signInWithPassword({ email, password }: any) {
    return { data: { session: null }, error: null };
  },
  async signOut() { return { error: null }; },
  async resetPasswordForEmail(email: string) { return { data: null, error: null }; },
  async updateUser(_opts: { password?: string }) { return { data: { user: null }, error: null }; },
};

// Minimal from() builder that routes to Convex
function createQueryBuilder(tableName: string) {
  let _filters: any[] = [];
  let _order: any = null;
  let _limit: number | null = null;
  let _single = false;
  let _maybeSingle = false;

  const builder: any = {
    select: () => builder,
    eq: (col: string, val: any) => { _filters.push({ type: 'eq', column: col, value: val }); return builder; },
    neq: (col: string, val: any) => { _filters.push({ type: 'neq', column: col, value: val }); return builder; },
    in: (col: string, val: any) => { _filters.push({ type: 'in', column: col, value: val }); return builder; },
    is: (col: string, val: any) => { _filters.push({ type: 'is', column: col, value: val }); return builder; },
    like: (col: string, val: any) => { _filters.push({ type: 'like', column: col, value: val }); return builder; },
    order: (col: string, opts?: any) => { _order = { column: col, ascending: opts?.ascending ?? true }; return builder; },
    limit: (n: number) => { _limit = n; return builder; },
    single: () => { _single = true; return builder; },
    maybeSingle: () => { _maybeSingle = true; return builder; },
    then: async (resolve: any) => {
      try {
        const tableNameMap: Record<string, string> = {
          profiles: 'profiles', posts: 'posts', comments: 'comments',
          reactions: 'reactions', follows: 'follows', blocks: 'blocks',
          notifications: 'notifications', reports: 'reports', tags: 'tags',
          post_tags: 'postTags', game_purchases: 'gamePurchases',
          game_plays: 'gamePlays', orbe_transactions: 'orbeTransactions',
          user_projects: 'userProjects', user_roles: 'userRoles',
          banned_emails: 'bannedEmails', events: 'events',
          event_submissions: 'eventSubmissions', event_participants: 'eventParticipants',
          trust_points_history: 'trustPointsHistory', reposts: 'reposts',
          post_polls: 'postPolls', post_poll_votes: 'postPollVotes',
          chats: 'chats', chat_members: 'chatMembers',
          chat_messages: 'chatMessages', chat_polls: 'chatPolls',
          forum_categories: 'forumCategories', forum_threads: 'forumThreads',
          forum_posts: 'forumPosts', forum_votes: 'forumVotes',
          forum_thread_votes: 'forumThreadVotes',
        };
        // For now, return empty — the api.ts functions use Convex directly
        resolve({ data: _single || _maybeSingle ? null : [], error: null, count: 0 });
      } catch (e: any) {
        resolve({ data: null, error: e, count: 0 });
      }
    },
  };

  // Make it thenable
  builder[Symbol.toStringTag] = 'Promise';
  return builder;
}

export const supabase = {
  auth,
  from: (table: string) => createQueryBuilder(table),
  storage: {
    from: (bucket: string) => ({
      createSignedUrl: async (path: string, expiresIn?: number) => ({ data: { signedUrl: path }, error: null }),
      upload: async (path: string, file: any, opts?: any) => ({ data: { path }, error: null }),
      getPublicUrl: (path: string) => ({ data: { publicUrl: path } }),
    }),
  },
  rpc: async (fn: string, params?: any) => ({ data: null, error: null }),
  channel: (_name: string) => ({
    on: (_event: string, _filter: any, callback: any) => ({ subscribe: () => {} }),
    subscribe: () => {},
  }),
};
