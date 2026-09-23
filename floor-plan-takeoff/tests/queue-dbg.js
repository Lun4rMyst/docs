const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await page.goto('http://127.0.0.1:8765/app/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelector('#tab-spec').children.length > 0);
  const st = await page.evaluate(async () => { const r = await fetch('/poi-plans.pdf'); const b = new Uint8Array(await r.arrayBuffer()); const res = await openPdf(b, 'poi.pdf', { silent: true, noStore: true }); return [String(res), !!V.pdf, !!V.base, V.pageNum, Object.keys(V).join(',')]; });
  console.log(JSON.stringify(st));
  await page.waitForTimeout(1500);
  const st2 = await page.evaluate(() => { renderRooms(); const b = document.querySelector('#aiqSheet'); return [!!V.pdf, !!V.base, V.pageNum, b && b.disabled, document.querySelector('#roomAi') && document.querySelector('#roomAi').disabled]; });
  console.log(JSON.stringify(st2)); console.log('errors:', errs.join('; ') || 'none');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
