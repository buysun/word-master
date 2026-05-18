import { useState, useMemo, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { getUserCookie } from "@/lib/cookie";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, ArrowLeft } from "lucide-react";
import confetti from "canvas-confetti";
import { playCorrect, playWrong } from "@/lib/sound";

interface QuizScreenProps {
  words: Tables<"searched_words">[];
  quizType: string;
  onFinish: () => void;
}

type QuestionType = "word-to-def" | "def-to-word" | "sentence-fill";

interface Question {
  type: QuestionType;
  correctWord: Tables<"searched_words">;
  options: string[];
  correctIndex: number;
  prompt: string;
}

function generateQuestions(words: Tables<"searched_words">[]): Question[] {
  if (words.length < 2) return [];
  
  const questions: Question[] = [];
  const shuffled = [...words].sort(() => Math.random() - 0.5);

  for (const word of shuffled) {
    const types: QuestionType[] = ["word-to-def", "def-to-word", "sentence-fill"];
    const type = types[Math.floor(Math.random() * types.length)];

    // Get 3 wrong options from other words
    const others = words.filter(w => w.id !== word.id).sort(() => Math.random() - 0.5).slice(0, 3);
    
    // If not enough other words, pad with the available ones
    while (others.length < 3) {
      const pad = words.filter(w => w.id !== word.id)[0];
      if (pad) others.push(pad);
      else break;
    }

    if (others.length < 3) continue;

    let options: string[];
    let prompt: string;

    switch (type) {
      case "word-to-def":
        options = [word.definition, ...others.map(o => o.definition)];
        prompt = word.word;
        break;
      case "def-to-word":
        options = [word.word, ...others.map(o => o.word)];
        prompt = word.definition;
        break;
      case "sentence-fill":
        options = [word.word, ...others.map(o => o.word)];
        prompt = word.example_sentence.replace(new RegExp(`\\b${word.word}\\b`, "gi"), "______");
        if (prompt === word.example_sentence) {
          // If word not found in sentence, use word-to-def instead
          options = [word.definition, ...others.map(o => o.definition)];
          prompt = word.word;
        }
        break;
    }

    // Shuffle options, track correct index
    const correctAnswer = options[0];
    const shuffledOptions = [...options].sort(() => Math.random() - 0.5);
    const correctIndex = shuffledOptions.indexOf(correctAnswer);

    questions.push({
      type: prompt === word.word && options[0] === word.definition ? "word-to-def" : 
            prompt === word.definition ? "def-to-word" : 
            type,
      correctWord: word,
      options: shuffledOptions,
      correctIndex,
      prompt,
    });
  }

  return questions;
}

export default function QuizScreen({ words, quizType, onFinish }: QuizScreenProps) {
  const questions = useMemo(() => generateQuestions(words), [words]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [score, setScore] = useState({ first: 0, second: 0, failed: 0 });
  const [finished, setFinished] = useState(false);
  const [shakeIndex, setShakeIndex] = useState<number | null>(null);
  const [wrongWords, setWrongWords] = useState<Tables<"searched_words">[]>([]);
  const [wrongWordIds, setWrongWordIds] = useState<Set<string>>(new Set());

  const markWrong = useCallback((word: Tables<"searched_words">) => {
    setWrongWordIds(prev => {
      if (prev.has(word.id)) return prev;
      const next = new Set(prev);
      next.add(word.id);
      setWrongWords(w => [...w, word]);
      return next;
    });
  }, []);

  const updateScore = useCallback(async (delta: number) => {
    try {
      await supabase.rpc("add_to_score", { delta });
    } catch (e) {
      // ignore (anon users)
    }
  }, []);

  const currentQ = questions[currentIndex];
  const progress = questions.length > 0 ? ((currentIndex) / questions.length) * 100 : 0;

  const recordResult = useCallback(async (wordId: string, result: number) => {
    const cookie = getUserCookie();
    const { data: existing } = await supabase
      .from("quiz_results")
      .select("id")
      .eq("word_id", wordId)
      .eq("user_cookie", cookie)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("quiz_results")
        .update({ result, quiz_type: quizType, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
    } else {
      await supabase
        .from("quiz_results")
        .insert({ word_id: wordId, user_cookie: cookie, result, quiz_type: quizType });
    }
  }, [quizType]);

  const handleSelect = (index: number) => {
    if (showResult) return;
    setSelected(index);

    if (index === currentQ.correctIndex) {
      setIsCorrect(true);
      setShowResult(true);
      playCorrect();
      const resultValue = attempts === 0 ? 1 : 2;
      setScore(prev => ({
        ...prev,
        [resultValue === 1 ? "first" : "second"]: prev[resultValue === 1 ? "first" : "second"] + 1,
      }));
      recordResult(currentQ.correctWord.id, resultValue);
      // Score: only +2 if got it right on first try
      if (resultValue === 1) updateScore(2);
      // Auto-advance after 1.2s on correct answer
      setTimeout(() => {
        setSelected(null);
        setShowResult(false);
        setIsCorrect(false);
        setAttempts(0);
        handleNext();
      }, 1200);
    } else {
      if (attempts >= 1) {
        // Second wrong - show correct answer
        setIsCorrect(false);
        setShowResult(true);
        playWrong();
        setScore(prev => ({ ...prev, failed: prev.failed + 1 }));
        recordResult(currentQ.correctWord.id, 3);
        markWrong(currentQ.correctWord);
      } else {
        // First wrong - shake and allow retry, count -1 once
        playWrong();
        setShakeIndex(index);
        setAttempts(1);
        markWrong(currentQ.correctWord);
        updateScore(-1);
        setTimeout(() => setShakeIndex(null), 400);
      }
    }
  };

  const handleNeedStudy = () => {
    setIsCorrect(false);
    setShowResult(true);
    setSelected(currentQ.correctIndex);
    setScore(prev => ({ ...prev, failed: prev.failed + 1 }));
    recordResult(currentQ.correctWord.id, 3);
    markWrong(currentQ.correctWord);
    updateScore(-1);
  };

  const handleNext = () => {
    if (currentIndex + 1 >= questions.length) {
      setFinished(true);
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        colors: ["#4F46E5", "#22C55E", "#FBBF24", "#EF4444"],
      });
    } else {
      setCurrentIndex(prev => prev + 1);
      setAttempts(0);
      setSelected(null);
      setShowResult(false);
      setIsCorrect(false);
    }
  };

  if (questions.length === 0) {
    return (
      <div className="fixed inset-0 bg-background z-50 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <p className="font-display text-lg text-foreground">퀴즈를 만들 수 있는 단어가 부족합니다.</p>
          <p className="font-body text-sm text-muted-foreground">최소 2개 이상의 단어를 검색해주세요.</p>
          <Button onClick={onFinish} className="bg-primary text-primary-foreground font-display">메인으로</Button>
        </div>
      </div>
    );
  }

  if (finished) {
    const total = score.first + score.second + score.failed;
    const percent = total > 0 ? Math.round((score.first / total) * 100) : 0;
    return (
      <div className="fixed inset-0 bg-background z-50 flex items-center justify-center p-4 overflow-y-auto">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center space-y-6 max-w-sm w-full py-6"
        >
          <h2 className="font-display text-3xl font-bold text-foreground">🎉 퀴즈 완료!</h2>
          <div className="bg-card rounded-lg p-6 space-y-3 border border-border">
            <p className="font-display text-5xl font-bold text-primary">{percent}점</p>
            <div className="space-y-1 text-sm font-body text-muted-foreground">
              <p>✅ 한 번에 정답: <span className="text-success font-semibold">{score.first}</span></p>
              <p>⚠️ 두 번째에 정답: <span className="text-foreground font-semibold">{score.second}</span></p>
              <p>❌ 틀림: <span className="text-destructive font-semibold">{score.failed}</span></p>
            </div>
          </div>
          {wrongWords.length > 0 && (
            <div className="bg-card rounded-lg p-4 border border-border text-left space-y-2">
              <p className="font-display text-sm font-semibold text-destructive">📝 틀린 단어 다시 보기</p>
              <ul className="space-y-1.5">
                {wrongWords.map((w) => (
                  <li key={w.id} className="font-body text-sm text-foreground">
                    <span className="font-semibold">{w.word}</span>
                    <span className="text-muted-foreground"> - {w.definition}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Button onClick={onFinish} className="w-full h-12 bg-primary text-primary-foreground font-display text-base">
            메인으로
          </Button>
        </motion.div>
      </div>
    );
  }

  const typeLabel = currentQ.type === "word-to-def" ? "이 단어의 뜻은?" :
                    currentQ.type === "def-to-word" ? "이 뜻에 해당하는 단어는?" :
                    "빈칸에 들어갈 단어는?";

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      {/* Header */}
      <div className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={onFinish}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <span className="font-body text-sm text-muted-foreground">
            {currentIndex + 1} / {questions.length}
          </span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Question */}
      <div className="flex-1 flex flex-col justify-center px-4 pb-4 max-w-lg mx-auto w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            className="space-y-6"
          >
            <div className="text-center space-y-2">
              <p className="font-body text-sm text-primary font-medium">{typeLabel}</p>
              <p className="font-display text-2xl font-bold text-foreground leading-relaxed">{currentQ.prompt}</p>
            </div>

            {/* Options grid */}
            <div className="grid grid-cols-1 gap-3">
              {currentQ.options.map((option, i) => {
                let variant: "outline" | "default" | "destructive" = "outline";
                let extraClass = "h-auto min-h-[3.5rem] text-left px-4 py-3 font-body text-sm leading-snug whitespace-normal";

                if (showResult) {
                  if (i === currentQ.correctIndex) {
                    extraClass += " bg-success text-success-foreground border-success";
                  } else if (i === selected && !isCorrect) {
                    extraClass += " bg-destructive text-destructive-foreground border-destructive";
                  } else {
                    extraClass += " opacity-50";
                  }
                } else if (shakeIndex === i) {
                  extraClass += " animate-shake border-destructive";
                }

                return (
                  <Button
                    key={i}
                    variant={variant}
                    className={extraClass}
                    onClick={() => handleSelect(i)}
                    disabled={showResult}
                  >
                    {option}
                  </Button>
                );
              })}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              {!showResult && (
                <Button
                  variant="outline"
                  className="flex-1 font-body text-sm"
                  onClick={handleNeedStudy}
                >
                  <BookOpen className="h-4 w-4 mr-1" /> 공부필요
                </Button>
              )}
              {showResult && (
                <Button
                  className="flex-1 h-12 bg-primary text-primary-foreground font-display"
                  onClick={handleNext}
                >
                  {currentIndex + 1 >= questions.length ? "결과 보기" : "다음 문제"}
                </Button>
              )}
            </div>

            {showResult && !isCorrect && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center font-body text-sm text-muted-foreground"
              >
                정답: <span className="font-semibold text-foreground">{currentQ.correctWord.word}</span> - {currentQ.correctWord.definition}
              </motion.p>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
