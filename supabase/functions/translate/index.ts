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

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("GROQ_API_KEY")}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content: `You are a Korean-English dictionary assistant. Given an English word and its definition, respond with ONLY a JSON object with two fields:
1. "translation": All major Korean meanings of the word, comma-separated (e.g., "명령, 지휘, 통솔"). Include ALL common meanings. No English, no explanations.
2. "example": A simple English sentence using the word, suitable for a Korean 9th grader (중3). Use simple grammar and common vocabulary. The sentence should be natural and easy to understand.

Respond ONLY with the JSON object, nothing else.`
          },
          {
            role: "user",
            content: `Word: "${word}"\nDefinition: "${text}"`
          }
        ],
        temperature: 0.3,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI API error:", errText);
      throw new Error("AI API failed");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim() || "";
    
    let translation = word;
    let example = "";
    try {
      const parsed = JSON.parse(content);
      translation = parsed.translation || word;
      example = parsed.example || "";
    } catch {
      // If JSON parse fails, try to extract from text
      translation = content;
    }

    return new Response(JSON.stringify({ translation, example }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Translation error:", err);
    return new Response(JSON.stringify({ translation: null, example: null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
