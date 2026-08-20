import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { EventsSection } from "@/components/social/EventsSection";

export const Route = createFileRoute("/events")({
  head: () => ({ meta: [{ title: "Eventos · Asternal" }] }),
  component: EventsPage,
});

function EventsPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const onPop = () => {
      navigate({ to: "/", replace: true });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      <EventsSection isAdmin={false} />
    </div>
  );
}
