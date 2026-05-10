import { useState } from "react";
import { Volume2, Snail, Trash2, Brain, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { speak } from "@/lib/speech";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";

interface WordCardProps {
  word: string;
  phonetic?: string;
  definition: string;
  exampleSentence: string;
  seqNo?: number;
  onDelete?: () => void;
}

export default function WordCard({ word, phonetic, definition, exampleSentence, seqNo, onDelete }: WordCardProps) {
  const [showDelete, setShowDelete] = useState(false);
  const [tip, setTip] = useState<string | null>(null);
  const [tipLoading, setTipLoading] = useState(false);
  const x = useMotionValue(0);
  const deleteOpacity = useTransform(x, [-100, -60], [1, 0]);
  const deleteScale = useTransform(x, [-100, -60], [1, 0.8]);

  const handleDragEnd = (_: any, info: PanInfo) => {
    setShowDelete(info.offset.x < -60);
  };

  const handleMnemonic = async () => {
    if (tip) {
      setTip(null);
      return;
    }
    setTipLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("mnemonic", {
        body: { word, definition },
      });
      if (error) throw error;
      if (!data?.tip) throw new Error(data?.error || "암기 팁을 생성하지 못했습니다.");
      setTip(data.tip);
    } catch (err: any) {
      toast.error(err.message || "암기 팁 생성 실패");
    } finally {
      setTipLoading(false);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-lg">
      <motion.div
        style={{ opacity: showDelete ? 1 : deleteOpacity, scale: showDelete ? 1 : deleteScale }}
        className="absolute right-0 top-0 bottom-0 flex items-center justify-center w-20 bg-destructive rounded-r-lg z-0"
      >
        <Button variant="ghost" size="icon" className="h-full w-full text-destructive-foreground hover:bg-destructive/90 rounded-none" onClick={onDelete}>
          <Trash2 className="h-5 w-5" />
        </Button>
      </motion.div>

      <motion.div
        drag="x"
        dragConstraints={{ left: -80, right: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        animate={{ x: showDelete ? -80 : 0 }}
        style={{ x }}
        onTap={() => showDelete && setShowDelete(false)}
        initial={{ scale: 0.85, opacity: 0, y: 20 }}
        whileInView={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className="relative bg-card p-4 shadow-sm border border-border rounded-lg z-10 cursor-grab active:cursor-grabbing"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {seqNo != null && (
              <span className="text-xs font-mono text-muted-foreground bg-muted rounded px-1.5 py-0.5">{seqNo}</span>
            )}
            <h3 className="font-display text-xl font-bold text-foreground">{word}</h3>
            {phonetic && <span className="text-sm text-muted-foreground font-mono">{phonetic}</span>}
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10" onClick={() => speak(word, false)} aria-label="Normal speed">
              <Volume2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-muted" onClick={() => speak(word, true)} aria-label="Slow speed">
              <Snail className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-accent-foreground hover:bg-accent" onClick={handleMnemonic} aria-label="Mnemonic" disabled={tipLoading}>
              {tipLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <p className="font-body text-sm text-muted-foreground mb-2">{definition}</p>
        <p className="font-body text-sm text-foreground/80 italic">"{exampleSentence.split("\n")[0]}"</p>
        {tip && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mt-3 bg-primary/5 border border-primary/20 rounded-md p-3"
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Brain className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold text-primary">암기 팁</span>
            </div>
            <p className="font-body text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{tip}</p>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
