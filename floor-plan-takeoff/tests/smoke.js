const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [], logs = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text().slice(0, 200)); });
  await page.goto('http://127.0.0.1:8765/index.test.html', { waitUntil: 'load' });
  await page.waitForFunction(() => window.pdfjsLib && document.querySelector('#tab-spec').children.length > 0);
  // sample plan
  await page.click('#btnSample');
  await page.waitForFunction(() => V.pdf && V.page && V.base && document.querySelector('#pageInfo').textContent.trim() === '1 / 1', null, { timeout: 20000 });
  await page.waitForTimeout(800);
  const scale = await page.evaluate(() => ({ mmPerPt: S.pages[1].mmPerPt, ratio: scaleRatio(1), base: [V.base.width, V.base.height], zoom: V.zoom }));
  console.log('scale', JSON.stringify(scale));
  // text lines
  const lines = await page.evaluate(async () => (await pageLines(1)).map(l => l.str));
  console.log('text lines:', lines.length, JSON.stringify(lines.slice(0, 40)));
  // find rooms
  await page.click('[data-tab="rooms"]');
  await page.click('#roomFindText');
  await page.waitForTimeout(600);
  const rooms = await page.evaluate(() => S.rooms.map(r => [r.name, r.length, r.width, r.skirting, r.method]));
  console.log('rooms:', JSON.stringify(rooms));
  // find tags
  await page.click('[data-tab="doors"]');
  await page.click('#tagFind');
  await page.waitForTimeout(600);
  const doors = await page.evaluate(() => S.doors.map(d => [d.tag, d.type, d.height, d.width, d.leaves, d.x != null, roomName(d.fromRoom), roomName(d.toRoom), d.fire]));
  const wins = await page.evaluate(() => S.windows.map(w => [w.tag, w.height, w.width, w.x != null, roomName(w.room)]));
  console.log('doors:', JSON.stringify(doors));
  console.log('windows:', JSON.stringify(wins));
  // trace a rectangular room with real clicks: GARAGE 5.8 x 6.0 m
  await page.click('[data-tool="rect"]');
  const pos = await page.evaluate(() => { const r = document.querySelector('#pdfCanvas').getBoundingClientRect(); return { left: r.left, top: r.top, zoom: V.zoom }; });
  const b2s = (x, y) => ({ x: pos.left + x * pos.zoom, y: pos.top + y * pos.zoom });
  const a = b2s(170, 521.81), b = b2s(334.41, 691.89);
  await page.mouse.click(a.x, a.y); await page.mouse.move(b.x, b.y); await page.mouse.click(b.x, b.y);
  await page.waitForSelector('#modal:not([hidden])');
  const guessed = await page.inputValue('#roomName');
  console.log('guessed name for traced rect:', guessed);
  await page.fill('#roomName', 'GARAGE TRACED');
  await page.click('#modalOk');
  await page.waitForTimeout(300);
  const traced = await page.evaluate(() => { const r = S.rooms.find(x => x.name === 'GARAGE TRACED'); return { per: roomPerimeterMm(r), area: roomAreaM2(r), skirting: r.skirting, pts: r.pts.length }; });
  console.log('traced room:', JSON.stringify(traced), '(expect per ~23600, area ~34.8)');
  // place a door with a real click inside the traced garage near D08's location: base (170+1.2*28.3465, 841.89-(150+6*28.3465))
  await page.click('[data-tool="door"]');
  const dpos = b2s(170 + 1.2 * 28.3465, 841.89 - (150 + 6 * 28.3465) + 2);
  await page.mouse.click(dpos.x, dpos.y);
  await page.waitForTimeout(300);
  const placed = await page.evaluate(() => { const d = S.doors[S.doors.length - 1]; return [d.tag, d.type, roomName(d.fromRoom), roomName(d.toRoom), d.x != null]; });
  console.log('placed door:', JSON.stringify(placed));
  // takeoff numbers and exports
  const t = await page.evaluate(() => { const t = calcTakeoff(); return { skirtNet: t.skirtNet, skirtLengths: t.skirtLengths, archNet: t.archNet, archLengths: t.archLengths, doorCount: t.doorCount, leafCount: t.leafCount, openings: t.openings, winCount: t.winCount, hardware: t.hardware, warnings: t.warnings, groups: t.doorGroups.map(g => [g.label, g.height, g.width, g.qty]) }; });
  console.log('takeoff:', JSON.stringify(t, null, 1));
  const ex = await page.evaluate(() => { const t = calcTakeoff(); return { csv: takeoffCsv(t).slice(0, 600), db: databuildCsv(t), txt: takeoffText(t).slice(0, 900) }; });
  console.log('--- databuild csv ---\n' + ex.db + '\n--- csv head ---\n' + ex.csv + '\n--- text head ---\n' + ex.txt);
  // undo, keyboard, tabs
  await page.keyboard.press('Escape');
  await page.click('[data-tab="takeoff"]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'shot-takeoff.png' });
  await page.click('[data-tab="rooms"]');
  await page.click('[data-tool="select"]');
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'shot-rooms.png' });
  // reload persistence
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelector('#tab-spec').children.length > 0);
  await page.waitForTimeout(1500);
  const after = await page.evaluate(() => ({ rooms: S.rooms.length, doors: S.doors.length, pdf: !!V.pdf, name: S.project.pdfName }));
  console.log('after reload:', JSON.stringify(after));
  // phone width layout check: no horizontal scroll
  await page.setViewportSize({ width: 400, height: 800 });
  await page.waitForTimeout(400);
  const scrollW = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  console.log('phone width scroll/client:', scrollW);
  await page.screenshot({ path: 'shot-phone.png' });
  console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
  console.log('console warnings/errors:', logs.length ? logs.join('\n') : 'none');
  await browser.close();
})().catch(e => { console.error('TEST FAILED', e); process.exit(1); });
