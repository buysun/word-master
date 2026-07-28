import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { words, date, month, day, year, nonce } = await req.json();
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

    const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    const dateLabel = (typeof month === "number" && typeof day === "number")
      ? `${monthNames[month - 1]} ${day}${typeof year === "number" ? `, ${year}` : ""}`
      : (typeof date === "string" ? date : "");

    const monthDayLabel = (typeof month === "number" && typeof day === "number")
      ? `${monthNames[month - 1]} ${day}`
      : dateLabel;

    const systemPrompt = `You are an English writing assistant for Korean 1st-year middle school students (중1).
You will be given a list of English words/phrases AND a month/day (e.g., "${monthDayLabel}"). Write a SHORT but COMPLETE English story paragraph (about 3-5 sentences) that:
1) Is inspired by a REAL, INTERESTING historical event, famous birthday, or fun fact that actually happened on ${monthDayLabel || "the given month/day"} in ANY PAST YEAR (NOT the current year — pick a notable past year). Mention the event/person and the past year naturally inside the story.
2) Uses EVERY single word from the list at least once (inflections like plural/past tense are OK). Do not skip any word.
3) STRICT RULE: EVERY sentence MUST contain at least one of the given words. Do NOT write any sentence that has zero given words. Keep each sentence short and simple.
4) Keep the TOTAL LENGTH shorter than before: fewer sentences and shorter sentences overall.

Topic guidance: pick a historical fact that Korean middle schoolers would find cool — famous musicians, movie releases, sports moments, tech/science breakthroughs, pop culture milestones, or major world news on that month/day.

Hard rules:
- The paragraph MUST be a coherent, complete story (beginning, middle, end), not a list of sentences.
- Vocabulary level: Korean 중1 (very simple, basic vocabulary and short, simple grammar — present/past tense, simple connectors like "and", "but", "because"). Avoid advanced or rare words outside the given list.
- Then provide a natural Korean translation of the paragraph.

VARIETY RULE (very important): Every time you are asked, you MUST produce a COMPLETELY NEW story — pick a different historical event/person, a different setting, and different sentence structures than any typical/obvious choice. Use the random variety token below to force a fresh angle.

Respond with ONLY a JSON object (no markdown, no commentary):
{"paragraph":"English paragraph here","translation":"한국어 번역"}`;

    const userContent = `Date: ${dateLabel}\nWords: ${cleanWords.join(", ")}\nVariety token (use it to pick a fresh, different event and wording): ${typeof nonce === "string" && nonce ? nonce : Math.random().toString(36).slice(2)}`;

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
        temperature: 1.1,
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
