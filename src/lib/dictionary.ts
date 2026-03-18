import { supabase } from "@/integrations/supabase/client";

export interface WordData {
  word: string;
  phonetic: string;
  definition: string;
  exampleSentence: string;
}

function getFallbackExample(word: string) {
  return `I use the word "${word}" in my English study.`;
}

export async function lookupWord(word: string): Promise<WordData> {
  const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.trim().toLowerCase())}`);
  if (!res.ok) throw new Error("단어를 찾을 수 없습니다.");

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
    throw new Error("뜻 정보를 찾을 수 없습니다.");
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

  return {
    word: entry.word,
    phonetic,
    definition: translated.translation,
    exampleSentence: translated.example || sourceExample,
  };
}
