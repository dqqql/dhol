import React from 'react'
import { useStore } from '@/store/useStore'
import type { DeckCardType, DhCard } from '@/types'
import { getCardVisualConfig } from '@/utils/cardTypeConfig'
import { Modal } from './Modal'
import { Zap } from 'lucide-react'

const DRAW_ORDER: DeckCardType[] = ['Location', 'Feature', 'Hook']

export function DrawModal() {
  const { isDrawModalOpen, drawOptions, closeDrawModal, confirmDraw } = useStore()
  const sortedOptions = [...drawOptions].sort((a, b) => DRAW_ORDER.indexOf(a.type as DeckCardType) - DRAW_ORDER.indexOf(b.type as DeckCardType))

  return (
    <Modal open={isDrawModalOpen} onClose={closeDrawModal} title="抽牌 · 各类选一" maxWidth={680}>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20 }}>
        系统会从三个类别中各翻出一张卡牌。请选择其中一张加入手牌，其余两张留在牌堆中。
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {sortedOptions.map((card, i) => (
          <DrawOptionCard key={card.id} card={card} delay={i * 80} onSelect={() => confirmDraw(card.id)} />
        ))}
      </div>
      <div style={{ marginTop: 16, textAlign: 'center' }}>
        <button className="btn btn-ghost btn-sm" onClick={closeDrawModal}>
          取消
        </button>
      </div>
    </Modal>
  )
}

function DrawOptionCard({ card, delay, onSelect }: { card: DhCard; delay: number; onSelect: () => void }) {
  const cfg = getCardVisualConfig(card.type, card.style, card.custom_type_name)

  return (
    <button
      className="draw-card-enter"
      style={{
        animationDelay: `${delay}ms`,
        background: 'var(--bg-overlay)',
        border: `1px solid var(--border-default)`,
        borderRadius: 'var(--radius-md)',
        padding: 14,
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'all 0.2s',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget
        el.style.borderColor = cfg.color
        el.style.boxShadow = `0 0 20px ${cfg.color}33, var(--shadow-card)`
        el.style.transform = 'scale(1.03)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget
        el.style.borderColor = 'var(--border-default)'
        el.style.boxShadow = ''
        el.style.transform = ''
      }}
      onClick={onSelect}
    >
      {/* Stripe */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: cfg.color }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, marginTop: 4 }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '2px 7px', borderRadius: 99,
          fontSize: 10, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase',
          background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
        }}>
          <cfg.Icon size={10} /> {cfg.label}
        </span>
      </div>

      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6, lineHeight: 1.4, fontFamily: '"Noto Sans SC", sans-serif' }}>
        {card.title}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6, fontFamily: '"Noto Sans SC", sans-serif', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {card.content}
      </div>

      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 4, color: cfg.color, fontSize: 11, fontWeight: 600 }}>
        <Zap size={11} /> 选择此卡
      </div>
    </button>
  )
}
