import { useState, useMemo } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tables } from "@/integrations/supabase/types";

interface QuizSetupModalProps {
  open: boolean;
  onClose: () => void;
  words: Tables<"searched_words">[];
  onStart: (wordIds: string[]) => void;
  title: string;
}

export default function QuizSetupModal({ open, onClose, words, onStart, title }: QuizSetupModalProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const dates = useMemo(() => {
    const dateSet = new Set(words.map(w => format(new Date(w.searched_at), "yyyy-MM-dd")));
    return Array.from(dateSet).sort().reverse();
  }, [words]);

  const handleStart = (mode: "all" | "date") => {
    let filtered = words;
    if (mode === "date" && selectedDate) {
      filtered = words.filter(w => format(new Date(w.searched_at), "yyyy-MM-dd") === selectedDate);
    }
    // Random 30 for "all" mode
    if (mode === "all" && filtered.length > 30) {
      filtered = [...filtered].sort(() => Math.random() - 0.5).slice(0, 30);
    }
    onStart(filtered.map(w => w.id));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <Button
            onClick={() => handleStart("all")}
            className="w-full h-12 font-display bg-primary text-primary-foreground"
            disabled={words.length === 0}
          >
            전체 단어 (최대 30문제)
          </Button>

          <div className="text-center text-sm text-muted-foreground font-body">또는 날짜를 선택하세요</div>

          <div className="max-h-48 overflow-y-auto space-y-1">
            {dates.map(date => {
              const count = words.filter(w => format(new Date(w.searched_at), "yyyy-MM-dd") === date).length;
              return (
                <Button
                  key={date}
                  variant={selectedDate === date ? "default" : "outline"}
                  className="w-full justify-between font-body"
                  onClick={() => {
                    setSelectedDate(date);
                    const filtered = words.filter(w => format(new Date(w.searched_at), "yyyy-MM-dd") === date);
                    onStart(filtered.map(w => w.id));
                  }}
                >
                  <span>{date}</span>
                  <span className="text-xs opacity-70">{count}단어</span>
                </Button>
              );
            })}
          </div>

          {words.length === 0 && (
            <p className="text-center text-sm text-muted-foreground font-body">검색한 단어가 없습니다.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
