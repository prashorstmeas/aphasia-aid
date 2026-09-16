import { useState } from 'react'
import { db, type Tile } from '../../db'
import { useBoards, useTiles } from '../../hooks'

async function swapOrder<T extends { id?: number; order: number }>(table: typeof db.tiles | typeof db.boards, a: T, b: T) {
  await db.transaction('rw', table, async () => {
    await table.update(a.id!, { order: b.order })
    await table.update(b.id!, { order: a.order })
  })
}

function TileRow({ tile, prev, next }: { tile: Tile; prev?: Tile; next?: Tile }) {
  const [draft, setDraft] = useState(tile)
  const dirty = draft.label !== tile.label || draft.emoji !== tile.emoji || (draft.speak ?? '') !== (tile.speak ?? '')
  const save = () => db.tiles.update(tile.id!, { label: draft.label.trim(), emoji: draft.emoji.trim(), speak: draft.speak?.trim() || undefined })
  return (
    <li className="grid grid-cols-[64px_1fr_1fr_auto] items-center gap-2 py-2">
      <input className="field text-center text-2xl" value={draft.emoji} onChange={(e) => setDraft({ ...draft, emoji: e.target.value })} aria-label="Picture (emoji)" />
      <input className="field" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} aria-label="Label" />
      <input className="field" value={draft.speak ?? ''} placeholder="Spoken phrase (optional)" onChange={(e) => setDraft({ ...draft, speak: e.target.value })} aria-label="Spoken phrase" />
      <div className="flex gap-1">
        <button type="button" className="rounded-lg border-2 border-[var(--hairline-strong)] px-3 py-2" disabled={!prev} onClick={() => prev && swapOrder(db.tiles, tile, prev)} aria-label="Move up">↑</button>
        <button type="button" className="rounded-lg border-2 border-[var(--hairline-strong)] px-3 py-2" disabled={!next} onClick={() => next && swapOrder(db.tiles, tile, next)} aria-label="Move down">↓</button>
        <button type="button" className="rounded-lg bg-[var(--primary)] px-3 py-2 font-bold text-white disabled:opacity-40" disabled={!dirty || !draft.label.trim()} onClick={save}>Save</button>
        <button type="button" className="rounded-lg border-2 border-[#f0cdd3] px-3 py-2 text-[var(--danger)]" onClick={() => confirm(`Delete "${tile.label}"?`) && db.tiles.delete(tile.id!)} aria-label="Delete">🗑️</button>
      </div>
    </li>
  )
}

export default function Boards() {
  const boards = useBoards()
  const [selected, setSelected] = useState<number | null>(null)
  const activeId = selected ?? boards[0]?.id
  const active = boards.find((b) => b.id === activeId)
  const tiles = useTiles(activeId)
  const [newTile, setNewTile] = useState({ emoji: '', label: '', speak: '' })
  const [newBoard, setNewBoard] = useState({ emoji: '', name: '' })

  const addTile = async () => {
    if (!activeId || !newTile.label.trim()) return
    await db.tiles.add({ boardId: activeId, label: newTile.label.trim(), emoji: newTile.emoji.trim() || '🔹', speak: newTile.speak.trim() || undefined, order: (tiles.at(-1)?.order ?? -1) + 1 })
    setNewTile({ emoji: '', label: '', speak: '' })
  }
  const addBoard = async () => {
    if (!newBoard.name.trim()) return
    const id = await db.boards.add({ name: newBoard.name.trim(), emoji: newBoard.emoji.trim() || '📋', order: (boards.at(-1)?.order ?? -1) + 1 })
    setNewBoard({ emoji: '', name: '' }); setSelected(id as number)
  }
  const deleteBoard = async () => {
    if (!active || !confirm(`Delete board "${active.name}" and all its pictures?`)) return
    await db.transaction('rw', db.boards, db.tiles, async () => {
      await db.tiles.where('boardId').equals(active.id!).delete()
      await db.boards.delete(active.id!)
    })
    setSelected(null)
  }
  const renameBoard = async () => {
    if (!active) return
    const name = prompt('Board name', active.name)?.trim()
    if (name) await db.boards.update(active.id!, { name })
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-[260px_1fr]">
      <aside className="card flex flex-col gap-2">
        <h2 className="text-lg font-bold">Boards</h2>
        {boards.map((b, i) => (
          <div key={b.id} className="flex items-center gap-1">
            <button type="button" className={`flex-1 rounded-xl px-3 py-3 text-left font-semibold ${b.id === activeId ? 'bg-[var(--primary)] text-white' : 'bg-[var(--surface-sunk)]'}`} onClick={() => setSelected(b.id!)}>
              {b.emoji} {b.name}
            </button>
            <button type="button" className="rounded-lg border-2 border-[var(--hairline-strong)] px-2 py-2" disabled={i === 0} onClick={() => swapOrder(db.boards, b, boards[i - 1])} aria-label="Move up">↑</button>
            <button type="button" className="rounded-lg border-2 border-[var(--hairline-strong)] px-2 py-2" disabled={i === boards.length - 1} onClick={() => swapOrder(db.boards, b, boards[i + 1])} aria-label="Move down">↓</button>
          </div>
        ))}
        <div className="mt-2 flex gap-1 border-t border-[var(--hairline)] pt-3">
          <input className="field w-16 text-center" placeholder="😀" value={newBoard.emoji} onChange={(e) => setNewBoard({ ...newBoard, emoji: e.target.value })} aria-label="New board emoji" />
          <input className="field" placeholder="New board" value={newBoard.name} onChange={(e) => setNewBoard({ ...newBoard, name: e.target.value })} aria-label="New board name" onKeyDown={(e) => e.key === 'Enter' && addBoard()} />
          <button type="button" className="rounded-lg bg-[var(--primary)] px-3 font-bold text-white" onClick={addBoard}>＋</button>
        </div>
      </aside>

      <section className="card">
        {active ? (
          <>
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-xl font-bold">{active.emoji} {active.name}</h2>
              <button type="button" className="rounded-lg border-2 border-[var(--hairline-strong)] px-3 py-1 text-sm" onClick={renameBoard}>Rename</button>
              <button type="button" className="ml-auto rounded-lg border-2 border-[#f0cdd3] px-3 py-1 text-sm text-[var(--danger)]" onClick={deleteBoard}>Delete board</button>
            </div>
            <p className="mb-2 text-sm text-[var(--ink-muted)]">Picture · Label shown on the tile · Longer phrase spoken when tapped (optional). Tip: type or paste any emoji.</p>
            <ul className="divide-y divide-[var(--hairline)]">
              {tiles.map((t, i) => <TileRow key={t.id} tile={t} prev={tiles[i - 1]} next={tiles[i + 1]} />)}
            </ul>
            <div className="mt-3 grid grid-cols-[64px_1fr_1fr_auto] items-center gap-2 border-t-2 border-[var(--hairline)] pt-3">
              <input className="field text-center text-2xl" placeholder="🔹" value={newTile.emoji} onChange={(e) => setNewTile({ ...newTile, emoji: e.target.value })} aria-label="New picture emoji" />
              <input className="field" placeholder="Label" value={newTile.label} onChange={(e) => setNewTile({ ...newTile, label: e.target.value })} aria-label="New label" onKeyDown={(e) => e.key === 'Enter' && addTile()} />
              <input className="field" placeholder="Spoken phrase (optional)" value={newTile.speak} onChange={(e) => setNewTile({ ...newTile, speak: e.target.value })} aria-label="New spoken phrase" onKeyDown={(e) => e.key === 'Enter' && addTile()} />
              <button type="button" className="rounded-lg bg-[var(--primary)] px-4 py-3 font-bold text-white" onClick={addTile}>Add</button>
            </div>
          </>
        ) : <p className="text-[var(--ink-muted)]">Create a board to get started.</p>}
      </section>
    </div>
  )
}
