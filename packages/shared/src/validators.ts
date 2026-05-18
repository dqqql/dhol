import type { CardType, DeckCardType, DhRoomBackup, DhPack, RoomPackLibraryItem, RoomSettings } from './types'

const CARD_TYPES: CardType[] = ['Location', 'Feature', 'Hook', 'Custom', 'Role']
const LEGACY_CARD_TYPES = new Set(['NPC'])

export function isCardType(value: unknown): value is CardType {
  return typeof value === 'string' && (CARD_TYPES.includes(value as CardType) || LEGACY_CARD_TYPES.has(value))
}

export function normalizeCardType(value: unknown): CardType | null {
  if (value === 'NPC') return 'Hook'
  return isCardType(value) ? value : null
}

function normalizeDeckCardType(value: unknown): DeckCardType | null {
  const normalized = normalizeCardType(value)
  if (!normalized || normalized === 'Role') return null
  return normalized
}

function normalizeCustomTypeName(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string') {
    throw new Error('Custom type name must be a string when provided')
  }

  const normalized = value.trim().slice(0, 20)
  if (!normalized) {
    throw new Error('Custom type name must not be empty')
  }

  return normalized
}

export function assertDhPack(value: unknown): DhPack {
  if (!value || typeof value !== 'object') {
    throw new Error('Pack must be an object')
  }

  const pack = value as Partial<DhPack>
  if (pack.format !== 'dhpack') throw new Error('Pack format must be "dhpack"')
  if (pack.version !== 1) throw new Error('Pack version must be 1')
  if (pack.id !== undefined && (typeof pack.id !== 'string' || !pack.id.trim())) {
    throw new Error('Pack id must be a non-empty string when provided')
  }
  if (typeof pack.pack_name !== 'string' || !pack.pack_name.trim()) {
    throw new Error('Pack name is required')
  }
  if (pack.description !== undefined && typeof pack.description !== 'string') {
    throw new Error('Pack description must be a string when provided')
  }
  if (!Array.isArray(pack.cards)) throw new Error('Pack cards must be an array')

  for (const [index, card] of pack.cards.entries()) {
    if (!card || typeof card !== 'object') throw new Error(`Card ${index} must be an object`)
    const normalizedType = normalizeDeckCardType(card.type)
    if (!normalizedType) throw new Error(`Card ${index} has invalid type`)
    const customTypeName = normalizeCustomTypeName((card as { custom_type_name?: unknown }).custom_type_name)
    if (normalizedType === 'Custom' && !customTypeName) {
      throw new Error(`Card ${index} custom_type_name is required for Custom cards`)
    }
    if (typeof card.title !== 'string' || !card.title.trim()) throw new Error(`Card ${index} title is required`)
    if (typeof card.content !== 'string') throw new Error(`Card ${index} content is required`)
    if (typeof card.style !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(card.style)) {
      throw new Error(`Card ${index} style must be a hex color`)
    }
    ;(card as { type: DeckCardType }).type = normalizedType
    ;(card as { custom_type_name?: string }).custom_type_name = normalizedType === 'Custom' ? customTypeName : undefined
  }

  return pack as DhPack
}

export function assertDhRoomBackup(value: unknown): DhRoomBackup {
  if (!value || typeof value !== 'object') {
    throw new Error('Room backup must be an object')
  }

  const backup = value as Partial<DhRoomBackup>
  if (backup.format !== 'dhroom') throw new Error('Room backup format must be "dhroom"')
  if (backup.version !== 1) throw new Error('Room backup version must be 1')
  if (!backup.room || typeof backup.room !== 'object') throw new Error('Room metadata is required')
  if (!backup.session || typeof backup.session !== 'object') throw new Error('Room session is required')
  if (!backup.map || typeof backup.map !== 'object') throw new Error('Room map is required')
  if (!Array.isArray(backup.players)) throw new Error('Room players must be an array')

  if (!Array.isArray(backup.session.turn_order)) throw new Error('Room turn order must be an array')
  if (!Array.isArray(backup.session.hands)) throw new Error('Room hands must be an array')
  if (!Array.isArray(backup.session.deck)) {
    ;(backup.session as { deck?: unknown }).deck = []
  }
  if (!Array.isArray(backup.map.cards)) throw new Error('Room map cards must be an array')
  if (!Array.isArray(backup.map.connections)) throw new Error('Room connections must be an array')
  if (!Array.isArray(backup.map.annotations)) throw new Error('Room annotations must be an array')

  if (backup.library) {
    const importedPacks = Array.isArray(backup.library.imported_packs)
      ? backup.library.imported_packs
      : backup.library.packs
    const selectedBuiltInPackIds = Array.isArray(backup.library.selected_built_in_pack_ids)
      ? backup.library.selected_built_in_pack_ids
      : backup.library.selected_pack_ids

    assertRoomLibrary(importedPacks ?? [], selectedBuiltInPackIds ?? [])
    backup.library.imported_packs = importedPacks ?? []
    backup.library.selected_built_in_pack_ids = selectedBuiltInPackIds ?? []
  } else {
    ;(backup as { library?: unknown }).library = {
      imported_packs: [],
      selected_built_in_pack_ids: [],
    }
  }

  if (backup.settings) {
    assertRoomSettings(backup.settings)
  } else {
    ;(backup as { settings?: unknown }).settings = {
      imports_enabled: false,
      resource_change_requires_approval: false,
    }
  }

  normalizeBackupCardTypes(backup)

  return backup as DhRoomBackup
}

export function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    throw new Error('Invalid JSON')
  }
}

function assertRoomLibrary(packs: unknown, selectedPackIds: unknown): asserts packs is RoomPackLibraryItem[] {
  if (!Array.isArray(packs)) throw new Error('Room library packs must be an array')
  if (!Array.isArray(selectedPackIds)) throw new Error('Room selected pack ids must be an array')
  if (selectedPackIds.some((packId) => typeof packId !== 'string')) {
    throw new Error('Room selected pack ids must be strings')
  }

  for (const [index, pack] of packs.entries()) {
    if (!pack || typeof pack !== 'object') throw new Error(`Library pack ${index} must be an object`)
    const candidate = pack as Partial<RoomPackLibraryItem>

    if (typeof candidate.id !== 'string' || !candidate.id) throw new Error(`Library pack ${index} id is required`)
    if (typeof candidate.pack_name !== 'string' || !candidate.pack_name.trim()) throw new Error(`Library pack ${index} name is required`)
    if (candidate.source !== 'built-in' && candidate.source !== 'imported') {
      throw new Error(`Library pack ${index} source is invalid`)
    }
    if (!Array.isArray(candidate.cards)) throw new Error(`Library pack ${index} cards must be an array`)

    for (const [cardIndex, card] of candidate.cards.entries()) {
      if (!card || typeof card !== 'object') throw new Error(`Library pack ${index} card ${cardIndex} must be an object`)
      const normalizedType = normalizeDeckCardType(card.type)
      if (!normalizedType) throw new Error(`Library pack ${index} card ${cardIndex} has invalid type`)
      const customTypeName = normalizeCustomTypeName((card as { custom_type_name?: unknown }).custom_type_name)
      if (normalizedType === 'Custom' && !customTypeName) {
        throw new Error(`Library pack ${index} card ${cardIndex} custom_type_name is required for Custom cards`)
      }
      if (typeof card.id !== 'string' || !card.id) throw new Error(`Library pack ${index} card ${cardIndex} id is required`)
      if (typeof card.title !== 'string' || !card.title.trim()) throw new Error(`Library pack ${index} card ${cardIndex} title is required`)
      if (typeof card.content !== 'string') throw new Error(`Library pack ${index} card ${cardIndex} content is required`)
      if (typeof card.style !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(card.style)) {
        throw new Error(`Library pack ${index} card ${cardIndex} style must be a hex color`)
      }
      ;(card as { type: DeckCardType }).type = normalizedType
      ;(card as { custom_type_name?: string }).custom_type_name = normalizedType === 'Custom' ? customTypeName : undefined
    }
  }
}

function assertRoomSettings(settings: unknown): asserts settings is RoomSettings {
  if (!settings || typeof settings !== 'object') throw new Error('Room settings must be an object')
  const candidate = settings as Partial<RoomSettings>
  if (typeof candidate.imports_enabled !== 'boolean') throw new Error('Room imports_enabled must be a boolean')
  if (candidate.resource_change_requires_approval !== undefined && typeof candidate.resource_change_requires_approval !== 'boolean') {
    throw new Error('Room resource_change_requires_approval must be a boolean')
  }
  if (candidate.resource_change_requires_approval === undefined) {
    candidate.resource_change_requires_approval = false
  }
}

function normalizeBackupCardTypes(backup: Partial<DhRoomBackup>) {
  const normalizeCard = (card: { type?: unknown; custom_type_name?: unknown }) => {
    const normalizedType = normalizeCardType(card.type)
    if (normalizedType) {
      ;(card as { type: CardType }).type = normalizedType
    }

    const customTypeName = normalizeCustomTypeName(card.custom_type_name)
    ;(card as { custom_type_name?: string }).custom_type_name = normalizedType === 'Custom' ? customTypeName : undefined
  }

  backup.session?.deck?.forEach(normalizeCard)
  backup.session?.hands?.forEach((hand) => hand.cards.forEach(normalizeCard))
  backup.map?.cards?.forEach(normalizeCard)
  ;(backup.library?.imported_packs ?? backup.library?.packs ?? []).forEach((pack) => pack.cards.forEach(normalizeCard))
}
