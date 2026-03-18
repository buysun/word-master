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

    const response = await fetch("https://api.lovable.dev/v1/chat/completions", {
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
            content: `You are a Korean-English dictionary. Given an English word and its definition, respond with ONLY a JSON object:
{"translation":"한국어 뜻들(쉼표 구분)","example":"중3 수준 영어 예문"}

Rules:
- translation: 해당 단어의 주요 한국어 뜻을 모두 쉼표로 구분 (예: "명령, 지휘, 통솔"). 영어 금지, 설명 금지.
- example: 중학교 3학년이 이해할 수 있는 쉬운 영어 문장 1개.
- JSON만 출력. 다른 텍스트 금지.`
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
      console.error("AI API error:", response.status, errText);
      throw new Error("AI API failed");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim() || "";
    
    let translation = word;
    let example = "";
    try {
      // Remove markdown code fences if present
      const cleaned = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      const parsed = JSON.parse(cleaned);
      translation = parsed.translation || word;
      example = parsed.example || "";
    } catch {
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
