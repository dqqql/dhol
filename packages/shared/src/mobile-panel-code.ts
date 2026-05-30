import builtinCardPack from './data/builtin-base.json'
import type {
  MobilePanelCardEntry,
  MobilePanelDecodedCode,
  MobilePanelProfessionEntry,
} from './types'

const CHARACTER_CODE_PREFIX = 'dhc2_'
const CHARACTER_CODE_VERSION = 2
const UINT16_NULL = 0xffff
const MIN_CHARACTER_CODE_LENGTH = 41

type BuiltinCardPack = {
  profession?: Array<Record<string, unknown>>
  subclass?: Array<Record<string, unknown>>
  ancestry?: Array<Record<string, unknown>>
  community?: Array<Record<string, unknown>>
  domain?: Array<Record<string, unknown>>
}

const builtin = builtinCardPack as BuiltinCardPack

export const MOBILE_PANEL_PROTOCOL = {
  prefix: CHARACTER_CODE_PREFIX,
  version: CHARACTER_CODE_VERSION,
  minLength: MIN_CHARACTER_CODE_LENGTH,
} as const

export const MOBILE_PANEL_PROFESSION_DICT: MobilePanelProfessionEntry[] = (builtin.profession ?? []).map((raw) => ({
  id: cleanString(raw.id),
  title: cleanString(raw['名称']),
  text: cleanString(raw['职业特性']),
  hopeFeature: cleanString(raw['希望特性']),
}))

export const MOBILE_PANEL_SUBCLASS_DICT: MobilePanelCardEntry[] = (builtin.subclass ?? []).map((raw) => ({
  id: cleanString(raw.id),
  title: cleanString(raw['名称']),
  text: cleanString(raw['描述']),
}))

export const MOBILE_PANEL_ANCESTRY_DICT: MobilePanelCardEntry[] = (builtin.ancestry ?? []).map((raw) => ({
  id: cleanString(raw.id),
  title: cleanString(raw['名称']),
  text: cleanString(raw['效果']),
}))

export const MOBILE_PANEL_COMMUNITY_DICT: MobilePanelCardEntry[] = (builtin.community ?? []).map((raw) => ({
  id: cleanString(raw.id),
  title: cleanString(raw['名称']),
  text: cleanString(raw['描述']),
}))

export const MOBILE_PANEL_DOMAIN_DICT: MobilePanelCardEntry[] = (builtin.domain ?? []).map((raw) => ({
  id: cleanString(raw.id),
  title: cleanString(raw['名称']),
  text: cleanString(raw['描述']),
}))

export function decodeMobilePanelCharacterCode(code: string): MobilePanelDecodedCode {
  if (!code.startsWith(CHARACTER_CODE_PREFIX)) {
    throw new Error('角色码版本前缀无效。')
  }

  const body = code.slice(CHARACTER_CODE_PREFIX.length)
  if (!body) {
    throw new Error('角色码内容为空。')
  }

  const bytes = fromBase64Url(body)
  if (bytes.length < MIN_CHARACTER_CODE_LENGTH) {
    throw new Error('当前 dhol 仅支持 2026-05-30 后的新版 v2 角色码，请在车卡器重新导出后再导入。')
  }

  const payloadLength = bytes.length - 2
  assertChecksum(bytes, payloadLength)

  let offset = 0
  const version = bytes[offset++]
  if (version !== CHARACTER_CODE_VERSION) {
    throw new Error(`暂不支持的角色码版本: ${version}`)
  }

  const level = bytes[offset++]
  const proficiency = bytes[offset++]
  const evasion = readInt16(bytes, offset)
  offset += 2
  const armor = readInt16(bytes, offset)
  offset += 2
  const agility = readInt16(bytes, offset)
  offset += 2
  const strength = readInt16(bytes, offset)
  offset += 2
  const finesse = readInt16(bytes, offset)
  offset += 2
  const instinct = readInt16(bytes, offset)
  offset += 2
  const presence = readInt16(bytes, offset)
  offset += 2
  const knowledge = readInt16(bytes, offset)
  offset += 2
  const minor = readInt16(bytes, offset)
  offset += 2
  const major = readInt16(bytes, offset)
  offset += 2
  const hopeMax = bytes[offset++]
  const stressMax = bytes[offset++]
  const goldCurrent = bytes[offset++]
  const hpMax = bytes[offset++]
  const armorMax = bytes[offset++]
  const profession = readNullableUInt16(bytes, offset)
  offset += 2
  const subclass = readNullableUInt16(bytes, offset)
  offset += 2
  const ancestry1 = readNullableUInt16(bytes, offset)
  offset += 2
  const ancestry2 = readNullableUInt16(bytes, offset)
  offset += 2
  const community = readNullableUInt16(bytes, offset)
  offset += 2
  const domainCount = bytes[offset++]

  const remainingDomainBytes = payloadLength - offset
  if (remainingDomainBytes !== domainCount * 2) {
    throw new Error('角色码中的领域卡数据长度不正确。')
  }

  const domainCardIndices: number[] = []
  for (let index = 0; index < domainCount; index += 1) {
    const domainIndex = readUInt16(bytes, offset)
    offset += 2
    if (!MOBILE_PANEL_DOMAIN_DICT[domainIndex]) {
      throw new Error(`角色码中包含未知的领域卡索引: ${domainIndex}`)
    }
    domainCardIndices.push(domainIndex)
  }

  return {
    version: CHARACTER_CODE_VERSION,
    level,
    proficiency,
    evasion,
    armor,
    attributes: {
      agility,
      strength,
      finesse,
      instinct,
      presence,
      knowledge,
    },
    damageThresholds: {
      minor,
      major,
    },
    resources: {
      hopeMax,
      stressMax,
      goldCurrent,
      hpMax,
      armorMax,
    },
    specialCardIndices: {
      profession,
      subclass,
      ancestry1,
      ancestry2,
      community,
    },
    domainCardIndices,
    specialCards: {
      profession: decodeOptionalCardIndex(profession, MOBILE_PANEL_PROFESSION_DICT, '职业特性'),
      subclass: decodeOptionalCardIndex(subclass, MOBILE_PANEL_SUBCLASS_DICT, '子职业特性'),
      ancestry1: decodeOptionalCardIndex(ancestry1, MOBILE_PANEL_ANCESTRY_DICT, '种族特性'),
      ancestry2: decodeOptionalCardIndex(ancestry2, MOBILE_PANEL_ANCESTRY_DICT, '种族特性'),
      community: decodeOptionalCardIndex(community, MOBILE_PANEL_COMMUNITY_DICT, '社群特性'),
    },
    domains: domainCardIndices.map((index) => MOBILE_PANEL_DOMAIN_DICT[index]),
  }
}

function decodeOptionalCardIndex<T extends MobilePanelCardEntry>(
  index: number | null,
  dictionary: T[],
  label: string,
): T | undefined {
  if (index == null) {
    return undefined
  }

  const entry = dictionary[index]
  if (!entry) {
    throw new Error(`角色码中包含未知的${label}索引: ${index}`)
  }

  return entry
}

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4))
  const binary = atob(`${normalized}${padding}`)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

function assertChecksum(bytes: Uint8Array, payloadLength: number): void {
  const expected = readUInt16(bytes, payloadLength)
  const actual = calculateChecksum(bytes.subarray(0, payloadLength))

  if (expected !== actual) {
    throw new Error('角色码校验失败，可能已损坏或未完整复制。')
  }
}

function calculateChecksum(bytes: Uint8Array): number {
  let checksum = 0
  for (const byte of bytes) {
    checksum = (checksum + byte) & 0xffff
  }
  return checksum
}

function readUInt16(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8)
}

function readNullableUInt16(bytes: Uint8Array, offset: number): number | null {
  const value = readUInt16(bytes, offset)
  return value === UINT16_NULL ? null : value
}

function readInt16(bytes: Uint8Array, offset: number): number {
  const value = readUInt16(bytes, offset)
  return value > 0x7fff ? value - 0x10000 : value
}
