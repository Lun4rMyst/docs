const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://127.0.0.1:8765/app/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelector('#tab-spec').children.length > 0);
  await page.evaluate(async () => { const r = await fetch('/plans.pdf'); const b = new Uint8Array(await r.arrayBuffer()); await openPdf(b, 'PBKAL5_Plans_FWD_-_5_Kalinda_20260917080901411v16.pdf', { silent: true, noStore: true }); });
  const proj = JSON.parse(fs.readFileSync('jobs/kalinda/kalinda-takeoff.json', 'utf8'));
  await page.evaluate(async (o) => { applyProject(o); $('#projName').value = S.project.name; renderSpec(); renderAll(); await goPage(4); fitZoom(); }, proj);
  await page.waitForTimeout(1500); await page.click('[data-tab="rooms"]'); await page.waitForTimeout(300);
  await page.screenshot({ path: 'jobs/kalinda/img/app-ground.png' });
  await page.evaluate(async () => { await goPage(5); fitZoom(); }); await page.waitForTimeout(1500);
  await page.click('[data-tab="doors"]'); await page.waitForTimeout(300);
  await page.screenshot({ path: 'jobs/kalinda/img/app-upper.png' });
  await page.click('[data-tab="takeoff"]'); await page.waitForTimeout(300);
  await page.screenshot({ path: 'jobs/kalinda/img/app-takeoff.png' });
  // ---- what the app's own no-AI reading finds on these plans, starting from nothing ----
  const res = await page.evaluate(async () => {
    S.rooms = []; S.doors = []; S.windows = []; S.pages = { 4: { mmPerPt: 25.4 / 72 * 100, method: 'preset' }, 5: { mmPerPt: 25.4 / 72 * 100, method: 'preset' }, 9: { mmPerPt: 25.4 / 72 * 100, method: 'preset' }, 10: { mmPerPt: 25.4 / 72 * 100, method: 'preset' } };
    const out = {};
    out.scaleText4 = await findScaleText(4);
    const r4 = await findRoomsFromText(4); const r5 = await findRoomsFromText(5);
    out.rooms = { p4: r4.added, p5: r5.added, names: S.rooms.map(r => r.name + (r.length ? ` ${r.length}x${r.width}` : ' (no size)')) };
    const t9 = await findTagsFromText(9); const t10 = await findTagsFromText(10);
    out.tags = { p9: t9, p10: t10, doors: S.doors.map(d => `${d.tag} ${d.type} ${d.height}x${d.width}${d.leaves > 1 ? ' x' + d.leaves : ''}${d.x == null ? ' (not placed)' : ''}`), windows: S.windows.map(w => `${w.tag} ${w.height}x${w.width}${w.x == null ? ' (not placed)' : ''}`) };
    return out;
  });
  console.log(JSON.stringify(res, null, 1)); console.log('errors:', errs.join('; ') || 'none');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
