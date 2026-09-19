// Type-only import: this module holds the selection maths and never touches the database,
// so `db.ts` can depend on it for its settings defaults without a cycle.
import type { Attempt, ExerciseType } from './db'

/** Which difficulties a round may draw from. `all` = every item, whatever its difficulty. */
export type PracticeLevel = 'all' | 1 | 2 | 3

export const LEVEL_LABELS: Record<string, string> = {
  all: 'Mixed — everything',
  1: 'Easy only',
  2: 'Easy and medium',
  3: 'Everything, hardest included',
}

export interface PracticeSettings {
  /** How many items in one round. */
  roundSize: number
  /** Weight the round towards items the patient gets wrong, instead of picking at random. */
  adaptive: boolean
  level: PracticeLevel
}

export const DEFAULT_PRACTICE: PracticeSettings = { roundSize: 8, adaptive: true, level: 'all' }

export const ROUND_SIZES = [4, 6, 8, 10, 12, 16]

/** What the planner needs to know about an item, whatever table it came from. */
export interface PlanItem {
  id: number
  text: string
  difficulty: 1 | 2 | 3
}

const DAY = 86_400_000
/** How many of an item's most recent attempts count towards its weight. */
const RECENT = 5
/** An item unpractised for this long counts as fully due again. */
const REST_DAYS = 7
/** How fast older attempts stop counting: each one back is worth half the one after it. */
const DECAY = 0.5

/** Credit for one attempt: a word found unaided is worth more than one found after a hint. */
function credit(a: Attempt) {
  if (!a.correct) return 0
  return a.cueUsed ? 0.5 : 1
}

/**
 * How much this item needs practice, from its recent history. Higher = deal it sooner.
 *
 * Three things move the weight: how much of the recent history was correct (the newest
 * attempts count most), how long ago it was last practised (spacing), and whether it has
 * ever been seen. A never-seen item sits above a mastered one and below a repeated error,
 * so a round mixes new material with the words that are actually going wrong.
 */
export function itemWeight(history: Attempt[], now = Date.now()) {
  if (history.length === 0) return 1.5
  const recent = [...history].sort((a, b) => b.ts - a.ts).slice(0, RECENT)
  // The newest attempt counts most, each older one half as much again, so today's failure
  // outweighs last week's success — and today's success outweighs last week's failure.
  let got = 0
  let possible = 0
  recent.forEach((a, i) => {
    const w = DECAY ** i
    got += credit(a) * w
    possible += w
  })
  const need = 1 - got / possible
  const daysSince = (now - recent[0].ts) / DAY
  const due = 0.6 + 0.4 * Math.min(daysSince / REST_DAYS, 1)
  return (0.35 + 2.4 * need) * due
}

/** Draw `n` items without replacement, each item's chance proportional to its weight. */
function weightedSample<T>(pool: { item: T; weight: number }[], n: number) {
  const rest = [...pool]
  const picked: T[] = []
  while (picked.length < n && rest.length > 0) {
    const total = rest.reduce((s, c) => s + c.weight, 0)
    let r = Math.random() * total
    let i = rest.findIndex((c) => (r -= c.weight) <= 0)
    if (i < 0) i = rest.length - 1
    picked.push(rest.splice(i, 1)[0].item)
  }
  return picked
}

export function shuffle<T>(arr: T[]) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Items at or below the chosen level — or every item when that leaves nothing to practise. */
export function atLevel<T>(items: T[], plan: (item: T) => PlanItem, level: PracticeLevel) {
  if (level === 'all') return items
  const kept = items.filter((i) => plan(i).difficulty <= level)
  return kept.length > 0 ? kept : items
}

/** Group a type's attempts by the item they belong to. */
export function historyByItem(attempts: Attempt[]) {
  const map = new Map<number, Attempt[]>()
  for (const a of attempts) {
    const list = map.get(a.itemId)
    if (list) list.push(a)
    else map.set(a.itemId, [a])
  }
  return map
}

/**
 * Deal one round: filter to the chosen level, then either sample by weight or shuffle.
 * Order within the round is always shuffled so the hardest items are not all at the front.
 * `attempts` must already be narrowed to this exercise — ids only mean anything within a type.
 */
export function planRound<T>(
  all: T[],
  attempts: Attempt[],
  plan: (item: T) => PlanItem,
  settings: PracticeSettings,
): T[] {
  const pool = atLevel(all, plan, settings.level)
  const size = Math.min(settings.roundSize, pool.length)
  if (!settings.adaptive) return shuffle(pool).slice(0, size)

  const history = historyByItem(attempts)
  const now = Date.now()
  const weighted = pool.map((item) => ({ item, weight: itemWeight(history.get(plan(item).id) ?? [], now) }))
  return shuffle(weightedSample(weighted, size))
}

/**
 * How many items are worth another look: the last attempt was wrong, or needed a cue.
 * Shown on the practice menu so a helper can see where the work is without opening Progress.
 * `attempts` may be the whole table — ids only mean anything within one exercise type.
 */
export function reviewCount<T>(items: T[], attempts: Attempt[], type: ExerciseType, plan: (item: T) => PlanItem) {
  const history = historyByItem(attempts.filter((a) => a.type === type))
  return items.filter((i) => {
    const h = history.get(plan(i).id)
    if (!h || h.length === 0) return false
    const last = h.reduce((a, b) => (b.ts > a.ts ? b : a))
    return credit(last) < 1
  }).length
}
