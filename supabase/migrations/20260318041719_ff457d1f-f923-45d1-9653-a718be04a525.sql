
-- Create table for searched words
CREATE TABLE public.searched_words (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  word TEXT NOT NULL,
  definition TEXT NOT NULL,
  example_sentence TEXT NOT NULL,
  user_cookie TEXT NOT NULL,
  searched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Seoul')
);

-- Create table for quiz results
CREATE TABLE public.quiz_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  word_id UUID NOT NULL REFERENCES public.searched_words(id) ON DELETE CASCADE,
  user_cookie TEXT NOT NULL,
  result INTEGER NOT NULL DEFAULT 0, -- 1=first try correct, 2=second try correct, 3=failed
  quiz_type TEXT NOT NULL DEFAULT 'quiz1', -- quiz1 or quiz2
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(word_id, user_cookie)
);

-- Enable RLS
ALTER TABLE public.searched_words ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_results ENABLE ROW LEVEL SECURITY;

-- Allow anon access (cookie-based identification, no auth)
CREATE POLICY "Allow anon select searched_words" ON public.searched_words FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert searched_words" ON public.searched_words FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon select quiz_results" ON public.quiz_results FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert quiz_results" ON public.quiz_results FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update quiz_results" ON public.quiz_results FOR UPDATE TO anon USING (true);

-- Index for faster queries by user_cookie
CREATE INDEX idx_searched_words_user_cookie ON public.searched_words(user_cookie);
CREATE INDEX idx_searched_words_searched_at ON public.searched_words(searched_at);
CREATE INDEX idx_quiz_results_user_cookie ON public.quiz_results(user_cookie);
