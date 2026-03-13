-- Create agent_summaries table
CREATE TABLE IF NOT EXISTS public.agent_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    insights JSONB NOT NULL,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(agent_id)
);

-- Index for performance
CREATE INDEX IF NOT EXISTS agent_summaries_agent_id_idx ON public.agent_summaries (agent_id);

-- Enable Realtime for the table
ALTER TABLE public.agent_summaries REPLICA IDENTITY FULL;

-- Add to publication for realtime updates
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
    
    ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_summaries;
EXCEPTION
    WHEN duplicate_object THEN
        NULL;
END $$;
