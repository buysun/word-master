import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const { text } = await req.json();

  const res = await fetch("https://api.ai.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: "You are a translator. Translate the given English definition to Korean. Return ONLY the Korean translation, nothing else. Keep it concise.",
        },
        { role: "user", content: text },
      ],
    }),
  });

  const data = await res.json();
  const translation = data.choices?.[0]?.message?.content?.trim() || text;

  return new Response(JSON.stringify({ translation }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
