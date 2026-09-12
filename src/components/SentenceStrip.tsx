import type { Tile } from '../db'

interface Props {
  items: Tile[]
  onSpeak: () => void
  onBackspace: () => void
  onClear: () => void
}

export default function SentenceStrip({ items, onSpeak, onBackspace, onClear }: Props) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border-4 border-blue-700 bg-white p-2 sm:flex-row sm:items-stretch" role="region" aria-label="Sentence">
      <div className="flex min-h-[72px] flex-1 flex-wrap items-center gap-2 px-2 sm:min-h-[88px]">
        {items.length === 0 ? (
          <span className="text-2xl text-gray-500">Tap pictures to build a sentence…</span>
        ) : (
          items.map((t, i) => (
            <span key={`${t.id}-${i}`} className="flex items-center gap-1 rounded-xl bg-blue-50 px-3 py-2 text-2xl font-bold">
              <span aria-hidden="true">{t.emoji}</span> {t.label}
            </span>
          ))
        )}
      </div>
      <div className="flex gap-2">
        <button type="button" className="btn btn-primary flex-1 sm:min-w-[120px]" onClick={onSpeak} disabled={items.length === 0} aria-label="Speak sentence">
          🔊 Speak
        </button>
        <button type="button" className="btn btn-secondary" onClick={onBackspace} disabled={items.length === 0} aria-label="Remove last word">
          ⌫
        </button>
        <button type="button" className="btn btn-secondary" onClick={onClear} disabled={items.length === 0} aria-label="Clear sentence">
          🗑️
        </button>
      </div>
    </div>
  )
}
