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
  
  // Get first definition
  let definition = '';
  let exampleSentence = '';
  
  for (const meaning of entry.meanings) {
    for (const def of meaning.definitions) {
      if (!definition && def.definition) {
        definition = def.definition;
      }
      if (!exampleSentence && def.example) {
        exampleSentence = def.example;
      }
      if (definition && exampleSentence) break;
    }
    if (definition && exampleSentence) break;
  }
  
  // Generate a simple example if none found
  if (!exampleSentence) {
    exampleSentence = `I learned the word "${word}" today.`;
  }
  
  return {
    word: entry.word,
    definition,
    exampleSentence,
  };
}
