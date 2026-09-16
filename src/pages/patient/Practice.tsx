import { Link } from 'react-router-dom'
import { EXERCISE_LABELS, type ExerciseType } from '../../db'
import { recognitionSupported } from '../../speech'

const EXERCISES: { type: ExerciseType; emoji: string; blurb: string; cat: number }[] = [
  { type: 'naming', emoji: '🖼️', blurb: 'See a picture, say what it is. Ask for a hint if you get stuck.', cat: 7 },
  { type: 'repetition', emoji: '🔁', blurb: 'Hear a word and see it, then say it back.', cat: 5 },
  { type: 'completion', emoji: '✍️', blurb: 'Read a sentence with a gap and choose the word that finishes it.', cat: 2 },
  { type: 'comprehension', emoji: '❓', blurb: 'Listen to a question and answer it with Yes or No.', cat: 3 },
  { type: 'reading', emoji: '📖', blurb: 'Read a whole sentence out loud.', cat: 4 },
]

export default function Practice() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <h1 className="text-3xl font-bold">Choose a practice</h1>
      {EXERCISES.map((e) => (
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
          </span>
        </Link>
      ))}
      {!recognitionSupported && (
        <p className="card text-lg" style={{ background: 'var(--accent-tint)', borderColor: '#f2d4c2', color: '#7a3310' }}>
          This browser cannot listen to your voice. You can still practise — you or your helper will mark the
          speaking exercises, and <strong>{EXERCISE_LABELS.completion}</strong> and <strong>{EXERCISE_LABELS.comprehension}</strong> need no voice at all.
        </p>
      )}
    </div>
  )
}
