import type { GmPanelThemeDefinition } from '@/components/gm-panel/gmPanelThemes'

function repairKnownGmLogMessage(message: string) {
  return message.replaceAll('鍒犻櫎浜嗚鑹插崱', '删除了角色卡')
}

function formatTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

export function GmActivityLogPanel({
  logs,
  theme,
}: {
  logs: Array<{ id: string; created_at: string; actor_name: string; message: string }>
  theme: GmPanelThemeDefinition
}) {
  return (
    <section
      style={{
        padding: 18,
        border: `1px solid ${theme.colors.logBorder}`,
        background: theme.colors.logBackground,
        boxShadow: theme.colors.logShadow,
      }}
    >
      <div style={{ marginBottom: 12, fontSize: 15, fontWeight: 800, color: theme.colors.logTitle, letterSpacing: '0.01em' }}>活动记录</div>
      <div style={{ display: 'grid', gap: 10, maxHeight: 260, overflowY: 'auto' }}>
        {logs.length === 0 ? (
          <div style={{ fontSize: 13, color: theme.colors.logEmpty }}>还没有记录。</div>
        ) : (
          [...logs].reverse().map((log) => (
            <div key={log.id} style={{ padding: 12, background: theme.colors.logItemBackground, border: `1px solid ${theme.colors.logItemBorder}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: theme.colors.logActor }}>{log.actor_name}</span>
                <span style={{ fontSize: 11, color: theme.colors.logTime }}>{formatTime(log.created_at)}</span>
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.6, color: theme.colors.logText }}>{repairKnownGmLogMessage(log.message)}</div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
