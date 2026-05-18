import React, { useState, useCallback } from 'react'
import ReactDOM from 'react-dom'
import { X, ChevronLeft, ChevronRight, BookOpen, Users, Map, Link2, StickyNote, Download, Layers, Swords } from 'lucide-react'

interface TutorialSlide {
  icon: React.ReactNode
  title: string
  subtitle: string
  color: string
  points: { emoji: string; text: string }[]
}

const slides: TutorialSlide[] = [
  {
    icon: <BookOpen size={28} />,
    title: '欢迎使用 匕首之心',
    subtitle: '团前共创工具 · 多人卡牌地图协作',
    color: 'linear-gradient(135deg, #2563eb, #7c3aed)',
    points: [
      { emoji: '🏰', text: '专为《匕首之心》TRPG 设计的团前共创平台' },
      { emoji: '👥', text: '支持多人实时在线协作，共同构建世界观' },
      { emoji: '🗺️', text: '可视化地图画布，直观整理地点与人物关系' },
      { emoji: '🃏', text: '卡牌系统，让共创过程不缺灵感' },
    ],
  },
  {
    icon: <Users size={28} />,
    title: '创建与加入房间',
    subtitle: '开始你的共创之旅',
    color: 'linear-gradient(135deg, #059669, #0891b2)',
    points: [
      { emoji: '➕', text: '创建房间：输入房间名与昵称，获得 6 位邀请码' },
      { emoji: '🔑', text: '加入房间：输入邀请码即可加入他人的房间' },
      { emoji: '⏰', text: '房间最长保留 3 天，建议每次共创完成后导出房间备份' },
      { emoji: '🔄', text: '断线重连：输入邀请码，以同样昵称进入可进入还未删除的房间' },
    ],
  },
  {
    icon: <Swords size={28} />,
    title: '共创模式流转',
    subtitle: '三阶段引导你完成团前共创',
    color: 'linear-gradient(135deg, #7c3aed, #db2777)',
    points: [
      { emoji: '🌐', text: '自由模式：整理地图、添加标注与连线' },
      { emoji: '🎴', text: '共创模式：房主开启后发放初始手牌，轮流打牌构建世界' },
      { emoji: '👑', text: '房主可随时开始/结束共创；房主离线时自动转移给下一位在线玩家' },
    ],
  },
  {
    icon: <Layers size={28} />,
    title: '手牌与回合系统',
    subtitle: '共创阶段的核心玩法',
    color: 'linear-gradient(135deg, #d97706, #dc2626)',
    points: [
      { emoji: '🎁', text: '初始手牌：每人 1 张角色卡 + 地点/特色/故事卡各 2 张' },
      { emoji: '🃏', text: '抽牌：每回合可从三类牌堆各翻一张，选一张加入手牌' },
      { emoji: '▶️', text: '打牌：每回合不限制出牌次数，并且可以自己创建卡牌加入手中' },
      { emoji: '🗂️', text: '手牌区可查看所有卡牌详情，悬浮展示完整信息' },
    ],
  },
  {
    icon: <Map size={28} />,
    title: '地图画布操作',
    subtitle: '构建你的世界地图',
    color: 'linear-gradient(135deg, #0891b2, #2563eb)',
    points: [
      { emoji: '🖱️', text: '滚轮缩放画布，拖拽空白区域平移视角' },
      { emoji: '🃏', text: '从手牌区拖拽卡牌到地图上，即可打出到地图' },
      { emoji: '📍', text: '地点卡右键可以标记范围，可独立调整大小' },
      { emoji: '✏️', text: '右键地图上的卡牌，可编辑标题与描述内容' },
      { emoji: '🔒', text: '拖动卡牌时会临时锁定，防止多人同时修改同一张卡' },
    ],
  },
  {
    icon: <Link2 size={28} />,
    title: '连线与关系标注',
    subtitle: '描绘人物与地点的关联',
    color: 'linear-gradient(135deg, #7c3aed, #059669)',
    points: [
      { emoji: '🔗', text: '右键地图卡牌 → 「创建连线」，选择目标卡牌建立关系' },
      { emoji: '🔴', text: '连线支持三种颜色：红色（冲突）、绿色（同盟）、灰色（未知）' },
      { emoji: '🏷️', text: '可为连线添加文字标签，说明两者之间的具体关系' },
      { emoji: '🗑️', text: '点击连线标签可进入编辑，也可从右键菜单删除连线' },
    ],
  },
  {
    icon: <StickyNote size={28} />,
    title: '地图标注',
    subtitle: '在地图任意位置添加文字备注',
    color: 'linear-gradient(135deg, #b45309, #7c3aed)',
    points: [
      { emoji: '📝', text: '左侧选择标注工具，可在任意位置创建文字，并且在最上层' },
      { emoji: '↕️', text: '可调整标注字号大小，适应不同场景的信息密度' },
      { emoji: '🔄', text: '标注支持拖动位置，并与所有玩家实时同步' },
    ],
  },
  {
    icon: <Download size={28} />,
    title: '导入导出与备份',
    subtitle: '保存你的共创成果',
    color: 'linear-gradient(135deg, #0f766e, #0891b2)',
    points: [
      { emoji: '💾', text: '导出 .dhroom.json：完整备份房间所有状态，随时恢复' },
      { emoji: '📄', text: '导出 Markdown：将地图内容整理成叙事摘要文档' },
      { emoji: '📦', text: '导入 .dhpack.json 卡包：地图上所有打出的卡牌，导出成私有的卡牌包，方便后续扩展' },
      { emoji: '⚠️', text: '建议每次共创结束后立即导出备份，房间3天后自动删除' },
    ],
  },
]

interface TutorialModalProps {
  onClose: () => void
}

export function TutorialModal({ onClose }: TutorialModalProps) {
  const [page, setPage] = useState(0)
  const total = slides.length
  const slide = slides[page]

  const prev = useCallback(() => setPage((p) => Math.max(0, p - 1)), [])
  const next = useCallback(() => setPage((p) => Math.min(total - 1, p + 1)), [total])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
      if (e.key === 'Escape') onClose()
    },
    [prev, next, onClose],
  )

  return ReactDOM.createPortal(
    <div
      className="modal-overlay"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
      style={{ zIndex: 2000 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 520,
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-panel)',
          borderRadius: 'var(--radius-xl)',
          overflow: 'hidden',
          animation: 'slideUp var(--transition-normal)',
          position: 'relative',
        }}
      >
        {/* Header gradient strip */}
        <div
          style={{
            background: slide.color,
            padding: '28px 28px 24px',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Decorative circles */}
          <div
            style={{
              position: 'absolute',
              width: 180,
              height: 180,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.07)',
              top: -60,
              right: -40,
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              width: 100,
              height: 100,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.05)',
              bottom: -30,
              left: 20,
              pointerEvents: 'none',
            }}
          />

          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
              width: 30,
              height: 30,
              borderRadius: '50%',
              border: 'none',
              background: 'rgba(255,255,255,0.18)',
              color: 'rgba(255,255,255,0.85)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 150ms',
              zIndex: 1,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.28)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.18)')}
          >
            <X size={16} />
          </button>

          {/* Page indicator pills */}
          <div
            style={{
              position: 'absolute',
              top: 18,
              left: 28,
              display: 'flex',
              gap: 5,
              zIndex: 1,
            }}
          >
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                style={{
                  width: i === page ? 20 : 6,
                  height: 6,
                  borderRadius: 3,
                  border: 'none',
                  background: i === page ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.35)',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'all 250ms cubic-bezier(0.4,0,0.2,1)',
                  flexShrink: 0,
                }}
              />
            ))}
          </div>

          {/* Icon + title */}
          <div style={{ marginTop: 20, position: 'relative', zIndex: 1 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 52,
                height: 52,
                borderRadius: 'var(--radius-lg)',
                background: 'rgba(255,255,255,0.18)',
                color: 'white',
                marginBottom: 14,
                backdropFilter: 'blur(8px)',
              }}
            >
              {slide.icon}
            </div>
            <h2
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: 'white',
                letterSpacing: '-0.02em',
                marginBottom: 4,
                lineHeight: 1.2,
              }}
            >
              {slide.title}
            </h2>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>
              {slide.subtitle}
            </p>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '22px 28px 20px', minHeight: 320 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {slide.points.map((point, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: '10px 14px',
                  background: 'var(--bg-overlay)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  animation: `tutorialPointIn ${150 + i * 50}ms ease both`,
                }}
              >
                <span style={{ fontSize: 16, lineHeight: 1.5, flexShrink: 0 }}>{point.emoji}</span>
                <span
                  style={{
                    fontSize: 13.5,
                    lineHeight: 1.65,
                    color: 'var(--text-secondary)',
                    fontWeight: 450,
                  }}
                >
                  {point.text}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer navigation */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 20px 16px',
            borderTop: '1px solid var(--border-subtle)',
            gap: 8,
          }}
        >
          <button
            onClick={prev}
            disabled={page === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 14px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-default)',
              background: 'var(--bg-overlay)',
              color: page === 0 ? 'var(--text-muted)' : 'var(--text-primary)',
              cursor: page === 0 ? 'not-allowed' : 'pointer',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'inherit',
              opacity: page === 0 ? 0.4 : 1,
              transition: 'all 150ms',
            }}
          >
            <ChevronLeft size={15} />
            上一页
          </button>

          <span
            style={{
              fontSize: 12,
              color: 'var(--text-muted)',
              fontWeight: 600,
              letterSpacing: '0.5px',
            }}
          >
            {page + 1} / {total}
          </span>

          {page < total - 1 ? (
            <button
              onClick={next}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 14px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: 'linear-gradient(135deg, var(--accent-violet), #7c3aed)',
                color: 'white',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                fontFamily: 'inherit',
                boxShadow: '0 2px 8px rgba(37,99,235,0.3)',
                transition: 'all 150ms',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-1px)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = '')}
            >
              下一页
              <ChevronRight size={15} />
            </button>
          ) : (
            <button
              onClick={onClose}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 14px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: 'linear-gradient(135deg, #059669, #0891b2)',
                color: 'white',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                fontFamily: 'inherit',
                boxShadow: '0 2px 8px rgba(5,150,105,0.3)',
                transition: 'all 150ms',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-1px)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = '')}
            >
              开始使用 ✨
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes tutorialPointIn {
          from { opacity: 0; transform: translateX(-8px); }
          to   { opacity: 1; transform: none; }
        }
      `}</style>
    </div>,
    document.body,
  )
}
