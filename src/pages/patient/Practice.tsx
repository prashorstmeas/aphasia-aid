import { Link } from 'react-router-dom'
import { EXERCISE_LABELS, fillGap, type ExerciseType, type Question, type Sentence, type Word } from '../../db'
import { useAttempts, usePractice, useQuestions, useSentences, useWords } from '../../hooks'
import { atLevel, reviewCount, type PlanItem } from '../../practice-plan'
import { recognitionSupported } from '../../speech'

const EXERCISES: { type: ExerciseType; emoji: string; blurb: string; cat: number }[] = [
  { type: 'naming', emoji: '🖼️', blurb: 'See a picture, say what it is. Ask for a hint if you get stuck.', cat: 7 },
  { type: 'repetition', emoji: '🔁', blurb: 'Hear a word and see it, then say it back.', cat: 5 },
  { type: 'completion', emoji: '✍️', blurb: 'Read a sentence with a gap and choose the word that finishes it.', cat: 2 },
  { type: 'comprehension', emoji: '❓', blurb: 'Listen to a question and answer it with Yes or No.', cat: 3 },
  { type: 'reading', emoji: '📖', blurb: 'Read a whole sentence out loud.', cat: 4 },
]

const wordMeta = (w: Word): PlanItem => ({ id: w.id!, text: w.text, difficulty: w.difficulty })
const questionMeta = (q: Question): PlanItem => ({ id: q.id!, text: q.text, difficulty: q.difficulty })
const completionMeta = (s: Sentence): PlanItem => ({ id: s.id!, text: s.text, difficulty: s.difficulty })
const readingMeta = (s: Sentence): PlanItem => ({ id: s.id!, text: fillGap(s), difficulty: s.difficulty })

export default function Practice() {
  const words = useWords()
  const sentences = useSentences()
  const questions = useQuestions()
  const attempts = useAttempts()
  const { practice } = usePractice()

  /**
   * Round size and "to revisit" count for one exercise, from the same pool the round will
   * draw on: the items at the chosen level, with this exercise's own attempt history.
   * Null while the item list is still loading.
   */
  function stats(type: ExerciseType) {
    const from = <T,>(items: T[] | undefined, meta: (i: T) => PlanItem) => {
      if (!items) return null
      const pool = atLevel(items, meta, practice.level)
      return { size: Math.min(practice.roundSize, pool.length), review: reviewCount(pool, attempts, type, meta) }
    }
    switch (type) {
      case 'naming':
      case 'repetition':
        return from(words, wordMeta)
      case 'comprehension':
        return from(questions, questionMeta)
      case 'completion':
        return from(sentences, completionMeta)
      case 'reading':
        return from(sentences, readingMeta)
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <h1 className="text-3xl font-bold">Choose a practice</h1>
      {EXERCISES.map((e) => {
        const s = stats(e.type)
        return (
          <Link key={e.type} to={`/practice/${e.type}`} className="card card-choice" data-cat={e.cat}>
            <span
              className="grid shrink-0 place-items-center rounded-2xl text-5xl"
              style={{ background: 'var(--cat-tint)', border: '1px solid var(--cat-edge)', width: '5.5rem', height: '5.5rem' }}
              aria-hidden="true"
            >
              {e.emoji}
            </span>
            <span>
              <span className="block text-3xl font-bold" style={{ color: 'var(--cat-ink)' }}>{EXERCISE_LABELS[e.type]}</span>
              <span className="block text-xl" style={{ color: 'var(--ink-muted)' }}>{e.blurb}</span>
              {s && (
                <span className="mt-2 flex flex-wrap gap-2">
                  <span className="chip">{s.size} in a round</span>
                  {practice.adaptive && s.review > 0 && <span className="chip chip-accent">{s.review} to revisit</span>}
                </span>
              )}
            </span>
          </Link>
        )
      })}
      {!recognitionSupported && (
        <p className="card text-lg" style={{ background: 'var(--accent-tint)', borderColor: '#f2d4c2', color: '#7a3310' }}>
          This browser cannot listen to your voice. You can still practise — you or your helper will mark the
          speaking exercises, and <strong>{EXERCISE_LABELS.completion}</strong> and <strong>{EXERCISE_LABELS.comprehension}</strong> need no voice at all.
        </p>
      )}
    </div>
  )
}
