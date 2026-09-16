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

export type ExerciseType = 'naming' | 'repetition' | 'completion' | 'comprehension' | 'reading'

export const EXERCISE_LABELS: Record<ExerciseType, string> = {
  naming: 'Name the picture',
  repetition: 'Repeat the word',
  completion: 'Finish the sentence',
  comprehension: 'Yes or no',
  reading: 'Read aloud',
}

export const EXERCISE_TYPES = Object.keys(EXERCISE_LABELS) as ExerciseType[]

/** How a gap is written inside `Sentence.text`. */
export const GAP = '___'

/** A sentence with one gap, written as `___`. Also read whole (gap filled) for the reading exercise. */
export interface Sentence {
  id?: number
  /** Contains exactly one `___` placeholder. */
  text: string
  answer: string
  /** Wrong choices. Topped up from other sentences' answers when there are too few. */
  distractors: string[]
  emoji: string
  difficulty: 1 | 2 | 3
}

/** The sentence with its gap filled in — what the reading exercise shows and speaks. */
export function fillGap(s: Sentence) {
  return s.text.replace(GAP, s.answer)
}

/** A spoken/written question the patient answers Yes or No. */
export interface Question {
  id?: number
  text: string
  answer: boolean
  emoji: string
  difficulty: 1 | 2 | 3
}

export interface Attempt {
  id?: number
  /** Word, sentence or question id, depending on `type`. Ids are only unique within a type. */
  itemId: number
  /** The word, or the sentence/question prompt — what Progress groups by. */
  itemText: string
  type: ExerciseType
  correct: boolean
  heard?: string
  /** A hint, a model reading, or a revealed answer was used before answering. */
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
  sentences: EntityTable<Sentence, 'id'>
  questions: EntityTable<Question, 'id'>
}

db.version(1).stores({
  settings: 'id',
  boards: '++id, order',
  tiles: '++id, boardId, order',
  words: '++id, category, difficulty',
  attempts: '++id, wordId, ts, type',
})
db.version(2).stores({ conversations: '++id, ts' })
db.version(3)
  .stores({
    attempts: '++id, itemId, ts, type',
    sentences: '++id, difficulty',
    questions: '++id, difficulty',
  })
  .upgrade((tx) =>
    // v1/v2 attempts were word-only; carry them over under the generic names.
    tx.table('attempts').toCollection().modify((a: Record<string, unknown>) => {
      if (a.itemId === undefined) {
        a.itemId = a.wordId
        a.itemText = a.wordText
        delete a.wordId
        delete a.wordText
      }
    }),
  )

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

const SEED_SENTENCES: Omit<Sentence, 'id'>[] = [
  { text: 'I drink my tea from a ___.', answer: 'cup', distractors: ['shoe', 'cloud', 'chair'], emoji: '☕', difficulty: 1 },
  { text: 'At night I sleep in my ___.', answer: 'bed', distractors: ['hat', 'spoon', 'road'], emoji: '🛏️', difficulty: 1 },
  { text: 'I write a letter with a ___.', answer: 'pen', distractors: ['sock', 'plate', 'door'], emoji: '✏️', difficulty: 1 },
  { text: 'I cut the bread with a ___.', answer: 'knife', distractors: ['towel', 'lamp', 'brush'], emoji: '🔪', difficulty: 1 },
  { text: 'I wear my shoes on my ___.', answer: 'feet', distractors: ['ears', 'nose', 'hair'], emoji: '👟', difficulty: 1 },
  { text: 'In the summer the sun is very ___.', answer: 'hot', distractors: ['wet', 'quiet', 'empty'], emoji: '☀️', difficulty: 1 },
  { text: 'I open the front door with a ___.', answer: 'key', distractors: ['comb', 'cup', 'book'], emoji: '🔑', difficulty: 1 },
  { text: 'We eat our soup with a ___.', answer: 'spoon', distractors: ['ladder', 'pillow', 'kettle'], emoji: '🥄', difficulty: 1 },
  { text: 'In the morning I eat my ___.', answer: 'breakfast', distractors: ['dinner', 'midnight', 'winter'], emoji: '🍳', difficulty: 2 },
  { text: 'When it rains I take my ___.', answer: 'umbrella', distractors: ['apple', 'engine', 'orange'], emoji: '☂️', difficulty: 2 },
  { text: 'I keep the milk in the ___.', answer: 'fridge', distractors: ['oven', 'garden', 'wardrobe'], emoji: '🧊', difficulty: 2 },
  { text: 'The nurses and doctors work in the ___.', answer: 'hospital', distractors: ['garage', 'cinema', 'farm'], emoji: '🏥', difficulty: 2 },
  { text: 'Every morning I brush my ___.', answer: 'teeth', distractors: ['curtains', 'letters', 'windows'], emoji: '🪥', difficulty: 2 },
  { text: 'It is cold outside, so I put on my ___.', answer: 'coat', distractors: ['kettle', 'carpet', 'pillow'], emoji: '🧥', difficulty: 2 },
  { text: 'I look at the time on my ___.', answer: 'watch', distractors: ['wallet', 'ticket', 'pocket'], emoji: '⌚', difficulty: 2 },
  { text: 'She picked the flowers and put them in a ___.', answer: 'vase', distractors: ['van', 'face', 'case'], emoji: '💐', difficulty: 3 },
  { text: 'He was very tired, so he sat down in the ___.', answer: 'armchair', distractors: ['air', 'arm', 'chain'], emoji: '🪑', difficulty: 3 },
  { text: 'I wanted to ring my sister, but I could not find my ___.', answer: 'phone', distractors: ['foam', 'bone', 'fan'], emoji: '📱', difficulty: 3 },
  { text: 'The letter was ready, so I walked to the post ___.', answer: 'box', distractors: ['fox', 'blocks', 'back'], emoji: '📮', difficulty: 3 },
  { text: 'It was late, so she turned off the light and went to ___.', answer: 'sleep', distractors: ['sheep', 'steep', 'slip'], emoji: '😴', difficulty: 3 },
]

const SEED_QUESTIONS: Omit<Question, 'id'>[] = [
  { text: 'Does a dog bark?', answer: true, emoji: '🐕', difficulty: 1 },
  { text: 'Is ice hot?', answer: false, emoji: '🧊', difficulty: 1 },
  { text: 'Do fish live in water?', answer: true, emoji: '🐟', difficulty: 1 },
  { text: 'Can a cat fly?', answer: false, emoji: '🐈', difficulty: 1 },
  { text: 'Is grass green?', answer: true, emoji: '🌱', difficulty: 1 },
  { text: 'Do you wear shoes on your hands?', answer: false, emoji: '👟', difficulty: 1 },
  { text: 'Do we sleep at night?', answer: true, emoji: '🌙', difficulty: 1 },
  { text: 'Do birds have four legs?', answer: false, emoji: '🐦', difficulty: 1 },
  { text: 'Do you need a key to open a locked door?', answer: true, emoji: '🔑', difficulty: 2 },
  { text: 'Do you buy your bread at a garage?', answer: false, emoji: '🍞', difficulty: 2 },
  { text: 'Is a week longer than a day?', answer: true, emoji: '📅', difficulty: 2 },
  { text: 'Does a doctor cut your hair?', answer: false, emoji: '🧑‍⚕️', difficulty: 2 },
  { text: 'Do you use an umbrella when it rains?', answer: true, emoji: '☂️', difficulty: 2 },
  { text: 'Is winter warmer than summer?', answer: false, emoji: '❄️', difficulty: 2 },
  { text: 'A man is taller than his son. Is the son shorter than the man?', answer: true, emoji: '👨', difficulty: 3 },
  { text: 'The cat is chasing the dog. Is the dog running away?', answer: true, emoji: '🐈', difficulty: 3 },
  { text: 'I put the cup on the plate. Is the plate under the cup?', answer: true, emoji: '☕', difficulty: 3 },
  { text: 'You eat your lunch before you go out. Do you go out first?', answer: false, emoji: '🍽️', difficulty: 3 },
  { text: 'Monday comes before Tuesday. Does Tuesday come first?', answer: false, emoji: '📅', difficulty: 3 },
  { text: 'The bus left after the train. Did the train leave first?', answer: true, emoji: '🚌', difficulty: 3 },
]

/** Populate settings, boards and words on first run. Safe to call on every startup. */
export async function seedIfEmpty() {
  await db.transaction('rw', [db.settings, db.boards, db.tiles, db.words, db.sentences, db.questions], async () => {
    if (!(await db.settings.get('main'))) await db.settings.add(DEFAULT_SETTINGS)
    if ((await db.boards.count()) === 0) {
      for (const [bi, b] of SEED_BOARDS.entries()) {
        const boardId = (await db.boards.add({ name: b.name, emoji: b.emoji, order: bi })) as number
        await db.tiles.bulkAdd(b.tiles.map(([label, emoji, speak], ti) => ({ boardId, label, emoji, speak, order: ti })))
      }
    }
    if ((await db.words.count()) === 0) await db.words.bulkAdd(SEED_WORDS)
    if ((await db.sentences.count()) === 0) await db.sentences.bulkAdd(SEED_SENTENCES)
    if ((await db.questions.count()) === 0) await db.questions.bulkAdd(SEED_QUESTIONS)
  })
}

export interface Backup {
  version: 1 | 2
  exportedAt: string
  settings: Settings | undefined
  boards: Board[]
  tiles: Tile[]
  words: Word[]
  attempts: Attempt[]
  conversations?: Conversation[]
  sentences?: Sentence[]
  questions?: Question[]
}

export async function exportBackup(): Promise<Backup> {
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    settings: await db.settings.get('main'),
    boards: await db.boards.toArray(),
    tiles: await db.tiles.toArray(),
    words: await db.words.toArray(),
    attempts: await db.attempts.toArray(),
    conversations: await db.conversations.toArray(),
    sentences: await db.sentences.toArray(),
    questions: await db.questions.toArray(),
  }
}

/** Version 1 backups stored attempts as `wordId`/`wordText`. */
function migrateAttempt(a: Attempt & { wordId?: number; wordText?: string }): Attempt {
  if (a.itemId !== undefined) return a
  const { wordId, wordText, ...rest } = a
  return { ...rest, itemId: wordId!, itemText: wordText! }
}

export async function importBackup(data: Backup) {
  if (data.version !== 1 && data.version !== 2) throw new Error('Unsupported backup version')
  await db.transaction('rw', [db.settings, db.boards, db.tiles, db.words, db.attempts, db.conversations, db.sentences, db.questions], async () => {
    await Promise.all([db.boards.clear(), db.tiles.clear(), db.words.clear(), db.attempts.clear(), db.conversations.clear(), db.sentences.clear(), db.questions.clear()])
    if (data.settings) await db.settings.put({ ...DEFAULT_SETTINGS, ...data.settings, id: 'main' })
    await db.boards.bulkAdd(data.boards)
    await db.tiles.bulkAdd(data.tiles)
    await db.words.bulkAdd(data.words)
    await db.attempts.bulkAdd(data.attempts.map(migrateAttempt))
    if (data.conversations) await db.conversations.bulkAdd(data.conversations)
    // Pre-v2 backups predate these exercises; restore the seed set rather than leaving them empty.
    await db.sentences.bulkAdd(data.sentences ?? SEED_SENTENCES)
    await db.questions.bulkAdd(data.questions ?? SEED_QUESTIONS)
  })
}

export async function resetToDefaults() {
  await db.transaction('rw', [db.settings, db.boards, db.tiles, db.words, db.sentences, db.questions], async () => {
    await Promise.all([db.settings.clear(), db.boards.clear(), db.tiles.clear(), db.words.clear(), db.sentences.clear(), db.questions.clear()])
  })
  await seedIfEmpty()
}
