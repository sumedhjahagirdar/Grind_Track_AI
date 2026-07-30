/*
  # Distinguish AI-generated vs manually-added plan tasks

  The 'Regenerate plan' flow needs to clear stale AI-suggested 'today' tasks
  from a previous regenerate (otherwise they stack up every time it's run),
  but must NOT delete tasks the user added themselves via "Add a task", and
  must NOT delete tasks that were carried over from a missed day by
  daily-carryover. Without a way to tell these apart, a blanket delete on
  'today' risks wiping out the wrong ones.

  1. Changes
    - Add `source` column to `plan_tasks`: 'ai' (default) or 'manual'
*/

ALTER TABLE plan_tasks
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'ai' CHECK (source IN ('ai', 'manual'));
