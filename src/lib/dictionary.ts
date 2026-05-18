import { supabase } from "@/integrations/supabase/client";

export interface WordData {
  word: string;
  phonetic: string;
  definition: string;
  exampleSentence: string;
}

function getFallbackExample(word: string) {
  return `I use "${word}" in my English study.`;
}

async function lookupPhrase(phrase: string): Promise<WordData> {
  // Idiom / multi-word lookup: skip dictionaryapi.dev, ask AI directly
  const { data: translated, error } = await supabase.functions.invoke("translate", {
    body: {
      word: phrase,
      isPhrase: true,
    },
  });

  if (error) {
    const status = (error as any)?.context?.status;
    if (status === 429) throw new Error("번역 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.");
    if (status === 402) throw new Error("AI 사용량 한도에 도달했습니다. 잠시 후 다시 시도해주세요.");
    throw new Error("번역 기능에 문제가 발생했습니다. 잠시 후 다시 시도해주세요.");
  }

  if (!translated?.translation) {
    throw new Error(translated?.error || "뜻을 찾을 수 없습니다.");
  }

  const ex = translated.example || getFallbackExample(phrase);
  const exKr = (translated.exampleTranslation || "").trim();
  return {
    word: phrase,
    phonetic: "",
    definition: translated.translation,
    exampleSentence: exKr ? `${ex}\n${exKr}` : ex,
  };
}

export async function lookupWord(word: string): Promise<WordData> {
  const trimmed = word.trim().toLowerCase();

  // Detect idiom / phrase (contains whitespace)
  if (/\s/.test(trimmed)) {
    return lookupPhrase(trimmed);
  }

  const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(trimmed)}`);
  if (!res.ok) {
    // Fallback to AI phrase lookup if not found in dictionary
    return lookupPhrase(trimmed);
  }

  const data = await res.json();
  const entry = data[0];

  const phonetic = entry.phonetic || entry.phonetics?.find((p: any) => p.text)?.text || "";

  const candidateDefinitions = Array.from(
    new Set(
      entry.meanings.flatMap((meaning: any) =>
        meaning.definitions
          .map((def: any) => def.definition)
          .filter((definition: string | undefined) => Boolean(definition))
          .map((definition: string) => `${meaning.partOfSpeech}: ${definition}`),
      ),
    ),
  ).slice(0, 8);

  const sourceExample =
    entry.meanings
      .flatMap((meaning: any) => meaning.definitions)
      .find((def: any) => typeof def.example === "string" && def.example.trim())?.example || getFallbackExample(entry.word);

  if (candidateDefinitions.length === 0) {
    return lookupPhrase(trimmed);
  }

  const { data: translated, error } = await supabase.functions.invoke("translate", {
    body: {
      word: entry.word,
      definitions: candidateDefinitions,
      text: candidateDefinitions[0],
    },
  });

  if (error) {
    const status = (error as any)?.context?.status;
    if (status === 429) throw new Error("번역 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.");
    if (status === 402) throw new Error("AI 사용량 한도에 도달했습니다. 잠시 후 다시 시도해주세요.");
    throw new Error("번역 기능에 문제가 발생했습니다. 잠시 후 다시 시도해주세요.");
  }

  if (!translated?.translation) {
    throw new Error(translated?.error || "번역 결과를 받지 못했습니다.");
  }

  const ex = translated.example || sourceExample;
  const exKr = (translated.exampleTranslation || "").trim();
  return {
    word: entry.word,
    phonetic,
    definition: translated.translation,
    exampleSentence: exKr ? `${ex}\n${exKr}` : ex,
  };
}
