import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import DesktopLanding from '../desktop/DesktopLanding'
import { saveRoomHistoryItem, saveSavedNickname } from '../desktop/room-history'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('DesktopLanding history display', () => {
  it('renders history rooms when saved nickname exists and has history', () => {
    const memory = new Map<string, string>()
    const storage: Storage = {
      get length() { return memory.size },
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => { memory.set(key, value) },
      removeItem: (key: string) => { memory.delete(key) },
      clear: () => { memory.clear() },
      key: (i: number) => Array.from(memory.keys())[i] ?? null,
    }

    saveSavedNickname('不冻港', storage)
    saveRoomHistoryItem('不冻港', 'NEB4F8', '冰风谷避难所', storage)
    saveRoomHistoryItem('不冻港', 'K7X9PQ', '冒险者酒馆', storage)

    vi.stubGlobal('localStorage', storage)
    vi.stubGlobal('window', { location: { search: '', origin: 'https://screenol.pages.dev' }, localStorage: storage })

    const html = renderToStaticMarkup(<DesktopLanding onEnter={() => {}} />)

    expect(html).toContain('value="不冻港"')
    expect(html).toContain('曾加入的房间')
    expect(html).toContain('NEB4F8')
    expect(html).toContain('冰风谷避难所')
    expect(html).toContain('K7X9PQ')
    expect(html).toContain('冒险者酒馆')
    expect(html).toContain('landing-history__grid')
  })

  it('does not render history section when nickname is empty', () => {
    const memory = new Map<string, string>()
    const storage: Storage = {
      get length() { return memory.size },
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => { memory.set(key, value) },
      removeItem: (key: string) => { memory.delete(key) },
      clear: () => { memory.clear() },
      key: (i: number) => Array.from(memory.keys())[i] ?? null,
    }

    vi.stubGlobal('localStorage', storage)
    vi.stubGlobal('window', { location: { search: '', origin: 'https://screenol.pages.dev' }, localStorage: storage })

    const html = renderToStaticMarkup(<DesktopLanding onEnter={() => {}} />)

    expect(html).not.toContain('landing-history')
  })
})
