-- Create public_reports table
CREATE TABLE IF NOT EXISTS public.public_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    recommendation_data JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for performance
CREATE INDEX IF NOT EXISTS public_reports_client_id_idx ON public.public_reports (client_id);
CREATE INDEX IF NOT EXISTS public_reports_agent_id_idx ON public.public_reports (agent_id);

-- Enable Realtime for the table
ALTER TABLE public.public_reports REPLICA IDENTITY FULL;

-- Add to publication for realtime updates
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
    
    ALTER PUBLICATION supabase_realtime ADD TABLE public.public_reports;
EXCEPTION
    WHEN duplicate_object THEN
        NULL;
END $$;
