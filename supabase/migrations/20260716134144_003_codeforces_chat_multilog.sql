/*
# Feature expansion: Codeforces, AI Chat, Multi-log

## 1. Codeforces snapshots table
Stores daily snapshots of Codeforces profile stats (rating, max rating, rank,
solved count, contest count) — mirrors leetcode_snapshots pattern.

## 2. Chat messages table
Stores interactive AI chat conversation history per user.

## 3. Multi-log support
The current daily_logs table has a unique constraint on (user_id, log_date).
We drop that constraint to allow multiple log entries per day.
(No unique constraint was found at table level, but we ensure no index blocks it.)

## 4. Settings: add codeforces_handle column
*/

-- 1. Codeforces snapshots
CREATE TABLE IF NOT EXISTS public.codeforces_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  handle text NOT NULL,
  rating integer DEFAULT 0,
  max_rating integer DEFAULT 0,
  rank text,
  max_rank text,
  solved_count integer DEFAULT 0,
  contest_count integer DEFAULT 0,
  friend_count integer DEFAULT 0,
  contribution integer DEFAULT 0,
  raw jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, snapshot_date)
);

ALTER TABLE public.codeforces_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_cf_snapshots" ON public.codeforces_snapshots FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_cf_snapshots" ON public.codeforces_snapshots FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_cf_snapshots" ON public.codeforces_snapshots FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_cf_snapshots" ON public.codeforces_snapshots FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- 2. Chat messages
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_chat" ON public.chat_messages FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_chat" ON public.chat_messages FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_chat" ON public.chat_messages FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_chat_messages_user_created
  ON public.chat_messages (user_id, created_at DESC);

-- 3. Multi-log: drop any unique constraint on (user_id, log_date) if it exists
DO $$
BEGIN
  -- Drop constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.daily_logs'::regclass
      AND conname = 'daily_logs_user_id_log_date_key'
  ) THEN
    ALTER TABLE public.daily_logs DROP CONSTRAINT daily_logs_user_id_log_date_key;
  END IF;
END $$;

-- 4. Settings: add codeforces_handle
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS codeforces_handle text;

-- 5. Triggers for updated_at
DROP TRIGGER IF EXISTS trg_codeforces_snapshots_touch ON codeforces_snapshots;
CREATE TRIGGER trg_codeforces_snapshots_touch BEFORE UPDATE ON codeforces_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_chat_messages_touch ON chat_messages;
CREATE TRIGGER trg_chat_messages_touch BEFORE UPDATE ON chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
