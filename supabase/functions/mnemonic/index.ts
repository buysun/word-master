import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { word, definition } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
    if (!word) {
      return new Response(JSON.stringify({ error: "word is required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400,
      });
    }

    const systemPrompt = `당신은 한국 초등학생을 위한 영어 단어 암기 코치입니다.
주어진 영어 단어를 쉽게 외울 수 있는 암기 팁을 한국어로 작성하세요.

규칙:
- 발음 연상(소리 비슷한 한국어), 어근/접두사 분석, 비슷한 뜻이나 모양의 다른 단어 연결 중 적절한 1~2가지 방법을 사용.
- 짧고 명확하게, 2~4문장 이내.
- 마지막에 한 줄로 핵심 연상 문구를 추가.
- 한국어로만 답하세요. 마크다운/번호 매기기 금지.

JSON으로만 응답:
{"tip":"암기 팁 텍스트"}`;

    const userContent = `Word: ${word}${definition ? `\nMeaning: ${definition}` : ""}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        temperature: 0.7,
        max_tokens: 400,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI API error:", response.status, errText);
      if (response.status === 429) return new Response(JSON.stringify({ error: "요청이 너무 많습니다." }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 429 });
      if (response.status === 402) return new Response(JSON.stringify({ error: "AI 사용량 한도 초과." }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 402 });
      throw new Error("AI API failed");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim() || "";
    const cleaned = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    let tip = "";
    try {
      const parsed = JSON.parse(cleaned);
      tip = typeof parsed.tip === "string" ? parsed.tip.trim() : "";
    } catch {
      tip = cleaned;
    }
    if (!tip) throw new Error("Empty tip");

    return new Response(JSON.stringify({ tip }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Mnemonic error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
    });
  }
});
