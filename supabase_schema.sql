-- ==============================================================================
-- TVK MAKKAL SEVAI — TVK VEDASANDUR & DINDIGUL EAST DISTRICT (TVK 133)
-- Leader: Thiru L. Dharmaraj (TVK Vedasandur & Dindigul East District Secretary)
-- Tamil Title: திண்டுக்கல் கிழக்கு மாவட்ட செயலாளர் திரு L. தர்மராஜ்
-- Constituencies: Vedasandur & Dindigul (வேடசந்தூர் மற்றும் திண்டுக்கல் தொகுதி)
-- Unions:
--   1. திண்டுக்கல் மேற்கு ஒன்றியம் (Dindigul West Union)
--   2. திண்டுக்கல் கிழக்கு ஒன்றியம் (Dindigul East Union)
--   3. வேடசந்தூர் வடக்கு ஒன்றியம் (Vedasandur North Union)
--   4. வேடசந்தூர் தெற்கு ஒன்றியம் (Vedasandur South Union)
--   5. குஜிலியம்பாறை மேற்கு ஒன்றியம் (Gujiliamparai West Union)
--   6. குஜிலியம்பாறை கிழக்கு ஒன்றியம் (Gujiliamparai East Union)
--
-- Supabase PostgreSQL Database Schema
-- Run this in Supabase Dashboard -> SQL Editor -> New Query -> Run
-- ==============================================================================

-- 1. Create Complaints & Needs Table
CREATE TABLE IF NOT EXISTS public.complaints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    mobile TEXT NOT NULL,
    address TEXT NOT NULL,
    ward TEXT NOT NULL,
    street TEXT NOT NULL,
    category TEXT NOT NULL,
    need_type TEXT,
    subject TEXT,
    description TEXT,
    type TEXT NOT NULL DEFAULT 'needs' CHECK (type IN ('needs', 'complaint', 'voice')),
    status TEXT NOT NULL DEFAULT 'Submitted' CHECK (status IN ('Submitted', 'Under Review', 'Assigned', 'In Progress', 'Resolved')),
    audio_url TEXT,
    image_url TEXT,
    media_key TEXT,
    transcription TEXT,
    assigned_officer TEXT,
    latitude NUMERIC(10, 6),
    longitude NUMERIC(10, 6),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- Indexes for instant searches
CREATE INDEX IF NOT EXISTS idx_complaints_ticket_id ON public.complaints (ticket_id);
CREATE INDEX IF NOT EXISTS idx_complaints_mobile ON public.complaints (mobile);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON public.complaints (status);
CREATE INDEX IF NOT EXISTS idx_complaints_ward ON public.complaints (ward);
CREATE INDEX IF NOT EXISTS idx_complaints_created_at ON public.complaints (created_at DESC);

-- 2. Create Ticket Timeline / Status Updates Table
CREATE TABLE IF NOT EXISTS public.ticket_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    updated_by TEXT DEFAULT 'Secretary Office',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_updates_complaint_id ON public.ticket_updates (complaint_id);

-- 3. Enable Row-Level Security (RLS)
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_updates ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies:

-- Policy A: Anyone (Citizens) can insert new grievances (Needs / Complaints / Voice)
DROP POLICY IF EXISTS "Allow public grievance submissions" ON public.complaints;
CREATE POLICY "Allow public grievance submissions" 
ON public.complaints
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);

-- Policy B: Anyone (Citizens) can view ticket status using their Ticket ID
DROP POLICY IF EXISTS "Allow public status tracking by ticket_id" ON public.complaints;
CREATE POLICY "Allow public status tracking by ticket_id" 
ON public.complaints
FOR SELECT 
TO anon, authenticated
USING (true);

-- Policy C: Service Role full access to complaints
DROP POLICY IF EXISTS "Allow service role full access to complaints" ON public.complaints;
CREATE POLICY "Allow service role full access to complaints" 
ON public.complaints
FOR ALL 
TO service_role
USING (true)
WITH CHECK (true);

-- Policy D: Allow authenticated staff to update complaints
DROP POLICY IF EXISTS "Allow authenticated staff to update complaints" ON public.complaints;
CREATE POLICY "Allow authenticated staff to update complaints" 
ON public.complaints
FOR UPDATE 
TO authenticated
USING (true)
WITH CHECK (true);

-- Policy E: Allow public read of ticket timeline updates
DROP POLICY IF EXISTS "Allow public read on ticket updates" ON public.ticket_updates;
CREATE POLICY "Allow public read on ticket updates"
ON public.ticket_updates
FOR SELECT
TO anon, authenticated
USING (true);

-- Policy F: Allow service role full access to ticket updates
DROP POLICY IF EXISTS "Allow service role full access to ticket updates" ON public.ticket_updates;
CREATE POLICY "Allow service role full access to ticket updates"
ON public.ticket_updates
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Policy G: Allow authenticated staff to insert ticket updates
DROP POLICY IF EXISTS "Allow authenticated staff to insert ticket updates" ON public.ticket_updates;
CREATE POLICY "Allow authenticated staff to insert ticket updates" 
ON public.ticket_updates
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Policy H: Allow authenticated staff to update ticket updates
DROP POLICY IF EXISTS "Allow authenticated staff to update ticket updates" ON public.ticket_updates;
CREATE POLICY "Allow authenticated staff to update ticket updates" 
ON public.ticket_updates
FOR UPDATE 
TO authenticated
USING (true)
WITH CHECK (true);
