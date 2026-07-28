import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Loader2, Camera, Save, Gamepad2, Newspaper, CheckCircle2, Star, ChevronRight,
  ImagePlus, MapPin, Cake, Palette, Tag, Sparkles as SparklesIcon, Eye, EyeOff,
  Heart, ChevronDown, ChevronUp,
  Youtube, Instagram, Globe, UserPlus, UserCheck,
} from "lucide-react";
import {
  type Profile,
  type PostWithMeta,
  type FollowStats,
  fetchProfileById,
  fetchUserPosts,
  updateMyProfile,
  uploadAvatar,
  uploadBanner,
  getMyProfile,
  isPlusActive,
  getFollowStats,
  followUser,
  unfollowUser,
} from "@/lib/social/api";
import { GameCard } from "./GameCard";
import { PostCard } from "./PostCard";
import { UserName } from "./UserName";

const GENRES = ["Acción", "Aventura", "Puzzle", "RPG", "Estrategia", "Plataformas", "Casual", "Terror", "Simulación", "Deportes"];

export function ProfilePanel({
  userId, myId, isMod, viewingOwn,
}: {
  userId: string; myId: string | null; isMod: boolean; viewingOwn: boolean;
}) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [showMore, setShowMore] = useState(false);

  // form state
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [pronouns, setPronouns] = useState("");
  const [location, setLocation] = useState("");
  const [statusEmoji, setStatusEmoji] = useState("");
  const [statusText, setStatusText] = useState("");
  const [accentColor, setAccentColor] = useState("#1AA6D6");
  const [favoriteGenre, setFavoriteGenre] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [birthday, setBirthday] = useState("");
  const [showOrbes, setShowOrbes] = useState(true);
  const [interestsRaw, setInterestsRaw] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<"games" | "posts">("games");
  const [games, setGames] = useState<PostWithMeta[]>([]);
  const [posts, setPosts] = useState<PostWithMeta[]>([]);
  const [contentLoading, setContentLoading] = useState(false);
  const [follow, setFollow] = useState<FollowStats>({ followers: 0, following: 0, i_follow: false });
  const [followBusy, setFollowBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const p = viewingOwn ? await getMyProfile() : await fetchProfileById(userId);
      setProfile(p);
      if (p) {
        setUsername(p.username ?? "");
        setDisplayName(p.display_name ?? "");
        setBio(p.bio ?? "");
        setAvatarPreview(p.avatar_url ?? null);
        setBannerPreview(p.banner_url ?? null);
        setPronouns(p.pronouns ?? "");
        setLocation(p.location ?? "");
        setStatusEmoji(p.status_emoji ?? "");
        setStatusText(p.status_text ?? "");
        setAccentColor(p.accent_color ?? "#1AA6D6");
        setFavoriteGenre(p.favorite_genre ?? "");
        setCustomTitle(p.custom_title ?? "");
        setBirthday(p.birthday ?? "");
        setShowOrbes(p.show_orbes ?? true);
        setInterestsRaw((p.interests ?? []).join(", "));
      }
    } finally { setLoading(false); }
  };

  const loadContent = async () => {
    setContentLoading(true);
    try {
      const [g, ps] = await Promise.all([
        fetchUserPosts(userId, { games: true }),
        fetchUserPosts(userId, { games: false }),
      ]);
      setGames(g); setPosts(ps);
    } finally { setContentLoading(false); }
  };

  const loadFollow = async () => { try { setFollow(await getFollowStats(userId)); } catch { /* ignore */ } };

  useEffect(() => { load(); loadContent(); loadFollow(); /* eslint-disable-next-line */ }, [userId]);

  const toggleFollow = async () => {
    if (followBusy) return;
    setFollowBusy(true);
    try {
      if (follow.i_follow) await unfollowUser(userId);
      else await followUser(userId);
      await loadFollow();
    } finally { setFollowBusy(false); }
  };

  const pickAvatar = (f: File | null) => {
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { setErr("Avatar máx 5MB"); return; }
    setAvatarFile(f); setAvatarPreview(URL.createObjectURL(f));
  };
  const pickBanner = (f: File | null) => {
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) { setErr("Banner máx 8MB"); return; }
    setBannerFile(f); setBannerPreview(URL.createObjectURL(f));
  };

  const save = async () => {
    setSaving(true); setErr(null);
    try {
      let avatar_url: string | undefined;
      let banner_url: string | undefined;
      if (avatarFile) avatar_url = await uploadAvatar(avatarFile);
      if (bannerFile) banner_url = await uploadBanner(bannerFile);
      const interests = interestsRaw.split(",").map(s => s.trim()).filter(Boolean).slice(0, 10);
      const updated = await updateMyProfile({
        username, display_name: displayName, bio,
        pronouns, location, status_emoji: statusEmoji, status_text: statusText,
        accent_color: accentColor, favorite_genre: favoriteGenre, custom_title: customTitle,
        birthday: birthday || null, show_orbes: showOrbes, interests,
        ...(avatar_url ? { avatar_url } : {}),
        ...(banner_url ? { banner_url } : {}),
      });
      setProfile(updated);
      setEditing(false);
      setAvatarFile(null); setBannerFile(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (e) { setErr((e as Error).message); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="p-8 text-center text-xs text-muted-foreground"><Loader2 className="animate-spin inline mr-2" size={14} />Cargando…</div>;
  if (!profile) return <div className="p-8 text-center text-xs text-muted-foreground">Perfil no encontrado</div>;

  const interestsList = (profile.interests ?? []).filter(Boolean);

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Header card with banner */}
      <section className="panel rounded-2xl border border-border/50 overflow-hidden">
        <div className="relative h-28 bg-gradient-to-br from-primary/25 to-accent/25">
          {bannerPreview && <img src={bannerPreview} alt="banner" className="absolute inset-0 w-full h-full object-cover" />}
          {viewingOwn && editing && (
            <button onClick={() => bannerRef.current?.click()}
              className="absolute right-2 top-2 h-8 px-3 rounded-lg bg-black/50 text-white text-[10px] font-display tracking-widest flex items-center gap-1 active:scale-95">
              <ImagePlus size={12}/> BANNER
            </button>
          )}
          <input ref={bannerRef} type="file" accept="image/*" className="hidden"
            onChange={e => pickBanner(e.target.files?.[0] ?? null)} />
        </div>

        <div className="p-4 space-y-3">
          <div className="flex items-start gap-3 -mt-12">
            {/* Avatar frame wrapper (overflow visible so animated frame shows) */}
            <div className={`relative shrink-0 rounded-2xl ${profile.avatar_frame && isPlusActive(profile) ? `plus-frame plus-frame-${profile.avatar_frame}` : ""}`}>
              <button
                type="button"
                onClick={() => viewingOwn && editing && fileRef.current?.click()}
                className={`relative w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/40 to-accent/30 grid place-items-center overflow-hidden border-4 border-background ${viewingOwn && editing ? "cursor-pointer active:scale-95" : ""}`}
              >
                {avatarPreview ? (
                  <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="font-display text-2xl text-primary-glow">
                    {(profile.display_name ?? profile.username ?? "?")[0]?.toUpperCase()}
                  </span>
                )}
                {viewingOwn && editing && (
                  <div className="absolute inset-0 bg-black/40 grid place-items-center">
                    <Camera size={20} className="text-white" />
                  </div>
                )}
                <input ref={fileRef} type="file" accept="image/*" className="hidden"
                  onChange={e => pickAvatar(e.target.files?.[0] ?? null)} />
              </button>
            </div>


            <div className="flex-1 min-w-0 pt-12">
              {editing ? (
                <div className="space-y-2">
                  <input value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={40} placeholder="Nombre"
                    className="w-full bg-input/50 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/40" />
                  <input value={username} onChange={e => setUsername(e.target.value)} maxLength={24} placeholder="usuario"
                    className="w-full bg-input/50 rounded-lg px-2.5 py-1.5 text-xs font-mono outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <UserName p={profile} size="lg" showBadge={false} />
                    {isPlusActive(profile) && profile.show_plus_badge !== false && (
                      <span className="px-1.5 py-0.5 rounded-md text-[9px] font-display tracking-widest text-white shrink-0"
                        style={{ background: "var(--gradient-plus)" }}>PLUS</span>
                    )}
                  </div>
                  <div className="text-[11px] font-mono text-muted-foreground truncate">
                    @{profile.username}{profile.pronouns ? ` · ${profile.pronouns}` : ""}
                  </div>
                  {profile.custom_title && (
                    <div className="text-[11px] mt-0.5" style={{ color: profile.accent_color ?? "var(--primary)" }}>
                      {profile.custom_title}
                    </div>
                  )}
                </>
              )}
            </div>

            {viewingOwn ? (
              editing ? (
                <button onClick={save} disabled={saving}
                  className="mt-12 px-3 py-1.5 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground text-[10px] font-display tracking-widest flex items-center gap-1 active:scale-95 disabled:opacity-60">
                  {saving ? <Loader2 size={12} className="animate-spin" /> : saved ? <CheckCircle2 size={12}/> : <Save size={12} />} GUARDAR
                </button>
              ) : (
                <button onClick={() => setEditing(true)}
                  className="mt-12 px-3 py-1.5 rounded-xl border border-border text-[10px] font-display tracking-widest active:scale-95">EDITAR</button>
              )
            ) : (
              <button onClick={toggleFollow} disabled={followBusy}
                className={`mt-12 px-3 py-1.5 rounded-xl text-[10px] font-display tracking-widest flex items-center gap-1 active:scale-95 disabled:opacity-60 ${follow.i_follow ? "border border-border text-muted-foreground" : "bg-gradient-to-r from-primary to-accent text-primary-foreground"}`}>
                {followBusy ? <Loader2 size={12} className="animate-spin"/> : follow.i_follow ? <><UserCheck size={12}/> SIGUIENDO</> : <><UserPlus size={12}/> SEGUIR</>}
              </button>
            )}
          </div>

          {/* Follow counts */}
          {!editing && (
            <div className="flex items-center gap-4 text-[11px]">
              <span><b className="text-foreground tabular-nums">{follow.followers}</b> <span className="text-muted-foreground">seguidores</span></span>
              <span><b className="text-foreground tabular-nums">{follow.following}</b> <span className="text-muted-foreground">siguiendo</span></span>
            </div>
          )}

          {/* Social links (Plus feature, always shown if present and Plus active) */}
          {!editing && isPlusActive(profile) && profile.social_links && (
            <SocialLinksRow links={profile.social_links} />
          )}

          {/* Status pill */}
          {!editing && (profile.status_text || profile.status_emoji) && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/40 text-xs">
              {profile.status_emoji && <span>{profile.status_emoji}</span>}
              {profile.status_text && <span className="text-muted-foreground">{profile.status_text}</span>}
            </div>
          )}

          {editing ? (
            <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} maxLength={280}
              placeholder="Cuéntanos sobre ti…"
              className="w-full bg-input/50 rounded-lg px-3 py-2 text-sm outline-none resize-none focus:ring-2 focus:ring-primary/40" />
          ) : profile.bio ? (
            <p className="text-sm whitespace-pre-wrap break-words">{profile.bio}</p>
          ) : viewingOwn ? (
            <p className="text-xs text-muted-foreground italic">Añade una descripción tocando EDITAR.</p>
          ) : null}

          {/* Meta chips */}
          {!editing && (
            <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
              {profile.location && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted/30"><MapPin size={10}/>{profile.location}</span>}
              {profile.birthday && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted/30"><Cake size={10}/>{new Date(profile.birthday).toLocaleDateString()}</span>}
              {profile.favorite_genre && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted/30"><Heart size={10}/>{profile.favorite_genre}</span>}
            </div>
          )}

          {/* Interests */}
          {!editing && interestsList.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {interestsList.map((t, i) => (
                <span key={i} className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                  style={{ background: `color-mix(in oklab, ${profile.accent_color ?? "var(--primary)"} 15%, transparent)`, color: profile.accent_color ?? "var(--primary)" }}>
                  #{t}
                </span>
              ))}
            </div>
          )}

          {/* Extended edit fields */}
          {editing && (
            <div className="space-y-2 pt-2 border-t border-border/40">
              <button onClick={() => setShowMore(v => !v)}
                className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-[11px] font-display tracking-widest text-muted-foreground hover:text-foreground">
                <span>PERSONALIZACIÓN</span>
                {showMore ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
              </button>
              {showMore && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <LabeledInput label="Pronombres" value={pronouns} onChange={setPronouns} placeholder="ella/elle" max={20}/>
                    <LabeledInput label="Ubicación" value={location} onChange={setLocation} placeholder="Ciudad" max={40}/>
                  </div>
                  <LabeledInput label="Título personalizado" value={customTitle} onChange={setCustomTitle} placeholder="Desarrolladora indie" max={40}/>
                  <div className="grid grid-cols-[64px_1fr] gap-2">
                    <LabeledInput label="Emoji" value={statusEmoji} onChange={setStatusEmoji} placeholder="🎮" max={4}/>
                    <LabeledInput label="Estado" value={statusText} onChange={setStatusText} placeholder="Jugando ahora" max={60}/>
                  </div>
                  <div>
                    <div className="text-[10px] font-display tracking-widest text-muted-foreground mb-1 flex items-center gap-1"><Cake size={10}/>CUMPLEAÑOS</div>
                    <input type="date" value={birthday} onChange={e => setBirthday(e.target.value)}
                      className="w-full bg-input/50 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"/>
                  </div>
                  <div>
                    <div className="text-[10px] font-display tracking-widest text-muted-foreground mb-1 flex items-center gap-1"><Palette size={10}/>COLOR DE ACENTO</div>
                    <div className="flex items-center gap-2">
                      <input type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)}
                        className="w-10 h-10 rounded-lg border border-border cursor-pointer bg-transparent"/>
                      <input value={accentColor} onChange={e => setAccentColor(e.target.value)}
                        className="flex-1 bg-input/50 rounded-lg px-2.5 py-1.5 text-xs font-mono outline-none"/>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-display tracking-widest text-muted-foreground mb-1 flex items-center gap-1"><Gamepad2 size={10}/>GÉNERO FAVORITO</div>
                    <div className="flex flex-wrap gap-1">
                      {GENRES.map(g => (
                        <button key={g} onClick={() => setFavoriteGenre(g === favoriteGenre ? "" : g)}
                          className={`px-2.5 py-1 rounded-full text-[11px] border transition ${favoriteGenre === g ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}>
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>
                  <LabeledInput label="Intereses (separados por coma, máx 10)" value={interestsRaw} onChange={setInterestsRaw} placeholder="pixel art, roguelike, coop" max={200} icon={<Tag size={10}/>}/>
                  <label className="flex items-center gap-2 px-2 py-2 rounded-lg border border-border cursor-pointer">
                    <button type="button" onClick={() => setShowOrbes(v => !v)}
                      className={`w-9 h-5 rounded-full transition relative ${showOrbes ? "bg-primary" : "bg-muted"}`}>
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition ${showOrbes ? "left-4" : "left-0.5"}`}/>
                    </button>
                    <span className="text-xs flex-1 flex items-center gap-1">
                      {showOrbes ? <Eye size={12}/> : <EyeOff size={12}/>}
                      Mostrar orbes en el header
                    </span>
                  </label>
                </div>
              )}
            </div>
          )}

          {err && <div className="text-xs text-destructive">{err}</div>}
        </div>
      </section>

      {/* Centro Plus card (unified — appears here for own profile) */}
      {viewingOwn && (
        <Link
          to="/plus"
          className="block relative overflow-hidden rounded-2xl border p-4 active:scale-[0.99] transition"
          style={{
            borderColor: "color-mix(in oklab, var(--plus) 40%, transparent)",
            background: "linear-gradient(135deg, color-mix(in oklab, var(--plus) 15%, transparent), transparent)",
          }}
        >
          <div className="relative flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl grid place-items-center text-white shrink-0"
              style={{ background: "var(--gradient-plus)" }}>
              <Star size={20} fill="currentColor" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-display text-base font-bold">Centro Plus</div>
              <div className="text-[11px] text-muted-foreground">
                {profile.is_plus ? "Gestiona tus beneficios activos" : "Suscríbete y desbloquea todo"}
              </div>
            </div>
            <ChevronRight size={18} style={{ color: "var(--plus)" }} />
          </div>
        </Link>
      )}

      <div className="relative flex bg-muted/40 rounded-2xl p-1">
        <button onClick={() => setTab("games")}
          className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-display tracking-widest transition-colors ${tab === "games" ? "text-primary-foreground" : "text-muted-foreground"}`}>
          <Gamepad2 size={14} /> JUEGOS · {games.length}
        </button>
        <button onClick={() => setTab("posts")}
          className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-display tracking-widest transition-colors ${tab === "posts" ? "text-primary-foreground" : "text-muted-foreground"}`}>
          <Newspaper size={14} /> POSTS · {posts.length}
        </button>
        <div className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-xl bg-gradient-to-r from-primary to-accent shadow-[0_4px_14px_-4px_oklch(0.68_0.21_250/0.55)] transition-transform duration-300 ease-out"
          style={{ transform: `translateX(${tab === "games" ? "0%" : "calc(100% + 8px)"})` }} />
      </div>

      <div className="space-y-3">
        {contentLoading ? (
          <div className="p-8 text-center text-xs text-muted-foreground"><Loader2 className="animate-spin inline mr-2" size={14} /></div>
        ) : tab === "games" ? (
          games.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground panel rounded-2xl border border-dashed border-border">Sin juegos publicados</div>
          ) : games.map(g => <GameCard key={g.id} post={g} myId={myId} isMod={isMod} onChange={loadContent} />)
        ) : (
          posts.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground panel rounded-2xl border border-dashed border-border">Sin publicaciones</div>
          ) : posts.map(p => <PostCard key={p.id} post={p} myId={myId} isMod={isMod} onChange={loadContent} />)
        )}
      </div>
    </div>
  );
}

function LabeledInput({ label, value, onChange, placeholder, max, icon }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; max?: number; icon?: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[10px] font-display tracking-widest text-muted-foreground mb-1 flex items-center gap-1">{icon}{label}</div>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} maxLength={max}
        className="w-full bg-input/50 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"/>
    </div>
  );
}

function TikTokIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19.6 6.7a5.1 5.1 0 0 1-3.3-1.2 5.2 5.2 0 0 1-1.6-3H11v12.4a2.6 2.6 0 1 1-2.6-2.6c.3 0 .5 0 .8.1V8.7a6.4 6.4 0 1 0 5.5 6.3V9.5c1.3.9 2.9 1.5 4.6 1.5V7.6c-.3 0-.5-.1-.7-.2Z"/>
    </svg>
  );
}

function SocialLinksRow({ links }: { links: import("@/lib/social/api").SocialLinks }) {
  const items: { key: string; url: string | undefined; icon: React.ReactNode; color: string; label: string }[] = [
    { key: "youtube", url: links.youtube, icon: <Youtube size={14} />, color: "#FF0033", label: "YouTube" },
    { key: "tiktok", url: links.tiktok, icon: <TikTokIcon />, color: "#000", label: "TikTok" },
    { key: "instagram", url: links.instagram, icon: <Instagram size={14} />, color: "#E1306C", label: "Instagram" },
    { key: "website", url: links.website, icon: <Globe size={14} />, color: "var(--primary)", label: "Web" },
  ].filter(x => !!x.url && String(x.url).trim().length > 0) as never;
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(it => (
        <a key={it.key} href={/^https?:\/\//.test(it.url!) ? it.url! : `https://${it.url}`}
          target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] border border-border/60 bg-muted/30 active:scale-95 transition"
          style={{ color: it.color }}>
          {it.icon}<span className="text-foreground">{it.label}</span>
        </a>
      ))}
    </div>
  );
}
