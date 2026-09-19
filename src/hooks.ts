import { useLiveQuery } from 'dexie-react-hooks'
import { db, DEFAULT_SETTINGS, type CompanionSettings, type Settings, type Tile } from './db'
import { DEFAULT_PRACTICE, type PracticeSettings } from './practice-plan'

export function useSettings() {
  const stored = useLiveQuery(() => db.settings.get('main'), [])
  const update = (patch: Partial<Settings>) => db.settings.update('main', patch)
  // `loaded` lets callers that act on a setting once — dealing a round, say — wait for the
  // real value instead of acting on the defaults the live query returns while in flight.
  return { settings: stored ?? DEFAULT_SETTINGS, loaded: stored !== undefined, update }
}

export function usePractice() {
  const { settings, loaded, update } = useSettings()
  const practice: PracticeSettings = { ...DEFAULT_PRACTICE, ...settings.practice }
  const updatePractice = (patch: Partial<PracticeSettings>) => update({ practice: { ...practice, ...patch } })
  return { practice, loaded, updatePractice }
}

export function useBoards() {
  return useLiveQuery(() => db.boards.orderBy('order').toArray(), []) ?? []
}

export function useTiles(boardId: number | undefined) {
  return useLiveQuery(
    () => (boardId == null ? Promise.resolve([] as Tile[]) : db.tiles.where('boardId').equals(boardId).sortBy('order')),
    [boardId],
  ) ?? []
}

/** Undefined until the query resolves, so callers can tell "still loading" from "none yet". */
export function useWords() {
  return useLiveQuery(() => db.words.toArray(), [])
}

/** Undefined until the query resolves, so callers can tell "still loading" from "none yet". */
export function useSentences() {
  return useLiveQuery(() => db.sentences.toArray(), [])
}

/** Undefined until the query resolves, so callers can tell "still loading" from "none yet". */
export function useQuestions() {
  return useLiveQuery(() => db.questions.toArray(), [])
}

export function useAttempts() {
  return useLiveQuery(() => db.attempts.orderBy('ts').toArray(), []) ?? []
}

export function useCompanionSettings() {
  const { settings, update } = useSettings()
  const companion: CompanionSettings = { ...DEFAULT_SETTINGS.companion!, ...settings.companion }
  const updateCompanion = (patch: Partial<CompanionSettings>) => update({ companion: { ...companion, ...patch } })
  return { companion, updateCompanion }
}

export function useConversations() {
  return useLiveQuery(() => db.conversations.orderBy('ts').reverse().toArray(), []) ?? []
}
