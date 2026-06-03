import { useEffect, useState } from 'react'
import type { MobilePanelCharacterEntry } from '@dhgc/shared'
import { MobileFearAndCountdowns } from '@/components/mobile-panel/MobileFearAndCountdowns'
import { MobileCharacterList } from '@/components/mobile-panel/MobileCharacterList'
import {
  MobileAddCharacterModal,
  MobileCharacterDetailModal,
  MobileEditCharacterModal,
  MobileReplaceCharacterModal,
  MobileDeleteCharacterModal,
  MobileActivityLogModal,
  buildEmptyExperienceDrafts,
  buildExperienceDrafts,
  normalizeExperiences,
  type ExperienceDraft,
} from '@/components/mobile-panel/MobileCharacterModals'
import { useStore } from '@/store/useStore'

export function MobilePanelRoom() {
  const {
    room,
    importMobileCharacter,
    replaceMobileCharacter,
    deleteMobileCharacter,
    updateMobileCharacterCustom,
    updateMobileResource,
    updateMobileFear,
    createMobileCountdown,
    updateMobileCountdown,
    deleteMobileCountdown,
    addToast,
  } = useStore()

  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isLogOpen, setIsLogOpen] = useState(false)
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null)
  const [editingCharacterId, setEditingCharacterId] = useState<string | null>(null)
  const [replacingCharacterId, setReplacingCharacterId] = useState<string | null>(null)
  const [deletingCharacterId, setDeletingCharacterId] = useState<string | null>(null)
  const [draftCode, setDraftCode] = useState('')
  const [draftDisplayName, setDraftDisplayName] = useState('')
  const [draftExperiences, setDraftExperiences] = useState<ExperienceDraft[]>(buildEmptyExperienceDrafts())
  const [replaceCode, setReplaceCode] = useState('')
  const [countdownName, setCountdownName] = useState('')
  const [countdownMax, setCountdownMax] = useState('6')
  const [activeCharacterMenuId, setActiveCharacterMenuId] = useState<string | null>(null)

  const panel = room?.room_type === 'mobile-panel' ? room.mobile_panel : null
  const orderedCharacters = panel
    ? panel.character_order
      .map((characterId) => panel.characters.find((item) => item.id === characterId) ?? null)
      .filter((item): item is MobilePanelCharacterEntry => Boolean(item))
    : []
  const selectedCharacter = panel && selectedCharacterId
    ? panel.characters.find((item) => item.id === selectedCharacterId) ?? null
    : null
  const editingCharacter = panel && editingCharacterId
    ? panel.characters.find((item) => item.id === editingCharacterId) ?? null
    : null
  const replacingCharacter = panel && replacingCharacterId
    ? panel.characters.find((item) => item.id === replacingCharacterId) ?? null
    : null
  const deletingCharacter = panel && deletingCharacterId
    ? panel.characters.find((item) => item.id === deletingCharacterId) ?? null
    : null

  useEffect(() => {
    if (!editingCharacter) return
    setDraftDisplayName(editingCharacter.custom.display_name)
    setDraftExperiences(buildExperienceDrafts(editingCharacter.custom.experiences))
  }, [editingCharacter])

  useEffect(() => {
    if (!isAddOpen) return
    setDraftCode('')
    setDraftDisplayName('')
    setDraftExperiences(buildEmptyExperienceDrafts())
  }, [isAddOpen])

  useEffect(() => {
    if (!replacingCharacterId) {
      setReplaceCode('')
    }
  }, [replacingCharacterId])

  useEffect(() => {
    if (!activeCharacterMenuId) return

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as HTMLElement | null
      if (target?.closest('[data-mobile-actions-root="true"]')) return
      setActiveCharacterMenuId(null)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [activeCharacterMenuId])

  function updateExperience(index: number, key: 'name' | 'value', value: string) {
    setDraftExperiences((current) => current.map((item, currentIndex) => (
      currentIndex === index ? { ...item, [key]: value } : item
    )))
  }

  function submitCreateCharacter() {
    if (!draftCode.trim()) {
      addToast('请输入角色码。', 'error')
      return
    }
    importMobileCharacter(draftCode.trim(), draftDisplayName.trim(), normalizeExperiences(draftExperiences))
    setIsAddOpen(false)
    addToast('角色码已提交导入。', 'success')
  }

  function submitEditCharacter() {
    if (!editingCharacter) return
    updateMobileCharacterCustom(editingCharacter.id, draftDisplayName.trim(), normalizeExperiences(draftExperiences))
    setEditingCharacterId(null)
    addToast('角色自定义信息已更新。', 'success')
  }

  function submitReplaceCharacter() {
    if (!replacingCharacter) return
    if (!replaceCode.trim()) {
      addToast('请输入新的角色码。', 'error')
      return
    }
    replaceMobileCharacter(replacingCharacter.id, replaceCode.trim())
    setReplacingCharacterId(null)
    addToast('新的角色码已提交。', 'success')
  }

  function submitCountdown() {
    if (!panel) return
    createMobileCountdown(
      countdownName.trim() || `进度钟 ${panel.countdowns.length + 1}`,
      Math.max(2, Math.min(12, Number.parseInt(countdownMax, 10) || 6)),
    )
    setCountdownName('')
    setCountdownMax('6')
  }

  function closeActionMenus() {
    setActiveCharacterMenuId(null)
  }

  function openAddCharacter() {
    closeActionMenus()
    setIsAddOpen(true)
  }

  function openActivityLog() {
    closeActionMenus()
    setIsLogOpen(true)
  }

  function openEditCharacter(characterId: string) {
    closeActionMenus()
    setEditingCharacterId(characterId)
  }

  function openReplaceCharacter(characterId: string) {
    closeActionMenus()
    setReplacingCharacterId(characterId)
  }

  function openDeleteCharacter(characterId: string) {
    closeActionMenus()
    setDeletingCharacterId(characterId)
  }

  if (!panel) return null

  return (
    <div
      style={{
        height: '100%',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        overscrollBehaviorY: 'contain',
        touchAction: 'pan-y',
        background: 'linear-gradient(180deg, #f7efe5 0%, #efe0ca 38%, #ead8bf 100%)',
        padding: '18px 14px 28px',
      }}
    >
      <div style={{ maxWidth: 1180, margin: '0 auto', display: 'grid', gap: 16 }}>
        <div
          style={{
            display: 'grid',
            gap: 16,
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            alignItems: 'start',
          }}
        >
          <MobileFearAndCountdowns
            fearValue={panel.fear.value}
            fearMax={panel.fear.max}
            countdowns={panel.countdowns}
            countdownName={countdownName}
            countdownMax={countdownMax}
            onCountdownNameChange={setCountdownName}
            onCountdownMaxChange={setCountdownMax}
            onUpdateFear={updateMobileFear}
            onUpdateCountdown={updateMobileCountdown}
            onDeleteCountdown={deleteMobileCountdown}
            onCreateCountdown={submitCountdown}
          />

          <MobileCharacterList
            orderedCharacters={orderedCharacters}
            activeCharacterMenuId={activeCharacterMenuId}
            onSelectCharacter={(id) => {
              closeActionMenus()
              setSelectedCharacterId(id)
            }}
            onToggleMenu={(id) => setActiveCharacterMenuId((current) => current === id ? null : id)}
            onOpenActivityLog={openActivityLog}
            onOpenAddCharacter={openAddCharacter}
            onEditCharacter={openEditCharacter}
            onReplaceCharacter={openReplaceCharacter}
            onDeleteCharacter={openDeleteCharacter}
          />
        </div>
      </div>

      <MobileAddCharacterModal
        isOpen={isAddOpen}
        draftCode={draftCode}
        draftDisplayName={draftDisplayName}
        draftExperiences={draftExperiences}
        onClose={() => setIsAddOpen(false)}
        onCodeChange={setDraftCode}
        onDisplayNameChange={setDraftDisplayName}
        onExperienceChange={updateExperience}
        onSubmit={submitCreateCharacter}
      />

      <MobileCharacterDetailModal
        character={selectedCharacter}
        onClose={() => setSelectedCharacterId(null)}
        onUpdateResource={(id, key, value) => updateMobileResource(id, key as Parameters<typeof updateMobileResource>[1], value as Parameters<typeof updateMobileResource>[2])}
      />

      <MobileEditCharacterModal
        character={editingCharacter}
        draftDisplayName={draftDisplayName}
        draftExperiences={draftExperiences}
        onClose={() => setEditingCharacterId(null)}
        onDisplayNameChange={setDraftDisplayName}
        onExperienceChange={updateExperience}
        onSubmit={submitEditCharacter}
      />

      <MobileReplaceCharacterModal
        character={replacingCharacter}
        replaceCode={replaceCode}
        onClose={() => setReplacingCharacterId(null)}
        onCodeChange={setReplaceCode}
        onSubmit={submitReplaceCharacter}
      />

      <MobileDeleteCharacterModal
        character={deletingCharacter}
        onClose={() => setDeletingCharacterId(null)}
        onConfirm={() => {
          if (!deletingCharacter) return
          deleteMobileCharacter(deletingCharacter.id)
          setDeletingCharacterId(null)
          addToast('角色已删除。', 'success')
        }}
      />

      <MobileActivityLogModal
        isOpen={isLogOpen}
        logs={panel.activity_log}
        onClose={() => setIsLogOpen(false)}
      />
    </div>
  )
}
