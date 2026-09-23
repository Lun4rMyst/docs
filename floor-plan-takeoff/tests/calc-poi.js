const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://127.0.0.1:8765/app/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelector('#tab-spec').children.length > 0);
  const proj = JSON.parse(fs.readFileSync('jobs/poi/poi-takeoff-project.json', 'utf8'));
  const out = await page.evaluate((o) => { applyProject(o); $('#projName').value = S.project.name; renderSpec(); renderAll(); const t = calcTakeoff(); return { txt: takeoffText(t), csv: takeoffCsv(t), db: databuildCsv(t), sum: { skirtNet: t.skirtNet, skirtWaste: t.skirtWaste, skirtLengths: t.skirtLengths, archNet: t.archNet, archWaste: t.archWaste, archLengths: t.archLengths, doorCount: t.doorCount, leafCount: t.leafCount, openings: t.openings, winCount: t.winCount, winArchCount: t.winArchCount, warnings: t.warnings, rooms: t.rooms.map(x => [x.r.name, x.per == null ? null : Math.round(x.per), Math.round(x.doorDed), Math.round(x.other), Math.round(x.net)]) } }; }, proj);
  fs.writeFileSync('jobs/poi/poi-takeoff.txt', out.txt); fs.writeFileSync('jobs/poi/poi-takeoff.csv', out.csv); fs.writeFileSync('jobs/poi/poi-databuild.csv', out.db);
  console.log(JSON.stringify(out.sum, null, 1)); console.log('errors:', errs.join('; ') || 'none');
  await page.click('[data-tab="takeoff"]'); await page.waitForTimeout(300); await page.screenshot({ path: 'jobs/poi/img/app-takeoff.png' });
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
