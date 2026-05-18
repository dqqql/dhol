import type { DhCard } from '@/types'

export function getRoleDetailEntries(card: Pick<DhCard, 'type' | 'role_details'>) {
  if (card.type !== 'Role') return []

  const details = card.role_details
  return [
    { label: '名字', value: details?.player_name?.trim() || '待填写' },
    { label: '职业', value: details?.profession?.trim() || '待填写' },
    { label: '种族', value: details?.ancestry?.trim() || '待填写' },
    { label: '社群', value: details?.community?.trim() || '待填写' },
  ]
}

export function getCardBodyLines(card: Pick<DhCard, 'type' | 'content' | 'role_details'>) {
  const roleLines = getRoleDetailEntries(card).map((entry) => `${entry.label}：${entry.value}`)
  const content = card.content.trim()
  return content ? [...roleLines, content] : roleLines
}

export function getCardBodyText(card: Pick<DhCard, 'type' | 'content' | 'role_details'>) {
  return getCardBodyLines(card).join('\n')
}
