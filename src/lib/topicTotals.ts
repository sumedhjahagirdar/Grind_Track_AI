// Total question counts per canonical DSA topic on LeetCode. Sourced
// directly from the user's LeetCode tag breakdown page (Jul 2026) and
// mapped onto this app's fixed 15-topic syllabus, combining the LeetCode
// tags that belong to each canonical topic:
//
// Arrays & Strings        = Array (2197) + String (880)
// Recursion & Backtracking = Recursion (51) + Backtracking (114)
// Linked Lists             = Linked List (82) + Doubly-Linked List (15)
// Stacks & Queues          = Stack (179) + Queue (57) + Monotonic Stack (73) + Monotonic Queue (25)
// Trees                    = Tree (265) + Binary Tree (180) + Binary Search Tree (43) + Binary Indexed Tree (44) + Segment Tree (80)
// Heaps / Priority Queues  = Heap / Priority Queue (219)
// Graphs                   = Graph Theory (187) + Union-Find (99) + Topological Sort (40) + Shortest Path (41) + Minimum Spanning Tree (6) + Strongly Connected Component (2) + Biconnected Component (1) + Eulerian Circuit (3)
// Dynamic Programming      = Dynamic Programming (666) + Memoization (43)
// Greedy Algorithms        = Greedy (470)
// Sliding Window / Two Pointers = Sliding Window (169) + Two Pointers (254)
// Binary Search            = Binary Search (343)
// Tries                    = Trie (61)
// Bit Manipulation         = Bit Manipulation (288) + Bitmask (55)
// Sorting Algorithms       = Sorting (527) + Counting Sort (11) + Bucket Sort (6) + Merge Sort (15) + Radix Sort (3) + Shell (4) + Quickselect (8)
// Math / Number Theory     = Math (684) + Number Theory (99) + Combinatorics (62) + Game Theory (30) + Probability and Statistics (7)
//
// A handful of LeetCode tags (Hash Table, Database, Matrix, Prefix Sum,
// Simulation, Design, etc.) don't map onto this 15-topic syllabus and
// are intentionally left out — this tracks a fixed DSA curriculum, not
// every LeetCode tag. Totals will drift slightly as LeetCode adds
// problems over time; update from a fresh tag-page screenshot whenever
// you want it re-synced.
export const TOPIC_TOTALS: Record<string, number> = {
  'Arrays & Strings': 3077,
  'Recursion & Backtracking': 165,
  'Linked Lists': 97,
  'Stacks & Queues': 334,
  'Trees': 612,
  'Heaps / Priority Queues': 219,
  'Graphs': 379,
  'Dynamic Programming': 709,
  'Greedy Algorithms': 470,
  'Sliding Window / Two Pointers': 423,
  'Binary Search': 343,
  'Tries': 61,
  'Bit Manipulation': 343,
  'Sorting Algorithms': 574,
  'Math / Number Theory': 882,
}

export function topicCoveragePercent(topicName: string, solved: number): number {
  const total = TOPIC_TOTALS[topicName]
  if (!total) return 0
  return Math.min(100, (solved / total) * 100)
}
