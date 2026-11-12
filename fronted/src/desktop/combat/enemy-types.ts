import type { DiceModifierMode } from '@dhgc/shared/desktop'

export interface EnemyTemplate {
  id: string
  name: string
  hpMax: number
  stressMax: number
  majorThreshold: number
  severeThreshold: number
  difficulty: number
  attackModifier: number
  damageFormula: string
  createdAt: number
}

export interface EnemyHandCard {
  instanceId: string
  templateId: string
  name: string
  hpMax: number
  hpMarked: number
  stressMax: number
  stressMarked: number
  majorThreshold: number
  severeThreshold: number
  difficulty: number
  attackModifier: number
  damageFormula: string
}

export type AttackRollAdvantage = DiceModifierMode

export interface CombatToastData {
  id: string
  enemyName: string
  targetName: string
  hitFormula: string
  hitTotal: number
  naturalD20?: number
  evasion: number | null
  outcome: 'hit' | 'crit' | 'miss' | 'unverified'
  damageFormula?: string
  damageTotal?: number
  damageDetail?: string
}

export interface LightAbsorbFlight {
  id: string
  fromX: number
  fromY: number
  toX: number
  toY: number
}
