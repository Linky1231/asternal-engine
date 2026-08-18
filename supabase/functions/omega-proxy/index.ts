// omega-proxy: Edge Function para proyectar llamadas a OmegaTech API
// desde el navegador (CORS-safe).
// Deploy: supabase functions deploy omega-proxy --project-ref gxpgczwkovertezeydkt

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const OMEGA_URL = "https://api.omegatech.app/api/ai/Gpt-4-mini";

serve(async (req: Request): Promise<Response> => {
  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { message } = await req.json();

    const omegaRes = await fetch(OMEGA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });

    const data = await omegaRes.json();

    return new Response(JSON.stringify(data), {
      status: omegaRes.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Proxy error: ${(err as Error).message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
