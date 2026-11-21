async (page) => {
  const base = new URL(page.url()).origin
  const browser = page.context().browser()
  const first = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const second = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  for (const context of [first, second]) await context.route('https://fonts.googleapis.com/**', route => route.abort())
  const fault = { blocked: false, loseResult: false, rejectNext: false, sent: [], channel: null, lost: null }
  await first.routeWebSocket(/\/ws\?/, socket => {
    if (fault.blocked) { socket.close({ code: 1011 }); return }
    const server = socket.connectToServer()
    fault.channel = { socket, server }
    socket.onMessage(frame => {
      const message = JSON.parse(String(frame))
      fault.sent.push(message)
      if (message.type === 'map.stroke.add') {
        if (fault.loseResult) { fault.loseResult = false; fault.lost = message.requestId }
        if (fault.rejectNext) {
          fault.rejectNext = false
          server.send(JSON.stringify({ ...message, padding: '墙'.repeat(6000) }))
          return
        }
      }
      server.send(frame)
    })
    server.onMessage(frame => {
      const message = JSON.parse(String(frame))
      if (!fault.lost || message.requestId !== fault.lost) socket.send(frame)
    })
  })
  const a = await first.newPage()
  const b = await second.newPage()
  const btn = (p, name) => p.getByRole('button', { name, exact: true })
  const box = p => p.locator('.room-map-board')
  const ready = p => p.locator('.connection-badge[data-status="ready"]').waitFor()
  const wait = (p, selector) => p.waitForFunction(selector => Boolean(document.querySelector(selector)), selector)
  const gone = (p, selector) => p.waitForFunction(selector => !document.querySelector(selector), selector)
  const assert = (value, label) => { if (!value) throw new Error(label) }
  const at = async (p, x, y) => {
    const bounds = await box(p).boundingBox()
    return [bounds.x + (x - 5) / 15 * bounds.width, bounds.y + (y - 10) / 10 * bounds.height]
  }
  const begin = async (p, x, y) => { await p.mouse.move(...await at(p, x, y)); await p.mouse.down() }
  const move = async (p, x, y) => p.mouse.move(...await at(p, x, y), { steps: 8 })
  const draw = async (p, x, y) => { await begin(p, x, y); await move(p, x + 3, y); await p.mouse.up() }
  const erase = async (p, x, y) => { await btn(p, '橡皮擦').click(); await p.mouse.click(...await at(p, x, y)) }
  const count = (p, selector) => p.locator(selector).count()
  try {
    await Promise.all([a.goto(base, { waitUntil: 'domcontentloaded', timeout: 50000 }), b.goto(base, { waitUntil: 'domcontentloaded', timeout: 50000 })])
    await a.getByLabel('你的称呼').fill('地图验收甲')
    await a.getByLabel('房间名称').fill('地图双客户端验收')
    await btn(a, '创建房间').click()
    await ready(a)
    const invite = await a.locator('.invite-code b').innerText()
    await b.getByLabel('你的称呼').fill('地图验收乙')
    await b.getByLabel('六位邀请码').fill(invite)
    await btn(b, '加入房间').click()
    await ready(b)
    await Promise.all([btn(a, '地图').click(), btn(b, '地图').click()])
    assert(await box(a).getAttribute('viewBox') === '5 10 15 10', 'initial view')
    await a.mouse.move(...await at(a, 12, 15))
    await a.mouse.wheel(0, -120)
    await a.waitForFunction(() => document.querySelector('.room-map-board').getAttribute('viewBox') !== '5 10 15 10')
    const zoomed = await box(a).getAttribute('viewBox')
    await a.mouse.down({ button: 'right' })
    await a.mouse.move(...await at(a, 14, 16), { steps: 8 })
    await a.mouse.up({ button: 'right' })
    assert(await box(a).getAttribute('viewBox') !== zoomed, 'right drag pan')
    await btn(a, '重置地图视野').click()

    await btn(a, '新增 Token').click()
    await a.mouse.click(...await at(a, 10.5, 14.43))
    await wait(b, '[data-token-id][data-cell="10,14"]')
    const id = await a.locator('[data-token-id]').first().getAttribute('data-token-id')
    const tokenSelector = `[data-token-id="${id}"]`
    await b.getByLabel('Token 图案').selectOption('beast')
    await btn(b, '新增 Token').click()
    await b.mouse.click(...await at(b, 15.5, 18.43))
    await wait(a, '[data-token-id][data-cell="15,18"]')
    await begin(a, 10.5, 14.43)
    await move(a, 15.7, 18.5)
    assert(await b.locator(tokenSelector).getAttribute('data-cell') === '10,14', 'drag leaked before release')
    await a.mouse.up()
    await wait(b, `${tokenSelector}[data-cell="15,18"]`)
    assert(await count(b, '[data-token-id][data-cell="15,18"]') === 2, 'overlapping tokens')
    await a.getByLabel('Token 名称').fill('队长')
    await a.getByLabel('名牌底色').fill('#b55522')
    await btn(a, '保存').click()
    await b.getByLabel('选择地图 Token').selectOption(id)
    await b.waitForFunction(() => document.querySelector('[aria-label="Token 名称"]')?.value === '队长'
      && document.querySelector('[aria-label="名牌底色"]')?.value === '#b55522')

    await Promise.all([btn(a, '画笔').click(), btn(b, '画笔').click()])
    await a.getByLabel('画笔颜色').fill('#a23c26')
    await a.getByLabel('画笔粗细').selectOption('0.32')
    await begin(a, 10, 16)
    await move(a, 13, 16)
    await move(a, 13, 17)
    await wait(a, '[data-stroke-status="drawing"]')
    const firstStroke = await a.locator('[data-stroke-status="drawing"]').getAttribute('data-stroke-id')
    assert(await count(b, '[data-stroke-id]') === 0, 'stroke leaked while drawing')
    await begin(b, 16, 17)
    await move(b, 18, 17)
    await Promise.all([a.mouse.up(), b.mouse.up()])
    for (const p of [a, b]) await p.waitForFunction(() => document.querySelectorAll('[data-stroke-status="confirmed"]').length === 2)
    const line = b.locator(`[data-stroke-id="${firstStroke}"] polyline`).first()
    const corners = (await line.getAttribute('points')).split(' ').map(point => point.split(',').map(Number))
    assert(corners.some(([x, y]) => Math.abs(x - 13) < 0.08 && Math.abs(y - 16) < 0.08), 'simplification omitted the corner')
    assert(await line.getAttribute('stroke') === '#a23c26' && await line.getAttribute('stroke-width') === '0.32', 'brush color and width')
    await erase(b, 11, 16)
    for (const p of [a, b]) await p.waitForFunction(() => document.querySelectorAll('[data-stroke-id]').length === 1)

    await btn(a, '画笔').click()
    await begin(a, 10, 18)
    await move(a, 13, 18)
    fault.blocked = true
    fault.channel.socket.close({ code: 1011 })
    fault.channel.server.close()
    await wait(a, '.connection-badge[data-status="reconnecting"]')
    await a.mouse.up()
    await wait(a, '[data-stroke-status="pending"]')
    const queued = await a.evaluate(() => Object.keys(localStorage).filter(key => key.includes(':outbox:'))
      .flatMap(key => JSON.parse(localStorage.getItem(key))).find(entry => entry.command.type === 'map.stroke.add').command)
    assert(!fault.sent.some(command => command.requestId === queued.requestId), 'operation sent while disconnected')
    await btn(a, '关闭').click()
    await btn(a, '地图').click()
    await wait(a, `[data-stroke-id="${queued.stroke.id}"][data-stroke-status="pending"]`)
    fault.blocked = false
    await ready(a)
    await Promise.all([wait(a, `[data-stroke-id="${queued.stroke.id}"][data-stroke-status="confirmed"]`), wait(b, `[data-stroke-id="${queued.stroke.id}"]`)])
    assert(fault.sent.some(command => command.requestId === queued.requestId && command.stroke?.id === queued.stroke.id), 'queued stroke changed request ID')

    fault.loseResult = true
    await btn(a, '画笔').click()
    await draw(a, 20, 25)
    await wait(a, '[data-stroke-status="pending"]')
    const lost = fault.sent.find(command => command.requestId === fault.lost)
    await wait(b, `[data-stroke-id="${lost.stroke.id}"]`)
    await wait(a, `[data-stroke-id="${lost.stroke.id}"][data-stroke-status="pending"]`)
    fault.channel.socket.close({ code: 1011 })
    fault.channel.server.close()
    await wait(a, `[data-stroke-id="${lost.stroke.id}"][data-stroke-status="confirmed"]`)
    assert(fault.sent.some(command => command.type === 'room.sync' && command.pendingRequestIds.includes(lost.requestId)), 'sync omitted lost receipt ID')
    assert(fault.sent.filter(command => command.requestId === lost.requestId).length === 1, 'replayed a committed operation despite receipt')

    fault.rejectNext = true
    await draw(a, 21, 27)
    await wait(a, '[data-stroke-status="failed"]')
    const rejected = await a.locator('[data-stroke-status="failed"]').getAttribute('data-stroke-id')
    await gone(b, `[data-stroke-id="${rejected}"]`)
    await btn(a, '关闭').click()
    await btn(a, '地图').click()
    await wait(a, `[data-stroke-id="${rejected}"][data-stroke-status="failed"]`)
    await erase(a, 22, 27)
    await gone(a, `[data-stroke-id="${rejected}"]`)
    await a.getByLabel('选择地图 Token').selectOption(id)
    await btn(a, '删除 Token').click()
    await gone(b, tokenSelector)

    await a.screenshot({ path: '.wrangler/room-map.png' })
    return { passed: ['map entry', '30×20 view', 'wheel and right drag', 'snapping and overlap', 'name and label color', 'local draft', 'preserved corner and brush style', 'concurrent strokes', 'cross-player erasing', 'offline release and same request ID', 'lost event and ACK', 'server rejection and local erasing', 'reopen', 'token deletion'] }
  } finally {
    await Promise.all([first.close(), second.close()])
  }
}
