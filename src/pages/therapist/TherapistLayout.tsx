import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useSettings } from '../../hooks'

const UNLOCK_KEY = 'therapist-unlocked'

function PinGate({ pin, onUnlock }: { pin: string; onUnlock: () => void }) {
  const [entry, setEntry] = useState('')
  const [error, setError] = useState(false)
  const navigate = useNavigate()

  const press = (d: string) => {
    const next = entry + d
    if (next.length < pin.length) { setEntry(next); return }
    if (next === pin) onUnlock()
    else { setError(true); setEntry(''); setTimeout(() => setError(false), 1200) }
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-4 p-4">
      <h1 className="text-2xl font-bold">Therapist access</h1>
      <p className="text-gray-600">Enter the PIN to continue.</p>
      <div className="flex gap-3 text-4xl" aria-live="polite" aria-label={`${entry.length} digits entered`}>
        {Array.from({ length: pin.length }).map((_, i) => <span key={i}>{i < entry.length ? '●' : '○'}</span>)}
      </div>
      {error && <p className="font-bold text-red-700">Wrong PIN</p>}
      <div className="grid w-full grid-cols-3 gap-2">
        {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((k, i) =>
          k === '' ? <span key={i} /> : (
            <button key={i} type="button" className="btn btn-secondary text-2xl"
              onClick={() => (k === '⌫' ? setEntry((e) => e.slice(0, -1)) : press(k))}>{k}</button>
          ),
        )}
      </div>
      <button type="button" className="btn btn-ghost" onClick={() => navigate('/')}>← Back to patient view</button>
    </div>
  )
}

const tab = ({ isActive }: { isActive: boolean }) =>
  `rounded-xl px-4 py-3 font-bold ${isActive ? 'bg-blue-700 text-white' : 'bg-white text-gray-800 border-2 border-gray-300'}`

export default function TherapistLayout() {
  const { settings } = useSettings()
  const navigate = useNavigate()
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(UNLOCK_KEY) === '1')

  if (!unlocked) return <PinGate pin={settings.pin} onUnlock={() => { sessionStorage.setItem(UNLOCK_KEY, '1'); setUnlocked(true) }} />

  const exit = () => { sessionStorage.removeItem(UNLOCK_KEY); navigate('/') }

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-2 border-b-2 border-gray-200 bg-white p-3">
        <span className="mr-2 text-xl font-bold">🩺 Therapist</span>
        <nav className="flex flex-wrap gap-2" aria-label="Therapist sections">
          <NavLink to="/therapist" className={tab} end>Progress</NavLink>
          <NavLink to="/therapist/boards" className={tab}>Boards</NavLink>
          <NavLink to="/therapist/words" className={tab}>Practice words</NavLink>
          <NavLink to="/therapist/sentences" className={tab}>Sentences</NavLink>
          <NavLink to="/therapist/companion" className={tab}>Companion</NavLink>
          <NavLink to="/therapist/settings" className={tab}>Settings</NavLink>
        </nav>
        <button type="button" className="ml-auto rounded-xl border-2 border-gray-300 bg-white px-4 py-3 font-bold" onClick={exit}>🔒 Lock & exit</button>
      </header>
      <main className="flex-1 overflow-y-auto p-4">
        <Outlet />
      </main>
    </div>
  )
}
