import type { CountdownClock } from '@dhgc/shared/desktop'

export function clearRoomBrowserState(storage: Storage, roomId: string): void {
  const keys = [`dhol-countdowns-${roomId}`, `dhol-roomlog-${roomId}`]
  const outboxPrefix = `dhol:desktop:v2:outbox:${roomId}:`
  const notesPrefix = `dhol-notes-${roomId}-`
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index)
    if (key?.startsWith(outboxPrefix) || key?.startsWith(notesPrefix)) keys.push(key)
  }
  for (const key of keys) storage.removeItem(key)
}

export function loadLegacyCountdowns(storage: Pick<Storage, 'getItem'>, roomId: string): CountdownClock[] {
  try {
    const value: unknown = JSON.parse(storage.getItem(`dhol-countdowns-${roomId}`) ?? '[]')
    if (!Array.isArray(value)) return []
    return value.filter((clock): clock is CountdownClock => clock !== null && typeof clock === 'object' &&
      typeof clock.id === 'string' && /^[\w-]{1,128}$/.test(clock.id) &&
      typeof clock.name === 'string' && clock.name.trim().length > 0 && clock.name.trim().length <= 60 &&
      Number.isSafeInteger(clock.max) && clock.max >= 2 && clock.max <= 12 &&
      Number.isSafeInteger(clock.value) && clock.value >= 0 && clock.value <= clock.max).slice(0, 20)
  } catch { return [] }
}
