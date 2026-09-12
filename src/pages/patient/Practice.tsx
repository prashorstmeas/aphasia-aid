import { Link } from 'react-router-dom'
import { recognitionSupported } from '../../speech'

export default function Practice() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <h1 className="text-3xl font-bold">Choose a practice</h1>
      <Link to="/practice/naming" className="card flex items-center gap-5 border-4 hover:border-blue-700">
        <span className="text-7xl" aria-hidden="true">🖼️</span>
        <span>
          <span className="block text-3xl font-bold">Name the picture</span>
          <span className="block text-xl text-gray-600">See a picture, say what it is. Ask for a hint if you get stuck.</span>
        </span>
      </Link>
      <Link to="/practice/repetition" className="card flex items-center gap-5 border-4 hover:border-blue-700">
        <span className="text-7xl" aria-hidden="true">🔁</span>
        <span>
          <span className="block text-3xl font-bold">Repeat the word</span>
          <span className="block text-xl text-gray-600">Hear a word and see it, then say it back.</span>
        </span>
      </Link>
      {!recognitionSupported && (
        <p className="rounded-xl bg-amber-50 p-4 text-lg text-amber-900">
          This browser cannot listen to your voice. You can still practise — you or your helper will mark each answer.
        </p>
      )}
    </div>
  )
}
