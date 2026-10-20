export interface HistoryRoomItem {
  code: string
  name: string
  lastJoinedAt: number
}

const NICKNAME_KEY = 'dhol:desktop:v2:nickname'
const ROOM_HISTORY_KEY = 'dhol:desktop:v2:room_history'
const MAX_HISTORY_PER_NICKNAME = 16

function getStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage
    }
  } catch {
    /* storage may be restricted */
  }
  return null
}

export function getSavedNickname(storage: Storage | null = getStorage()): string {
  if (!storage) return ''
  try {
    const direct = storage.getItem(NICKNAME_KEY)
    if (direct && typeof direct === 'string') {
      const trimmed = direct.trim()
      if (trimmed && trimmed !== 'null' && trimmed !== 'undefined') return trimmed
    }
    const sessionRaw = storage.getItem('dhol:desktop:v2:session')
    if (sessionRaw && sessionRaw !== 'null') {
      const session = JSON.parse(sessionRaw) as { nickname?: string }
      if (typeof session?.nickname === 'string') {
        const trimmed = session.nickname.trim()
        if (trimmed && trimmed !== 'null') return trimmed
      }
    }
  } catch {
    /* ignore storage errors */
  }
  return ''
}

export function saveSavedNickname(nickname: string, storage: Storage | null = getStorage()): void {
  if (!storage) return
  try {
    const trimmed = nickname.trim()
    if (trimmed) {
      storage.setItem(NICKNAME_KEY, trimmed)
    }
  } catch {
    /* ignore storage errors */
  }
}

export function getRoomHistory(nickname: string, storage: Storage | null = getStorage()): HistoryRoomItem[] {
  if (!storage) return []
  const norm = nickname.trim()
  if (!norm || norm === 'null') return []
  try {
    const raw = storage.getItem(ROOM_HISTORY_KEY)
    if (!raw || raw === 'null') return []
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (!parsed || typeof parsed !== 'object') return []
    const list = parsed[norm]
    if (!Array.isArray(list)) return []
    return list.filter((item): item is HistoryRoomItem =>
      item !== null &&
      typeof item === 'object' &&
      typeof item.code === 'string' &&
      /^[A-Z0-9]{6}$/i.test(item.code) &&
      typeof item.name === 'string'
    ).map(item => ({
      code: item.code.toUpperCase(),
      name: item.name.trim() || '未命名房间',
      lastJoinedAt: typeof item.lastJoinedAt === 'number' ? item.lastJoinedAt : 0
    })).sort((a, b) => b.lastJoinedAt - a.lastJoinedAt)
  } catch {
    return []
  }
}

export function saveRoomHistoryItem(
  nickname: string,
  code: string,
  name: string,
  storage: Storage | null = getStorage()
): void {
  if (!storage) return
  const normNick = nickname.trim()
  const normCode = code.trim().toUpperCase()
  if (!normNick || !/^[A-Z0-9]{6}$/.test(normCode)) return
  const normName = name.trim() || '未命名房间'

  try {
    let map: Record<string, HistoryRoomItem[]> = {}
    const raw = storage.getItem(ROOM_HISTORY_KEY)
    if (raw && raw !== 'null') {
      try {
        const parsed = JSON.parse(raw) as Record<string, HistoryRoomItem[]>
        if (parsed && typeof parsed === 'object') map = parsed
      } catch {
        /* ignore json error */
      }
    }
    const currentList = Array.isArray(map[normNick]) ? map[normNick] : []
    const filtered = currentList.filter(item => item.code !== normCode)
    filtered.unshift({
      code: normCode,
      name: normName,
      lastJoinedAt: Date.now()
    })
    map[normNick] = filtered.slice(0, MAX_HISTORY_PER_NICKNAME)
    storage.setItem(ROOM_HISTORY_KEY, JSON.stringify(map))
  } catch {
    /* ignore storage errors */
  }
}
