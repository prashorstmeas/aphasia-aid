import Dexie, { type EntityTable } from 'dexie'

export type TileSize = 'small' | 'medium' | 'large'

export interface CompanionSettings {
  enabled: boolean
  cameraEnabled: boolean
  gesturesAnswer: boolean
  moodCues: boolean
  profile: { name: string; about: string; interests: string; language: string }
  topics: string[]
  scenarios: { name: string; emoji: string; role: string; goal: string }[]
}

export interface Settings {
  id: string
  pin: string
  voiceURI: string | null
  rate: number
  tileSize: TileSize
  speakOnTap: boolean
  autoScore: boolean
  companion?: CompanionSettings
}

export interface Conversation {
  id?: number
  ts: number
  mode: 'chat' | 'scenario'
  title: string
  turns: { role: 'user' | 'assistant'; text: string; inputKind?: string }[]
  moods: string[]
}

export interface Board {
  id?: number
  name: string
  emoji: string
  order: number
}

export interface Tile {
  id?: number
  boardId: number
  label: string
  emoji: string
  /** Optional longer phrase to speak instead of the label. */
  speak?: string
  order: number
}

export interface Word {
  id?: number
  text: string
  emoji: string
  category: string
  difficulty: 1 | 2 | 3
  /** Cue read aloud when the patient asks for a hint. */
  hint?: string
}

export type ExerciseType = 'naming' | 'repetition'

export interface Attempt {
  id?: number
  wordId: number
  wordText: string
  type: ExerciseType
  correct: boolean
  heard?: string
  cueUsed: boolean
  selfMarked: boolean
  ts: number
}

export const db = new Dexie('aphasia-aid') as Dexie & {
  settings: EntityTable<Settings, 'id'>
  boards: EntityTable<Board, 'id'>
  tiles: EntityTable<Tile, 'id'>
  words: EntityTable<Word, 'id'>
  attempts: EntityTable<Attempt, 'id'>
  conversations: EntityTable<Conversation, 'id'>
}

db.version(1).stores({
  settings: 'id',
  boards: '++id, order',
  tiles: '++id, boardId, order',
  words: '++id, category, difficulty',
  attempts: '++id, wordId, ts, type',
})
db.version(2).stores({ conversations: '++id, ts' })

export const DEFAULT_SETTINGS: Settings = {
  id: 'main',
  pin: '1234',
  voiceURI: null,
  rate: 0.85,
  tileSize: 'large',
  speakOnTap: true,
  autoScore: true,
  companion: {
    enabled: true,
    cameraEnabled: true,
    gesturesAnswer: true,
    moodCues: true,
    profile: { name: '', about: '', interests: '', language: 'English' },
    topics: ['My day', 'Family', 'Food I like', 'The weather', 'When I was young', 'TV and music'],
    scenarios: [
      { name: 'Order a coffee', emoji: '☕', role: 'a friendly barista in a small café', goal: 'order a drink and something to eat, and say thank you' },
      { name: 'Call the doctor', emoji: '📞', role: "the receptionist at the patient's GP surgery", goal: 'book an appointment and say what the problem is in simple words' },
      { name: 'Greet a neighbour', emoji: '👋', role: 'a kind neighbour met in the street', goal: 'say hello, answer how they are, and ask one question back' },
      { name: 'Ask for help in a shop', emoji: '🛒', role: 'a shop assistant in a supermarket', goal: 'ask where an item is and thank the assistant' },
    ],
  },
}

type SeedBoard = { name: string; emoji: string; tiles: [string, string, string?][] }

const SEED_BOARDS: SeedBoard[] = [
  { name: 'Basics', emoji: '⭐', tiles: [
    ['Yes', '👍'], ['No', '👎'], ['Help', '🆘', 'I need help'], ['Stop', '✋'],
    ['Wait', '⏳', 'Please wait'], ['Thank you', '🙏'], ['Please', '🤲'], ["Don't know", '🤷', "I don't know"],
  ]},
  { name: 'People', emoji: '👥', tiles: [
    ['Me', '🙋'], ['You', '👉'], ['Nurse', '👩‍⚕️'], ['Doctor', '🧑‍⚕️'],
    ['Family', '👨‍👩‍👧'], ['Friend', '🧑‍🤝‍🧑'], ['Partner', '💑'], ['Carer', '🧑‍🦯'],
  ]},
  { name: 'Needs', emoji: '🙏', tiles: [
    ['Water', '💧', 'I would like some water'], ['Food', '🍽️', 'I am hungry'], ['Toilet', '🚻', 'I need the toilet'], ['Medicine', '💊', 'I need my medicine'],
    ['Sleep', '😴', 'I want to sleep'], ['Glasses', '👓', 'I need my glasses'], ['Phone', '📱', 'I want my phone'], ['Blanket', '🛏️', 'I am cold, I need a blanket'],
  ]},
  { name: 'Feelings', emoji: '😊', tiles: [
    ['Happy', '😊', 'I feel happy'], ['Sad', '😢', 'I feel sad'], ['Tired', '🥱', 'I feel tired'], ['Angry', '😠', 'I feel angry'],
    ['Scared', '😨', 'I feel scared'], ['Confused', '😕', 'I feel confused'], ['Bored', '😐', 'I feel bored'], ['Lonely', '🫂', 'I feel lonely'],
  ]},
  { name: 'Pain', emoji: '🤕', tiles: [
    ['Pain', '⚡', 'I am in pain'], ['Head', '🤕', 'My head hurts'], ['Chest', '🫁', 'My chest hurts'], ['Stomach', '🤢', 'My stomach hurts'],
    ['Back', '🧍', 'My back hurts'], ['Arm', '💪', 'My arm hurts'], ['Leg', '🦵', 'My leg hurts'], ['Dizzy', '💫', 'I feel dizzy'],
  ]},
  { name: 'Food', emoji: '🍎', tiles: [
    ['Tea', '🍵'], ['Coffee', '☕'], ['Bread', '🍞'], ['Soup', '🍲'],
    ['Fruit', '🍎'], ['Rice', '🍚'], ['Milk', '🥛'], ['Sweet', '🍰', 'Something sweet'],
  ]},
  { name: 'Places', emoji: '🏠', tiles: [
    ['Home', '🏠', 'I want to go home'], ['Hospital', '🏥'], ['Bathroom', '🛁'], ['Garden', '🌳', 'I want to go outside'],
    ['Bed', '🛏️', 'I want to go to bed'], ['Kitchen', '🍳'], ['Shop', '🛒'], ['Church', '⛪'],
  ]},
  { name: 'Actions', emoji: '🏃', tiles: [
    ['Go', '➡️'], ['Come', '🫴', 'Come here'], ['Eat', '🍴'], ['Drink', '🥤'],
    ['Sit', '🪑'], ['Walk', '🚶'], ['Call', '📞', 'Call someone'], ['Read', '📖'],
  ]},
]

const SEED_WORDS: Omit<Word, 'id'>[] = [
  { text: 'cup', emoji: '☕', category: 'Objects', difficulty: 1, hint: 'You drink from it. It starts with "k".' },
  { text: 'dog', emoji: '🐕', category: 'Animals', difficulty: 1, hint: 'It barks. It starts with "d".' },
  { text: 'cat', emoji: '🐈', category: 'Animals', difficulty: 1, hint: 'It purrs. It starts with "k".' },
  { text: 'key', emoji: '🔑', category: 'Objects', difficulty: 1, hint: 'It opens a door. It starts with "k".' },
  { text: 'book', emoji: '📖', category: 'Objects', difficulty: 1, hint: 'You read it. It starts with "b".' },
  { text: 'apple', emoji: '🍎', category: 'Food', difficulty: 1, hint: 'A red fruit. It starts with "a".' },
  { text: 'bed', emoji: '🛏️', category: 'Home', difficulty: 1, hint: 'You sleep in it. It starts with "b".' },
  { text: 'car', emoji: '🚗', category: 'Transport', difficulty: 1, hint: 'You drive it. It starts with "k".' },
  { text: 'sun', emoji: '☀️', category: 'Nature', difficulty: 1, hint: 'It shines in the day. It starts with "s".' },
  { text: 'hand', emoji: '✋', category: 'Body', difficulty: 1, hint: 'It has five fingers. It starts with "h".' },
  { text: 'chair', emoji: '🪑', category: 'Home', difficulty: 2, hint: 'You sit on it. It starts with "ch".' },
  { text: 'water', emoji: '💧', category: 'Food', difficulty: 2, hint: 'You drink it. It starts with "w".' },
  { text: 'flower', emoji: '🌸', category: 'Nature', difficulty: 2, hint: 'It grows in a garden. It starts with "f".' },
  { text: 'banana', emoji: '🍌', category: 'Food', difficulty: 2, hint: 'A long yellow fruit. It starts with "b".' },
  { text: 'window', emoji: '🪟', category: 'Home', difficulty: 2, hint: 'You look through it. It starts with "w".' },
  { text: 'doctor', emoji: '🧑‍⚕️', category: 'People', difficulty: 2, hint: 'They help you when you are ill. It starts with "d".' },
  { text: 'glasses', emoji: '👓', category: 'Objects', difficulty: 2, hint: 'You wear them to see. It starts with "g".' },
  { text: 'kitchen', emoji: '🍳', category: 'Home', difficulty: 2, hint: 'Where you cook. It starts with "k".' },
  { text: 'bicycle', emoji: '🚲', category: 'Transport', difficulty: 3, hint: 'It has two wheels and pedals. It starts with "b".' },
  { text: 'elephant', emoji: '🐘', category: 'Animals', difficulty: 3, hint: 'A big grey animal with a trunk. It starts with "e".' },
  { text: 'umbrella', emoji: '☂️', category: 'Objects', difficulty: 3, hint: 'You use it in the rain. It starts with "u".' },
  { text: 'telephone', emoji: '📞', category: 'Objects', difficulty: 3, hint: 'You call people with it. It starts with "t".' },
  { text: 'hospital', emoji: '🏥', category: 'Places', difficulty: 3, hint: 'Where doctors and nurses work. It starts with "h".' },
  { text: 'newspaper', emoji: '📰', category: 'Objects', difficulty: 3, hint: 'You read the news in it. It starts with "n".' },
]

/** Populate settings, boards and words on first run. Safe to call on every startup. */
export async function seedIfEmpty() {
  await db.transaction('rw', db.settings, db.boards, db.tiles, db.words, async () => {
    if (!(await db.settings.get('main'))) await db.settings.add(DEFAULT_SETTINGS)
    if ((await db.boards.count()) === 0) {
      for (const [bi, b] of SEED_BOARDS.entries()) {
        const boardId = (await db.boards.add({ name: b.name, emoji: b.emoji, order: bi })) as number
        await db.tiles.bulkAdd(b.tiles.map(([label, emoji, speak], ti) => ({ boardId, label, emoji, speak, order: ti })))
      }
    }
    if ((await db.words.count()) === 0) await db.words.bulkAdd(SEED_WORDS)
  })
}

export interface Backup {
  version: 1
  exportedAt: string
  settings: Settings | undefined
  boards: Board[]
  tiles: Tile[]
  words: Word[]
  attempts: Attempt[]
  conversations?: Conversation[]
}

export async function exportBackup(): Promise<Backup> {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: await db.settings.get('main'),
    boards: await db.boards.toArray(),
    tiles: await db.tiles.toArray(),
    words: await db.words.toArray(),
    attempts: await db.attempts.toArray(),
    conversations: await db.conversations.toArray(),
  }
}

export async function importBackup(data: Backup) {
  if (data.version !== 1) throw new Error('Unsupported backup version')
  await db.transaction('rw', [db.settings, db.boards, db.tiles, db.words, db.attempts, db.conversations], async () => {
    await Promise.all([db.boards.clear(), db.tiles.clear(), db.words.clear(), db.attempts.clear(), db.conversations.clear()])
    if (data.settings) await db.settings.put({ ...DEFAULT_SETTINGS, ...data.settings, id: 'main' })
    await db.boards.bulkAdd(data.boards)
    await db.tiles.bulkAdd(data.tiles)
    await db.words.bulkAdd(data.words)
    await db.attempts.bulkAdd(data.attempts)
    if (data.conversations) await db.conversations.bulkAdd(data.conversations)
  })
}

export async function resetToDefaults() {
  await db.transaction('rw', db.settings, db.boards, db.tiles, db.words, async () => {
    await Promise.all([db.settings.clear(), db.boards.clear(), db.tiles.clear(), db.words.clear()])
  })
  await seedIfEmpty()
}
