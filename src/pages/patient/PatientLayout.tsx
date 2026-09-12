import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useCompanionSettings } from '../../hooks'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `btn ${isActive ? 'btn-primary' : 'btn-secondary'} flex-1 sm:flex-none sm:min-w-[160px]`

export default function PatientLayout() {
  const navigate = useNavigate()
  const { companion } = useCompanionSettings()
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b-2 border-gray-200 bg-white p-2 sm:p-3">
        <nav className="flex flex-1 gap-2" aria-label="Main">
          <NavLink to="/" className={linkClass} end>💬 Talk</NavLink>
          <NavLink to="/practice" className={linkClass}>🎯 Practice</NavLink>
          {companion.enabled && <NavLink to="/companion" className={linkClass}>🗣️ Chat</NavLink>}
        </nav>
        <button
          type="button"
          className="btn btn-secondary min-h-[56px] px-3 text-xl text-gray-600"
          onClick={() => navigate('/therapist')}
          aria-label="Therapist settings"
          title="Therapist settings"
        >
          ⚙️
        </button>
      </header>
      <main className="flex-1 overflow-y-auto p-2 sm:p-4">
        <Outlet />
      </main>
    </div>
  )
}
