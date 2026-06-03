/**
 * Pure business utility functions extracted from the realtime backend.
 * These functions have no Cloudflare Workers-specific dependencies and can be
 * used in any environment (backend, frontend, tests, etc.).
 */

import { decodeMobilePanelCharacterCode } from './mobile-panel-code'
import type {
  GmPanelCharacterSheetEntry,
  GmPanelResourceKey,
  GmPanelState,
  ImportedCharacterData,
  MobilePanelCharacterEntry,
  MobilePanelExperience,
  MobilePanelResourceKey,
  MobilePanelState,
  Player,
  ResourceTrackerCountdown,
  ResourceTrackerResourceKey,
  ResourceTrackerSheet,
  RoomType,
} from './types'

// ---------------------------------------------------------------------------
// Generic primitive utilities
// ---------------------------------------------------------------------------

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function finiteNumber(value: unknown, fallback: number): number {
  return Number.isFinite(value) ? Number(value) : fallback
}

export function cleanText(value: unknown, fallback: string, maxLength: number): string {
  const text = typeof value === 'string' ? value.trim() : ''
  return (text || fallback).slice(0, maxLength)
}

export function cleanOptionalText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined
  const text = value.trim().slice(0, maxLength)
  return text || undefined
}

export function normaliseInvite(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
}

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = crypto.getRandomValues(new Uint32Array(1))[0] % (index + 1)
    ;[copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]]
  }
  return copy
}

export function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Generate a prefixed unique ID using the Web Crypto API. */
export function id(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`
}

/** Generate a random 6-character invite code. */
export function generateInviteCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = new Uint8Array(6)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, byte => alphabet[byte % alphabet.length]).join('')
}


// ---------------------------------------------------------------------------
// Player utilities
// ---------------------------------------------------------------------------

export function makePlayer(idValue: string, nickname: string, color: string, isHost: boolean, now: Date): Player {
  return {
    id: idValue,
    nickname,
    color,
    is_host: isHost,
    is_online: true,
    joined_at: now.toISOString(),
    last_seen_at: now.toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Room type
// ---------------------------------------------------------------------------

export function normalizeRoomType(value: RoomType | undefined): RoomType {
  if (value === 'mobile-panel') return value
  return 'gm-panel'
}

// ---------------------------------------------------------------------------
// Shared countdown normalizer (used by gm-panel and mobile-panel)
// ---------------------------------------------------------------------------

export function normalizeResourceTrackerCountdown(
  countdown: Partial<ResourceTrackerCountdown> | undefined,
  index: number,
): ResourceTrackerCountdown {
  const now = new Date().toISOString()
  const max = clamp(Math.round(finiteNumber(countdown?.max, 4)), 2, 12)
  return {
    id: cleanText(countdown?.id, id('tracker_clock'), 120),
    name: cleanText(countdown?.name, `倒计时 ${index + 1}`, 40),
    value: clamp(Math.round(finiteNumber(countdown?.value, 0)), 0, max),
    max,
    created_at: cleanText(countdown?.created_at, now, 80),
    updated_at: cleanText(countdown?.updated_at, countdown?.created_at || now, 80),
  }
}

export function normalizeResourceTrackerSheet(sheet: ResourceTrackerSheet, fileName: string): ResourceTrackerSheet {
  const normalizedFileName = cleanText(fileName || sheet.file_name, '角色卡.json', 120)
  const normalizedExperiences = Array.isArray(sheet.narrative?.experiences)
    ? sheet.narrative.experiences.slice(0, 5).map((item) => ({
      name: cleanText(item?.name, '', 60),
      value: cleanText(item?.value, '', 10),
    }))
    : []

  while (normalizedExperiences.length < 5) {
    normalizedExperiences.push({ name: '', value: '' })
  }

  return {
    file_name: normalizedFileName,
    character_name: cleanText(sheet.character_name, '未命名角色', 60),
    summary_line: cleanText(sheet.summary_line, '', 180),
    identity: {
      level: cleanText(sheet.identity?.level, '', 10),
      ancestry: cleanText(sheet.identity?.ancestry, '', 80),
      profession: cleanText(sheet.identity?.profession, '', 80),
      community: cleanText(sheet.identity?.community, '', 80),
      subclass: cleanText(sheet.identity?.subclass, '', 80),
      primary_trait: cleanText(sheet.identity?.primary_trait, '', 40),
    },
    stats: {
      evasion: cleanText(sheet.stats?.evasion, '', 20),
      armor_value: cleanText(sheet.stats?.armor_value, '', 20),
      minor_threshold: cleanText(sheet.stats?.minor_threshold, '', 20),
      major_threshold: cleanText(sheet.stats?.major_threshold, '', 20),
      attributes: {
        agility: cleanText(sheet.stats?.attributes?.agility, '', 10),
        strength: cleanText(sheet.stats?.attributes?.strength, '', 10),
        finesse: cleanText(sheet.stats?.attributes?.finesse, '', 10),
        instinct: cleanText(sheet.stats?.attributes?.instinct, '', 10),
        presence: cleanText(sheet.stats?.attributes?.presence, '', 10),
        knowledge: cleanText(sheet.stats?.attributes?.knowledge, '', 10),
      },
    },
    resources: {
      hope: clamp(Math.round(finiteNumber(sheet.resources?.hope, 0)), 0, clamp(Math.round(finiteNumber(sheet.resources?.hope_max, 6)), 0, 12)),
      hope_max: clamp(Math.round(finiteNumber(sheet.resources?.hope_max, 6)), 0, 12),
      proficiency: normalizeBooleanTrack(sheet.resources?.proficiency, 6),
      hp: normalizeBooleanTrack(sheet.resources?.hp, clamp(Math.round(finiteNumber(sheet.resources?.hp_max, 7)), 0, 20)),
      hp_max: clamp(Math.round(finiteNumber(sheet.resources?.hp_max, 7)), 0, 20),
      stress: normalizeBooleanTrack(sheet.resources?.stress, clamp(Math.round(finiteNumber(sheet.resources?.stress_max, 6)), 0, 20)),
      stress_max: clamp(Math.round(finiteNumber(sheet.resources?.stress_max, 6)), 0, 20),
      armor_slots: normalizeBooleanTrack(sheet.resources?.armor_slots, clamp(Math.round(finiteNumber(sheet.resources?.armor_max, 5)), 0, 12)),
      armor_max: clamp(Math.round(finiteNumber(sheet.resources?.armor_max, 5)), 0, 12),
      gold: normalizeBooleanTrack(sheet.resources?.gold, 21),
    },
    equipment: {
      armor_name: cleanText(sheet.equipment?.armor_name, '', 80),
      armor_base_score: cleanText(sheet.equipment?.armor_base_score, '', 80),
      armor_threshold: cleanText(sheet.equipment?.armor_threshold, '', 80),
      armor_feature: cleanText(sheet.equipment?.armor_feature, '', 160),
      primary_weapon_name: cleanText(sheet.equipment?.primary_weapon_name, '', 80),
      primary_weapon_trait: cleanText(sheet.equipment?.primary_weapon_trait, '', 120),
      primary_weapon_damage: cleanText(sheet.equipment?.primary_weapon_damage, '', 120),
      primary_weapon_feature: cleanText(sheet.equipment?.primary_weapon_feature, '', 160),
      secondary_weapon_name: cleanText(sheet.equipment?.secondary_weapon_name, '', 80),
      secondary_weapon_trait: cleanText(sheet.equipment?.secondary_weapon_trait, '', 120),
      secondary_weapon_damage: cleanText(sheet.equipment?.secondary_weapon_damage, '', 120),
      secondary_weapon_feature: cleanText(sheet.equipment?.secondary_weapon_feature, '', 160),
    },
    narrative: {
      background: cleanText(sheet.narrative?.background, '', 2000),
      appearance: cleanText(sheet.narrative?.appearance, '', 2000),
      motivation: cleanText(sheet.narrative?.motivation, '', 500),
      notes: cleanText(sheet.narrative?.notes, '', 4000),
      experiences: normalizedExperiences,
    },
  }
}

export function normalizeBooleanTrack(value: unknown, maxLength: number): boolean[] {
  const normalizedLength = Math.max(0, maxLength)
  const source = Array.isArray(value) ? value : []
  return Array.from({ length: normalizedLength }, (_, index) => Boolean(source[index]))
}

// ---------------------------------------------------------------------------
// Resource tracker resource value helpers
// ---------------------------------------------------------------------------

export function cloneTrackerResourceValue(value: number | boolean[]): number | boolean[] {
  return Array.isArray(value) ? [...value] : value
}

export function getTrackerResourceValue(sheet: ResourceTrackerSheet, resourceKey: ResourceTrackerResourceKey): number | boolean[] {
  switch (resourceKey) {
    case 'hope':
      return sheet.resources.hope
    case 'proficiency':
      return [...sheet.resources.proficiency]
    case 'hp':
      return [...sheet.resources.hp]
    case 'stress':
      return [...sheet.resources.stress]
    case 'armor_slots':
      return [...sheet.resources.armor_slots]
    case 'gold':
      return [...sheet.resources.gold]
  }
}

export function setTrackerResourceValue(sheet: ResourceTrackerSheet, resourceKey: ResourceTrackerResourceKey, nextValue: number | boolean[]): void {
  switch (resourceKey) {
    case 'hope':
      sheet.resources.hope = nextValue as number
      return
    case 'proficiency':
      sheet.resources.proficiency = [...(nextValue as boolean[])]
      return
    case 'hp':
      sheet.resources.hp = [...(nextValue as boolean[])]
      return
    case 'stress':
      sheet.resources.stress = [...(nextValue as boolean[])]
      return
    case 'armor_slots':
      sheet.resources.armor_max = clamp((nextValue as boolean[]).length, 0, 12)
      sheet.resources.armor_slots = normalizeBooleanTrack(nextValue, sheet.resources.armor_max)
      return
    case 'gold':
      sheet.resources.gold = [...(nextValue as boolean[])]
      return
  }
}

export function normalizeTrackerResourceValue(
  sheet: ResourceTrackerSheet,
  resourceKey: ResourceTrackerResourceKey,
  nextValue: number | boolean[],
): number | boolean[] {
  switch (resourceKey) {
    case 'hope':
      return clamp(Math.round(finiteNumber(nextValue, sheet.resources.hope)), 0, sheet.resources.hope_max)
    case 'proficiency':
      return normalizeBooleanTrack(nextValue, sheet.resources.proficiency.length)
    case 'hp':
      return normalizeBooleanTrack(nextValue, sheet.resources.hp_max)
    case 'stress':
      return normalizeBooleanTrack(nextValue, sheet.resources.stress_max)
    case 'armor_slots':
      return normalizeBooleanTrack(
        nextValue,
        Array.isArray(nextValue) ? clamp(nextValue.length, 0, 12) : sheet.resources.armor_max,
      )
    case 'gold':
      return normalizeBooleanTrack(nextValue, sheet.resources.gold.length)
  }
}

export function isTrackerResourceValueEqual(left: number | boolean[], right: number | boolean[]): boolean {
  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) return false
    return left.every((item, index) => item === right[index])
  }

  return left === right
}

export function getTrackerResourceLabel(resourceKey: ResourceTrackerResourceKey): string {
  switch (resourceKey) {
    case 'hope':
      return '希望点'
    case 'proficiency':
      return '熟练'
    case 'hp':
      return '生命点'
    case 'stress':
      return '压力点'
    case 'armor_slots':
      return '护甲槽'
    case 'gold':
      return '金币'
  }
}

export function formatTrackerResourceValue(value: number | boolean[]): string {
  if (Array.isArray(value)) {
    if (value.length === 21) {
      const hand = value.slice(0, 10).filter(Boolean).length
      const bag = value.slice(10, 20).filter(Boolean).length
      const chest = value[20] ? 1 : 0
      return `把 ${hand}/10，袋 ${bag}/10，箱 ${chest}/1`
    }
    return `${value.filter(Boolean).length}/${value.length}`
  }
  return String(value)
}

// ---------------------------------------------------------------------------
// GM Panel state factories and normalizers
// ---------------------------------------------------------------------------

export function createEmptyGmPanelState(): GmPanelState {
  return {
    cards_per_page: 4,
    fear: {
      value: 0,
      max: 12,
    },
    countdowns: [],
    sheets: [],
    sheet_order: [],
    activity_log: [],
  }
}

export function repairKnownGmLogMessage(message: string): string {
  return typeof message === 'string'
    ? message.replaceAll('鍒犻櫎浜嗚鑹插崱', '删除了角色卡')
    : message
}

export function normalizeImportedCharacterData(value: ImportedCharacterData | undefined): ImportedCharacterData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }
  return structuredClone(value)
}

// ---------------------------------------------------------------------------
// HTML sanitization and parsing
// ---------------------------------------------------------------------------

const TRANSPARENT_IMAGE_DATA_URL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='
const INLINE_IMAGE_DATA_URL_PATTERN = /data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g
const SRD_CHARACTER_SHEET_ERROR = '请使用srd车卡器导出的角色卡'

export function sanitizeImportedHtml(html: string): string {
  return html
    .replace(INLINE_IMAGE_DATA_URL_PATTERN, TRANSPARENT_IMAGE_DATA_URL)
    .trim()
}

export function assertSrdCharacterSheetHtml(html: string): void {
  const head = html.slice(0, 20_000)
  const hasExporter = /<html\b[^>]*\bdata-version=["']1\.0["'][^>]*\bdata-exporter=["']daggerheart-character-sheet["']/i.test(head)
  const hasGenerator = /<meta\b[^>]*\bname=["']generator["'][^>]*\bcontent=["']Daggerheart Character Sheet Exporter v1\.0["']/i.test(head)
  if (!hasExporter || !hasGenerator || findCharacterDataAssignmentIndex(html) < 0) {
    throw new Error(SRD_CHARACTER_SHEET_ERROR)
  }
}

interface HtmlCheckboxSnapshot {
  id?: string
  openingTag: string
  filled: boolean
}

export function applyHtmlResourceTracksToSheet(html: string, sheet: ResourceTrackerSheet): void {
  const hp = collectCheckboxSnapshotsAfterLabel(html, '生命点', 'w-4 h-4', 20, 8_000, ['压力点', '护甲槽', '金币'])
  if (hp.length > 0) {
    sheet.resources.hp_max = hp.length
    sheet.resources.hp = hp.map((item) => item.filled)
  }

  const stress = collectCheckboxSnapshotsAfterLabel(html, '压力点', 'w-4 h-4', 20, 8_000, ['生命点', '护甲槽', '金币'])
  if (stress.length > 0) {
    sheet.resources.stress_max = stress.length
    sheet.resources.stress = stress.map((item) => item.filled)
  }
}

export function compileGmSheetHtml(html: string, sheet: ResourceTrackerSheet): string {
  const resourceElements = collectGmResourceElements(html, sheet)
  let compiled = markHopeResourceElements(html, sheet.resources.hope_max)

  ;(['proficiency', 'hp', 'stress', 'armor_slots', 'gold'] as const).forEach((resourceKey) => {
    resourceElements[resourceKey].forEach((element, index) => {
      compiled = markResourceElement(compiled, element, resourceKey, index)
    })
  })

  return compiled
}

export function collectGmResourceElements(
  html: string,
  sheet: ResourceTrackerSheet,
): Record<Exclude<ResourceTrackerResourceKey, 'hope'>, HtmlCheckboxSnapshot[]> {
  const resources = sheet.resources

  return {
    proficiency: collectCheckboxSnapshotsAfterLabel(html, '熟练值', 'w-3 h-3', resources.proficiency.length, 4_000),
    hp: collectCheckboxSnapshotsAfterLabel(html, '生命点', 'w-4 h-4', resources.hp.length, 8_000, ['压力点', '护甲槽', '金币']),
    stress: collectCheckboxSnapshotsAfterLabel(html, '压力点', 'w-4 h-4', resources.stress.length, 8_000, ['生命点', '护甲槽', '金币']),
    armor_slots: collectCheckboxSnapshotsAfterLabel(html, '护甲槽', 'w-4 h-4', resources.armor_slots.length, 5_000),
    gold: collectGoldCheckboxes(html, resources.gold.length),
  }
}

export function collectGoldCheckboxes(html: string, limit: number): HtmlCheckboxSnapshot[] {
  if (limit <= 0) return []

  const goldIndex = html.indexOf('金币')
  if (goldIndex < 0) return []

  const coinElements = collectCheckboxSnapshotsFromIndex(html, goldIndex, 'w-4 h-4', Math.min(20, limit), 12_000)
  if (coinElements.length >= limit) {
    return coinElements.slice(0, limit)
  }

  const chestElements = collectCheckboxSnapshotsFromIndex(html, goldIndex, 'w-8 h-8', limit - coinElements.length, 12_000)
  return [...coinElements, ...chestElements].slice(0, limit)
}

export function collectCheckboxIdsAfterLabel(
  html: string,
  label: string,
  classToken: string,
  limit: number,
  scanLength: number,
  boundaryLabels: string[] = [],
): string[] {
  return collectCheckboxSnapshotsAfterLabel(html, label, classToken, limit, scanLength, boundaryLabels)
    .map((item) => item.id)
    .filter((item): item is string => Boolean(item))
}

export function collectCheckboxSnapshotsAfterLabel(
  html: string,
  label: string,
  classToken: string,
  limit: number,
  scanLength: number,
  boundaryLabels: string[] = [],
): HtmlCheckboxSnapshot[] {
  if (limit <= 0) return []

  let labelIndex = -1
  while ((labelIndex = html.indexOf(label, labelIndex + 1)) >= 0) {
    const sectionEnd = findNearestFollowingLabelIndex(html, labelIndex + label.length, boundaryLabels)
    const scopedScanLength = Math.min(scanLength, Math.max(0, sectionEnd - labelIndex))
    const snapshots = collectCheckboxSnapshotsFromIndex(html, labelIndex, classToken, limit, scopedScanLength)

    if (snapshots.length > 0) {
      return snapshots
    }
  }

  return []
}

export function findNearestFollowingLabelIndex(html: string, startIndex: number, labels: string[]): number {
  let nearestIndex = html.length

  for (const label of labels) {
    const index = html.indexOf(label, startIndex)
    if (index >= 0 && index < nearestIndex) {
      nearestIndex = index
    }
  }

  return nearestIndex
}

export function collectCheckboxIdsFromIndex(
  html: string,
  startIndex: number,
  classToken: string,
  limit: number,
  scanLength: number,
): string[] {
  return collectCheckboxSnapshotsFromIndex(html, startIndex, classToken, limit, scanLength)
    .map((item) => item.id)
    .filter((item): item is string => Boolean(item))
}

export function collectCheckboxSnapshotsFromIndex(
  html: string,
  startIndex: number,
  classToken: string,
  limit: number,
  scanLength: number,
): HtmlCheckboxSnapshot[] {
  const segment = html.slice(startIndex, startIndex + scanLength)
  const snapshots: HtmlCheckboxSnapshot[] = []
  const seen = new Set<string>()
  const elementPattern = /<(?:div|button)\b[^>]*>/gi
  let match: RegExpExecArray | null

  while ((match = elementPattern.exec(segment)) && snapshots.length < limit) {
    const tag = match[0]
    const idValue = getHtmlAttribute(tag, 'id')
    const className = getHtmlAttribute(tag, 'class') ?? ''
    const onclick = getHtmlAttribute(tag, 'onclick') ?? ''

    if (idValue && seen.has(idValue)) continue
    if (!onclick.includes('toggleCustomCheckbox')) continue
    if (!hasClassTokens(className, classToken)) continue
    if (!hasClassToken(className, 'cursor-pointer') || !hasDarkBorderClass(className)) continue

    if (idValue) {
      seen.add(idValue)
    }
    snapshots.push({
      id: idValue || undefined,
      openingTag: tag,
      filled: hasFilledClass(className),
    })
  }

  return snapshots
}

export function markHopeResourceElements(html: string, hopeMax: number): string {
  const max = clamp(Math.round(finiteNumber(hopeMax, 6)), 0, 12)

  return html.replace(/<([a-z][\w:-]*)\b(?=[^>]*\bdata-hope-index=(["']?)(\d+)\2)[^>]*>/gi, (tag, _tagName, _quote, rawIndex) => {
    const index = Number(rawIndex)
    if (!Number.isInteger(index) || index < 0 || index >= max) return tag
    return markOpeningTag(tag, 'hope', index)
  })
}

export function markResourceElement(html: string, element: HtmlCheckboxSnapshot, resourceKey: ResourceTrackerResourceKey, index: number): string {
  if (!element.id) {
    return html.replace(element.openingTag, (tag) => markOpeningTag(tag, resourceKey, index))
  }

  return markElementById(html, element.id, resourceKey, index)
}

export function markElementById(html: string, elementId: string, resourceKey: ResourceTrackerResourceKey, index: number): string {
  const escapedId = escapeRegExp(elementId)
  const elementPattern = new RegExp(`<(?:div|button)\\b(?=[^>]*\\bid=(["'])${escapedId}\\1)[^>]*>`, 'i')
  return html.replace(elementPattern, (tag) => markOpeningTag(tag, resourceKey, index))
}

export function hasClassToken(className: string, token: string): boolean {
  return className.split(/\s+/).includes(token)
}

export function hasClassTokens(className: string, tokens: string): boolean {
  return tokens.split(/\s+/).every((token) => hasClassToken(className, token))
}

export function hasDarkBorderClass(className: string): boolean {
  return [
    'border-gray-800',
    'border-gray-900',
    'border-slate-800',
    'border-slate-900',
    'border-zinc-800',
    'border-zinc-900',
    'border-neutral-800',
    'border-neutral-900',
    'border-stone-800',
    'border-stone-900',
    'border-black',
  ].some((token) => hasClassToken(className, token))
}

export function hasFilledClass(className: string): boolean {
  return [
    'bg-gray-800',
    'bg-gray-900',
    'bg-slate-800',
    'bg-slate-900',
    'bg-zinc-800',
    'bg-zinc-900',
    'bg-neutral-800',
    'bg-neutral-900',
    'bg-stone-800',
    'bg-stone-900',
    'bg-black',
  ].some((token) => hasClassToken(className, token))
}

export function markOpeningTag(tag: string, resourceKey: ResourceTrackerResourceKey, index: number): string {
  const cleaned = tag
    .replace(/\sdata-dhol-resource=(["']).*?\1/gi, '')
    .replace(/\sdata-dhol-index=(["']).*?\1/gi, '')
    .replace(/\sdata-gm-allow-click=(["']).*?\1/gi, '')

  return cleaned.replace(/>$/, ` data-dhol-resource="${resourceKey}" data-dhol-index="${index}" data-gm-allow-click="true">`)
}

export function getHtmlAttribute(tag: string, attributeName: string): string | undefined {
  const escapedName = escapeRegExp(attributeName)
  const pattern = new RegExp(`\\s${escapedName}\\s*=\\s*(["'])(.*?)\\1`, 'i')
  return tag.match(pattern)?.[2]
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ---------------------------------------------------------------------------
// Character data extraction from HTML
// ---------------------------------------------------------------------------

export function extractCharacterDataFromHtml(html: string): ImportedCharacterData {
  const start = findCharacterDataAssignmentIndex(html)
  if (start < 0) {
    throw new Error('Unsupported HTML export: window.characterData was not found.')
  }

  const objectStart = html.indexOf('{', start)
  if (objectStart < 0) {
    throw new Error('Unsupported HTML export: characterData object start was not found.')
  }

  const objectEnd = findObjectLiteralEnd(html, objectStart)
  const objectText = html.slice(objectStart, objectEnd)

  try {
    return JSON.parse(objectText) as ImportedCharacterData
  } catch {
    try {
      return Function(`"use strict"; return (${objectText});`)() as ImportedCharacterData
    } catch (error) {
      throw new Error(error instanceof Error ? `Character data parse failed: ${error.message}` : 'Character data parse failed.')
    }
  }
}

export function findCharacterDataAssignmentIndex(html: string): number {
  const patterns = [
    /\bwindow\s*\.\s*characterData\s*=/g,
    /\b(?:const|let|var)\s+characterData\s*=/g,
    /\bcharacterData\s*=/g,
  ]
  let nearestIndex = -1

  for (const pattern of patterns) {
    const match = pattern.exec(html)
    if (match && (nearestIndex < 0 || match.index < nearestIndex)) {
      nearestIndex = match.index
    }
  }

  return nearestIndex
}

export function extractArmorSlotsFromHtml(html: string): boolean[] {
  const label = '护甲槽'
  const labelIndexes: number[] = []
  let searchIndex = -1

  while ((searchIndex = html.indexOf(label, searchIndex + 1)) >= 0) {
    labelIndexes.push(searchIndex)
  }

  const labelIndex = labelIndexes.find((index) => html.slice(index, index + 600).includes('grid grid-cols-3'))
  if (labelIndex === undefined) {
    return []
  }

  const gridStart = html.indexOf('grid grid-cols-3', labelIndex)
  if (gridStart < 0) {
    return []
  }

  const gridEndMarker = html.indexOf('mt-2.5', gridStart)
  const gridHtml = html.slice(gridStart, gridEndMarker > gridStart ? gridEndMarker : gridStart + 4_000)
  const slots: boolean[] = []
  const slotPattern = /class="([^"]*\bw-4 h-4 border border-gray-800 cursor-pointer\b[^"]*)"/g
  let match: RegExpExecArray | null

  while ((match = slotPattern.exec(gridHtml)) !== null && slots.length < 12) {
    slots.push(match[1].includes('bg-gray-800'))
  }

  return slots
}

export function findObjectLiteralEnd(source: string, objectStart: number): number {
  let depth = 0
  let inString = false
  let quote = ''
  let escaped = false

  for (let index = objectStart; index < source.length; index += 1) {
    const char = source[index]

    if (inString) {
      if (escaped) {
        escaped = false
        continue
      }

      if (char === '\\') {
        escaped = true
        continue
      }

      if (char === quote) {
        inString = false
        quote = ''
      }
      continue
    }

    if (char === '"' || char === '\'' || char === '`') {
      inString = true
      quote = char
      continue
    }

    if (char === '{') depth += 1
    if (char === '}') {
      depth -= 1
      if (depth === 0) {
        return index + 1
      }
    }
  }

  throw new Error('characterData object was not terminated.')
}

// ---------------------------------------------------------------------------
// Imported character data parsing helpers
// ---------------------------------------------------------------------------

interface ImportedAttributeValue {
  value?: unknown
  spellcasting?: unknown
}

interface ImportedCharacterJson extends ImportedCharacterData {
  name?: unknown
  level?: unknown
  profession?: unknown
  community?: unknown
  subclass?: unknown
  professionRef?: { name?: unknown }
  communityRef?: { name?: unknown }
  subclassRef?: { name?: unknown }
  ancestry1?: unknown
  ancestry2?: unknown
  ancestry1Ref?: { name?: unknown }
  ancestry2Ref?: { name?: unknown }
  evasion?: unknown
  agility?: ImportedAttributeValue
  strength?: ImportedAttributeValue
  finesse?: ImportedAttributeValue
  instinct?: ImportedAttributeValue
  presence?: ImportedAttributeValue
  knowledge?: ImportedAttributeValue
  hope?: unknown
  hopeMax?: unknown
  proficiency?: unknown
  hp?: unknown
  hpMax?: unknown
  stress?: unknown
  stressMax?: unknown
  armorBoxes?: unknown
  armorMax?: unknown
  gold?: unknown
  armorValue?: unknown
  minorThreshold?: unknown
  majorThreshold?: unknown
  primaryWeaponName?: unknown
  primaryWeaponTrait?: unknown
  primaryWeaponDamage?: unknown
  primaryWeaponFeature?: unknown
  secondaryWeaponName?: unknown
  secondaryWeaponTrait?: unknown
  secondaryWeaponDamage?: unknown
  secondaryWeaponFeature?: unknown
  armorName?: unknown
  armorBaseScore?: unknown
  armorThreshold?: unknown
  armorFeature?: unknown
  experience?: unknown
  experienceValues?: unknown
  characterBackground?: unknown
  characterAppearance?: unknown
  characterMotivation?: unknown
}

export function buildImportedExperiences(names: unknown, values: unknown) {
  const nameList = Array.isArray(names) ? names : []
  const valueList = Array.isArray(values) ? values : []

  return Array.from({ length: 5 }, (_, index) => ({
    name: getImportedText(nameList[index]),
    value: getImportedText(valueList[index]),
  }))
}

export function detectImportedPrimaryTrait(data: ImportedCharacterJson) {
  const entries: Array<[string, ImportedAttributeValue | undefined]> = [
    ['敏捷', data.agility],
    ['力量', data.strength],
    ['灵巧', data.finesse],
    ['本能', data.instinct],
    ['风度', data.presence],
    ['知识', data.knowledge],
  ]

  return entries.find(([, value]) => Boolean(value?.spellcasting))?.[0] ?? ''
}

export function getImportedRefName(refName: unknown, fallback: unknown) {
  return getImportedText(refName || fallback)
}

export function getImportedText(value: unknown, fallback = '') {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number') return String(value)
  return fallback
}

export function buildSheetFromImportedCharacterData(value: ImportedCharacterData, fileName: string): ResourceTrackerSheet {
  const data = value as ImportedCharacterJson
  const ancestryParts = [
    getImportedRefName(data.ancestry1Ref?.name, data.ancestry1),
    getImportedRefName(data.ancestry2Ref?.name, data.ancestry2),
  ].filter(Boolean)

  const profession = getImportedRefName(data.professionRef?.name, data.profession)
  const community = getImportedRefName(data.communityRef?.name, data.community)
  const subclass = getImportedRefName(data.subclassRef?.name, data.subclass)
  const primaryTrait = detectImportedPrimaryTrait(data)
  const summaryParts = [profession, ancestryParts.join('/'), community, subclass].filter(Boolean)

  return {
    file_name: cleanText(fileName, '角色卡.html', 120),
    character_name: getImportedText(data.name, '未命名角色'),
    summary_line: summaryParts.join(' / '),
    identity: {
      level: getImportedText(data.level),
      ancestry: ancestryParts.join(' / '),
      profession,
      community,
      subclass,
      primary_trait: primaryTrait,
    },
    stats: {
      evasion: getImportedText(data.evasion),
      armor_value: getImportedText(data.armorValue),
      minor_threshold: getImportedText(data.minorThreshold),
      major_threshold: getImportedText(data.majorThreshold),
      attributes: {
        agility: getImportedText(data.agility?.value),
        strength: getImportedText(data.strength?.value),
        finesse: getImportedText(data.finesse?.value),
        instinct: getImportedText(data.instinct?.value),
        presence: getImportedText(data.presence?.value),
        knowledge: getImportedText(data.knowledge?.value),
      },
    },
    resources: {
      hope: clamp(Math.round(finiteNumber(data.hope, 0)), 0, 12),
      hope_max: clamp(Math.round(finiteNumber(data.hopeMax, 6)), 0, 12),
      proficiency: normalizeBooleanTrack(data.proficiency, 6),
      hp: normalizeBooleanTrack(data.hp, clamp(Math.round(finiteNumber(data.hpMax, 7)), 0, 20)),
      hp_max: clamp(Math.round(finiteNumber(data.hpMax, 7)), 0, 20),
      stress: normalizeBooleanTrack(data.stress, clamp(Math.round(finiteNumber(data.stressMax, 6)), 0, 20)),
      stress_max: clamp(Math.round(finiteNumber(data.stressMax, 6)), 0, 20),
      armor_slots: normalizeBooleanTrack(data.armorBoxes, clamp(Math.round(finiteNumber(data.armorMax, 5)), 0, 12)),
      armor_max: clamp(Math.round(finiteNumber(data.armorMax, 5)), 0, 12),
      gold: normalizeBooleanTrack(data.gold, 21),
    },
    equipment: {
      armor_name: getImportedText(data.armorName),
      armor_base_score: getImportedText(data.armorBaseScore),
      armor_threshold: getImportedText(data.armorThreshold),
      armor_feature: getImportedText(data.armorFeature),
      primary_weapon_name: getImportedText(data.primaryWeaponName),
      primary_weapon_trait: getImportedText(data.primaryWeaponTrait),
      primary_weapon_damage: getImportedText(data.primaryWeaponDamage),
      primary_weapon_feature: getImportedText(data.primaryWeaponFeature),
      secondary_weapon_name: getImportedText(data.secondaryWeaponName),
      secondary_weapon_trait: getImportedText(data.secondaryWeaponTrait),
      secondary_weapon_damage: getImportedText(data.secondaryWeaponDamage),
      secondary_weapon_feature: getImportedText(data.secondaryWeaponFeature),
    },
    narrative: {
      background: getImportedText(data.characterBackground),
      appearance: getImportedText(data.characterAppearance),
      motivation: getImportedText(data.characterMotivation),
      notes: '',
      experiences: buildImportedExperiences(data.experience, data.experienceValues),
    },
  }
}

// ---------------------------------------------------------------------------
// GM Panel sheet entry factory
// ---------------------------------------------------------------------------

export function createGmSheetEntry(
  fileName: string,
  source: string | ImportedCharacterData,
  existingId = id('gm_sheet'),
  importedAt = new Date().toISOString(),
  updatedAt = new Date().toISOString(),
  htmlUpdatedAt = updatedAt,
): GmPanelCharacterSheetEntry {
  const safeHtml = typeof source === 'string'
    ? cleanText(sanitizeImportedHtml(source), '', 2_000_000)
    : undefined
  if (typeof source === 'string') {
    if (!safeHtml) {
      throw new Error(SRD_CHARACTER_SHEET_ERROR)
    }
    assertSrdCharacterSheetHtml(safeHtml)
  }
  const parsedSource = typeof source === 'string' ? extractCharacterDataFromHtml(safeHtml ?? '') : source
  const safeRaw = normalizeImportedCharacterData(parsedSource)
  const parsedSheet = normalizeResourceTrackerSheet(
    buildSheetFromImportedCharacterData(safeRaw, fileName),
    fileName,
  )
  if (safeHtml) {
    applyHtmlResourceTracksToSheet(safeHtml, parsedSheet)
  }
  const htmlArmorSlots = safeHtml ? extractArmorSlotsFromHtml(safeHtml) : []
  if (htmlArmorSlots.length > 0) {
    parsedSheet.resources.armor_max = htmlArmorSlots.length
    parsedSheet.resources.armor_slots = htmlArmorSlots
  }
  const compiledHtml = safeHtml ? compileGmSheetHtml(safeHtml, parsedSheet) : undefined

  return {
    id: existingId,
    imported_at: importedAt,
    updated_at: updatedAt,
    html_updated_at: htmlUpdatedAt,
    source_file_name: cleanText(fileName, '角色卡.html', 120),
    source_format: 'mydhcharsheet-html',
    source_html: safeHtml,
    compiled_html: compiledHtml,
    raw_character_data: safeRaw,
    parsed_sheet: parsedSheet,
  }
}

export function normalizeGmPanelState(value: GmPanelState | undefined): GmPanelState {
  if (!value) return createEmptyGmPanelState()

  return {
    cards_per_page: clamp(Math.round(finiteNumber(value.cards_per_page, 4)), 2, 4),
    fear: {
      value: clamp(Math.round(finiteNumber(value.fear?.value, 0)), 0, 12),
      max: 12,
    },
    countdowns: Array.isArray(value.countdowns)
      ? value.countdowns.map((countdown, index) => normalizeResourceTrackerCountdown(countdown, index))
      : [],
    sheets: Array.isArray(value.sheets)
      ? value.sheets.map((sheet) => createGmSheetEntry(
        cleanText(sheet.source_file_name, sheet.parsed_sheet?.file_name || '角色卡.html', 120),
        normalizeImportedCharacterData(sheet.raw_character_data),
        cleanText(sheet.id, id('gm_sheet'), 120),
        cleanText(sheet.imported_at, new Date().toISOString(), 80),
        cleanText(sheet.updated_at, sheet.imported_at || new Date().toISOString(), 80),
      ))
      : [],
    sheet_order: Array.isArray(value.sheet_order) ? value.sheet_order.filter((item) => typeof item === 'string') : [],
    activity_log: Array.isArray(value.activity_log)
      ? value.activity_log.slice(-200).map((item) => ({
        ...item,
        message: repairKnownGmLogMessage(item.message),
      }))
      : [],
  }
}

export function normalizeGmPanelStateWithHtml(value: GmPanelState | undefined): GmPanelState {
  const normalized = normalizeGmPanelState(value)
  if (!value?.sheets?.length) {
    return normalized
  }

  normalized.sheets = value.sheets.map((sheet, index) => {
    const fileName = cleanText(sheet.source_file_name, sheet.parsed_sheet?.file_name || 'character-sheet.html', 120)
    const entryId = cleanText(sheet.id, normalized.sheets[index]?.id || id('gm_sheet'), 120)
    const importedAt = cleanText(sheet.imported_at, normalized.sheets[index]?.imported_at || new Date().toISOString(), 80)
    const updatedAt = cleanText(sheet.updated_at, normalized.sheets[index]?.updated_at || importedAt, 80)
    const htmlUpdatedAt = cleanText(sheet.html_updated_at, updatedAt, 80)
    const sourceHtml = cleanText(sheet.source_html, '', 2_000_000)

    if (sourceHtml) {
      const entry = createGmSheetEntry(fileName, sourceHtml, entryId, importedAt, updatedAt, htmlUpdatedAt)
      if (sheet.parsed_sheet) {
        entry.parsed_sheet = normalizeResourceTrackerSheet(sheet.parsed_sheet, fileName)
        entry.compiled_html = compileGmSheetHtml(entry.source_html ?? sourceHtml, entry.parsed_sheet)
      }
      return entry
    }

    throw new Error(SRD_CHARACTER_SHEET_ERROR)
  })

  return normalized
}

// ---------------------------------------------------------------------------
// Mobile panel state factories and normalizers
// ---------------------------------------------------------------------------

export function createEmptyMobilePanelState(): MobilePanelState {
  return {
    fear: {
      value: 0,
      max: 12,
    },
    countdowns: [],
    characters: [],
    character_order: [],
    activity_log: [],
  }
}

export function normalizeMobilePanelCustom(
  displayName: unknown,
  experiences: MobilePanelExperience[] | undefined,
) {
  return {
    display_name: cleanText(displayName, '', 60),
    experiences: normalizeMobilePanelExperiences(experiences),
  }
}

export function normalizeMobilePanelExperiences(experiences: MobilePanelExperience[] | undefined): MobilePanelExperience[] {
  if (!Array.isArray(experiences)) {
    return []
  }

  return experiences
    .slice(0, 6)
    .map((experience) => ({
      id: cleanText(experience?.id, id('mobile_exp'), 120),
      name: cleanText(experience?.name, '', 40),
      value: cleanText(experience?.value, '', 10),
    }))
    .filter((experience) => experience.name || experience.value)
}

export function createEmptyMobilePanelTracker(decoded: MobilePanelCharacterEntry['decoded']): MobilePanelCharacterEntry['tracker'] {
  return {
    hopeCurrent: 0,
    stress: normalizeBooleanTrack([], decoded.resources.stressMax),
    hp: normalizeBooleanTrack([], decoded.resources.hpMax),
    armor_slots: normalizeBooleanTrack([], decoded.resources.armorMax),
    goldCurrent: decoded.resources.goldCurrent,
  }
}

export function normalizeMobilePanelTracker(
  tracker: Partial<MobilePanelCharacterEntry['tracker']> | undefined,
  decoded: MobilePanelCharacterEntry['decoded'],
): MobilePanelCharacterEntry['tracker'] {
  const fallback = createEmptyMobilePanelTracker(decoded)
  return {
    hopeCurrent: clamp(Math.round(finiteNumber(tracker?.hopeCurrent, fallback.hopeCurrent)), 0, decoded.resources.hopeMax),
    stress: normalizeBooleanTrack(tracker?.stress, decoded.resources.stressMax),
    hp: normalizeBooleanTrack(tracker?.hp, decoded.resources.hpMax),
    armor_slots: normalizeBooleanTrack(tracker?.armor_slots, decoded.resources.armorMax),
    goldCurrent: clamp(Math.round(finiteNumber(tracker?.goldCurrent, fallback.goldCurrent)), 0, 255),
  }
}

export function createMobilePanelCharacterEntry(
  code: string,
  displayName: string,
  experiences: MobilePanelExperience[],
  now = new Date().toISOString(),
): MobilePanelCharacterEntry {
  const cleanedCode = cleanText(code, '', 20_000)
  const decoded = decodeMobilePanelCharacterCode(cleanedCode)

  return {
    id: id('mobile_char'),
    source: {
      code: cleanedCode,
      version: decoded.version,
      imported_at: now,
      updated_at: now,
    },
    decoded,
    custom: normalizeMobilePanelCustom(displayName, experiences),
    tracker: createEmptyMobilePanelTracker(decoded),
  }
}

export function normalizeMobilePanelCharacterEntry(
  character: Partial<MobilePanelCharacterEntry> | undefined,
): MobilePanelCharacterEntry {
  const now = new Date().toISOString()
  const code = cleanText(character?.source?.code, '', 20_000)
  if (!code) {
    throw new Error('Mobile character code is required')
  }

  const decoded = decodeMobilePanelCharacterCode(code)

  return {
    id: cleanText(character?.id, id('mobile_char'), 120),
    source: {
      code,
      version: decoded.version,
      imported_at: cleanText(character?.source?.imported_at, now, 80),
      updated_at: cleanText(character?.source?.updated_at, character?.source?.imported_at || now, 80),
    },
    decoded,
    custom: normalizeMobilePanelCustom(character?.custom?.display_name, character?.custom?.experiences),
    tracker: normalizeMobilePanelTracker(character?.tracker, decoded),
  }
}

export function getMobilePanelCharacterLabel(entry: MobilePanelCharacterEntry): string {
  if (entry.custom.display_name) {
    return entry.custom.display_name
  }

  const parts = [
    entry.decoded.specialCards.profession?.title,
    entry.decoded.specialCards.subclass?.title,
    entry.decoded.specialCards.ancestry1?.title,
    entry.decoded.specialCards.ancestry2?.title,
    entry.decoded.specialCards.community?.title,
  ].filter(Boolean)

  return parts.length ? `${parts.join('-')}-LV${entry.decoded.level}` : `角色 LV${entry.decoded.level}`
}

export function normalizeMobilePanelState(value: MobilePanelState | undefined): MobilePanelState {
  if (!value) return createEmptyMobilePanelState()

  return {
    fear: {
      value: clamp(Math.round(finiteNumber(value.fear?.value, 0)), 0, 12),
      max: 12,
    },
    countdowns: Array.isArray(value.countdowns)
      ? value.countdowns.map((countdown, index) => normalizeResourceTrackerCountdown(countdown, index))
      : [],
    characters: Array.isArray(value.characters)
      ? value.characters.map((character) => normalizeMobilePanelCharacterEntry(character))
      : [],
    character_order: Array.isArray(value.character_order)
      ? value.character_order.filter((item) => typeof item === 'string')
      : [],
    activity_log: Array.isArray(value.activity_log) ? value.activity_log.slice(-200) : [],
  }
}

// ---------------------------------------------------------------------------
// Mobile panel resource value helpers
// ---------------------------------------------------------------------------

export function cloneMobilePanelResourceValue(value: number | boolean[]): number | boolean[] {
  return Array.isArray(value) ? [...value] : value
}

export function getMobilePanelResourceValue(
  entry: MobilePanelCharacterEntry,
  resourceKey: MobilePanelResourceKey,
): number | boolean[] {
  switch (resourceKey) {
    case 'hopeCurrent':
      return entry.tracker.hopeCurrent
    case 'stress':
      return [...entry.tracker.stress]
    case 'hp':
      return [...entry.tracker.hp]
    case 'armor_slots':
      return [...entry.tracker.armor_slots]
    case 'goldCurrent':
      return entry.tracker.goldCurrent
  }
}

export function setMobilePanelResourceValue(
  entry: MobilePanelCharacterEntry,
  resourceKey: MobilePanelResourceKey,
  nextValue: number | boolean[],
): void {
  switch (resourceKey) {
    case 'hopeCurrent':
      entry.tracker.hopeCurrent = nextValue as number
      return
    case 'stress':
      entry.tracker.stress = [...(nextValue as boolean[])]
      return
    case 'hp':
      entry.tracker.hp = [...(nextValue as boolean[])]
      return
    case 'armor_slots':
      entry.tracker.armor_slots = [...(nextValue as boolean[])]
      return
    case 'goldCurrent':
      entry.tracker.goldCurrent = nextValue as number
      return
  }
}

export function normalizeMobilePanelResourceValue(
  entry: MobilePanelCharacterEntry,
  resourceKey: MobilePanelResourceKey,
  nextValue: number | boolean[],
): number | boolean[] {
  switch (resourceKey) {
    case 'hopeCurrent':
      return clamp(Math.round(finiteNumber(nextValue, entry.tracker.hopeCurrent)), 0, entry.decoded.resources.hopeMax)
    case 'stress':
      return normalizeBooleanTrack(nextValue, entry.decoded.resources.stressMax)
    case 'hp':
      return normalizeBooleanTrack(nextValue, entry.decoded.resources.hpMax)
    case 'armor_slots':
      return normalizeBooleanTrack(nextValue, entry.decoded.resources.armorMax)
    case 'goldCurrent':
      return clamp(Math.round(finiteNumber(nextValue, entry.tracker.goldCurrent)), 0, 255)
  }
}

export function isMobilePanelResourceValueEqual(left: number | boolean[], right: number | boolean[]): boolean {
  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) return false
    return left.every((item, index) => item === right[index])
  }
  return left === right
}

export function getMobilePanelResourceLabel(resourceKey: MobilePanelResourceKey): string {
  switch (resourceKey) {
    case 'hopeCurrent':
      return '希望点'
    case 'stress':
      return '压力点'
    case 'hp':
      return '生命点'
    case 'armor_slots':
      return '护甲槽'
    case 'goldCurrent':
      return '金币'
  }
}

export function formatMobilePanelResourceValue(value: number | boolean[]): string {
  if (Array.isArray(value)) {
    return `${value.filter(Boolean).length}/${value.length}`
  }
  return String(value)
}
