const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://127.0.0.1:8765/app/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelector('#tab-spec').children.length > 0);
  const res = await page.evaluate(async () => {
    const r = await fetch('/daisy-sched.pdf'); const b = new Uint8Array(await r.arrayBuffer()); await openPdf(b, 'daisy-sched.pdf', { silent: true, noStore: true });
    S.rooms = []; S.doors = []; S.windows = []; S.pages = { 1: { mmPerPt: 25.4 / 72 * 75, method: 'preset' } };
    const t = await findTagsFromText(1);
    return { t, scale: await findScaleText(1), doors: S.doors.map(d => `${d.tag} ${d.type} ${d.height}x${d.width}${d.leaves > 1 ? ' x' + d.leaves : ''} ${d.x == null ? '(not placed)' : 'placed'} | ${(d.schedText || '').slice(0, 60)}`), windows: S.windows.map(w => `${w.tag} ${w.height}x${w.width} ${w.x == null ? '(not placed)' : 'placed'} | ${(w.schedText || '').slice(0, 50)}`) };
  });
  console.log(JSON.stringify(res, null, 1)); console.log('errors:', errs.join('; ') || 'none');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
