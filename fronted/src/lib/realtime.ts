import { safeJsonParse, type ClientMessage, type CreateRoomRequest, type JoinRoomRequest, type RoomJoinResponse, type ServerMessage } from '@dhgc/shared'

const DEFAULT_API_BASE = 'http://127.0.0.1:8787'
const MAX_BACKOFF_MS = 30_000
const BASE_BACKOFF_MS = 1_000
const MAX_RECONNECT_ATTEMPTS = 15

export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error'

interface ApiErrorPayload {
  error?: string
  message?: string
}

export function getRealtimeApiBase() {
  const configured = import.meta.env.VITE_REALTIME_API_BASE
  if (configured !== undefined) return configured.replace(/\/$/, '')
  if (import.meta.env.PROD) return ''
  return DEFAULT_API_BASE
}

export async function createRoomRequest(payload: CreateRoomRequest) {
  return requestJson<RoomJoinResponse>('/api/rooms', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function joinRoomRequest(payload: JoinRoomRequest) {
  return requestJson<RoomJoinResponse>('/api/rooms/join', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function fetchDhRoomBackup(inviteCode: string) {
  let response: Response
  try {
    response = await fetch(`${getRealtimeApiBase()}/api/rooms/${inviteCode}/export/dhroom`)
  } catch {
    throw new Error('无法连接到服务器，请检查网络或稍后重试。')
  }

  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }
  return response.blob()
}

export interface RoomSocketHandlers {
  onClose?: () => void
  onError?: (error: Error) => void
  onMessage: (message: ServerMessage) => void
  onOpen?: () => void
  onStatusChange?: (status: ConnectionState) => void
}

export class RoomSocketConnection {
  private socket: WebSocket | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempts = 0
  private intentionalClose = false
  private disposed = false
  private websocketUrl: string
  private handlers: RoomSocketHandlers

  constructor(websocketUrl: string, handlers: RoomSocketHandlers) {
    this.websocketUrl = websocketUrl
    this.handlers = handlers
    this.setupNetworkListeners()
    this.setupUnloadListener()
  }

  connect(): void {
    if (this.disposed || this.intentionalClose) return
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) return
    if (!navigator.onLine) {
      this.handlers.onStatusChange?.('reconnecting')
      return
    }

    this.handlers.onStatusChange?.('connecting')

    try {
      this.socket = new WebSocket(this.websocketUrl)
    } catch {
      this.handlers.onError?.(new Error('无法建立实时连接，请检查网络后重试。'))
      this.scheduleReconnect()
      return
    }

    this.socket.addEventListener('open', () => {
      if (this.disposed) return
      this.reconnectAttempts = 0
      this.clearReconnectTimer()
      this.handlers.onOpen?.()
    })

    this.socket.addEventListener('close', (event) => {
      if (this.disposed) return

      const wasIntentional = this.intentionalClose
      this.socket = null

      if (!wasIntentional) {
        if (event.code === 1001 && event.reason === 'Room expired') {
          this.handlers.onError?.(new Error('房间已过期并自动删除，请重新创建房间或从备份恢复。'))
          this.handlers.onStatusChange?.('error')
          this.handlers.onClose?.()
          return
        }

        if (event.code === 1006) {
          this.handlers.onError?.(new Error('实时连接中断，可能是网络波动、会话失效或房间已过期。'))
        }
        this.scheduleReconnect()
      } else {
        this.handlers.onStatusChange?.('idle')
      }

      this.handlers.onClose?.()
    })

    this.socket.addEventListener('error', () => {
      if (this.disposed) return
      // close event will fire after error
    })

    this.socket.addEventListener('message', (event) => {
      if (this.disposed) return
      try {
        const data = typeof event.data === 'string' ? event.data : String(event.data)
        const message = safeJsonParse(data) as ServerMessage
        this.handlers.onMessage(message)
      } catch (error) {
        this.handlers.onError?.(error instanceof Error ? error : new Error(String(error)))
      }
    })
  }

  send(message: ClientMessage): boolean {
    if (this.disposed) return false
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message))
      return true
    }
    return false
  }

  /** Graceful close: stops reconnect, closes socket. Use when leaving room. */
  disconnect(): void {
    this.intentionalClose = true
    this.clearReconnectTimer()
    if (this.socket && this.socket.readyState < WebSocket.CLOSING) {
      this.socket.close()
    }
    this.socket = null
  }

  /** User-triggered reconnect: resets backoff and reconnects immediately. */
  manualReconnect(): void {
    this.intentionalClose = false
    this.reconnectAttempts = 0
    this.clearReconnectTimer()
    if (this.socket && this.socket.readyState < WebSocket.CLOSING) {
      this.socket.close()
    }
    this.socket = null
    this.connect()
  }

  dispose(): void {
    this.disposed = true
    this.intentionalClose = true
    this.clearReconnectTimer()
    this.removeNetworkListeners()
    this.removeUnloadListener()
    if (this.socket && this.socket.readyState < WebSocket.CLOSING) {
      this.socket.close()
    }
    this.socket = null
  }

  get isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN
  }

  // --- Private ---

  private scheduleReconnect(): void {
    if (this.disposed || this.intentionalClose) return
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.handlers.onError?.(new Error('与房间的连接恢复失败，请检查网络后手动重连。'))
      this.handlers.onStatusChange?.('error')
      return
    }
    if (!navigator.onLine) {
      this.handlers.onStatusChange?.('reconnecting')
      return
    }

    const delay = Math.min(BASE_BACKOFF_MS * Math.pow(2, this.reconnectAttempts), MAX_BACKOFF_MS)
    this.reconnectAttempts++
    this.handlers.onStatusChange?.('reconnecting')
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, delay)
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer != null) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private setupNetworkListeners(): void {
    window.addEventListener('online', this.onNetworkOnline)
    window.addEventListener('offline', this.onNetworkOffline)
  }

  private removeNetworkListeners(): void {
    window.removeEventListener('online', this.onNetworkOnline)
    window.removeEventListener('offline', this.onNetworkOffline)
  }

  private setupUnloadListener(): void {
    window.addEventListener('beforeunload', this.onBeforeUnload)
  }

  private removeUnloadListener(): void {
    window.removeEventListener('beforeunload', this.onBeforeUnload)
  }

  private onNetworkOnline = (): void => {
    if (this.disposed || this.intentionalClose) return
    if (this.socket?.readyState === WebSocket.OPEN) return
    this.reconnectAttempts = 0
    this.clearReconnectTimer()
    this.connect()
  }

  private onNetworkOffline = (): void => {
    this.clearReconnectTimer()
    this.handlers.onStatusChange?.('reconnecting')
  }

  private onBeforeUnload = (): void => {
    this.dispose()
  }
}

async function requestJson<T>(pathname: string, init?: RequestInit) {
  let response: Response
  try {
    response = await fetch(`${getRealtimeApiBase()}${pathname}`, {
      ...init,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        ...(init?.headers ?? {}),
      },
    })
  } catch {
    throw new Error('无法连接到服务器，请检查网络或稍后重试。')
  }

  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }

  return response.json() as Promise<T>
}

async function readErrorMessage(response: Response) {
  try {
    const payload = await response.json() as ApiErrorPayload
    return mapApiErrorMessage(payload, response.status)
  } catch {
    return `请求失败（${response.status}），请稍后重试。`
  }
}

function mapApiErrorMessage(payload: ApiErrorPayload, status: number) {
  switch (payload.error) {
    case 'room_expired':
      return '房间已过期并自动删除，请重新创建房间或从备份恢复。'
    case 'room_not_found':
      return '找不到对应房间，请检查邀请码是否正确。'
    case 'invite_code_required':
      return '请输入邀请码。'
    case 'nickname_required':
      return '请输入昵称。'
    case 'nickname_in_use':
      return payload.message ?? '该昵称已在房间中在线使用，请更换昵称或等待原会话断开。'
    case 'not_found':
      return '请求的服务不存在。'
    case 'internal_error':
      return payload.message ? `服务端处理失败：${payload.message}` : '服务端处理失败，请稍后重试。'
    default:
      return payload.message ?? payload.error ?? `请求失败（${status}），请稍后重试。`
  }
}
