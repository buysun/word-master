import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { words } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    if (!Array.isArray(words) || words.length === 0) {
      return new Response(JSON.stringify({ error: "words array is required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const cleanWords = words
      .filter((w): w is string => typeof w === "string" && w.trim().length > 0)
      .map((w) => w.trim())
      .slice(0, 60);

    const systemPrompt = `You are a friendly English writing assistant for Korean elementary school students (around 3rd-4th grade).
You will be given a list of English words/phrases. Write a short, coherent English paragraph that uses ALL of the given words at least once.
Rules:
- Use every word in the list (you may inflect verbs/plurals as needed).
- Keep sentences simple and short.
- The paragraph should make sense as a single story or topic.
- Then provide a natural Korean translation of the paragraph.
Respond with ONLY a JSON object:
{"paragraph":"English paragraph here","translation":"한국어 번역"}`;

    const userContent = `Words: ${cleanWords.join(", ")}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        temperature: 0.6,
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI API error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 429,
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required." }), {
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

    const paragraph = typeof parsed.paragraph === "string" ? parsed.paragraph.trim() : "";
    const translation = typeof parsed.translation === "string" ? parsed.translation.trim() : "";
    if (!paragraph) throw new Error("paragraph was empty");

    return new Response(JSON.stringify({ paragraph, translation, usedWords: cleanWords }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Paragraph error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
