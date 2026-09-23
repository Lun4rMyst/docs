const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://127.0.0.1:8765/app/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelector('#tab-spec').children.length > 0);
  const proj = JSON.parse(fs.readFileSync('jobs/poi/poi-takeoff-project.json', 'utf8'));
  await page.evaluate((o) => { applyProject(o); renderSpec(); renderAll(); }, proj);
  await page.click('[data-tab="spec"]'); await page.waitForTimeout(200);
  await page.evaluate(() => { document.querySelector('#aiTier').scrollIntoView(); });
  const v = await page.evaluate(() => { document.querySelector('#aiTier').value = 'quick'; document.querySelector('#aiTier').dispatchEvent(new Event('change')); return [S.project.aiTier, document.querySelector('#aiTierApplied').value, typeof parseAiJson, JSON.stringify(parseAiJson('```json\n{"rooms":[],"doors":[],"windows":[],"notes":"x"}\n```'))]; });
  console.log(JSON.stringify(v)); await page.screenshot({ path: 'jobs/poi/img/app-spec-ai.png' }); console.log('errors:', errs.join('; ') || 'none');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
