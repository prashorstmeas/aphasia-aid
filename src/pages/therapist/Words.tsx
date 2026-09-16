import { useState } from 'react'
import { db, type Word } from '../../db'
import { useWords } from '../../hooks'

const EMPTY: Omit<Word, 'id'> = { text: '', emoji: '', category: '', difficulty: 1, hint: '' }

function WordForm({ initial, onSubmit, onCancel, submitLabel }: { initial: Omit<Word, 'id'>; onSubmit: (w: Omit<Word, 'id'>) => void; onCancel?: () => void; submitLabel: string }) {
  const [w, setW] = useState(initial)
  return (
    <div className="grid grid-cols-[64px_1fr_1fr_110px] items-center gap-2">
      <input className="field text-center text-2xl" placeholder="🔹" value={w.emoji} onChange={(e) => setW({ ...w, emoji: e.target.value })} aria-label="Picture (emoji)" />
      <input className="field" placeholder="Word" value={w.text} onChange={(e) => setW({ ...w, text: e.target.value })} aria-label="Word" />
      <input className="field" placeholder="Category" value={w.category} onChange={(e) => setW({ ...w, category: e.target.value })} aria-label="Category" />
      <select className="field" value={w.difficulty} onChange={(e) => setW({ ...w, difficulty: Number(e.target.value) as 1 | 2 | 3 })} aria-label="Difficulty">
        <option value={1}>Easy</option><option value={2}>Medium</option><option value={3}>Hard</option>
      </select>
      <input className="field col-span-3" placeholder='Hint read aloud, e.g. "You drink from it. It starts with k."' value={w.hint ?? ''} onChange={(e) => setW({ ...w, hint: e.target.value })} aria-label="Hint" />
      <div className="flex gap-1">
        <button type="button" className="flex-1 rounded-lg bg-blue-700 px-3 py-3 font-bold text-white disabled:opacity-40" disabled={!w.text.trim()} onClick={() => onSubmit({ ...w, text: w.text.trim(), emoji: w.emoji.trim() || '🔹', category: w.category.trim() || 'General', hint: w.hint?.trim() || undefined })}>{submitLabel}</button>
        {onCancel && <button type="button" className="rounded-lg border-2 border-gray-300 px-3 py-3" onClick={onCancel}>✕</button>}
      </div>
    </div>
  )
}

export default function Words() {
  const words = useWords() ?? []
  const [editing, setEditing] = useState<number | null>(null)
  const [filter, setFilter] = useState('')
  const categories = [...new Set(words.map((w) => w.category))].sort()
  const shown = words.filter((w) => !filter || w.category === filter).sort((a, b) => a.difficulty - b.difficulty || a.text.localeCompare(b.text))

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <div className="card">
        <h2 className="mb-2 text-xl font-bold">Add a practice word</h2>
        <WordForm key={words.length} initial={EMPTY} submitLabel="Add" onSubmit={(w) => db.words.add(w)} />
      </div>

      <div className="card">
        <div className="mb-3 flex items-center gap-3">
          <h2 className="text-xl font-bold">Practice words ({shown.length})</h2>
          <select className="field ml-auto w-auto" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter by category">
            <option value="">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <ul className="divide-y divide-gray-200">
          {shown.map((w) => (
            <li key={w.id} className="py-2">
              {editing === w.id ? (
                <WordForm initial={w} submitLabel="Save" onCancel={() => setEditing(null)} onSubmit={async (u) => { await db.words.update(w.id!, u); setEditing(null) }} />
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-3xl" aria-hidden="true">{w.emoji}</span>
                  <span className="text-lg font-semibold">{w.text}</span>
                  <span className="rounded bg-gray-100 px-2 text-sm">{w.category}</span>
                  <span className="rounded bg-gray-100 px-2 text-sm">{['', 'Easy', 'Medium', 'Hard'][w.difficulty]}</span>
                  {w.hint && <span className="text-sm text-gray-600">“{w.hint}”</span>}
                  <span className="ml-auto flex gap-1">
                    <button type="button" className="rounded-lg border-2 border-gray-300 px-3 py-2" onClick={() => setEditing(w.id!)}>Edit</button>
                    <button type="button" className="rounded-lg border-2 border-red-300 px-3 py-2 text-red-700" onClick={() => confirm(`Delete "${w.text}"?`) && db.words.delete(w.id!)} aria-label="Delete">🗑️</button>
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
