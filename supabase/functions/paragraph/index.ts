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

    const systemPrompt = `You are an English writing assistant for Korean middle school students.
You will be given a list of English words/phrases. Write a SHORT but COMPLETE English story paragraph (about 5-9 sentences) that uses EVERY single word in the list at least once.

Topic guidelines:
- Pick an engaging topic that Korean middle schoolers care about: recent-style news, pop culture, K-pop or world music, movies/Netflix shows, celebrities, sports stars, gaming, social media trends, or school life.
- The paragraph MUST be a coherent, complete story with a clear beginning, middle, and end (not a random list of sentences).

Hard rules:
- EVERY word from the list MUST appear in the paragraph (inflections like plural/past tense are OK). Do not skip any word.
- Vocabulary level: middle school (not too easy, not too hard). Sentences can be a bit longer than elementary level.
- Then provide a natural Korean translation of the paragraph.

Respond with ONLY a JSON object (no markdown, no commentary):
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
        temperature: 0.8,
        max_tokens: 3000,
        response_format: { type: "json_object" },
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

    let paragraph = "";
    let translation = "";
    try {
      const parsed = JSON.parse(cleaned);
      paragraph = typeof parsed.paragraph === "string" ? parsed.paragraph.trim() : "";
      translation = typeof parsed.translation === "string" ? parsed.translation.trim() : "";
    } catch (_e) {
      // Fallback: extract fields with regex if JSON is malformed/truncated
      const pMatch = cleaned.match(/"paragraph"\s*:\s*"((?:\\.|[^"\\])*)"/);
      const tMatch = cleaned.match(/"translation"\s*:\s*"((?:\\.|[^"\\])*)"/);
      const unescape = (s: string) => s.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
      if (pMatch) paragraph = unescape(pMatch[1]).trim();
      if (tMatch) translation = unescape(tMatch[1]).trim();
    }
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
