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
    const { text, word, definitions } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const candidateDefinitions = Array.isArray(definitions)
      ? definitions.filter((item): item is string => typeof item === "string" && item.trim()).map((item) => item.trim()).slice(0, 8)
      : typeof text === "string" && text.trim()
        ? [text.trim()]
        : [];

    if (!word || candidateDefinitions.length === 0) {
      return new Response(JSON.stringify({ error: "word and definitions are required", translation: null, example: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a Korean-English dictionary editor for Korean students. Respond with ONLY a JSON object:
{"translation":"한국어 뜻1, 한국어 뜻2","example":"easy English sentence"}

Rules:
- Select only the meanings that truly belong to the target word.
- Ignore unrelated, noisy, or mistaken definitions.
- translation: output the main Korean dictionary meanings only, comma-separated, in Korean only, with no numbering and no explanation.
- Include all major meanings if there are several.
- example: write one natural English sentence using the target word, easy enough for a Korean 9th-grade student.
- Output JSON only.`
          },
          {
            role: "user",
            content: `Word: ${word}\nCandidate definitions:\n${candidateDefinitions.map((definition, index) => `${index + 1}. ${definition}`).join("\n")}`
          }
        ],
        temperature: 0.2,
        max_tokens: 220,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI API error:", response.status, errText);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later.", translation: null, example: null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 429,
        });
      }

      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add funds to your Lovable AI workspace.", translation: null, example: null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 402,
        });
      }

      throw new Error("AI API failed");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim() || "";
    const cleaned = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(cleaned);

    const translation = typeof parsed.translation === "string" ? parsed.translation.trim() : "";
    const example = typeof parsed.example === "string" ? parsed.example.trim() : "";

    if (!translation) {
      throw new Error("Translation was empty");
    }

    return new Response(JSON.stringify({ translation, example }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Translation error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error", translation: null, example: null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
