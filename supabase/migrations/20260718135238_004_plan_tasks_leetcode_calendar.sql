/*
# Adaptive Roadmap + Live LeetCode Integration

## 1. plan_tasks table (Adaptive Roadmap)
Replaces the flat plan_items table for the "Today / Tomorrow / This Week / This Month" roadmap.
Each task has a status (not_started / in_progress / completed), a scheduled date (the day
the task is due), and carry-over metadata. When a user misses days, incomplete tasks roll
forward to the next active day with an "overdue" flag and the original scheduled date
preserved in original_date.

Columns:
- id (uuid PK)
- user_id (uuid, defaults to auth.uid(), FK to auth.users)
- kind (text: 'today' | 'tomorrow' | 'this_week' | 'this_month')
- text (text, the task description)
- status (text: 'not_started' | 'in_progress' | 'completed', default 'not_started')
- scheduled_date (date, the day the task is due / planned for)
- original_date (date, nullable — set when a task is carried over from a prior date)
- carried_over (boolean, default false — true if this task was rolled forward from a missed day)
- completed_at (timestamptz, nullable)
- created_at (timestamptz, default now())
- updated_at (timestamptz, default now())

## 2. leetcode_submission_calendar table (Live LeetCode heatmap data)
Stores the per-day submission counts fetched from LeetCode's public GraphQL
userProfileCalendar endpoint. One row per (user_id, date).
This is the primary source of truth for the activity heatmap.

Columns:
- id (uuid PK)
- user_id (uuid, defaults to auth.uid(), FK to auth.users)
- date (date, the calendar day — e.g. 2026-07-18)
- submission_count (integer, number of accepted submissions that day)
- fetched_at (timestamptz, when the data was last refreshed from LeetCode)
- UNIQUE (user_id, date)

## 3. leetcode_sync_log table (Sync metadata + failure tracking)
Tracks each sync attempt so the UI can show "last synced X ago" and fall back
gracefully when the LeetCode API is unreachable / rate-limited.

Columns:
- id (uuid PK)
- user_id (uuid, defaults to auth.uid(), FK to auth.users)
- status (text: 'success' | 'failed')
- error_message (text, nullable — set when status='failed')
- submissions_synced (integer, count of calendar days updated)
- snapshot_synced (boolean, whether the daily stats snapshot was also stored)
- created_at (timestamptz, default now())

## 4. plan_items legacy compatibility
The existing plan_items table is left in place — the recommendations edge function
still writes to it. The new plan_tasks table is the source of truth for the Roadmap page.

## 5. Security
- RLS enabled on all three new tables.
- Owner-scoped CRUD policies (TO authenticated, auth.uid() = user_id).
- 4 policies per table (select/insert/update/delete).
*/

-- 1. plan_tasks
CREATE TABLE IF NOT EXISTS public.plan_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('today', 'tomorrow', 'this_week', 'this_month')),
  text text NOT NULL,
  status text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
  scheduled_date date NOT NULL DEFAULT CURRENT_DATE,
  original_date date,
  carried_over boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plan_tasks_user_kind_date
  ON public.plan_tasks (user_id, kind, scheduled_date DESC);

ALTER TABLE public.plan_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_plan_tasks" ON public.plan_tasks;
CREATE POLICY "select_own_plan_tasks" ON public.plan_tasks FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_plan_tasks" ON public.plan_tasks;
CREATE POLICY "insert_own_plan_tasks" ON public.plan_tasks FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_plan_tasks" ON public.plan_tasks;
CREATE POLICY "update_own_plan_tasks" ON public.plan_tasks FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_plan_tasks" ON public.plan_tasks;
CREATE POLICY "delete_own_plan_tasks" ON public.plan_tasks FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- 2. leetcode_submission_calendar
CREATE TABLE IF NOT EXISTS public.leetcode_submission_calendar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  submission_count integer NOT NULL DEFAULT 0,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_leetcode_cal_user_date
  ON public.leetcode_submission_calendar (user_id, date DESC);

ALTER TABLE public.leetcode_submission_calendar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_leetcode_cal" ON public.leetcode_submission_calendar;
CREATE POLICY "select_own_leetcode_cal" ON public.leetcode_submission_calendar FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_leetcode_cal" ON public.leetcode_submission_calendar;
CREATE POLICY "insert_own_leetcode_cal" ON public.leetcode_submission_calendar FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_leetcode_cal" ON public.leetcode_submission_calendar;
CREATE POLICY "update_own_leetcode_cal" ON public.leetcode_submission_calendar FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_leetcode_cal" ON public.leetcode_submission_calendar;
CREATE POLICY "delete_own_leetcode_cal" ON public.leetcode_submission_calendar FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- 3. leetcode_sync_log
CREATE TABLE IF NOT EXISTS public.leetcode_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('success', 'failed')),
  error_message text,
  submissions_synced integer NOT NULL DEFAULT 0,
  snapshot_synced boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leetcode_sync_log_user_created
  ON public.leetcode_sync_log (user_id, created_at DESC);

ALTER TABLE public.leetcode_sync_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_leetcode_sync_log" ON public.leetcode_sync_log;
CREATE POLICY "select_own_leetcode_sync_log" ON public.leetcode_sync_log FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_leetcode_sync_log" ON public.leetcode_sync_log;
CREATE POLICY "insert_own_leetcode_sync_log" ON public.leetcode_sync_log FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_leetcode_sync_log" ON public.leetcode_sync_log;
CREATE POLICY "delete_own_leetcode_sync_log" ON public.leetcode_sync_log FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- 4. updated_at trigger for plan_tasks
DROP TRIGGER IF EXISTS trg_plan_tasks_touch ON public.plan_tasks;
CREATE TRIGGER trg_plan_tasks_touch BEFORE UPDATE ON public.plan_tasks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
