// Extract filled / stroked path geometry from a PDF page in base coordinates (viewport scale 1, top-left origin).
const fs = require('fs');
const pdfjs = require('pdfjs-dist/build/pdf.js');
const OPS = pdfjs.OPS;
const mul = (m, n) => [m[0]*n[0]+m[2]*n[1], m[1]*n[0]+m[3]*n[1], m[0]*n[2]+m[2]*n[3], m[1]*n[2]+m[3]*n[3], m[0]*n[4]+m[2]*n[5]+m[4], m[1]*n[4]+m[3]*n[5]+m[5]];
const ap = (m, x, y) => [m[0]*x + m[2]*y + m[4], m[1]*x + m[3]*y + m[5]];
(async () => {
  const [file, pageNo, out] = process.argv.slice(2);
  const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(file)), useSystemFonts: true, disableFontFace: true }).promise;
  const page = await doc.getPage(+pageNo);
  const vp = page.getViewport({ scale: 1 });
  const ol = await page.getOperatorList();
  let ctm = vp.transform.slice(); const stack = [];
  let fill = [0, 0, 0], strokeC = [0, 0, 0], lw = 1;
  let path = []; // array of subpaths, each array of [x,y]
  const shapes = [];
  for (let i = 0; i < ol.fnArray.length; i++) {
    const fn = ol.fnArray[i], a = ol.argsArray[i];
    switch (fn) {
      case OPS.save: stack.push({ ctm: ctm.slice(), fill, strokeC, lw }); break;
      case OPS.restore: { const s = stack.pop(); if (s) { ctm = s.ctm; fill = s.fill; strokeC = s.strokeC; lw = s.lw; } break; }
      case OPS.transform: ctm = mul(ctm, a); break;
      case OPS.paintFormXObjectBegin: stack.push({ ctm: ctm.slice(), fill, strokeC, lw, form: true }); if (a[0]) ctm = mul(ctm, a[0]); break;
      case OPS.paintFormXObjectEnd: { let s = stack.pop(); while (s && !s.form && stack.length) s = stack.pop(); if (s) { ctm = s.ctm; fill = s.fill; strokeC = s.strokeC; lw = s.lw; } break; }
      case OPS.setFillRGBColor: fill = [a[0], a[1], a[2]]; break;
      case OPS.setFillGray: fill = [a[0]*255, a[0]*255, a[0]*255]; break;
      case OPS.setStrokeRGBColor: strokeC = [a[0], a[1], a[2]]; break;
      case OPS.setStrokeGray: strokeC = [a[0]*255, a[0]*255, a[0]*255]; break;
      case OPS.setLineWidth: lw = a[0]; break;
      case OPS.constructPath: {
        const ops = a[0], args = a[1]; let k = 0; let cur = null; let curved = false;
        for (const op of ops) {
          if (op === OPS.moveTo) { cur = [ap(ctm, args[k], args[k+1])]; path.push(cur); k += 2; }
          else if (op === OPS.lineTo) { if (!cur) { cur = []; path.push(cur); } cur.push(ap(ctm, args[k], args[k+1])); k += 2; }
          else if (op === OPS.curveTo) { curved = true; if (!cur) { cur = []; path.push(cur); } cur.push(ap(ctm, args[k+2], args[k+3])); cur.push(ap(ctm, args[k+4], args[k+5])); k += 6; }
          else if (op === OPS.curveTo2 || op === OPS.curveTo3) { curved = true; if (!cur) { cur = []; path.push(cur); } cur.push(ap(ctm, args[k+2], args[k+3])); k += 4; }
          else if (op === OPS.closePath) { if (cur && cur.length) cur.push(cur[0]); }
          else if (op === OPS.rectangle) { const [x, y, w, h] = [args[k], args[k+1], args[k+2], args[k+3]]; cur = [ap(ctm, x, y), ap(ctm, x+w, y), ap(ctm, x+w, y+h), ap(ctm, x, y+h), ap(ctm, x, y)]; path.push(cur); k += 4; }
        }
        path.curved = curved;
        break;
      }
      case OPS.fill: case OPS.eoFill: case OPS.fillStroke: case OPS.eoFillStroke: case OPS.closeFillStroke: case OPS.closeEOFillStroke:
        for (const sp of path) if (sp.length >= 3) shapes.push({ t: 'fill', curved: !!path.curved, c: fill, pts: sp.map(p => [+p[0].toFixed(2), +p[1].toFixed(2)]) });
        if (fn !== OPS.fill && fn !== OPS.eoFill) for (const sp of path) if (sp.length >= 2) shapes.push({ t: 'stroke', curved: !!path.curved, c: strokeC, w: +(lw * Math.hypot(ctm[0], ctm[1])).toFixed(2), pts: sp.map(p => [+p[0].toFixed(2), +p[1].toFixed(2)]) });
        path = []; break;
      case OPS.stroke: case OPS.closeStroke:
        for (const sp of path) if (sp.length >= 2) shapes.push({ t: 'stroke', curved: !!path.curved, c: strokeC, w: +(lw * Math.hypot(ctm[0], ctm[1])).toFixed(2), pts: sp.map(p => [+p[0].toFixed(2), +p[1].toFixed(2)]) });
        path = []; break;
      case OPS.endPath: path = []; break;
      default: break;
    }
  }
  fs.writeFileSync(out, JSON.stringify({ width: vp.width, height: vp.height, shapes }));
  const fills = shapes.filter(s => s.t === 'fill'), strokes = shapes.filter(s => s.t === 'stroke');
  const byC = {}; for (const s of fills) { const k = s.c.map(Math.round).join(','); byC[k] = (byC[k] || 0) + 1; }
  const byW = {}; for (const s of strokes) { const k = s.w.toFixed(1) + '@' + s.c.map(Math.round).join(','); byW[k] = (byW[k] || 0) + 1; }
  console.log(`page ${pageNo}: ${fills.length} fills, ${strokes.length} strokes`);
  console.log('fills by colour:', JSON.stringify(byC));
  console.log('strokes by width@colour (top 12):', JSON.stringify(Object.entries(byW).sort((a, b) => b[1] - a[1]).slice(0, 12)));
})().catch(e => { console.error(e); process.exit(1); });
