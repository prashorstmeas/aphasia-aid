/** Thin wrappers over the browser's Web Speech API. Everything degrades gracefully when unsupported. */

export const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

// Minimal structural types: SpeechRecognition is not in TypeScript's DOM lib.
interface RecResultLike { transcript: string }
interface RecEventLike { results: ArrayLike<ArrayLike<RecResultLike>> }
interface RecLike {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  onresult: ((e: RecEventLike) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
}
type RecognitionCtor = new () => RecLike
const RecognitionImpl: RecognitionCtor | undefined =
  typeof window === 'undefined'
    ? undefined
    : ((window as unknown as { SpeechRecognition?: RecognitionCtor }).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: RecognitionCtor }).webkitSpeechRecognition)

export const recognitionSupported = !!RecognitionImpl

/** Language for speech recognition, and for speech when no voice is chosen. */
export const SPEECH_LANG = 'en-AU'

const langOf = (v: SpeechSynthesisVoice) => v.lang.replace('_', '-')

/** The therapist's chosen voice if it exists, else the first Australian English voice, else none (browser default). */
function pickVoice(voiceURI?: string | null) {
  const voices = speechSynthesis.getVoices()
  return (voiceURI && voices.find((v) => v.voiceURI === voiceURI)) || voices.find((v) => langOf(v) === SPEECH_LANG) || null
}

/** Voices load asynchronously in most browsers; resolve once the list is non-empty (or give up after 1s). */
export function getVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!ttsSupported) return Promise.resolve([])
  const now = speechSynthesis.getVoices()
  if (now.length) return Promise.resolve(now)
  return new Promise((resolve) => {
    const done = () => {
      speechSynthesis.removeEventListener('voiceschanged', done)
      resolve(speechSynthesis.getVoices())
    }
    speechSynthesis.addEventListener('voiceschanged', done)
    setTimeout(done, 1000)
  })
}

export interface SpeakOptions {
  voiceURI?: string | null
  rate?: number
}

export function speak(text: string, opts: SpeakOptions = {}): Promise<void> {
  if (!ttsSupported || !text.trim()) return Promise.resolve()
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.rate = opts.rate ?? 0.85
  const v = pickVoice(opts.voiceURI)
  if (v) u.voice = v
  u.lang = v ? langOf(v) : SPEECH_LANG
  return new Promise((resolve) => {
    u.onend = () => resolve()
    u.onerror = () => resolve()
    speechSynthesis.speak(u)
  })
}

export function stopSpeaking() {
  if (ttsSupported) speechSynthesis.cancel()
}

export interface ListenOptions {
  lang?: string
  timeoutMs?: number
  /** Receives a function that ends listening early and resolves with whatever was heard so far. */
  onReady?: (stop: () => void) => void
}

/** Listen for a single utterance. Resolves with the transcript, or null on silence/error/unsupported. */
export function listenOnce({ lang = SPEECH_LANG, timeoutMs = 7000, onReady }: ListenOptions = {}): Promise<string | null> {
  if (!RecognitionImpl) return Promise.resolve(null)
  return new Promise((resolve) => {
    const rec = new RecognitionImpl!()
    rec.lang = lang
    rec.interimResults = false
    rec.maxAlternatives = 3
    let settled = false
    const finish = (v: string | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try { rec.stop() } catch { /* already stopped */ }
      resolve(v)
    }
    const timer = setTimeout(() => finish(null), timeoutMs)
    rec.onresult = (e: RecEventLike) => {
      const alts = Array.from(e.results[0] ?? []).map((r) => r.transcript)
      finish(alts.join(' | ') || null)
    }
    rec.onerror = () => finish(null)
    rec.onend = () => finish(null)
    try { rec.start() } catch { finish(null); return }
    // Ask the recogniser to stop; onresult/onend then settle the promise. Fall back to null if nothing arrives.
    onReady?.(() => { try { rec.stop() } catch { finish(null) }; setTimeout(() => finish(null), 800) })
  })
}

export function normalise(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
}

function levenshtein(a: string, b: string) {
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)] as number[])
  for (let j = 1; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return dp[m][n]
}

/** 0..1 similarity between the target word and what was heard (best over recogniser alternatives and individual words). */
export function similarity(target: string, heard: string) {
  const t = normalise(target)
  if (!t) return 0
  let best = 0
  for (const alt of heard.split('|')) {
    const h = normalise(alt)
    if (!h) continue
    if (h === t || h.split(' ').includes(t)) return 1
    for (const candidate of [h, ...h.split(' ')]) {
      const score = 1 - levenshtein(t, candidate) / Math.max(t.length, candidate.length)
      best = Math.max(best, score)
    }
  }
  return best
}

export const SIMILARITY_THRESHOLD = 0.65

const WORD_MATCH_THRESHOLD = 0.7

/**
 * 0..1 similarity for a whole phrase: the share of the target's words that appear
 * (fuzzily, each matched at most once) somewhere in what was heard. Word order is
 * ignored, because recognisers drop and reorder words in disfluent speech.
 */
export function phraseSimilarity(target: string, heard: string) {
  const want = normalise(target).split(' ').filter(Boolean)
  if (!want.length) return 0
  let best = 0
  for (const alt of heard.split('|')) {
    const got = normalise(alt).split(' ').filter(Boolean)
    if (!got.length) continue
    const unused = [...got]
    let matched = 0
    for (const w of want) {
      const i = unused.findIndex((g) => similarity(w, g) >= WORD_MATCH_THRESHOLD)
      if (i !== -1) { matched++; unused.splice(i, 1) }
    }
    best = Math.max(best, matched / want.length)
  }
  return best
}

/** Reading aloud is scored more leniently than single words — missing a small word is not a failure. */
export const PHRASE_THRESHOLD = 0.6
