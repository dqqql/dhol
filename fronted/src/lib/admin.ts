import { getRealtimeApiBase } from './realtime'

export interface AdminRoomSummary {
  room_id: string
  room_name: string
  room_type: 'gm-panel' | 'mobile-panel'
  invite_code: string
  created_at: string
  expires_at: string
  updated_at: string
  player_count: number
  online_player_count: number
}

interface AdminApiError {
  error?: string
  message?: string
}

export function fetchAdminRoom(inviteCode: string, secret: string) {
  return adminRequest<AdminRoomSummary>(inviteCode, secret)
}

export function updateAdminRoomExpiry(inviteCode: string, secret: string, durationDays: number) {
  return adminRequest<AdminRoomSummary>(inviteCode, secret, {
    method: 'PATCH',
    body: JSON.stringify({ duration_days: durationDays }),
  })
}

async function adminRequest<T>(
  inviteCode: string,
  secret: string,
  init: RequestInit = {},
): Promise<T> {
  let response: Response

  try {
    response = await fetch(
      `${getRealtimeApiBase()}/api/admin/rooms/${encodeURIComponent(inviteCode)}`,
      {
        ...init,
        headers: {
          authorization: `Bearer ${secret}`,
          'content-type': 'application/json; charset=utf-8',
          ...(init.headers ?? {}),
        },
      },
    )
  } catch {
    throw new Error('无法连接管理服务，请检查网络或稍后重试。')
  }

  if (!response.ok) {
    throw new Error(await readAdminError(response))
  }

  return response.json() as Promise<T>
}

async function readAdminError(response: Response): Promise<string> {
  try {
    const payload = await response.json() as AdminApiError
    switch (payload.error) {
      case 'unauthorized':
        return '管理密钥不正确。'
      case 'admin_not_configured':
        return '服务端尚未配置 ADMIN_SECRET。'
      case 'room_not_found':
        return '找不到对应房间，请检查邀请码。'
      case 'room_expired':
        return '该房间已经过期并被清理，无法再续期。'
      case 'invalid_duration_days':
        return '持续天数必须是 1 到 365 之间的整数。'
      default:
        return payload.message ?? payload.error ?? `管理请求失败（${response.status}）。`
    }
  } catch {
    return `管理请求失败（${response.status}）。`
  }
}
