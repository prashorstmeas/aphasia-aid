import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { db, EXERCISE_LABELS, type ExerciseType } from '../../db'
import { usePractice } from '../../hooks'
import { planRound, type PlanItem } from '../../practice-plan'

export { shuffle } from '../../practice-plan'

/** What each exercise tells the round machinery about its items. */
export type RoundItemMeta = PlanItem

export interface Round<T> {
  /** The current item, or undefined while the item list is still loading. */
  item: T | undefined
  idx: number
  total: number
  score: number
  finished: boolean
  /** Increments on every `restart`, so callers can reset per-round refs. */
  roundId: number
  /** Items answered wrong in this round, in the order they came up. */
  missed: RoundItemMeta[]
  /** Record the attempt and move to the next item (or finish the round). */
  answer(correct: boolean, extra?: { heard?: string; cueUsed?: boolean; selfMarked?: boolean }): Promise<void>
  restart(): void
  /** Null while loading, an empty array when the therapist has added no items of this kind. */
  items: T[] | null
}

/**
 * Deals a round from `all` (see `planRound` for how items are chosen), records each answer
 * as an Attempt, and tracks the score. The round is dealt once, so a therapist editing items
 * mid-round does not shift them.
 */
export function useRound<T>(all: T[] | undefined, type: ExerciseType, meta: (item: T) => RoundItemMeta): Round<T> {
  const { practice, loaded } = usePractice()
  const [queue, setQueue] = useState<T[] | null>(null)
  const [idx, setIdx] = useState(0)
  const [score, setScore] = useState(0)
  const [missed, setMissed] = useState<RoundItemMeta[]>([])
  const [finished, setFinished] = useState(false)
  const [roundId, setRoundId] = useState(0)

  // `all` is undefined only while the live query is in flight; an empty array is a real
  // empty round, which RoundShell turns into "ask your therapist to add some". Settings are
  // waited for too, so the round is never dealt at the default size or level by accident.
  useEffect(() => {
    if (queue || !all || !loaded) return
    if (all.length === 0) return setQueue([])
    let live = true
    // Only this exercise's attempts: item ids are unique within a type, not across them.
    const history = practice.adaptive ? db.attempts.where('type').equals(type).toArray() : Promise.resolve([])
    history.then((attempts) => { if (live) setQueue(planRound(all, attempts, meta, practice)) })
    return () => { live = false }
    // `practice` is a fresh object each render; the settings inside it are what matter, and
    // a round already dealt is never re-dealt anyway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, queue, loaded, type, meta, practice.roundSize, practice.adaptive, practice.level])

  const answer: Round<T>['answer'] = useCallback(
    async (correct, extra = {}) => {
      const item = queue?.[idx]
      if (!item) return
      const m = meta(item)
      await db.attempts.add({
        itemId: m.id,
        itemText: m.text,
        type,
        correct,
        heard: extra.heard,
        cueUsed: extra.cueUsed ?? false,
        selfMarked: extra.selfMarked ?? false,
        ts: Date.now(),
      })
      if (correct) setScore((s) => s + 1)
      else setMissed((prev) => [...prev, m])
      if (idx + 1 >= queue!.length) setFinished(true)
      else setIdx(idx + 1)
    },
    [queue, idx, meta, type],
  )

  const restart = useCallback(() => {
    setQueue(null)
    setIdx(0)
    setScore(0)
    setMissed([])
    setFinished(false)
    setRoundId((n) => n + 1)
  }, [])

  return { item: queue?.[idx], idx, total: queue?.length ?? 0, score, missed, finished, roundId, answer, restart, items: queue }
}

/** Back link, title and a progress bar, shared by every exercise. */
export function RoundHeader({ type, idx, total }: { type: ExerciseType; idx: number; total: number }) {
  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <Link to="/practice" className="btn btn-ghost">← Back</Link>
        <span className="text-lg font-semibold" style={{ color: 'var(--ink-muted)' }}>
          {EXERCISE_LABELS[type]} · {idx + 1} of {total}
        </span>
      </div>
      <div
        className="progress-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={idx}
        aria-label={`Question ${idx + 1} of ${total}`}
      >
        <div className="progress-fill" style={{ width: `${(idx / total) * 100}%` }} />
      </div>
    </div>
  )
}

export function RoundDone({ score, total, missed, onAgain }: { score: number; total: number; missed: RoundItemMeta[]; onAgain: () => void }) {
  // Encouraging, not graded: everyone gets a warm close, the number is just the number.
  const strong = score >= Math.ceil(total * 0.75)
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 py-6 text-center">
      <span className="text-8xl" aria-hidden="true">{strong ? '🎉' : '👏'}</span>
      <h1 className="text-4xl font-bold">{strong ? 'Well done!' : 'Good work.'}</h1>
      <p className="verdict verdict-yes text-3xl">
        You got <strong>{score}</strong> out of <strong>{total}</strong>.
      </p>
      {missed.length > 0 && (
        <div className="card w-full">
          <p className="text-xl font-semibold">Worth another look</p>
          <p className="mt-1 text-lg" style={{ color: 'var(--ink-muted)' }}>
            These come round again sooner next time.
          </p>
          <ul className="mt-3 flex flex-wrap justify-center gap-2">
            {missed.map((m) => <li key={m.id} className="chip chip-accent !text-base">{m.text}</li>)}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap justify-center gap-3">
        <button type="button" className="btn btn-primary" onClick={onAgain}>🔁 Practise again</button>
        <Link to="/practice" className="btn btn-secondary">Done</Link>
      </div>
    </div>
  )
}

/**
 * Renders the loading / nothing-to-practise / finished states common to every exercise,
 * and otherwise hands the current item to `children`.
 */
export function RoundShell<T>({ round, type, emptyMessage, children }: {
  round: Round<T>
  type: ExerciseType
  emptyMessage: string
  children: (item: T) => ReactNode
}) {
  if (!round.items) return <p className="p-6 text-2xl" style={{ color: 'var(--ink-muted)' }}>Loading…</p>
  if (round.items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="card text-2xl" style={{ color: 'var(--ink-muted)' }}>{emptyMessage}</p>
        <Link to="/practice" className="btn btn-secondary mt-4">← Back to practice</Link>
      </div>
    )
  }
  if (round.finished) return <RoundDone score={round.score} total={round.total} missed={round.missed} onAgain={round.restart} />
  if (!round.item) return null
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 text-center">
      <RoundHeader type={type} idx={round.idx} total={round.total} />
      {children(round.item)}
    </div>
  )
}
