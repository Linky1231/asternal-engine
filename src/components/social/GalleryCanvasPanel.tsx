import { useRef, useState, useEffect, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Pencil, Eraser, Undo2, RotateCcw, X, Save, Palette,
  Minus, Plus, Pipette,
} from "lucide-react";
import type { SpriteAsset } from "@/lib/engine/core";
import { uid } from "@/lib/engine/core";

type Tool = "brush" | "eraser";

const COLORS = [
  "#000000", "#1f2937", "#6b7280", "#f8fafc",
  "#ef4444", "#f97316", "#fbbf24", "#22c55e",
  "#06b6d4", "#38bdf8", "#3b82f6", "#8b5cf6",
  "#ec4899", "#7c2d12", "#fde68a", "#0ea5e9",
  "#ffffff", "#fde2e4", "#fad2e1", "#e2ece9",
  "#cddafd", "#ffd6a5", "#caffbf", "#9bf6ff",
];

interface Props {
  onSave: (sprite: SpriteAsset) => void;
  onClose: () => void;
}

export function GalleryCanvasPanel({ onSave, onClose }: Props) {
  const [tool, setTool] = useState<Tool>("brush");
  const [color, setColor] = useState("#3b82f6");
  const [brushSize, setBrushSize] = useState(8);
  const [name, setName] = useState("Mi obra");
  const [res, setRes] = useState(0); // buffer pixel resolution (containerWidth * dpr)

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const bufferRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const undoStack = useRef<string[]>([]);
  const lastDrawnRef = useRef({ x: 0, y: 0 });
  const hasMovedRef = useRef(false);

  // Measure the container width and compute buffer resolution at native DPR
  useEffect(() => {
    const measure = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      if (w < 10) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      setRes(Math.max(256, Math.round(w * dpr)));
    };
    measure();
    // Also re-measure on resize
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const SIZE = res || 512;

  // Init buffer at measured resolution
  useEffect(() => {
    if (res === 0) return;
    const buf = document.createElement("canvas");
    buf.width = res;
    buf.height = res;
    bufferRef.current = buf;
    const ctx = buf.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, res, res);
    undoStack.current = [buf.toDataURL()];
    blit();
  }, [res]);

  const blit = () => {
    const c = canvasRef.current;
    const buf = bufferRef.current;
    if (!c || !buf) return;
    const ctx = c.getContext("2d")!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = c.clientWidth;
    if (c.width !== Math.round(W * dpr)) {
      c.width = Math.round(W * dpr);
      c.height = Math.round(W * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.clearRect(0, 0, W, W);
    // Draw buffer at native display size (no scale)
    ctx.drawImage(buf, 0, 0, buf.width, buf.height, 0, 0, W, W);
  };

  const getPos = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * SIZE,
      y: ((e.clientY - r.top) / r.height) * SIZE,
    };
  };

  const pushUndo = () => {
    const buf = bufferRef.current;
    if (!buf) return;
    const url = buf.toDataURL();
    if (undoStack.current[undoStack.current.length - 1] !== url) {
      undoStack.current.push(url);
      if (undoStack.current.length > 20) undoStack.current.shift();
    }
  };

  const undo = () => {
    if (undoStack.current.length <= 1) return;
    undoStack.current.pop();
    const prev = undoStack.current[undoStack.current.length - 1];
    const buf = bufferRef.current;
    if (!buf || !prev) return;
    const img = new Image();
    img.onload = () => {
      const ctx = buf.getContext("2d")!;
      ctx.clearRect(0, 0, buf.width, buf.height);
      ctx.drawImage(img, 0, 0);
      blit();
    };
    img.src = prev;
  };

  const clearCanvas = () => {
    const buf = bufferRef.current;
    if (!buf) return;
    pushUndo();
    const ctx = buf.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, buf.width, buf.height);
    blit();
  };

  // Draw a smooth circle dot at (x, y) — the core of our brush engine
  const drawDot = (x: number, y: number) => {
    const buf = bufferRef.current;
    if (!buf) return;
    const ctx = buf.getContext("2d")!;
    const erase = tool === "eraser";
    ctx.save();
    ctx.globalCompositeOperation = erase ? "destination-out" : "source-over";
    ctx.fillStyle = erase ? "#000000" : color;
    ctx.beginPath();
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  // Draw overlapping dots along a line for perfectly smooth curves —
  // no straight segments, no polygonal artifacts, just continuous soft brush strokes
  const stroke = (x0: number, y0: number, x1: number, y1: number) => {
    const buf = bufferRef.current;
    if (!buf) return;
    const ctx = buf.getContext("2d")!;
    const erase = tool === "eraser";
    ctx.save();
    ctx.globalCompositeOperation = erase ? "destination-out" : "source-over";
    ctx.fillStyle = erase ? "#000000" : color;

    const dx = x1 - x0;
    const dy = y1 - y0;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Subdivide into tiny overlapping circles — step smaller than brush diameter
    // for maximum overlap → perfectly smooth curve
    const step = Math.max(1, brushSize * 0.25);
    const steps = Math.max(1, Math.ceil(dist / step));

    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = x0 + dx * t;
      const y = y0 + dy * t;
      ctx.moveTo(x + brushSize, y);
      ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.restore();
  };

  const onDown = (e: React.PointerEvent) => {
    if (res === 0) return;
    isDrawing.current = true;
    hasMovedRef.current = false;
    const p = getPos(e);
    lastPos.current = p;
    lastDrawnRef.current = p;
    (e.target as Element).setPointerCapture(e.pointerId);
    // Draw initial dot
    drawDot(p.x, p.y);
    blit();
  };

  const onMove = (e: React.PointerEvent) => {
    if (!isDrawing.current || res === 0) return;
    const p = getPos(e);

    // Distance-based jitter filter: skip if barely moved
    // This stabilizes the pen by ignoring micro-movements
    const dx = p.x - lastDrawnRef.current.x;
    const dy = p.y - lastDrawnRef.current.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const minDist = Math.max(0.5, brushSize * 0.08);

    if (dist < minDist) return;

    stroke(lastDrawnRef.current.x, lastDrawnRef.current.y, p.x, p.y);
    lastDrawnRef.current = p;
    lastPos.current = p;
    hasMovedRef.current = true;
    blit();
  };

  const onUp = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    pushUndo();
  };

  const pickColor = (e: React.MouseEvent) => {
    const buf = bufferRef.current;
    if (!buf) return;
    const ctx = buf.getContext("2d")!;
    const r = canvasRef.current!.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * SIZE;
    const y = ((e.clientY - r.top) / r.height) * SIZE;
    const d = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
    if (d[3] === 0) return;
    const hex = "#" + [d[0], d[1], d[2]].map(n => n.toString(16).padStart(2, "0")).join("");
    setColor(hex);
  };

  const doSave = () => {
    const buf = bufferRef.current;
    if (!buf) return;
    const dataUrl = buf.toDataURL("image/png");
    const asset: SpriteAsset = {
      id: uid(),
      name: name.trim() || "Mi obra",
      width: buf.width,
      height: buf.height,
      fps: 8,
      loop: true,
      frames: [{ id: uid(), layers: [], composite: dataUrl }],
    };
    onSave(asset);
  };

  const TOOLS: { id: Tool; icon: ReactNode; label: string }[] = [
    { id: "brush", icon: <Pencil size={16} />, label: "Pincel" },
    { id: "eraser", icon: <Eraser size={16} />, label: "Borrador" },
  ];

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="overflow-hidden rounded-2xl border border-border/60 panel mb-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/40">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-accent grid place-items-center shrink-0">
            <Palette size={13} className="text-primary-foreground" />
          </div>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="bg-transparent text-sm font-display font-semibold outline-none min-w-0 max-w-[140px] placeholder:text-muted-foreground/60"
            placeholder="Nombre de la obra"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={undo}
            className="w-8 h-8 rounded-lg grid place-items-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition"
            title="Deshacer"
          >
            <Undo2 size={15} />
          </button>
          <button
            onClick={clearCanvas}
            className="w-8 h-8 rounded-lg grid place-items-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
            title="Limpiar"
          >
            <RotateCcw size={14} />
          </button>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg grid place-items-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition"
            title="Cerrar"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 p-3">
        {/* Canvas */}
        <div className="flex-1 min-w-0">
          <motion.div
            ref={containerRef}
            className="rounded-xl overflow-hidden mx-auto"
            style={{ maxWidth: "100%", maxHeight: "60vh", aspectRatio: "1/1" }}
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          >
            <canvas
              ref={canvasRef}
              className="w-full h-full touch-none block cursor-crosshair"
              style={{
                touchAction: "none",
                backgroundImage:
                  "linear-gradient(45deg, #e5e7eb 25%, transparent 25%), linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)",
                backgroundSize: "16px 16px",
                backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
                backgroundColor: "#ffffff",
                borderRadius: "8px",
              }}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              onDoubleClick={pickColor}
            />
          </motion.div>
        </div>

        {/* Sidebar tools */}
        <div className="flex flex-row sm:flex-col gap-2 shrink-0">
          {/* Tool toggle */}
          <div className="flex sm:flex-col gap-1 p-1.5 rounded-xl bg-muted/40 border border-border/40">
            {TOOLS.map(t => (
              <button
                key={t.id}
                onClick={() => setTool(t.id)}
                className={`w-10 h-10 rounded-lg grid place-items-center transition active:scale-90 ${
                  tool === t.id
                    ? "bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                }`}
                title={t.label}
              >
                {t.icon}
              </button>
            ))}
          </div>

          {/* Colors */}
          <div className="flex flex-wrap sm:flex-col gap-1 p-2 rounded-xl bg-muted/40 border border-border/40 max-h-[200px] overflow-y-auto">
            {COLORS.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className="w-[22px] h-[22px] rounded-md shrink-0 transition-all active:scale-90"
                style={{
                  background: c,
                  boxShadow:
                    color.toLowerCase() === c.toLowerCase()
                      ? "inset 0 0 0 1.5px oklch(1 0 0 / 0.9), 0 0 0 2px oklch(0.72 0.17 250 / 0.7)"
                      : "inset 0 0 0 1px oklch(0 0 0 / 0.12)",
                  transform: color.toLowerCase() === c.toLowerCase() ? "scale(1.12)" : undefined,
                }}
                aria-label={c}
              />
            ))}
            <button
              onClick={() => {
                const input = document.createElement("input");
                input.type = "color";
                input.value = color;
                input.oninput = () => setColor(input.value);
                input.click();
              }}
              className="w-[22px] h-[22px] rounded-md bg-gradient-to-br from-primary/30 to-accent/20 grid place-items-center border border-border/40"
              title="Personalizar color"
            >
              <Palette size={10} className="text-foreground/70" />
            </button>
          </div>

          {/* Brush size */}
          <div className="flex sm:flex-col items-center gap-1.5 p-2 rounded-xl bg-muted/40 border border-border/40 min-w-[52px]">
            <button
              onClick={() => setBrushSize(s => Math.max(2, s - 2))}
              className="w-6 h-6 rounded-md grid place-items-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition"
            >
              <Minus size={12} />
            </button>
            <div
              className="w-8 h-8 rounded-full border-2 border-border/60 grid place-items-center shrink-0"
              title={`Tamaño: ${brushSize}px`}
            >
              <div
                className="rounded-full bg-foreground/80"
                style={{ width: Math.min(brushSize, 24), height: Math.min(brushSize, 24) }}
              />
            </div>
            <button
              onClick={() => setBrushSize(s => Math.min(40, s + 2))}
              className="w-6 h-6 rounded-md grid place-items-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition"
            >
              <Plus size={12} />
            </button>
            <span className="text-[9px] font-mono tabular-nums text-muted-foreground">{brushSize}px</span>
          </div>

          {/* Save */}
          <button
            onClick={doSave}
            className="h-10 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground text-[10px] font-display tracking-widest flex items-center justify-center gap-1.5 active:scale-95 transition shadow-sm hover:shadow-md"
          >
            <Save size={14} /> GUARDAR
          </button>
        </div>
      </div>
    </motion.div>
  );
}
