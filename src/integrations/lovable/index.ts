// Client-side stub. @lovable.dev/cloud-auth-js is not available in this environment.
import { supabase } from "../supabase/client";

export const lovable = {
  auth: {
    signInWithOAuth: async (provider: "google" | "apple" | "microsoft" | "lovable", opts?: { redirect_uri?: string }) => {
      if (provider === "google") {
        const { error } = await supabase.auth.signInWithOAuth({ provider: "google" });
        if (error) return { error };
        return { redirected: true };
      }
      return { error: new Error(`OAuth provider "${provider}" not configured`) };
    },
  },
};
