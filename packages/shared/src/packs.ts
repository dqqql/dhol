import { BUILT_IN_PACKS, type BuiltInPack } from './built-in-packs'
import type { DhCard, DhPack, RoomPackLibraryItem, RoomPackSource } from './types'

const BUILT_IN_PACK_ID_SET = new Set(BUILT_IN_PACKS.map((pack) => pack.id))

export const DEFAULT_BUILT_IN_PACK_IDS = BUILT_IN_PACKS.map((pack) => pack.id)

function normalizeLibraryPackCards(packId: string, pack: Pick<DhPack, 'cards'>) {
  return pack.cards.map((card, index) => ({
    id: card.id ?? `${packId}:card:${index}`,
    type: card.type,
    custom_type_name: card.custom_type_name,
    title: card.title,
    content: card.content,
    style: card.style,
  }))
}

export function isBuiltInPackId(packId: string): boolean {
  return BUILT_IN_PACK_ID_SET.has(packId)
}

export function getBuiltInPackById(packId: string): BuiltInPack | undefined {
  return BUILT_IN_PACKS.find((pack) => pack.id === packId)
}

export function getBuiltInPacksById(packIds: string[]): BuiltInPack[] {
  return packIds
    .map((packId) => getBuiltInPackById(packId))
    .filter((pack): pack is BuiltInPack => Boolean(pack))
}

export function normalizeBuiltInPackSelection(packIds: string[] | undefined, fallbackToAll = true): string[] {
  const normalized = Array.from(new Set((packIds ?? []).filter(isBuiltInPackId)))
  if (normalized.length > 0) return normalized
  return fallbackToAll ? [...DEFAULT_BUILT_IN_PACK_IDS] : []
}

export function createDeckFromBuiltInPackIds(packIds: string[]): DhCard[] {
  return getBuiltInPacksById(packIds).flatMap((pack) => (
    pack.cards.map((card) => ({
      id: card.id ?? `${pack.id}-${card.title}`,
      type: card.type,
      title: card.title,
      content: card.content,
      style: card.style,
      is_custom: false,
      pack_id: pack.id,
    }))
  ))
}

export function createRoomPackLibraryItemFromPack(
  pack: DhPack,
  options: { id: string; source: RoomPackSource },
): RoomPackLibraryItem {
  return {
    id: options.id,
    pack_name: pack.pack_name,
    description: pack.description?.trim() || undefined,
    source: options.source,
    cards: normalizeLibraryPackCards(options.id, pack),
  }
}

export function normalizeImportedPackLibrary(packLibrary: RoomPackLibraryItem[] | undefined): RoomPackLibraryItem[] {
  return (packLibrary ?? [])
    .filter((pack) => pack.source === 'imported')
    .map((pack) => ({
      id: pack.id,
      pack_name: pack.pack_name,
      description: pack.description,
      source: 'imported' as const,
      cards: pack.cards.map((card) => ({
        id: card.id,
        type: card.type,
        custom_type_name: card.custom_type_name,
        title: card.title,
        content: card.content,
        style: card.style,
      })),
    }))
}

export function builtInPackToLibraryItem(pack: BuiltInPack): RoomPackLibraryItem {
  return {
    id: pack.id,
    pack_name: pack.pack_name,
    description: pack.description,
    source: 'built-in',
    cards: normalizeLibraryPackCards(pack.id, pack),
  }
}

export function createBuiltInPackLibrary(): RoomPackLibraryItem[] {
  return BUILT_IN_PACKS.map((pack) => builtInPackToLibraryItem(pack))
}

export function createPackLibrary(importedPackLibrary: RoomPackLibraryItem[] | undefined): RoomPackLibraryItem[] {
  return [
    ...createBuiltInPackLibrary(),
    ...normalizeImportedPackLibrary(importedPackLibrary),
  ]
}
