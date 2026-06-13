import type { DhRoomBackup, RoomSettings } from './types'

export function assertDhRoomBackup(value: unknown): DhRoomBackup {
  if (!value || typeof value !== 'object') {
    throw new Error('Room backup must be an object')
  }

  const backup = value as Partial<DhRoomBackup>
  if (backup.format !== 'dhroom') throw new Error('Room backup format must be "dhroom"')
  if (backup.version !== 1) throw new Error('Room backup version must be 1')
  if (!backup.room || typeof backup.room !== 'object') throw new Error('room metadata is required')
  if (!Array.isArray(backup.players)) throw new Error('Room players must be an array')

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

  return backup as DhRoomBackup
}

export function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    throw new Error('Invalid JSON')
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
