import { useCallback, useEffect, useRef, useState } from 'react'
import { db, type Conversation } from '../../db'
import { useCompanionSettings, useSettings } from '../../hooks'
import { listenOnce, recognitionSupported, speak, stopSpeaking, ttsSupported } from '../../speech'
import { companionChat, companionHealth, describeScene, type CompanionReply, type CompanionScenario, type CompanionTurn, type VisionReply } from '../../companion'
import { cameraSupported, VisionEngine, type Mood, type VisionEvent } from '../../vision'

type Stage = 'pick' | 'talk'
type Session = { mode: 'chat'; topic: string } | { mode: 'scenario'; scenario: CompanionScenario }

const MOOD_LABEL: Record<Mood, string> = { neutral: '', happy: '😊 Happy', sad: '😢 Sad', pain: '😣 Pain?', confused: '😕 Confused', surprised: '😮 Surprised' }
const QUICK = [
  { emoji: '👍', label: 'Yes', text: 'Yes' },
  { emoji: '👎', label: 'No', text: 'No' },
  { emoji: '🤷', label: "Don't know", text: "I don't know" },
  { emoji: '🆘', label: 'Help', text: 'I need help' },
]

export default function Companion() {
  const { settings } = useSettings()
  const { companion } = useCompanionSettings()
  const [stage, setStage] = useState<Stage>('pick')
  const [session, setSession] = useState<Session | null>(null)
  const [turns, setTurns] = useState<CompanionTurn[]>([])
  const [busy, setBusy] = useState(false)
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [serverOk, setServerOk] = useState<boolean | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [vision, setVision] = useState<VisionReply | null>(null)
  const [looking, setLooking] = useState(false)
  const [cameraOn, setCameraOn] = useState(false)
  const [cameraStatus, setCameraStatus] = useState<string>('')
  const [gestureChip, setGestureChip] = useState<string>('')
  const [mood, setMood] = useState<Mood>('neutral')
  const [painPrompt, setPainPrompt] = useState(false)
  const [speakingHint, setSpeakingHint] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const engineRef = useRef<VisionEngine | null>(null)
  const convoId = useRef<number | null>(null)
  const moodsLog = useRef<string[]>([])
  const stopListen = useRef<(() => void) | null>(null)
  const busyRef = useRef(false)
  const attemptRef = useRef(0)
  const lastReply = useRef('')

  useEffect(() => { companionHealth().then((h) => setServerOk(!!h?.ok && h.keyConfigured)) }, [])

  const say = useCallback((text: string) => speak(text, { voiceURI: settings.voiceURI, rate: settings.rate }), [settings])

  const persist = useCallback(async (nextTurns: CompanionTurn[], s: Session) => {
    const row: Omit<Conversation, 'id'> = {
      ts: Date.now(), mode: s.mode, title: s.mode === 'chat' ? s.topic : s.scenario.name,
      turns: nextTurns, moods: [...new Set(moodsLog.current)],
    }
    if (convoId.current == null) convoId.current = (await db.conversations.add(row)) as number
    else await db.conversations.update(convoId.current, row)
  }, [])

  const send = useCallback(async (text: string, inputKind: 'speech' | 'tile' | 'gesture' | 'vision', s: Session | null = session, base: CompanionTurn[] = turns) => {
    if (!s || busyRef.current) return
    busyRef.current = true; setBusy(true); setError(null); setVision(null)
    stopSpeaking()
    const opening = base.length === 0 && !text
    const withUser = opening ? base : [...base, { role: 'user' as const, text }]
    setTurns(withUser)
    attemptRef.current = inputKind === 'speech' ? attemptRef.current + 1 : 0
    try {
      const reply: CompanionReply = await companionChat({
        mode: s.mode,
        topic: s.mode === 'chat' ? s.topic : undefined,
        scenario: s.mode === 'scenario' ? { name: s.scenario.name, role: s.scenario.role, goal: s.scenario.goal } : undefined,
        profile: companion.profile,
        history: base,
        userText: text,
        inputKind,
        cues: companion.moodCues && mood !== 'neutral' ? { mood } : undefined,
        attemptCount: attemptRef.current,
      })
      if (reply.understood) attemptRef.current = 0
      const next = [...withUser, { role: 'assistant' as const, text: reply.reply }]
      setTurns(next)
      lastReply.current = reply.reply
      setSuggestions([...(reply.offeredWord ? [reply.offeredWord] : []), ...reply.suggestedWords.filter((w) => w !== reply.offeredWord)].slice(0, 4))
      await persist(next, s)
      await say(reply.reply)
    } catch (e) {
      setError((e as Error).message)
      setTurns(base)
    } finally {
      busyRef.current = false; setBusy(false)
    }
  }, [session, turns, companion, mood, persist, say])

  const start = (s: Session) => {
    convoId.current = null; moodsLog.current = []; attemptRef.current = 0
    setSession(s); setTurns([]); setSuggestions([]); setStage('talk')
    send('', 'tile', s, [])
  }

  const finish = () => {
    stopSpeaking(); stopListen.current?.()
    engineRef.current?.stop(); engineRef.current = null; setCameraOn(false)
    setStage('pick'); setSession(null); setTurns([]); setSuggestions([]); setVision(null)
  }

  const listen = useCallback(async () => {
    if (listening || busyRef.current) return
    stopSpeaking(); setListening(true); setSpeakingHint(false)
    const heard = await listenOnce({ onReady: (stop) => { stopListen.current = stop } })
    stopListen.current = null; setListening(false)
    if (heard) send(heard.split('|')[0].trim(), 'speech')
  }, [listening, send])

  // ---- Camera ----
  const onVision = useCallback((e: VisionEvent) => {
    if (e.kind === 'gesture' || e.kind === 'head') {
      setGestureChip(`${e.kind === 'head' ? (e.name === 'nod' ? '🙂↕️' : '🙂↔️') : '✋'} ${e.label}`)
      setTimeout(() => setGestureChip(''), 2500)
      if (companion.gesturesAnswer && !busyRef.current && !listening) { say(e.phrase); send(e.phrase, 'gesture') }
    } else if (e.kind === 'mood') {
      setMood(e.mood)
      if (e.mood !== 'neutral') moodsLog.current.push(e.mood)
      if (e.mood === 'pain' && e.score > 0.6) setPainPrompt(true)
    } else if (e.kind === 'speaking') {
      if (!busyRef.current && !listening && !(ttsSupported && speechSynthesis.speaking) && recognitionSupported) { setSpeakingHint(true); listen() }
    }
  }, [companion.gesturesAnswer, listening, say, send, listen])

  const onVisionRef = useRef(onVision)
  onVisionRef.current = onVision

  const toggleCamera = async () => {
    if (engineRef.current) { engineRef.current.stop(); engineRef.current = null; setCameraOn(false); setCameraStatus(''); return }
    if (!videoRef.current) return
    setCameraStatus('Starting camera…')
    const engine = new VisionEngine(videoRef.current, (e) => onVisionRef.current(e), { gestures: true, mood: companion.moodCues })
    try { await engine.start(); engineRef.current = engine; setCameraOn(true); setCameraStatus('') }
    catch (e) { setCameraStatus(`Camera unavailable: ${(e as Error).message}`) }
  }

  useEffect(() => () => { engineRef.current?.stop(); stopSpeaking() }, [])

  const look = async () => {
    const img = engineRef.current?.snapshot()
    if (!img) { setCameraStatus('Turn the camera on first.'); return }
    setLooking(true); setError(null)
    try { setVision(await describeScene(img, companion.profile, lastReply.current || undefined)) }
    catch (e) { setError((e as Error).message) }
    finally { setLooking(false) }
  }

  // ---- Render ----
  if (serverOk === false) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl bg-amber-50 p-6 text-xl text-amber-900">
        <p className="mb-2 text-2xl font-bold">The companion is not available right now.</p>
        <p>The companion server is not running or has no API key. A helper can start it with <code className="rounded bg-white px-2">npm run server</code> and set <code className="rounded bg-white px-2">ANTHROPIC_API_KEY</code> in <code className="rounded bg-white px-2">.env</code>.</p>
      </div>
    )
  }

  if (stage === 'pick') {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-5">
        <h1 className="text-3xl font-bold">What shall we talk about?</h1>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {companion.topics.map((t) => (
            <button key={t} type="button" className="btn btn-secondary min-h-[96px] text-2xl" onClick={() => start({ mode: 'chat', topic: t })}>💬 {t}</button>
          ))}
        </div>
        <h2 className="mt-2 text-2xl font-bold">Or practise a real situation</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {companion.scenarios.map((s) => (
            <button key={s.name} type="button" className="card flex items-center gap-4 border-4 text-left hover:border-blue-700" onClick={() => start({ mode: 'scenario', scenario: s })}>
              <span className="text-5xl" aria-hidden="true">{s.emoji}</span>
              <span><span className="block text-2xl font-bold">{s.name}</span><span className="block text-lg text-gray-600">{s.goal}</span></span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  const last = turns.filter((t) => t.role === 'assistant').at(-1)
  const title = session?.mode === 'chat' ? session.topic : session?.scenario.name

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-3 lg:flex-row">
      <div className="flex flex-1 flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xl text-gray-600">{session?.mode === 'scenario' ? '🎭' : '💬'} {title}</span>
          <button type="button" className="btn btn-ghost" onClick={finish}>Finish</button>
        </div>

        {painPrompt && (
          <div className="card flex flex-wrap items-center gap-3 border-4 border-red-300 bg-red-50">
            <span className="text-2xl font-bold">You look uncomfortable. Are you in pain?</span>
            <button type="button" className="btn btn-danger" onClick={() => { setPainPrompt(false); say('I am in pain.'); send('I am in pain', 'tile') }}>Yes, I'm in pain</button>
            <button type="button" className="btn btn-secondary" onClick={() => { setPainPrompt(false); send("No, I'm okay", 'tile') }}>No, I'm okay</button>
          </div>
        )}

        <div className="card min-h-[160px] border-4 border-blue-700" aria-live="polite">
          {busy && !last ? <p className="text-3xl text-gray-500">Thinking…</p> : (
            <>
              <p className="text-4xl font-bold leading-snug">{last?.text ?? '…'}</p>
              {busy && <p className="mt-2 text-xl text-gray-500">Thinking…</p>}
            </>
          )}
          <button type="button" className="btn btn-ghost mt-2" disabled={!last} onClick={() => last && say(last.text)}>🔊 Say it again</button>
        </div>

        {error && <p className="rounded-xl bg-red-50 p-3 text-lg text-red-800">{error}</p>}

        {vision && (
          <div className="card border-4 border-amber-300 bg-amber-50">
            <p className="mb-2 text-lg text-gray-700">I see: {vision.description}</p>
            {vision.concern && <p className="mb-2 font-bold text-red-800">{vision.concern}</p>}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {vision.intents.map((i) => (
                <button key={i.phrase} type="button" className="tile" onClick={() => { say(i.phrase); send(i.phrase, 'vision') }}>
                  <span className="text-5xl" aria-hidden="true">{i.emoji}</span><span className="tile-label text-lg">{i.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {suggestions.length > 0 && !busy && (
          <div className="flex flex-wrap gap-2">
            {suggestions.map((w) => (
              <button key={w} type="button" className="btn btn-secondary border-blue-300 bg-blue-50 text-2xl" onClick={() => { say(w); send(w, 'tile') }}>{w}</button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {recognitionSupported ? (
            listening ? (
              <button type="button" className="btn btn-primary col-span-2 min-h-[96px] animate-pulse text-3xl" onClick={() => stopListen.current?.()}>🎤 Listening… tap when done</button>
            ) : (
              <button type="button" className="btn btn-primary col-span-2 min-h-[96px] text-3xl" disabled={busy} onClick={listen}>🎤 Talk</button>
            )
          ) : <p className="col-span-2 rounded-xl bg-amber-50 p-3 text-amber-900">This browser can't hear you — use the buttons below.</p>}
          {QUICK.map((q) => (
            <button key={q.label} type="button" className="btn btn-secondary text-2xl" disabled={busy} onClick={() => { say(q.text); send(q.text, 'tile') }}>{q.emoji} {q.label}</button>
          ))}
        </div>
        {speakingHint && listening && <p className="text-center text-lg text-gray-600">I noticed you're speaking — I'm listening.</p>}

        <details className="text-gray-600">
          <summary className="cursor-pointer text-lg">Everything we said</summary>
          <ul className="mt-2 space-y-1 text-lg">
            {turns.map((t, i) => <li key={i}><strong>{t.role === 'user' ? 'You' : 'Companion'}:</strong> {t.text}</li>)}
          </ul>
        </details>
      </div>

      {cameraSupported && companion.cameraEnabled && (
        <aside className="flex w-full flex-col gap-2 lg:w-72">
          <div className="relative overflow-hidden rounded-2xl border-4 border-gray-300 bg-black" style={{ aspectRatio: '4 / 3' }}>
            <video ref={videoRef} className="h-full w-full object-cover" style={{ transform: 'scaleX(-1)' }} muted playsInline />
            {!cameraOn && <div className="absolute inset-0 flex items-center justify-center text-6xl text-white/60">📷</div>}
            {gestureChip && <span className="absolute left-2 top-2 rounded-xl bg-blue-700 px-3 py-1 text-xl font-bold text-white">{gestureChip}</span>}
            {cameraOn && companion.moodCues && MOOD_LABEL[mood] && <span className="absolute bottom-2 left-2 rounded-xl bg-white/90 px-3 py-1 text-lg font-semibold">{MOOD_LABEL[mood]}</span>}
          </div>
          <button type="button" className={`btn ${cameraOn ? 'btn-secondary' : 'btn-primary'}`} onClick={toggleCamera}>{cameraOn ? '📷 Camera off' : '📷 Camera on'}</button>
          <button type="button" className="btn btn-secondary" disabled={!cameraOn || looking || busy} onClick={look}>{looking ? 'Looking…' : '👀 Look at what I show'}</button>
          {cameraStatus && <p className="text-sm text-gray-600">{cameraStatus}</p>}
          {cameraOn && <p className="text-sm text-gray-600">👍 yes · 👎 no · ✋ stop/help · nod/shake head. Video stays on this device; only a photo is sent when you press “Look”.</p>}
        </aside>
      )}
    </div>
  )
}
