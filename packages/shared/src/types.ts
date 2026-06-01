export type DeckCardType = 'Location' | 'Feature' | 'Hook' | 'Custom'
export type CardType = DeckCardType | 'Role'
export type RoomMode = 'free' | 'co-creation' | 'normal'
export type RoomType = 'co-creation' | 'resource-tracker' | 'gm-panel' | 'mobile-panel'
export type ConnectionColor = 'red' | 'green' | 'gray'
export type RoomPackSource = 'built-in' | 'imported'
export type ResourceTrackerResourceKey = 'hope' | 'proficiency' | 'hp' | 'stress' | 'armor_slots' | 'gold'
export type GmPanelResourceKey = ResourceTrackerResourceKey
export type GmPanelTheme = 'gold-abyss' | 'jade-hex' | 'amethyst-ember'
export type MobilePanelResourceKey = 'hopeCurrent' | 'stress' | 'hp' | 'armor_slots' | 'goldCurrent'

export interface RoleCardDetails {
  player_name: string
  profession: string
  ancestry: string
  community: string
}

export interface DhCard {
  id: string
  type: CardType
  custom_type_name?: string
  title: string
  content: string
  style: string
  is_custom: boolean
  pack_id?: string
  role_details?: RoleCardDetails
}

export interface MapCard extends DhCard {
  x: number
  y: number
  width: number
  height: number
  grid_cols: number
  grid_rows: number
  grid_scale: number
  territory?: Rect
  placed_by: string
  placed_by_player_id: string
  player_color: string
  locked_by?: string
  locked_by_player_id?: string
  locked_until?: string
  is_expanded?: boolean
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface Connection {
  id: string
  from_card_id: string
  to_card_id: string
  color: ConnectionColor
  label?: string
}

export interface Annotation {
  id: string
  text: string
  x: number
  y: number
  font_size: number
}

export interface Player {
  id: string
  nickname: string
  color: string
  is_host: boolean
  is_online: boolean
  joined_at: string
  last_seen_at: string
}

export interface RoomPackCard {
  id: string
  type: DeckCardType
  custom_type_name?: string
  title: string
  content: string
  style: string
}

export interface RoomPackLibraryItem {
  id: string
  pack_name: string
  description?: string
  source: RoomPackSource
  cards: RoomPackCard[]
}

export interface RoomSettings {
  imports_enabled: boolean
  resource_change_requires_approval: boolean
  battle_panel_visibility: 'host-only' | 'shared'
  gm_panel_theme: GmPanelTheme
}

export interface ResourceTrackerExperience {
  name: string
  value: string
}

export interface ResourceTrackerAttributes {
  agility: string
  strength: string
  finesse: string
  instinct: string
  presence: string
  knowledge: string
}

export interface ResourceTrackerIdentity {
  level: string
  ancestry: string
  profession: string
  community: string
  subclass: string
  primary_trait: string
}

export interface ResourceTrackerStats {
  evasion: string
  armor_value: string
  minor_threshold: string
  major_threshold: string
  attributes: ResourceTrackerAttributes
}

export interface ResourceTrackerResources {
  hope: number
  hope_max: number
  proficiency: boolean[]
  hp: boolean[]
  hp_max: number
  stress: boolean[]
  stress_max: number
  armor_slots: boolean[]
  armor_max: number
  gold: boolean[]
}

export interface ResourceTrackerEquipment {
  armor_name: string
  armor_base_score: string
  armor_threshold: string
  armor_feature: string
  primary_weapon_name: string
  primary_weapon_trait: string
  primary_weapon_damage: string
  primary_weapon_feature: string
  secondary_weapon_name: string
  secondary_weapon_trait: string
  secondary_weapon_damage: string
  secondary_weapon_feature: string
}

export interface ResourceTrackerNarrative {
  background: string
  appearance: string
  motivation: string
  notes: string
  experiences: ResourceTrackerExperience[]
}

export interface ResourceTrackerSheet {
  file_name: string
  character_name: string
  summary_line: string
  identity: ResourceTrackerIdentity
  stats: ResourceTrackerStats
  resources: ResourceTrackerResources
  equipment: ResourceTrackerEquipment
  narrative: ResourceTrackerNarrative
}

export type ImportedCharacterData = Record<string, unknown>

export interface ResourceTrackerCharacterColumn {
  id: string
  owner_player_id: string
  imported_at: string
  updated_at: string
  sheet: ResourceTrackerSheet
}

export interface ResourceTrackerActivityLogItem {
  id: string
  created_at: string
  actor_player_id?: string
  actor_name: string
  kind: 'resource-change' | 'sheet-change' | 'system' | 'approval'
  message: string
}

export interface ResourceTrackerCountdown {
  id: string
  name: string
  value: number
  max: number
  created_at: string
  updated_at: string
}

export interface ResourceTrackerResourceChangeRequest {
  id: string
  column_id: string
  owner_player_id: string
  requested_by_player_id: string
  requested_by_name: string
  resource_key: ResourceTrackerResourceKey
  current_value: number | boolean[]
  next_value: number | boolean[]
  created_at: string
  status: 'pending' | 'approved' | 'rejected'
}

export interface ResourceTrackerState {
  fear: {
    value: number
    max: number
  }
  countdowns: ResourceTrackerCountdown[]
  columns: ResourceTrackerCharacterColumn[]
  column_order: string[]
  pending_resource_requests: ResourceTrackerResourceChangeRequest[]
  activity_log: ResourceTrackerActivityLogItem[]
}

export interface GmPanelCharacterSheetEntry {
  id: string
  imported_at: string
  updated_at: string
  html_updated_at: string
  source_file_name: string
  source_format: 'mydhcharsheet-html'
  source_html?: string
  compiled_html?: string
  raw_character_data: ImportedCharacterData
  parsed_sheet: ResourceTrackerSheet
}

export interface GmPanelActivityLogItem {
  id: string
  created_at: string
  actor_player_id?: string
  actor_name: string
  kind:
    | 'sheet-import'
    | 'sheet-replace'
    | 'sheet-delete'
    | 'sheet-change'
    | 'resource-change'
    | 'fear-change'
    | 'countdown-create'
    | 'countdown-update'
    | 'countdown-delete'
    | 'sheet-reorder'
    | 'system'
  message: string
}

export interface GmPanelState {
  cards_per_page: number
  fear: {
    value: number
    max: number
  }
  countdowns: ResourceTrackerCountdown[]
  sheets: GmPanelCharacterSheetEntry[]
  sheet_order: string[]
  activity_log: GmPanelActivityLogItem[]
}

export interface MobilePanelCardEntry {
  id: string
  title: string
  text: string
}

export interface MobilePanelProfessionEntry extends MobilePanelCardEntry {
  hopeFeature: string
}

export interface MobilePanelDecodedCode {
  version: 2 | 3
  level: number
  proficiency: number
  evasion: number
  armor: number
  attributes: {
    agility: number
    strength: number
    finesse: number
    instinct: number
    presence: number
    knowledge: number
  }
  damageThresholds: {
    minor: number
    major: number
  }
  resources: {
    hopeMax: number
    stressMax: number
    goldCurrent: number
    hpMax: number
    armorMax: number
  }
  specialCardIndices: {
    profession: number | null
    subclass: number | null
    ancestry1: number | null
    ancestry2: number | null
    community: number | null
  }
  domainCardIndices: number[]
  specialCards: {
    profession?: MobilePanelProfessionEntry
    subclass?: MobilePanelCardEntry
    ancestry1?: MobilePanelCardEntry
    ancestry2?: MobilePanelCardEntry
    community?: MobilePanelCardEntry
  }
  domains: MobilePanelCardEntry[]
}

export interface MobilePanelExperience {
  id: string
  name: string
  value: string
}

export interface MobilePanelCharacterCustom {
  display_name: string
  experiences: MobilePanelExperience[]
}

export interface MobilePanelCharacterTracker {
  hopeCurrent: number
  stress: boolean[]
  hp: boolean[]
  armor_slots: boolean[]
  goldCurrent: number
}

export interface MobilePanelCharacterSource {
  code: string
  version: 2 | 3
  imported_at: string
  updated_at: string
}

export interface MobilePanelCharacterEntry {
  id: string
  source: MobilePanelCharacterSource
  decoded: MobilePanelDecodedCode
  custom: MobilePanelCharacterCustom
  tracker: MobilePanelCharacterTracker
}

export interface MobilePanelActivityLogItem {
  id: string
  created_at: string
  actor_player_id?: string
  actor_name: string
  kind:
    | 'character-import'
    | 'character-replace'
    | 'character-update'
    | 'character-delete'
    | 'resource-change'
    | 'fear-change'
    | 'countdown-create'
    | 'countdown-update'
    | 'countdown-delete'
    | 'system'
  message: string
}

export interface MobilePanelState {
  fear: {
    value: number
    max: number
  }
  countdowns: ResourceTrackerCountdown[]
  characters: MobilePanelCharacterEntry[]
  character_order: string[]
  activity_log: MobilePanelActivityLogItem[]
}

export interface RoomState {
  room_type: RoomType
  room_id: string
  room_name: string
  invite_code: string
  created_at: string
  expires_at: string
  mode: RoomMode
  host_player_id: string
  current_turn_player_id: string | null
  turn_order: string[]
  players: Player[]
  hands: Record<string, DhCard[]>
  deck: DhCard[]
  map_cards: MapCard[]
  connections: Connection[]
  annotations: Annotation[]
  imported_pack_library: RoomPackLibraryItem[]
  settings: RoomSettings
  selected_built_in_pack_ids: string[]
  drawn_this_turn: Record<string, boolean>
  resource_tracker?: ResourceTrackerState
  gm_panel?: GmPanelState
  mobile_panel?: MobilePanelState
  snapshot_version: number
  updated_at: string
}

export interface DhPack {
  format: 'dhpack'
  version: 1
  id?: string
  pack_name: string
  description?: string
  cards: Array<{
    id?: string
    type: DeckCardType
    custom_type_name?: string
    title: string
    content: string
    style: string
  }>
}

export interface DhRoomBackup {
  format: 'dhroom'
  version: 1
  room: {
    id: string
    name: string
    room_type?: RoomType
    invite_code: string
    created_at: string
    expires_at: string
  }
  session: {
    mode: RoomMode
    current_host: string
    current_turn_player: string | null
    turn_order: string[]
    deck: DhCard[]
    hands: Array<{ owner: string; cards: DhCard[] }>
  }
  map: {
    cards: MapCard[]
    connections: Connection[]
    annotations: Annotation[]
  }
  library: {
    imported_packs: RoomPackLibraryItem[]
    selected_built_in_pack_ids: string[]
    packs?: RoomPackLibraryItem[]
    selected_pack_ids?: string[]
  }
  settings: RoomSettings
  resource_tracker?: ResourceTrackerState
  gm_panel?: GmPanelState
  mobile_panel?: MobilePanelState
  players: Array<Pick<Player, 'id' | 'nickname' | 'color' | 'is_host' | 'is_online'>>
  exported_at: string
}

export interface RoomSession {
  room_id: string
  invite_code: string
  player_id: string
  nickname: string
  token: string
  websocket_url: string
}
