const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const jobs = JSON.parse(process.argv[2]);   // [{page, scale, crop:[x0,y0,x1,y1] fractions|null, out}]
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:8765/blank.html');
  await page.addScriptTag({ url: 'http://127.0.0.1:8765/pdfjs/pdf.min.js' });
  await page.evaluate(() => { pdfjsLib.GlobalWorkerOptions.workerSrc = 'http://127.0.0.1:8765/pdfjs/pdf.worker.min.js'; });
  for (const j of jobs) {
    const dataUrl = await page.evaluate(async (j) => {
      if (!window.__doc) { const r = await fetch('http://127.0.0.1:8765/poi-plans.pdf'); window.__doc = await pdfjsLib.getDocument({ data: new Uint8Array(await r.arrayBuffer()) }).promise; }
      const pg = await window.__doc.getPage(j.page);
      const base = pg.getViewport({ scale: 1 });
      const c = j.crop || [0, 0, 1, 1];
      const rx = c[0] * base.width, ry = c[1] * base.height, rw = (c[2] - c[0]) * base.width, rh = (c[3] - c[1]) * base.height;
      const vp = pg.getViewport({ scale: j.scale, offsetX: -rx * j.scale, offsetY: -ry * j.scale });
      const canvas = document.createElement('canvas'); canvas.width = Math.ceil(rw * j.scale); canvas.height = Math.ceil(rh * j.scale);
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      await pg.render({ canvasContext: ctx, viewport: vp }).promise;
      return canvas.toDataURL('image/png');
    }, j);
    fs.writeFileSync(j.out, Buffer.from(dataUrl.split(',')[1], 'base64'));
    console.log('wrote', j.out);
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
