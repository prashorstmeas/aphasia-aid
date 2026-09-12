import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { db, type ExerciseType, type Word } from '../../db'
import { useSettings, useWords } from '../../hooks'
import { listenOnce, recognitionSupported, similarity, SIMILARITY_THRESHOLD, speak, stopSpeaking } from '../../speech'

const ROUND_SIZE = 8
type Phase = 'prompt' | 'listening' | 'result' | 'finished'

function shuffle<T>(arr: T[]) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function Exercise() {
  const { type } = useParams<{ type: ExerciseType }>()
  const navigate = useNavigate()
  const words = useWords()
  const { settings } = useSettings()

  const [queue, setQueue] = useState<Word[] | null>(null)
  const [idx, setIdx] = useState(0)
  const [phase, setPhase] = useState<Phase>('prompt')
  const [heard, setHeard] = useState<string | null>(null)
  const [autoCorrect, setAutoCorrect] = useState<boolean | null>(null)
  const [cueUsed, setCueUsed] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [score, setScore] = useState(0)
  const spokenFor = useRef<number | null>(null)
  const stopListening = useRef<(() => void) | null>(null)

  const isNaming = type === 'naming'
  const word = queue?.[idx]

  // Build the round once the word list is loaded.
  useEffect(() => {
    if (!queue && words.length) setQueue(shuffle(words).slice(0, ROUND_SIZE))
  }, [words, queue])

  const say = useCallback((text: string) => speak(text, { voiceURI: settings.voiceURI, rate: settings.rate }), [settings])

  // Repetition: say the word automatically when it appears.
  useEffect(() => {
    if (!isNaming && word && phase === 'prompt' && spokenFor.current !== word.id) {
      spokenFor.current = word.id ?? null
      say(word.text)
    }
  }, [word, phase, isNaming, say])

  useEffect(() => () => stopSpeaking(), [])

  const listen = async () => {
    if (!word) return
    stopSpeaking()
    setPhase('listening')
    const result = await listenOnce({ onReady: (stop) => { stopListening.current = stop } })
    stopListening.current = null
    setHeard(result)
    setAutoCorrect(result != null && settings.autoScore ? similarity(word.text, result) >= SIMILARITY_THRESHOLD : null)
    setPhase('result')
  }

  const hint = () => {
    if (!word) return
    setCueUsed(true)
    say(word.hint ?? `It starts with "${word.text[0]}".`)
  }

  const record = async (correct: boolean, selfMarked: boolean) => {
    if (!word || !type) return
    await db.attempts.add({
      wordId: word.id!, wordText: word.text, type, correct,
      heard: heard ?? undefined, cueUsed, selfMarked, ts: Date.now(),
    })
    if (correct) setScore((s) => s + 1)
    if (idx + 1 >= (queue?.length ?? 0)) setPhase('finished')
    else {
      setIdx(idx + 1)
      setPhase('prompt')
      setHeard(null); setAutoCorrect(null); setCueUsed(false); setRevealed(false)
    }
  }

  const title = useMemo(() => (isNaming ? 'Name the picture' : 'Repeat the word'), [isNaming])

  if (!type || (type !== 'naming' && type !== 'repetition')) { navigate('/practice', { replace: true }); return null }
  if (!queue) return <p className="p-6 text-2xl">Loading…</p>
  if (queue.length === 0) return <p className="p-6 text-2xl">No practice words yet. Ask your therapist to add some.</p>

  if (phase === 'finished') {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 text-center">
        <span className="text-8xl" aria-hidden="true">🎉</span>
        <h1 className="text-4xl font-bold">Well done!</h1>
        <p className="text-3xl">You got <strong>{score}</strong> out of <strong>{queue.length}</strong>.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <button type="button" className="btn btn-primary" onClick={() => { setQueue(null); setIdx(0); setScore(0); setPhase('prompt'); spokenFor.current = null }}>🔁 Practise again</button>
          <Link to="/practice" className="btn btn-secondary">Done</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
      <div className="flex w-full items-center justify-between">
        <Link to="/practice" className="btn btn-ghost">← Back</Link>
        <span className="text-xl text-gray-600">{title} · {idx + 1} / {queue.length}</span>
      </div>

      <div className="card flex w-full flex-col items-center gap-3 py-8">
        <span className="text-[9rem] leading-none" aria-hidden="true">{word!.emoji}</span>
        {(!isNaming || revealed || phase === 'result') && <p className="text-5xl font-bold">{word!.text}</p>}
      </div>

      {phase === 'prompt' && (
        <div className="grid w-full grid-cols-2 gap-3">
          {recognitionSupported ? (
            <button type="button" className="btn btn-primary col-span-2 min-h-[96px] text-3xl" onClick={listen}>🎤 Say it</button>
          ) : (
            <button type="button" className="btn btn-primary col-span-2 min-h-[96px] text-3xl" onClick={() => setPhase('result')}>I said it</button>
          )}
          {isNaming ? (
            <>
              <button type="button" className="btn btn-secondary" onClick={hint}>💡 Hint</button>
              <button type="button" className="btn btn-secondary" onClick={() => { setRevealed(true); setCueUsed(true); say(word!.text) }}>👁️ Show word</button>
            </>
          ) : (
            <button type="button" className="btn btn-secondary col-span-2" onClick={() => say(word!.text)}>🔊 Hear again</button>
          )}
        </div>
      )}

      {phase === 'listening' && (
        <div className="flex flex-col items-center gap-2 py-4">
          <span className="animate-pulse text-6xl" aria-hidden="true">🎤</span>
          <p className="text-2xl">Listening… say <em>the word</em> now.</p>
          <button type="button" className="btn btn-secondary mt-2" onClick={() => stopListening.current?.()}>✋ I've said it</button>
        </div>
      )}

      {phase === 'result' && (
        <div className="flex w-full flex-col gap-3">
          {heard != null && (
            <p className="text-2xl">
              I heard: <strong>“{heard.split('|')[0].trim()}”</strong>
              {autoCorrect != null && <span className="ml-2">{autoCorrect ? '✅ Sounds right!' : '🤔 Not quite'}</span>}
            </p>
          )}
          {heard == null && recognitionSupported && <p className="text-2xl text-gray-600">I didn't catch that.</p>}
          <div className="grid grid-cols-2 gap-3">
            <button type="button" className={`btn btn-success min-h-[88px] ${autoCorrect === true ? 'ring-4 ring-green-300' : ''}`} onClick={() => record(true, autoCorrect !== true)}>✓ Got it</button>
            <button type="button" className={`btn btn-danger min-h-[88px] ${autoCorrect === false ? 'ring-4 ring-red-300' : ''}`} onClick={() => record(false, autoCorrect !== false)}>✗ Not yet</button>
            <button type="button" className="btn btn-secondary col-span-2" onClick={() => { setPhase('prompt'); setHeard(null); setAutoCorrect(null) }}>🔁 Try again</button>
          </div>
        </div>
      )}
    </div>
  )
}
