import type { EnemyHandCard, EnemyTemplate } from './enemy-types'

const LIBRARY_STORAGE_KEY = 'dhol-enemy-library-v1'
const handStorageKey = (roomId: string) => `dhol-enemy-hand-${roomId}`

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.round(n)))
}

function sanitizeTemplate(item: unknown): EnemyTemplate | null {
  if (!item || typeof item !== 'object') return null
  const raw = item as Record<string, unknown>
  if (typeof raw.id !== 'string' || typeof raw.name !== 'string' || !raw.name.trim()) return null
  return {
    id: raw.id,
    name: raw.name.trim().slice(0, 48),
    hpMax: clampInt(raw.hpMax, 1, 30, 6),
    stressMax: clampInt(raw.stressMax, 0, 20, 3),
    majorThreshold: clampInt(raw.majorThreshold, 0, 999, 6),
    severeThreshold: clampInt(raw.severeThreshold, 0, 999, 12),
    difficulty: clampInt(raw.difficulty, 1, 99, 12),
    attackModifier: clampInt(raw.attackModifier, -50, 100, 0),
    damageFormula: typeof raw.damageFormula === 'string' && raw.damageFormula.trim() ? raw.damageFormula.trim() : '1d8+2',
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
  }
}

function sanitizeHandCard(item: unknown): EnemyHandCard | null {
  if (!item || typeof item !== 'object') return null
  const raw = item as Record<string, unknown>
  if (typeof raw.instanceId !== 'string' || typeof raw.name !== 'string' || !raw.name.trim()) return null
  const hpMax = clampInt(raw.hpMax, 1, 30, 6)
  const stressMax = clampInt(raw.stressMax, 0, 20, 3)
  return {
    instanceId: raw.instanceId,
    templateId: typeof raw.templateId === 'string' ? raw.templateId : raw.instanceId,
    name: raw.name.trim().slice(0, 48),
    hpMax,
    hpMarked: clampInt(raw.hpMarked, 0, hpMax, 0),
    stressMax,
    stressMarked: clampInt(raw.stressMarked, 0, stressMax, 0),
    majorThreshold: clampInt(raw.majorThreshold, 0, 999, 6),
    severeThreshold: clampInt(raw.severeThreshold, 0, 999, 12),
    difficulty: clampInt(raw.difficulty, 1, 99, 12),
    attackModifier: clampInt(raw.attackModifier, -50, 100, 0),
    damageFormula: typeof raw.damageFormula === 'string' && raw.damageFormula.trim() ? raw.damageFormula.trim() : '1d8+2',
  }
}

export function loadEnemyLibrary(storage: Storage): EnemyTemplate[] {
  try {
    const raw = storage.getItem(LIBRARY_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(sanitizeTemplate).filter((x): x is EnemyTemplate => x !== null)
  } catch {
    return []
  }
}

export function saveEnemyLibrary(storage: Storage, items: EnemyTemplate[]): void {
  try {
    storage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(items))
  } catch {
    /* ignore quota errors */
  }
}

export function loadEnemyHand(storage: Storage, roomId: string): EnemyHandCard[] {
  try {
    const raw = storage.getItem(handStorageKey(roomId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(sanitizeHandCard).filter((x): x is EnemyHandCard => x !== null)
  } catch {
    return []
  }
}

export function saveEnemyHand(storage: Storage, roomId: string, items: EnemyHandCard[]): void {
  try {
    storage.setItem(handStorageKey(roomId), JSON.stringify(items))
  } catch {
    /* ignore quota errors */
  }
}

/**
 * Generates a distinct name with #N suffix when needed.
 * - alwaysNumber=false: keeps baseName if unused, otherwise appends #2, #3, ...
 * - alwaysNumber=true (for duplicate action): strips existing #N and picks the next available #2, #3, ...
 */
export function nextNumberedName(rawName: string, existingNames: string[], alwaysNumber = false): string {
  const trimmed = rawName.trim()
  const base = trimmed.replace(/\s*#\d+$/, '').trim() || trimmed
  const used = new Set(existingNames.map(n => n.trim()))

  if (!alwaysNumber && !used.has(trimmed)) {
    return trimmed
  }

  let index = 2
  while (used.has(`${base} #${index}`)) {
    index += 1
  }
  return `${base} #${index}`
}

export function createHandCardFromTemplate(template: EnemyTemplate, existingNames: string[]): EnemyHandCard {
  return {
    instanceId: crypto.randomUUID(),
    templateId: template.id,
    name: nextNumberedName(template.name, existingNames, false),
    hpMax: template.hpMax,
    hpMarked: 0,
    stressMax: template.stressMax,
    stressMarked: 0,
    majorThreshold: template.majorThreshold,
    severeThreshold: template.severeThreshold,
    difficulty: template.difficulty,
    attackModifier: template.attackModifier,
    damageFormula: template.damageFormula,
  }
}
