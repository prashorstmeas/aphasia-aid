import { useState } from 'react'
import { db, GAP, type Question, type Sentence } from '../../db'
import { useQuestions, useSentences } from '../../hooks'

const DIFFICULTIES = ['', 'Easy', 'Medium', 'Hard']

const EMPTY_SENTENCE: Omit<Sentence, 'id'> = { text: '', answer: '', distractors: [], emoji: '', difficulty: 1 }
const EMPTY_QUESTION: Omit<Question, 'id'> = { text: '', answer: true, emoji: '', difficulty: 1 }

function DifficultySelect({ value, onChange }: { value: 1 | 2 | 3; onChange: (d: 1 | 2 | 3) => void }) {
  return (
    <select className="field" value={value} onChange={(e) => onChange(Number(e.target.value) as 1 | 2 | 3)} aria-label="Difficulty">
      <option value={1}>Easy</option><option value={2}>Medium</option><option value={3}>Hard</option>
    </select>
  )
}

function FormButtons({ disabled, submitLabel, onSubmit, onCancel }: { disabled: boolean; submitLabel: string; onSubmit: () => void; onCancel?: () => void }) {
  return (
    <div className="flex gap-1">
      <button type="button" className="flex-1 rounded-lg bg-blue-700 px-3 py-3 font-bold text-white disabled:opacity-40" disabled={disabled} onClick={onSubmit}>{submitLabel}</button>
      {onCancel && <button type="button" className="rounded-lg border-2 border-gray-300 px-3 py-3" onClick={onCancel}>✕</button>}
    </div>
  )
}

function SentenceForm({ initial, submitLabel, onSubmit, onCancel }: { initial: Omit<Sentence, 'id'>; submitLabel: string; onSubmit: (s: Omit<Sentence, 'id'>) => void; onCancel?: () => void }) {
  const [s, setS] = useState(initial)
  const [distractors, setDistractors] = useState(initial.distractors.join(', '))
  const hasGap = s.text.includes(GAP)
  const valid = hasGap && s.answer.trim().length > 0

  return (
    <div className="grid grid-cols-[64px_1fr_1fr_110px] items-center gap-2">
      <input className="field text-center text-2xl" placeholder="🔹" value={s.emoji} onChange={(e) => setS({ ...s, emoji: e.target.value })} aria-label="Picture (emoji)" />
      <input className="field col-span-3" placeholder={`Sentence with a gap, e.g. "I drink my tea from a ${GAP}."`} value={s.text} onChange={(e) => setS({ ...s, text: e.target.value })} aria-label="Sentence" />
      <input className="field col-span-2 col-start-2" placeholder="Word that fills the gap" value={s.answer} onChange={(e) => setS({ ...s, answer: e.target.value })} aria-label="Answer" />
      <DifficultySelect value={s.difficulty} onChange={(d) => setS({ ...s, difficulty: d })} />
      <input className="field col-span-3 col-start-2" placeholder="Wrong choices, separated by commas (optional)" value={distractors} onChange={(e) => setDistractors(e.target.value)} aria-label="Wrong choices" />
      <div className="col-span-3 col-start-2 text-sm text-gray-600">
        {s.text && !hasGap
          ? <span className="text-red-700">The sentence needs a gap written as <code>{GAP}</code>.</span>
          : <>Reads aloud as “{(s.text || `A sentence with a ${GAP}.`).replace(GAP, s.answer || '…')}”. Blank wrong choices are filled in from your other sentences.</>}
      </div>
      <div className="col-span-3 col-start-2">
        <FormButtons
          disabled={!valid}
          submitLabel={submitLabel}
          onCancel={onCancel}
          onSubmit={() => onSubmit({
            ...s,
            text: s.text.trim(),
            answer: s.answer.trim(),
            emoji: s.emoji.trim() || '🔹',
            distractors: distractors.split(',').map((d) => d.trim()).filter(Boolean),
          })}
        />
      </div>
    </div>
  )
}

function QuestionForm({ initial, submitLabel, onSubmit, onCancel }: { initial: Omit<Question, 'id'>; submitLabel: string; onSubmit: (q: Omit<Question, 'id'>) => void; onCancel?: () => void }) {
  const [q, setQ] = useState(initial)
  return (
    <div className="grid grid-cols-[64px_1fr_110px_110px] items-center gap-2">
      <input className="field text-center text-2xl" placeholder="🔹" value={q.emoji} onChange={(e) => setQ({ ...q, emoji: e.target.value })} aria-label="Picture (emoji)" />
      <input className="field" placeholder='Question, e.g. "Does a dog bark?"' value={q.text} onChange={(e) => setQ({ ...q, text: e.target.value })} aria-label="Question" />
      <select className="field" value={q.answer ? 'yes' : 'no'} onChange={(e) => setQ({ ...q, answer: e.target.value === 'yes' })} aria-label="Correct answer">
        <option value="yes">Yes</option><option value="no">No</option>
      </select>
      <DifficultySelect value={q.difficulty} onChange={(d) => setQ({ ...q, difficulty: d })} />
      <div className="col-start-2 col-span-3">
        <FormButtons
          disabled={!q.text.trim()}
          submitLabel={submitLabel}
          onCancel={onCancel}
          onSubmit={() => onSubmit({ ...q, text: q.text.trim(), emoji: q.emoji.trim() || '🔹' })}
        />
      </div>
    </div>
  )
}

/** Editor for the sentence-completion / read-aloud set and the yes-no question set. */
export default function Sentences() {
  const sentences = useSentences() ?? []
  const questions = useQuestions() ?? []
  const [editingSentence, setEditingSentence] = useState<number | null>(null)
  const [editingQuestion, setEditingQuestion] = useState<number | null>(null)

  const byDifficulty = <T extends { difficulty: number; text: string }>(a: T, b: T) =>
    a.difficulty - b.difficulty || a.text.localeCompare(b.text)

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <p className="rounded-xl bg-blue-50 p-4 text-lg text-blue-900">
        Sentences are used twice: <strong>Finish the sentence</strong> hides the gap word, and <strong>Read aloud</strong> shows the
        whole sentence for the patient to read.
      </p>

      <div className="card">
        <h2 className="mb-2 text-xl font-bold">Add a sentence</h2>
        <SentenceForm key={sentences.length} initial={EMPTY_SENTENCE} submitLabel="Add" onSubmit={(s) => db.sentences.add(s)} />
      </div>

      <div className="card">
        <h2 className="mb-3 text-xl font-bold">Sentences ({sentences.length})</h2>
        <ul className="divide-y divide-gray-200">
          {[...sentences].sort(byDifficulty).map((s) => (
            <li key={s.id} className="py-2">
              {editingSentence === s.id ? (
                <SentenceForm initial={s} submitLabel="Save" onCancel={() => setEditingSentence(null)} onSubmit={async (u) => { await db.sentences.update(s.id!, u); setEditingSentence(null) }} />
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-3xl" aria-hidden="true">{s.emoji}</span>
                  <span className="text-lg">
                    {s.text.split(GAP)[0]}<strong className="underline">{s.answer}</strong>{s.text.split(GAP)[1]}
                  </span>
                  <span className="rounded bg-gray-100 px-2 text-sm">{DIFFICULTIES[s.difficulty]}</span>
                  {s.distractors.length > 0 && <span className="text-sm text-gray-600">vs {s.distractors.join(', ')}</span>}
                  <span className="ml-auto flex gap-1">
                    <button type="button" className="rounded-lg border-2 border-gray-300 px-3 py-2" onClick={() => setEditingSentence(s.id!)}>Edit</button>
                    <button type="button" className="rounded-lg border-2 border-red-300 px-3 py-2 text-red-700" onClick={() => confirm('Delete this sentence?') && db.sentences.delete(s.id!)} aria-label="Delete">🗑️</button>
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h2 className="mb-2 text-xl font-bold">Add a yes / no question</h2>
        <QuestionForm key={questions.length} initial={EMPTY_QUESTION} submitLabel="Add" onSubmit={(q) => db.questions.add(q)} />
      </div>

      <div className="card">
        <h2 className="mb-3 text-xl font-bold">Yes / no questions ({questions.length})</h2>
        <ul className="divide-y divide-gray-200">
          {[...questions].sort(byDifficulty).map((q) => (
            <li key={q.id} className="py-2">
              {editingQuestion === q.id ? (
                <QuestionForm initial={q} submitLabel="Save" onCancel={() => setEditingQuestion(null)} onSubmit={async (u) => { await db.questions.update(q.id!, u); setEditingQuestion(null) }} />
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-3xl" aria-hidden="true">{q.emoji}</span>
                  <span className="text-lg">{q.text}</span>
                  <span className={`rounded px-2 text-sm font-bold ${q.answer ? 'bg-green-100 text-green-900' : 'bg-red-100 text-red-900'}`}>{q.answer ? 'Yes' : 'No'}</span>
                  <span className="rounded bg-gray-100 px-2 text-sm">{DIFFICULTIES[q.difficulty]}</span>
                  <span className="ml-auto flex gap-1">
                    <button type="button" className="rounded-lg border-2 border-gray-300 px-3 py-2" onClick={() => setEditingQuestion(q.id!)}>Edit</button>
                    <button type="button" className="rounded-lg border-2 border-red-300 px-3 py-2 text-red-700" onClick={() => confirm(`Delete "${q.text}"?`) && db.questions.delete(q.id!)} aria-label="Delete">🗑️</button>
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
