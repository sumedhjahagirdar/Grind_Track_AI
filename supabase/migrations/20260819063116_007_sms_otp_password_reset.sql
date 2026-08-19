/*
# Add phone number to settings + OTP codes table for SMS password reset

1. Purpose
   Adds a phone number column to the settings table so users can receive
   SMS-based OTP codes for password reset. Also creates an otp_codes table
   to store verification codes securely (hashed) with expiry and single-use
   enforcement. This replaces Supabase's built-in email OTP with a custom
   Twilio-based SMS flow.

2. New Columns
   - settings.phone (text, nullable) — user's phone number in E.164 format
     (e.g. +1234567890). Used by the password-reset edge function to send
     and verify SMS OTP codes.

3. New Tables
   - otp_codes
     - id (uuid, primary key)
     - phone (text, not null) — the phone number the code was sent to
     - code_hash (text, not null) — SHA-256 hash of the 6-digit code
     - purpose (text, not null) — what the OTP is for (e.g. 'password_reset')
     - expires_at (timestamptz, not null) — when the code expires (5 min)
     - used_at (timestamptz, nullable) — when the code was consumed
     - created_at (timestamptz, default now)

4. Security
   - otp_codes: RLS enabled. The anon role can INSERT (to create a code
     request) and SELECT (to verify), but cannot read the code_hash column
     directly — the edge function uses the service role key to verify,
     so the column is excluded from anon SELECT via column grants.
   - Actually, simpler and safer: RLS denies all direct access. The edge
     function (using service role key, which bypasses RLS) handles all
     reads and writes. The anon client never touches this table directly.
   - settings: existing owner-scoped policies already cover the new phone
     column — no policy changes needed.

5. Notes
   - Codes are stored as SHA-256 hashes, never plaintext.
   - Codes expire after 5 minutes and can only be used once.
   - The edge function enforces rate limiting (max 1 code per 60 seconds
     per phone number) to prevent abuse.
*/

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS phone text;

CREATE TABLE IF NOT EXISTS otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  code_hash text NOT NULL,
  purpose text NOT NULL DEFAULT 'password_reset',
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;

-- Deny all direct access from anon and authenticated roles.
-- The edge function uses the service role key which bypasses RLS.
DROP POLICY IF EXISTS "deny_otp_select" ON otp_codes;
CREATE POLICY "deny_otp_select" ON otp_codes
  FOR SELECT TO anon, authenticated USING (false);

DROP POLICY IF EXISTS "deny_otp_insert" ON otp_codes;
CREATE POLICY "deny_otp_insert" ON otp_codes
  FOR INSERT TO anon, authenticated WITH CHECK (false);

DROP POLICY IF EXISTS "deny_otp_update" ON otp_codes;
CREATE POLICY "deny_otp_update" ON otp_codes
  FOR UPDATE TO anon, authenticated USING (false);

DROP POLICY IF EXISTS "deny_otp_delete" ON otp_codes;
CREATE POLICY "deny_otp_delete" ON otp_codes
  FOR DELETE TO anon, authenticated USING (false);

-- Index for rate-limiting and verification lookups
CREATE INDEX IF NOT EXISTS idx_otp_codes_phone_created ON otp_codes (phone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_otp_codes_phone_purpose ON otp_codes (phone, purpose);
