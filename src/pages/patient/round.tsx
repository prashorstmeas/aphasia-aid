import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { db, EXERCISE_LABELS, type ExerciseType } from '../../db'

export const ROUND_SIZE = 8

export function shuffle<T>(arr: T[]) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export interface RoundItemMeta {
  /** Id within the item's own table. */
  id: number
  /** What Progress groups and lists this item by. */
  text: string
}

export interface Round<T> {
  /** The current item, or undefined while the item list is still loading. */
  item: T | undefined
  idx: number
  total: number
  score: number
  finished: boolean
  /** Increments on every `restart`, so callers can reset per-round refs. */
  roundId: number
  /** Record the attempt and move to the next item (or finish the round). */
  answer(correct: boolean, extra?: { heard?: string; cueUsed?: boolean; selfMarked?: boolean }): Promise<void>
  restart(): void
  /** Null while loading, an empty array when the therapist has added no items of this kind. */
  items: T[] | null
}

/**
 * Deals a fixed-size round from `all`, records each answer as an Attempt, and tracks the score.
 * The round is dealt once, so a therapist editing items mid-round does not shift them.
 */
export function useRound<T>(all: T[] | undefined, type: ExerciseType, meta: (item: T) => RoundItemMeta, size = ROUND_SIZE): Round<T> {
  const [queue, setQueue] = useState<T[] | null>(null)
  const [idx, setIdx] = useState(0)
  const [score, setScore] = useState(0)
  const [finished, setFinished] = useState(false)
  const [roundId, setRoundId] = useState(0)

  // `all` is undefined only while the live query is in flight; an empty array is a real
  // empty round, which RoundShell turns into "ask your therapist to add some".
  useEffect(() => {
    if (!queue && all) setQueue(shuffle(all).slice(0, size))
  }, [all, queue, size])

  const answer: Round<T>['answer'] = useCallback(
    async (correct, extra = {}) => {
      const item = queue?.[idx]
      if (!item) return
      const { id, text } = meta(item)
      await db.attempts.add({
        itemId: id,
        itemText: text,
        type,
        correct,
        heard: extra.heard,
        cueUsed: extra.cueUsed ?? false,
        selfMarked: extra.selfMarked ?? false,
        ts: Date.now(),
      })
      if (correct) setScore((s) => s + 1)
      if (idx + 1 >= queue!.length) setFinished(true)
      else setIdx(idx + 1)
    },
    [queue, idx, meta, type],
  )

  const restart = useCallback(() => {
    setQueue(null)
    setIdx(0)
    setScore(0)
    setFinished(false)
    setRoundId((n) => n + 1)
  }, [])

  return { item: queue?.[idx], idx, total: queue?.length ?? 0, score, finished, roundId, answer, restart, items: queue }
}

/** Back link and "3 / 8" progress, shared by every exercise. */
export function RoundHeader({ type, idx, total }: { type: ExerciseType; idx: number; total: number }) {
  return (
    <div className="flex w-full items-center justify-between">
      <Link to="/practice" className="btn btn-ghost">← Back</Link>
      <span className="text-xl text-gray-600">{EXERCISE_LABELS[type]} · {idx + 1} / {total}</span>
    </div>
  )
}

export function RoundDone({ score, total, onAgain }: { score: number; total: number; onAgain: () => void }) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 text-center">
      <span className="text-8xl" aria-hidden="true">🎉</span>
      <h1 className="text-4xl font-bold">Well done!</h1>
      <p className="text-3xl">You got <strong>{score}</strong> out of <strong>{total}</strong>.</p>
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
  if (!round.items) return <p className="p-6 text-2xl">Loading…</p>
  if (round.items.length === 0) return <p className="p-6 text-2xl">{emptyMessage}</p>
  if (round.finished) return <RoundDone score={round.score} total={round.total} onAgain={round.restart} />
  if (!round.item) return null
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
      <RoundHeader type={type} idx={round.idx} total={round.total} />
      {children(round.item)}
    </div>
  )
}
