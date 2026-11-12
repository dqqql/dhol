import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { CharacterResources, CharacterSheetJson, CharacterSummary, DiceRollRecord, DiceRollRequest, TrackResource } from '@dhgc/shared/desktop'
import { RoomSync } from './state/room-sync'
import type { DesktopSession } from './desktop-api'
import { apiBase } from './desktop-api'
import CharacterPanelBoard from './components/character-panel/CharacterPanelBoard'
import { pageCount } from './components/character-panel/pagination'
import CharacterDetailDialog, { type DetailState } from './components/character-panel/CharacterDetailDialog'
import FearTracker from './components/FearTracker'
import CountdownTracker from './components/CountdownTracker'
import XCard from './components/XCard'
import DicePanel, { type DicePanelTab, type RoomLogItem } from './components/DicePanel'
import RoomToolbar from './components/RoomToolbar'
import BackupDialog from './components/BackupDialog'
import EnemyLibraryDialog from './combat/EnemyLibraryDialog'
import EnemyHandDock from './combat/EnemyHandDock'
import AimingArrowOverlay, { type Point2D } from './combat/AimingArrowOverlay'
import { formatSignedModifier, parseDamageFormula, parseEvasionValue } from './combat/damage-formula'
import {
  createHandCardFromTemplate,
  loadEnemyHand,
  loadEnemyLibrary,
  nextNumberedName,
  saveEnemyHand,
  saveEnemyLibrary,
} from './combat/enemy-storage'
import type { AttackRollAdvantage, CombatToastData, EnemyHandCard, EnemyTemplate, LightAbsorbFlight } from './combat/enemy-types'
import { clearRoomBrowserState, loadLegacyCountdowns } from './room-browser-state'
import { clearRoomOwnerKey, getRoomOwnerKey, saveRoomHistoryItem } from './room-history'
import './components/character-panel/character-panel.css'
import './combat/combat.css'

export default function DesktopRoom({ session, onLeave }: { session: DesktopSession; onLeave: () => void }) {
  const sync = useMemo(() => new RoomSync({
    roomId: session.roomId,
    actorId: session.playerId,
    websocketUrl: session.websocketUrl,
    storage: localStorage,
    client: { visibilityTarget: document }
  }), [session])

  const lifecycle = useRef(0)
  const dicePanelRef = useRef<HTMLElement>(null)
  const quickRollSequence = useRef(0)
  const legacyClocksQueued = useRef(false)
  const [diceTab, setDiceTab] = useState<DicePanelTab>('dual')
  const [detail, setDetail] = useState<{ character: CharacterSummary; state: DetailState } | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const ownerKey = getRoomOwnerKey(session.roomId)

  // 本地轻量化战斗系统状态
  const combatTriggerRef = useRef<HTMLButtonElement>(null)
  const combatTimersRef = useRef<number[]>([])
  const cardRectsRef = useRef(new Map<string, DOMRect>())
  const [combatDialogOpen, setCombatDialogOpen] = useState(false)
  const [enemyLibrary, setEnemyLibrary] = useState<EnemyTemplate[]>(() => loadEnemyLibrary(localStorage))
  const [enemyHand, setEnemyHand] = useState<EnemyHandCard[]>(() => loadEnemyHand(localStorage, session.roomId))
  const [handCollapsed, setHandCollapsed] = useState(false)
  const [selectedEnemyId, setSelectedEnemyId] = useState<string | null>(null)
  const [selectedTargetKey, setSelectedTargetKey] = useState<string | null>(null)
  const [attackAdvantage, setAttackAdvantage] = useState<AttackRollAdvantage>('normal')
  const [attacking, setAttacking] = useState(false)
  const [pointerInsideCard, setPointerInsideCard] = useState(true)
  const [pointerInActionBar, setPointerInActionBar] = useState(false)
  const [pointerPos, setPointerPos] = useState<Point2D | null>(null)
  const [hoveringTargetCard, setHoveringTargetCard] = useState(false)
  const [selectedCardAnchor, setSelectedCardAnchor] = useState<Point2D | null>(null)
  const [defeatingIds, setDefeatingIds] = useState<Set<string>>(() => new Set())
  const [flights, setFlights] = useState<LightAbsorbFlight[]>([])
  const [absorbingPulse, setAbsorbingPulse] = useState(false)
  const [combatToast, setCombatToast] = useState<CombatToastData | null>(null)

  useEffect(() => {
    setEnemyHand(loadEnemyHand(localStorage, session.roomId))
    setSelectedEnemyId(null)
    setSelectedTargetKey(null)
  }, [session.roomId])

  useEffect(() => {
    saveEnemyLibrary(localStorage, enemyLibrary)
  }, [enemyLibrary])

  useEffect(() => {
    saveEnemyHand(localStorage, session.roomId, enemyHand)
  }, [enemyHand, session.roomId])

  useEffect(() => {
    const timers = combatTimersRef.current
    return () => {
      for (const id of timers) window.clearTimeout(id)
    }
  }, [])

  // 房间流水记录持久化
  const roomLogStorageKey = `dhol-roomlog-${session.roomId}`
  const [roomLog, setRoomLog] = useState<RoomLogItem[]>(() => {
    try {
      const saved = localStorage.getItem(roomLogStorageKey)
      return saved ? JSON.parse(saved) as RoomLogItem[] : []
    } catch {
      return []
    }
  })

  const addRoomLog = useCallback((text: string, tag?: string) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setRoomLog(prev => {
      const next = [{ text, time, tag }, ...prev].slice(0, 50)
      try { localStorage.setItem(roomLogStorageKey, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [roomLogStorageKey])

  const handleClearRoomLog = () => {
    setRoomLog([])
    try { localStorage.removeItem(roomLogStorageKey) } catch { /* ignore */ }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const epoch = ++lifecycle.current
    sync.start()
    return () => {
      quickRollSequence.current += 1
      queueMicrotask(() => { if (lifecycle.current === epoch) sync.destroy() })
    }
  }, [sync])

  const subscribe = useCallback((listener: () => void) => sync.subscribe(listener), [sync])
  const state = useSyncExternalStore(subscribe, () => sync.getState())
  const ui = useSyncExternalStore(sync.ui.subscribe, sync.ui.getState)
  const room = state.room
  const ready = state.connection === 'ready'
  // The Pages frontend can deploy before the realtime Worker. Older snapshots
  // have no clocks field, so keep the room usable until the Worker is updated.
  const clocksSupported = Array.isArray(room?.clocks)
  const submit = (command: Parameters<RoomSync['submit']>[0]) => { try { sync.submit(command) } catch { /* status explains the failure */ } }

  useEffect(() => {
    if (!ready || !room || !clocksSupported || legacyClocksQueued.current) return
    const legacy = loadLegacyCountdowns(localStorage, session.roomId)
    if (!legacy.length) return
    try {
      let count = room.clocks.length
      const knownIds = new Set(room.clocks.map(clock => clock.id))
      for (const clock of legacy) {
        if (knownIds.has(clock.id) || count >= 20) continue
        sync.submit({ type: 'clock.create', id: clock.id, name: clock.name.trim(), max: clock.max, value: clock.value })
        count++
        knownIds.add(clock.id)
      }
      if (legacy.every(clock => knownIds.has(clock.id))) {
        legacyClocksQueued.current = true
        localStorage.removeItem(`dhol-countdowns-${session.roomId}`)
      }
    } catch { /* outbox retains queued operations; retry any remaining clocks on reconnect */ }
  }, [ready, room, clocksSupported, session.roomId, sync])

  useEffect(() => {
    if (room && ui.page >= pageCount(room.characters.length)) sync.ui.setPage(pageCount(room.characters.length) - 1)
  }, [room, ui.page, sync])

  useEffect(() => {
    if (room?.name && session.nickname && session.inviteCode) {
      saveRoomHistoryItem(session.nickname, session.inviteCode, room.name)
    }
  }, [room?.name, session.nickname, session.inviteCode])

  async function openDetail(character: CharacterSummary) {
    sync.ui.setDetail(character.name)
    setDetail({ character, state: { status: 'loading' } })
    try {
      const payload = await sync.detail(character.name, character.generation, async (name, generation) => {
        const response = await fetch(`${apiBase()}/api/v2/rooms/${session.inviteCode}/characters/${encodeURIComponent(name)}?generation=${generation}`, {
          headers: { Authorization: `Bearer ${session.token}` }
        })
        const result = await response.json() as { sheet?: CharacterSheetJson; resources?: CharacterResources; code?: string }
        if (!response.ok || !result.sheet || !result.resources) {
          throw new Error(result.code === 'CHARACTER_REPLACED' ? '角色已重新投递，请重新打开。' : '读取角色资料失败。')
        }
        return { sheet: result.sheet, resources: result.resources }
      }) as { sheet: CharacterSheetJson; resources: CharacterResources }
      setDetail(current => current?.character.name === character.name && current.character.generation === character.generation ? { character, state: { status: 'ready', ...payload } } : current)
    } catch (cause) {
      setDetail(current => current?.character.name === character.name && current.character.generation === character.generation ? { character, state: { status: 'error', message: cause instanceof Error ? cause.message : '读取角色资料失败。' } } : current)
    }
  }

  function closeDetail() { sync.ui.setDetail(null); setDetail(null) }

  useEffect(() => {
    if (!detail || !room) return
    const latest = room.characters.find(item => item.name === detail.character.name)
    if (latest && latest.generation !== detail.character.generation) void openDetail(latest)
    if (!latest) closeDetail()
  // The replacement generation is the only reason to reload the open sheet.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.characters, detail?.character.generation, detail?.character.name])

  function mark(character: CharacterSummary, resource: TrackResource, index: number, marked: boolean) {
    submit({ type: 'character.setMark', name: character.name, generation: character.generation, resource, index, marked })
    const label = resource === 'hp' ? '生命' : resource === 'stress' ? '压力' : resource === 'gold' ? '金币' : '护甲'
    addRoomLog(`${character.name} ${marked ? '标记' : '清除'}${label}${resource === 'gold' && index === 20 ? '箱' : `第 ${index + 1} 格`}`)
  }

  function remove(character: CharacterSummary) {
    submit({ type: 'character.delete', name: character.name, generation: character.generation })
    addRoomLog(`已移除角色【${character.name}】`)
  }

  const handleFearChange = (delta: 1 | -1) => {
    submit({ type: 'room.adjustFear', delta })
    addRoomLog(`恐惧点 ${room?.fear.value ?? 0} → ${(room?.fear.value ?? 0) + delta} (${delta > 0 ? '+1' : '-1'})`)
  }

  const handleHopeChange = (character: CharacterSummary, delta: 1 | -1) => {
    submit({ type: 'character.adjustHope', name: character.name, generation: character.generation, delta })
    addRoomLog(`${character.name} 希望点 ${character.resources.hope} → ${character.resources.hope + delta}`)
  }

  const handleXCardChange = (active: boolean) => {
    submit({ type: 'xcard.set', active })
    addRoomLog(active ? 'X卡已激活（战局暂停）' : 'X卡已解除')
  }

  async function quickRollStat(character: CharacterSummary, statName: string, statVal: string) {
    const modifier = Number(statVal)
    if (!ready || !Number.isFinite(modifier)) return

    const sequence = ++quickRollSequence.current
    setDiceTab('dual')
    await scrollToDicePanel(dicePanelRef.current)
    if (sequence !== quickRollSequence.current || sync.getState().connection !== 'ready') return

    submit({ type: 'dice.roll', payload: { mode: 'dual', modifier_mode: 'normal', repeat: 1, modifier, dice: [] } })
    addRoomLog(`${character.name} 掷${statName}（${modifier >= 0 ? '+' : ''}${modifier}）`)
  }

  async function exportBackup() {
    const response = await fetch(`${apiBase()}/api/v2/rooms/${session.inviteCode}/export`, { headers: { Authorization: `Bearer ${session.token}` } })
    if (!response.ok) throw new Error('无法导出房间备份。')
    const blob = await response.blob()
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `dhol-${session.inviteCode}-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  function leaveDeletedRoom() {
    try { clearRoomBrowserState(localStorage, session.roomId) } catch { /* storage may be unavailable */ }
    clearRoomOwnerKey(session.roomId)
    onLeave()
  }

  async function deleteRoom() {
    setDeleting(true)
    setDeleteError('')
    try {
      const response = await fetch(`${apiBase()}/api/v2/rooms/${session.inviteCode}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.token}`, ...(ownerKey ? { 'X-Room-Owner-Key': ownerKey } : {}) }
      })
      const result = await response.json() as { code?: string }
      if (!response.ok) {
        throw new Error('删除失败，房间数据尚未清除，请稍后重试。')
      }
      leaveDeletedRoom()
    } catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : '删除失败，房间数据尚未清除，请稍后重试。')
      setDeleting(false)
    }
  }

  useEffect(() => {
    if (state.connection === 'expired' && /deleted/i.test(state.reason ?? '')) leaveDeletedRoom()
  // Room deletion is terminal and should clear this browser's room data exactly once.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.connection, state.reason])

  const liveDetail = detail && room ? room.characters.find(item => item.name === detail.character.name && item.generation === detail.character.generation) : null
  const detailState = detail?.state.status === 'ready' && liveDetail ? { ...detail.state, resources: liveDetail.resources } : detail?.state

  // 战斗系统：当前选中的手牌 & 目标玩家角色
  const selectedEnemy = selectedEnemyId ? enemyHand.find(item => item.instanceId === selectedEnemyId) ?? null : null
  const targetingActive = Boolean(selectedEnemy && !handCollapsed)
  const selectedTargetCharacter = targetingActive && room && selectedTargetKey
    ? room.characters.find(c => `${c.name}:${c.generation}` === selectedTargetKey) ?? null
    : null

  const scheduleCombatTimer = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      combatTimersRef.current = combatTimersRef.current.filter(item => item !== id)
      fn()
    }, ms)
    combatTimersRef.current.push(id)
    return id
  }, [])

  // 瞄准状态下的全局鼠标位置与 Esc 取消
  useEffect(() => {
    if (!targetingActive) {
      setHoveringTargetCard(false)
      setPointerInActionBar(false)
      return
    }
    const onPointerMove = (event: PointerEvent) => {
      setPointerPos({ x: event.clientX, y: event.clientY })
      const targetEl = event.target instanceof Element ? event.target.closest('[data-target-card="true"]') : null
      const actionBarEl = event.target instanceof Element ? event.target.closest('.enemy-action-bar') : null
      setHoveringTargetCard(Boolean(targetEl))
      setPointerInActionBar(Boolean(actionBarEl))
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !attacking) {
        setSelectedEnemyId(null)
        setSelectedTargetKey(null)
      }
    }
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [targetingActive, attacking])

  function handleSaveEnemyTemplate(draft: Omit<EnemyTemplate, 'id' | 'createdAt'>, editingId: string | null, alsoAddToHand: boolean) {
    let savedTemplate: EnemyTemplate
    if (editingId) {
      savedTemplate = {
        ...draft,
        id: editingId,
        createdAt: enemyLibrary.find(item => item.id === editingId)?.createdAt ?? Date.now(),
      }
      setEnemyLibrary(prev => prev.map(item => (item.id === editingId ? savedTemplate : item)))
    } else {
      savedTemplate = {
        ...draft,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
      }
      setEnemyLibrary(prev => [savedTemplate, ...prev])
    }
    if (alsoAddToHand) {
      handleAddTemplateToHand(savedTemplate)
    }
  }

  function handleDuplicateEnemyTemplate(id: string) {
    setEnemyLibrary(prev => {
      const target = prev.find(item => item.id === id)
      if (!target) return prev
      const copy: EnemyTemplate = {
        ...target,
        id: crypto.randomUUID(),
        name: nextNumberedName(target.name, prev.map(item => item.name), true),
        createdAt: Date.now(),
      }
      const idx = prev.findIndex(item => item.id === id)
      const next = [...prev]
      next.splice(idx + 1, 0, copy)
      return next
    })
  }

  function handleDeleteEnemyTemplate(id: string) {
    setEnemyLibrary(prev => prev.filter(item => item.id !== id))
  }

  function handleAddTemplateToHand(template: EnemyTemplate) {
    setEnemyHand(prev => [...prev, createHandCardFromTemplate(template, prev.map(item => item.name))])
    setHandCollapsed(false)
  }

  const handleMeasureCardRect = useCallback((instanceId: string, rect: DOMRect | null) => {
    if (rect) cardRectsRef.current.set(instanceId, rect)
    else cardRectsRef.current.delete(instanceId)
  }, [])

  function triggerDefeatFlight(cardId: string) {
    const cardRect = cardRectsRef.current.get(cardId)
    const fromX = cardRect ? cardRect.left + cardRect.width / 2 : window.innerWidth / 2
    const fromY = cardRect ? cardRect.top + cardRect.height / 2 : window.innerHeight - 90

    const triggerRect = combatTriggerRef.current?.getBoundingClientRect()
    const toX = triggerRect ? triggerRect.left + triggerRect.width / 2 : 280
    let toY = triggerRect ? triggerRect.top + triggerRect.height / 2 : 24
    // 若页面已向下滚动使恐惧卡在视口上方，则光束飞向顶部边缘对应方位
    if (toY < 16) toY = 16
    if (toY > window.innerHeight - 16) toY = window.innerHeight - 16

    const flightId = crypto.randomUUID()
    setFlights(prev => [...prev, { id: flightId, fromX, fromY, toX, toY }])
    setEnemyHand(prev => prev.filter(item => item.instanceId !== cardId))
    setDefeatingIds(prev => {
      const next = new Set(prev)
      next.delete(cardId)
      return next
    })
    setSelectedEnemyId(curr => (curr === cardId ? null : curr))
    if (selectedEnemyId === cardId) setSelectedTargetKey(null)

    scheduleCombatTimer(() => {
      setFlights(prev => prev.filter(item => item.id !== flightId))
      setAbsorbingPulse(true)
      scheduleCombatTimer(() => setAbsorbingPulse(false), 550)
    }, 480)
  }

  function handleUpdateEnemyMark(instanceId: string, resource: 'hp' | 'stress', nextMarked: number) {
    let defeatedCardName: string | null = null
    let becameDefeated = false

    setEnemyHand(prev => prev.map(card => {
      if (card.instanceId !== instanceId) return card
      if (resource === 'hp') {
        const clamped = Math.max(0, Math.min(card.hpMax, nextMarked))
        if (clamped >= card.hpMax && !defeatingIds.has(instanceId)) {
          becameDefeated = true
          defeatedCardName = card.name
        }
        return { ...card, hpMarked: clamped }
      }
      const clamped = Math.max(0, Math.min(card.stressMax, nextMarked))
      return { ...card, stressMarked: clamped }
    }))

    if (becameDefeated) {
      if (defeatedCardName) addRoomLog(`${defeatedCardName} 生命耗尽，已击败`, '战斗')
      setDefeatingIds(prev => new Set(prev).add(instanceId))
      scheduleCombatTimer(() => triggerDefeatFlight(instanceId), 480)
    }
  }

  function handleRemoveHandCard(instanceId: string) {
    setEnemyHand(prev => prev.filter(item => item.instanceId !== instanceId))
    if (selectedEnemyId === instanceId) {
      setSelectedEnemyId(null)
      setSelectedTargetKey(null)
    }
  }

  function waitForServerDiceRecord(requestId: string, prevIds: Set<string>): Promise<DiceRollRecord> {
    return new Promise((resolve, reject) => {
      let settled = false
      const cleanup = () => {
        unsubscribe()
        window.clearTimeout(timeoutId)
      }
      const check = () => {
        if (settled) return
        const currentState = sync.getState()
        if (currentState.connection !== 'ready' || !currentState.room) {
          settled = true
          cleanup()
          reject(new Error('连接状态异常，掷骰已中断'))
          return
        }
        const stillPending = sync.pending().some(entry => entry.command.requestId === requestId)
        if (!stillPending) {
          const added = [...currentState.room.dice]
            .reverse()
            .find(record => !prevIds.has(record.id) && record.actor_player_id === session.playerId)
          if (added) {
            settled = true
            cleanup()
            resolve(added)
          }
        }
      }
      const unsubscribe = sync.subscribe(check)
      const timeoutId = window.setTimeout(() => {
        if (settled) return
        settled = true
        cleanup()
        reject(new Error('等待服务器返回掷骰结果超时'))
      }, 10000)
      check()
    })
  }

  function showToast(toast: CombatToastData) {
    setCombatToast(toast)
    scheduleCombatTimer(() => {
      setCombatToast(curr => (curr?.id === toast.id ? null : curr))
    }, 4500)
  }

  async function handleConfirmEnemyAttack() {
    if (!selectedEnemy || !selectedTargetCharacter || !ready || attacking) return

    const parsedDamage = parseDamageFormula(selectedEnemy.damageFormula)
    if (parsedDamage.kind === 'error') {
      sync.ui.setNotice(`【${selectedEnemy.name}】伤害公式无效：${parsedDamage.message}`)
      return
    }

    setAttacking(true)
    setDiceTab('standard')

    try {
      const prevHitIds = new Set((sync.getState().room?.dice ?? []).map(item => item.id))
      const hitRequestId = sync.submit({
        type: 'dice.roll',
        payload: {
          mode: 'standard',
          modifier_mode: attackAdvantage,
          repeat: 1,
          modifier: selectedEnemy.attackModifier,
          dice: [{ sides: 20, count: 1 }],
        },
      })

      const hitRecord = await waitForServerDiceRecord(hitRequestId, prevHitIds)
      const hitResult = hitRecord.results[0]
      const hitTotal = hitResult?.total ?? 0
      const naturalD20 = hitResult?.kept_primary ?? hitResult?.primary_rolls[0]
      const evasion = parseEvasionValue(selectedTargetCharacter.evasion)
      const isCrit = naturalD20 === 20
      const isHit = evasion === null ? true : hitTotal >= evasion

      const advSuffix = attackAdvantage === 'advantage' ? '(优势)' : attackAdvantage === 'disadvantage' ? '(劣势)' : ''
      const hitFormulaText = `1d20${advSuffix}[${naturalD20 ?? '?'}] ${formatSignedModifier(selectedEnemy.attackModifier)} = ${hitTotal}`

      if (evasion !== null && !isHit) {
        addRoomLog(`${selectedEnemy.name} 攻击 ${selectedTargetCharacter.name}：${hitFormulaText} < 闪避 ${evasion}（未命中）`, '战斗')
        showToast({
          id: crypto.randomUUID(),
          enemyName: selectedEnemy.name,
          targetName: selectedTargetCharacter.name,
          hitFormula: hitFormulaText,
          hitTotal,
          naturalD20,
          evasion,
          outcome: 'miss',
        })
        setSelectedEnemyId(null)
        setSelectedTargetKey(null)
        return
      }

      // 命中（或目标未填写闪避）：自动掷伤害骰或结算固定伤害
      let damageTotal = 0
      let damageDetail = ''
      if (parsedDamage.kind === 'flat') {
        damageTotal = parsedDamage.value
        damageDetail = `固定伤害 ${damageTotal}`
      } else {
        const prevDmgIds = new Set((sync.getState().room?.dice ?? []).map(item => item.id))
        const dmgRequestId = sync.submit({
          type: 'dice.roll',
          payload: {
            mode: 'standard',
            modifier_mode: 'normal',
            repeat: 1,
            modifier: parsedDamage.modifier,
            dice: parsedDamage.dice,
          },
        })
        const dmgRecord = await waitForServerDiceRecord(dmgRequestId, prevDmgIds)
        const dmgResult = dmgRecord.results[0]
        damageTotal = dmgResult?.total ?? 0
        const termsText = (dmgResult?.terms ?? []).map(t => `${t.notation}[${t.rolls.join(',')}]`).join(' + ')
        const modText = parsedDamage.modifier !== 0 ? ` ${parsedDamage.modifier > 0 ? '+' : '-'} ${Math.abs(parsedDamage.modifier)}` : ''
        damageDetail = `${termsText}${modText} = ${damageTotal}`
      }

      const outcome: CombatToastData['outcome'] = evasion === null ? 'unverified' : isCrit ? 'crit' : 'hit'
      const outcomeLabel = outcome === 'crit' ? '暴击命中' : outcome === 'hit' ? '命中' : '未填闪避·直接掷伤'
      addRoomLog(
        `${selectedEnemy.name} 攻击 ${selectedTargetCharacter.name}：${hitFormulaText}${evasion !== null ? ` ≥ 闪避 ${evasion}` : ''}（${outcomeLabel}）→ 伤害 ${damageDetail}`,
        '战斗'
      )

      showToast({
        id: crypto.randomUUID(),
        enemyName: selectedEnemy.name,
        targetName: selectedTargetCharacter.name,
        hitFormula: hitFormulaText,
        hitTotal,
        naturalD20,
        evasion,
        outcome,
        damageFormula: parsedDamage.normalized,
        damageTotal,
        damageDetail,
      })

      setSelectedEnemyId(null)
      setSelectedTargetKey(null)
    } catch (cause) {
      sync.ui.setNotice(cause instanceof Error ? cause.message : '自动攻击掷骰失败，请重试。')
    } finally {
      setAttacking(false)
    }
  }

  return <main className="desktop-app">
    {/* X卡全局暂停横幅 */}
    {room?.xCard.active && (
      <div className="xcard-alert-bar show">
        暂停中 · X卡已触发
      </div>
    )}

    {/* 攻击战报浮层 */}
    {combatToast && (
      <div className={`combat-toast is-${combatToast.outcome}`} role="status" aria-live="polite">
        <div className="combat-toast__body">
          <div className="combat-toast__title">
            {combatToast.enemyName} ➔ <b>{combatToast.targetName}</b>
            {combatToast.outcome === 'crit' && ' · 自然20暴击！'}
            {combatToast.outcome === 'hit' && ' · 命中！'}
            {combatToast.outcome === 'miss' && ' · 未命中'}
            {combatToast.outcome === 'unverified' && ' · 目标未填闪避'}
          </div>
          <div className="combat-toast__line">
            命中：{combatToast.hitFormula}
            {combatToast.evasion !== null ? ` vs 闪避 ${combatToast.evasion}` : ''}
          </div>
          {combatToast.damageDetail && (
            <div className="combat-toast__line">
              伤害：{combatToast.damageDetail}
            </div>
          )}
        </div>
        <button type="button" className="combat-toast__close" onClick={() => setCombatToast(null)}>关闭</button>
      </div>
    )}

    <RoomToolbar
      roomName={room?.name ?? '正在同步房间'}
      inviteCode={session.inviteCode}
      status={state.connection}
      activeCount={room?.members.filter(m => m.online).length}
      xCardNode={<XCard active={Boolean(room?.xCard.active)} ready={ready} onChange={handleXCardChange} />}
      onExport={() => sync.ui.setDialog('backup')}
      onLeave={onLeave}
      onDelete={room?.members[0]?.nickname === session.nickname && (ownerKey || room.members[0]?.id === session.playerId) ? () => { setDeleteError(''); setDeleteOpen(true) } : undefined}
    />

    <div className="desktop-workspace">
      {ui.notice && (
        <div className="notice" role="alert">
          <span>{ui.notice}</span>
          <button type="button" onClick={() => sync.ui.setNotice(null)}>知道了</button>
        </div>
      )}

      {state.connection === 'expired' && (
        <div className="expired-state" role="alert">
          <h2>房间或会话已过期</h2>
          <p>请返回首页重新加入。</p>
          <button className="button button--primary" onClick={onLeave}>返回首页</button>
        </div>
      )}

      {!room && state.connection !== 'expired' ? (
        <div className="loading-state" role="status">
          <span />
          <p>正在建立安全连接并同步房间…</p>
        </div>
      ) : room && (
        <div className="desktop-content">
          {/* 模块一：状态 (恐惧点 + 倒计时) */}
          <section className="section-block">
            <div className="section-head">
              <h2 className="section-title">状态</h2>
            </div>
            <div className="status-grid">
              <FearTracker
                value={room.fear.value}
                max={room.fear.max}
                ready={ready}
                onChange={handleFearChange}
                combatSlot={
                  <button
                    ref={combatTriggerRef}
                    type="button"
                    className={`btn-combat-entry ${absorbingPulse ? 'is-absorbing' : ''}`}
                    onClick={() => setCombatDialogOpen(true)}
                  >
                    <span className="btn-combat-entry__title">战斗</span>
                    <span className="btn-combat-entry__meta">手牌 {enemyHand.length} · 库 {enemyLibrary.length}</span>
                  </button>
                }
              />
              <CountdownTracker
                clocks={clocksSupported ? room.clocks : []}
                ready={ready && clocksSupported}
                onCreate={(name, max) => submit({ type: 'clock.create', id: crypto.randomUUID(), name, max })}
                onAdjust={(id, delta) => submit({ type: 'clock.adjust', id, delta })}
                onReset={id => submit({ type: 'clock.reset', id })}
                onDelete={id => submit({ type: 'clock.delete', id })}
                onLog={addRoomLog}
              />
              {!clocksSupported && <p role="status">房间服务尚未更新，倒计时暂不可用。</p>}
            </div>
          </section>

          {/* 模块二：玩家 (一行四卡) */}
          <CharacterPanelBoard
            roomId={session.roomId}
            characters={room.characters}
            page={ui.page}
            ready={ready}
            targetingActive={targetingActive}
            selectedTargetKey={selectedTargetKey}
            onSelectTarget={character => setSelectedTargetKey(`${character.name}:${character.generation}`)}
            onPage={sync.ui.setPage}
            onHope={handleHopeChange}
            onMark={mark}
            onDetail={character => void openDetail(character)}
            onDelete={remove}
            onAddIndicator={(character, name, value) => submit({ type: 'character.addIndicator', name: character.name, generation: character.generation, id: crypto.randomUUID(), indicatorName: name, value })}
            onAdjustIndicator={(character, id, delta) => submit({ type: 'character.adjustIndicator', name: character.name, generation: character.generation, id, delta })}
            onQuickRollStat={quickRollStat}
          />

          {/* 模块三：掷骰 (对称三栏：房间记录 + 掷骰操作 + 掷骰记录) */}
          <DicePanel
            ref={dicePanelRef}
            dice={room.dice}
            ready={ready}
            pending={sync.pending().some(entry => entry.command.type === 'dice.roll')}
            activeTab={diceTab}
            onActiveTabChange={setDiceTab}
            onRoll={(request: DiceRollRequest) => submit({ type: 'dice.roll', payload: request })}
            onClear={() => submit({ type: 'dice.clearHistory' })}
            roomLog={roomLog}
            onClearRoomLog={handleClearRoomLog}
          />
        </div>
      )}
    </div>

    {/* 底部敌人手牌 & 杀戮尖塔式瞄准箭头 */}
    {room && (
      <>
        <EnemyHandDock
          hand={enemyHand}
          selectedId={selectedEnemyId}
          defeatingIds={defeatingIds}
          targetCharacter={selectedTargetCharacter}
          advantage={attackAdvantage}
          attacking={attacking}
          ready={ready}
          collapsed={handCollapsed}
          onToggleCollapse={() => {
            setHandCollapsed(prev => !prev)
            setSelectedEnemyId(null)
            setSelectedTargetKey(null)
          }}
          onSelectCard={id => {
            setSelectedEnemyId(id)
            setSelectedTargetKey(null)
          }}
          onChangeAdvantage={setAttackAdvantage}
          onUpdateMark={handleUpdateEnemyMark}
          onRemoveCard={handleRemoveHandCard}
          onConfirmAttack={() => void handleConfirmEnemyAttack()}
          onCancel={() => {
            setSelectedEnemyId(null)
            setSelectedTargetKey(null)
          }}
          onPointerInsideSelectedChange={setPointerInsideCard}
          onSelectedAnchorChange={setSelectedCardAnchor}
          onMeasureCardRect={handleMeasureCardRect}
        />
        <AimingArrowOverlay
          from={targetingActive && !pointerInsideCard && !pointerInActionBar ? selectedCardAnchor : null}
          to={targetingActive && !pointerInsideCard && !pointerInActionBar ? pointerPos : null}
          hasTargetHover={hoveringTargetCard}
          flights={flights}
        />
      </>
    )}

    {combatDialogOpen && (
      <EnemyLibraryDialog
        library={enemyLibrary}
        handCount={enemyHand.length}
        onClose={() => setCombatDialogOpen(false)}
        onSaveTemplate={handleSaveEnemyTemplate}
        onDuplicateTemplate={handleDuplicateEnemyTemplate}
        onDeleteTemplate={handleDeleteEnemyTemplate}
        onAddToHand={handleAddTemplateToHand}
        onClearHand={() => {
          setEnemyHand([])
          setSelectedEnemyId(null)
          setSelectedTargetKey(null)
        }}
      />
    )}

    {detail && detailState && (
      <CharacterDetailDialog
        name={detail.character.name}
        state={detailState}
        ready={ready}
        onClose={closeDetail}
        onRetry={() => void openDetail(detail.character)}
        onGoldChange={(index, marked) => mark(detail.character, 'gold', index, marked)}
      />
    )}

    {ui.dialog === 'backup' && (
      <BackupDialog onClose={() => sync.ui.setDialog(null)} onExport={exportBackup} />
    )}

    {deleteOpen && (
      <div className="modal-overlay show" role="dialog" aria-modal="true" aria-labelledby="delete-room-title">
        <div className="modal-box modal-box--sm">
          <div className="modal-bar">
            <h2 id="delete-room-title">彻底删除房间</h2>
            <button type="button" disabled={deleting} onClick={() => setDeleteOpen(false)}>关闭</button>
          </div>
          <div className="modal-content delete-room-confirmation">
            <p>确定删除房间“{room?.name}”吗？</p>
            <p>角色卡、资源状态、掷骰记录及所有房间数据都会被永久删除，无法恢复。</p>
            {deleteError && <p className="delete-room-error" role="alert">{deleteError}</p>}
            <div className="delete-room-actions">
              <button type="button" disabled={deleting} onClick={() => setDeleteOpen(false)}>取消</button>
              <button type="button" className="btn-alert-confirm" disabled={deleting} onClick={() => void deleteRoom()}>
                {deleting ? '正在删除…' : '确认彻底删除'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
  </main>
}

function scrollToDicePanel(panel: HTMLElement | null): Promise<void> {
  if (!panel) return Promise.resolve()

  panel.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return new Promise(resolve => {
    const startedAt = performance.now()
    let previousTop = panel.getBoundingClientRect().top
    let stableFrames = 0
    let frame = 0

    const finish = () => {
      cancelAnimationFrame(frame)
      resolve()
    }

    const checkPosition = (now: number) => {
      const top = panel.getBoundingClientRect().top
      stableFrames = Math.abs(top - previousTop) < 1 ? stableFrames + 1 : 0
      previousTop = top

      if ((now - startedAt >= 120 && stableFrames >= 3) || now - startedAt >= 1200) {
        finish()
        return
      }
      frame = requestAnimationFrame(checkPosition)
    }

    frame = requestAnimationFrame(checkPosition)
  })
}
