-- ==========================================================
-- Run this in Supabase Dashboard -> SQL Editor -> Run
-- ==========================================================

-- 1. Add missing optional columns if not already added
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS assigned_officer TEXT;
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS transcription TEXT;

-- 2. Allow logged-in staff (authenticated users) to update complaints
DROP POLICY IF EXISTS "Allow authenticated staff to update complaints" ON public.complaints;
CREATE POLICY "Allow authenticated staff to update complaints" 
ON public.complaints
FOR UPDATE 
TO authenticated
USING (true)
WITH CHECK (true);

-- 3. Allow logged-in staff to insert timeline notes
DROP POLICY IF EXISTS "Allow authenticated staff to insert ticket updates" ON public.ticket_updates;
CREATE POLICY "Allow authenticated staff to insert ticket updates" 
ON public.ticket_updates
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- 4. Allow logged-in staff to update timeline notes
DROP POLICY IF EXISTS "Allow authenticated staff to update ticket updates" ON public.ticket_updates;
CREATE POLICY "Allow authenticated staff to update ticket updates" 
ON public.ticket_updates
FOR UPDATE 
TO authenticated
USING (true)
WITH CHECK (true);
