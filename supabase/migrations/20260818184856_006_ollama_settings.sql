/*
# Add Ollama local AI configuration columns to settings

1. Purpose
   Adds two new nullable columns to the `settings` table so the user can
   configure a local Ollama instance as an alternative AI provider for the
   AI Coach chat. Ollama runs on the user's own machine, so there are no
   per-request API fees or third-party quotas — the only limits are the
   user's hardware (RAM/VRAM, GPU speed) and the quality of the local model.

2. New Columns
   - `ollama_url` (text, nullable) — base URL of the user's local Ollama
     server. Defaults to http://localhost:11434 when the user selects Ollama
     but leaves this blank. Stored so the browser can call Ollama directly
     (the cloud edge function cannot reach a localhost address).
   - `ollama_model` (text, nullable) — the model name to use, e.g.
     "llama3.1", "qwen2.5", "mistral". The user picks this from models
     they have already pulled via `ollama pull <name>`.

3. Security
   - No changes to RLS. The existing owner-scoped policies on `settings`
     already cover SELECT/INSERT/UPDATE/DELETE for these new columns.

4. Notes
   - Both columns are nullable so existing rows are unaffected. The
     frontend treats a null `ollama_url` as http://localhost:11434 and a
     null `ollama_model` as an empty string (which will prompt the user
     to pick a model before chatting).
   - No data is lost — this is purely additive.
*/

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS ollama_url text,
  ADD COLUMN IF NOT EXISTS ollama_model text;
