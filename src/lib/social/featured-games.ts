const STORAGE_KEY = "asternal_featured_game_ids";
const MAX_FEATURED = 6;

/** Get the IDs of games marked as featured by admins. */
export function getFeaturedGameIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const ids = JSON.parse(raw);
    return Array.isArray(ids) ? ids.filter((id: unknown) => typeof id === "string").slice(0, MAX_FEATURED) : [];
  } catch {
    return [];
  }
}

/** Set the full list of featured game IDs (admin action). */
export function setFeaturedGameIds(ids: string[]): void {
  const unique = Array.from(new Set(ids)).slice(0, MAX_FEATURED);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(unique));
}

/** Toggle a single game ID in the featured list. Returns the new list. */
export function toggleFeaturedGame(id: string): string[] {
  const current = getFeaturedGameIds();
  const next = current.includes(id)
    ? current.filter(x => x !== id)
    : [...current, id].slice(0, MAX_FEATURED);
  setFeaturedGameIds(next);
  return next;
}
