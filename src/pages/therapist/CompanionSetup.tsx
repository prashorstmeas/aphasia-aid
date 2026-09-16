import { useEffect, useState } from 'react'
import { db, type CompanionSettings } from '../../db'
import { useCompanionSettings, useConversations } from '../../hooks'
import { companionHealth } from '../../companion'
import { GESTURE_MAP } from '../../vision'

type Scenario = CompanionSettings['scenarios'][number]
const EMPTY_SCENARIO: Scenario = { name: '', emoji: '', role: '', goal: '' }

export default function CompanionSetup() {
  const { companion, updateCompanion } = useCompanionSettings()
  const conversations = useConversations()
  const [health, setHealth] = useState<{ ok: boolean; keyConfigured: boolean } | null | 'loading'>('loading')
  const [profile, setProfile] = useState(companion.profile)
  const [newTopic, setNewTopic] = useState('')
  const [editing, setEditing] = useState<number | 'new' | null>(null)
  const [draft, setDraft] = useState<Scenario>(EMPTY_SCENARIO)
  const [open, setOpen] = useState<number | null>(null)

  useEffect(() => { companionHealth().then(setHealth) }, [])
  useEffect(() => { setProfile(companion.profile) }, [companion.profile])

  const Toggle = ({ label, hint, k }: { label: string; hint: string; k: 'enabled' | 'cameraEnabled' | 'gesturesAnswer' | 'moodCues' }) => (
    <label className="flex items-center justify-between gap-4 py-2">
      <span><span className="block font-semibold">{label}</span><span className="block text-sm text-[var(--ink-muted)]">{hint}</span></span>
      <input type="checkbox" className="h-7 w-7" checked={companion[k]} onChange={(e) => updateCompanion({ [k]: e.target.checked })} />
    </label>
  )

  const saveScenario = () => {
    if (!draft.name.trim() || !draft.role.trim() || !draft.goal.trim()) return
    const s = { ...draft, emoji: draft.emoji.trim() || '🎭' }
    const list = editing === 'new' ? [...companion.scenarios, s] : companion.scenarios.map((x, i) => (i === editing ? s : x))
    updateCompanion({ scenarios: list }); setEditing(null); setDraft(EMPTY_SCENARIO)
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <section className="card">
        <h2 className="mb-2 text-xl font-bold">Server status</h2>
        {health === 'loading' ? <p>Checking…</p> : !health?.ok ? (
          <p className="rounded-xl bg-[var(--danger-tint)] p-3 text-[var(--danger)]">Companion server is not reachable. Run <code>npm run server</code> (or <code>npm run dev</code>) on the machine hosting the app.</p>
        ) : !health.keyConfigured ? (
          <p className="rounded-xl bg-[var(--accent-tint)] p-3 text-[#7a3310]">Server is running but has no <code>ANTHROPIC_API_KEY</code>. Copy <code>.env.example</code> to <code>.env</code>, add the key, restart.</p>
        ) : <p className="rounded-xl bg-[var(--success-tint)] p-3 text-[var(--success)]">✅ Connected. Conversations use Claude via your server; the key never reaches this device.</p>}
      </section>

      <section className="card">
        <h2 className="mb-2 text-xl font-bold">Features</h2>
        <div className="divide-y divide-[var(--hairline)]">
          <Toggle k="enabled" label="Show the Chat tab to the patient" hint="Turn off to hide the companion entirely." />
          <Toggle k="cameraEnabled" label="Camera panel" hint="On-device gesture, nod/shake and mouth-movement detection. Video never leaves the device unless the patient presses “Look”." />
          <Toggle k="gesturesAnswer" label="Gestures answer for the patient" hint="Thumbs up / down and nods / shakes are sent as Yes / No automatically." />
          <Toggle k="moodCues" label="Read facial expression" hint="Shows a mood chip, prompts if pain is detected, and tells the companion so it can soften its tone." />
        </div>
        <details className="mt-3 text-sm text-[var(--ink-muted)]">
          <summary className="cursor-pointer font-semibold">Gesture meanings</summary>
          <ul className="mt-2 grid grid-cols-2 gap-1">
            {Object.entries(GESTURE_MAP).map(([k, v]) => <li key={k}><strong>{k.replace('_', ' ')}</strong> → {v.phrase}</li>)}
            <li><strong>Nod</strong> → Yes</li><li><strong>Shake</strong> → No</li>
          </ul>
        </details>
      </section>

      <section className="card">
        <h2 className="mb-2 text-xl font-bold">About the patient</h2>
        <p className="mb-3 text-sm text-[var(--ink-muted)]">Sent with every conversation so the companion can personalise topics. Keep it to what helps conversation — no medical detail needed.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="font-semibold">First name<input className="field mt-1" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></label>
          <label className="font-semibold">Language<input className="field mt-1" value={profile.language} onChange={(e) => setProfile({ ...profile, language: e.target.value })} /></label>
          <label className="font-semibold sm:col-span-2">Interests<input className="field mt-1" placeholder="gardening, football, grandchildren, jazz…" value={profile.interests} onChange={(e) => setProfile({ ...profile, interests: e.target.value })} /></label>
          <label className="font-semibold sm:col-span-2">About them<textarea className="field mt-1" rows={3} placeholder="Retired teacher, lives with daughter, has a dog called Max. Prefers yes/no questions when tired." value={profile.about} onChange={(e) => setProfile({ ...profile, about: e.target.value })} /></label>
        </div>
        <button type="button" className="mt-3 rounded-xl bg-[var(--primary)] px-4 py-3 font-bold text-white" onClick={() => updateCompanion({ profile })}>Save profile</button>
      </section>

      <section className="card">
        <h2 className="mb-2 text-xl font-bold">Conversation topics</h2>
        <ul className="mb-3 flex flex-wrap gap-2">
          {companion.topics.map((t) => (
            <li key={t} className="flex items-center gap-1 rounded-xl bg-[var(--surface-sunk)] px-3 py-2 text-lg">{t}
              <button type="button" className="ml-1 text-[var(--ink-muted)]" aria-label={`Remove ${t}`} onClick={() => updateCompanion({ topics: companion.topics.filter((x) => x !== t) })}>✕</button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <input className="field" placeholder="New topic" value={newTopic} onChange={(e) => setNewTopic(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && newTopic.trim() && (updateCompanion({ topics: [...companion.topics, newTopic.trim()] }), setNewTopic(''))} />
          <button type="button" className="rounded-xl bg-[var(--primary)] px-4 font-bold text-white" onClick={() => { if (newTopic.trim()) { updateCompanion({ topics: [...companion.topics, newTopic.trim()] }); setNewTopic('') } }}>Add</button>
        </div>
      </section>

      <section className="card">
        <h2 className="mb-2 text-xl font-bold">Role-play scenarios</h2>
        <ul className="divide-y divide-[var(--hairline)]">
          {companion.scenarios.map((s, i) => (
            <li key={i} className="flex flex-wrap items-center gap-3 py-2">
              <span className="text-3xl">{s.emoji}</span>
              <span><span className="block font-semibold">{s.name}</span><span className="block text-sm text-[var(--ink-muted)]">Claude plays {s.role}. Goal: {s.goal}</span></span>
              <span className="ml-auto flex gap-1">
                <button type="button" className="rounded-lg border-2 border-[var(--hairline-strong)] px-3 py-2" onClick={() => { setEditing(i); setDraft(s) }}>Edit</button>
                <button type="button" className="rounded-lg border-2 border-[#f0cdd3] px-3 py-2 text-[var(--danger)]" onClick={() => confirm(`Delete "${s.name}"?`) && updateCompanion({ scenarios: companion.scenarios.filter((_, j) => j !== i) })}>🗑️</button>
              </span>
            </li>
          ))}
        </ul>
        {editing === null ? (
          <button type="button" className="mt-3 rounded-xl border-2 border-[var(--hairline-strong)] px-4 py-3 font-bold" onClick={() => { setEditing('new'); setDraft(EMPTY_SCENARIO) }}>＋ New scenario</button>
        ) : (
          <div className="mt-3 grid gap-2 border-t-2 border-[var(--hairline)] pt-3 sm:grid-cols-[64px_1fr]">
            <input className="field text-center text-2xl" placeholder="🎭" value={draft.emoji} onChange={(e) => setDraft({ ...draft, emoji: e.target.value })} aria-label="Emoji" />
            <input className="field" placeholder="Scenario name, e.g. Order a coffee" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            <input className="field sm:col-span-2" placeholder="Who Claude plays, e.g. a friendly barista" value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })} />
            <input className="field sm:col-span-2" placeholder="What the patient practises, e.g. order a drink and say thank you" value={draft.goal} onChange={(e) => setDraft({ ...draft, goal: e.target.value })} />
            <div className="flex gap-2 sm:col-span-2">
              <button type="button" className="rounded-xl bg-[var(--primary)] px-4 py-3 font-bold text-white" onClick={saveScenario}>Save</button>
              <button type="button" className="rounded-xl border-2 border-[var(--hairline-strong)] px-4 py-3" onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="mb-2 text-xl font-bold">Recent conversations ({conversations.length})</h2>
        {conversations.length === 0 ? <p className="text-[var(--ink-muted)]">None yet.</p> : (
          <ul className="divide-y divide-[var(--hairline)]">
            {conversations.slice(0, 30).map((c) => (
              <li key={c.id} className="py-2">
                <button type="button" className="flex w-full flex-wrap items-center gap-3 text-left" onClick={() => setOpen(open === c.id ? null : c.id!)}>
                  <span>{c.mode === 'scenario' ? '🎭' : '💬'}</span>
                  <span className="font-semibold">{c.title}</span>
                  <span className="text-sm text-[var(--ink-muted)]">{c.turns.filter((t) => t.role === 'user').length} patient turns</span>
                  {c.moods.length > 0 && <span className="rounded bg-[var(--surface-sunk)] px-2 text-sm">mood: {c.moods.join(', ')}</span>}
                  <span className="ml-auto text-sm text-[var(--ink-muted)]">{new Date(c.ts).toLocaleString()}</span>
                </button>
                {open === c.id && (
                  <div className="mt-2 rounded-xl bg-[var(--surface-sunk)] p-3">
                    <ul className="space-y-1">{c.turns.map((t, i) => <li key={i}><strong>{t.role === 'user' ? 'Patient' : 'Companion'}:</strong> {t.text}</li>)}</ul>
                    <button type="button" className="mt-2 text-sm text-[var(--danger)] underline" onClick={() => confirm('Delete this conversation?') && db.conversations.delete(c.id!)}>Delete</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
