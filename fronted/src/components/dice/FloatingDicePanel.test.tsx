import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { LatestRollStage } from './FloatingDicePanel'

describe('LatestRollStage', () => {
  it('renders a non-authoritative waiting state while a dice roll is pending', () => {
    const markup = renderToStaticMarkup(<LatestRollStage pendingCount={1} />)

    expect(markup).toContain('掷骰中')
    expect(markup).toContain('aria-busy="true"')
    expect(markup).toContain('等待服务器返回权威结果')
    expect(markup).not.toContain('最新掷骰结果')
  })
})
