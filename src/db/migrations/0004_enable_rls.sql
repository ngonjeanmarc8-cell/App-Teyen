-- Enable Row Level Security on all public tables.
-- The app reads/writes these tables ONLY via the server-side direct Postgres
-- connection (DATABASE_URL), whose role owns the tables and therefore bypasses
-- RLS. The Supabase anon/publishable key (shipped to browsers) goes through
-- PostgREST, which DOES honour RLS — so enabling RLS with no policies blocks
-- the public REST API from reading/writing user data directly, closing the hole
-- flagged by Supabase Security Advisor ("RLS Disabled in Public").
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mission_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mission_turns ENABLE ROW LEVEL SECURITY;
