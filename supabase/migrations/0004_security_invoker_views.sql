-- Supabase advisor: "Security Definer View". Make the stats views run with the caller's permissions.
-- Safe: they only aggregate published reviews, which anyone may read under RLS anyway.
-- (Fresh installs already get this from 0001; this patch fixes databases created earlier.)
alter view public.clinic_stats  set (security_invoker = true);
alter view public.dentist_stats set (security_invoker = true);
