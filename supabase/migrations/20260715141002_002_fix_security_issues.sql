/*
# Fix Security Issues

## 1. Function Search Path Mutable
The `touch_updated_at()` trigger function had a mutable `search_path`, which is a
security risk — a malicious user could hijack function resolution by placing objects
earlier in the search path. Fix: pin `search_path = public` on the function definition.

## 2. RLS Policy Always True on login_attempts
The `insert_login_attempts` policy used `WITH CHECK (true)` scoped to `anon, authenticated`,
allowing anyone to insert arbitrary rows. This table is not used by any application code
(no edge function or frontend writes to it). Fix: drop the permissive insert policy entirely.
The table remains locked down — no inserts are possible without an explicit policy.
The existing SELECT policy (authenticated only) is retained for any future admin use.

## Changes
- `public.touch_updated_at()`: pinned `search_path = public`
- `public.login_attempts`: dropped `insert_login_attempts` INSERT policy
*/

-- 1. Pin search_path on touch_updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Re-attach triggers (CREATE OR REPLACE drops existing triggers on the function)
-- Triggers themselves are tied to the table, not the function, so they survive.
-- But we ensure they exist:
DROP TRIGGER IF EXISTS trg_daily_logs_touch ON daily_logs;
CREATE TRIGGER trg_daily_logs_touch BEFORE UPDATE ON daily_logs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_settings_touch ON settings;
CREATE TRIGGER trg_settings_touch BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2. Drop permissive insert policy on login_attempts
DROP POLICY IF EXISTS "insert_login_attempts" ON login_attempts;
