-- Lock down the SECURITY DEFINER trigger function so untrusted roles cannot
-- call it directly (e.g. via the PostgREST RPC endpoint). It only ever needs to
-- run as a trigger on auth.users; triggers fire regardless of the caller's
-- EXECUTE privilege, so revoking EXECUTE does NOT break signup — it only closes
-- the direct-call surface flagged by Supabase Security Advisor
-- ("Public/Signed-In Users Can Execute SECURITY DEFINER Function").
REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM anon;
REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM authenticated;
