async (page) => {
  const location = new URL(page.url())
  const base = location.origin
  const mode = location.hash.slice(1) || 'warm'
  const browser = page.context().browser()
  const contexts = []
  const assets = new Map()
  const samples = []
  const failures = []
  const btn = (p, name) => p.getByRole('button', { name, exact: true })
  const ready = p => p.locator('.connection-badge[data-status="ready"]').waitFor({ timeout: 15000 })
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
  const instrument = () => {
    const now = () => performance.timeOrigin + performance.now()
    const size = text => new TextEncoder().encode(text).byteLength
    const sent = []
    const seen = {}
    const waiting = new Map()
    let action
    const state = { sent, seen, queue: {}, snapshot: null, socket: null, syncedAt: 0, lastFrameAt: 0 }
    window.mapBench = state
    const remember = type => { action = { type, started: now() } }
    document.addEventListener('click', event => {
      if (event.target.closest('.btn-roll-main')) remember('dice.roll')
    }, true)
    document.addEventListener('pointerup', event => {
      const tool = event.target.closest('.room-map-board')?.dataset.tool
      if (event.button !== 0) return
      if (tool === 'select') remember('map.token.update')
      if (tool === 'pen') remember('map.stroke.add')
    }, true)
    document.addEventListener('pointerdown', event => {
      if (event.button === 0 && event.target.closest('.room-map-board')?.dataset.tool === 'eraser') remember('map.stroke.delete')
    }, true)

    function selector(event) {
      switch (event.type) {
        case 'dice.rolled': return `[data-roll-id="${event.roll.id}"]`
        case 'map.token.changed': return `[data-token-id="${event.token.id}"][data-cell="${event.token.x},${event.token.y}"][data-token-status="confirmed"]`
        case 'map.stroke.added': return `[data-stroke-id="${event.stroke.id}"][data-stroke-status="confirmed"]`
        case 'map.stroke.deleted': return `[data-stroke-id="${event.id}"]`
      }
    }
    function check() {
      for (const [id, event] of waiting) {
        if (Boolean(document.querySelector(selector(event))) === (event.type !== 'map.stroke.deleted')) {
          seen[id].displayed = now()
          waiting.delete(id)
        }
      }
    }
    new MutationObserver(check).observe(document, { childList: true, subtree: true, attributes: true })
    const NativeWebSocket = window.WebSocket
    window.WebSocket = class extends NativeWebSocket {
      constructor(...args) {
        super(...args)
        if (!String(args[0]).includes('/api/v2/rooms/')) return
        state.socket = this
        this.addEventListener('message', ({ data }) => {
          state.lastFrameAt = now()
          const event = JSON.parse(data)
          if (event.type === 'room.snapshot') {
            state.snapshot = { at: now(), bytes: size(data), strokes: event.room.map?.strokes.length ?? 0 }
          } else if (event.type === 'operation.ack' && Number.isFinite(event.queueMs)) {
            state.queue[event.requestId] = event.queueMs
          } else if (selector(event)) {
            seen[event.requestId] = { received: now(), bytes: size(data) }
            waiting.set(event.requestId, event)
          }
        })
      }
      send(data) {
        state.lastFrameAt = now()
        const command = JSON.parse(data)
        if (command.type === 'room.sync') state.syncedAt = now()
        if (action?.type === command.type) {
          sent.push({ ...action, requestId: command.requestId, bytes: size(data), id: command.stroke?.id ?? command.id })
          action = undefined
        }
        super.send(data)
      }
    }
  }
  const tab = async () => {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 980 } })
    contexts.push(ctx)
    await ctx.route('https://fonts.googleapis.com/**', route => route.abort())
    await ctx.route(`${base}/assets/**`, async route => {
      const url = route.request().url()
      if (!assets.has(url)) assets.set(url, route.fetch({ maxRetries: 2 }).then(async response => {
        if (!response.ok()) throw new Error(`Loading asset returned ${response.status()}`)
        return { body: await response.body(), contentType: response.headers()['content-type'] }
      }).catch(error => { assets.delete(url); throw error }))
      await route.fulfill(await assets.get(url))
    })
    await ctx.addInitScript(instrument)
    const p = await ctx.newPage()
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await p.goto(base, { waitUntil: 'commit', timeout: 15000 })
        await p.getByLabel('你的称呼').waitFor({ timeout: 15000 })
        break
      } catch (error) {
        if (attempt === 2) throw error
      }
    }
    return p
  }
  const create = async (p, name) => {
    await p.getByLabel('你的称呼').fill(name)
    await p.getByLabel('房间名称').fill('地图延迟测量合成房间')
    await btn(p, '创建房间').click()
    await ready(p)
    return p.locator('.invite-code b').innerText()
  }
  const join = async (p, name, code) => {
    await p.getByLabel('你的称呼').fill(name)
    await p.getByLabel('六位邀请码').fill(code)
    await btn(p, '加入房间').click()
    await ready(p)
  }
  const map = p => btn(p, '地图').click()
  const configureDice = async p => {
    await btn(p, '普通骰').click()
    await p.getByRole('button', { name: /^d20，/ }).click()
  }
  const next = async (from, to, label, type, action) => {
    const length = await from.evaluate(() => window.mapBench.sent.length)
    await action()
    const operation = await from.evaluate(({ length, type }) => window.mapBench.sent.slice(length).find(item => item.type === type), { length, type })
    if (!operation) throw new Error(`Missing outbound ${type} for ${label}`)
    const id = operation.requestId
    const visible = async p => {
      await p.waitForFunction(id => Boolean(window.mapBench.seen[id]?.displayed), id, { timeout: 25000, polling: 50 })
        .catch(() => { throw new Error(`No formal display of ${label}/${type} after ${samples.length} samples`) })
      return p.evaluate(id => window.mapBench.seen[id], id)
    }
    const [author, observer] = await Promise.all([visible(from), visible(to)])
    await from.waitForFunction(id => Number.isFinite(window.mapBench.queue[id]), id, { timeout: 2500, polling: 50 }).catch(() => undefined)
    const queueMs = await from.evaluate(id => window.mapBench.queue[id] ?? null, id)
    samples.push({
      phase: label, type, requestId: id, requestBytes: operation.bytes, eventBytes: author.bytes, queueMs,
      originMs: +(author.displayed - operation.started).toFixed(2),
      observerMs: +(observer.displayed - operation.started).toFixed(2),
      originFrameMs: +(author.received - operation.started).toFixed(2),
      observerFrameMs: +(observer.received - operation.started).toFixed(2),
    })
  }
  const roll = (a, b, label) => next(a, b, label, 'dice.roll', () => btn(a, '掷骰').click())
  const board = p => p.locator('.room-map-board')
  const at = (bounds, x, y) => [bounds.x + (x - 5) / 30 * bounds.width, bounds.y + (y - 10) / 20 * bounds.height]
  const beginStroke = async (p, x, y) => {
    const bounds = await board(p).boundingBox()
    await p.mouse.move(...at(bounds, x, y))
    await p.mouse.down()
    await p.mouse.move(...at(bounds, x + 2, y + 0.25), { steps: 3 })
    await p.mouse.move(...at(bounds, x + 2.3, y + 1.2), { steps: 3 })
    await p.mouse.move(...at(bounds, x + 4, y + 1.2), { steps: 3 })
  }
  const snapshot = []
  const bench = await tab()
  try {
    const edge = await bench.evaluate(async () => {
      const trace = await (await fetch('/cdn-cgi/trace')).text()
      return Object.fromEntries(trace.split('\n').filter(line => /^(colo|loc)=/.test(line)).map(line => line.split('=')))
    })
    if (mode === 'idle' || mode === 'idle-30') {
      const idleMs = mode === 'idle-30' ? 30_000 : 70_000
      const idlePairs = []
      for (let index = 0; index < 4; index++) {
        const [a, b] = await Promise.all([tab(), tab()])
        await join(b, '空闲观察', await create(a, '空闲发起'))
        await configureDice(a)
        idlePairs.push({ a, b, after: Date.now() + idleMs })
      }
      const results = await Promise.allSettled(idlePairs.map(async ({ a, b, after }) => {
        await sleep(Math.max(0, after - Date.now()))
        await Promise.all([a, b].map(p => p.waitForFunction(ms => performance.timeOrigin + performance.now() - window.mapBench.lastFrameAt >= ms, idleMs, { timeout: 45000, polling: 250 })))
        await roll(a, b, `idle-${idleMs / 1000}s`)
      }))
      failures.push(...results.filter(item => item.status === 'rejected').map(item => item.reason.message))
    } else if (mode === 'capacity') {
      const template = Array.from({ length: 512 }, (_, index) => [+(index * 0.071).toFixed(2), +(12 + index % 59 * 0.247).toFixed(2)])
      const strokes = []
      let mapBytes = 0
      const encoder = new TextEncoder()
      for (let index = 0; ; index++) {
        const stroke = { id: `capacity-${index}`, color: '#263950', width: 0.08, points: template }
        const bytes = encoder.encode(JSON.stringify(stroke)).byteLength
        if (mapBytes + bytes > 512 * 1024) break
        strokes.push(stroke)
        mapBytes += bytes
      }
      const backup = { schemaVersion: 2, room: { name: '容量测试', characters: [], dice: [], fear: { value: 0 }, xCard: { active: false }, map: { tokens: [], strokes } }, characters: [] }
      await bench.getByLabel('你的称呼').fill('容量测试')
      await bench.locator('#backup-file').setInputFiles({ name: 'capacity.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) })
      await btn(bench, '恢复房间').click()
      await ready(bench)
      await map(bench)
      if (await bench.locator('[data-stroke-status="confirmed"]').count() !== strokes.length) throw new Error('Restore omitted strokes')
      for (let index = 0; index < 12; index++) {
        const started = await bench.evaluate(() => {
          window.mapBench.snapshot = null
          window.mapBench.socket.close(4000, 'Capacity benchmark')
          return performance.timeOrigin + performance.now()
        })
        await bench.waitForFunction(() => Boolean(window.mapBench.snapshot), undefined, { timeout: 15000 })
        await ready(bench)
        const result = await bench.evaluate(() => ({
          ...window.mapBench.snapshot, syncMs: window.mapBench.snapshot.at - window.mapBench.syncedAt,
          ready: performance.timeOrigin + performance.now(),
        }))
        if (result.strokes !== strokes.length) throw new Error('Reconnect omitted strokes')
        snapshot.push({ bytes: result.bytes, strokes: result.strokes, mapBytes, syncMs: +result.syncMs.toFixed(2), reconnectMs: +(result.ready - started).toFixed(2) })
      }
    } else {
      const a = bench
      const [b, c, d] = await Promise.all([tab(), tab(), tab()])
      const code = await create(a, '掷骰端')
      await Promise.all([join(b, '画图甲', code), join(c, '画图乙', code), join(d, '画图丙', code)])
      await configureDice(a)
      for (let index = 0; index < 30; index++) await roll(a, b, 'dice-only')
      await Promise.all([map(b), map(c), map(d)])

      const bounds = await board(b).boundingBox()
      await btn(b, '新增 Token').click()
      await b.mouse.click(...at(bounds, 7.5, 14.43))
      await c.locator('[data-token-status="confirmed"]').waitFor()
      for (let index = 0; index < 24; index++) {
        if (index < 16) {
          await btn(b, '选择').click()
          const x = index % 2 ? 11.5 : 7.5
          const target = index % 2 ? 7.5 : 11.5
          await b.mouse.move(...at(bounds, x, 14.43))
          await b.mouse.down()
          await b.mouse.move(...at(bounds, target, 14.43), { steps: 4 })
          await next(b, c, 'interleaved', 'map.token.update', () => b.mouse.up())
        }
        await btn(b, '画笔').click()
        await beginStroke(b, 14, 19)
        await next(b, c, 'interleaved', 'map.stroke.add', () => b.mouse.up())
        await roll(a, c, 'interleaved')
        await btn(c, '橡皮擦').click()
        await next(c, b, 'interleaved', 'map.stroke.delete', async () => c.mouse.click(...at(await board(c).boundingBox(), 15, 19.13)))
      }
      await Promise.all([b, c, d].map(p => btn(p, '画笔').click()))
      for (let index = 0; index < 24; index++) {
        const y = 12 + index % 15
        await Promise.all([beginStroke(b, 11, y), beginStroke(c, 18, y), beginStroke(d, 25, y)])
        await Promise.all([
          roll(a, b, 'concurrent'),
          next(b, c, 'concurrent', 'map.stroke.add', () => b.mouse.up()),
          next(c, d, 'concurrent', 'map.stroke.add', () => c.mouse.up()),
          next(d, b, 'concurrent', 'map.stroke.add', () => d.mouse.up()),
        ])
      }
    }
    const output = { edge, mode, samples, snapshot, failures }
    const download = page.waitForEvent('download')
    await page.evaluate(output => {
      const url = URL.createObjectURL(new Blob([JSON.stringify(output)], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url
      link.download = 'room-map.json'
      link.click()
    }, output)
    await (await download).saveAs(`.wrangler/map-benchmark-${mode}.json`)
    return { edge, mode, observations: samples.length, reconnects: snapshot.length, failures: failures.length }
  } finally {
    await Promise.all(contexts.map(ctx => ctx.close()))
  }
}
