import { useState, useEffect } from "react";
import {
  X, Loader2, Trophy, Plus, Trash2, Save, Edit3, Award, Star,
} from "lucide-react";
import { type Profile } from "@/lib/social/api";
import { Avatar } from "./Avatar";
import { UserName } from "./UserName";

export interface PortfolioAchievement {
  id: string;
  title: string;
  description: string;
  date: string;
  icon: "trophy" | "star" | "award";
}

export interface Portfolio {
  userId: string;
  headline: string;
  achievements: PortfolioAchievement[];
  updatedAt: string;
}

const STORAGE_KEY = "asternal_portfolios";
const ICON_MAP = { trophy: Trophy, star: Star, award: Award };

function loadPortfolio(userId: string): Portfolio | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const all = JSON.parse(raw) as Record<string, Portfolio>;
    return all[userId] ?? null;
  } catch { return null; }
}

function savePortfolio(p: Portfolio): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const all = raw ? JSON.parse(raw) as Record<string, Portfolio> : {};
    all[p.userId] = { ...p, updatedAt: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch { /* quota */ }
}

function deletePortfolio(userId: string): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const all = JSON.parse(raw) as Record<string, Portfolio>;
    delete all[userId];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch { /* noop */ }
}

/** Panel completo de portafolio — se abre desde el menú de tres puntos */
export function PortfolioPanel({
  userId,
  profile,
  viewingOwn,
  onClose,
}: {
  userId: string;
  profile: Profile;
  viewingOwn: boolean;
  onClose: () => void;
}) {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [editing, setEditing] = useState(false);
  const [headline, setHeadline] = useState("");
  const [achievements, setAchievements] = useState<PortfolioAchievement[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const p = loadPortfolio(userId);
    setPortfolio(p);
    if (p) {
      setHeadline(p.headline);
      setAchievements(p.achievements);
    }
  }, [userId]);

  const addAchievement = () => {
    setAchievements(prev => [
      ...prev,
      {
        id: `ach_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        title: "",
        description: "",
        date: new Date().toISOString().slice(0, 10),
        icon: "trophy" as const,
      },
    ]);
  };

  const removeAchievement = (id: string) => {
    setAchievements(prev => prev.filter(a => a.id !== id));
  };

  const updateAchievement = (id: string, field: keyof PortfolioAchievement, value: string) => {
    setAchievements(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const p: Portfolio = {
        userId,
        headline: headline.trim() || `Portafolio de ${profile.display_name || profile.username}`,
        achievements: achievements.filter(a => a.title.trim()),
        updatedAt: new Date().toISOString(),
      };
      savePortfolio(p);
      setPortfolio(p);
      setEditing(false);
    } finally { setSaving(false); }
  };

  const handleDelete = () => {
    if (!confirm("¿Eliminar tu portafolio?")) return;
    deletePortfolio(userId);
    setPortfolio(null);
    setEditing(false);
    setHeadline("");
    setAchievements([]);
  };

  // ── Vista: sin portafolio ──
  if (!portfolio && !editing) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
        <button aria-label="Cerrar" onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-[2px] animate-in fade-in duration-200" />
        <div className="relative w-full sm:max-w-md rounded-t-2xl sm:rounded-lg border border-border bg-surface shadow-md animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-2 duration-300 max-h-[85vh] flex flex-col">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border/60">
            <div className="w-9 h-9 rounded-lg grid place-items-center shrink-0 bg-primary/10">
              <Trophy size={16} className="text-primary" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-display font-semibold">Portafolio</div>
              <div className="text-[10px] text-muted-foreground">Tus logros en Asternal</div>
            </div>
            <button onClick={onClose}
              className="w-8 h-8 rounded-md border border-border grid place-items-center text-muted-foreground hover:text-foreground active:scale-95 transition">
              <X size={14} />
            </button>
          </div>
          <div className="p-8 text-center space-y-3">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-muted/30 border border-border/30 grid place-items-center">
              <Trophy size={22} className="text-muted-foreground/25" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground/60 font-medium">
                {viewingOwn ? "Aún no tienes portafolio" : `${profile.display_name || profile.username} no tiene portafolio`}
              </div>
              {viewingOwn && (
                <div className="text-[11px] text-muted-foreground/40 mt-1">
                  Crea uno para mostrar tus logros en la plataforma
                </div>
              )}
            </div>
            {viewingOwn && (
              <button onClick={() => setEditing(true)}
                className="h-9 px-4 rounded-lg bg-primary text-white text-xs font-semibold active:scale-95 transition">
                Crear portafolio
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Vista: editor o portafolio existente ──
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button aria-label="Cerrar" onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px] animate-in fade-in duration-200" />
      <div className="relative w-full sm:max-w-md rounded-t-2xl sm:rounded-lg border border-border bg-surface shadow-md animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-2 duration-300 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/60 shrink-0">
          <div className="w-9 h-9 rounded-lg grid place-items-center shrink-0 bg-primary/10">
            <Trophy size={16} className="text-primary" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-display font-semibold">
              {editing ? "Editar portafolio" : "Portafolio"}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {editing ? "Añade tus logros y metas" : (portfolio?.headline ?? "")}
            </div>
          </div>
          {viewingOwn && !editing && (
            <button onClick={() => setEditing(true)}
              className="h-8 px-2.5 rounded-md border border-border bg-surface text-[10px] font-medium text-primary hover:bg-primary/5 active:scale-95 transition flex items-center gap-1">
              <Edit3 size={11} /> Editar
            </button>
          )}
          <button onClick={onClose}
            className="w-8 h-8 rounded-md border border-border grid place-items-center text-muted-foreground hover:text-foreground active:scale-95 transition">
            <X size={14} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {editing ? (
            /* ── Editor ── */
            <div className="p-4 space-y-4">
              {/* User card preview */}
              <div className="flex items-center gap-3 p-3 rounded-xl border border-border/40 bg-card">
                <Avatar p={profile} size={40} rounded="xl" className="border border-border/50" />
                <div className="min-w-0">
                  <UserName p={profile} size="sm" />
                  <div className="text-[10px] font-mono text-muted-foreground truncate">@{profile.username}</div>
                </div>
              </div>

              {/* Headline */}
              <div>
                <div className="text-[11px] font-medium text-muted-foreground mb-1">Titular del portafolio</div>
                <input value={headline} onChange={e => setHeadline(e.target.value)} maxLength={80}
                  placeholder={`Logros de ${profile.display_name || profile.username}`}
                  className="w-full bg-input/50 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40" />
              </div>

              {/* Achievements */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[11px] font-medium text-muted-foreground">Logros ({achievements.length})</div>
                  <button onClick={addAchievement}
                    className="h-7 px-2.5 rounded-md bg-primary/10 text-primary text-[10px] font-semibold flex items-center gap-1 active:scale-95 transition">
                    <Plus size={11} /> Añadir
                  </button>
                </div>
                <div className="space-y-2">
                  {achievements.map(ach => {
                    const Icon = ICON_MAP[ach.icon];
                    return (
                      <div key={ach.id} className="p-2.5 rounded-xl border border-border/40 bg-muted/20 space-y-2">
                        <div className="flex items-start gap-2">
                          <select value={ach.icon} onChange={e => updateAchievement(ach.id, "icon", e.target.value)}
                            className="h-8 w-10 rounded-md bg-card border border-border/50 text-[10px] outline-none">
                            <option value="trophy">🏆</option>
                            <option value="star">⭐</option>
                            <option value="award">🎖️</option>
                          </select>
                          <input value={ach.title} onChange={e => updateAchievement(ach.id, "title", e.target.value)}
                            placeholder="Título del logro" maxLength={60}
                            className="flex-1 h-8 px-2.5 rounded-md bg-card border border-border/50 text-[11px] outline-none focus:border-primary/40" />
                          <button onClick={() => removeAchievement(ach.id)}
                            className="h-8 w-8 rounded-md border border-border/50 grid place-items-center text-red-400 hover:bg-red-50 active:scale-95 transition">
                            <Trash2 size={11} />
                          </button>
                        </div>
                        <input value={ach.description} onChange={e => updateAchievement(ach.id, "description", e.target.value)}
                          placeholder="Descripción (opcional)" maxLength={200}
                          className="w-full h-8 px-2.5 rounded-md bg-card border border-border/50 text-[11px] outline-none focus:border-primary/40" />
                        <input type="date" value={ach.date} onChange={e => updateAchievement(ach.id, "date", e.target.value)}
                          className="h-7 px-2 rounded-md bg-card border border-border/50 text-[10px] font-mono outline-none" />
                      </div>
                    );
                  })}
                  {achievements.length === 0 && (
                    <div className="p-4 text-center text-[11px] text-muted-foreground/40 border border-dashed border-border rounded-xl">
                      Pulsa "Añadir" para crear tu primer logro
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* ── Vista del portafolio ── */
            <div className="p-4 space-y-4">
              {/* User card */}
              <div className="flex items-center gap-3 p-3 rounded-xl border border-border/40 bg-card">
                <Avatar p={profile} size={48} rounded="xl" className="border border-border/50" />
                <div className="min-w-0">
                  <UserName p={profile} size="md" />
                  <div className="text-[10px] font-mono text-muted-foreground truncate">@{profile.username}</div>
                  {portfolio?.headline && (
                    <div className="text-[11px] text-muted-foreground mt-0.5">{portfolio.headline}</div>
                  )}
                </div>
              </div>

              {/* Achievements list */}
              {portfolio && portfolio.achievements.length > 0 ? (
                <div className="space-y-2">
                  {portfolio.achievements.map(ach => {
                    const Icon = ICON_MAP[ach.icon] ?? Trophy;
                    return (
                      <div key={ach.id} className="flex items-start gap-3 p-3 rounded-xl border border-border/40 bg-card hover:border-primary/20 transition">
                        <div className="w-8 h-8 rounded-lg grid place-items-center shrink-0 bg-primary/10">
                          <Icon size={14} className="text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[12px] font-semibold text-foreground">{ach.title}</div>
                          {ach.description && (
                            <div className="text-[11px] text-muted-foreground/60 mt-0.5">{ach.description}</div>
                          )}
                          <div className="text-[9px] font-mono text-muted-foreground/30 mt-1">
                            {new Date(ach.date).toLocaleDateString("es", { year: "numeric", month: "short", day: "numeric" })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 text-center text-[11px] text-muted-foreground/40">
                  Sin logros registrados
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {editing && (
          <div className="px-4 pb-4 pt-3 flex items-center gap-2 shrink-0 border-t border-border/30">
            <button onClick={handleDelete}
              className="h-9 px-3 rounded-lg border border-border bg-surface text-[11px] font-medium text-red-500 hover:bg-red-50 active:scale-95 transition">
              Eliminar
            </button>
            <div className="flex-1" />
            <button onClick={() => { setEditing(false); if (portfolio) { setHeadline(portfolio.headline); setAchievements(portfolio.achievements); } }}
              className="h-9 px-3 rounded-lg border border-border bg-surface text-[11px] font-medium active:scale-95 transition">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving}
              className="h-9 px-4 rounded-lg bg-primary text-white text-[11px] font-semibold active:scale-95 transition disabled:opacity-50 flex items-center gap-1.5">
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              Guardar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
