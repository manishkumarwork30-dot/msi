-- Create Teams Table
CREATE TABLE IF NOT EXISTS public.teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create Agents Table
CREATE TABLE IF NOT EXISTS public.agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create Daily Entries Table
CREATE TABLE IF NOT EXISTS public.daily_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    calls INTEGER DEFAULT 0,
    files INTEGER DEFAULT 0,
    entry INTEGER DEFAULT 0,
    pb INTEGER DEFAULT 0,
    hr INTEGER DEFAULT 0,
    jk INTEGER DEFAULT 0,
    hp INTEGER DEFAULT 0,
    mp INTEGER DEFAULT 0,
    rj INTEGER DEFAULT 0,
    up INTEGER DEFAULT 0,
    br INTEGER DEFAULT 0,
    others INTEGER DEFAULT 0,
    is_leave BOOLEAN DEFAULT FALSE,
    last_month_entry INTEGER DEFAULT 0,
    curr_month_entry INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(agent_id, date) -- An agent should have only one entry per date
);

-- Create Daily Summary Table
CREATE TABLE IF NOT EXISTS public.daily_summary (
    date DATE PRIMARY KEY,
    ivr_calls INTEGER DEFAULT 0,
    received_calls INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Optional: Insert default teams based on your image
INSERT INTO public.teams (name) VALUES ('UT'), ('ARR'), ('IND'), ('MS2') ON CONFLICT (name) DO NOTHING;

-- Migrations (safe to run multiple times)
ALTER TABLE public.daily_entries ADD COLUMN IF NOT EXISTS last_month_entry INTEGER DEFAULT 0;
ALTER TABLE public.daily_entries ADD COLUMN IF NOT EXISTS curr_month_entry INTEGER DEFAULT 0;

-- Create Agent Monthly Entries Table
CREATE TABLE IF NOT EXISTS public.agent_monthly_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE,
    month VARCHAR(7) NOT NULL, -- Format: 'YYYY-MM'
    last_month_entry INTEGER DEFAULT 0,
    curr_month_entry INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(agent_id, month)
);

-- RLS Policy Fixes (Run this in Supabase SQL Editor if you get RLS errors)
-- Option A: Enable full access for authenticated users (Recommended since you use login)
ALTER TABLE public.agent_monthly_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all actions for authenticated users on agent_monthly_entries" ON public.agent_monthly_entries;
CREATE POLICY "Allow all actions for authenticated users on agent_monthly_entries"
ON public.agent_monthly_entries
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Option B: Disable RLS completely if you want to bypass policies
-- ALTER TABLE public.agent_monthly_entries DISABLE ROW LEVEL SECURITY;


