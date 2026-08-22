import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Users, MessageCircle, Globe, Link2, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  fetchMyDmChats,
  fetchMyGroupChats,
  getCommunityChat,
  sendChatMessage,
  type DmChat,
  type GroupChat,
} from "@/lib/social/chat";

type ShareTarget =
  | { kind: "community"; chatId: string; name: string }
  | { kind: "dm"; chatId: string; name: string; username: string; avatarUrl: string | null }
  | { kind: "group"; chatId: string; name: string; memberCount: number };

export function SharePostModal({
  postId,
  postContent,
  open,
  onClose,
}: {
  postId: string;
  postContent: string;
  open: boolean;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [community, setCommunity] = useState<ShareTarget | null>(null);
  const [dms, setDms] = useState<(ShareTarget & { kind: "dm"; username: string })[]>([]);
  const [groups, setGroups] = useState<ShareTarget[]>([]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setQuery("");
    (async () => {
      try {
        const [dmChats, groupChats, commChat] = await Promise.all([
          fetchMyDmChats().catch(() => [] as DmChat[]),
          fetchMyGroupChats().catch(() => [] as GroupChat[]),
          getCommunityChat().catch(() => null),
        ]);
        if (commChat?.id) {
          setCommunity({ kind: "community", chatId: commChat.id, name: commChat.name });
        }
        setDms(
          dmChats
            .filter((d) => d.chat_id && d.other)
            .map((d) => ({
              kind: "dm" as const,
              chatId: d.chat_id,
              name: d.other!.display_name || d.other!.username,
              username: d.other!.username,
              avatarUrl: d.other!.avatar_url,
            }))
        );
        setGroups(
          groupChats
            .filter((g) => g.chat_id)
            .map((g) => ({
              kind: "group" as const,
              chatId: g.chat_id,
              name: g.name,
              memberCount: g.member_count,
            }))
        );
      } catch {
        /* noop */
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  const shareUrl = `${window.location.origin}/feed?p=${postId}`;
  const shareText = postContent
    ? `${postContent.slice(0, 120)}${postContent.length > 120 ? "…" : ""}\n\n${shareUrl}`
    : shareUrl;

  const handleShare = async (target: ShareTarget) => {
    setSending(target.chatId);
    try {
      if (target.kind === "community") {
        await sendChatMessage(target.chatId, { content: shareText });
      } else if (target.kind === "dm") {
        await sendChatMessage(target.chatId, { content: shareText });
      } else {
        await sendChatMessage(target.chatId, { content: shareText });
      }
      toast.success(`Compartido en ${target.name}`);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al compartir");
    } finally {
      setSending(null);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Enlace copiado");
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  const q = query.toLowerCase();
  const filteredDms = dms.filter(
    (d) =>
      !q ||
      d.name.toLowerCase().includes(q) ||
      d.username.toLowerCase().includes(q)
  );
  const filteredGroups = groups.filter(
    (g) => !q || g.name.toLowerCase().includes(q)
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50"
          style={{ height: "100dvh" }}
          onClick={onClose}
        >
          {/* Backdrop — full viewport, always covers everything */}
          <div className="absolute inset-0 bg-black/50" />

          {/* Panel — bottom sheet on mobile, centered on desktop */}
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-0 left-0 right-0 sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md bg-background border border-border/70 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            style={{ maxHeight: "min(80vh, 80dvh)" }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50">
              <div className="flex-1">
                <div className="text-sm font-semibold">Compartir publicación</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  Elige un chat para compartir
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg grid place-items-center hover:bg-muted/60 transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            {/* Search */}
            <div className="px-4 pt-3 pb-2">
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/40"
                />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar chat..."
                  className="w-full h-9 pl-9 pr-3 rounded-xl bg-muted/30 border border-border/50 text-xs outline-none focus:border-primary/40 transition-colors"
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
              {loading ? (
                <div className="flex items-center justify-center py-10 gap-2 text-xs text-muted-foreground">
                  <Loader2 size={14} className="animate-spin" />
                  Cargando chats…
                </div>
              ) : (
                <>
                  {/* Copy link */}
                  <button
                    onClick={copyLink}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/40 transition-colors text-left"
                  >
                    <div className="w-9 h-9 rounded-xl bg-primary/10 grid place-items-center shrink-0">
                      <Link2 size={15} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium">Copiar enlace</div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        Compartir enlace de la publicación
                      </div>
                    </div>
                  </button>

                  {/* Community chat */}
                  {community && (
                    <ShareRow
                      target={community}
                      sending={sending}
                      onShare={handleShare}
                    />
                  )}

                  {/* Group chats */}
                  {filteredGroups.length > 0 && (
                    <>
                      <div className="flex items-center gap-2 px-3 pt-2 pb-1">
                        <Users size={11} className="text-muted-foreground/50" />
                        <span className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider">
                          Grupos
                        </span>
                      </div>
                      {filteredGroups.map((g) => (
                        <ShareRow
                          key={g.chatId}
                          target={g}
                          sending={sending}
                          onShare={handleShare}
                        />
                      ))}
                    </>
                  )}

                  {/* DMs */}
                  {filteredDms.length > 0 && (
                    <>
                      <div className="flex items-center gap-2 px-3 pt-2 pb-1">
                        <MessageCircle
                          size={11}
                          className="text-muted-foreground/50"
                        />
                        <span className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider">
                          Mensajes directos
                        </span>
                      </div>
                      {filteredDms.map((d) => (
                        <ShareRow
                          key={d.chatId}
                          target={d}
                          sending={sending}
                          onShare={handleShare}
                        />
                      ))}
                    </>
                  )}

                  {!loading &&
                    filteredDms.length === 0 &&
                    filteredGroups.length === 0 &&
                    !community && (
                      <div className="text-center py-8 text-xs text-muted-foreground/50">
                        No hay chats disponibles
                      </div>
                    )}
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ShareRow({
  target,
  sending,
  onShare,
}: {
  target: ShareTarget;
  sending: string | null;
  onShare: (t: ShareTarget) => void;
}) {
  const isSending = sending === target.chatId;
  const icon =
    target.kind === "community" ? (
      <Globe size={15} className="text-primary" />
    ) : target.kind === "group" ? (
      <Users size={15} className="text-primary" />
    ) : (
      <MessageCircle size={15} className="text-primary" />
    );
  const subtitle =
    target.kind === "community"
      ? "Comunidad"
      : target.kind === "group"
        ? `${target.memberCount} miembros`
        : `@${target.kind === "dm" ? target.username : ""}`;

  return (
    <button
      onClick={() => onShare(target)}
      disabled={isSending}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/40 transition-colors text-left disabled:opacity-50"
    >
      <div className="w-9 h-9 rounded-xl bg-primary/10 grid place-items-center shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate">{target.name}</div>
        <div className="text-[10px] text-muted-foreground">{subtitle}</div>
      </div>
      <div className="shrink-0">
        {isSending ? (
          <Loader2 size={14} className="animate-spin text-primary" />
        ) : (
          <Send
            size={14}
            className="text-muted-foreground/30 group-hover:text-primary transition-colors"
          />
        )}
      </div>
    </button>
  );
}
