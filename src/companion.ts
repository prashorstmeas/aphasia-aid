/** Client for the Claude proxy in server/. Same origin in production; Vite proxies /api in dev. */

export interface CompanionProfile { name: string; about: string; interests: string; language: string }
export interface CompanionScenario { name: string; emoji: string; role: string; goal: string }
export interface CompanionTurn { role: 'user' | 'assistant'; text: string }

export interface CompanionReply {
  reply: string
  suggestedWords: string[]
  offeredWord: string | null
  understood: boolean
}

export interface VisionReply {
  description: string
  intents: { emoji: string; label: string; phrase: string }[]
  concern: string | null
}

export interface ChatArgs {
  mode: 'chat' | 'scenario'
  topic?: string
  scenario?: Omit<CompanionScenario, 'emoji'>
  profile: CompanionProfile
  history: CompanionTurn[]
  userText: string
  inputKind: 'speech' | 'tile' | 'gesture' | 'vision'
  cues?: { mood?: string; gesture?: string }
  attemptCount?: number
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(typeof data.error === 'string' ? data.error : `Server error ${r.status}`)
  return data as T
}

export const companionChat = (args: ChatArgs) => post<CompanionReply>('/api/chat', args)
export const describeScene = (image: string, profile: CompanionProfile, context?: string) => post<VisionReply>('/api/vision', { image, profile, context })
export const companionHealth = () => fetch('/api/health').then((r) => r.json() as Promise<{ ok: boolean; keyConfigured: boolean }>).catch(() => null)

export const DEFAULT_PROFILE: CompanionProfile = { name: '', about: '', interests: '', language: 'English' }

export const DEFAULT_TOPICS = ['My day', 'Family', 'Food I like', 'The weather', 'When I was young', 'TV and music']

export const DEFAULT_SCENARIOS: CompanionScenario[] = [
  { name: 'Order a coffee', emoji: '☕', role: 'a friendly barista in a small café', goal: 'order a drink and something to eat, and say thank you' },
  { name: 'Call the doctor', emoji: '📞', role: "the receptionist at the patient's GP surgery", goal: 'book an appointment and say what the problem is in simple words' },
  { name: 'Greet a neighbour', emoji: '👋', role: 'a kind neighbour met in the street', goal: 'say hello, answer how they are, and ask one question back' },
  { name: 'Ask for help in a shop', emoji: '🛒', role: 'a shop assistant in a supermarket', goal: 'ask where an item is and thank the assistant' },
]
