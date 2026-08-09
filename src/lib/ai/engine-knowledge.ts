// Conocimiento del motor para Orión: se importa como texto crudo (Vite ?raw)
// para evitar problemas de escapes. Se regenera desde src/lib/engine/*.ts.
import knowledge from "./engine-knowledge.md?raw";

export const ENGINE_KNOWLEDGE: string = knowledge;

export const ENGINE_MODULE_SUMMARY = {
  core: "Motor principal: tipos de entidades, escenas, física, renderizado, bucle del juego y API de creación.",
  scripts: "Scripting: sistema de comportamientos y lógica de juego declarativa (scripts de entidades).",
  storage: "Persistencia: guardado/carga de proyectos en almacenamiento local y nube.",
  animations: "Clips de animación: estados, sprites y reproducción frame a frame.",
  sfx: "Efectos de sonido: audio procedural y reproducción.",
  images: "Utilidades de imagen: generación y procesado de sprites.",
  cloudSync: "Sincronización con la nube: subir/descargar proyectos entre dispositivos.",
};
