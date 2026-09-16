import { Navigate, Route, Routes } from 'react-router-dom'
import PatientLayout from './pages/patient/PatientLayout'
import Board from './pages/patient/Board'
import Practice from './pages/patient/Practice'
import Exercise from './pages/patient/Exercise'
import Completion from './pages/patient/Completion'
import Comprehension from './pages/patient/Comprehension'
import Reading from './pages/patient/Reading'
import Companion from './pages/patient/Companion'
import TherapistLayout from './pages/therapist/TherapistLayout'
import Progress from './pages/therapist/Progress'
import Boards from './pages/therapist/Boards'
import Words from './pages/therapist/Words'
import Sentences from './pages/therapist/Sentences'
import SettingsPage from './pages/therapist/SettingsPage'
import CompanionSetup from './pages/therapist/CompanionSetup'

export default function App() {
  return (
    <Routes>
      <Route element={<PatientLayout />}>
        <Route index element={<Board />} />
        <Route path="board/:boardId" element={<Board />} />
        <Route path="practice" element={<Practice />} />
        <Route path="practice/naming" element={<Exercise type="naming" />} />
        <Route path="practice/repetition" element={<Exercise type="repetition" />} />
        <Route path="practice/completion" element={<Completion />} />
        <Route path="practice/comprehension" element={<Comprehension />} />
        <Route path="practice/reading" element={<Reading />} />
        <Route path="companion" element={<Companion />} />
      </Route>
      <Route path="therapist" element={<TherapistLayout />}>
        <Route index element={<Progress />} />
        <Route path="boards" element={<Boards />} />
        <Route path="words" element={<Words />} />
        <Route path="sentences" element={<Sentences />} />
        <Route path="companion" element={<CompanionSetup />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
