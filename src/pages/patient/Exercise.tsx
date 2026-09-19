import { useCallback, useEffect, useRef, useState } from 'react'
import { type Word } from '../../db'
import { useSettings, useWords } from '../../hooks'
import { listenOnce, recognitionSupported, similarity, SIMILARITY_THRESHOLD, speak, stopSpeaking } from '../../speech'
import { RoundShell, useRound } from './round'

type Phase = 'prompt' | 'listening' | 'result'

const wordMeta = (w: Word) => ({ id: w.id!, text: w.text, difficulty: w.difficulty })

/** Say-the-word exercises: name a picture, or repeat a word you just heard. */
export default function Exercise({ type }: { type: 'naming' | 'repetition' }) {
  const words = useWords()
  const { settings } = useSettings()
  const isNaming = type === 'naming'
  const round = useRound(words, type, wordMeta)
  const word = round.item

  const [phase, setPhase] = useState<Phase>('prompt')
  const [heard, setHeard] = useState<string | null>(null)
  const [autoCorrect, setAutoCorrect] = useState<boolean | null>(null)
  const [cueUsed, setCueUsed] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const spokenFor = useRef<string | null>(null)
  const stopListening = useRef<(() => void) | null>(null)

  const say = useCallback((text: string) => speak(text, { voiceURI: settings.voiceURI, rate: settings.rate }), [settings])

  // Repetition: say the word automatically when it appears.
  useEffect(() => {
    if (isNaming || !word || phase !== 'prompt') return
    const key = `${round.roundId}:${word.id}`
    if (spokenFor.current === key) return
    spokenFor.current = key
    say(word.text)
  }, [word, phase, isNaming, say, round.roundId])

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
    await round.answer(correct, { heard: heard ?? undefined, cueUsed, selfMarked })
    setPhase('prompt')
    setHeard(null); setAutoCorrect(null); setCueUsed(false); setRevealed(false)
  }

  return (
    <RoundShell round={round} type={type} emptyMessage="No practice words yet. Ask your therapist to add some.">
      {(w) => (
        <>
          <div className="prompt-card">
            <span className="text-[9rem] leading-none" style={{ filter: 'drop-shadow(0 6px 10px rgba(60,45,25,0.16))' }} aria-hidden="true">{w.emoji}</span>
            {(!isNaming || revealed || phase === 'result') && <p className="text-5xl font-bold">{w.text}</p>}
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
                  <button type="button" className="btn btn-secondary" onClick={() => { setRevealed(true); setCueUsed(true); say(w.text) }}>👁️ Show word</button>
                </>
              ) : (
                <button type="button" className="btn btn-secondary col-span-2" onClick={() => say(w.text)}>🔊 Hear again</button>
              )}
            </div>
          )}

          {phase === 'listening' && (
            <div className="flex flex-col items-center gap-2 py-4">
              <span className="animate-pulse text-6xl" aria-hidden="true">🎤</span>
              <p className="text-2xl" style={{ color: 'var(--ink-muted)' }}>Listening… say <em>the word</em> now.</p>
              <button type="button" className="btn btn-secondary mt-2" onClick={() => stopListening.current?.()}>✋ I've said it</button>
            </div>
          )}

          {phase === 'result' && (
            <div className="flex w-full flex-col gap-3">
              {heard != null && (
                <p className={autoCorrect == null ? 'card text-2xl' : `verdict ${autoCorrect ? 'verdict-yes' : 'verdict-no'} !text-2xl`}>
                  <span>I heard: <strong>“{heard.split('|')[0].trim()}”</strong></span>
                  {autoCorrect != null && <span>{autoCorrect ? '✅ Sounds right' : '🤔 Not quite'}</span>}
                </p>
              )}
              {heard == null && recognitionSupported && <p className="text-2xl" style={{ color: 'var(--ink-muted)' }}>I didn't catch that.</p>}
              <div className="grid grid-cols-2 gap-3">
                <button type="button" className="btn btn-success min-h-[88px]" style={autoCorrect === true ? { boxShadow: '0 0 0 4px var(--success-tint), var(--lift-2)' } : undefined} onClick={() => record(true, autoCorrect !== true)}>✓ Got it</button>
                <button type="button" className="btn btn-danger min-h-[88px]" style={autoCorrect === false ? { boxShadow: '0 0 0 4px var(--danger-tint), var(--lift-2)' } : undefined} onClick={() => record(false, autoCorrect !== false)}>✗ Not yet</button>
                <button type="button" className="btn btn-secondary col-span-2" onClick={() => { setPhase('prompt'); setHeard(null); setAutoCorrect(null) }}>🔁 Try again</button>
              </div>
            </div>
          )}
        </>
      )}
    </RoundShell>
  )
}
