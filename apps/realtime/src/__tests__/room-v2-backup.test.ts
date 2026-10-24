import { describe, expect, it } from 'vitest'
import { resourcesFromSheet, summaryFromSheet, type CharacterSheetJson } from '@dhgc/shared/desktop'
import daggerheart from '../../../../packages/shared/src/__tests__/fixtures/daggerheart-sheet.json'
import { routeRoomV2 } from '../room-v2-http'
import type { RoomV2Env } from '../room-v2'

describe('Room V2 backup restore', () => {
  it('accepts exported resources trimmed to displayed maxima from a v2 sheet', async () => {
    const sheet: CharacterSheetJson = {
      ...daggerheart,
      ruleSetId: 'daggerheart',
      hp: Array(18).fill(false), stress: Array(18).fill(false), armorBoxes: Array(12).fill(false),
      desktopView: {
        version: 1, evasion: '10', armorValue: '3', minorThreshold: '5', majorThreshold: '10',
        attributes: { agility: '0', strength: '0', finesse: '0', instinct: '0', presence: '0', knowledge: '0' },
        hpMax: 6, stressMax: 6, armorMax: 3,
        primaryWeaponAttribute: '', primaryWeaponRange: '', secondaryWeaponAttribute: '', secondaryWeaponRange: '',
      },
    }
    const resources = resourcesFromSheet(sheet)
    const summary = summaryFromSheet(sheet, resources, 1, 0)
    const backup = {
      schemaVersion: 2,
      room: {
        name: '备份测试', fear: { value: 0, max: 12 }, xCard: { active: false, updatedAt: null },
        characters: [summary], dice: [], clocks: [],
      },
      characters: [{ name: sheet.name, sheet }],
    }
    let restored: { state: { characters: Array<{ resources: typeof resources }> } } | undefined
    const env = {
      SESSION_SECRET: 'backup-test-secret',
      ROOMS_V2: { getByName: () => ({ fetch: async (request: Request) => {
        restored = await request.json() as typeof restored
        return Response.json({ room: { roomId: 'restored-room', inviteCode: 'ABC123' }, player: { id: 'creator', nickname: '甲' } })
      } }) },
    } as unknown as RoomV2Env

    const response = await routeRoomV2(new Request('https://room.test/api/v2/rooms/restore', {
      method: 'POST', headers: { 'CF-Connecting-IP': 'backup-test' }, body: JSON.stringify({ nickname: '甲', backup }),
    }), env)
    expect(response?.status).toBe(200)
    expect(restored?.state.characters[0].resources).toEqual(resources)
  })
})
