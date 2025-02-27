
-- Create a table to store content history
CREATE TABLE IF NOT EXISTS public.content_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  industry TEXT NOT NULL,
  template TEXT NOT NULL,
  content TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add RLS policies
ALTER TABLE public.content_history ENABLE ROW LEVEL SECURITY;

-- Only allow users to see their own content history
CREATE POLICY "Users can view their own content" 
  ON public.content_history
  FOR SELECT 
  USING (email = auth.jwt() ->> 'email');

-- Only allow service role to insert content history
CREATE POLICY "Service role can insert content history" 
  ON public.content_history
  FOR INSERT 
  TO service_role
  WITH CHECK (true);
