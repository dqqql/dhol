import {
  assertDhPack,
  assertDhRoomBackup,
  createPackLibrary,
  createDeckFromBuiltInPackIds,
  createRoomPackLibraryItemFromPack,
  getCardGridSize,
  isBuiltInPackId,
  normalizeCardType,
  normalizeCardDimensions,
  normalizeBuiltInPackSelection,
  normalizeImportedPackLibrary,
  normalizeTerritoryRect,
  safeJsonParse,
  snapToGrid,
  type CardType,
  type ClientMessage,
  type DeckCardType,
  type DhCard,
  type DhPack,
  type DhRoomBackup,
  type GmPanelActivityLogItem,
  type GmPanelCharacterSheetEntry,
  type GmPanelResourceKey,
  type GmPanelState,
  type ImportedCharacterData,
  type MapCard,
  type Player,
  type ResourceTrackerActivityLogItem,
  type ResourceTrackerCharacterColumn,
  type ResourceTrackerCountdown,
  type ResourceTrackerResourceChangeRequest,
  type ResourceTrackerResourceKey,
  type ResourceTrackerSheet,
  type ResourceTrackerState,
  type RoleCardDetails,
  type RoomPackLibraryItem,
  type RoomState,
  type RoomType,
} from '../../../packages/shared/src/index'

export interface Env {
  ROOMS: DurableObjectNamespace
  DHGC_DB?: D1Database
  SESSION_SECRET: string
  PUBLIC_API_BASE?: string
}

type MapCardUpdateInput = Omit<Partial<MapCard>, 'territory'> & {
  territory?: MapCard['territory'] | null
}

interface SessionPayload {
  room_id: string
  invite_code: string
  player_id: string
  nickname: string
  exp: number
}

interface SocketSession {
  playerId: string
  nickname: string
}

const PLAYER_COLORS = ['#f43f5e', '#2563eb', '#f59e0b', '#10b981', '#a855f7', '#06b6d4']
const ROOM_TTL_MS = 3 * 24 * 60 * 60 * 1000
const DRAW_TYPES: DeckCardType[] = ['Location', 'Feature', 'Hook']
const STARTING_CARDS_PER_TYPE = 2
const GM_SHEET_HTML_STORAGE_KEY_PREFIX = 'gm_sheet_html:'
const GM_SHEET_COMPILED_HTML_STORAGE_KEY_PREFIX = 'gm_sheet_compiled_html:'

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return emptyCors()

    const url = new URL(request.url)
    try {
      if (url.pathname === '/api/health') {
        return json({ ok: true, service: 'dhgc-realtime', time: new Date().toISOString() })
      }

      if (url.pathname === '/api/rooms' && request.method === 'POST') {
        return createRoom(request, env)
      }

      if (url.pathname === '/api/rooms/join' && request.method === 'POST') {
        return joinRoom(request, env)
      }

      const exportMatch = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]{6})\/export\/dhroom$/i)
      if (exportMatch && request.method === 'GET') {
        const inviteCode = normaliseInvite(exportMatch[1])
        const stub = roomStub(env, inviteCode)
        const response = await stub.fetch(internalRequest('/internal/export/dhroom'))
        return withCors(response)
      }

      const sheetHtmlMatch = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]{6})\/sheets\/([^/]+)\/html$/i)
      if (sheetHtmlMatch && request.method === 'GET') {
        const inviteCode = normaliseInvite(sheetHtmlMatch[1])
        const sheetId = decodeURIComponent(sheetHtmlMatch[2])
        const stub = roomStub(env, inviteCode)
        const response = await stub.fetch(internalRequest(`/internal/sheets/${encodeURIComponent(sheetId)}/html`))
        return withCors(response)
      }

      const wsMatch = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]{6})\/ws$/i)
      if (wsMatch && request.headers.get('Upgrade') === 'websocket') {
        const inviteCode = normaliseInvite(wsMatch[1])
        const stub = roomStub(env, inviteCode)
        return stub.fetch(request)
      }

      return json({ error: 'not_found' }, { status: 404 })
    } catch (error) {
      return json({ error: 'internal_error', message: messageFrom(error) }, { status: 500 })
    }
  },
}

async function createRoom(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as {
    room_name?: string
    nickname?: string
    room_type?: RoomType
    selected_built_in_pack_ids?: string[]
    selected_pack_ids?: string[]
  }
  const roomName = cleanText(body.room_name, 'Untitled Room', 60)
  const nickname = cleanText(body.nickname, '', 24)
  const roomType = normalizeRoomType(body.room_type)
  if (!nickname) return json({ error: 'nickname_required' }, { status: 400 })

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const inviteCode = generateInviteCode()
    const playerId = id('player')
    const stub = roomStub(env, inviteCode)
    const createResponse = await stub.fetch(internalRequest('/internal/create', {
      method: 'POST',
      body: JSON.stringify({
        roomName,
        inviteCode,
        playerId,
        nickname,
        roomType,
        selectedPackIds: body.selected_built_in_pack_ids ?? body.selected_pack_ids ?? [],
      }),
    }))

    if (createResponse.status === 409) continue
    if (!createResponse.ok) return withCors(createResponse)

    const payload = await createResponse.json() as { state: RoomState; player: Player }
    return roomSessionResponse(request, env, payload.state, payload.player)
  }

  return json({ error: 'invite_collision' }, { status: 500 })
}

async function joinRoom(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as { invite_code?: string; nickname?: string }
  const inviteCode = normaliseInvite(body.invite_code ?? '')
  const nickname = cleanText(body.nickname, '', 24)
  if (!inviteCode) return json({ error: 'invite_code_required' }, { status: 400 })
  if (!nickname) return json({ error: 'nickname_required' }, { status: 400 })

  const stub = roomStub(env, inviteCode)
  const joinResponse = await stub.fetch(internalRequest('/internal/join', {
    method: 'POST',
    body: JSON.stringify({ nickname, playerId: id('player') }),
  }))
  if (!joinResponse.ok) return withCors(joinResponse)

  const payload = await joinResponse.json() as { state: RoomState; player: Player }
  return roomSessionResponse(request, env, payload.state, payload.player)
}

async function roomSessionResponse(request: Request, env: Env, state: RoomState, player: Player): Promise<Response> {
  const token = await signSession(getSessionSecret(env), {
    room_id: state.room_id,
    invite_code: state.invite_code,
    player_id: player.id,
    nickname: player.nickname,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
  })

  return json({
    session: {
      room_id: state.room_id,
      invite_code: state.invite_code,
      player_id: player.id,
      nickname: player.nickname,
      token,
      websocket_url: buildWebSocketUrl(request, env, state.invite_code, token),
    },
    state,
  })
}

export class RoomDurableObject {
  private room: RoomState | null = null
  private sockets = new Map<WebSocket, SocketSession>()
  private pendingDraws = new Map<string, DhCard[]>()

  constructor(private readonly ctx: DurableObjectState, private readonly env: Env) {}

  async fetch(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url)

      if (url.pathname === '/internal/create' && request.method === 'POST') return this.create(request)
      if (url.pathname === '/internal/join' && request.method === 'POST') return this.join(request)
      if (url.pathname === '/internal/export/dhroom' && request.method === 'GET') return this.exportDhRoom()
      if (url.pathname.match(/^\/internal\/sheets\/[^/]+\/html$/) && request.method === 'GET') return this.exportSheetHtml(url)

      if (request.headers.get('Upgrade') === 'websocket') return this.connectWebSocket(request)

      return json({ error: 'not_found' }, { status: 404 })
    } catch (error) {
      if (error instanceof HttpError) {
        return json({ error: error.message }, { status: error.status })
      }

      return json({ error: 'internal_error', message: messageFrom(error) }, { status: 500 })
    }
  }

  async alarm(): Promise<void> {
    const room = await this.load()
    if (!room) {
      await this.ctx.storage.deleteAlarm()
      return
    }

    if (this.isExpired(room)) {
      await this.purgeRoom('expired')
      return
    }

    await this.scheduleExpiryAlarm(room)
  }

  private async create(request: Request): Promise<Response> {
    await this.load()
    if (this.room) {
      if (this.isExpired(this.room)) {
        await this.purgeRoom('expired')
      } else {
        return json({ error: 'room_exists' }, { status: 409 })
      }
    }

    const body = await request.json() as {
      roomName: string
      inviteCode: string
      playerId: string
      nickname: string
      roomType?: RoomType
      selectedPackIds: string[]
    }

    const now = new Date()
    const host = makePlayer(body.playerId, body.nickname, PLAYER_COLORS[0], true, now)
    const roomType = normalizeRoomType(body.roomType)
    const selectedPackIds = roomType !== 'co-creation'
      ? []
      : normalizeBuiltInPackSelection(body.selectedPackIds, true)
    const deck = roomType !== 'co-creation'
      ? []
      : shuffle(createDeckFromBuiltInPackIds(selectedPackIds))

    this.room = {
      room_type: roomType,
      room_id: body.inviteCode,
      room_name: body.roomName,
      invite_code: body.inviteCode,
      created_at: now.toISOString(),
      expires_at: new Date(now.getTime() + ROOM_TTL_MS).toISOString(),
      mode: 'free',
      host_player_id: host.id,
      current_turn_player_id: null,
      turn_order: [host.id],
      players: [host],
      hands: { [host.id]: [] },
      deck,
      map_cards: [],
      connections: [],
      annotations: [],
      imported_pack_library: [],
      settings: {
        imports_enabled: true,
        resource_change_requires_approval: false,
        battle_panel_visibility: 'shared',
      },
      selected_built_in_pack_ids: selectedPackIds,
      drawn_this_turn: {},
      resource_tracker: roomType === 'resource-tracker' ? createEmptyResourceTrackerState() : undefined,
      gm_panel: roomType === 'gm-panel' ? createEmptyGmPanelState() : undefined,
      snapshot_version: 0,
      updated_at: now.toISOString(),
    }

    await this.save()
    await this.scheduleExpiryAlarm(this.requireRoom())
    return json({ state: this.publicState(), player: host })
  }

  private async join(request: Request): Promise<Response> {
    const room = await this.mustLoad()
    if (Date.parse(room.expires_at) <= Date.now()) {
      return json({ error: 'room_expired' }, { status: 410 })
    }

    const body = await request.json() as { nickname: string; playerId: string }
    const now = new Date()
    const nickname = cleanText(body.nickname, 'Player', 24)
    const existingPlayer = room.players
      .filter((player) => player.nickname === nickname)
      .sort((left, right) => {
        const leftSeen = Date.parse(left.last_seen_at || left.joined_at)
        const rightSeen = Date.parse(right.last_seen_at || right.joined_at)
        return rightSeen - leftSeen
      })[0]

    if (existingPlayer) {
      existingPlayer.is_online = true
      existingPlayer.last_seen_at = now.toISOString()
      await this.commit('player.rejoined')
      return json({ state: this.publicState(), player: existingPlayer })
    }

    const color = PLAYER_COLORS[room.players.length % PLAYER_COLORS.length]
    const player = makePlayer(body.playerId, nickname, color, false, now)

    room.players.push(player)
    room.turn_order.push(player.id)
    room.hands[player.id] = []
    await this.commit('player.joined')

    return json({ state: this.publicState(), player })
  }

  private async connectWebSocket(request: Request): Promise<Response> {
    const room = await this.mustLoad()
    const url = new URL(request.url)
    const token = url.searchParams.get('token') ?? ''
    const session = await verifySession(getSessionSecret(this.env), token)
    if (!session || session.invite_code !== room.invite_code) {
      return new Response('Invalid session token', { status: 401 })
    }

    const player = room.players.find(item => item.id === session.player_id)
    if (!player) return new Response('Unknown player', { status: 403 })

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket]
    server.accept()

    this.sockets.set(server, { playerId: player.id, nickname: player.nickname })
    player.is_online = true
    player.last_seen_at = new Date().toISOString()
    room.updated_at = new Date().toISOString()
    room.snapshot_version += 1
    await this.save()

    server.send(JSON.stringify({
      type: 'room.snapshot',
      payload: { state: this.publicState(), you: { player_id: player.id } },
    }))
    this.broadcast({ type: 'room.updated', payload: { state: this.publicState(), reason: 'player.online' } })

    server.addEventListener('message', event => {
      void this.handleMessage(server, event.data).catch(error => {
        this.sendError(server, undefined, 'handler_error', messageFrom(error))
      })
    })

    server.addEventListener('close', () => {
      void this.disconnect(server)
    })

    server.addEventListener('error', () => {
      void this.disconnect(server)
    })

    return new Response(null, { status: 101, webSocket: client })
  }

  private async handleMessage(socket: WebSocket, data: string | ArrayBuffer): Promise<void> {
    const session = this.sockets.get(socket)
    if (!session) return
    const message = typeof data === 'string' ? safeJsonParse(data) as ClientMessage : null
    if (!message || typeof message.type !== 'string') {
      this.sendError(socket, undefined, 'invalid_message', 'Message must be JSON with a type')
      return
    }

    try {
      await this.applyMessage(session, message, socket)
      if (message.requestId) this.send(socket, { type: 'ack', requestId: message.requestId, payload: { ok: true } })
    } catch (error) {
      this.sendError(socket, message.requestId, 'rejected', messageFrom(error))
    }
  }

  private async applyMessage(session: SocketSession, message: ClientMessage, socket: WebSocket): Promise<void> {
    const room = await this.mustLoad()
    const player = this.requirePlayer(session.playerId)

    switch (message.type) {
      case 'ping':
        this.send(socket, { type: 'pong', requestId: message.requestId, payload: { server_time: new Date().toISOString() } })
        return

      case 'room.startCoCreation':
        this.startCoCreation()
        await this.commit('room.startCoCreation')
        return

      case 'room.endCoCreation':
        this.endCoCreation()
        await this.commit('room.endCoCreation')
        return

      case 'room.updateSelectedPacks':
        this.updateSelectedPacks(message.payload.selectedPackIds)
        await this.commit('room.updateSelectedPacks')
        return

      case 'room.updateSettings':
        this.updateSettings(message.payload)
        await this.commit('room.updateSettings')
        return

      case 'tracker.importCharacter':
        this.requireResourceTrackerRoom()
        this.importTrackerCharacter(player, message.payload.fileName, message.payload.sheet)
        await this.commit('tracker.importCharacter')
        return

      case 'tracker.updateSheet':
        this.requireResourceTrackerRoom()
        this.updateTrackerSheet(player, message.payload.columnId, message.payload.sheet)
        await this.commit('tracker.updateSheet')
        return

      case 'tracker.updateResource':
        this.requireResourceTrackerRoom()
        this.updateTrackerResource(player, message.payload.columnId, message.payload.resourceKey, message.payload.nextValue)
        await this.commit('tracker.updateResource')
        return

      case 'tracker.updateFear':
        this.requireResourceTrackerRoom()
        this.updateTrackerFear(player, message.payload.value)
        await this.commit('tracker.updateFear')
        return

      case 'tracker.createCountdown':
        this.requireResourceTrackerRoom()
        this.createTrackerCountdown(player, message.payload.name, message.payload.max)
        await this.commit('tracker.createCountdown')
        return

      case 'tracker.updateCountdown':
        this.requireResourceTrackerRoom()
        this.updateTrackerCountdown(player, message.payload.countdownId, message.payload.value)
        await this.commit('tracker.updateCountdown')
        return

      case 'tracker.deleteCountdown':
        this.requireResourceTrackerRoom()
        this.deleteTrackerCountdown(player, message.payload.countdownId)
        await this.commit('tracker.deleteCountdown')
        return

      case 'tracker.moveColumn':
        this.requireResourceTrackerRoom()
        this.moveTrackerColumn(player, message.payload.columnId, message.payload.direction)
        await this.commit('tracker.moveColumn')
        return

      case 'tracker.approveResourceChange':
        this.requireResourceTrackerRoom()
        this.resolveTrackerRequest(player, message.payload.requestIdToResolve, true)
        await this.commit('tracker.approveResourceChange')
        return

      case 'tracker.rejectResourceChange':
        this.requireResourceTrackerRoom()
        this.resolveTrackerRequest(player, message.payload.requestIdToResolve, false)
        await this.commit('tracker.rejectResourceChange')
        return

      case 'gm.importHtmlCharacter':
        this.requireGmPanelRoom()
        this.importGmCharacter(player, message.payload.fileName, message.payload.html)
        await this.commit('gm.importHtmlCharacter')
        return

      case 'gm.replaceHtmlCharacter':
        this.requireGmPanelRoom()
        this.replaceGmCharacter(player, message.payload.sheetId, message.payload.fileName, message.payload.html)
        await this.commit('gm.replaceHtmlCharacter')
        return

      case 'gm.deleteSheet':
        this.requireGmPanelRoom()
        this.deleteGmSheet(player, message.payload.sheetId)
        await this.commit('gm.deleteSheet')
        return

      case 'gm.updateSheet':
        this.requireGmPanelRoom()
        this.updateGmSheet(player, message.payload.sheetId, message.payload.sheet)
        await this.commit('gm.updateSheet')
        return

      case 'gm.updateResource':
        this.requireGmPanelRoom()
        this.updateGmResource(player, message.payload.sheetId, message.payload.resourceKey, message.payload.nextValue)
        await this.commit('gm.updateResource')
        return

      case 'gm.updateFear':
        this.requireGmPanelRoom()
        this.updateGmFear(player, message.payload.value)
        await this.commit('gm.updateFear')
        return

      case 'gm.createCountdown':
        this.requireGmPanelRoom()
        this.createGmCountdown(player, message.payload.name, message.payload.max)
        await this.commit('gm.createCountdown')
        return

      case 'gm.updateCountdown':
        this.requireGmPanelRoom()
        this.updateGmCountdown(player, message.payload.countdownId, message.payload.value)
        await this.commit('gm.updateCountdown')
        return

      case 'gm.deleteCountdown':
        this.requireGmPanelRoom()
        this.deleteGmCountdown(player, message.payload.countdownId)
        await this.commit('gm.deleteCountdown')
        return

      case 'gm.moveSheet':
        this.requireGmPanelRoom()
        this.moveGmSheet(player, message.payload.sheetId, message.payload.direction)
        await this.commit('gm.moveSheet')
        return

      case 'gm.updateCardsPerPage':
        this.requireGmPanelRoom()
        this.updateGmCardsPerPage(player, message.payload.cardsPerPage)
        await this.commit('gm.updateCardsPerPage')
        return

      case 'turn.end':
        this.requireCoCreation()
        this.advanceTurn()
        await this.commit('turn.end')
        return

      case 'turn.forceSkip':
        this.advanceTurn(message.payload.playerId)
        await this.commit('turn.forceSkip')
        return

      case 'card.draw':
        this.requireCurrentTurn(player)
        if (room.drawn_this_turn[player.id]) throw new Error('本回合已经抽过牌了')
        this.pendingDraws.set(player.id, this.buildDrawOptions())
        this.send(socket, {
          type: 'draw.options',
          requestId: message.requestId,
          payload: { cards: this.pendingDraws.get(player.id) ?? [] },
        })
        return

      case 'card.draw.confirm': {
        this.requireCurrentTurn(player)
        const options = this.pendingDraws.get(player.id) ?? []
        const selected = options.find(card => card.id === message.payload.cardId)
        if (!selected) throw new Error('Selected card is not in draw options')
        room.deck = room.deck.filter(card => card.id !== selected.id)
        room.hands[player.id] = [...(room.hands[player.id] ?? []), selected]
        room.drawn_this_turn[player.id] = true
        this.pendingDraws.delete(player.id)
        await this.commit('card.draw.confirm')
        return
      }

      case 'card.create': {
        if (message.payload.card.type === 'Role') {
          throw new Error('Role cards are created automatically for each player')
        }
        if (message.payload.card.type === 'Custom' && !cleanOptionalText(message.payload.card.custom_type_name, 20)) {
          throw new Error('Custom cards require a custom_type_name')
        }
        const card: DhCard = {
          ...message.payload.card,
          custom_type_name: normalizeStoredCustomTypeName(message.payload.card.type, message.payload.card.custom_type_name),
          id: id('card'),
          is_custom: true,
        }
        room.hands[player.id] = [...(room.hands[player.id] ?? []), card]
        await this.commit('card.create')
        return
      }

      case 'card.play':
        this.requireCurrentTurn(player)
        this.playCard(player, message.payload.cardId, message.payload.x, message.payload.y)
        await this.commit('card.play')
        return

      case 'card.lock':
        this.lockCard(player, message.payload.cardId)
        await this.commit('card.lock')
        return

      case 'card.unlock':
        this.unlockCard(player, message.payload.cardId)
        await this.commit('card.unlock')
        return

      case 'card.move.commit':
        this.requireUnlockedOrOwner(player, message.payload.cardId)
        this.moveMapCard(message.payload.cardId, snapToGrid(message.payload.x), snapToGrid(message.payload.y))
        this.unlockCard(player, message.payload.cardId)
        await this.commit('card.move.commit')
        return

      case 'card.resize.commit': {
        this.requireUnlockedOrOwner(player, message.payload.cardId)
        const card = this.requireMapCard(message.payload.cardId)
        this.resizeMapCard(card.id, message.payload.width, message.payload.height)
        await this.commit('card.resize.commit')
        return
      }

      case 'card.edit': {
        this.requireUnlockedOrOwner(player, message.payload.cardId)
        const card = this.requireMapCard(message.payload.cardId)
        const updates: MapCardUpdateInput = { ...message.payload.updates }
        const nextType = updates.type ?? card.type

        if (nextType === 'Custom') {
          const customTypeName = normalizeStoredCustomTypeName(nextType, updates.custom_type_name ?? card.custom_type_name)
          if (!customTypeName) {
            throw new Error('Custom cards require a custom_type_name')
          }
          updates.custom_type_name = customTypeName
        } else if (Object.prototype.hasOwnProperty.call(updates, 'custom_type_name')) {
          updates.custom_type_name = undefined
        }

        if (card.type === 'Location' && Object.prototype.hasOwnProperty.call(updates, 'territory')) {
          if (updates.territory) {
            updates.territory = normalizeTerritoryRect(updates.territory, card.width, card.height)
          } else {
            updates.territory = undefined
          }
        }

        this.updateMapCard(message.payload.cardId, updates)
        await this.commit('card.edit')
        return
      }

      case 'card.delete':
        if (room.mode === 'co-creation') throw new Error('Recycle cards during co-creation instead of deleting them')
        room.map_cards = room.map_cards.filter(card => card.id !== message.payload.cardId)
        room.connections = room.connections.filter(conn => (
          conn.from_card_id !== message.payload.cardId && conn.to_card_id !== message.payload.cardId
        ))
        await this.commit('card.delete')
        return

      case 'card.recycle':
        this.recycleCard(player, message.payload.cardId)
        await this.commit('card.recycle')
        return

      case 'connection.add':
        this.addConnection(message.payload)
        await this.commit('connection.add')
        return

      case 'connection.update':
        this.updateConnection(message.payload.connectionId, message.payload.updates)
        await this.commit('connection.update')
        return

      case 'connection.remove':
        room.connections = room.connections.filter(conn => conn.id !== message.payload.connectionId)
        await this.commit('connection.remove')
        return

      case 'annotation.add':
        this.addAnnotation(message.payload)
        await this.commit('annotation.add')
        return

      case 'annotation.update':
        this.updateAnnotation(message.payload.annotationId, message.payload.updates)
        await this.commit('annotation.update')
        return

      case 'annotation.remove':
        room.annotations = room.annotations.filter(ann => ann.id !== message.payload.annotationId)
        await this.commit('annotation.remove')
        return

      case 'room.importPack': {
        this.requireImportsEnabled()
        const pack = assertDhPack(message.payload.pack)
        this.importPack(pack)
        await this.commit('room.importPack')
        return
      }

      case 'room.importLibraryPack':
        this.requireImportsEnabled()
        this.importLibraryPack(message.payload.packId)
        await this.commit('room.importLibraryPack')
        return

      case 'room.importCards':
        this.requireImportsEnabled()
        this.importCards(message.payload.packId, message.payload.cardIds)
        await this.commit('room.importCards')
        return

      case 'room.importRoomBackup': {
        this.requireImportsEnabled()
        const backup = assertDhRoomBackup(message.payload.backup)
        this.importRoomBackup(backup)
        await this.commit('room.importRoomBackup')
        return
      }
    }
  }

  private startCoCreation(): void {
    const room = this.requireRoom()
    const onlinePlayers = room.players.filter(item => item.is_online)

    room.mode = 'co-creation'
    room.drawn_this_turn = {}
    room.current_turn_player_id = this.nextOnlinePlayer(room.turn_order[0] ?? null)
    this.pendingDraws.clear()

    for (const playerId of Object.keys(room.hands)) {
      room.hands[playerId] = []
    }

    for (const player of onlinePlayers) {
      const openingHand = this.drawCardsForTypes(DRAW_TYPES.map((type) => ({ type, count: STARTING_CARDS_PER_TYPE })))
      const roleCard = this.hasRoleCardOnMap(player.id) ? [] : [buildRoleCard(player)]
      room.hands[player.id] = [...roleCard, ...openingHand]
    }
  }

  private endCoCreation(): void {
    const room = this.requireRoom()
    const returned: DhCard[] = []
    for (const playerId of Object.keys(room.hands)) {
      returned.push(...room.hands[playerId].filter(card => !card.is_custom && card.type !== 'Role'))
      room.hands[playerId] = []
    }
    room.deck = shuffle([...room.deck, ...returned])
    room.mode = 'normal'
    room.current_turn_player_id = null
    room.drawn_this_turn = {}
    this.pendingDraws.clear()
  }

  private buildDrawOptions(): DhCard[] {
    const room = this.requireRoom()
    const options: DhCard[] = []

    for (const type of DRAW_TYPES) {
      const candidate = room.deck.find((card) => card.type === type)
      if (!candidate) {
        throw new Error(`Not enough ${type} cards left in deck to draw`)
      }
      options.push(candidate)
    }

    return options
  }

  private drawCardsForTypes(requests: Array<{ type: DeckCardType; count: number }>): DhCard[] {
    const room = this.requireRoom()
    let remainingDeck = [...room.deck]
    const drawn: DhCard[] = []

    for (const request of requests) {
      const selectedIndexes: number[] = []

      for (let index = 0; index < remainingDeck.length && selectedIndexes.length < request.count; index += 1) {
        if (remainingDeck[index].type === request.type) {
          selectedIndexes.push(index)
        }
      }

      if (selectedIndexes.length < request.count) {
        throw new Error(`Not enough ${request.type} cards left in deck`)
      }

      const selectedIndexSet = new Set(selectedIndexes)
      drawn.push(...selectedIndexes.map((index) => remainingDeck[index]))
      remainingDeck = remainingDeck.filter((_, index) => !selectedIndexSet.has(index))
    }

    room.deck = remainingDeck
    return drawn
  }

  private hasRoleCardOnMap(playerId: string): boolean {
    return this.requireRoom().map_cards.some((card) => card.type === 'Role' && card.placed_by_player_id === playerId)
  }

  private playCard(player: Player, cardId: string, x: number, y: number): void {
    const room = this.requireRoom()
    const hand = room.hands[player.id] ?? []
    const card = hand.find(item => item.id === cardId)
    if (!card) throw new Error('Card is not in your hand')

    const size = getCardGridSize(card.type)
    const mapCard: MapCard = {
      ...card,
      ...size,
      x: snapToGrid(x),
      y: snapToGrid(y),
      placed_by: player.nickname,
      placed_by_player_id: player.id,
      player_color: player.color,
      is_expanded: false,
    }

    room.hands[player.id] = hand.filter(item => item.id !== cardId)
    room.map_cards.push(mapCard)
  }

  private recycleCard(player: Player, cardId: string): void {
    const room = this.requireRoom()
    const card = this.requireMapCard(cardId)
    if (room.mode !== 'co-creation') throw new Error('Recycle is only available during co-creation')
    if (card.placed_by_player_id !== player.id) {
      throw new Error('Only the owner can recycle this card')
    }
    room.map_cards = room.map_cards.filter(item => item.id !== cardId)
    room.connections = room.connections.filter(conn => conn.from_card_id !== cardId && conn.to_card_id !== cardId)
    room.hands[card.placed_by_player_id] = [...(room.hands[card.placed_by_player_id] ?? []), stripMapFields(card)]
  }

  private importPack(pack: DhPack): void {
    const room = this.requireRoom()
    const packId = id('pack')
    const libraryPack = createRoomPackLibraryItemFromPack(pack, { id: packId, source: 'imported' })
    const cards = this.instantiatePackCards(libraryPack)

    room.imported_pack_library.push(libraryPack)
    room.deck = shuffle([...room.deck, ...cards])
  }

  private importLibraryPack(packId: string): void {
    const room = this.requireRoom()
    const pack = this.requirePackLibraryItem(packId)
    room.deck = shuffle([...room.deck, ...this.instantiatePackCards(pack, true)])
  }

  private importCards(packId: string, cardIds: string[]): void {
    if (!cardIds.length) throw new Error('Select at least one card to import')

    const room = this.requireRoom()
    const pack = this.requirePackLibraryItem(packId)
    const allowedCardIds = new Set(cardIds)
    const selectedCards = pack.cards.filter((card) => allowedCardIds.has(card.id))

    if (!selectedCards.length) throw new Error('Selected cards were not found in the pack')

    room.deck = shuffle([...room.deck, ...selectedCards.map((card) => ({
      id: id('card'),
      type: card.type,
      custom_type_name: card.custom_type_name,
      title: card.title,
      content: card.content,
      style: card.style,
      is_custom: false,
      pack_id: this.resolveImportedDeckPackId(pack, true),
    }))])
  }

  private importRoomBackup(backup: DhRoomBackup): void {
    const room = this.requireRoom()
    const activePlayers = room.players
    const hostPlayerId = room.host_player_id
    const nicknameToPlayer = new Map(activePlayers.map((player) => [player.nickname, player]))
    const hands: Record<string, DhCard[]> = Object.fromEntries(activePlayers.map((player) => [player.id, []]))
    const fallbackDeck: DhCard[] = []

    for (const hand of backup.session.hands) {
      const player = nicknameToPlayer.get(hand.owner)
      if (player) {
        hands[player.id] = [...hands[player.id], ...structuredClone(hand.cards)]
      } else {
        fallbackDeck.push(...structuredClone(hand.cards))
      }
    }

    const importedLibrary = normalizeImportedPackLibrary(structuredClone(
      backup.library.imported_packs.length
        ? backup.library.imported_packs
        : backup.library.packs ?? [],
    ))
    const importedSelectedPackIds = backup.library.selected_built_in_pack_ids.length
      ? [...backup.library.selected_built_in_pack_ids]
      : [...room.selected_built_in_pack_ids]
    const deck = structuredClone(backup.session.deck ?? [])
    const turnOrder = backup.session.turn_order
      .map((nickname) => nicknameToPlayer.get(nickname)?.id)
      .filter((playerId): playerId is string => Boolean(playerId))

    for (const player of activePlayers) {
      if (!turnOrder.includes(player.id)) {
        turnOrder.push(player.id)
      }
    }

    const currentTurnPlayerId = backup.session.current_turn_player
      ? nicknameToPlayer.get(backup.session.current_turn_player)?.id ?? null
      : null

    room.room_name = backup.room.name || room.room_name
    room.mode = backup.session.mode
    room.current_turn_player_id = currentTurnPlayerId
    room.turn_order = turnOrder
    room.hands = hands
    room.deck = shuffle([...deck, ...fallbackDeck])
    room.map_cards = structuredClone(backup.map.cards)
    room.connections = structuredClone(backup.map.connections)
    room.annotations = structuredClone(backup.map.annotations)
    room.imported_pack_library = importedLibrary
    room.selected_built_in_pack_ids = normalizeBuiltInPackSelection(importedSelectedPackIds, true)
    room.settings = {
      ...room.settings,
      imports_enabled: backup.settings?.imports_enabled ?? true,
    }
    room.host_player_id = hostPlayerId
    room.players = activePlayers.map((player) => ({
      ...player,
      is_host: player.id === hostPlayerId,
    }))
    room.drawn_this_turn = Object.fromEntries(activePlayers.map((player) => [player.id, false]))
    this.pendingDraws.clear()
  }

  private updateSelectedPacks(nextBuiltInPackIds: string[]): void {
    const room = this.requireRoom()
    if (room.mode === 'co-creation') {
      throw new Error('Cannot change selected packs during co-creation')
    }

    const selectedBuiltInPackIds = normalizeBuiltInPackSelection(nextBuiltInPackIds, false)
    if (!selectedBuiltInPackIds.length) {
      throw new Error('Select at least one built-in pack')
    }

    room.selected_built_in_pack_ids = selectedBuiltInPackIds
    this.rebuildDeckFromSelectedPacks(selectedBuiltInPackIds)
  }

  private updateSettings(updates: { importsEnabled?: boolean; resourceChangeRequiresApproval?: boolean }): void {
    const room = this.requireRoom()
    room.settings = {
      ...room.settings,
      ...(updates.importsEnabled !== undefined ? { imports_enabled: updates.importsEnabled } : {}),
      ...(updates.resourceChangeRequiresApproval !== undefined
        ? { resource_change_requires_approval: updates.resourceChangeRequiresApproval }
        : {}),
    }
  }

  private importTrackerCharacter(player: Player, fileName: string, sheet: ResourceTrackerSheet): void {
    const tracker = this.requireResourceTrackerState()
    const now = new Date().toISOString()
    const normalizedSheet = normalizeResourceTrackerSheet(sheet, fileName)
    const existing = tracker.columns.find((column) => column.owner_player_id === player.id)

    if (existing) {
      existing.sheet = normalizedSheet
      existing.updated_at = now
      this.appendTrackerLog('sheet-change', `${player.nickname} 重新导入了角色卡`, player)
      return
    }

    const column: ResourceTrackerCharacterColumn = {
      id: id('tracker_col'),
      owner_player_id: player.id,
      imported_at: now,
      updated_at: now,
      sheet: normalizedSheet,
    }

    tracker.columns.push(column)
    tracker.column_order.push(column.id)
    this.appendTrackerLog('sheet-change', `${player.nickname} 导入了角色卡 ${normalizedSheet.character_name || normalizedSheet.file_name}`, player)
  }

  private updateTrackerSheet(player: Player, columnId: string, sheet: ResourceTrackerSheet): void {
    const column = this.requireTrackerColumn(columnId)
    this.requireTrackerColumnWritePermission(player, column)
    column.sheet = normalizeResourceTrackerSheet(sheet, sheet.file_name)
    column.updated_at = new Date().toISOString()
    this.appendTrackerLog('sheet-change', `${player.nickname} 更新了 ${column.sheet.character_name} 的详细信息`, player)
  }

  private updateTrackerResource(
    player: Player,
    columnId: string,
    resourceKey: ResourceTrackerResourceKey,
    nextValue: number | boolean[],
  ): void {
    const tracker = this.requireResourceTrackerState()
    const column = this.requireTrackerColumn(columnId)

    const currentValue = cloneTrackerResourceValue(getTrackerResourceValue(column.sheet, resourceKey))
    const normalizedValue = normalizeTrackerResourceValue(column.sheet, resourceKey, nextValue)

    if (isTrackerResourceValueEqual(currentValue, normalizedValue)) {
      return
    }

    if (this.requireRoom().settings.resource_change_requires_approval) {
      tracker.pending_resource_requests.push({
        id: id('tracker_req'),
        column_id: column.id,
        owner_player_id: column.owner_player_id,
        requested_by_player_id: player.id,
        requested_by_name: player.nickname,
        resource_key: resourceKey,
        current_value: currentValue,
        next_value: cloneTrackerResourceValue(normalizedValue),
        created_at: new Date().toISOString(),
        status: 'pending',
      })
      this.appendTrackerLog(
        'approval',
        `${player.nickname} 申请将 ${column.sheet.character_name} 的${getTrackerResourceLabel(resourceKey)}从 ${formatTrackerResourceValue(currentValue)} 调整为 ${formatTrackerResourceValue(normalizedValue)}`,
        player,
      )
      return
    }

    setTrackerResourceValue(column.sheet, resourceKey, normalizedValue)
    column.updated_at = new Date().toISOString()
    this.appendTrackerLog(
      'resource-change',
      `${player.nickname} 将 ${column.sheet.character_name} 的${getTrackerResourceLabel(resourceKey)}从 ${formatTrackerResourceValue(currentValue)} 调整为 ${formatTrackerResourceValue(normalizedValue)}`,
      player,
    )
  }

  private updateTrackerFear(player: Player, value: number): void {
    const tracker = this.requireResourceTrackerState()
    const previous = tracker.fear.value
    tracker.fear.value = clamp(Math.round(finiteNumber(value, previous)), 0, tracker.fear.max)
    if (previous !== tracker.fear.value) {
      this.appendTrackerLog('resource-change', `${player.nickname} 将恐惧点从 ${previous} 调整为 ${tracker.fear.value}`, player)
    }
  }

  private createTrackerCountdown(player: Player, name: string, max: number): void {
    const tracker = this.requireResourceTrackerState()
    const normalizedMax = clamp(Math.round(finiteNumber(max, 4)), 2, 12)
    const normalizedName = cleanText(name, `倒计时 ${tracker.countdowns.length + 1}`, 40)
    const now = new Date().toISOString()

    tracker.countdowns.push({
      id: id('tracker_clock'),
      name: normalizedName,
      value: 0,
      max: normalizedMax,
      created_at: now,
      updated_at: now,
    })

    this.appendTrackerLog('system', `${player.nickname} 新增了倒计时「${normalizedName}」(0/${normalizedMax})`, player)
  }

  private updateTrackerCountdown(player: Player, countdownId: string, value: number): void {
    const countdown = this.requireTrackerCountdown(countdownId)
    const previous = countdown.value
    countdown.value = clamp(Math.round(finiteNumber(value, previous)), 0, countdown.max)

    if (previous === countdown.value) {
      return
    }

    countdown.updated_at = new Date().toISOString()
    this.appendTrackerLog(
      'resource-change',
      `${player.nickname} 将倒计时「${countdown.name}」从 ${previous}/${countdown.max} 调整为 ${countdown.value}/${countdown.max}`,
      player,
    )
  }

  private deleteTrackerCountdown(player: Player, countdownId: string): void {
    const tracker = this.requireResourceTrackerState()
    const countdownIndex = tracker.countdowns.findIndex((item) => item.id === countdownId)
    if (countdownIndex < 0) throw new Error('Unknown countdown')

    const [countdown] = tracker.countdowns.splice(countdownIndex, 1)
    this.appendTrackerLog('system', `${player.nickname} 删除了倒计时「${countdown.name}」`, player)
  }

  private moveTrackerColumn(player: Player, columnId: string, direction: 'left' | 'right'): void {
    const tracker = this.requireResourceTrackerState()
    const currentIndex = tracker.column_order.indexOf(columnId)
    if (currentIndex < 0) throw new Error('Unknown character column')

    const targetIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1
    if (targetIndex < 0 || targetIndex >= tracker.column_order.length) return

    const [column] = tracker.column_order.splice(currentIndex, 1)
    tracker.column_order.splice(targetIndex, 0, column)

    const movedColumn = this.requireTrackerColumn(columnId)
    this.appendTrackerLog('system', `${player.nickname} 调整了 ${movedColumn.sheet.character_name} 的列位置`, player)
  }

  private resolveTrackerRequest(player: Player, requestIdToResolve: string, approved: boolean): void {
    const tracker = this.requireResourceTrackerState()
    const requestIndex = tracker.pending_resource_requests.findIndex((request) => request.id === requestIdToResolve)
    if (requestIndex < 0) throw new Error('Unknown resource change request')

    const request = tracker.pending_resource_requests[requestIndex]
    tracker.pending_resource_requests.splice(requestIndex, 1)

    const column = this.requireTrackerColumn(request.column_id)
    if (approved) {
      const normalizedValue = normalizeTrackerResourceValue(column.sheet, request.resource_key, request.next_value)
      setTrackerResourceValue(column.sheet, request.resource_key, normalizedValue)
      column.updated_at = new Date().toISOString()
      this.appendTrackerLog(
        'approval',
        `${player.nickname} 批准了 ${request.requested_by_name} 对 ${column.sheet.character_name} 的${getTrackerResourceLabel(request.resource_key)}修改：${formatTrackerResourceValue(request.current_value)} -> ${formatTrackerResourceValue(normalizedValue)}`,
        player,
      )
      return
    }

    this.appendTrackerLog(
      'approval',
      `${player.nickname} 拒绝了 ${request.requested_by_name} 对 ${column.sheet.character_name} 的${getTrackerResourceLabel(request.resource_key)}修改申请`,
      player,
    )
  }

  private appendTrackerLog(
    kind: ResourceTrackerActivityLogItem['kind'],
    message: string,
    actor?: Player,
  ): void {
    const tracker = this.requireResourceTrackerState()
    tracker.activity_log.push({
      id: id('tracker_log'),
      created_at: new Date().toISOString(),
      actor_player_id: actor?.id,
      actor_name: actor?.nickname ?? '系统',
      kind,
      message,
    })

    if (tracker.activity_log.length > 120) {
      tracker.activity_log = tracker.activity_log.slice(-120)
    }
  }

  private importGmCharacter(player: Player, fileName: string, html: string): void {
    const panel = this.requireGmPanelState()
    const entry = createGmSheetEntry(fileName, html)
    panel.sheets.push(entry)
    panel.sheet_order.push(entry.id)
    this.appendGmLog('sheet-import', `${player.nickname} 导入了角色卡 ${entry.parsed_sheet.character_name || entry.source_file_name}`, player)
  }

  private replaceGmCharacter(player: Player, sheetId: string, fileName: string, html: string): void {
    const entry = this.requireGmSheet(sheetId)
    const nextEntry = createGmSheetEntry(fileName, html, entry.id, entry.imported_at)
    entry.updated_at = nextEntry.updated_at
    entry.html_updated_at = nextEntry.html_updated_at
    entry.source_file_name = nextEntry.source_file_name
    entry.source_format = nextEntry.source_format
    entry.source_html = nextEntry.source_html
    entry.compiled_html = nextEntry.compiled_html
    entry.raw_character_data = nextEntry.raw_character_data
    entry.parsed_sheet = nextEntry.parsed_sheet
    this.appendGmLog('sheet-replace', `${player.nickname} 替换了角色卡 ${entry.parsed_sheet.character_name || entry.source_file_name}`, player)
  }

  private deleteGmSheet(player: Player, sheetId: string): void {
    const panel = this.requireGmPanelState()
    const sheetIndex = panel.sheets.findIndex((item) => item.id === sheetId)
    if (sheetIndex < 0) throw new Error('Unknown character sheet')

    const [entry] = panel.sheets.splice(sheetIndex, 1)
    panel.sheet_order = panel.sheet_order.filter((id) => id !== sheetId)
    this.appendGmLog('sheet-delete', `${player.nickname} 鍒犻櫎浜嗚鑹插崱 ${entry.parsed_sheet.character_name || entry.source_file_name}`, player)
  }

  private updateGmSheet(player: Player, sheetId: string, sheet: ResourceTrackerSheet): void {
    const entry = this.requireGmSheet(sheetId)
    entry.parsed_sheet = normalizeResourceTrackerSheet(sheet, sheet.file_name)
    entry.updated_at = new Date().toISOString()
    this.appendGmLog('sheet-change', `${player.nickname} 更新了 ${entry.parsed_sheet.character_name} 的详细信息`, player)
  }

  private updateGmResource(
    player: Player,
    sheetId: string,
    resourceKey: GmPanelResourceKey,
    nextValue: number | boolean[],
  ): void {
    const entry = this.requireGmSheet(sheetId)
    const currentValue = cloneTrackerResourceValue(getTrackerResourceValue(entry.parsed_sheet, resourceKey))
    const normalizedValue = normalizeTrackerResourceValue(entry.parsed_sheet, resourceKey, nextValue)
    const displayCurrentValue =
      resourceKey === 'armor_slots' && Array.isArray(currentValue) && Array.isArray(normalizedValue)
        ? normalizeBooleanTrack(currentValue, normalizedValue.length)
        : currentValue

    if (isTrackerResourceValueEqual(currentValue, normalizedValue)) {
      return
    }

    setTrackerResourceValue(entry.parsed_sheet, resourceKey, normalizedValue)
    entry.updated_at = new Date().toISOString()
    this.appendGmLog(
      'resource-change',
      `${player.nickname} 将 ${entry.parsed_sheet.character_name} 的 ${getTrackerResourceLabel(resourceKey)}从 ${formatTrackerResourceValue(displayCurrentValue)} 调整为 ${formatTrackerResourceValue(normalizedValue)}`,
      player,
    )
  }

  private updateGmFear(player: Player, value: number): void {
    const panel = this.requireGmPanelState()
    const previous = panel.fear.value
    panel.fear.value = clamp(Math.round(finiteNumber(value, previous)), 0, panel.fear.max)
    if (previous !== panel.fear.value) {
      this.appendGmLog('fear-change', `${player.nickname} 将恐惧点从 ${previous} 调整为 ${panel.fear.value}`, player)
    }
  }

  private createGmCountdown(player: Player, name: string, max: number): void {
    const panel = this.requireGmPanelState()
    const normalizedMax = clamp(Math.round(finiteNumber(max, 4)), 2, 12)
    const normalizedName = cleanText(name, `进度钟 ${panel.countdowns.length + 1}`, 40)
    const now = new Date().toISOString()

    panel.countdowns.push({
      id: id('gm_clock'),
      name: normalizedName,
      value: 0,
      max: normalizedMax,
      created_at: now,
      updated_at: now,
    })

    this.appendGmLog('countdown-create', `${player.nickname} 新增了进度钟“${normalizedName}” (0/${normalizedMax})`, player)
  }

  private updateGmCountdown(player: Player, countdownId: string, value: number): void {
    const countdown = this.requireGmCountdown(countdownId)
    const previous = countdown.value
    countdown.value = clamp(Math.round(finiteNumber(value, previous)), 0, countdown.max)

    if (previous === countdown.value) {
      return
    }

    countdown.updated_at = new Date().toISOString()
    this.appendGmLog(
      'countdown-update',
      `${player.nickname} 将进度钟“${countdown.name}”从 ${previous}/${countdown.max} 调整为 ${countdown.value}/${countdown.max}`,
      player,
    )
  }

  private deleteGmCountdown(player: Player, countdownId: string): void {
    const panel = this.requireGmPanelState()
    const countdownIndex = panel.countdowns.findIndex((item) => item.id === countdownId)
    if (countdownIndex < 0) throw new Error('Unknown countdown')

    const [countdown] = panel.countdowns.splice(countdownIndex, 1)
    this.appendGmLog('countdown-delete', `${player.nickname} 删除了进度钟“${countdown.name}”`, player)
  }

  private moveGmSheet(player: Player, sheetId: string, direction: 'left' | 'right'): void {
    const panel = this.requireGmPanelState()
    const currentIndex = panel.sheet_order.indexOf(sheetId)
    if (currentIndex < 0) throw new Error('Unknown character sheet')

    const targetIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1
    if (targetIndex < 0 || targetIndex >= panel.sheet_order.length) return

    const [movedId] = panel.sheet_order.splice(currentIndex, 1)
    panel.sheet_order.splice(targetIndex, 0, movedId)

    const sheet = this.requireGmSheet(sheetId)
    this.appendGmLog('sheet-reorder', `${player.nickname} 调整了 ${sheet.parsed_sheet.character_name} 的顺序`, player)
  }

  private updateGmCardsPerPage(player: Player, cardsPerPage: number): void {
    const panel = this.requireGmPanelState()
    const nextValue = clamp(Math.round(finiteNumber(cardsPerPage, panel.cards_per_page)), 2, 4)
    if (panel.cards_per_page === nextValue) return
    panel.cards_per_page = nextValue
    this.appendGmLog('system', `${player.nickname} 将每页角色卡数量调整为 ${nextValue}`, player)
  }

  private appendGmLog(
    kind: GmPanelActivityLogItem['kind'],
    message: string,
    actor?: Player,
  ): void {
    const panel = this.requireGmPanelState()
    panel.activity_log.push({
      id: id('gm_log'),
      created_at: new Date().toISOString(),
      actor_player_id: actor?.id,
      actor_name: actor?.nickname ?? '系统',
      kind,
      message,
    })

    if (panel.activity_log.length > 200) {
      panel.activity_log = panel.activity_log.slice(-200)
    }
  }

  private rebuildDeckFromSelectedPacks(selectedBuiltInPackIds: string[]): void {
    const room = this.requireRoom()
    const reservedBuiltInCardIds = new Set<string>()

    for (const card of room.map_cards) {
      if (card.pack_id && isBuiltInPackId(card.pack_id)) {
        reservedBuiltInCardIds.add(card.id)
      }
    }

    for (const hand of Object.values(room.hands)) {
      for (const card of hand) {
        if (card.pack_id && isBuiltInPackId(card.pack_id)) {
          reservedBuiltInCardIds.add(card.id)
        }
      }
    }

    const builtInDeck = createDeckFromBuiltInPackIds(selectedBuiltInPackIds)
      .filter((card) => !reservedBuiltInCardIds.has(card.id))
    const importedAndCustomDeck = room.deck.filter((card) => !card.pack_id || !isBuiltInPackId(card.pack_id))

    room.deck = shuffle([...builtInDeck, ...importedAndCustomDeck])
  }

  private instantiatePackCards(pack: RoomPackLibraryItem, manualImport = false): DhCard[] {
    return pack.cards.map((card) => ({
      id: id('card'),
      type: card.type,
      custom_type_name: card.custom_type_name,
      title: card.title,
      content: card.content,
      style: card.style,
      is_custom: false,
      pack_id: this.resolveImportedDeckPackId(pack, manualImport),
    }))
  }

  private resolveImportedDeckPackId(pack: RoomPackLibraryItem, manualImport: boolean): string {
    if (!manualImport || pack.source !== 'built-in') return pack.id
    return `manual:${pack.id}`
  }

  private addConnection(connection: { from_card_id: string; to_card_id: string; color: 'red' | 'green' | 'gray'; label?: string }): void {
    const room = this.requireRoom()
    this.assertConnectionEndpoints(connection.from_card_id, connection.to_card_id)

    const exists = room.connections.some((item) => (
      item.from_card_id === connection.from_card_id && item.to_card_id === connection.to_card_id
    ))
    if (exists) {
      throw new Error('Connection already exists between these cards')
    }

    room.connections.push({
      id: id('conn'),
      from_card_id: connection.from_card_id,
      to_card_id: connection.to_card_id,
      color: connection.color,
      label: cleanOptionalText(connection.label, 40),
    })
  }

  private updateConnection(connectionId: string, updates: Partial<{ color: 'red' | 'green' | 'gray'; label?: string }>): void {
    const room = this.requireRoom()
    const index = room.connections.findIndex((item) => item.id === connectionId)
    if (index < 0) throw new Error('Unknown connection')

    const existing = room.connections[index]
    room.connections[index] = {
      ...existing,
      ...(updates.color ? { color: updates.color } : {}),
      ...(Object.prototype.hasOwnProperty.call(updates, 'label')
        ? { label: cleanOptionalText(updates.label, 40) }
        : {}),
    }
  }

  private lockCard(player: Player, cardId: string): void {
    const card = this.requireMapCard(cardId)
    if (card.locked_by_player_id && card.locked_by_player_id !== player.id) throw new Error('Card is locked by another player')
    card.locked_by = player.nickname
    card.locked_by_player_id = player.id
    card.locked_until = new Date(Date.now() + 30_000).toISOString()
  }

  private unlockCard(player: Player, cardId: string): void {
    const card = this.requireMapCard(cardId)
    if (card.locked_by_player_id && card.locked_by_player_id !== player.id) return
    delete card.locked_by
    delete card.locked_by_player_id
    delete card.locked_until
  }

  private updateMapCard(cardId: string, updates: MapCardUpdateInput): void {
    const room = this.requireRoom()
    room.map_cards = room.map_cards.map((card) => {
      if (card.id !== cardId) return card

      const { territory, ...restUpdates } = updates
      const nextCard: MapCard = { ...card, ...restUpdates }

      if (!Object.prototype.hasOwnProperty.call(updates, 'territory')) {
        return nextCard
      }

      if (territory) {
        return { ...nextCard, territory }
      }

      delete nextCard.territory
      return nextCard
    })
  }

  private moveMapCard(cardId: string, x: number, y: number): void {
    this.updateMapCard(cardId, { x, y })
  }

  private addAnnotation(annotation: { id?: string; text: string; x: number; y: number; font_size: number }): void {
    const room = this.requireRoom()
    const annotationId = typeof annotation.id === 'string' && annotation.id.trim() ? annotation.id.trim() : id('ann')
    const exists = room.annotations.some((item) => item.id === annotationId)
    if (exists) {
      throw new Error('Annotation id already exists')
    }

    room.annotations.push({
      id: annotationId,
      text: cleanText(annotation.text, '新标注', 280),
      x: finiteNumber(annotation.x, 0),
      y: finiteNumber(annotation.y, 0),
      font_size: clamp(Math.round(finiteNumber(annotation.font_size, 18)), 12, 48),
    })
  }

  private updateAnnotation(annotationId: string, updates: Partial<{ text: string; x: number; y: number; font_size: number }>): void {
    const annotation = this.requireAnnotation(annotationId)

    if (typeof updates.text === 'string') {
      annotation.text = cleanText(updates.text, annotation.text, 280)
    }
    if (typeof updates.x === 'number') {
      annotation.x = finiteNumber(updates.x, annotation.x)
    }
    if (typeof updates.y === 'number') {
      annotation.y = finiteNumber(updates.y, annotation.y)
    }
    if (typeof updates.font_size === 'number') {
      annotation.font_size = clamp(Math.round(finiteNumber(updates.font_size, annotation.font_size)), 12, 48)
    }
  }

  private resizeMapCard(cardId: string, width: number, height: number): void {
    const card = this.requireMapCard(cardId)
    this.updateMapCard(cardId, normalizeCardDimensions(card.type, width, height))
  }

  private advanceTurn(skipPlayerId?: string): void {
    const room = this.requireRoom()
    const onlineOrder = room.turn_order.filter(id => (
      id !== skipPlayerId && room.players.find(player => player.id === id)?.is_online
    ))
    if (!onlineOrder.length) {
      room.current_turn_player_id = null
      return
    }

    const current = room.current_turn_player_id
    const currentIndex = current ? onlineOrder.indexOf(current) : -1
    const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % onlineOrder.length
    room.current_turn_player_id = onlineOrder[nextIndex]
    room.drawn_this_turn[room.current_turn_player_id] = false
  }

  private nextOnlinePlayer(preferred: string | null): string | null {
    const room = this.requireRoom()
    const online = room.turn_order.filter(id => room.players.find(player => player.id === id)?.is_online)
    if (!online.length) return null
    return preferred && online.includes(preferred) ? preferred : online[0]
  }

  private async disconnect(socket: WebSocket): Promise<void> {
    const session = this.sockets.get(socket)
    if (!session) return
    this.sockets.delete(socket)

    const room = await this.load()
    const player = room?.players.find(item => item.id === session.playerId)
    if (!room || !player) return

    player.is_online = false
    player.last_seen_at = new Date().toISOString()
    this.transferHostIfNeeded()
    await this.commit('player.offline')
  }

  private transferHostIfNeeded(): void {
    const room = this.requireRoom()
    const host = room.players.find(player => player.id === room.host_player_id)
    if (host?.is_online) return

    const nextHost = room.players.find(player => player.is_online)
    if (!nextHost) return

    room.host_player_id = nextHost.id
    room.players = room.players.map(player => ({ ...player, is_host: player.id === nextHost.id }))
  }

  private async exportDhRoom(): Promise<Response> {
    const room = await this.mustLoad()
    const host = room.players.find(player => player.id === room.host_player_id)
    const currentTurn = room.players.find(player => player.id === room.current_turn_player_id)
    const backup: DhRoomBackup = {
      format: 'dhroom',
      version: 1,
      room: {
        id: room.room_id,
        name: room.room_name,
        room_type: room.room_type,
        invite_code: room.invite_code,
        created_at: room.created_at,
        expires_at: room.expires_at,
      },
      session: {
        mode: room.mode,
        current_host: host?.nickname ?? '',
        current_turn_player: currentTurn?.nickname ?? null,
        turn_order: room.turn_order
          .map(id => room.players.find(player => player.id === id)?.nickname)
          .filter((name): name is string => Boolean(name)),
        deck: room.deck,
        hands: Object.entries(room.hands).map(([ownerId, cards]) => ({
          owner: room.players.find(player => player.id === ownerId)?.nickname ?? ownerId,
          cards,
        })),
      },
      map: {
        cards: room.map_cards,
        connections: room.connections,
        annotations: room.annotations,
      },
      library: {
        imported_packs: room.imported_pack_library,
        selected_built_in_pack_ids: room.selected_built_in_pack_ids,
      },
      settings: room.settings,
      resource_tracker: room.resource_tracker,
      gm_panel: room.gm_panel,
      players: room.players.map(player => ({
        id: player.id,
        nickname: player.nickname,
        color: player.color,
        is_host: player.id === room.host_player_id,
        is_online: player.is_online,
      })),
      exported_at: new Date().toISOString(),
    }

    return json(backup)
  }

  private async exportSheetHtml(url: URL): Promise<Response> {
    const room = await this.mustLoad()
    const sheetId = decodeURIComponent(url.pathname.split('/')[3] ?? '')
    const entry = room.gm_panel?.sheets.find((sheet) => sheet.id === sheetId)

    if (!entry) {
      return new Response('Sheet not found', { status: 404 })
    }

    const html = entry.compiled_html || entry.source_html

    if (!html) {
      return new Response('Sheet HTML unavailable', { status: 404 })
    }

    return withCors(new Response(html, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
      },
    }))
  }

  private async commit(reason: string): Promise<void> {
    const room = this.requireRoom()
    room.updated_at = new Date().toISOString()
    room.snapshot_version += 1
    await this.save()
    this.broadcast({ type: 'room.updated', payload: { state: this.publicState(), reason } })
  }

  private async load(): Promise<RoomState | null> {
    if (this.room) return this.room
    const storedRoom = await this.ctx.storage.get<RoomState>('room') ?? null
    this.room = storedRoom ? this.migrateRoomState(storedRoom) : null
    if (this.room) {
      await this.hydrateStoredGmSheetHtml(this.room)
    }
    if (this.room && !this.isExpired(this.room)) {
      await this.scheduleExpiryAlarm(this.room)
    }
    return this.room
  }

  private async mustLoad(): Promise<RoomState> {
    const room = await this.load()
    if (!room) throw new HttpError(404, 'room_not_found')
    if (this.isExpired(room)) {
      await this.purgeRoom('expired')
      throw new HttpError(410, 'room_expired')
    }
    return room
  }

  private async save(): Promise<void> {
    if (!this.room) return
    const snapshot = structuredClone(this.room)
    const activeHtmlKeys = new Set<string>()
    const htmlEntries: Array<[string, string]> = []
    const activeCompiledHtmlKeys = new Set<string>()
    const compiledHtmlEntries: Array<[string, string]> = []

    if (snapshot.gm_panel) {
      snapshot.gm_panel.sheets = snapshot.gm_panel.sheets.map((sheet) => {
        if (sheet.source_html) {
          const storageKey = getGmSheetHtmlStorageKey(sheet.id)
          activeHtmlKeys.add(storageKey)
          htmlEntries.push([storageKey, sheet.source_html])
        }
        if (sheet.compiled_html) {
          const storageKey = getGmSheetCompiledHtmlStorageKey(sheet.id)
          activeCompiledHtmlKeys.add(storageKey)
          compiledHtmlEntries.push([storageKey, sheet.compiled_html])
        }

        const { source_html: _sourceHtml, compiled_html: _compiledHtml, ...rest } = sheet
        return rest
      })
    }

    await this.ctx.storage.put('room', snapshot)

    for (const [storageKey, html] of htmlEntries) {
      await this.ctx.storage.put(storageKey, html)
    }
    for (const [storageKey, html] of compiledHtmlEntries) {
      await this.ctx.storage.put(storageKey, html)
    }

    const storedHtmlEntries = await this.ctx.storage.list<string>({ prefix: GM_SHEET_HTML_STORAGE_KEY_PREFIX })
    for (const storageKey of storedHtmlEntries.keys()) {
      if (!activeHtmlKeys.has(storageKey)) {
        await this.ctx.storage.delete(storageKey)
      }
    }
    const storedCompiledHtmlEntries = await this.ctx.storage.list<string>({ prefix: GM_SHEET_COMPILED_HTML_STORAGE_KEY_PREFIX })
    for (const storageKey of storedCompiledHtmlEntries.keys()) {
      if (!activeCompiledHtmlKeys.has(storageKey)) {
        await this.ctx.storage.delete(storageKey)
      }
    }
  }

  private async hydrateStoredGmSheetHtml(room: RoomState): Promise<void> {
    const sheets = room.gm_panel?.sheets ?? []
    const pendingSheets = sheets.filter((sheet) => !sheet.source_html || !sheet.compiled_html)

    if (!pendingSheets.length) {
      return
    }

    await Promise.all(pendingSheets.map(async (sheet) => {
      const [html, compiledHtml] = await Promise.all([
        this.ctx.storage.get<string>(getGmSheetHtmlStorageKey(sheet.id)),
        this.ctx.storage.get<string>(getGmSheetCompiledHtmlStorageKey(sheet.id)),
      ])
      if (!sheet.source_html && typeof html === 'string' && html) {
        sheet.source_html = html
      }
      if (!sheet.compiled_html && typeof compiledHtml === 'string' && compiledHtml) {
        sheet.compiled_html = compiledHtml
      }

      if (sheet.source_html) {
        sheet.compiled_html = compileGmSheetHtml(sheet.source_html, sheet.parsed_sheet)
      }
    }))
  }

  private publicState(): RoomState {
    const snapshot = structuredClone(this.requireRoom())
    if (snapshot.gm_panel) {
      snapshot.gm_panel.sheets = snapshot.gm_panel.sheets.map((sheet) => {
        const { source_html: _sourceHtml, compiled_html: _compiledHtml, ...rest } = sheet
        return rest
      })
    }
    return snapshot
  }

  private isExpired(room: Pick<RoomState, 'expires_at'>): boolean {
    return Date.parse(room.expires_at) <= Date.now()
  }

  private async scheduleExpiryAlarm(room: Pick<RoomState, 'expires_at'>): Promise<void> {
    const expiresAt = Date.parse(room.expires_at)
    if (!Number.isFinite(expiresAt)) return

    const currentAlarm = await this.ctx.storage.getAlarm()
    if (currentAlarm !== expiresAt) {
      await this.ctx.storage.setAlarm(expiresAt)
    }
  }

  private async purgeRoom(reason: 'expired'): Promise<void> {
    for (const socket of Array.from(this.sockets.keys())) {
      try {
        socket.close(1001, reason === 'expired' ? 'Room expired' : 'Room closed')
      } catch {
        // Ignore close errors while tearing down the room.
      }
    }

    this.sockets.clear()
    this.pendingDraws.clear()
    this.room = null
    await this.ctx.storage.deleteAlarm()
    await this.ctx.storage.deleteAll()
  }

  private requireRoom(): RoomState {
    if (!this.room) throw new Error('Room is not loaded')
    return this.room
  }

  private migrateRoomState(room: RoomState): RoomState {
    const migrated = room as RoomState & {
      room_type?: RoomType
      resource_tracker?: ResourceTrackerState
      gm_panel?: GmPanelState
      imported_pack_library?: RoomPackLibraryItem[]
      selected_built_in_pack_ids?: string[]
      pack_library?: RoomPackLibraryItem[]
      settings?: { imports_enabled?: boolean; resource_change_requires_approval?: boolean }
      selected_pack_ids?: string[]
    }
    const importedPackLibrary = normalizeImportedPackLibrary(
      migrated.imported_pack_library?.length ? migrated.imported_pack_library : migrated.pack_library ?? [],
    )
    const selectedBuiltInPackIds = normalizeBuiltInPackSelection(
      migrated.selected_built_in_pack_ids?.length ? migrated.selected_built_in_pack_ids : migrated.selected_pack_ids,
      true,
    )
    const {
      imported_pack_library: _currentImportedPackLibrary,
      selected_built_in_pack_ids: _currentSelectedBuiltInPackIds,
      pack_library: _legacyPackLibrary,
      selected_pack_ids: _legacySelectedPackIds,
      ...baseRoom
    } = migrated

    return {
      ...baseRoom,
      deck: room.deck.map((card) => normalizeStoredCard(card)),
      hands: Object.fromEntries(
        Object.entries(room.hands).map(([playerId, cards]) => [playerId, cards.map((card) => normalizeStoredCard(card))]),
      ),
      map_cards: room.map_cards.map((card) => normalizeStoredCard(card) as MapCard),
      settings: {
        imports_enabled: migrated.settings?.imports_enabled ?? true,
        resource_change_requires_approval: migrated.settings?.resource_change_requires_approval ?? false,
        battle_panel_visibility: 'shared',
      },
      room_type: migrated.room_type ?? 'co-creation',
      resource_tracker: (migrated.room_type ?? 'co-creation') === 'resource-tracker'
        ? normalizeResourceTrackerState(migrated.resource_tracker)
        : undefined,
      gm_panel: (migrated.room_type ?? 'co-creation') === 'gm-panel'
        ? normalizeGmPanelStateWithHtml(migrated.gm_panel)
        : undefined,
      imported_pack_library: importedPackLibrary.map((pack) => ({
        ...pack,
        source: 'imported',
        cards: pack.cards.map((card) => normalizeStoredPackCard(card)),
      })),
      selected_built_in_pack_ids: Array.from(new Set(selectedBuiltInPackIds)),
    }
  }

  private requirePlayer(playerId: string): Player {
    const player = this.requireRoom().players.find(item => item.id === playerId)
    if (!player) throw new Error('Unknown player')
    return player
  }

  private requireMapCard(cardId: string): MapCard {
    const card = this.requireRoom().map_cards.find(item => item.id === cardId)
    if (!card) throw new Error('Unknown map card')
    return card
  }

  private requirePackLibraryItem(packId: string): RoomPackLibraryItem {
    const pack = createPackLibrary(this.requireRoom().imported_pack_library).find((item) => item.id === packId)
    if (!pack) throw new Error('Unknown pack')
    return pack
  }

  private requireResourceTrackerRoom(): void {
    if (this.requireRoom().room_type !== 'resource-tracker') {
      throw new Error('Resource tracker room required')
    }
  }

  private requireResourceTrackerState(): ResourceTrackerState {
    const room = this.requireRoom()
    if (room.room_type !== 'resource-tracker') {
      throw new Error('Resource tracker room required')
    }
    room.resource_tracker ??= createEmptyResourceTrackerState()
    return room.resource_tracker
  }

  private requireGmPanelRoom(): void {
    if (this.requireRoom().room_type !== 'gm-panel') {
      throw new Error('GM panel room required')
    }
  }

  private requireGmPanelState(): GmPanelState {
    const room = this.requireRoom()
    if (room.room_type !== 'gm-panel') {
      throw new Error('GM panel room required')
    }
    room.gm_panel ??= createEmptyGmPanelState()
    return room.gm_panel
  }

  private requireGmSheet(sheetId: string): GmPanelCharacterSheetEntry {
    const panel = this.requireGmPanelState()
    const entry = panel.sheets.find((item) => item.id === sheetId)
    if (!entry) throw new Error('Unknown character sheet')
    return entry
  }

  private requireGmCountdown(countdownId: string): ResourceTrackerCountdown {
    const panel = this.requireGmPanelState()
    const countdown = panel.countdowns.find((item) => item.id === countdownId)
    if (!countdown) throw new Error('Unknown countdown')
    return countdown
  }

  private requireTrackerColumn(columnId: string): ResourceTrackerCharacterColumn {
    const tracker = this.requireResourceTrackerState()
    const column = tracker.columns.find((item) => item.id === columnId)
    if (!column) throw new Error('Unknown character column')
    return column
  }

  private requireTrackerCountdown(countdownId: string): ResourceTrackerCountdown {
    const tracker = this.requireResourceTrackerState()
    const countdown = tracker.countdowns.find((item) => item.id === countdownId)
    if (!countdown) throw new Error('Unknown countdown')
    return countdown
  }

  private requireTrackerColumnWritePermission(_player: Player, _column: ResourceTrackerCharacterColumn): void {
    return
  }

  private requireImportsEnabled(): void {
    if (!this.requireRoom().settings.imports_enabled) {
      throw new Error('Import feature is disabled in room settings')
    }
  }

  private requireCoCreation(): void {
    if (this.requireRoom().mode !== 'co-creation') throw new Error('Co-creation mode required')
  }

  private requireCurrentTurn(player: Player): void {
    this.requireCoCreation()
    if (this.requireRoom().current_turn_player_id !== player.id) throw new Error('It is not your turn')
  }

  private requireUnlockedOrOwner(player: Player, cardId: string): void {
    const card = this.requireMapCard(cardId)
    if (card.locked_by_player_id && card.locked_by_player_id !== player.id) {
      throw new Error('Card is locked by another player')
    }
  }

  private assertConnectionEndpoints(fromCardId: string, toCardId: string): void {
    if (fromCardId === toCardId) {
      throw new Error('Cannot connect a card to itself')
    }

    this.requireMapCard(fromCardId)
    this.requireMapCard(toCardId)
  }

  private send(socket: WebSocket, message: unknown): void {
    socket.send(JSON.stringify(message))
  }

  private sendError(socket: WebSocket, requestId: string | undefined, code: string, message: string): void {
    this.send(socket, { type: 'error', requestId, payload: { code, message } })
  }

  private broadcast(message: unknown): void {
    const encoded = JSON.stringify(message)
    for (const socket of this.sockets.keys()) {
      try {
        socket.send(encoded)
      } catch {
        this.sockets.delete(socket)
      }
    }
  }

  private requireAnnotation(annotationId: string) {
    const annotation = this.requireRoom().annotations.find((item) => item.id === annotationId)
    if (!annotation) throw new Error('Unknown annotation')
    return annotation
  }
}

function stripMapFields(card: MapCard): DhCard {
  return {
    id: card.id,
    type: card.type,
    custom_type_name: card.custom_type_name,
    title: card.title,
    content: card.content,
    style: card.style,
    is_custom: card.is_custom,
    pack_id: card.pack_id,
    role_details: card.role_details,
  }
}

function buildRoleCard(player: Player): DhCard {
  return {
    id: id('role'),
    type: 'Role',
    title: `${player.nickname}的角色`,
    content: '记录角色从创建到与他人相聚前最重要的经历、目标或秘密。',
    style: '#f59e0b',
    is_custom: false,
    role_details: {
      player_name: player.nickname,
      profession: '',
      ancestry: '',
      community: '',
    },
  }
}

function normalizeStoredCustomTypeName(type: CardType, customTypeName: unknown): string | undefined {
  if (type !== 'Custom') return undefined
  return cleanOptionalText(customTypeName, 20)
}

function normalizeStoredCard<T extends { type: CardType; custom_type_name?: string; role_details?: RoleCardDetails }>(card: T): T {
  const normalizedType = normalizeCardType(card.type) ?? (card.role_details ? 'Role' : 'Hook')
  return {
    ...card,
    type: normalizedType,
    custom_type_name: normalizeStoredCustomTypeName(normalizedType, card.custom_type_name),
    ...(normalizedType === 'Role' ? {} : { role_details: undefined }),
  }
}

function normalizeStoredPackCard<T extends { type: DeckCardType; custom_type_name?: string }>(card: T): T {
  const normalizedType = normalizeCardType(card.type)
  const nextType = normalizedType === 'Role' || !normalizedType ? 'Hook' : normalizedType
  return {
    ...card,
    type: nextType,
    custom_type_name: normalizeStoredCustomTypeName(nextType, card.custom_type_name),
  }
}

function makePlayer(idValue: string, nickname: string, color: string, isHost: boolean, now: Date): Player {
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

function normalizeRoomType(value: RoomType | undefined): RoomType {
  if (value === 'resource-tracker' || value === 'gm-panel') return value
  return 'co-creation'
}

function createEmptyResourceTrackerState(): ResourceTrackerState {
  return {
    fear: {
      value: 0,
      max: 12,
    },
    countdowns: [],
    columns: [],
    column_order: [],
    pending_resource_requests: [],
    activity_log: [],
  }
}

function createEmptyGmPanelState(): GmPanelState {
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

function normalizeResourceTrackerState(value: ResourceTrackerState | undefined): ResourceTrackerState {
  if (!value) return createEmptyResourceTrackerState()

  return {
    fear: {
      value: clamp(Math.round(finiteNumber(value.fear?.value, 0)), 0, 12),
      max: 12,
    },
    countdowns: Array.isArray(value.countdowns)
      ? value.countdowns.map((countdown, index) => normalizeResourceTrackerCountdown(countdown, index))
      : [],
    columns: Array.isArray(value.columns)
      ? value.columns.map((column) => ({
        ...column,
        sheet: normalizeResourceTrackerSheet(column.sheet, column.sheet?.file_name),
      }))
      : [],
    column_order: Array.isArray(value.column_order) ? value.column_order.filter((item) => typeof item === 'string') : [],
    pending_resource_requests: Array.isArray(value.pending_resource_requests) ? value.pending_resource_requests : [],
    activity_log: Array.isArray(value.activity_log) ? value.activity_log.slice(-120) : [],
  }
}

function normalizeGmPanelState(value: GmPanelState | undefined): GmPanelState {
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
    activity_log: Array.isArray(value.activity_log) ? value.activity_log.slice(-200) : [],
  }
}

function normalizeGmPanelStateWithHtml(value: GmPanelState | undefined): GmPanelState {
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
      return createGmSheetEntry(fileName, sourceHtml, entryId, importedAt, updatedAt, htmlUpdatedAt)
    }

    const fallback = normalized.sheets[index]
    if (fallback) {
      return {
        ...fallback,
        id: entryId,
        imported_at: importedAt,
        updated_at: updatedAt,
        html_updated_at: htmlUpdatedAt,
        source_file_name: fileName,
      }
    }

    const safeRaw = normalizeImportedCharacterData(sheet.raw_character_data)
    return {
      id: entryId,
      imported_at: importedAt,
      updated_at: updatedAt,
      html_updated_at: htmlUpdatedAt,
      source_file_name: fileName,
      source_format: 'mydhcharsheet-html',
      raw_character_data: safeRaw,
      parsed_sheet: normalizeResourceTrackerSheet(
        sheet.parsed_sheet ?? buildSheetFromImportedCharacterData(safeRaw, fileName),
        fileName,
      ),
    }
  })

  return normalized
}

function normalizeResourceTrackerCountdown(
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

function normalizeImportedCharacterData(value: ImportedCharacterData | undefined): ImportedCharacterData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }
  return structuredClone(value)
}

function createGmSheetEntry(
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
  const parsedSource = typeof source === 'string' ? extractCharacterDataFromHtml(safeHtml ?? '') : source
  const safeRaw = normalizeImportedCharacterData(parsedSource)
  const parsedSheet = normalizeResourceTrackerSheet(
    buildSheetFromImportedCharacterData(safeRaw, fileName),
    fileName,
  )
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

function normalizeResourceTrackerSheet(sheet: ResourceTrackerSheet, fileName: string): ResourceTrackerSheet {
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

function normalizeBooleanTrack(value: unknown, maxLength: number): boolean[] {
  const normalizedLength = Math.max(0, maxLength)
  const source = Array.isArray(value) ? value : []
  return Array.from({ length: normalizedLength }, (_, index) => Boolean(source[index]))
}

const CHARACTER_DATA_MARKER = 'window.characterData ='
const TRANSPARENT_IMAGE_DATA_URL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='
const INLINE_IMAGE_DATA_URL_PATTERN = /data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g

function getGmSheetHtmlStorageKey(sheetId: string): string {
  return `${GM_SHEET_HTML_STORAGE_KEY_PREFIX}${sheetId}`
}

function getGmSheetCompiledHtmlStorageKey(sheetId: string): string {
  return `${GM_SHEET_COMPILED_HTML_STORAGE_KEY_PREFIX}${sheetId}`
}

function sanitizeImportedHtml(html: string): string {
  return html
    .replace(INLINE_IMAGE_DATA_URL_PATTERN, TRANSPARENT_IMAGE_DATA_URL)
    .trim()
}

function compileGmSheetHtml(html: string, sheet: ResourceTrackerSheet): string {
  const resourceIds = collectGmResourceElementIds(html, sheet)
  let compiled = markHopeResourceElements(html, sheet.resources.hope_max)

  ;(['proficiency', 'hp', 'stress', 'armor_slots', 'gold'] as const).forEach((resourceKey) => {
    resourceIds[resourceKey].forEach((elementId, index) => {
      compiled = markElementById(compiled, elementId, resourceKey, index)
    })
  })

  return compiled
}

function collectGmResourceElementIds(
  html: string,
  sheet: ResourceTrackerSheet,
): Record<Exclude<ResourceTrackerResourceKey, 'hope'>, string[]> {
  const resources = sheet.resources

  return {
    proficiency: collectCheckboxIdsAfterLabel(html, '熟练值', 'w-3 h-3', resources.proficiency.length, 4_000),
    hp: collectCheckboxIdsAfterLabel(html, '生命点', 'w-4 h-4', resources.hp.length, 8_000, ['压力点', '护甲槽', '金币']),
    stress: collectCheckboxIdsAfterLabel(html, '压力点', 'w-4 h-4', resources.stress.length, 8_000, ['生命点', '护甲槽', '金币']),
    armor_slots: collectCheckboxIdsAfterLabel(html, '护甲槽', 'w-4 h-4', resources.armor_slots.length, 5_000),
    gold: collectGoldCheckboxIds(html, resources.gold.length),
  }
}

function collectGoldCheckboxIds(html: string, limit: number): string[] {
  if (limit <= 0) return []

  const goldIndex = html.indexOf('金币')
  if (goldIndex < 0) return []

  const coinIds = collectCheckboxIdsFromIndex(html, goldIndex, 'w-4 h-4', Math.min(20, limit), 12_000)
  if (coinIds.length >= limit) {
    return coinIds.slice(0, limit)
  }

  const chestIds = collectCheckboxIdsFromIndex(html, goldIndex, 'w-8 h-8', limit - coinIds.length, 12_000)
  return [...coinIds, ...chestIds].slice(0, limit)
}

function collectCheckboxIdsAfterLabel(
  html: string,
  label: string,
  classToken: string,
  limit: number,
  scanLength: number,
  boundaryLabels: string[] = [],
): string[] {
  if (limit <= 0) return []

  let labelIndex = -1
  while ((labelIndex = html.indexOf(label, labelIndex + 1)) >= 0) {
    const sectionEnd = findNearestFollowingLabelIndex(html, labelIndex + label.length, boundaryLabels)
    const scopedScanLength = Math.min(scanLength, Math.max(0, sectionEnd - labelIndex))
    const ids = collectCheckboxIdsFromIndex(html, labelIndex, classToken, limit, scopedScanLength)

    if (ids.length > 0) {
      return ids
    }
  }

  return []
}

function findNearestFollowingLabelIndex(html: string, startIndex: number, labels: string[]): number {
  let nearestIndex = html.length

  for (const label of labels) {
    const index = html.indexOf(label, startIndex)
    if (index >= 0 && index < nearestIndex) {
      nearestIndex = index
    }
  }

  return nearestIndex
}

function collectCheckboxIdsFromIndex(
  html: string,
  startIndex: number,
  classToken: string,
  limit: number,
  scanLength: number,
): string[] {
  const segment = html.slice(startIndex, startIndex + scanLength)
  const ids: string[] = []
  const seen = new Set<string>()
  const elementPattern = /<(?:div|button)\b[^>]*>/gi
  let match: RegExpExecArray | null

  while ((match = elementPattern.exec(segment)) && ids.length < limit) {
    const tag = match[0]
    const idValue = getHtmlAttribute(tag, 'id')
    const className = getHtmlAttribute(tag, 'class') ?? ''
    const onclick = getHtmlAttribute(tag, 'onclick') ?? ''

    if (!idValue || seen.has(idValue)) continue
    if (!onclick.includes('toggleCustomCheckbox')) continue
    if (!className.includes(classToken)) continue
    if (!className.includes('cursor-pointer') || !className.includes('border-gray-800')) continue

    seen.add(idValue)
    ids.push(idValue)
  }

  return ids
}

function markHopeResourceElements(html: string, hopeMax: number): string {
  const max = clamp(Math.round(finiteNumber(hopeMax, 6)), 0, 12)

  return html.replace(/<([a-z][\w:-]*)\b(?=[^>]*\bdata-hope-index=(["']?)(\d+)\2)[^>]*>/gi, (tag, _tagName, _quote, rawIndex) => {
    const index = Number(rawIndex)
    if (!Number.isInteger(index) || index < 0 || index >= max) return tag
    return markOpeningTag(tag, 'hope', index)
  })
}

function markElementById(html: string, elementId: string, resourceKey: ResourceTrackerResourceKey, index: number): string {
  const escapedId = escapeRegExp(elementId)
  const elementPattern = new RegExp(`<(?:div|button)\\b(?=[^>]*\\bid=(["'])${escapedId}\\1)[^>]*>`, 'i')
  return html.replace(elementPattern, (tag) => markOpeningTag(tag, resourceKey, index))
}

function markOpeningTag(tag: string, resourceKey: ResourceTrackerResourceKey, index: number): string {
  const cleaned = tag
    .replace(/\sdata-dhol-resource=(["']).*?\1/gi, '')
    .replace(/\sdata-dhol-index=(["']).*?\1/gi, '')
    .replace(/\sdata-gm-allow-click=(["']).*?\1/gi, '')

  return cleaned.replace(/>$/, ` data-dhol-resource="${resourceKey}" data-dhol-index="${index}" data-gm-allow-click="true">`)
}

function getHtmlAttribute(tag: string, attributeName: string): string | undefined {
  const escapedName = escapeRegExp(attributeName)
  const pattern = new RegExp(`\\s${escapedName}\\s*=\\s*(["'])(.*?)\\1`, 'i')
  return tag.match(pattern)?.[2]
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function extractCharacterDataFromHtml(html: string): ImportedCharacterData {
  const start = html.indexOf(CHARACTER_DATA_MARKER)
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

function extractArmorSlotsFromHtml(html: string): boolean[] {
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

function findObjectLiteralEnd(source: string, objectStart: number): number {
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

function buildImportedExperiences(names: unknown, values: unknown) {
  const nameList = Array.isArray(names) ? names : []
  const valueList = Array.isArray(values) ? values : []

  return Array.from({ length: 5 }, (_, index) => ({
    name: getImportedText(nameList[index]),
    value: getImportedText(valueList[index]),
  }))
}

function detectImportedPrimaryTrait(data: ImportedCharacterJson) {
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

function getImportedRefName(refName: unknown, fallback: unknown) {
  return getImportedText(refName || fallback)
}

function getImportedText(value: unknown, fallback = '') {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number') return String(value)
  return fallback
}

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

function buildSheetFromImportedCharacterData(value: ImportedCharacterData, fileName: string): ResourceTrackerSheet {
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

function cloneTrackerResourceValue(value: number | boolean[]): number | boolean[] {
  return Array.isArray(value) ? [...value] : value
}

function getTrackerResourceValue(sheet: ResourceTrackerSheet, resourceKey: ResourceTrackerResourceKey): number | boolean[] {
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

function setTrackerResourceValue(sheet: ResourceTrackerSheet, resourceKey: ResourceTrackerResourceKey, nextValue: number | boolean[]): void {
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

function normalizeTrackerResourceValue(
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

function isTrackerResourceValueEqual(left: number | boolean[], right: number | boolean[]): boolean {
  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) return false
    return left.every((item, index) => item === right[index])
  }

  return left === right
}

function getTrackerResourceLabel(resourceKey: ResourceTrackerResourceKey): string {
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

function formatTrackerResourceValue(value: number | boolean[]): string {
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

function roomStub(env: Env, inviteCode: string): DurableObjectStub {
  return env.ROOMS.get(env.ROOMS.idFromName(inviteCode))
}

function internalRequest(pathname: string, init?: RequestInit): Request {
  return new Request(`https://room.local${pathname}`, init)
}

function buildWebSocketUrl(request: Request, env: Env, inviteCode: string, token: string): string {
  const forwardedHost = request.headers.get('X-Forwarded-Host')
  const base = env.PUBLIC_API_BASE ?? (forwardedHost ? `https://${forwardedHost}` : request.url)
  const url = new URL(base)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.pathname = `/api/rooms/${inviteCode}/ws`
  url.search = new URLSearchParams({ token }).toString()
  return url.toString()
}

function generateInviteCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = new Uint8Array(6)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, byte => alphabet[byte % alphabet.length]).join('')
}

function id(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`
}

function cleanText(value: unknown, fallback: string, maxLength: number): string {
  const text = typeof value === 'string' ? value.trim() : ''
  return (text || fallback).slice(0, maxLength)
}

function cleanOptionalText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined
  const text = value.trim().slice(0, maxLength)
  return text || undefined
}

function normaliseInvite(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = crypto.getRandomValues(new Uint32Array(1))[0] % (index + 1)
    ;[copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]]
  }
  return copy
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function finiteNumber(value: unknown, fallback: number): number {
  return Number.isFinite(value) ? Number(value) : fallback
}

function getSessionSecret(env: Env): string {
  return env.SESSION_SECRET?.trim() || 'dhgc-local-dev-session-secret'
}

async function signSession(secret: string, payload: SessionPayload): Promise<string> {
  const body = base64UrlEncode(JSON.stringify(payload))
  const signature = await hmac(secret, body)
  return `${body}.${signature}`
}

async function verifySession(secret: string, token: string): Promise<SessionPayload | null> {
  const [body, signature] = token.split('.')
  if (!body || !signature) return null
  const expected = await hmac(secret, body)
  if (signature !== expected) return null
  const payload = JSON.parse(base64UrlDecode(body)) as SessionPayload
  if (payload.exp < Math.floor(Date.now() / 1000)) return null
  return payload
}

async function hmac(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
  return base64UrlEncodeBytes(new Uint8Array(signature))
}

function base64UrlEncode(value: string): string {
  return base64UrlEncodeBytes(new TextEncoder().encode(value))
}

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function base64UrlDecode(value: string): string {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(value.length / 4) * 4, '=')
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return new TextDecoder().decode(bytes)
}

function json(body: unknown, init: ResponseInit = {}): Response {
  return withCors(new Response(JSON.stringify(body, null, 2), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(init.headers ?? {}),
    },
  }))
}

function emptyCors(): Response {
  return withCors(new Response(null, { status: 204 }))
}

function withCors(response: Response): Response {
  const next = new Response(response.body, response)
  next.headers.set('access-control-allow-origin', '*')
  next.headers.set('access-control-allow-methods', 'GET,POST,OPTIONS')
  next.headers.set('access-control-allow-headers', 'content-type,authorization')
  return next
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
  }
}
