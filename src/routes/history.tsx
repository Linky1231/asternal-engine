import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, BarChart3 } from "lucide-react";
import { HistorySection } from "@/components/social/HistorySection";

export const Route = createFileRoute("/history")({
  head: () => ({ meta: [{ title: "Historial · Asternal" }] }),
  component: HistoryPage,
});

function HistoryPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen w-full flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-20 panel border-b backdrop-blur-xl">
        <div className="max-w-2xl md:max-w-3xl lg:max-w-4xl mx-auto flex items-center gap-2 px-3 py-2.5">
          <button
            onClick={() => navigate({ to: "/" })}
            className="w-9 h-9 rounded-xl border border-border grid place-items-center active:scale-95 transition shrink-0"
            aria-label="Volver al menú principal"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0 font-display text-sm text-primary-glow glow-text truncate">
            <BarChart3 size={15} className="text-primary-glow" />
            MI HISTORIAL
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-2xl md:max-w-3xl lg:max-w-4xl mx-auto w-full px-3 py-3 pb-24">
        <HistorySection />
      </main>
    </div>
  );
}
