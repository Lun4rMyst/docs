const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://127.0.0.1:8765/app/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelector('#tab-spec').children.length > 0);
  await page.evaluate(async () => { const r = await fetch('/poi-plans.pdf'); const b = new Uint8Array(await r.arrayBuffer()); await openPdf(b, 'poi.pdf', { silent: true, noStore: true }); await goPage(3); fitZoom(); });
  await page.waitForTimeout(1200);
  // fake the Claude capability: a function with .limits, returning a canned JSON reply that names the sheet it was asked about
  await page.evaluate(() => {
    window.__calls = [];
    const fake = async (prompt, opts) => { window.__calls.push({ images: opts.images ? opts.images.length : 0, tier: opts.modelTier, len: prompt.length }); await new Promise(r => setTimeout(r, 50));
      const n = window.__calls.length; return { text: '```json\n' + JSON.stringify({ rooms: [{ name: 'TEST ROOM ' + n, length_mm: 3000, width_mm: 2000, x: 50, y: 50, wet_area: false }], doors: [{ tag: 'D9' + n, type: 'hinged', height_mm: 2040, width_mm: 820, leaves: 1, from_room: 'TEST ROOM ' + n, to_room: 'OUTSIDE', x: 40, y: 40 }], windows: [], notes: 'note ' + n }) + '\n```', modelTierApplied: 'default', truncated: false }; };
    fake.limits = async () => ({ images: { maxCount: 5 } });
    CAP.sample = fake; CAP.images = true; CAP.maxImages = 5; updateCapUI(); renderRooms();
  });
  await page.click('[data-tab="rooms"]'); await page.waitForTimeout(200);
  await page.click('#aiqSheet'); await page.waitForTimeout(200);
  await page.evaluate(async () => { await goPage(4); });
  await page.waitForTimeout(800);
  await page.evaluate(() => queueAiRead({ x: 560, y: 300, w: 200, h: 150 }, 4, false));
  await page.waitForTimeout(600);
  const before = await page.evaluate(() => ({ q: V.aiQueue.map(i => [i.page, i.whole]), est: document.querySelector('#aiqEst') && document.querySelector('#aiqEst').textContent, rooms: S.rooms.length }));
  console.log(JSON.stringify(before, null, 1));
  await page.screenshot({ path: 'jobs/poi/img/app-queue.png' });
  await page.click('#aiqSend'); await page.waitForTimeout(2500);
  const after = await page.evaluate(() => ({ q: V.aiQueue.length, calls: window.__calls, rooms: S.rooms.map(r => r.name + '@' + r.page), doors: S.doors.map(d => d.tag + '@' + d.page), tier: S.project.aiTierApplied, prog: document.querySelector('#aiProg').hidden, modal: !!document.querySelector('.modal.on, dialog[open]') }));
  console.log(JSON.stringify(after, null, 1)); console.log('errors:', errs.join('; ') || 'none');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
