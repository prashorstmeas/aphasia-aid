import { useLiveQuery } from 'dexie-react-hooks'
import { db, DEFAULT_SETTINGS, type CompanionSettings, type Settings, type Tile } from './db'

export function useSettings() {
  const settings = useLiveQuery(() => db.settings.get('main'), []) ?? DEFAULT_SETTINGS
  const update = (patch: Partial<Settings>) => db.settings.update('main', patch)
  return { settings, update }
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

export function useWords() {
  return useLiveQuery(() => db.words.toArray(), []) ?? []
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
