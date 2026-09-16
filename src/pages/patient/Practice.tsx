import { Link } from 'react-router-dom'
import { EXERCISE_LABELS, type ExerciseType } from '../../db'
import { recognitionSupported } from '../../speech'

const EXERCISES: { type: ExerciseType; emoji: string; blurb: string }[] = [
  { type: 'naming', emoji: '🖼️', blurb: 'See a picture, say what it is. Ask for a hint if you get stuck.' },
  { type: 'repetition', emoji: '🔁', blurb: 'Hear a word and see it, then say it back.' },
  { type: 'completion', emoji: '✍️', blurb: 'Read a sentence with a gap and choose the word that finishes it.' },
  { type: 'comprehension', emoji: '❓', blurb: 'Listen to a question and answer it with Yes or No.' },
  { type: 'reading', emoji: '📖', blurb: 'Read a whole sentence out loud.' },
]

export default function Practice() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <h1 className="text-3xl font-bold">Choose a practice</h1>
      {EXERCISES.map((e) => (
        <Link key={e.type} to={`/practice/${e.type}`} className="card flex items-center gap-5 border-4 hover:border-blue-700">
          <span className="text-7xl" aria-hidden="true">{e.emoji}</span>
          <span>
            <span className="block text-3xl font-bold">{EXERCISE_LABELS[e.type]}</span>
            <span className="block text-xl text-gray-600">{e.blurb}</span>
          </span>
        </Link>
      ))}
      {!recognitionSupported && (
        <p className="rounded-xl bg-amber-50 p-4 text-lg text-amber-900">
          This browser cannot listen to your voice. You can still practise — you or your helper will mark the
          speaking exercises, and <strong>{EXERCISE_LABELS.completion}</strong> and <strong>{EXERCISE_LABELS.comprehension}</strong> need no voice at all.
        </p>
      )}
    </div>
  )
}
