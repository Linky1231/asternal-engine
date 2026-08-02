import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  checkSchemaReady,
  runSchemaSetup,
  hasSupabaseConfig,
  getSupabaseUrl,
  getSupabaseAnonKey,
  SUPABASE_ACCESS_TOKEN,
  type SetupResult,
} from "@/lib/supabase/setup";
import {
  saveSupabaseCredentials,
} from "@/integrations/supabase/client";
import {
  Database, Loader2, CheckCircle2, AlertTriangle, ShieldCheck, KeyRound, ExternalLink, Plug, RefreshCw, Save, Link2,
} from "lucide-react";

type Status = "checking" | "local" | "ready" | "missing";

export function SupabaseSetupDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [status, setStatus] = useState<Status>("checking");
  const [token, setToken] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [anonInput, setAnonInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SetupResult | null>(null);

  useEffect(() => {
    if (!open) return;
    setResult(null);
    setToken(SUPABASE_ACCESS_TOKEN ?? "");
    setUrlInput(getSupabaseUrl() ?? "");
    setAnonInput(getSupabaseAnonKey() ?? "");
    if (!hasSupabaseConfig()) {
      setStatus("local");
      return;
    }
    setStatus("checking");
    checkSchemaReady().then(ready => setStatus(ready ? "ready" : "missing"));
  }, [open]);

  const doSetup = async () => {
    setBusy(true);
    setResult(null);
    const r = await runSchemaSetup(token);
    setResult(r);
    if (r.ok) setStatus("ready");
    setBusy(false);
  };

  const saveAndConnect = () => {
    saveSupabaseCredentials(urlInput, anonInput);
    window.location.reload();
  };

  const canSave = urlInput.trim().startsWith("https://") && anonInput.trim().length > 20;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md panel border-border/60 rounded-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Database size={18} className="text-primary" />
            Configurar Supabase
          </DialogTitle>
          <DialogDescription>
            Conecta la plataforma a tu base de datos en la nube para sincronizar entre dispositivos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-1">
          {/* ── Estado ── */}
          {status === "checking" && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
              <Loader2 size={14} className="animate-spin" /> Comprobando esquema…
            </div>
          )}

          {status === "local" && (
            <div className="space-y-3">
              <div className="rounded-xl border border-amber-200/60 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-800/40 p-3.5 text-xs text-amber-800 dark:text-amber-300 space-y-2.5">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold">Modo local activo</div>
                    <div className="text-amber-700/80 dark:text-amber-300/70 mt-0.5">
                      La app aún no detecta las claves. Tienes dos opciones:
                    </div>
                  </div>
                </div>

                <div className="font-mono text-[11px] bg-white/70 dark:bg-black/20 rounded-lg px-3 py-2 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="break-all"><b>VITE_SUPABASE_URL</b></span>
                    {getSupabaseUrl() ? (
                      <span className="shrink-0 inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 size={11} /> detectada
                      </span>
                    ) : (
                      <span className="shrink-0 inline-flex items-center gap-1 text-rose-600 dark:text-rose-400">
                        <AlertTriangle size={11} /> falta
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="break-all"><b>VITE_SUPABASE_ANON_KEY</b></span>
                    {getSupabaseAnonKey() ? (
                      <span className="shrink-0 inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 size={11} /> detectada
                      </span>
                    ) : (
                      <span className="shrink-0 inline-flex items-center gap-1 text-rose-600 dark:text-rose-400">
                        <AlertTriangle size={11} /> falta
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Pegar credenciales directamente */}
              <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-3.5 space-y-2.5">
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Link2 size={14} className="shrink-0 mt-0.5 text-primary" />
                  <div>
                    <div className="font-semibold text-foreground">Opción rápida: pega tus claves aquí</div>
                    <div className="mt-0.5">
                      Si no quieres depender de las variables de entorno, pega la URL y la anon key de Supabase
                      (<b>Project Settings → API Keys</b>) y pulsa guardar. Se usará en este navegador al instante.
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground">
                    URL del proyecto
                  </label>
                  <input
                    value={urlInput}
                    onChange={e => setUrlInput(e.target.value)}
                    type="text"
                    placeholder="https://xxxxxxxx.supabase.co"
                    autoComplete="off"
                    spellCheck={false}
                    className="w-full bg-white/70 dark:bg-input/40 border border-border/60 rounded-xl px-3.5 py-2.5 text-sm font-mono outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground">
                    Anon / public key
                  </label>
                  <input
                    value={anonInput}
                    onChange={e => setAnonInput(e.target.value)}
                    type="password"
                    placeholder="sb_publishable_… o eyJhbGciOi…"
                    autoComplete="off"
                    spellCheck={false}
                    className="w-full bg-white/70 dark:bg-input/40 border border-border/60 rounded-xl px-3.5 py-2.5 text-sm font-mono outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"
                  />
                </div>

                <button
                  onClick={saveAndConnect}
                  disabled={!canSave}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground text-xs font-display font-semibold tracking-wider disabled:opacity-40 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-md shadow-primary/20"
                >
                  <Save size={14} /> GUARDAR Y CONECTAR
                </button>
              </div>

              <button
                onClick={() => window.location.reload()}
                className="w-full py-2 rounded-xl border border-amber-300/50 bg-white/70 dark:bg-black/20 text-amber-800 dark:text-amber-300 text-[11px] font-semibold tracking-wide hover:bg-white dark:hover:bg-black/30 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
              >
                <RefreshCw size={12} /> RECARGAR LA APP PARA DETECTAR LAS CLAVES DE KEYS
              </button>
            </div>
          )}

          {status === "ready" && (
            <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/60 dark:bg-emerald-950/20 dark:border-emerald-800/40 p-3.5 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
              <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">¡Esquema listo!</div>
                <div className="text-emerald-700/80 dark:text-emerald-300/70 mt-0.5">
                  Supabase está conectado y la base de datos está creada. Todo sincroniza entre dispositivos.
                </div>
              </div>
            </div>
          )}

          {status === "missing" && (
            <div className="space-y-3">
              <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-3.5 text-xs text-muted-foreground space-y-2">
                <div className="flex items-start gap-2">
                  <ShieldCheck size={14} className="shrink-0 mt-0.5 text-primary" />
                  <div>
                    <div className="font-semibold text-foreground">La base de datos está vacía</div>
                    <div className="mt-0.5">
                      Tu clave anon no puede crear tablas (es una medida de seguridad de Supabase).
                      Pega tu <b>token de acceso personal</b> y la app creará todo el esquema automáticamente.
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                  <KeyRound size={12} /> Token de acceso personal (sbp_…)
                </label>
                <input
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  type="password"
                  placeholder="sbp_xxxxxxxxxxxxxxxx"
                  autoComplete="off"
                  className="w-full bg-white/70 dark:bg-input/40 border border-border/60 rounded-xl px-3.5 py-2.5 text-sm font-mono outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"
                />
                <p className="text-[10px] text-muted-foreground/50 leading-relaxed flex items-start gap-1.5">
                  <ExternalLink size={10} className="shrink-0 mt-0.5" />
                  Cómo obtenerlo: Supabase Dashboard → <b>Account → Access Tokens → Generate new token</b>.
                  El token solo se usa para esta instalación y no se guarda.
                </p>
              </div>

              <button
                onClick={doSetup}
                disabled={busy || !token.trim().startsWith("sbp_")}
                className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-display font-semibold tracking-wider disabled:opacity-40 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-md shadow-primary/20"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Plug size={14} />}
                {busy ? "CREANDO ESQUEMA…" : "CREAR ESQUEMA AUTOMÁTICAMENTE"}
              </button>

              {result && (
                <div className={`rounded-xl border p-3 text-[11px] flex items-start gap-2 ${
                  result.ok
                    ? "border-emerald-200/60 bg-emerald-50/60 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-300"
                    : "border-rose-200/60 bg-rose-50/60 text-rose-800 dark:bg-rose-950/20 dark:text-rose-300"
                }`}>
                  {result.ok ? <CheckCircle2 size={13} className="shrink-0 mt-0.5" /> : <AlertTriangle size={13} className="shrink-0 mt-0.5" />}
                  <span className="break-words">{result.message}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
