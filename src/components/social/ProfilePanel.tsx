import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Loader2, Camera, Save, Gamepad2, Newspaper, CheckCircle2, Star, ChevronRight,
  ImagePlus, MapPin, Cake, Palette, Tag, Sparkles as SparklesIcon, Eye, EyeOff,
  Heart, MessageCircle, ChevronDown, ChevronUp, Share2, Link2, Check,
  Youtube, Instagram, Globe, UserPlus, UserCheck, X, Fingerprint, Copy, QrCode,
  MoreVertical, Shield, Trophy, Download,
} from "lucide-react";
import {
  type Profile,
  type PostWithMeta,
  type FollowStats,
  fetchProfileById,
  fetchUserPosts,
  fetchUserGames,
  updateMyProfile,
  getTrustPoints,
  deductTrustPoints,
  restoreTrustPoints,
  DEFAULT_TRUST_POINTS,
  uploadAvatar,
  uploadBanner,
  getMyProfile,
  isPlusActive,
  updatePlusSettings,
  getFollowStats,
  followUser,
  unfollowUser,
  fetchFollowers,
  fetchFollowing,
} from "@/lib/social/api";
import { GameCard } from "./GameCard";
import { PostCard } from "./PostCard";
import { UserName } from "./UserName";
import { Avatar } from "./Avatar";
import { SegmentedControl } from "@/components/ui/segmented";
import { TrustPointsHistory } from "./TrustPointsHistory";
import { SmartStatusPanel } from "./SmartStatusPanel";
import { PortfolioPanel } from "./PortfolioPanel";
import { getUserCode } from "@/lib/social/avatar";

const GENRES = ["Acción", "Aventura", "Puzzle", "RPG", "Estrategia", "Plataformas", "Casual", "Terror", "Simulación", "Deportes"];

export function ProfilePanel({
  userId, myId, isMod, viewingOwn, onProfileChange,
}: {
  userId: string; myId: string | null; isMod: boolean; viewingOwn: boolean;
  onProfileChange?: (p: Profile) => void;
}) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

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
  const [accentColor, setAccentColor] = useState("#6B83D1");
  const [favoriteGenre, setFavoriteGenre] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [birthday, setBirthday] = useState("");
  const [showOrbes, setShowOrbes] = useState(true);
  const [interestsRaw, setInterestsRaw] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<"games" | "posts" | "gallery">("games");

  const [games, setGames] = useState<PostWithMeta[]>([]);
  const [posts, setPosts] = useState<PostWithMeta[]>([]);
  const [artworks, setArtworks] = useState<PostWithMeta[]>([]);
  const [contentLoading, setContentLoading] = useState(false);
  const [follow, setFollow] = useState<FollowStats>({ followers: 0, following: 0, i_follow: false });
  const [followBusy, setFollowBusy] = useState(false);
  const [trustPoints, setTrustPoints] = useState<number>(DEFAULT_TRUST_POINTS);
  const [trustBusy, setTrustBusy] = useState(false);
  const [trustDeductAmt, setTrustDeductAmt] = useState(1);
  const [trustReason, setTrustReason] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [followList, setFollowList] = useState<null | { kind: "followers" | "following"; items: Profile[]; loading: boolean }>(null);
  const [showTrustMenu, setShowTrustMenu] = useState(false);
  const [showTrustPanel, setShowTrustPanel] = useState(false);
  const [showPortfolio, setShowPortfolio] = useState(false);

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
        setAccentColor(p.accent_color ?? "#6B83D1");
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
      const [g, ps, arts] = await Promise.all([
        fetchUserGames(userId),
        fetchUserPosts(userId, { games: false }),
        fetchUserPosts(userId, { artwork: true }),
      ]);
      setGames(g); setPosts(ps); setArtworks(arts);
    } finally { setContentLoading(false); }
  };

  const loadFollow = async () => { try { setFollow(await getFollowStats(userId)); } catch { /* ignore */ } };

  useEffect(() => { load(); loadContent(); loadFollow(); getTrustPoints(userId).then(setTrustPoints).catch(() => {}); /* eslint-disable-next-line */ }, [userId]);

  const toggleFollow = async () => {
    if (followBusy) return;
    setFollowBusy(true);
    try {
      if (follow.i_follow) await unfollowUser(userId);
      else await followUser(userId);
      await loadFollow();
    } finally { setFollowBusy(false); }
  };

  const handleDeductTrust = async () => {
    if (trustBusy || !isMod || viewingOwn) return;
    if (trustDeductAmt < 1) return;
    const reason = trustReason.trim() || "Sin razón especificada";
    if (!confirm(`¿Quitar ${trustDeductAmt} punto(s) de confianza a @${profile?.username}?\nRazón: ${reason}`)) return;
    setTrustBusy(true);
    try {
      const result = await deductTrustPoints(userId, trustDeductAmt, reason);
      setTrustPoints(result.newPoints);
      if (result.banned) {
        alert(`@${profile?.username} alcanzó 0 puntos y fue baneado.`);
      }
      setTrustReason("");
      setTrustDeductAmt(1);
    } catch (e) { alert((e as Error).message); }
    finally { setTrustBusy(false); }
  };

  const handleRestoreTrust = async () => {
    if (trustBusy || !isMod || viewingOwn) return;
    setTrustBusy(true);
    try {
      const newPts = await restoreTrustPoints(userId, 1);
      setTrustPoints(newPts);
    } catch (e) { alert((e as Error).message); }
    finally { setTrustBusy(false); }
  };

  // ─── Compartir perfil: enlace directo + compartir en el chat grupal ───
  const shareLink = typeof window !== "undefined" ? window.location.origin + "/profile/" + userId : "";
  const shareToChat = () => {
    setShareOpen(false);
    try {
      sessionStorage.setItem("asternal_chat_share", shareLink);
      window.dispatchEvent(new CustomEvent("asternal_share_chat", { detail: { text: shareLink, view: "group" as const } }));
    } catch { /* noop */ }
    navigate({ to: "/" });
  };
  const shareDirect = () => {
    setShareOpen(false);
    try {
      sessionStorage.setItem("asternal_chat_share", shareLink);
      window.dispatchEvent(new CustomEvent("asternal_share_chat", { detail: { text: shareLink, view: "dms" as const } }));
    } catch { /* noop */ }
    navigate({ to: "/" });
  };
  const copyLink = async () => {
    setShareOpen(false);
    try { await navigator.clipboard.writeText(shareLink); } catch { /* noop */ }
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 1800);
  };
  const shareMenu = (
    <div className="relative">
      <button onClick={() => setShareOpen(s => !s)}
        className="h-9 px-3 rounded-lg border border-border bg-surface text-xs font-medium flex items-center gap-1.5 active:scale-95 transition">
        <Share2 size={13} /> Compartir
      </button>
      {shareOpen && (
        <div className="absolute right-0 top-full mt-1.5 z-30 rounded-lg border border-border bg-surface p-1 min-w-[220px] shadow-md">
          <button onClick={shareToChat}
            className="flex w-full items-center gap-2 px-3 py-2 rounded-md text-xs hover:bg-muted/60 transition-colors text-left">
            <MessageCircle size={14} className="text-primary shrink-0" /> Compartir en chat grupal
          </button>
          <button onClick={shareDirect}
            className="flex w-full items-center gap-2 px-3 py-2 rounded-md text-xs hover:bg-muted/60 transition-colors text-left">
            <MessageCircle size={14} className="text-primary shrink-0" /> Compartir en chat directo
          </button>
          <button onClick={() => void copyLink()}
            className="flex w-full items-center gap-2 px-3 py-2 rounded-md text-xs hover:bg-muted/60 transition-colors text-left">
            {copiedLink ? <Check size={14} className="text-emerald-500 shrink-0" /> : <Link2 size={14} className="text-primary shrink-0" />}
            {copiedLink ? "¡Enlace copiado!" : "Copiar enlace al perfil"}
          </button>
        </div>
      )}
    </div>
  );

  // Abre la lista de seguidores o de "siguiendo" cargando los perfiles.
  const openFollowList = async (kind: "followers" | "following") => {
    setFollowList({ kind, items: [], loading: true });
    try {
      const items = kind === "followers" ? await fetchFollowers(userId) : await fetchFollowing(userId);
      setFollowList({ kind, items, loading: false });
    } catch {
      setFollowList({ kind, items: [], loading: false });
    }
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
      onProfileChange?.(updated);
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
  const userCode = profile.user_code || getUserCode(profile.id);
  const copyCode = async () => {
    try { await navigator.clipboard.writeText(userCode); } catch { /* noop */ }
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 1600);
  };

  // Marco Plus del avatar: anillo de degradado pegado a la foto (estilo PostCard).
  const frameRing = profile.avatar_frame && isPlusActive(profile) ? frameCss(profile.avatar_frame) : null;
  const avatarButton = (
    <button
      type="button"
      onClick={() => viewingOwn && editing && fileRef.current?.click()}
      className={`relative w-20 h-20 rounded-2xl overflow-hidden border-[3px] border-white block  ${viewingOwn && editing ? "cursor-pointer active:scale-95" : ""}`}
      aria-label="Avatar"
    >
      {/* w-full h-full sin size fijo: la foto rellena exactamente la caja
          interior del botón y overflow-hidden hace el recorte. Antes un size
          fijo (72px) dejaba un hilo blanco entre la foto y el marco Plus. */}
      <Avatar
        p={avatarPreview ? { ...profile, avatar_url: avatarPreview } : profile}
        className="w-full h-full"
        rounded="xl"
      />
      {viewingOwn && editing && (
        <div className="absolute inset-0 bg-black/40 grid place-items-center">
          <Camera size={20} className="text-white" />
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={e => pickAvatar(e.target.files?.[0] ?? null)} />
    </button>
  );

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Header card with banner */}
      <section className="rounded-lg border border-border/70 bg-surface overflow-hidden">
        <div className="relative h-28 grad-brand-soft">
          {bannerPreview && <img src={bannerPreview} alt="banner" className="absolute inset-0 w-full h-full object-cover" />}
          {viewingOwn && editing && (
            <button onClick={() => bannerRef.current?.click()}
              className="absolute right-2 top-2 h-8 px-3 rounded-md bg-black/50 text-white text-[11px] font-medium flex items-center gap-1.5 active:scale-95">
              <ImagePlus size={12}/> Banner
            </button>
          )}
          <input ref={bannerRef} type="file" accept="image/*" className="hidden"
            onChange={e => pickBanner(e.target.files?.[0] ?? null)} />
        </div>

        <div className="p-4 space-y-3">
          <div className="flex items-start gap-3 -mt-12">
            {/* Avatar: marco de degradado ceñido a la foto (mismo lenguaje que PostCard),
                en vez del anillo animado flotante que se veía como un borde roto. */}
            {frameRing ? (
              <div className="relative shrink-0 rounded-2xl p-[2px]" style={{ background: frameRing }}>
                {avatarButton}
              </div>
            ) : (
              avatarButton
            )}


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
                      <span className="px-1.5 py-0.5 rounded-md text-[9px] font-display font-bold text-white shrink-0"
                        style={{ background: "var(--gradient-plus)" }}>PLUS</span>
                    )}
                  </div>
                  <div className="text-[11px] font-mono text-muted-foreground truncate">
                    @{profile.username}{profile.pronouns ? ` · ${profile.pronouns}` : ""}
                  </div>
                  {!editing && (
                    <button onClick={() => void copyCode()}
                      className="mt-1 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted/40 border border-border/50 text-[9px] font-mono text-muted-foreground hover:text-primary-glow hover:border-primary/40 active:scale-95 transition"
                      title="ID de usuario · toca para copiar">
                      <Fingerprint size={10} className="text-primary-glow" />
                      {userCode}
                      {codeCopied ? <Check size={9} className="text-emerald-500" /> : <Copy size={9} className="opacity-60" />}
                    </button>
                  )}
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
                  className="mt-12 h-9 px-3.5 rounded-lg bg-primary text-white text-xs font-semibold flex items-center gap-1.5 active:scale-95 disabled:opacity-60">
                  {saving ? <Loader2 size={12} className="animate-spin" /> : saved ? <CheckCircle2 size={12}/> : <Save size={12} />} Guardar
                </button>
              ) : (
                <div className="mt-12 flex items-center gap-2">
                  <button onClick={() => setEditing(true)}
                    className="h-9 px-3 rounded-lg border border-border bg-surface text-xs font-medium active:scale-95">Editar</button>
                  <button onClick={() => setShowQR(v => !v)}
                    className={`h-9 px-2.5 rounded-lg border text-xs font-medium active:scale-95 flex items-center gap-1 ${showQR ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-surface text-muted-foreground hover:text-foreground"}`}>
                    <QrCode size={13} />
                  </button>
                  {shareMenu}
                  <div className="relative">
                    <button onClick={() => setShowTrustMenu(v => !v)}
                      className="h-9 w-9 rounded-lg border border-border bg-surface grid place-items-center text-muted-foreground hover:text-foreground active:scale-95 transition">
                      <MoreVertical size={14} />
                    </button>
                    {showTrustMenu && (
                      <div className="absolute right-0 top-full mt-1.5 z-30 rounded-lg border border-border bg-surface p-1 min-w-[200px] shadow-md animate-in fade-in slide-in-from-top-1 duration-150">
                        <button onClick={() => { setShowTrustMenu(false); setShowTrustPanel(true); }}
                          className="flex w-full items-center gap-2 px-3 py-2 rounded-md text-xs hover:bg-muted/60 transition-colors text-left">
                          <Shield size={14} className="text-primary shrink-0" /> Puntos de confianza
                        </button>
                        <button onClick={() => { setShowTrustMenu(false); setShowPortfolio(true); }}
                          className="flex w-full items-center gap-2 px-3 py-2 rounded-md text-xs hover:bg-muted/60 transition-colors text-left">
                          <Trophy size={14} className="text-primary shrink-0" /> Portafolio
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            ) : (
              <div className="mt-12 flex items-center gap-2">
                <button onClick={toggleFollow} disabled={followBusy}
                  className={`h-9 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 active:scale-95 disabled:opacity-60 ${follow.i_follow ? "border border-border bg-surface text-foreground" : "bg-primary text-white"}`}>
                  {followBusy ? <Loader2 size={12} className="animate-spin"/> : follow.i_follow ? <><UserCheck size={12}/> Siguiendo</> : <><UserPlus size={12}/> Seguir</>}
                </button>
                <button onClick={() => setShowQR(v => !v)}
                  className={`h-9 px-2.5 rounded-lg border text-xs font-medium active:scale-95 flex items-center gap-1 ${showQR ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-surface text-muted-foreground hover:text-foreground"}`}>
                  <QrCode size={13} />
                </button>
                {shareMenu}
                <div className="relative">
                  <button onClick={() => setShowTrustMenu(v => !v)}
                    className="h-9 w-9 rounded-lg border border-border bg-surface grid place-items-center text-muted-foreground hover:text-foreground active:scale-95 transition">
                    <MoreVertical size={14} />
                  </button>
                  {showTrustMenu && (
                    <div className="absolute right-0 top-full mt-1.5 z-30 rounded-lg border border-border bg-surface p-1 min-w-[200px] shadow-md animate-in fade-in slide-in-from-top-1 duration-150">
                      <button onClick={() => { setShowTrustMenu(false); setShowTrustPanel(true); }}
                        className="flex w-full items-center gap-2 px-3 py-2 rounded-md text-xs hover:bg-muted/60 transition-colors text-left">
                        <Shield size={14} className="text-primary shrink-0" /> Puntos de confianza
                      </button>
                      <button onClick={() => { setShowTrustMenu(false); setShowPortfolio(true); }}
                        className="flex w-full items-center gap-2 px-3 py-2 rounded-md text-xs hover:bg-muted/60 transition-colors text-left">
                        <Trophy size={14} className="text-primary shrink-0" /> Portafolio
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Follow counts (tocables: muestran la lista de personas) */}
          {!editing && (
            <div className="flex items-center gap-1 text-[11px]">
              <button onClick={() => openFollowList("followers")}
                className="flex items-center gap-1 px-2 py-1 -mx-1 rounded-lg hover:bg-muted/40 active:scale-95 transition text-left">
                <b className="text-foreground tabular-nums">{follow.followers}</b>
                <span className="text-muted-foreground">seguidores</span>
              </button>
              <span className="text-muted-foreground/40">·</span>
              <button onClick={() => openFollowList("following")}
                className="flex items-center gap-1 px-2 py-1 -mx-1 rounded-lg hover:bg-muted/40 active:scale-95 transition text-left">
                <b className="text-foreground tabular-nums">{follow.following}</b>
                <span className="text-muted-foreground">siguiendo</span>
              </button>
            </div>
          )}

          {followList && <FollowListModal list={followList} myId={myId} onClose={() => setFollowList(null)} onChanged={loadFollow} />}



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
            <p className="text-xs text-muted-foreground italic">Añade una descripción tocando Editar.</p>
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

          {/* QR Code: personalizable */}
          {!editing && showQR && (
            <div className="pt-3 border-t border-border/30 animate-in fade-in slide-in-from-top-2 duration-200">
              <QRCustomizer userId={userId} username={profile.username ?? "user"} qrStyle={profile.qr_style ?? null} isPlus={viewingOwn && isPlusActive(profile)} viewingOwn={viewingOwn} />
            </div>
          )}

          {/* Extended edit fields — agrupados por sección con etiqueta y
              descripción: cada bloque dice para qué sirve (IDENTIDAD / ESTILO /
              CONTENIDO / PRIVACIDAD) en vez de aparecer todo junto. */}
          {editing && (
            <div className="space-y-2 pt-2 border-t border-border/40">
              <button onClick={() => setShowMore(v => !v)}
                className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground">
                <span>Personalización</span>
                {showMore ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
              </button>
              {showMore && (
                <div className="space-y-2.5">
                  <EditSection label="Identidad" hint="Cómo te presentas ante la comunidad">
                    <div className="grid grid-cols-2 gap-2">
                      <LabeledInput label="Pronombres" value={pronouns} onChange={setPronouns} placeholder="el/ella" max={20}/>
                      <LabeledInput label="Ubicación" value={location} onChange={setLocation} placeholder="Ciudad" max={40}/>
                    </div>
                    <LabeledInput label="Título personalizado" value={customTitle} onChange={setCustomTitle} placeholder="Desarrolladora indie" max={40}/>
                    <div className="grid grid-cols-[64px_1fr] gap-2">
                      <LabeledInput label="Emoji" value={statusEmoji} onChange={setStatusEmoji} placeholder="🎮" max={4}/>
                      <LabeledInput label="Estado" value={statusText} onChange={setStatusText} placeholder="Jugando ahora" max={60}/>
                    </div>
                    <div>
                      <div className="text-[11px] font-medium text-muted-foreground mb-1 flex items-center gap-1"><Cake size={10}/>Cumpleaños</div>
                      <input type="date" value={birthday} onChange={e => setBirthday(e.target.value)}
                        className="w-full bg-input/50 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"/>
                    </div>
                  </EditSection>

                  <EditSection label="Estilo" hint="Tu firma visual en el perfil">
                    <div>
                      <div className="text-[11px] font-medium text-muted-foreground mb-1 flex items-center gap-1"><Palette size={10}/>Color de acento</div>
                      <div className="flex items-center gap-2">
                        <input type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)}
                          className="w-10 h-10 rounded-lg border border-border cursor-pointer bg-transparent"/>
                        <input value={accentColor} onChange={e => setAccentColor(e.target.value)}
                          className="flex-1 bg-input/50 rounded-lg px-2.5 py-1.5 text-xs font-mono outline-none"/>
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] font-medium text-muted-foreground mb-1 flex items-center gap-1"><Gamepad2 size={10}/>Género favorito</div>
                      <div className="flex flex-wrap gap-1">
                        {GENRES.map(g => (
                          <button key={g} onClick={() => setFavoriteGenre(g === favoriteGenre ? "" : g)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] border transition ${favoriteGenre === g ? "bg-primary text-white border-primary" : "border-border bg-surface text-muted-foreground hover:text-foreground"}`}>
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>
                  </EditSection>

                  <EditSection label="Contenido" hint="Etiquetas que describen lo que te gusta">
                    <LabeledInput label="Intereses (separados por coma, máx 10)" value={interestsRaw} onChange={setInterestsRaw} placeholder="pixel art, roguelike, coop" max={200} icon={<Tag size={10}/>}/>
                  </EditSection>

                  <EditSection label="Privacidad" hint="Qué información muestras en el header">
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
                  </EditSection>
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
          className="block relative overflow-hidden rounded-lg border p-4 active:scale-[0.99] transition"
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

      <SegmentedControl
        items={[
          { id: "games", label: <>JUEGOS · {games.length}</>, icon: <Gamepad2 size={13} className="hidden sm:block shrink-0" /> },
          { id: "posts", label: <>POSTS · {posts.length}</>, icon: <Newspaper size={13} className="hidden sm:block shrink-0" /> },
          { id: "gallery", label: <>GALERÍA · {artworks.length}</>, icon: <Palette size={13} className="hidden sm:block shrink-0" /> },
        ]}
        value={tab}
        onChange={setTab}
      />

      <div className="space-y-3">
        {contentLoading ? (
          <div className="p-8 text-center text-xs text-muted-foreground"><Loader2 className="animate-spin inline mr-2" size={14} /></div>
        ) : tab === "games" ? (
          games.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-muted-foreground rounded-lg border border-dashed border-border bg-surface">Sin juegos publicados</div>
          ) : games.map(g => <GameCard key={g.id} post={g} myId={myId} isMod={isMod} onChange={loadContent} />)
        ) : tab === "gallery" ? (
          artworks.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-muted-foreground rounded-lg border border-dashed border-border bg-surface">
              {viewingOwn ? "Aún no has publicado obras en la galería" : "Este artista aún no ha publicado obras"}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {artworks.map(a => {
                const imgUrl = a.signed_media?.[0] ?? a.signed_cover;
                const price = a.price_orbes ?? 0;
                const title = a.content.replace(/^🎨\s*/, "");
                return (
                  <div key={a.id} className="rounded-lg border border-border/70 bg-surface overflow-hidden group">
                    <div className="aspect-square bg-muted/20 relative overflow-hidden">
                      {imgUrl ? (
                        <img src={imgUrl} alt={title} className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-500 ease-out" />
                      ) : (
                        <div className="w-full h-full grid place-items-center"><Palette size={32} className="text-muted-foreground/15" /></div>
                      )}
                      {price > 0 ? (
                        <span className="absolute bottom-2 left-2 px-2.5 py-1 rounded-full text-[9px] font-semibold bg-primary text-white flex items-center gap-1 shadow-sm">
                          <SparklesIcon size={9} /> {price}
                        </span>
                      ) : (
                        <span className="absolute bottom-2 left-2 px-2.5 py-1 rounded-full text-[9px] font-semibold bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">
                          GRATIS
                        </span>
                      )}
                    </div>
                    <div className="p-2.5 space-y-1.5">
                      <div className="text-xs font-display truncate font-semibold tracking-tight">{title}</div>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Heart size={10} className={a.likes > 0 ? "text-rose-400" : ""} /> {a.likes}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageCircle size={10} /> {a.comments_count}
                        </span>
                        <span className="text-[9px] font-mono text-muted-foreground/50 ml-auto">
                          {new Date(a.created_at).toLocaleDateString("es", { month: "short", day: "numeric" })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          posts.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-muted-foreground rounded-lg border border-dashed border-border bg-surface">Sin publicaciones</div>
          ) : posts.map(p => <PostCard key={p.id} post={p} myId={myId} isMod={isMod} onChange={loadContent} />)
        )}
      </div>

      {/* Smart Status */}
      <div className="px-3 py-1">
        <SmartStatusPanel userId={userId} />
      </div>

      {/* Trust Points panel (full, from three-dot menu) */}
      {showTrustPanel && (
        <TrustPointsPanel
          userId={userId}
          trustPoints={trustPoints}
          isMod={isMod}
          viewingOwn={viewingOwn}
          onClose={() => setShowTrustPanel(false)}
          onTrustChange={setTrustPoints}
        />
      )}

      {/* Portfolio panel (from three-dot menu) */}
      {showPortfolio && (
        <PortfolioPanel
          userId={userId}
          profile={profile}
          viewingOwn={viewingOwn}
          onClose={() => setShowPortfolio(false)}
        />
      )}
    </div>
  );
}

/** Panel de código QR — personalizable solo para Plus, sincronizado con DB */
function QRCustomizer({ userId, username, qrStyle, isPlus, viewingOwn }: {
  userId: string; username: string; qrStyle: import("@/lib/social/api").QRStyle | null;
  isPlus: boolean; viewingOwn: boolean;
}) {
  const profileUrl = typeof window !== "undefined" ? `${window.location.origin}/profile/${userId}` : `/profile/${userId}`;
  const defaultStyle = { fg: "#000000", bg: "#ffffff", size: 180, cornerStyle: "square" as const };
  const [style, setStyle] = useState<Required<import("@/lib/social/api").QRStyle> & { cornerStyle: string }>(
    qrStyle ? { ...defaultStyle, ...qrStyle } : defaultStyle
  );
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  // Sync from DB when qrStyle prop changes (e.g. viewing another user's profile)
  useEffect(() => {
    if (qrStyle) setStyle({ ...defaultStyle, ...qrStyle });
  }, [qrStyle?.fg, qrStyle?.bg, qrStyle?.size, qrStyle?.cornerStyle]);

  const persist = async (next: typeof style) => {
    setStyle(next);
    if (viewingOwn && isPlus) {
      setSaving(true);
      try { await updatePlusSettings({ qr_style: next }); } catch { /* noop */ }
      finally { setSaving(false); }
    }
  };

  const PRESETS = [
    { label: "Clásico", fg: "#000000", bg: "#ffffff" },
    { label: "Azul", fg: "#2563eb", bg: "#f0f7ff" },
    { label: "Oscuro", fg: "#ffffff", bg: "#1a1a2e" },
    { label: "Primario", fg: "var(--primary)", bg: "#ffffff" },
    { label: "Gradiente", fg: "#6366f1", bg: "#f5f3ff" },
    { label: "Rosa", fg: "#ec4899", bg: "#fdf2f8" },
  ] as const;

  const SIZES = [120, 160, 200, 240] as const;
  const CORNERS = [
    { id: "square", label: "Cuadrados" },
    { id: "rounded", label: "Redondeados" },
    { id: "dots", label: "Puntos" },
  ] as const;

  const qrSrc = (() => {
    const fg = style.fg.startsWith("#") ? style.fg.replace("#", "") : "000000";
    const bg = style.bg.startsWith("#") ? style.bg.replace("#", "") : "ffffff";
    const sz = style.size || 180;
    return `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(profileUrl)}&size=${sz}x${sz}&margin=6&format=svg&color=${fg}&bgcolor=${bg}`;
  })();

  const handleDownload = async () => {
    try {
      const res = await fetch(qrSrc);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `qr_${username}.svg`; a.click();
      URL.revokeObjectURL(url);
    } catch { /* noop */ }
  };

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(profileUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* noop */ }
  };

  const canCustomize = viewingOwn && isPlus;

  return (
    <div className="space-y-3 animate-in fade-in duration-200">
      {/* Preview */}
      <div className="flex flex-col items-center gap-2">
        <div className="border border-border/40 bg-card shadow-sm" style={{ background: style.bg, borderRadius: style.cornerStyle === "rounded" ? 16 : style.cornerStyle === "dots" ? "50%" : 8, padding: style.cornerStyle === "dots" ? 24 : style.cornerStyle === "rounded" ? 12 : 12 }}>
          <img src={qrSrc} alt={`QR de ${username}`} width={style.size || 180} height={style.size || 180} className="block" />
        </div>
        <div className="text-[9px] font-mono text-muted-foreground/40 text-center truncate max-w-[200px]">{profileUrl}</div>
      </div>

      {/* Botón de guardar (solo Plus propio) */}
      {canCustomize && (
        <div className="text-center">
          {saving && <span className="text-[10px] text-muted-foreground/50">Guardando…</span>}
        </div>
      )}

      {/* Aviso para usuarios no-Plus */}
      {!canCustomize && !viewingOwn && (
        <div className="text-center text-[10px] text-muted-foreground/50">
          Escanea para ver el perfil de {username}
        </div>
      )}

      {!canCustomize && viewingOwn && (
        <div className="text-center py-2 px-3 rounded-lg bg-primary/5 border border-primary/15">
          <div className="text-[11px] text-primary font-medium">Personaliza tu QR con Plus</div>
          <div className="text-[10px] text-muted-foreground/50 mt-0.5">Cambia colores, estilos y tamaño</div>
        </div>
      )}

      {/* Panel de personalización — solo usuarios Plus en su propio perfil */}
      {canCustomize && (
        <div className="space-y-3">
          {/* Presets de color */}
          <div>
            <div className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-1.5">Color</div>
            <div className="flex gap-1.5 flex-wrap">
              {PRESETS.map(p => {
                const active = style.fg === p.fg && style.bg === p.bg;
                return (
                  <button key={p.label} onClick={() => persist({ ...style, fg: p.fg, bg: p.bg })}
                    className={`h-8 px-2.5 rounded-lg text-[10px] font-medium border transition active:scale-95 ${active ? "border-primary/40 bg-primary/10 text-primary" : "border-border/40 bg-surface text-muted-foreground hover:text-foreground"}`}>
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Colores personalizados */}
          <div className="flex gap-3 items-center">
            <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span>Color</span>
              <input type="color" value={style.fg.startsWith("#") ? style.fg : "#000000"} onChange={e => persist({ ...style, fg: e.target.value })}
                className="w-6 h-6 rounded border-0 cursor-pointer bg-transparent" />
            </label>
            <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span>Fondo</span>
              <input type="color" value={style.bg.startsWith("#") ? style.bg : "#ffffff"} onChange={e => persist({ ...style, bg: e.target.value })}
                className="w-6 h-6 rounded border-0 cursor-pointer bg-transparent" />
            </label>
          </div>

          {/* Tamaño */}
          <div>
            <div className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-1.5">Tamaño</div>
            <div className="flex gap-1.5">
              {SIZES.map(s => (
                <button key={s} onClick={() => persist({ ...style, size: s })}
                  className={`h-8 px-2.5 rounded-lg text-[10px] font-mono border transition active:scale-95 ${style.size === s ? "border-primary/40 bg-primary/10 text-primary" : "border-border/40 bg-surface text-muted-foreground hover:text-foreground"}`}>
                  {s}px
                </button>
              ))}
            </div>
          </div>

          {/* Estilo de esquinas */}
          <div>
            <div className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-1.5">Estilo</div>
            <div className="flex gap-1.5">
              {CORNERS.map(c => (
                <button key={c.id} onClick={() => persist({ ...style, cornerStyle: c.id })}
                  className={`h-8 px-2.5 rounded-lg text-[10px] font-medium border transition active:scale-95 ${style.cornerStyle === c.id ? "border-primary/40 bg-primary/10 text-primary" : "border-border/40 bg-surface text-muted-foreground hover:text-foreground"}`}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Acciones */}
      <div className="flex gap-2">
        <button onClick={handleDownload}
          className="flex-1 h-9 rounded-lg border border-border/50 bg-surface text-[11px] font-medium flex items-center justify-center gap-1.5 active:scale-95 transition hover:bg-muted/40">
          <Download size={12} /> Descargar
        </button>
        <button onClick={handleCopy}
          className="flex-1 h-9 rounded-lg border border-border/50 bg-surface text-[11px] font-medium flex items-center justify-center gap-1.5 active:scale-95 transition hover:bg-muted/40">
          {copied ? <><Check size={12} className="text-primary" /> Copiado</> : <><Link2 size={12} /> Copiar enlace</>}
        </button>
      </div>
    </div>
  );
}

/** Panel completo de puntos de confianza — se abre desde el menú de tres puntos */
function TrustPointsPanel({ userId, trustPoints, isMod, viewingOwn, onClose, onTrustChange }: {
  userId: string;
  trustPoints: number;
  isMod: boolean;
  viewingOwn: boolean;
  onClose: () => void;
  onTrustChange: (pts: number) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [deductAmt, setDeductAmt] = useState(1);
  const [reason, setReason] = useState("");

  const handleDeduct = async () => {
    if (busy || !isMod || viewingOwn || deductAmt < 1) return;
    const r = reason.trim() || "Sin razón especificada";
    if (!confirm(`¿Quitar ${deductAmt} punto(s) de confianza?\nRazón: ${r}`)) return;
    setBusy(true);
    try {
      const result = await deductTrustPoints(userId, deductAmt, r);
      onTrustChange(result.newPoints);
      if (result.banned) alert("El usuario alcanzó 0 puntos y fue baneado.");
      setReason(""); setDeductAmt(1);
    } catch (e) { alert((e as Error).message); }
    finally { setBusy(false); }
  };

  const handleRestore = async () => {
    if (busy || !isMod || viewingOwn) return;
    setBusy(true);
    try {
      const newPts = await restoreTrustPoints(userId, 1);
      onTrustChange(newPts);
    } catch (e) { alert((e as Error).message); }
    finally { setBusy(false); }
  };

  const level = trustPoints <= 2 ? "crítico" : trustPoints <= 5 ? "bajo" : "normal";
  const levelColor = trustPoints <= 2 ? "text-red-500" : trustPoints <= 6 ? "text-amber-500" : "text-emerald-500";
  const levelBg = trustPoints <= 2 ? "bg-red-50 border-red-200/60" : trustPoints <= 6 ? "bg-amber-50 border-amber-200/60" : "bg-emerald-50 border-emerald-200/60";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button aria-label="Cerrar" onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px] animate-in fade-in duration-200" />
      <div className="relative w-full sm:max-w-md rounded-t-2xl sm:rounded-lg border border-border bg-surface shadow-md animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-2 duration-300 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/60">
          <div className="w-9 h-9 rounded-lg grid place-items-center shrink-0" style={{ background: "var(--gradient)" }}>
            <Shield size={16} className="text-white" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-display font-semibold">Puntos de confianza</div>
            <div className="text-[10px] text-muted-foreground">Nivel de reputación en la plataforma</div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-md border border-border grid place-items-center text-muted-foreground hover:text-foreground active:scale-95 transition">
            <X size={14} />
          </button>
        </div>

        {/* Score display */}
        <div className={`mx-4 mt-4 p-4 rounded-xl border ${levelBg} text-center`}
          >
          <div className="text-4xl font-display font-bold tabular-nums" style={{ color: "var(--primary)" }}>{trustPoints}</div>
          <div className="text-[11px] text-muted-foreground mt-1">de 10 puntos</div>
          <div className={`text-[10px] font-semibold uppercase tracking-wider mt-2 ${levelColor}`}>Nivel: {level}</div>
          <div className="w-full h-1.5 rounded-full bg-muted/40 mt-3">
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${(trustPoints / DEFAULT_TRUST_POINTS) * 100}%`, background: trustPoints <= 2 ? "#ef4444" : trustPoints <= 6 ? "#f59e0b" : "#10b981" }} />
          </div>
        </div>

        {/* Info */}
        <div className="mx-4 mt-3 p-3 rounded-xl bg-muted/20 border border-border/30">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Los puntos de confianza reflejan tu comportamiento en la plataforma. Si llegan a 0, tu cuenta será bloqueada automáticamente. Los moderadores pueden ajustar puntos según las reglas de la comunidad.
          </p>
        </div>

        {/* Moderator controls */}
        {isMod && !viewingOwn && (
          <div className="mx-4 mt-3 p-3 rounded-xl bg-muted/30 border border-border/30 space-y-2">
            <div className="text-[10px] font-mono uppercase tracking-wider text-primary-glow">Control de moderador</div>
            <div className="flex items-center gap-2">
              <button onClick={handleRestore} disabled={busy || trustPoints >= DEFAULT_TRUST_POINTS}
                className="h-8 px-3 rounded-md border border-border/50 bg-surface text-[11px] font-medium text-primary hover:bg-primary/10 active:scale-95 transition disabled:opacity-40">
                Restaurar +1
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input type="number" min={1} max={10} value={deductAmt}
                onChange={e => setDeductAmt(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                className="w-14 h-8 px-1.5 rounded-md bg-card border border-border/50 text-[11px] text-center font-mono outline-none focus:border-primary/40"
              />
              <input value={reason} onChange={e => setReason(e.target.value)}
                placeholder="Razón para quitar puntos…"
                className="flex-1 h-8 px-2.5 rounded-md bg-card border border-border/50 text-[11px] outline-none focus:border-primary/40 placeholder:text-muted-foreground/30"
              />
              <button onClick={handleDeduct} disabled={busy || trustPoints <= 0}
                className="h-8 px-3 rounded-md bg-red-500 text-white text-[10px] font-semibold active:scale-95 transition disabled:opacity-50">
                {busy ? "…" : "Quitar"}
              </button>
            </div>
          </div>
        )}

        {/* History link */}
        <div className="px-4 pb-4 pt-3">
          <button onClick={() => { onClose(); }}
            className="w-full text-center text-[11px] text-muted-foreground hover:text-primary transition py-2">
            Ver historial completo de puntos
          </button>
        </div>
      </div>
    </div>
  );
}

function FollowListModal({ list, myId, onClose, onChanged }: {
  list: { kind: "followers" | "following"; items: Profile[]; loading: boolean };
  myId: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [items, setItems] = useState<Profile[]>(list.items);
  const [iFollow, setIFollow] = useState<Set<string>>(new Set());

  // Sync items when parent re-renders with new data
  useEffect(() => {
    setItems(list.items);
  }, [list.items]);

  // Estado "¿yo sigo a esta persona?" para cada perfil de la lista.
  useEffect(() => {
    if (!myId || items.length === 0) return;
    let cancelled = false;
    (async () => {
      const set = new Set<string>();
      for (const p of items) {
        if (cancelled) return;
        try {
          const s = await getFollowStats(p.id);
          if (s.i_follow) set.add(p.id);
        } catch { /* ignore */ }
      }
      if (!cancelled) setIFollow(set);
    })();
    return () => { cancelled = true; };
  }, [items, myId]);

  const toggle = async (p: Profile) => {
    if (busyId || !myId) return;
    setBusyId(p.id);
    try {
      if (iFollow.has(p.id)) await unfollowUser(p.id);
      else await followUser(p.id);
      setIFollow(prev => { const n = new Set(prev); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n; });
      onChanged();
    } catch { /* ignore */ } finally { setBusyId(null); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button aria-label="Cerrar" onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px] animate-in fade-in duration-200" />
      <div className="relative w-full sm:max-w-sm rounded-t-2xl sm:rounded-lg border border-border bg-surface shadow-md animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-2 duration-300 max-h-[80vh] flex flex-col">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60">
          <div className="flex-1 text-sm font-semibold">
            {list.kind === "followers" ? "Seguidores" : "Siguiendo"} · {items.length}
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-md border border-border grid place-items-center text-muted-foreground hover:text-foreground active:scale-95 transition">
            <X size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {list.loading ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              <Loader2 className="animate-spin inline mr-2" size={14} /> Cargando…
            </div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              {list.kind === "followers" ? "Aún no tiene seguidores" : "Aún no sigue a nadie"}
            </div>
          ) : (
            items.map(p => (
              <div key={p.id} className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-muted/40 transition">
                <Link to="/profile/$userId" params={{ userId: p.id }} onClick={onClose}
                  className="flex items-center gap-2.5 min-w-0 flex-1">
                  <Avatar p={p} size={36} rounded="xl" className="border border-border/50" />
                  <div className="min-w-0">
                    <UserName p={p} size="sm" />
                    <div className="text-[10px] font-mono text-muted-foreground truncate">@{p.username}</div>
                  </div>
                </Link>
                {myId && myId !== p.id && (
                  <button onClick={() => void toggle(p)} disabled={busyId === p.id}
                    className={`shrink-0 h-8 px-2.5 rounded-md text-[11px] font-medium flex items-center gap-1 active:scale-95 transition disabled:opacity-60 ${iFollow.has(p.id) ? "border border-border text-muted-foreground" : "bg-primary text-white"}`}>
                    {busyId === p.id ? <Loader2 size={11} className="animate-spin" /> : iFollow.has(p.id) ? <><UserCheck size={11} /> Siguiendo</> : <><UserPlus size={11} /> Seguir</>}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/** Bloque de personalización con etiqueta + descripción (separa los apartados). */
function EditSection({ label, hint, children }: {
  label: string; hint: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-2.5 space-y-2">
      <div>
        <div className="text-[9px] font-mono tracking-[0.14em] uppercase text-primary-glow">{label}</div>
        <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>
      </div>
      {children}
    </div>
  );
}

function LabeledInput({ label, value, onChange, placeholder, max, icon }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; max?: number; icon?: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[11px] font-medium text-muted-foreground mb-1 flex items-center gap-1">{icon}{label}</div>
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

/** Gradiente del marco de avatar Plus (mismo set que PostCard). */
function frameCss(id: string): string {
  switch (id) {
    case "aurora": return "linear-gradient(135deg, #1AA6D6, #2FD9D2, #7BE7FF)";
    case "ocean": return "linear-gradient(135deg, #0F6C9E, #1AA6D6, #2FD9D2)";
    case "ice": return "linear-gradient(135deg, #B8ECFF, #7BE7FF, #2FD9D2)";
    case "neon": return "linear-gradient(135deg, #2FD9D2, #B8ECFF, #1AA6D6)";
    default: return "linear-gradient(135deg, #1AA6D6, #2FD9D2)";
  }
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
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] border border-border/60 bg-muted/30 active:scale-95 transition"
          style={{ color: it.color }}>
          {it.icon}<span className="text-foreground">{it.label}</span>
        </a>
      ))}
    </div>
  );
}
