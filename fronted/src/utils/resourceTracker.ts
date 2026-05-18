import type { ResourceTrackerSheet } from '@dhgc/shared'

interface ImportedAttributeValue {
  value?: unknown
  spellcasting?: unknown
}

interface ImportedCharacterJson {
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

export function buildTrackerSheetFromCharacterJson(value: unknown, fileName: string): ResourceTrackerSheet {
  if (!value || typeof value !== 'object') {
    throw new Error('角色卡 JSON 格式不正确')
  }

  const data = value as ImportedCharacterJson
  const ancestryParts = [
    getRefName(data.ancestry1Ref?.name, data.ancestry1),
    getRefName(data.ancestry2Ref?.name, data.ancestry2),
  ].filter(Boolean)

  const profession = getRefName(data.professionRef?.name, data.profession)
  const community = getRefName(data.communityRef?.name, data.community)
  const subclass = getRefName(data.subclassRef?.name, data.subclass)
  const primaryTrait = detectPrimaryTrait(data)
  const summaryParts = [profession, ancestryParts.join('/'), community, subclass].filter(Boolean)

  return {
    file_name: fileName,
    character_name: asText(data.name, '未命名角色'),
    summary_line: summaryParts.join(' / '),
    identity: {
      level: asText(data.level),
      ancestry: ancestryParts.join(' / '),
      profession,
      community,
      subclass,
      primary_trait: primaryTrait,
    },
    stats: {
      evasion: asText(data.evasion),
      armor_value: asText(data.armorValue),
      minor_threshold: asText(data.minorThreshold),
      major_threshold: asText(data.majorThreshold),
      attributes: {
        agility: asText(data.agility?.value),
        strength: asText(data.strength?.value),
        finesse: asText(data.finesse?.value),
        instinct: asText(data.instinct?.value),
        presence: asText(data.presence?.value),
        knowledge: asText(data.knowledge?.value),
      },
    },
    resources: {
      hope: clampNumber(data.hope, 0, 12, 0),
      hope_max: clampNumber(data.hopeMax, 0, 12, 6),
      proficiency: normalizeBooleanTrack(data.proficiency, 6),
      hp: normalizeBooleanTrack(data.hp, clampNumber(data.hpMax, 0, 20, 7)),
      hp_max: clampNumber(data.hpMax, 0, 20, 7),
      stress: normalizeBooleanTrack(data.stress, clampNumber(data.stressMax, 0, 20, 6)),
      stress_max: clampNumber(data.stressMax, 0, 20, 6),
      armor_slots: normalizeBooleanTrack(data.armorBoxes, clampNumber(data.armorMax, 0, 12, 5)),
      armor_max: clampNumber(data.armorMax, 0, 12, 5),
      gold: normalizeBooleanTrack(data.gold, 21),
    },
    equipment: {
      armor_name: asText(data.armorName),
      armor_base_score: asText(data.armorBaseScore),
      armor_threshold: asText(data.armorThreshold),
      armor_feature: asText(data.armorFeature),
      primary_weapon_name: asText(data.primaryWeaponName),
      primary_weapon_trait: asText(data.primaryWeaponTrait),
      primary_weapon_damage: asText(data.primaryWeaponDamage),
      primary_weapon_feature: asText(data.primaryWeaponFeature),
      secondary_weapon_name: asText(data.secondaryWeaponName),
      secondary_weapon_trait: asText(data.secondaryWeaponTrait),
      secondary_weapon_damage: asText(data.secondaryWeaponDamage),
      secondary_weapon_feature: asText(data.secondaryWeaponFeature),
    },
    narrative: {
      background: asText(data.characterBackground),
      appearance: asText(data.characterAppearance),
      motivation: asText(data.characterMotivation),
      notes: '',
      experiences: buildExperiences(data.experience, data.experienceValues),
    },
  }
}

export function cloneTrackerSheet(sheet: ResourceTrackerSheet): ResourceTrackerSheet {
  return structuredClone(sheet)
}

export function getTrackFilledCount(track: boolean[]) {
  return track.filter(Boolean).length
}

function buildExperiences(names: unknown, values: unknown) {
  const nameList = Array.isArray(names) ? names : []
  const valueList = Array.isArray(values) ? values : []

  return Array.from({ length: 5 }, (_, index) => ({
    name: asText(nameList[index]),
    value: asText(valueList[index]),
  }))
}

function detectPrimaryTrait(data: ImportedCharacterJson) {
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

function getRefName(refName: unknown, fallback: unknown) {
  return asText(refName || fallback)
}

function asText(value: unknown, fallback = '') {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number') return String(value)
  return fallback
}

function normalizeBooleanTrack(value: unknown, length: number) {
  const safeLength = Math.max(0, length)
  const source = Array.isArray(value) ? value : []
  return Array.from({ length: safeLength }, (_, index) => Boolean(source[index]))
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const numeric = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim()
      ? Number(value)
      : fallback

  if (!Number.isFinite(numeric)) return fallback
  return Math.min(max, Math.max(min, Math.round(numeric)))
}
