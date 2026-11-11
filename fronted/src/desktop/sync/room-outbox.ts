import type { MutationCommand } from '@dhgc/shared/desktop'

export interface OutboxStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}
export const OUTBOX_RETRY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000
export interface PendingOperation { command: MutationCommand; ackSeq: number | null; createdAtMs: number }

export class OutboxPersistenceError extends Error {
  constructor() { super('待确认操作无法保存到浏览器，请检查存储空间或隐私设置') }
}

export class RoomOutbox {
  readonly key: string
  private entries: PendingOperation[]
  private readonly storage: OutboxStorage
  constructor(storage: OutboxStorage, roomId: string, actorId: string) {
    this.storage = storage
    this.key = `dhol:desktop:v2:outbox:${roomId}:${actorId}`
    let saved: unknown
    try { saved = JSON.parse(storage.getItem(this.key) ?? '[]') } catch { saved = [] }
    const valid = Array.isArray(saved) ? saved.filter(item => item && typeof item === 'object' && item.command?.protocolVersion === 2 && typeof item.command?.requestId === 'string') as PendingOperation[] : []
    const now = Date.now()
    this.entries = valid.map(entry => ({ ...entry, createdAtMs: Number.isSafeInteger(entry.createdAtMs) && entry.createdAtMs > 0 ? entry.createdAtMs : now }))
    if (valid.some(entry => !Number.isSafeInteger(entry.createdAtMs) || entry.createdAtMs <= 0)) this.persist(this.entries)
  }
  list(): PendingOperation[] { return this.entries.map(entry => ({ ...entry })) }
  private persist(next: PendingOperation[]): void {
    try {
      if (next.length) this.storage.setItem(this.key, JSON.stringify(next))
      else this.storage.removeItem(this.key)
    } catch { throw new OutboxPersistenceError() }
    this.entries = next
  }
  add(command: MutationCommand): void {
    if (this.entries.some(entry => entry.command.requestId === command.requestId)) throw new Error('重复请求 ID')
    this.persist([...this.entries, { command, ackSeq: null, createdAtMs: Date.now() }])
  }
  discardExpired(now = Date.now()): number {
    const next = this.entries.filter(entry => entry.ackSeq !== null || now - entry.createdAtMs < OUTBOX_RETRY_WINDOW_MS)
    const removed = this.entries.length - next.length
    if (removed) this.persist(next)
    return removed
  }
  acknowledge(requestId: string, seq: number): void {
    this.persist(this.entries.map(entry => entry.command.requestId === requestId ? { ...entry, ackSeq: seq } : entry))
  }
  remove(requestId: string): void { this.persist(this.entries.filter(entry => entry.command.requestId !== requestId)) }
  removeGeneration(name: string, generation: number): string[] {
    const removed = this.entries.filter(entry => 'generation' in entry.command && entry.command.name === name && entry.command.generation === generation).map(entry => entry.command.requestId)
    if (removed.length) this.persist(this.entries.filter(entry => !removed.includes(entry.command.requestId)))
    return removed
  }
}
