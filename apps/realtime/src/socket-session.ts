export interface SocketSession {
  playerId: string
  nickname: string
}

export interface SocketSessionAttachmentSocket {
  serializeAttachment(attachment: unknown): void
  deserializeAttachment(): unknown | null
}

export interface SocketSessionRegistration {
  session: SocketSession
  tag: string
  tags: [string]
}

export const SOCKET_SESSION_ATTACHMENT_ERROR_CODE = 'INVALID_SOCKET_SESSION_ATTACHMENT'
export const SOCKET_SESSION_ATTACHMENT_ERROR_MESSAGE =
  'Invalid WebSocket session attachment: playerId and nickname must be non-empty strings'

export class SocketSessionAttachmentError extends Error {
  readonly code = SOCKET_SESSION_ATTACHMENT_ERROR_CODE

  constructor() {
    super(SOCKET_SESSION_ATTACHMENT_ERROR_MESSAGE)
    this.name = 'SocketSessionAttachmentError'
  }
}

export function validateSocketSessionAttachment(value: unknown): SocketSession {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new SocketSessionAttachmentError()
  }

  const record = value as Record<string, unknown>
  if (
    typeof record.playerId !== 'string'
    || !record.playerId.trim()
    || typeof record.nickname !== 'string'
    || !record.nickname.trim()
    || Object.keys(record).some(key => key !== 'playerId' && key !== 'nickname')
  ) {
    throw new SocketSessionAttachmentError()
  }

  return {
    playerId: record.playerId,
    nickname: record.nickname,
  }
}

export function serializeSocketSessionAttachment(
  socket: Pick<SocketSessionAttachmentSocket, 'serializeAttachment'>,
  session: SocketSession,
): void {
  const attachment = validateSocketSessionAttachment(session)
  socket.serializeAttachment(attachment)
}

export function readSocketSessionAttachment(
  socket: Pick<SocketSessionAttachmentSocket, 'deserializeAttachment'>,
): SocketSession {
  return validateSocketSessionAttachment(socket.deserializeAttachment())
}

export function getPlayerTag(playerId: string): string {
  if (typeof playerId !== 'string' || !playerId.trim()) {
    throw new Error('Invalid player tag: playerId must be a non-empty string')
  }
  return `player:${playerId}`
}

export function prepareSocketSession(
  socket: Pick<SocketSessionAttachmentSocket, 'serializeAttachment'>,
  playerId: string,
  nickname: string,
): SocketSessionRegistration {
  const session = validateSocketSessionAttachment({ playerId, nickname })
  const tag = getPlayerTag(session.playerId)
  serializeSocketSessionAttachment(socket, session)
  return { session, tag, tags: [tag] }
}
