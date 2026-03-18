import { useState, useEffect, useCallback } from "react";
import { BookOpen, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import SearchBar from "@/components/SearchBar";
import WordCard from "@/components/WordCard";
import QuizSetupModal from "@/components/QuizSetupModal";
import QuizScreen from "@/components/QuizScreen";
import { lookupWord } from "@/lib/dictionary";
import { getUserCookie } from "@/lib/cookie";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { motion } from "framer-motion";

export default function Index() {
  const [isLoading, setIsLoading] = useState(false);
  const [cards, setCards] = useState<Tables<"searched_words">[]>([]);
  const [allWords, setAllWords] = useState<Tables<"searched_words">[]>([]);
  const [quizSetupOpen, setQuizSetupOpen] = useState(false);
  const [quiz2SetupOpen, setQuiz2SetupOpen] = useState(false);
  const [quizWords, setQuizWords] = useState<Tables<"searched_words">[] | null>(null);
  const [quizType, setQuizType] = useState("quiz1");

  const cookie = getUserCookie();

  const loadWords = useCallback(async () => {
    const { data } = await supabase
      .from("searched_words")
      .select("*")
      .eq("user_cookie", cookie)
      .order("searched_at", { ascending: false });
    if (data) {
      setAllWords(data);
      setCards(data);
    }
  }, [cookie]);

  useEffect(() => { loadWords(); }, [loadWords]);

  const handleSearch = async (word: string) => {
    setIsLoading(true);
    try {
      const result = await lookupWord(word);
      const { data, error } = await supabase
        .from("searched_words")
        .insert({
          word: result.word,
          phonetic: result.phonetic,
          definition: result.definition,
          example_sentence: result.exampleSentence,
          user_cookie: cookie,
        })
        .select()
        .single();

      if (error) throw error;
      if (data) {
        setCards(prev => [data, ...prev]);
        setAllWords(prev => [data, ...prev]);
      }
    } catch (err: any) {
      toast.error(err.message || "단어를 찾을 수 없습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuiz1Start = (wordIds: string[]) => {
    setQuizSetupOpen(false);
    const selected = allWords.filter(w => wordIds.includes(w.id));
    if (selected.length < 2) {
      toast.error("최소 2개 이상의 단어가 필요합니다.");
      return;
    }
    setQuizType("quiz1");
    setQuizWords(selected);
  };

  const handleQuiz2Start = async () => {
    setQuiz2SetupOpen(false);
    // Get words that were NOT answered correctly on first try
    const { data: results } = await supabase
      .from("quiz_results")
      .select("word_id")
      .eq("user_cookie", cookie)
      .neq("result", 1);

    if (!results || results.length === 0) {
      toast.info("틀린 단어가 없습니다! 🎉");
      return;
    }

    const failedWordIds = new Set(results.map(r => r.word_id));
    let failedWords = allWords.filter(w => failedWordIds.has(w.id));
    
    if (failedWords.length < 2) {
      toast.error("최소 2개 이상의 단어가 필요합니다.");
      return;
    }

    // Random 30
    if (failedWords.length > 30) {
      failedWords = [...failedWords].sort(() => Math.random() - 0.5).slice(0, 30);
    }

    setQuizType("quiz2");
    setQuizWords(failedWords);
  };

  if (quizWords) {
    return (
      <QuizScreen
        words={quizWords}
        quizType={quizType}
        onFinish={() => { setQuizWords(null); loadWords(); }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="container flex items-center justify-between py-3">
          <h1 className="font-display text-xl font-bold text-primary">Word Master</h1>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="font-display text-xs"
              onClick={() => setQuizSetupOpen(true)}
            >
              <BookOpen className="h-3.5 w-3.5 mr-1" /> 퀴즈1
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="font-display text-xs"
              onClick={handleQuiz2Start}
            >
              <Zap className="h-3.5 w-3.5 mr-1" /> 퀴즈2
            </Button>
          </div>
        </div>
      </header>

      {/* Search section */}
      <div className="container py-8 space-y-2">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-6"
        >
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground mb-1">영어 단어 검색</h2>
          <p className="font-body text-sm text-muted-foreground">단어를 검색하고 퀴즈로 학습하세요</p>
        </motion.div>

        <SearchBar onSearch={handleSearch} isLoading={isLoading} />
      </div>

      {/* Cards */}
      <div className="container pb-8 space-y-3">
        {cards.map((card) => (
          <WordCard
            key={card.id}
            word={card.word}
            definition={card.definition}
            exampleSentence={card.example_sentence}
          />
        ))}
        {cards.length === 0 && (
          <p className="text-center text-sm text-muted-foreground font-body py-12">
            검색한 단어가 여기에 표시됩니다 📚
          </p>
        )}
      </div>

      {/* Quiz Setup Modals */}
      <QuizSetupModal
        open={quizSetupOpen}
        onClose={() => setQuizSetupOpen(false)}
        words={allWords}
        onStart={handleQuiz1Start}
        title="퀴즈 1 - 단어 복습"
      />
    </div>
  );
}
