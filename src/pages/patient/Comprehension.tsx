import { useCallback, useEffect, useRef, useState } from 'react'
import { type Question } from '../../db'
import { useQuestions, useSettings } from '../../hooks'
import { speak, stopSpeaking } from '../../speech'
import { RoundShell, useRound } from './round'

const questionMeta = (q: Question) => ({ id: q.id!, text: q.text, difficulty: q.difficulty })

/**
 * Yes/no comprehension: the question is shown and read aloud, and answered with two
 * large buttons. Like sentence completion, a wrong answer is not retried for credit.
 */
export default function Comprehension() {
  const questions = useQuestions()
  const { settings } = useSettings()
  const round = useRound(questions, 'comprehension', questionMeta)
  const question = round.item

  const [answered, setAnswered] = useState<boolean | null>(null)
  const [cueUsed, setCueUsed] = useState(false)
  const askedFor = useRef<string | null>(null)

  const say = useCallback((text: string) => speak(text, { voiceURI: settings.voiceURI, rate: settings.rate }), [settings])

  // Read each question aloud once as it appears; comprehension is a listening task too.
  useEffect(() => {
    if (!question || answered != null) return
    const key = `${round.roundId}:${question.id}`
    if (askedFor.current === key) return
    askedFor.current = key
    say(question.text)
  }, [question, answered, say, round.roundId])

  useEffect(() => () => stopSpeaking(), [])

  const correct = answered != null && question != null && answered === question.answer

  const choose = (value: boolean) => {
    if (answered != null) return
    stopSpeaking()
    setAnswered(value)
  }

  const next = async () => {
    await round.answer(correct, { heard: answered == null ? undefined : answered ? 'yes' : 'no', cueUsed })
    setAnswered(null)
    setCueUsed(false)
  }

  return (
    <RoundShell round={round} type="comprehension" emptyMessage="No questions yet. Ask your therapist to add some.">
      {(q) => (
        <>
          <div className="prompt-card">
            <span className="text-8xl leading-none" style={{ filter: 'drop-shadow(0 6px 10px rgba(60,45,25,0.16))' }} aria-hidden="true">{q.emoji}</span>
            <p className="text-4xl font-bold leading-snug">{q.text}</p>
            {answered == null && (
              <button type="button" className="btn btn-secondary" onClick={() => { setCueUsed(true); say(q.text) }}>
                🔊 Say it again
              </button>
            )}
          </div>

          {answered == null ? (
            <div className="grid w-full grid-cols-2 gap-3">
              <button type="button" className="btn btn-success min-h-[120px] text-4xl" onClick={() => choose(true)}>👍 Yes</button>
              <button type="button" className="btn btn-danger min-h-[120px] text-4xl" onClick={() => choose(false)}>👎 No</button>
            </div>
          ) : (
            <div className="flex w-full flex-col gap-3">
              <p className={`verdict ${correct ? 'verdict-yes' : 'verdict-no'}`}>{correct ? '✅ That’s right!' : '🤔 Not quite.'}</p>
              {!correct && (
                <p className="text-2xl" style={{ color: 'var(--ink-muted)' }}>The answer is <strong style={{ color: 'var(--ink)' }}>{q.answer ? 'Yes' : 'No'}</strong>.</p>
              )}
              <button type="button" className="btn btn-primary min-h-[88px]" onClick={next}>Next →</button>
            </div>
          )}
        </>
      )}
    </RoundShell>
  )
}
