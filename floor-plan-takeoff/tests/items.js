const fs = require('fs');
const pdfjs = require('pdfjs-dist/build/pdf.js');
(async () => {
  const [file, out] = process.argv.slice(2);
  const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(file)), useSystemFonts: true, disableFontFace: true }).promise;
  const pages = {};
  for (const p of (process.argv[4] || '4,5,9,10').split(',').map(Number)) {
    const page = await doc.getPage(p); const vp = page.getViewport({ scale: 1 }); const tc = await page.getTextContent();
    pages[p] = tc.items.filter(i => i.str && i.str.trim()).map(i => { const m = pdfjs.Util.transform(vp.transform, i.transform); const fs = Math.hypot(m[0], m[1]) || 8; return { s: i.str.trim(), x: +m[4].toFixed(1), y: +m[5].toFixed(1), w: +(i.width || 0).toFixed(1), fs: +fs.toFixed(1) }; });
  }
  fs.writeFileSync(out, JSON.stringify(pages));
  for (const p of []) { const rooms = pages[p].filter(i => /^(bed \d|bed|wir|ens \d|ens|bath|ldry|rumpus|linen|store|lounge|gym|garage|living|dining|kit|butlers|pdr|wc|balcony|alfresco|patio|entertainment|porch|powder room|\d)$/i.test(i.s) && i.fs > 6); console.log('page', p, JSON.stringify(rooms.filter(r => !/^\d$/.test(r.s)).map(r => [r.s, r.x, r.y, r.w, r.fs]))); }
})().catch(e => { console.error(e); process.exit(1); });
