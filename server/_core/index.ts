import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { completeOrionChat } from "../orion";
import { authenticateCommunityRequest, rankCommunityFeed, reviewCommunityPost, reviewCommunitySubmission } from "../community-ai";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "96kb" }));

app.post("/api/orion/chat", async (req, res) => {
  try {
    const result = await completeOrionChat(req.body?.history, req.body?.options);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo consultar a Orión.";
    res.status(400).json({ error: message });
  }
});

app.post("/api/orion/review-post", async (req, res) => {
  try {
    await authenticateCommunityRequest(req.header("authorization"));
    res.json(await reviewCommunityPost(req.body));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Orión no pudo revisar la publicación.";
    res.status(400).json({ error: message });
  }
});

app.post("/api/orion/review-submission", async (req, res) => {
  try {
    await authenticateCommunityRequest(req.header("authorization"));
    res.json(await reviewCommunitySubmission(req.body));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Orión no pudo revisar este contenido.";
    res.status(400).json({ error: message });
  }
});

app.post("/api/orion/rank-feed", async (req, res) => {
  try {
    await authenticateCommunityRequest(req.header("authorization"));
    res.json(await rankCommunityFeed(req.body));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Orión no pudo ordenar el feed.";
    res.status(400).json({ error: message });
  }
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.get("/api/prexzy/aiwriter", async (req, res) => {
  try {
    const q = req.query as Record<string, unknown>;
    const prompt = String(q.prompt ?? "");
    const model = String(q.model ?? "gpt-4o-mini");
    if (!prompt.trim()) { res.status(400).json({ error: "prompt requerido" }); return; }
    const target = `https://prexzyapis.com/ai/aiwriter-chat?prompt=${encodeURIComponent(prompt)}&model=${encodeURIComponent(model)}`;
    const r = await fetch(target, { headers: { Accept: "application/json" } });
    const body = await r.text();
    res.status(r.status);
    res.setHeader("content-type", r.headers.get("content-type") ?? "application/json");
    res.send(body);
  } catch (e) {
    res.status(502).json({ error: e instanceof Error ? e.message : "No se pudo consultar Prexzy." });
  }
});

// El bundle del servidor queda en `dist/index.js` y Vite genera el cliente en
// `dist/public`, que también es el directorio exigido por el publicador.
const publicDirectory = path.join(dirname, "public");
app.use(express.static(publicDirectory));
app.use((_req, res) => res.sendFile(path.join(publicDirectory, "index.html")));

const port = Number(process.env.PORT);
if (!Number.isFinite(port) || port <= 0) throw new Error("El entorno debe proporcionar un puerto para iniciar el servidor.");
app.listen(port, () => console.log(`Asternal disponible en el puerto ${port}`));
