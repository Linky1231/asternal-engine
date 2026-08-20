import { ConvexClient } from "convex/browser";
import { api } from "../../convex/_generated/api";

// Convex deployment URL — set in .env or use the one from your Convex dashboard
// For local dev: http://localhost:3210
// For production: https://your-deployment.convex.cloud
const CONVEX_URL = import.meta.env.VITE_CONVEX_URL ?? "https://default.convex.cloud";

export const convex = new ConvexClient(CONVEX_URL);
export { api };
