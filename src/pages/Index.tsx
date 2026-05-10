import { useState, useEffect, useCallback } from "react";
import { BookOpen, FileText, CalendarIcon, Loader2, Volume2 } from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import SearchBar from "@/components/SearchBar";
import WordCard from "@/components/WordCard";
import QuizSetupModal from "@/components/QuizSetupModal";
import QuizScreen from "@/components/QuizScreen";
import { lookupWord } from "@/lib/dictionary";
import { getUserCookie } from "@/lib/cookie";
import { speak } from "@/lib/speech";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

function getKSTDateString(date: Date): string {
  // Format as YYYY-MM-DD in KST
  const kst = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  return format(kst, "yyyy-MM-dd");
}

function getTodayKST(): string {
  return getKSTDateString(new Date());
}

export default function Index() {
  const [isLoading, setIsLoading] = useState(false);
  const [cards, setCards] = useState<(Tables<"searched_words"> & { seq_no?: number })[]>([]);
  const [allWords, setAllWords] = useState<Tables<"searched_words">[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [quizSetupOpen, setQuizSetupOpen] = useState(false);
  const [quizWords, setQuizWords] = useState<Tables<"searched_words">[] | null>(null);
  const [quizType, setQuizType] = useState("quiz1");
  const [paragraphOpen, setParagraphOpen] = useState(false);
  const [paragraphLoading, setParagraphLoading] = useState(false);
  const [paragraphData, setParagraphData] = useState<{ paragraph: string; translation: string } | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);

  const cookie = getUserCookie();

  // Dates that have searched words
  const datesWithWords = Array.from(
    new Set(allWords.map((w) => getKSTDateString(new Date(w.searched_at))))
  ).map((d) => new Date(d + "T00:00:00"));

  const loadAllWords = useCallback(async () => {
    const { data } = await supabase
      .from("searched_words")
      .select("*")
      .eq("user_cookie", cookie)
      .order("searched_at", { ascending: false });
    if (data) setAllWords(data);
  }, [cookie]);

  const loadWordsByDate = useCallback(async (date: Date) => {
    const dateStr = getKSTDateString(date);
    const startOfDay = `${dateStr}T00:00:00+09:00`;
    const endOfDay = `${dateStr}T23:59:59+09:00`;

    const { data } = await supabase
      .from("searched_words")
      .select("*")
      .eq("user_cookie", cookie)
      .gte("searched_at", startOfDay)
      .lte("searched_at", endOfDay)
      .order("searched_at", { ascending: false });

    if (data) setCards(data as any);
  }, [cookie]);

  // Initial load: all words + today's words
  useEffect(() => {
    loadAllWords();
  }, [loadAllWords]);

  useEffect(() => {
    if (selectedDate) loadWordsByDate(selectedDate);
  }, [selectedDate, loadWordsByDate]);

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
  };

  const handleSearch = async (word: string) => {
    setIsLoading(true);
    try {
      // Check if word was already searched today
      const todayStr = getTodayKST();
      const startOfDay = `${todayStr}T00:00:00+09:00`;
      const endOfDay = `${todayStr}T23:59:59+09:00`;

      const { data: existing } = await supabase
        .from("searched_words")
        .select("*")
        .eq("user_cookie", cookie)
        .ilike("word", word)
        .gte("searched_at", startOfDay)
        .lte("searched_at", endOfDay)
        .maybeSingle();

      if (existing) {
        // Already searched today - update timestamp to bring to top
        await supabase
          .from("searched_words")
          .update({ searched_at: new Date().toISOString() })
          .eq("id", existing.id);
        toast.info("오늘 이미 검색한 단어입니다. 순서가 업데이트됩니다.");
        if (selectedDate) await loadWordsByDate(selectedDate);
        await loadAllWords();
        speak(existing.word, true);
        setTimeout(() => speak(existing.word, true), 2000);
        return;
      }

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
        // If viewing today, add to cards
        if (selectedDate && getKSTDateString(selectedDate) === todayStr) {
          setCards((prev) => [data as any, ...prev]);
        }
        setAllWords((prev) => [data, ...prev]);
        // Slowly pronounce the word twice with 2s interval
        speak(result.word, true);
        setTimeout(() => speak(result.word, true), 2000);
      }
    } catch (err: any) {
      toast.error(err.message || "단어를 찾을 수 없습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("searched_words").delete().eq("id", id);
    if (error) {
      toast.error("삭제에 실패했습니다.");
      return;
    }
    setCards((prev) => prev.filter((c) => c.id !== id));
    setAllWords((prev) => prev.filter((w) => w.id !== id));
    toast.success("단어가 삭제되었습니다.");
  };

  const handleQuiz1Start = () => {
    if (cards.length < 2) {
      toast.error("최소 2개 이상의 단어가 필요합니다.");
      return;
    }
    setQuizType("quiz1");
    setQuizWords([...cards]);
  };

  const handleParagraphStart = async () => {
    if (cards.length === 0) {
      toast.error("선택한 날짜에 검색한 단어가 없습니다.");
      return;
    }
    setParagraphOpen(true);
    setParagraphLoading(true);
    setParagraphData(null);
    setShowTranslation(false);
    try {
      const { data, error } = await supabase.functions.invoke("paragraph", {
        body: { words: cards.map((c) => c.word) },
      });
      if (error) throw error;
      if (!data?.paragraph) throw new Error(data?.error || "문단을 생성하지 못했습니다.");
      setParagraphData({ paragraph: data.paragraph, translation: data.translation || "" });
    } catch (err: any) {
      toast.error(err.message || "문단 생성에 실패했습니다.");
      setParagraphOpen(false);
    } finally {
      setParagraphLoading(false);
    }
  };

  if (quizWords) {
    return (
      <QuizScreen
        words={quizWords}
        quizType={quizType}
        onFinish={() => {
          setQuizWords(null);
          loadAllWords();
          if (selectedDate) loadWordsByDate(selectedDate);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="container flex items-center justify-between py-3">
          <h1 className="font-display text-xl font-bold text-primary">Word Master - Wook</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="font-display text-xs" onClick={handleQuiz1Start}>
              <BookOpen className="h-3.5 w-3.5 mr-1" /> 퀴즈
            </Button>
            <Button variant="outline" size="sm" className="font-display text-xs" onClick={handleParagraphStart}>
              <FileText className="h-3.5 w-3.5 mr-1" /> 문단
            </Button>
          </div>
        </div>
      </header>

      {/* Search section */}
      <div className="container py-8 space-y-2">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-6">
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground mb-1">영어 단어 검색</h2>
          <p className="font-body text-sm text-muted-foreground">단어를 검색하세요</p>
        </motion.div>
        <SearchBar onSearch={handleSearch} isLoading={isLoading} />
      </div>

      {/* Date picker */}
      <div className="container pb-4 flex justify-center">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-[220px] justify-start text-left font-body",
                !selectedDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {selectedDate ? format(selectedDate, "yyyy년 M월 d일", { locale: ko }) : "날짜 선택"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              initialFocus
              modifiers={{ hasWords: datesWithWords }}
              modifiersStyles={{ hasWords: { color: "hsl(0 84% 60%)", fontWeight: 700 } }}
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Cards */}
      <div className="container pb-8 space-y-3">
        {cards.map((card) => (
          <WordCard
            key={card.id}
            word={card.word}
            phonetic={card.phonetic || ""}
            definition={card.definition}
            exampleSentence={card.example_sentence}
            seqNo={(card as any).seq_no}
            onDelete={() => handleDelete(card.id)}
          />
        ))}
        {cards.length === 0 && (
          <p className="text-center text-sm text-muted-foreground font-body py-12">
            {selectedDate ? `${format(selectedDate, "M월 d일", { locale: ko })}에 검색한 단어가 없습니다` : "검색한 단어가 여기에 표시됩니다 📚"}
          </p>
        )}
      </div>

      {/* Quiz Setup Modal */}
      <QuizSetupModal
        open={quizSetupOpen}
        onClose={() => setQuizSetupOpen(false)}
        words={allWords}
        onStart={handleQuiz1Start}
        title="퀴즈 - 단어 복습"
      />

      {/* Paragraph Dialog */}
      <Dialog open={paragraphOpen} onOpenChange={setParagraphOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {selectedDate ? format(selectedDate, "M월 d일", { locale: ko }) : ""} 단어로 만든 문단
            </DialogTitle>
          </DialogHeader>
          {paragraphLoading && (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="font-body text-sm text-muted-foreground">문단을 만드는 중입니다...</p>
            </div>
          )}
          {paragraphData && (
            <div className="space-y-4 mt-2">
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-body text-base text-foreground leading-relaxed flex-1">{paragraphData.paragraph}</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-primary shrink-0"
                    onClick={() => speak(paragraphData.paragraph, false)}
                    aria-label="Read paragraph"
                  >
                    <Volume2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {paragraphData.translation && (
                <div className="bg-card rounded-lg p-4 border border-border">
                  <p className="font-body text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{paragraphData.translation}</p>
                </div>
              )}
              <div className="flex flex-wrap gap-1.5">
                {cards.map((c) => (
                  <span key={c.id} className="text-xs font-mono bg-primary/10 text-primary rounded px-2 py-0.5">
                    {c.word}
                  </span>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
