import { useCallback, useEffect, useRef, useState } from 'react'
import { fillGap, type Sentence } from '../../db'
import { useSentences, useSettings } from '../../hooks'
import { listenOnce, phraseSimilarity, PHRASE_THRESHOLD, recognitionSupported, speak, stopSpeaking } from '../../speech'
import { RoundShell, useRound } from './round'

type Phase = 'prompt' | 'listening' | 'result'

const sentenceMeta = (s: Sentence) => ({ id: s.id!, text: fillGap(s) })

/**
 * Reading aloud: the whole sentence is shown and the patient reads it. Scoring is
 * word-overlap rather than exact match, and the helper can always override it.
 */
export default function Reading() {
  const sentences = useSentences()
  const { settings } = useSettings()
  const round = useRound(sentences, 'reading', sentenceMeta)
  const sentence = round.item

  const [phase, setPhase] = useState<Phase>('prompt')
  const [heard, setHeard] = useState<string | null>(null)
  const [autoCorrect, setAutoCorrect] = useState<boolean | null>(null)
  const [cueUsed, setCueUsed] = useState(false)
  const stopListening = useRef<(() => void) | null>(null)

  const say = useCallback((text: string) => speak(text, { voiceURI: settings.voiceURI, rate: settings.rate }), [settings])
  useEffect(() => () => stopSpeaking(), [])

  const listen = async () => {
    if (!sentence) return
    stopSpeaking()
    setPhase('listening')
    // Reading a sentence takes longer than saying a single word.
    const result = await listenOnce({ timeoutMs: 15_000, onReady: (stop) => { stopListening.current = stop } })
    stopListening.current = null
    setHeard(result)
    setAutoCorrect(
      result != null && settings.autoScore ? phraseSimilarity(fillGap(sentence), result) >= PHRASE_THRESHOLD : null,
    )
    setPhase('result')
  }

  const record = async (correct: boolean, selfMarked: boolean) => {
    await round.answer(correct, { heard: heard ?? undefined, cueUsed, selfMarked })
    setPhase('prompt')
    setHeard(null); setAutoCorrect(null); setCueUsed(false)
  }

  return (
    <RoundShell round={round} type="reading" emptyMessage="No sentences yet. Ask your therapist to add some.">
      {(s) => (
        <>
          <div className="prompt-card">
            <span className="text-7xl leading-none" style={{ filter: 'drop-shadow(0 6px 10px rgba(60,45,25,0.16))' }} aria-hidden="true">{s.emoji}</span>
            <p className="text-4xl font-bold leading-snug">{fillGap(s)}</p>
          </div>

          {phase === 'prompt' && (
            <div className="grid w-full grid-cols-1 gap-3">
              {recognitionSupported ? (
                <button type="button" className="btn btn-primary min-h-[96px] text-3xl" onClick={listen}>🎤 Read it aloud</button>
              ) : (
                <button type="button" className="btn btn-primary min-h-[96px] text-3xl" onClick={() => setPhase('result')}>I read it</button>
              )}
              <button type="button" className="btn btn-secondary" onClick={() => { setCueUsed(true); say(fillGap(s)) }}>
                🔊 Read it to me first
              </button>
            </div>
          )}

          {phase === 'listening' && (
            <div className="flex flex-col items-center gap-2 py-4">
              <span className="animate-pulse text-6xl" aria-hidden="true">🎤</span>
              <p className="text-2xl" style={{ color: 'var(--ink-muted)' }}>Listening… read the sentence now. Take your time.</p>
              <button type="button" className="btn btn-secondary mt-2" onClick={() => stopListening.current?.()}>✋ I've finished</button>
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
                <button type="button" className="btn btn-success min-h-[88px]" style={autoCorrect === true ? { boxShadow: '0 0 0 4px var(--success-tint), var(--lift-2)' } : undefined} onClick={() => record(true, autoCorrect !== true)}>✓ Read it well</button>
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
