const fs = require('fs');
const pdfjs = require('pdfjs-dist/build/pdf.js');
(async () => {
  const [file, out] = process.argv.slice(2);
  const data = new Uint8Array(fs.readFileSync(file));
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true, disableFontFace: true }).promise;
  let txt = `FILE ${file}\nPAGES ${doc.numPages}\n`;
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    const items = tc.items.filter(i => i.str && i.str.trim()).map(i => { const m = pdfjs.Util.transform(vp.transform, i.transform); const fs = Math.hypot(m[0], m[1]) || 8; return { s: i.str.replace(/\s+/g, ' ').trim(), x: m[4], y: m[5], fs, w: i.width }; });
    items.sort((a, b) => (Math.round(a.y / 3) - Math.round(b.y / 3)) || (a.x - b.x));
    const lines = []; let cur = null;
    for (const it of items) {
      if (cur && Math.abs(cur.y - it.y) <= Math.max(cur.fs, it.fs) * 0.5 && it.x - cur.x1 <= it.fs * 1.6) { cur.s += (it.x - cur.x1 > it.fs * 0.22 ? ' ' : '') + it.s; cur.x1 = it.x + it.w; }
      else { cur = { s: it.s, x: it.x, x1: it.x + it.w, y: it.y, fs: it.fs }; lines.push(cur); }
    }
    txt += `\n===== PAGE ${p} (${Math.round(vp.width)}x${Math.round(vp.height)}pt) =====\n` + lines.map(l => `[${l.x.toFixed(0)},${l.y.toFixed(0)}] ${l.s}`).join('\n') + '\n';
  }
  fs.writeFileSync(out, txt);
  console.log(file.split('/').pop(), 'pages', doc.numPages, 'chars', txt.length);
})().catch(e => { console.error(e); process.exit(1); });
