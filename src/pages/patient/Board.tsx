import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Tile from '../../components/Tile'
import SentenceStrip from '../../components/SentenceStrip'
import { useBoards, useSettings, useTiles } from '../../hooks'
import type { Tile as TileRow } from '../../db'
import { speak } from '../../speech'

export default function Board() {
  const { boardId } = useParams()
  const navigate = useNavigate()
  const boards = useBoards()
  const { settings } = useSettings()
  const [sentence, setSentence] = useState<TileRow[]>([])

  const activeId = boardId ? Number(boardId) : boards[0]?.id
  const tiles = useTiles(activeId)

  // If the selected board was deleted, fall back to the first one.
  useEffect(() => {
    if (boards.length && activeId != null && !boards.some((b) => b.id === activeId)) navigate('/', { replace: true })
  }, [boards, activeId, navigate])

  const say = (text: string) => speak(text, { voiceURI: settings.voiceURI, rate: settings.rate })

  const tapTile = (t: TileRow) => {
    if (settings.speakOnTap) say(t.speak ?? t.label)
    setSentence((s) => [...s, t])
  }

  const speakSentence = () => say(sentence.map((t) => t.speak ?? t.label).join('. '))

  return (
    <div className="flex h-full flex-col gap-3">
      <SentenceStrip
        items={sentence}
        onSpeak={speakSentence}
        onBackspace={() => setSentence((s) => s.slice(0, -1))}
        onClear={() => setSentence([])}
      />

      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Categories">
        {boards.map((b) => (
          <button
            key={b.id}
            type="button"
            role="tab"
            aria-selected={b.id === activeId}
            className={`btn shrink-0 ${b.id === activeId ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => navigate(b.id === boards[0]?.id ? '/' : `/board/${b.id}`)}
          >
            <span aria-hidden="true">{b.emoji}</span> {b.name}
          </button>
        ))}
      </div>

      <div className={`grid gap-3 tiles-${settings.tileSize}`}>
        {tiles.map((t) => (
          <Tile key={t.id} emoji={t.emoji} label={t.label} onClick={() => tapTile(t)} />
        ))}
        {tiles.length === 0 && <p className="col-span-full p-6 text-center text-2xl text-gray-500">This board has no pictures yet.</p>}
      </div>
    </div>
  )
}
