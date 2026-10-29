-- ==============================================================================
-- TVK MAKKAL SEVAI — PERAMBUR MLA CONSTITUENCY
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
    media_key TEXT,
    latitude NUMERIC(10, 6),
    longitude NUMERIC(10, 6),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- Index for instant ticket searches
CREATE INDEX IF NOT EXISTS idx_complaints_ticket_id ON public.complaints (ticket_id);
CREATE INDEX IF NOT EXISTS idx_complaints_mobile ON public.complaints (mobile);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON public.complaints (status);
CREATE INDEX IF NOT EXISTS idx_complaints_ward ON public.complaints (ward);

-- 2. Create Ticket Timeline / Status Updates Table
CREATE TABLE IF NOT EXISTS public.ticket_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    updated_by TEXT DEFAULT 'MLA Constituency Office',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_updates_complaint_id ON public.ticket_updates (complaint_id);

-- 3. Enable Row-Level Security (RLS)
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_updates ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies:

-- Policy A: Anyone (Citizens) can insert new grievances (Needs / Complaints / Voice)
CREATE POLICY "Allow public grievance submissions" 
ON public.complaints
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);

-- Policy B: Anyone (Citizens) can view ticket status using their Ticket ID
CREATE POLICY "Allow public status tracking by ticket_id" 
ON public.complaints
FOR SELECT 
TO anon, authenticated
USING (true);

-- Policy C: Staff / Service Role can update and manage tickets
CREATE POLICY "Allow service role full access to complaints" 
ON public.complaints
FOR ALL 
TO service_role
USING (true)
WITH CHECK (true);

-- Policy D: Allow public read of ticket timeline updates
CREATE POLICY "Allow public read on ticket updates"
ON public.ticket_updates
FOR SELECT
TO anon, authenticated
USING (true);

-- Policy E: Allow service role full access to ticket updates
CREATE POLICY "Allow service role full access to ticket updates"
ON public.ticket_updates
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
