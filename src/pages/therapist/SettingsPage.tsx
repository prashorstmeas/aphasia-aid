import { useEffect, useRef, useState } from 'react'
import { db, exportBackup, importBackup, resetToDefaults, type TileSize } from '../../db'
import { useSettings, usePractice } from '../../hooks'
import { LEVEL_LABELS, ROUND_SIZES, type PracticeLevel } from '../../practice-plan'
import { getVoices, speak, ttsSupported } from '../../speech'

export default function SettingsPage() {
  const { settings, update } = useSettings()
  const { practice, updatePractice } = usePractice()
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [pin, setPin] = useState({ a: '', b: '' })
  const [msg, setMsg] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { getVoices().then(setVoices) }, [])

  const test = () => speak('Hello. I would like a cup of tea, please.', { voiceURI: settings.voiceURI, rate: settings.rate })

  const changePin = async () => {
    if (!/^\d{4,6}$/.test(pin.a)) return setMsg('PIN must be 4 to 6 digits.')
    if (pin.a !== pin.b) return setMsg('PINs do not match.')
    await update({ pin: pin.a }); setPin({ a: '', b: '' }); setMsg('PIN updated.')
  }

  const doExport = async () => {
    const data = await exportBackup()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `aphasia-aid-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const doImport = async (file: File | undefined) => {
    if (!file) return
    if (!confirm('Importing replaces all boards, words and progress on this device. Continue?')) return
    try {
      await importBackup(JSON.parse(await file.text()))
      setMsg('Backup restored.')
    } catch (e) { setMsg(`Import failed: ${(e as Error).message}`) }
    if (fileRef.current) fileRef.current.value = ''
  }

  const clearProgress = async () => {
    if (confirm('Delete all practice history? Boards and words are kept.')) { await db.attempts.clear(); setMsg('Practice history cleared.') }
  }

  const reset = async () => {
    if (confirm('Reset boards, words and settings to the built-in defaults? Practice history is kept.')) { await resetToDefaults(); setMsg('Defaults restored.') }
  }

  const Toggle = ({ label, hint, value, onChange }: { label: string; hint: string; value: boolean; onChange: (v: boolean) => void }) => (
    <label className="flex items-center justify-between gap-4 py-2">
      <span><span className="block font-semibold">{label}</span><span className="block text-sm text-[var(--ink-muted)]">{hint}</span></span>
      <input type="checkbox" className="h-7 w-7" checked={value} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      {msg && <p className="rounded-xl bg-[var(--primary-tint)] p-3 font-semibold text-[var(--primary-deep)]" role="status">{msg}</p>}

      <section className="card">
        <h2 className="mb-3 text-xl font-bold">Voice</h2>
        {!ttsSupported && <p className="text-[var(--danger)]">This browser cannot speak.</p>}
        <label className="block font-semibold">Voice
          <select className="field mt-1" value={settings.voiceURI ?? ''} onChange={(e) => update({ voiceURI: e.target.value || null })}>
            <option value="">Default (Australian English if available)</option>
            {voices.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}
          </select>
        </label>
        <label className="mt-3 block font-semibold">Speed: {settings.rate.toFixed(2)}×
          <input type="range" min={0.5} max={1.3} step={0.05} className="mt-1 w-full" value={settings.rate} onChange={(e) => update({ rate: Number(e.target.value) })} />
        </label>
        <button type="button" className="btn btn-secondary mt-3" onClick={test}>🔊 Test voice</button>
      </section>

      <section className="card">
        <h2 className="mb-3 text-xl font-bold">Display & behaviour</h2>
        <label className="block font-semibold">Tile size
          <select className="field mt-1" value={settings.tileSize} onChange={(e) => update({ tileSize: e.target.value as TileSize })}>
            <option value="large">Large (fewest per screen, easiest to tap)</option>
            <option value="medium">Medium</option>
            <option value="small">Small (most per screen)</option>
          </select>
        </label>
        <div className="mt-3 divide-y divide-[var(--hairline)]">
          <Toggle label="Speak each picture when tapped" hint="Off = only speak when the Speak button is pressed" value={settings.speakOnTap} onChange={(v) => update({ speakOnTap: v })} />
          <Toggle label="Suggest a score from speech recognition" hint="The patient or helper can always override. Turn off if recognition is unreliable for this speaker." value={settings.autoScore} onChange={(v) => update({ autoScore: v })} />
        </div>
      </section>

      <section className="card">
        <h2 className="mb-3 text-xl font-bold">Practice rounds</h2>
        <label className="block font-semibold">Questions in a round
          <select className="field mt-1" value={practice.roundSize} onChange={(e) => updatePractice({ roundSize: Number(e.target.value) })}>
            {ROUND_SIZES.map((n) => <option key={n} value={n}>{n}{n === 8 ? ' (default)' : ''}</option>)}
          </select>
        </label>
        <label className="mt-3 block font-semibold">Difficulty
          <select
            className="field mt-1"
            value={String(practice.level)}
            onChange={(e) => updatePractice({ level: (e.target.value === 'all' ? 'all' : Number(e.target.value)) as PracticeLevel })}
          >
            {(['all', 1, 2, 3] as PracticeLevel[]).map((l) => <option key={l} value={String(l)}>{LEVEL_LABELS[String(l)]}</option>)}
          </select>
        </label>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Applies to every exercise. If nothing is left at that level, the whole set is used rather than blocking practice.
        </p>
        <div className="mt-3 divide-y divide-[var(--hairline)]">
          <Toggle
            label="Practise the hard items more often"
            hint="Rounds lean towards items recently missed or answered with a hint, and towards items not seen for a while. Off = pick at random."
            value={practice.adaptive}
            onChange={(v) => updatePractice({ adaptive: v })}
          />
        </div>
      </section>

      <section className="card">
        <h2 className="mb-3 text-xl font-bold">Therapist PIN</h2>
        <div className="flex flex-wrap gap-2">
          <input className="field w-40" inputMode="numeric" placeholder="New PIN" value={pin.a} onChange={(e) => setPin({ ...pin, a: e.target.value })} aria-label="New PIN" />
          <input className="field w-40" inputMode="numeric" placeholder="Repeat PIN" value={pin.b} onChange={(e) => setPin({ ...pin, b: e.target.value })} aria-label="Repeat new PIN" />
          <button type="button" className="rounded-xl bg-[var(--primary)] px-4 font-bold text-white" onClick={changePin}>Change PIN</button>
        </div>
        <p className="mt-2 text-sm text-[var(--ink-muted)]">Default PIN is 1234 — change it before handing the device over.</p>
      </section>

      <section className="card">
        <h2 className="mb-3 text-xl font-bold">Data</h2>
        <p className="mb-3 text-sm text-[var(--ink-muted)]">Everything is stored on this device only. Export a backup before clearing browser data or moving to a new device.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-secondary" onClick={doExport}>⬇️ Export backup</button>
          <button type="button" className="btn btn-secondary" onClick={() => fileRef.current?.click()}>⬆️ Import backup</button>
          <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => doImport(e.target.files?.[0])} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--hairline)] pt-4">
          <button type="button" className="btn btn-secondary text-[var(--danger)]" onClick={clearProgress}>Clear practice history</button>
          <button type="button" className="btn btn-secondary text-[var(--danger)]" onClick={reset}>Reset boards & words to defaults</button>
        </div>
      </section>
    </div>
  )
}
