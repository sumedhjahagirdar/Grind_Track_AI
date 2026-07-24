// Approximate total question counts per canonical DSA topic on LeetCode.
// These are NOT live-synced — LeetCode's tag counts grow over time and
// several canonical topics here merge multiple LeetCode tags (e.g.
// "Arrays & Strings" = Array + String tags combined), so treat these as
// rough reference points for a coverage percentage, not exact figures.
// "Arrays & Strings" is confirmed accurate as of Jul 2026 (Array: 2197 +
// String: 880, from the user's own LeetCode tag page) — the rest are
// rough estimates pending the same kind of confirmation.
export const TOPIC_TOTALS: Record<string, number> = {
  'Arrays & Strings': 3077,
  'Recursion & Backtracking': 120,
  'Linked Lists': 80,
  'Stacks & Queues': 150,
  'Trees': 250,
  'Heaps / Priority Queues': 100,
  'Graphs': 200,
  'Dynamic Programming': 500,
  'Greedy Algorithms': 150,
  'Sliding Window / Two Pointers': 150,
  'Binary Search': 150,
  'Tries': 30,
  'Bit Manipulation': 130,
  'Sorting Algorithms': 90,
  'Math / Number Theory': 350,
}

export function topicCoveragePercent(topicName: string, solved: number): number {
  const total = TOPIC_TOTALS[topicName]
  if (!total) return 0
  return Math.min(100, (solved / total) * 100)
}
