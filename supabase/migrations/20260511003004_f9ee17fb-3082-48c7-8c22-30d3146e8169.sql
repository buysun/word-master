
DROP POLICY IF EXISTS "Allow anon select searched_words" ON public.searched_words;
DROP POLICY IF EXISTS "Allow anon insert searched_words" ON public.searched_words;
DROP POLICY IF EXISTS "Allow anon update searched_words" ON public.searched_words;
DROP POLICY IF EXISTS "Allow anon delete searched_words" ON public.searched_words;

CREATE POLICY "Anyone can select searched_words" ON public.searched_words
FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Anyone can insert searched_words" ON public.searched_words
FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Anyone can update searched_words" ON public.searched_words
FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Anyone can delete searched_words" ON public.searched_words
FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow anon select quiz_results" ON public.quiz_results;
DROP POLICY IF EXISTS "Allow anon insert quiz_results" ON public.quiz_results;
DROP POLICY IF EXISTS "Allow anon update quiz_results" ON public.quiz_results;

CREATE POLICY "Anyone can select quiz_results" ON public.quiz_results
FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Anyone can insert quiz_results" ON public.quiz_results
FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Anyone can update quiz_results" ON public.quiz_results
FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
