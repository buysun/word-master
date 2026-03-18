import { supabase } from "@/integrations/supabase/client";

export interface WordData {
  word: string;
  phonetic: string;
  definition: string;
  exampleSentence: string;
}

export async function lookupWord(word: string): Promise<WordData> {
  const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.trim().toLowerCase())}`);
  if (!res.ok) throw new Error('단어를 찾을 수 없습니다.');
  
  const data = await res.json();
  const entry = data[0];
  
  const phonetic = entry.phonetic || entry.phonetics?.find((p: any) => p.text)?.text || '';

  // Collect up to 3 short definition keywords for concise Korean translation
  let definition = '';
  let exampleSentence = '';
  const keyWords: string[] = [];
  
  for (const meaning of entry.meanings) {
    for (const def of meaning.definitions) {
      if (!definition && def.definition) {
        definition = def.definition;
      }
      if (!exampleSentence && def.example) {
        exampleSentence = def.example;
      }
    }
  }
  
  // Generate a simple example if none found
  if (!exampleSentence) {
    exampleSentence = `I learned the word "${word}" today.`;
  }

  // Translate definition to Korean
  let koreanDef = definition;
  try {
    const { data } = await supabase.functions.invoke("translate", {
      body: { text: definition, word: entry.word },
    });
    if (data?.translation) koreanDef = data.translation;
  } catch {}

  return {
    word: entry.word,
    phonetic,
    definition: koreanDef,
    exampleSentence,
  };
}
