import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, word } = await req.json();

    // Use Lovable AI to get concise Korean dictionary definition
    const response = await fetch("https://llm-gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: "You are a concise English-Korean dictionary. Given an English word and its definition, provide a brief Korean translation in dictionary style. Use only comma-separated Korean words/short phrases. No sentences, no explanations. Example: 'command' → '명령, 지휘'. Example: 'happy' → '행복한, 기쁜'. Reply with ONLY the Korean translation.",
          },
          {
            role: "user",
            content: `Word: ${word || ""}\nDefinition: ${text}`,
          },
        ],
        max_tokens: 50,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      console.error("AI translation error:", response.status);
      return new Response(JSON.stringify({ translation: text }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const translation = data.choices?.[0]?.message?.content?.trim() || text;

    return new Response(JSON.stringify({ translation }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Translation error:", err);
    return new Response(JSON.stringify({ translation: null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
