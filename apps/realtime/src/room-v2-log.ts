import type { MutationCommand, RoomEvent } from '@dhgc/shared/desktop'

// Describe committed values, so clamped counters and rejected operations cannot
// produce misleading history. Actor identity and timestamps come from the server.
export function roomActionText(command: MutationCommand, event: RoomEvent, deletedClockName?: string): string | null {
  switch (event.type) {
    case 'character.deleted': return `已移除角色【${event.name}】`
    case 'character.resourcesChanged': {
      if (command.type === 'character.adjustHope') return `${event.name} 希望点 → ${event.resources.hope}`
      if (command.type === 'character.setMark') {
        const label = { hp: '生命', stress: '压力', armor: '护甲', gold: '金币' }[command.resource]
        return `${event.name} ${command.marked ? '标记' : '清除'}${label}${command.resource === 'gold' && command.index === 20 ? '箱' : `第 ${command.index + 1} 格`}`
      }
      if (command.type === 'character.addIndicator') return `${event.name} 新建指示物【${command.indicatorName}】(${command.value})`
      if (command.type === 'character.adjustIndicator') {
        const indicator = event.resources.indicators?.find(item => item.id === command.id)
        return indicator ? `${event.name} 指示物【${indicator.name}】→ ${indicator.value}` : `${event.name} 指示物归零，已移除`
      }
      return null
    }
    case 'room.fearChanged': return `恐惧点 → ${event.fear.value}`
    case 'xcard.changed': return event.xCard.active ? 'X卡已激活（战局暂停）' : 'X卡已解除'
    case 'clock.changed': return `${command.type === 'clock.create' ? '新建' : command.type === 'clock.reset' ? '重置' : '调整'}倒计时【${event.clock.name}】${event.clock.value}/${event.clock.max}${event.clock.value === event.clock.max ? '，已满格触发！' : ''}`
    case 'clock.deleted': return `已删除倒计时【${deletedClockName ?? event.id}】`
    case 'dice.rolled': return `掷骰 ${event.roll.normalized_formula}`
    case 'dice.historyCleared': return '已清空掷骰记录'
    case 'map.token.changed': return `${command.type === 'map.token.create' ? '新增' : '更新'} Token【${event.token.name}】`
    case 'map.token.deleted': return '已删除 Token'
    case 'map.stroke.added': return '添加地图笔迹'
    case 'map.stroke.deleted': return '擦除地图笔迹'
    default: return null
  }
}
