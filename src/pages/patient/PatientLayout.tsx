import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useCompanionSettings } from '../../hooks'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `btn ${isActive ? 'btn-primary' : 'btn-secondary'} flex-1 sm:flex-none sm:min-w-[150px]`

export default function PatientLayout() {
  const navigate = useNavigate()
  const { companion } = useCompanionSettings()
  return (
    <div className="flex h-full flex-col">
      <header className="app-bar">
        <span className="wordmark">
          <span className="wordmark-dot" aria-hidden="true">💬</span>
          Aphasia Aid
        </span>
        <nav className="flex flex-1 gap-2" aria-label="Main">
          <NavLink to="/" className={linkClass} end>💬 Talk</NavLink>
          <NavLink to="/practice" className={linkClass}>🎯 Practice</NavLink>
          {companion.enabled && <NavLink to="/companion" className={linkClass}>🗣️ Chat</NavLink>}
        </nav>
        <button
          type="button"
          className="btn btn-secondary min-h-[56px] px-4 text-xl"
          onClick={() => navigate('/therapist')}
          aria-label="Therapist settings"
          title="Therapist settings"
        >
          ⚙️
        </button>
      </header>
      <main className="flex-1 overflow-y-auto p-3 sm:p-5">
        <Outlet />
      </main>
    </div>
  )
}
