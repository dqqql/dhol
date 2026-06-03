import type { CardType, DeckCardType, DhRoomBackup, DhPack, RoomPackLibraryItem, RoomSettings } from './types'

const CARD_TYPES: CardType[] = ['Location', 'Feature', 'Hook', 'Custom', 'Role']
const LEGACY_CARD_TYPES = new Set(['NPC'])

// 卡包大小限制
const MAX_PACK_CARDS = 200
const MAX_CARD_TITLE_LENGTH = 100
const MAX_CARD_CONTENT_LENGTH = 20000
const MAX_PACK_NAME_LENGTH = 100
const MAX_PACK_DESCRIPTION_LENGTH = 500

// 房间备份大小限制
const MAX_MAP_CARDS = 500
const MAX_SESSION_TOTAL_HAND_CARDS = 200
const MAX_IMPORTED_PACKS = 20
const MAX_MAP_ANNOTATIONS = 200
const MAX_ANNOTATION_TEXT_LENGTH = 2000

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
  if (pack.pack_name.length > MAX_PACK_NAME_LENGTH) {
    throw new Error(`卡包名称不能超过 ${MAX_PACK_NAME_LENGTH} 个字符`)
  }
  if (pack.description !== undefined && typeof pack.description !== 'string') {
    throw new Error('Pack description must be a string when provided')
  }
  if (typeof pack.description === 'string' && pack.description.length > MAX_PACK_DESCRIPTION_LENGTH) {
    throw new Error(`卡包描述不能超过 ${MAX_PACK_DESCRIPTION_LENGTH} 个字符`)
  }
  if (!Array.isArray(pack.cards)) throw new Error('Pack cards must be an array')
  if (pack.cards.length > MAX_PACK_CARDS) {
    throw new Error(`卡包中的卡牌数量不能超过 ${MAX_PACK_CARDS} 张`)
  }

  for (const [index, card] of pack.cards.entries()) {
    if (!card || typeof card !== 'object') throw new Error(`Card ${index} must be an object`)
    const normalizedType = normalizeDeckCardType(card.type)
    if (!normalizedType) throw new Error(`Card ${index} has invalid type`)
    const customTypeName = normalizeCustomTypeName((card as { custom_type_name?: unknown }).custom_type_name)
    if (normalizedType === 'Custom' && !customTypeName) {
      throw new Error(`Card ${index} custom_type_name is required for Custom cards`)
    }
    if (typeof card.title !== 'string' || !card.title.trim()) throw new Error(`Card ${index} title is required`)
    if (card.title.length > MAX_CARD_TITLE_LENGTH) {
      throw new Error(`第 ${index} 张卡牌的标题不能超过 ${MAX_CARD_TITLE_LENGTH} 个字符`)
    }
    if (typeof card.content !== 'string') throw new Error(`Card ${index} content is required`)
    if (card.content.length > MAX_CARD_CONTENT_LENGTH) {
      throw new Error(`第 ${index} 张卡牌的内容不能超过 ${MAX_CARD_CONTENT_LENGTH} 个字符`)
    }
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

  // 大小限制检查
  if (backup.map.cards.length > MAX_MAP_CARDS) {
    throw new Error(`地图中的卡牌数量不能超过 ${MAX_MAP_CARDS} 张`)
  }
  if (backup.map.annotations.length > MAX_MAP_ANNOTATIONS) {
    throw new Error(`地图中的注释数量不能超过 ${MAX_MAP_ANNOTATIONS} 个`)
  }
  for (const [index, annotation] of backup.map.annotations.entries()) {
    if (annotation && typeof annotation === 'object' && typeof (annotation as { text?: unknown }).text === 'string') {
      const text = (annotation as { text: string }).text
      if (text.length > MAX_ANNOTATION_TEXT_LENGTH) {
        throw new Error(`第 ${index} 个注释的文字内容不能超过 ${MAX_ANNOTATION_TEXT_LENGTH} 个字符`)
      }
    }
  }
  for (const [index, card] of backup.map.cards.entries()) {
    if (card && typeof card === 'object') {
      const c = card as { title?: unknown; content?: unknown }
      if (typeof c.title === 'string' && c.title.length > MAX_CARD_TITLE_LENGTH) {
        throw new Error(`地图第 ${index} 张卡牌的标题不能超过 ${MAX_CARD_TITLE_LENGTH} 个字符`)
      }
      if (typeof c.content === 'string' && c.content.length > MAX_CARD_CONTENT_LENGTH) {
        throw new Error(`地图第 ${index} 张卡牌的内容不能超过 ${MAX_CARD_CONTENT_LENGTH} 个字符`)
      }
    }
  }
  const totalHandCards = backup.session.hands.reduce((sum: number, hand: { cards?: unknown[] }) => {
    return sum + (Array.isArray(hand.cards) ? hand.cards.length : 0)
  }, 0)
  if (totalHandCards > MAX_SESSION_TOTAL_HAND_CARDS) {
    throw new Error(`所有玩家手牌总数不能超过 ${MAX_SESSION_TOTAL_HAND_CARDS} 张`)
  }

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
      battle_panel_visibility: 'host-only',
      gm_panel_theme: 'gold-abyss',
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
  if (packs.length > MAX_IMPORTED_PACKS) {
    throw new Error(`导入的卡包数量不能超过 ${MAX_IMPORTED_PACKS} 个`)
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
  if (candidate.battle_panel_visibility !== undefined && candidate.battle_panel_visibility !== 'host-only' && candidate.battle_panel_visibility !== 'shared') {
    throw new Error('Room battle_panel_visibility must be host-only or shared')
  }
  if (candidate.battle_panel_visibility === undefined) {
    candidate.battle_panel_visibility = 'host-only'
  }
  if (candidate.gm_panel_theme !== undefined
    && candidate.gm_panel_theme !== 'gold-abyss'
    && candidate.gm_panel_theme !== 'jade-hex'
    && candidate.gm_panel_theme !== 'amethyst-ember') {
    throw new Error('Room gm_panel_theme must be gold-abyss, jade-hex, or amethyst-ember')
  }
  if (candidate.gm_panel_theme === undefined) {
    candidate.gm_panel_theme = 'gold-abyss'
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
