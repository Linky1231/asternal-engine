// Play history and likes tracking (localStorage-based)
import { supabase } from "@/integrations/supabase/client";
import type { PostWithMeta } from "./api";
import { fetchFeed } from "./api";

export type PlaySession = {
  gameId: string;
  gameTitle: string;
  coverUrl: string | null;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
};

/** Log a play session to localStorage */
export function logPlaySession(session: PlaySession): void {
  try {
    const raw = localStorage.getItem("play_history");
    const history: PlaySession[] = raw ? JSON.parse(raw) : [];
    history.unshift(session);
    if (history.length > 500) history.length = 500;
    localStorage.setItem("play_history", JSON.stringify(history));
  } catch { /* ignore quota errors */ }
}

/** Get all play sessions, newest first */
export function getPlayHistory(): PlaySession[] {
  try {
    const raw = localStorage.getItem("play_history");
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

/** Get aggregated play time per game (total seconds) */
export function getAggregatedPlayTime(): Map<string, {
  title: string;
  coverUrl: string | null;
  totalSeconds: number;
  lastPlayed: string;
  sessions: number;
}> {
  const sessions = getPlayHistory();
  const agg = new Map<string, {
    title: string;
    coverUrl: string | null;
    totalSeconds: number;
    lastPlayed: string;
    sessions: number;
  }>();
  for (const s of sessions) {
    if (agg.has(s.gameId)) {
      const existing = agg.get(s.gameId)!;
      existing.totalSeconds += s.durationSeconds;
      existing.sessions += 1;
      if (s.startedAt > existing.lastPlayed) existing.lastPlayed = s.startedAt;
    } else {
      agg.set(s.gameId, {
        title: s.gameTitle,
        coverUrl: s.coverUrl,
        totalSeconds: s.durationSeconds,
        lastPlayed: s.startedAt,
        sessions: 1,
      });
    }
  }
  return agg;
}

/** Format seconds to human-readable string */
export function formatPlayTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours >= 1) return `${hours}h ${minutes}m`;
  if (minutes >= 1) return `${minutes}m`;
  return `${Math.floor(totalSeconds)}s`;
}

/** Get all posts the current user has liked */
export async function getMyLikedPosts(): Promise<PostWithMeta[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data: reactions } = await supabase
    .from("reactions")
    .select("post_id")
    .eq("user_id", user.id)
    .eq("type", "like")
    .order("created_at", { ascending: false })
    .limit(100);
  if (!reactions?.length) return [];
  const postIds = reactions.map((r: { post_id: string }) => r.post_id);
  const ids = [...new Set<string>(postIds)].filter(Boolean);
  if (!ids.length) return [];
  const posts = await fetchFeed();
  return posts.filter(p => ids.includes(p.id));
}
