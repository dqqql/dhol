import React from 'react'

type MarkdownBlock =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'quote'; text: string }
  | { type: 'divider' }

function parseMarkdownBlocks(source: string): MarkdownBlock[] {
  const normalized = source.replace(/\r\n/g, '\n').trim()
  if (!normalized) return []

  const lines = normalized.split('\n')
  const blocks: MarkdownBlock[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index].trim()

    if (!line) {
      index += 1
      continue
    }

    if (/^---+$/.test(line) || /^\*\*\*+$/.test(line)) {
      blocks.push({ type: 'divider' })
      index += 1
      continue
    }

    const headingMatch = line.match(/^(#{1,4})\s+(.*)$/)
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        text: headingMatch[2].trim(),
      })
      index += 1
      continue
    }

    const quoteMatch = line.match(/^>\s?(.*)$/)
    if (quoteMatch) {
      const quoteLines: string[] = [quoteMatch[1]]
      index += 1
      while (index < lines.length) {
        const nextMatch = lines[index].trim().match(/^>\s?(.*)$/)
        if (!nextMatch) break
        quoteLines.push(nextMatch[1])
        index += 1
      }
      blocks.push({ type: 'quote', text: quoteLines.join('\n').trim() })
      continue
    }

    const unorderedMatch = line.match(/^[-*]\s+(.*)$/)
    if (unorderedMatch) {
      const items: string[] = [unorderedMatch[1].trim()]
      index += 1
      while (index < lines.length) {
        const nextMatch = lines[index].trim().match(/^[-*]\s+(.*)$/)
        if (!nextMatch) break
        items.push(nextMatch[1].trim())
        index += 1
      }
      blocks.push({ type: 'list', ordered: false, items })
      continue
    }

    const orderedMatch = line.match(/^\d+\.\s+(.*)$/)
    if (orderedMatch) {
      const items: string[] = [orderedMatch[1].trim()]
      index += 1
      while (index < lines.length) {
        const nextMatch = lines[index].trim().match(/^\d+\.\s+(.*)$/)
        if (!nextMatch) break
        items.push(nextMatch[1].trim())
        index += 1
      }
      blocks.push({ type: 'list', ordered: true, items })
      continue
    }

    const paragraphLines = [line]
    index += 1
    while (index < lines.length) {
      const nextLine = lines[index].trim()
      if (!nextLine) {
        index += 1
        break
      }
      if (
        /^(#{1,4})\s+/.test(nextLine)
        || /^>\s?/.test(nextLine)
        || /^[-*]\s+/.test(nextLine)
        || /^\d+\.\s+/.test(nextLine)
        || /^---+$/.test(nextLine)
        || /^\*\*\*+$/.test(nextLine)
      ) {
        break
      }
      paragraphLines.push(nextLine)
      index += 1
    }
    blocks.push({ type: 'paragraph', text: paragraphLines.join('\n') })
  }

  return blocks
}

function renderMarkdownInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  const pattern = /(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g
  let lastIndex = 0

  for (const match of text.matchAll(pattern)) {
    const full = match[0]
    const index = match.index ?? 0
    if (index > lastIndex) {
      nodes.push(text.slice(lastIndex, index))
    }

    if (full.startsWith('***') && full.endsWith('***')) {
      nodes.push(
        <strong key={`${index}-bold-italic`} style={{ fontWeight: 800 }}>
          <em style={{ fontStyle: 'italic' }}>{full.slice(3, -3)}</em>
        </strong>,
      )
    } else if (full.startsWith('**') && full.endsWith('**')) {
      nodes.push(<strong key={`${index}-bold`}>{full.slice(2, -2)}</strong>)
    } else if (full.startsWith('*') && full.endsWith('*')) {
      nodes.push(<em key={`${index}-italic`}>{full.slice(1, -1)}</em>)
    } else if (full.startsWith('`') && full.endsWith('`')) {
      nodes.push(
        <code
          key={`${index}-code`}
          style={{
            padding: '1px 5px',
            borderRadius: 6,
            background: 'rgba(113, 88, 52, 0.1)',
            border: '1px solid rgba(113, 88, 52, 0.14)',
            fontSize: '0.92em',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          }}
        >
          {full.slice(1, -1)}
        </code>,
      )
    } else {
      const linkMatch = full.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
      if (linkMatch) {
        nodes.push(
          <a
            key={`${index}-link`}
            href={linkMatch[2]}
            target="_blank"
            rel="noreferrer"
            style={{ color: '#8b5e34', textDecoration: 'underline', textUnderlineOffset: 2 }}
          >
            {linkMatch[1]}
          </a>,
        )
      } else {
        nodes.push(full)
      }
    }

    lastIndex = index + full.length
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }

  return nodes.length ? nodes : [text]
}

function renderMarkdownText(text: string) {
  return text.split('\n').map((line, index) => (
    <React.Fragment key={`${line}-${index}`}>
      {index > 0 ? <br /> : null}
      {renderMarkdownInline(line)}
    </React.Fragment>
  ))
}

export function SectionCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        padding: 14,
        background: 'rgba(250, 243, 233, 0.72)',
        border: '1px solid rgba(113, 88, 52, 0.12)',
        display: 'grid',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 900, color: 'var(--text-primary)' }}>
        {icon}
        {title}
      </div>
      <div style={{ display: 'grid', gap: 10 }}>{children}</div>
    </section>
  )
}

export function InfoBlock({ title, body }: { title: string; body: string }) {
  const blocks = parseMarkdownBlocks(body)

  return (
    <div
      style={{
        padding: '10px 12px',
        background: 'rgba(255,255,255,0.82)',
        border: '1px solid rgba(113, 88, 52, 0.12)',
        display: 'grid',
        gap: 6,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>{title}</div>
      <div style={{ display: 'grid', gap: 8, fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
        {blocks.length ? blocks.map((block, index) => {
          if (block.type === 'heading') {
            return (
              <div
                key={`${title}-heading-${index}`}
                style={{
                  fontSize: block.level <= 2 ? 14 : 13,
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                }}
              >
                {renderMarkdownInline(block.text)}
              </div>
            )
          }

          if (block.type === 'divider') {
            return <div key={`${title}-divider-${index}`} style={{ height: 1, background: 'rgba(113, 88, 52, 0.16)' }} />
          }

          if (block.type === 'quote') {
            return (
              <blockquote
                key={`${title}-quote-${index}`}
                style={{
                  margin: 0,
                  padding: '4px 0 4px 12px',
                  borderLeft: '3px solid rgba(139, 94, 52, 0.35)',
                  color: 'var(--text-secondary)',
                }}
              >
                {renderMarkdownText(block.text)}
              </blockquote>
            )
          }

          if (block.type === 'list') {
            const ListTag = block.ordered ? 'ol' : 'ul'
            return (
              <ListTag
                key={`${title}-list-${index}`}
                style={{
                  margin: 0,
                  paddingLeft: block.ordered ? 20 : 18,
                  display: 'grid',
                  gap: 4,
                }}
              >
                {block.items.map((item, itemIndex) => (
                  <li key={`${title}-list-${index}-${itemIndex}`}>{renderMarkdownText(item)}</li>
                ))}
              </ListTag>
            )
          }

          return (
            <p key={`${title}-paragraph-${index}`} style={{ margin: 0 }}>
              {renderMarkdownText(block.text)}
            </p>
          )
        }) : '无文本内容。'}
      </div>
    </div>
  )
}
