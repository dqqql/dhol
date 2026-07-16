import { describe, expect, it } from 'vitest'
import type { RoomPatch, RoomState } from '@dhgc/shared'
import {
  acknowledgeMutation,
  applyAuthoritativeRoomPatch,
  applyRoomPatch,
  createOptimisticRoomState,
  enqueueOptimisticMutation,
  receiveRoomSnapshot,
  rejectMutation,
  type PendingMutation,
} from './roomPatches'

const now = '2026-07-16T00:00:00.000Z'

function room(overrides: Partial<RoomState> = {}): RoomState {
  return {
    room_type: 'gm-panel', room_id: 'room-1', room_name: 'Room', invite_code: 'ABC123',
    created_at: now, expires_at: now, host_player_id: 'host', players: [],
    settings: { imports_enabled: true, resource_change_requires_approval: false, battle_panel_visibility: 'shared', gm_panel_theme: 'gold-abyss' },
    gm_panel: {
      cards_per_page: 4, fear: { value: 1, max: 12 }, countdowns: [{ id: 'clock', name: 'Clock', value: 1, max: 4, created_at: now, updated_at: now }],
      sheets: [{ id: 'sheet', imported_at: now, updated_at: now, html_updated_at: now, source_file_name: 'a.html', source_format: 'mydhcharsheet-html', raw_character_data: {}, parsed_sheet: { file_name: 'a.html', character_name: 'A', summary_line: '', identity: { level: '', ancestry: '', profession: '', community: '', subclass: '', primary_trait: '' }, stats: { evasion: '', armor_value: '', minor_threshold: '', major_threshold: '', attributes: { agility: '', strength: '', finesse: '', instinct: '', presence: '', knowledge: '' } }, resources: { hope: 1, hope_max: 6, proficiency: [false], hp: [false], hp_max: 1, stress: [false], stress_max: 1, armor_slots: [false], armor_max: 1, gold: [false] }, equipment: { armor_name: '', armor_base_score: '', armor_threshold: '', armor_feature: '', primary_weapon_name: '', primary_weapon_trait: '', primary_weapon_damage: '', primary_weapon_feature: '', secondary_weapon_name: '', secondary_weapon_trait: '', secondary_weapon_damage: '', secondary_weapon_feature: '' }, narrative: { background: '', appearance: '', motivation: '', notes: '', experiences: [] } } }],
      sheet_order: ['sheet'], activity_log: [],
    },
    mobile_panel: {
      fear: { value: 2, max: 12 }, countdowns: [{ id: 'mobile-clock', name: 'Clock', value: 1, max: 4, created_at: now, updated_at: now }],
      characters: [{ id: 'character', source: { code: 'code', version: 2, imported_at: now, updated_at: now }, decoded: { version: 2, level: 1, proficiency: 1, evasion: 1, armor: 1, attributes: { agility: 0, strength: 0, finesse: 0, instinct: 0, presence: 0, knowledge: 0 }, damageThresholds: { minor: 1, major: 2 }, resources: { hopeMax: 6, stressMax: 1, goldCurrent: 0, hpMax: 1, armorMax: 1 }, specialCardIndices: { profession: null, subclass: null, ancestry1: null, ancestry2: null, community: null }, domainCardIndices: [], specialCards: {}, domains: [] }, custom: { display_name: 'C', experiences: [] }, tracker: { hopeCurrent: 1, stress: [false], hp: [false], armor_slots: [false], goldCurrent: 0 } }],
      character_order: ['character'], activity_log: [],
    },
    drawing_board: { shapes: [] }, dice_rolls: [], x_card: null, snapshot_version: 1, updated_at: now,
    ...overrides,
  }
}

function patch<T extends Omit<RoomPatch, 'reason' | 'snapshot_version' | 'version' | 'updated_at'>>(value: T, version = 2): RoomPatch {
  return { ...value, reason: 'test', snapshot_version: version, version, updated_at: `v${version}` } as unknown as RoomPatch
}

describe('applyRoomPatch', () => {
  it('applies every patch kind to the matching room subtree', () => {
    const activity = [{ id: 'log', created_at: now, actor_name: 'GM', kind: 'system' as const, message: 'changed' }]
    const mobileActivity = [{ id: 'mlog', created_at: now, actor_name: 'GM', kind: 'system' as const, message: 'changed' }]
    const replacement = room({ room_name: 'Replacement', snapshot_version: 2 })
    const variants: Array<[RoomPatch, (next: RoomState) => unknown, unknown]> = [
      [patch({ kind: 'room.replacement', state: replacement }), (r) => r.room_name, 'Replacement'],
      [patch({ kind: 'room.settings', settings: { ...room().settings, imports_enabled: false } }), (r) => r.settings.imports_enabled, false],
      [patch({ kind: 'room.metadata', expires_at: 'later' }), (r) => r.expires_at, 'later'],
      [patch({ kind: 'players.presence', players: [{ id: 'p', nickname: 'P', color: '#fff', is_host: true, is_online: true, joined_at: now, last_seen_at: now }], hostPlayerId: 'p', xCard: { id: 'x', created_at: now, acknowledged_player_ids: [] } }), (r) => r.host_player_id, 'p'],
      [patch({ kind: 'gm.sheet', operation: 'delete', sheetId: 'sheet', sheetOrder: [], activityLog: activity }), (r) => r.gm_panel?.sheets.length, 0],
      [patch({ kind: 'gm.resource', sheetId: 'sheet', resourceKey: 'hope', value: 5, sheetUpdatedAt: 'sheet-v2', activityLog: activity }), (r) => r.gm_panel?.sheets[0].parsed_sheet.resources.hope, 5],
      [patch({ kind: 'gm.fear', fear: { value: 6, max: 12 }, activityLog: activity }), (r) => r.gm_panel?.fear.value, 6],
      [patch({ kind: 'gm.countdown', operation: 'delete', countdownId: 'clock', activityLog: activity }), (r) => r.gm_panel?.countdowns.length, 0],
      [patch({ kind: 'gm.order', sheetOrder: ['other'], activityLog: activity }), (r) => r.gm_panel?.sheet_order[0], 'other'],
      [patch({ kind: 'gm.cardsPerPage', cardsPerPage: 8, activityLog: activity }), (r) => r.gm_panel?.cards_per_page, 8],
      [patch({ kind: 'mobile.character', operation: 'delete', characterId: 'character', characterOrder: [], activityLog: mobileActivity }), (r) => r.mobile_panel?.characters.length, 0],
      [patch({ kind: 'mobile.resource', characterId: 'character', resourceKey: 'hopeCurrent', value: 4, activityLog: mobileActivity }), (r) => r.mobile_panel?.characters[0].tracker.hopeCurrent, 4],
      [patch({ kind: 'mobile.fear', fear: { value: 7, max: 12 }, activityLog: mobileActivity }), (r) => r.mobile_panel?.fear.value, 7],
      [patch({ kind: 'mobile.countdown', operation: 'delete', countdownId: 'mobile-clock', activityLog: mobileActivity }), (r) => r.mobile_panel?.countdowns.length, 0],
      [patch({ kind: 'dice.history', diceRolls: [{ id: 'roll', created_at: now, actor_player_id: 'p', actor_name: 'P', normalized_formula: '1d6', request: { mode: 'standard', modifier_mode: 'normal', repeat: 1, modifier: 0, dice: [{ sides: 6, count: 1 }] }, mode: 'standard', modifier_mode: 'normal', results: [{ total: 4, critical: false, primary_rolls: [4], terms: [] }] }] }), (r) => r.dice_rolls[0].id, 'roll'],
      [patch({ kind: 'drawing', drawingBoard: { shapes: [], updated_at: 'drawn' } }), (r) => r.drawing_board?.updated_at, 'drawn'],
      [patch({ kind: 'xcard', xCard: { id: 'new-x', created_at: now, acknowledged_player_ids: [] } }), (r) => r.x_card?.id, 'new-x'],
    ]

    for (const [event, select, expected] of variants) {
      const next = applyRoomPatch(room(), event)
      expect(select(next), event.kind).toEqual(expected)
      expect(next.snapshot_version).toBe(2)
      expect(next.updated_at).toBe('v2')
    }
  })

  it('supports upserts for entity patch variants', () => {
    const base = room()
    const sheet = { ...base.gm_panel!.sheets[0], id: 'new-sheet' }
    const countdown = { ...base.gm_panel!.countdowns[0], id: 'new-clock', value: 3 }
    const character = { ...base.mobile_panel!.characters[0], id: 'new-character' }
    const gmActivity = base.gm_panel!.activity_log
    const mobileActivity = base.mobile_panel!.activity_log
    let next = applyRoomPatch(base, patch({ kind: 'gm.sheet', operation: 'upsert', sheetId: sheet.id, sheet, sheetOrder: ['sheet', sheet.id], activityLog: gmActivity }))
    next = applyRoomPatch(next, patch({ kind: 'gm.countdown', operation: 'upsert', countdownId: countdown.id, countdown, activityLog: gmActivity }, 3))
    next = applyRoomPatch(next, patch({ kind: 'mobile.character', operation: 'upsert', characterId: character.id, character, characterOrder: ['character', character.id], activityLog: mobileActivity }, 4))
    next = applyRoomPatch(next, patch({ kind: 'mobile.countdown', operation: 'upsert', countdownId: countdown.id, countdown, activityLog: mobileActivity }, 5))
    expect(next.gm_panel?.sheets.some((item) => item.id === sheet.id)).toBe(true)
    expect(next.gm_panel?.countdowns.some((item) => item.id === countdown.id)).toBe(true)
    expect(next.mobile_panel?.characters.some((item) => item.id === character.id)).toBe(true)
    expect(next.mobile_panel?.countdowns.some((item) => item.id === countdown.id)).toBe(true)
  })

  it('ignores stale patches', () => {
    const current = room({ snapshot_version: 5 })
    expect(applyRoomPatch(current, patch({ kind: 'gm.fear', fear: { value: 9, max: 12 }, activityLog: [] }, 4))).toBe(current)
  })
})

describe('optimistic room state', () => {
  const resourceMutation: PendingMutation = { requestId: 'req-1', baseVersion: 1, kind: 'gm.resource', sheetId: 'sheet', resourceKey: 'hope', value: 4 }

  it('updates a resource immediately and accepts an authoritative correction', () => {
    let state = enqueueOptimisticMutation(createOptimisticRoomState(room()), resourceMutation)
    expect(state.room?.gm_panel?.sheets[0].parsed_sheet.resources.hope).toBe(4)
    state = applyAuthoritativeRoomPatch(state, patch({ kind: 'gm.resource', sheetId: 'sheet', resourceKey: 'hope', value: 3, sheetUpdatedAt: now, activityLog: [] }))
    expect(state.room?.gm_panel?.sheets[0].parsed_sheet.resources.hope).toBe(3)
    expect(state.pending).toHaveLength(0)
  })

  it('rolls back a rejected mutation without discarding later optimistic changes', () => {
    let state = enqueueOptimisticMutation(createOptimisticRoomState(room()), resourceMutation)
    state = enqueueOptimisticMutation(state, { ...resourceMutation, requestId: 'req-2', value: 5 })
    state = rejectMutation(state, 'req-1')
    expect(state.room?.gm_panel?.sheets[0].parsed_sheet.resources.hope).toBe(5)
    state = rejectMutation(state, 'req-2')
    expect(state.room?.gm_panel?.sheets[0].parsed_sheet.resources.hope).toBe(1)
  })

  it('keeps an acknowledged mutation until its authoritative version arrives', () => {
    let state = enqueueOptimisticMutation(createOptimisticRoomState(room()), resourceMutation)
    state = acknowledgeMutation(state, 'req-1', 3)
    expect(state.pending).toHaveLength(1)
    state = applyAuthoritativeRoomPatch(state, patch({ kind: 'room.metadata', expires_at: 'later' }, 3))
    expect(state.pending).toHaveLength(0)
  })

  it('retains rollback data when ack arrives before the authoritative patch', () => {
    let state = enqueueOptimisticMutation(createOptimisticRoomState(room()), resourceMutation)
    state = acknowledgeMutation(state, 'req-1', 3)
    state = rejectMutation(state, 'req-1')
    expect(state.pending).toHaveLength(0)
    expect(state.room?.gm_panel?.sheets[0].parsed_sheet.resources.hope).toBe(1)
  })

  it('does not roll back an authoritative correction already covering the request', () => {
    let state = enqueueOptimisticMutation(createOptimisticRoomState(room()), resourceMutation)
    state = applyAuthoritativeRoomPatch(state, patch({ kind: 'gm.resource', sheetId: 'sheet', resourceKey: 'hope', value: 3, sheetUpdatedAt: now, activityLog: [] }))
    state = rejectMutation(state, 'req-1')
    expect(state.room?.gm_panel?.sheets[0].parsed_sheet.resources.hope).toBe(3)
    expect(state.room?.snapshot_version).toBe(2)
  })

  it('treats a snapshot as authoritative and clears pending mutations', () => {
    const pending = enqueueOptimisticMutation(createOptimisticRoomState(room()), resourceMutation)
    const recovered = receiveRoomSnapshot(pending, room({ snapshot_version: 9 }))
    expect(recovered.pending).toHaveLength(0)
    expect(recovered.room?.snapshot_version).toBe(9)
    expect(recovered.room?.gm_panel?.sheets[0].parsed_sheet.resources.hope).toBe(1)
  })

})
