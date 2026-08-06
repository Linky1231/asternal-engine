import { supabase } from "@/integrations/supabase/client";
import { cloudSaveProject, cloudListProjects, type CloudProject } from "@/lib/social/api";
import {
  saveProjectById,
  setProjectCloudId,
  getProjectCloudId,
  createProject,
  listProjects,
  loadProjectById,
  getCurrentProjectId,
  setCurrentProjectId,
} from "./storage";
import type { Project } from "./core";

let pushTimer: ReturnType<typeof setTimeout> | null = null;

/** Debounced push of a locally-saved project to the cloud (fire & forget). */
export function schedulePushToCloud(localId: string, project: Project) {
  if (typeof window === "undefined") return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const cloudId = getProjectCloudId(localId);
      const saved = await cloudSaveProject({ id: cloudId, name: project.name || "Untitled Game", data: project });
      if (!cloudId) setProjectCloudId(localId, saved.id);
    } catch { /* silent */ }
  }, 1500);
}

/** Import all cloud projects that are not present locally. Returns newly created local ids. */
export async function importCloudMissing(): Promise<{ imported: number; total: number }> {
  const list = await cloudListProjects();
  let imported = 0;
  for (const c of list) {
    const already = existsLocalWithCloud(c.id);
    if (already) continue;
    const localId = createProject(c.name);
    saveProjectById(localId, c.data as Project);
    setProjectCloudId(localId, c.id);
    imported++;
  }
  return { imported, total: list.length };
}

function existsLocalWithCloud(cloudId: string): boolean {
  try {
    const raw = localStorage.getItem("asternal:projects:index");
    if (!raw) return false;
    const arr = JSON.parse(raw) as Array<{ cloudId?: string }>;
    return arr.some(x => x.cloudId === cloudId);
  } catch { return false; }
}

export async function fetchCloudProjects(): Promise<CloudProject[]> {
  return cloudListProjects();
}

/**
 * Sincronización completa en ambos sentidos:
 *  1. Sube a la nube los proyectos locales que aún no tienen cloudId (backup).
 *  2. Descarga e importa los proyectos de la nube que no existen en este
 *     dispositivo (para que aparezcan al entrar con la misma cuenta en otro
 *     dispositivo).
 * Devuelve cuántos se subieron y cuántos se importaron.
 */
export async function syncAllProjects(): Promise<{ pushed: number; imported: number }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { pushed: 0, imported: 0 };

  // 1) Subir proyectos locales que todavía no están respaldados en la nube.
  let pushed = 0;
  for (const m of listProjects()) {
    if (getProjectCloudId(m.id)) continue; // ya respaldado
    const p = loadProjectById(m.id);
    if (!p) continue;
    try {
      const saved = await cloudSaveProject({ id: undefined, name: p.name || m.name, data: p });
      setProjectCloudId(m.id, saved.id);
      pushed++;
    } catch {
      /* sin sesión, esquema sin crear o red caída: se sigue con el siguiente */
    }
  }

  // 2) Importar proyectos de la nube que no existan en este dispositivo.
  let imported = 0;
  try {
    const list = await cloudListProjects();
    // createProject() marca el proyecto como "actual"; lo restauramos al final
    // para que importar en segundo plano no cambie el proyecto abierto.
    const prevCurrent = getCurrentProjectId();
    for (const c of list) {
      if (existsLocalWithCloud(c.id)) continue;
      const localId = createProject(c.name);
      saveProjectById(localId, c.data as Project);
      setProjectCloudId(localId, c.id);
      imported++;
    }
    if (prevCurrent) setCurrentProjectId(prevCurrent);
  } catch {
    /* esquema sin crear / red caída: no se importa nada */
  }

  return { pushed, imported };
}
