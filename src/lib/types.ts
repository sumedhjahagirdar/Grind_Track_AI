export type Difficulty = 'easy' | 'medium' | 'hard'

export interface DifficultyFeedback {
  topic: string
  note: string
}

export interface LearningEntry {
  resource_type: string
  source: string
  topic: string
  units: string
}

export interface ParsedLog {
  date: string
  leetcode: {
    easy_solved: number
    medium_solved: number
    hard_solved: number
    topics: string[]
    difficulty_feedback: DifficultyFeedback[]
  }
  codeforces: {
    solved: number
    contest_rating_change: number
    topics: string[]
  }
  learning: LearningEntry[]
  other_notes: string
  raw_input: string
}

export interface DailyLog {
  id: string
  user_id: string
  log_date: string
  raw_input: string
  parsed: ParsedLog
  easy_solved: number
  medium_solved: number
  hard_solved: number
  topics: string[]
  time_minutes: number
  difficulty_rating: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface LeetcodeSnapshot {
  id: string
  user_id: string
  snapshot_date: string
  total_solved: number
  easy_solved: number
  medium_solved: number
  hard_solved: number
  acceptance_rate: number | null
  contest_rating: number | null
  contest_count: number | null
  global_ranking: number | null
  raw: Record<string, unknown>
  created_at: string
}

export interface RecommendationPayload {
  tomorrow: {
    leetcode_targets: { easy: number; medium: number; hard: number }
    topics_to_practice: string[]
    learning_tasks: string[]
  }
  this_week: {
    topics_to_finish: string[]
    question_targets: { easy: number; medium: number; hard: number }
    milestone: string
  }
  this_month: {
    roadmap: string[]
    estimated_readiness: string
  }
  weak_areas: string[]
  strengths: string[]
  suggested_resources: { topic: string; type: string; suggestion: string }[]
}

export interface Recommendation {
  id: string
  user_id: string
  payload: RecommendationPayload
  generated_at: string
  created_at: string
}

export type TopicStatus = 'not_started' | 'in_progress' | 'practiced' | 'mastered'

export interface Topic {
  id: string
  user_id: string
  name: string
  status: TopicStatus
  questions_solved: number
  last_practiced_at: string | null
  display_order: number
  created_at: string
}

export type PlanKind = 'today' | 'tomorrow' | 'this_week' | 'this_month'

export interface PlanItem {
  id: string
  user_id: string
  kind: PlanKind
  text: string
  completed: boolean
  created_at: string
  completed_at: string | null
}

export type TaskStatus = 'not_started' | 'in_progress' | 'completed'

export interface PlanTask {
  id: string
  user_id: string
  kind: PlanKind
  text: string
  status: TaskStatus
  scheduled_date: string
  original_date: string | null
  carried_over: boolean
  source: 'ai' | 'manual'
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface LeetcodeCalendarEntry {
  date: string
  submission_count: number
}

export interface LeetcodeSyncLogEntry {
  id: string
  status: 'success' | 'failed'
  error_message: string | null
  submissions_synced: number
  snapshot_synced: boolean
  created_at: string
}

export interface CarryOverResult {
  carried_over_count: number
  missed_days: number
  message: string | null
}

export interface Settings {
  id: string
  user_id: string
  leetcode_username: string | null
  codeforces_handle: string | null
  goal_text: string | null
  target_date: string | null
  ai_provider: string
  daily_reminder_time: string | null
  ollama_url: string | null
  ollama_model: string | null
  created_at: string
  updated_at: string
}

export interface CodeforcesSnapshot {
  id: string
  user_id: string
  snapshot_date: string
  handle: string
  rating: number
  max_rating: number
  rank: string | null
  max_rank: string | null
  solved_count: number
  contest_count: number
  friend_count: number
  contribution: number
  raw: Record<string, unknown>
  created_at: string
}

export interface ChatMessage {
  id: string
  user_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export const CANONICAL_TOPICS = [
  'Arrays & Strings',
  'Recursion & Backtracking',
  'Linked Lists',
  'Stacks & Queues',
  'Trees',
  'Heaps / Priority Queues',
  'Graphs',
  'Dynamic Programming',
  'Greedy Algorithms',
  'Sliding Window / Two Pointers',
  'Binary Search',
  'Tries',
  'Bit Manipulation',
  'Sorting Algorithms',
  'Math / Number Theory',
] as const

// Striver's A2Z DSA sheet sections, in order, with real problem counts
// verified directly from takeuforward.org (2026-09-25). 'category' matches
// the site's own Basic/Core/Pro tiering.
export const STRIVER_SECTIONS: { name: string; total: number; category: 'Basic' | 'Core' | 'Pro' }[] = [
  { name: 'Beginner Problems', total: 83, category: 'Basic' },
  { name: 'Sorting', total: 7, category: 'Basic' },
  { name: 'Arrays', total: 32, category: 'Core' },
  { name: 'Hashing', total: 6, category: 'Core' },
  { name: 'Binary Search', total: 32, category: 'Core' },
  { name: 'Strings (Basic and Medium)', total: 7, category: 'Core' },
  { name: 'Recursion', total: 22, category: 'Core' },
  { name: 'Linked List', total: 49, category: 'Core' },
  { name: 'Bit Manipulation', total: 14, category: 'Core' },
  { name: 'Greedy Algorithms', total: 14, category: 'Core' },
  { name: 'Sliding Window / 2 Pointer', total: 13, category: 'Core' },
  { name: 'Stack / Queues', total: 31, category: 'Core' },
  { name: 'Binary Trees', total: 32, category: 'Core' },
  { name: 'Binary Search Trees', total: 15, category: 'Core' },
  { name: 'Heaps', total: 20, category: 'Core' },
  { name: 'Graphs', total: 46, category: 'Pro' },
  { name: 'Dynamic Programming', total: 53, category: 'Pro' },
  { name: 'Tries', total: 7, category: 'Pro' },
  { name: 'Strings (Advanced Algo)', total: 9, category: 'Pro' },
  { name: 'Maths', total: 3, category: 'Pro' },
]

export const STRIVER_SHEET_URL = 'https://takeuforward.org/prep-hub/strivers-a2z-dsa-sheet?page=sheet'

export interface StriverSection {
  id: string
  user_id: string
  name: string
  category: 'Basic' | 'Core' | 'Pro'
  total_problems: number
  solved_count: number
  order_index: number
  last_practiced_at: string | null
  created_at: string
  updated_at: string
}
