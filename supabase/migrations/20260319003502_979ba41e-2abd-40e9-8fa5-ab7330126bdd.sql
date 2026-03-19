
-- Add seq_no serial column for sequential display
ALTER TABLE searched_words ADD COLUMN seq_no bigserial;

-- Add UPDATE policy for searched_words (for updating searched_at on duplicate)
CREATE POLICY "Allow anon update searched_words"
ON public.searched_words
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- Add DELETE policy for searched_words (for swipe-to-delete)
CREATE POLICY "Allow anon delete searched_words"
ON public.searched_words
FOR DELETE
TO anon
USING (true);
