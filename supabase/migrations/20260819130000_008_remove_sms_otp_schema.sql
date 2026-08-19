/*
  # Remove unused SMS OTP schema

  Reverses migration 007 (sms_otp_password_reset). The SMS/Twilio-based
  password reset approach was abandoned before an edge function was ever
  built for it — no code in the app references otp_codes or settings.phone.
  Dropping both so the schema doesn't carry unused, half-built structure.
  A different password-reset approach can be designed fresh later.

  1. Changes
    - Drop `otp_codes` table entirely
    - Drop `settings.phone` column
*/

DROP TABLE IF EXISTS otp_codes;

ALTER TABLE settings
  DROP COLUMN IF EXISTS phone;
