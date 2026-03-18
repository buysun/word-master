import { Volume2, Snail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { speak } from "@/lib/speech";
import { motion } from "framer-motion";

interface WordCardProps {
  word: string;
  definition: string;
  exampleSentence: string;
}

export default function WordCard({ word, definition, exampleSentence }: WordCardProps) {
  return (
    <motion.div
      initial={{ scale: 0.85, opacity: 0, y: 20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="rounded-lg bg-card p-4 shadow-sm border border-border"
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-display text-xl font-bold text-foreground">{word}</h3>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-primary hover:bg-primary/10"
            onClick={() => speak(word, false)}
            aria-label="Normal speed"
          >
            <Volume2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:bg-muted"
            onClick={() => speak(word, true)}
            aria-label="Slow speed"
          >
            <Snail className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <p className="font-body text-sm text-muted-foreground mb-2">{definition}</p>
      <p className="font-body text-sm text-foreground/80 italic">"{exampleSentence}"</p>
    </motion.div>
  );
}
