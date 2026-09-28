/*
  # Striver A2Z sheet progress tracking

  Adds section-level progress tracking for Striver's A2Z DSA sheet
  (takeuforward.org), which the user has committed to as their single
  locked-in resource going forward. Tracks at the SECTION level (verified
  directly from the live site) rather than individual problems — the
  per-problem list with video/LeetCode links is gated behind a
  takeuforward.org login and isn't reliably scrapable, so fabricating 450
  individual problem rows with guessed links would risk silently broken
  data. Section names and total_problems below are real counts read
  directly from https://takeuforward.org/prep-hub/strivers-a2z-dsa-sheet
  on 2026-09-25.

  1. New table: striver_sections
    - One row per section per user, with a solved_count the user updates
      manually (same pattern as the existing `topics` table)
*/

CREATE TABLE IF NOT EXISTS striver_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'Core' CHECK (category IN ('Basic', 'Core', 'Pro')),
  total_problems integer NOT NULL DEFAULT 0,
  solved_count integer NOT NULL DEFAULT 0,
  order_index integer NOT NULL DEFAULT 0,
  last_practiced_at date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

ALTER TABLE striver_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own striver sections"
  ON striver_sections FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own striver sections"
  ON striver_sections FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own striver sections"
  ON striver_sections FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own striver sections"
  ON striver_sections FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
