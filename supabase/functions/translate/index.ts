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

    // Translate the word itself for concise Korean meaning
    const wordUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|ko`;
    const wordRes = await fetch(wordUrl);
    let wordTranslation = word;
    if (wordRes.ok) {
      const wordData = await wordRes.json();
      wordTranslation = wordData.responseData?.translatedText || word;
    } else {
      await wordRes.text(); // consume body
    }

    // Also translate a short definition phrase for additional context
    // Extract first few words of definition to get a secondary meaning
    const shortDef = text.split('.')[0].replace(/^(An?|The|To)\s+/i, '').trim();
    const defUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(shortDef)}&langpair=en|ko`;
    const defRes = await fetch(defUrl);
    let defTranslation = '';
    if (defRes.ok) {
      const defData = await defRes.json();
      defTranslation = defData.responseData?.translatedText || '';
    } else {
      await defRes.text();
    }

    // Combine: use word translation, add def translation if different
    let translation = wordTranslation;
    if (defTranslation && defTranslation !== wordTranslation && defTranslation.length < 20) {
      translation = `${wordTranslation}, ${defTranslation}`;
    }

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
