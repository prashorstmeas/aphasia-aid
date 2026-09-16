import { useCallback, useEffect, useMemo, useState } from 'react'
import { fillGap, GAP, type Sentence } from '../../db'
import { useSentences, useSettings } from '../../hooks'
import { speak, stopSpeaking } from '../../speech'
import { RoundShell, shuffle, useRound } from './round'

const CHOICES = 4

const sentenceMeta = (s: Sentence) => ({ id: s.id!, text: s.text })

/**
 * Up to `CHOICES` options: the answer plus its own distractors, topped up from other
 * sentences' answers when a therapist has not supplied enough.
 */
function buildChoices(sentence: Sentence, pool: Sentence[]) {
  const taken = new Set([sentence.answer.toLowerCase()])
  const options = [sentence.answer]
  for (const d of [...sentence.distractors, ...shuffle(pool).map((s) => s.answer)]) {
    if (options.length >= CHOICES) break
    if (taken.has(d.toLowerCase())) continue
    taken.add(d.toLowerCase())
    options.push(d)
  }
  return shuffle(options)
}

/**
 * Sentence completion: read the sentence, choose the word that fills the gap.
 * A wrong choice reveals the answer rather than allowing another guess, so the
 * recorded attempt always reflects the patient's first, unaided response.
 */
export default function Completion() {
  const sentences = useSentences()
  const { settings } = useSettings()
  const round = useRound(sentences, 'completion', sentenceMeta)
  const sentence = round.item

  const [picked, setPicked] = useState<string | null>(null)
  const [cueUsed, setCueUsed] = useState(false)

  const say = useCallback((text: string) => speak(text, { voiceURI: settings.voiceURI, rate: settings.rate }), [settings])
  useEffect(() => () => stopSpeaking(), [])

  // Keyed on the sentence, not on `sentences`: that live query can re-emit an equal
  // array, which would otherwise reshuffle the buttons while the patient is reaching.
  const choices = useMemo(
    () => (sentence ? buildChoices(sentence, sentences ?? []) : []),
    [sentence, round.roundId], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const correct = picked != null && sentence != null && picked === sentence.answer

  const choose = (choice: string) => {
    if (picked != null || !sentence) return
    setPicked(choice)
    if (choice === sentence.answer) say(fillGap(sentence))
  }

  const next = async () => {
    await round.answer(correct, { heard: picked ?? undefined, cueUsed })
    setPicked(null)
    setCueUsed(false)
  }

  return (
    <RoundShell round={round} type="completion" emptyMessage="No sentences yet. Ask your therapist to add some.">
      {(s) => {
        const [before, after] = s.text.split(GAP)
        return (
          <>
            <div className="card flex w-full flex-col items-center gap-4 py-8">
              <span className="text-8xl leading-none" aria-hidden="true">{s.emoji}</span>
              <p className="text-4xl font-bold leading-snug">
                {before}
                <span className={`mx-1 inline-block min-w-[4ch] border-b-8 px-2 ${picked == null ? 'border-gray-400' : correct ? 'border-green-700 text-green-800' : 'border-red-700 text-red-800'}`}>
                  {picked ?? ' '}
                </span>
                {after}
              </p>
              {picked == null && (
                <button type="button" className="btn btn-secondary" onClick={() => { setCueUsed(true); say(s.text.replace(GAP, 'mmm')) }}>
                  🔊 Read it to me
                </button>
              )}
            </div>

            {picked == null ? (
              <div className="grid w-full grid-cols-2 gap-3">
                {choices.map((c) => (
                  <button key={c} type="button" className="btn btn-secondary min-h-[96px] text-3xl" onClick={() => choose(c)}>{c}</button>
                ))}
              </div>
            ) : (
              <div className="flex w-full flex-col gap-3">
                <p className="text-3xl font-bold">{correct ? '✅ That’s right!' : '🤔 Not quite.'}</p>
                {!correct && (
                  <>
                    <p className="text-2xl text-gray-700">The word is <strong>{s.answer}</strong>.</p>
                    <button type="button" className="btn btn-secondary" onClick={() => say(fillGap(s))}>🔊 Hear the whole sentence</button>
                  </>
                )}
                <button type="button" className="btn btn-primary min-h-[88px]" onClick={next}>Next →</button>
              </div>
            )}
          </>
        )
      }}
    </RoundShell>
  )
}
