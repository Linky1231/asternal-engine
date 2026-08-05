import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ProfilePanel } from "@/components/social/ProfilePanel";
import { isMod as checkMod, getMyProfile, type Profile } from "@/lib/social/api";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Mi perfil · Asternal" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const navigate = useNavigate();
  const [myId, setMyId] = useState<string | null>(null);
  const [me, setMe] = useState<Profile | null>(null);
  const [mod, setMod] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate({ to: "/auth" }); return; }
      setMyId(session.user.id);
      setMe(await getMyProfile());
      setMod(await checkMod());
    })();
  }, [navigate]);

  if (!myId) return null;
  return (
    <div className="min-h-screen w-screen flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-20 panel border-b backdrop-blur-xl">
        <div className="max-w-2xl md:max-w-3xl lg:max-w-4xl mx-auto flex items-center gap-2 px-3 py-2.5">
          <button onClick={() => navigate({ to: "/" })}
            className="w-9 h-9 rounded-xl border border-border grid place-items-center active:scale-95 transition shrink-0">
            <ArrowLeft size={16} />
          </button>
          <div className="flex-1 min-w-0 font-display text-sm text-primary-glow glow-text truncate">MI PERFIL</div>
          {me?.show_orbes !== false && (
            <Link to="/orbes" title="Panel de Orbes"
              className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/40 active:scale-95 transition shrink-0">
              <Sparkles size={14} className="text-primary" fill="currentColor" />
              <span className="text-xs font-display font-semibold tabular-nums">{me?.orbes ?? 0}</span>
            </Link>
          )}
        </div>
      </header>
      <main className="flex-1 max-w-2xl md:max-w-3xl lg:max-w-4xl mx-auto w-full px-3 py-3 pb-24">
        <ProfilePanel userId={myId} myId={myId} isMod={mod} viewingOwn={true} />
      </main>
    </div>
  );
}
