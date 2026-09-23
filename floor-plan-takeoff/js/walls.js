/* =========================== rooms from walls =========================== */
/* Reads the wall shapes out of the sheet's vector drawing, seals the door and window openings and
   treats every enclosed hole as a room, measured face to face between the walls. Geometry runs on
   clipper-lib (js/clipper.js) in integer units of 0.1 mm. Every top-level name here starts with
   wl / WL_ because all the scripts share one scope. */
const WL_U = 10;                                   // Clipper units per millimetre
const WL_PALETTE = ['#1F77B4', '#2CA02C', '#9467BD', '#8C564B', '#E377C2', '#7F7F7F', '#BCBD22', '#17BECF', '#98DF8A', '#C5B0D5', '#C49C94', '#F7B6D2', '#DBDB8D', '#9EDAE5', '#AEC7E8', '#FFBB78'];
const WL_P = {                                     // thresholds in millimetres, as tuned on the reference jobs
  swell: 20, closeR: 700, closeThick: 650, closeArea: 0.35e6, openPad: 250, openSrc: 2500, openClip: 900, openThick: 330, plugMinArea: 200,
  blobSide: 400, blobArea: 0.05e6, symbolSide: 300, mrrRatio: 0.8, curvedSide: 400, curvedLen: 1500,
  strokeMinW: 0.4, strokeMinLen: 20, chainGrid: 2, arcRmin: 450, arcRmax: 1400, arcSweep: [55, 110], chainMinLen: 150, band: 45, roomClosing: 45, roomMinSide: 350,
  roomMinArea: 0.5e6, simplify: 15, planPad: 2500, darkMax: 0
};
const WL_NOTE = 'No room label inside this outline — rename it, or delete it if it is not a room';
let wlAbort = false, wlBusy = false;
$('#aiStop').addEventListener('click', () => { wlAbort = true; });
function wlTick() { return new Promise(res => setTimeout(res, 0)).then(() => { if (wlAbort) throw Object.assign(new Error('cancelled'), { code: 'cancelled' }); }); }

/* ---------- geometry on Clipper paths (arrays of {X, Y} integer rings; outers positive, holes negative) ---------- */
function wlOrient(ring) { return ClipperLib.Clipper.Orientation(ring) ? ring : ring.slice().reverse(); }
function wlRepair(ring) { return ClipperLib.Clipper.SimplifyPolygon(ring, ClipperLib.PolyFillType.pftEvenOdd); }
function wlClip(type, a, b) {
  const CL = ClipperLib;
  if (!a.length) return type === CL.ClipType.ctUnion && b ? b.slice() : [];
  if (b && !b.length) return type === CL.ClipType.ctIntersection ? [] : a.slice();
  const c = new CL.Clipper(); c.AddPaths(a, CL.PolyType.ptSubject, true); if (b) c.AddPaths(b, CL.PolyType.ptClip, true);
  const out = new CL.Paths(); c.Execute(type, out, CL.PolyFillType.pftNonZero, CL.PolyFillType.pftNonZero); return out;
}
function wlFlat(list) { const flat = []; for (const p of list) for (const r of p) flat.push(r); return flat; }
function wlUnion(list) { const flat = wlFlat(list); return flat.length ? wlClip(ClipperLib.ClipType.ctUnion, flat, null) : []; }
function wlDiff(a, b) { return wlClip(ClipperLib.ClipType.ctDifference, a, b); }
function wlInter(a, b) { return wlClip(ClipperLib.ClipType.ctIntersection, a, b); }
function wlBuffer(paths, dMm, open) {
  if (!paths.length) return [];
  const CL = ClipperLib, co = new CL.ClipperOffset(5, 0.25);              // mitre limit 5, as the reference run
  co.AddPaths(paths, CL.JoinType.jtMiter, open ? CL.EndType.etOpenButt : CL.EndType.etClosedPolygon);
  const out = new CL.Paths(); co.Execute(out, Math.round(dMm * WL_U)); return out;
}
function wlClosing(paths, rMm) { return wlBuffer(wlBuffer(paths, rMm), -rMm); }
function wlDisc(X, Y, rMm, n = 64) { const r = rMm * WL_U, ring = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; ring.push({ X: Math.round(X + r * Math.cos(a)), Y: Math.round(Y + r * Math.sin(a)) }); } return [wlOrient(ring)]; }
function wlBoxU(b, MMU) {
  const x0 = Math.round(Math.min(b.x0, b.x1) * MMU), x1 = Math.round(Math.max(b.x0, b.x1) * MMU), y0 = Math.round(Math.min(b.y0, b.y1) * MMU), y1 = Math.round(Math.max(b.y0, b.y1) * MMU);
  return [wlOrient([{ X: x0, Y: y0 }, { X: x1, Y: y0 }, { X: x1, Y: y1 }, { X: x0, Y: y1 }])];
}
function wlComponents(paths) {                                               // [{outer, holes}] at every depth, islands inside holes included
  if (!paths.length) return [];
  const CL = ClipperLib, c = new CL.Clipper(); c.AddPaths(paths, CL.PolyType.ptSubject, true);
  const tree = new CL.PolyTree(); c.Execute(CL.ClipType.ctUnion, tree, CL.PolyFillType.pftNonZero, CL.PolyFillType.pftNonZero);
  return CL.JS.PolyTreeToExPolygons(tree);
}
function wlAreaMm2(paths) { let a = 0; for (const p of paths) a += ClipperLib.Clipper.Area(p); return a / (WL_U * WL_U); }
function wlCompArea(comp) { return wlAreaMm2([comp.outer].concat(comp.holes)); }
function wlContains(comp, X, Y) {
  const pip = ClipperLib.Clipper.PointInPolygon, p = { X, Y };
  if (pip(p, comp.outer) !== 1) return false;
  for (const h of comp.holes) if (pip(p, h) === 1) return false;
  return true;
}
function wlBBox(ring) { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const p of ring) { if (p.X < x0) x0 = p.X; if (p.X > x1) x1 = p.X; if (p.Y < y0) y0 = p.Y; if (p.Y > y1) y1 = p.Y; } return { x0, y0, x1, y1 }; }
function wlBBoxHit(b, x0, y0, x1, y1) { return b.x1 >= x0 && b.x0 <= x1 && b.y1 >= y0 && b.y0 <= y1; }
function wlHull(pts) {
  const p = pts.slice().sort((a, b) => (a.X - b.X) || (a.Y - b.Y)), n = p.length; if (n < 3) return p;
  const cross = (o, a, b) => (a.X - o.X) * (b.Y - o.Y) - (a.Y - o.Y) * (b.X - o.X);
  const lower = []; for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
  const upper = []; for (let i = n - 1; i >= 0; i--) { const q = p[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
  lower.pop(); upper.pop(); return lower.concat(upper);
}
function wlSides(paths) {                                                    // minimum rotated rectangle: {min, max, area} in mm
  const pts = wlFlat(paths), h = wlHull(pts);
  if (h.length < 2) return { min: 0, max: 0, area: 0 };
  if (h.length === 2) return { min: 0, max: Math.hypot(h[1].X - h[0].X, h[1].Y - h[0].Y) / WL_U, area: 0 };
  let best = null;
  for (let i = 0; i < h.length; i++) {
    const a = h[i], b = h[(i + 1) % h.length], dx = b.X - a.X, dy = b.Y - a.Y, L = Math.hypot(dx, dy); if (!L) continue;
    const ux = dx / L, uy = dy / L; let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const p of h) { const u = p.X * ux + p.Y * uy, v = -p.X * uy + p.Y * ux; if (u < u0) u0 = u; if (u > u1) u1 = u; if (v < v0) v0 = v; if (v > v1) v1 = v; }
    const w = u1 - u0, hh = v1 - v0; if (!best || w * hh < best.area) best = { w, h: hh, area: w * hh };
  }
  return { min: Math.min(best.w, best.h) / WL_U, max: Math.max(best.w, best.h) / WL_U, area: best.area / (WL_U * WL_U) };
}
function wlDP(ring, tolU) {                                                  // Douglas–Peucker on a closed ring; keeps the original if the result crosses itself
  if (ring.length <= 4) return ring;
  const pts = ring.concat([ring[0]]), keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const segDist = (p, a, b) => { const dx = b.X - a.X, dy = b.Y - a.Y, l2 = dx * dx + dy * dy; if (!l2) return Math.hypot(p.X - a.X, p.Y - a.Y); const t = Math.max(0, Math.min(1, ((p.X - a.X) * dx + (p.Y - a.Y) * dy) / l2)); return Math.hypot(p.X - a.X - t * dx, p.Y - a.Y - t * dy); };
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop(); if (j - i < 2) continue;
    let bi = -1, bd = tolU; for (let m = i + 1; m < j; m++) { const d = segDist(pts[m], pts[i], pts[j]); if (d > bd) { bd = d; bi = m; } }
    if (bi >= 0) { keep[bi] = 1; stack.push([i, bi], [bi, j]); }
  }
  const out = []; for (let m = 0; m < pts.length - 1; m++) if (keep[m]) out.push(pts[m]);
  if (out.length < 3) return ring;
  return ClipperLib.Clipper.SimplifyPolygon(out, ClipperLib.PolyFillType.pftEvenOdd).length === 1 ? out : ring;
}
function wlLabelPoint(pts) {                                                 // area centroid of a {x, y} polygon
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length], w = p.x * q.y - q.x * p.y; a += w; cx += (p.x + q.x) * w; cy += (p.y + q.y) * w; }
  if (Math.abs(a) < 1e-9) return centroid(pts);
  return { x: cx / (3 * a), y: cy / (3 * a) };
}
function wlBboxMm(pts, k) { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const p of pts) { if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x; if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y; } return [Math.round((x1 - x0) * k), Math.round((y1 - y0) * k)]; }
function wlFitCircle(pts) {                                                  // least-squares circle (Kåsa); null when the points are a straight line
  const n = pts.length; if (n < 3) return null;
  let mx = 0, my = 0; for (const p of pts) { mx += p[0]; my += p[1]; } mx /= n; my /= n;
  let Suu = 0, Suv = 0, Svv = 0, Suuu = 0, Svvv = 0, Suvv = 0, Svuu = 0;
  for (const p of pts) { const u = p[0] - mx, v = p[1] - my; Suu += u * u; Suv += u * v; Svv += v * v; Suuu += u * u * u; Svvv += v * v * v; Suvv += u * v * v; Svuu += v * u * u; }
  const det = Suu * Svv - Suv * Suv; if (!(Math.abs(det) > 1e-9 * (Suu * Svv + 1))) return null;
  const b1 = (Suuu + Suvv) / 2, b2 = (Svvv + Svuu) / 2, uc = (b1 * Svv - b2 * Suv) / det, vc = (Suu * b2 - Suv * b1) / det;
  return { cx: uc + mx, cy: vc + my, r: Math.sqrt(Math.max(0, uc * uc + vc * vc + (Suu + Svv) / n)) };
}

/* ---------- the sheet's vector drawing: fills and strokes in base points, top-left origin ---------- */
async function pageVectors(pn) {
  V.vec = V.vec || {}; V.vecOrder = V.vecOrder || [];
  if (V.vec[pn]) return V.vec[pn];
  const page = (pn === V.pageNum && V.page) ? V.page : await V.pdf.getPage(pn);
  const vp = page.getViewport({ scale: 1 });
  const ol = await page.getOperatorList();
  const OPS = pdfjsLib.OPS;
  const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
  const ap = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  const r2 = v => +v.toFixed(2);
  let ctm = vp.transform.slice(); const stack = [];
  let fill = [0, 0, 0], strokeC = [0, 0, 0], lw = 1, path = [], curved = false;
  const shapes = [];
  const pop = (form) => { let s = stack.pop(); if (form) while (s && !s.form && stack.length) s = stack.pop(); if (s) { ctm = s.ctm; fill = s.fill; strokeC = s.strokeC; lw = s.lw; } };
  const emitFills = () => { for (const sp of path) if (sp.length >= 3) shapes.push({ t: 'fill', curved, c: fill, pts: sp.map(p => [r2(p[0]), r2(p[1])]) }); };
  const emitStrokes = () => { const w = +(lw * Math.hypot(ctm[0], ctm[1])).toFixed(2); for (const sp of path) if (sp.length >= 2) shapes.push({ t: 'stroke', curved, c: strokeC, w, pts: sp.map(p => [r2(p[0]), r2(p[1])]) }); };
  const N = ol.fnArray.length;
  for (let i = 0; i < N; i++) {
    if (i && (i & 8191) === 0) await wlTick();
    const fn = ol.fnArray[i], a = ol.argsArray[i];
    switch (fn) {
      case OPS.save: stack.push({ ctm: ctm.slice(), fill, strokeC, lw }); break;
      case OPS.restore: pop(false); break;
      case OPS.transform: ctm = mul(ctm, a); break;
      case OPS.paintFormXObjectBegin: stack.push({ ctm: ctm.slice(), fill, strokeC, lw, form: true }); if (a[0]) ctm = mul(ctm, a[0]); break;
      case OPS.paintFormXObjectEnd: pop(true); break;
      case OPS.setFillRGBColor: fill = [a[0], a[1], a[2]]; break;
      case OPS.setFillGray: fill = [a[0] * 255, a[0] * 255, a[0] * 255]; break;
      case OPS.setStrokeRGBColor: strokeC = [a[0], a[1], a[2]]; break;
      case OPS.setStrokeGray: strokeC = [a[0] * 255, a[0] * 255, a[0] * 255]; break;
      case OPS.setFillPattern: fill = null; break;
      case OPS.setStrokePattern: strokeC = null; break;
      case OPS.setLineWidth: lw = a[0]; break;
      case OPS.setGState: if (Array.isArray(a[0])) for (const kv of a[0]) if (kv && kv[0] === 'LW') lw = kv[1]; break;
      case OPS.constructPath: {
        const ops = a[0], args = a[1]; let k = 0, cur = null; curved = false;
        for (const op of ops) {
          if (op === OPS.moveTo) { cur = [ap(ctm, args[k], args[k + 1])]; path.push(cur); k += 2; }
          else if (op === OPS.lineTo) { if (!cur) { cur = []; path.push(cur); } cur.push(ap(ctm, args[k], args[k + 1])); k += 2; }
          else if (op === OPS.curveTo) { curved = true; if (!cur) { cur = []; path.push(cur); } cur.push(ap(ctm, args[k + 2], args[k + 3])); cur.push(ap(ctm, args[k + 4], args[k + 5])); k += 6; }
          else if (op === OPS.curveTo2 || op === OPS.curveTo3) { curved = true; if (!cur) { cur = []; path.push(cur); } cur.push(ap(ctm, args[k + 2], args[k + 3])); k += 4; }
          else if (op === OPS.closePath) { if (cur && cur.length) cur.push(cur[0]); }
          else if (op === OPS.rectangle) { const x = args[k], y = args[k + 1], w = args[k + 2], h = args[k + 3]; cur = [ap(ctm, x, y), ap(ctm, x + w, y), ap(ctm, x + w, y + h), ap(ctm, x, y + h), ap(ctm, x, y)]; path.push(cur); k += 4; }
        }
        break;
      }
      case OPS.fill: case OPS.eoFill: emitFills(); path = []; break;
      case OPS.fillStroke: case OPS.eoFillStroke: case OPS.closeFillStroke: case OPS.closeEOFillStroke: emitFills(); emitStrokes(); path = []; break;
      case OPS.stroke: case OPS.closeStroke: emitStrokes(); path = []; break;
      case OPS.endPath: path = []; break;
      default: break;
    }
  }
  const out = { width: vp.width, height: vp.height, shapes };
  V.vec[pn] = out; V.vecOrder.push(pn); while (V.vecOrder.length > 3) delete V.vec[V.vecOrder.shift()];
  return out;
}

/* ---------- room labels and opening codes from the text layer ---------- */
function wlLabelName(str) { const s = String(str || '').trim(); if (ROOM_RE.test(s)) return s.toUpperCase(); const m = s.match(LABEL_DIM_RE); return m && ROOM_RE.test(m[1]) ? m[1].toUpperCase() : ''; }
function wlTokPos(l, start, len) { const n = l.str.length || 1; return l.x0 + (l.x1 - l.x0) * (start + len / 2) / n; }
function wlTokStarts(toks) { let pos = 0; return toks.map(t => { const s = pos; pos += t.length + 1; return s; }); }
function wlLabels(lines) {
  const out = [];
  for (const l of lines) {
    const name = wlLabelName(l.str);
    if (name) { out.push({ name, x: l.cx, y: l.cy }); continue; }
    const toks = l.str.split(' '); if (toks.length < 2 || toks.length > 6) continue;
    const starts = wlTokStarts(toks);                                        // a label run into a tag or number on the same baseline
    for (let i = 0; i < toks.length; i++) for (let w = Math.min(3, toks.length - i); w >= 1; w--) {
      const s = toks.slice(i, i + w).join(' '); if (!ROOM_RE.test(s)) continue;
      out.push({ name: s.toUpperCase(), x: wlTokPos(l, starts[i], s.length), y: l.cy }); i += w - 1; break;
    }
  }
  return out;
}
function wlOpeningWidth(code) {                                              // wall opening width in mm for a door or window code, 0 when it is not one
  const s = String(code || '').trim().replace(/\s+OBS$/i, '').replace(/\s*\(\d+\s*panels?\)$/i, '').trim(); if (!s) return 0;
  const U = s.toUpperCase(); let m;
  if ((m = U.match(/^(\d{2})(\d{2})\s+(PANELIFT|SECTIONAL|ROLLER|SSSF|TILT)\b/))) return +m[2] * 100 + 60;
  const d = parseCode('D', s);
  if (d && d.w > 0) {
    if (/^\d{3,4}$/.test(U) && (d.w < 400 || d.w > 1250)) return 0;        // a bare number that is not a door leaf width is a dimension string
    if (/^2\//.test(U)) return /CSD$/.test(U) ? 4 * d.w : 2 * d.w + 50;
    if (/CSD$/.test(U)) return 2 * d.w;
    if (/[RS]D$/.test(U) && /^\d{4}/.test(U)) return d.w + 10;
    return d.w + 50;
  }
  const w = parseCode('W', s); return w && w.w > 0 ? w.w + 10 : 0;
}
function wlOpenings(lines) {
  const out = [];
  for (const l of lines) {
    const pm = l.str.match(PLAN_TAG_RE);
    if (pm) { const code = pm[3].replace(/(\s+\d{3,4})+$/, ''); const w = wlOpeningWidth(code); if (w) out.push({ w, x: wlTokPos(l, l.str.length - pm[3].length, code.length), y: l.cy, code }); continue; }
    const w0 = wlOpeningWidth(l.str); if (w0) { out.push({ w: w0, x: l.cx, y: l.cy, code: l.str }); continue; }
    const toks = l.str.split(' '); if (toks.length < 2 || toks.length > 4) continue;
    const starts = wlTokStarts(toks);
    for (let i = 0; i < toks.length; i++) for (let n = Math.min(2, toks.length - i); n >= 1; n--) {
      const s = toks.slice(i, i + n).join(' '), w = wlOpeningWidth(s); if (!w) continue;
      out.push({ w, x: wlTokPos(l, starts[i], s.length), y: l.cy, code: s }); i += n - 1; break;
    }
  }
  return out;
}

/* ---------- the pipeline ---------- */
function wlIsBlack(c, darkMax) { return !!c && c[0] <= darkMax && c[1] <= darkMax && c[2] <= darkMax; }
function wlFillPieces(vec, MMU, darkMax) {
  const out = [];
  for (const s of vec.shapes) {
    if (s.t !== 'fill' || !wlIsBlack(s.c, darkMax) || s.pts.length < 4) continue;
    const paths = wlRepair(s.pts.map(p => ({ X: Math.round(p[0] * MMU), Y: Math.round(p[1] * MMU) })));
    if (!paths.length) continue;
    const area = wlAreaMm2(paths); if (!(area > 0)) continue;
    const sd = wlSides(paths);
    if (sd.min > WL_P.blobSide && area > WL_P.blobArea) continue;                                     // solid blobs: arrows, boxes, north points
    if (sd.max < WL_P.symbolSide) continue;                                                            // symbols: lights, smoke alarms
    if (area < WL_P.mrrRatio * sd.area && !(sd.min <= WL_P.curvedSide && sd.max >= WL_P.curvedLen)) continue;   // door swing arcs; long thin curved strips are walls
    out.push(paths);
  }
  return out;
}
function wlStrokePieces(vec, MMU, darkMax, stats) {                          // wall face lines (brick veneer drawn as two thick lines) → 90 mm bands
  const k = MMU / WL_U, segs = [];
  for (const s of vec.shapes) {
    if (s.t !== 'stroke' || !wlIsBlack(s.c, darkMax) || !(s.w >= WL_P.strokeMinW) || s.pts.length < 2) continue;
    const pts = s.pts.map(p => [p[0] * k, p[1] * k]); let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (L < WL_P.strokeMinLen) continue; segs.push(pts);
  }
  const key = p => `${Math.round(p[0] / WL_P.chainGrid)},${Math.round(p[1] / WL_P.chainGrid)}`;
  const ends = new Map(); segs.forEach((pts, i) => { for (const e of [pts[0], pts[pts.length - 1]]) { const kk = key(e); if (!ends.has(kk)) ends.set(kk, []); ends.get(kk).push(i); } });
  const used = new Uint8Array(segs.length), chains = [];
  for (let i = 0; i < segs.length; i++) {                                    // chain pieces end to end (within 2 mm) so arcs and curved walls come back whole
    if (used[i]) continue; used[i] = 1; let chain = segs[i].slice();
    for (const dir of [1, -1]) for (;;) {
      const end = dir === 1 ? chain[chain.length - 1] : chain[0];
      const nxt = (ends.get(key(end)) || []).filter(j => !used[j]);
      if (nxt.length !== 1) break;
      const j = nxt[0]; used[j] = 1; let q = segs[j].slice();
      if (key(q[q.length - 1]) === key(end)) q.reverse();
      chain = dir === 1 ? chain.concat(q.slice(1)) : q.slice(1).reverse().concat(chain);
    }
    chains.push(chain);
  }
  const out = []; let arcs = 0;
  for (const ch of chains) {
    let L = 0; for (let i = 1; i < ch.length; i++) L += Math.hypot(ch[i][0] - ch[i - 1][0], ch[i][1] - ch[i - 1][1]);
    if (ch.length >= 4) { const f = wlFitCircle(ch); if (f && f.r >= WL_P.arcRmin && f.r <= WL_P.arcRmax) { const sweep = L / f.r * 180 / Math.PI; if (sweep >= WL_P.arcSweep[0] && sweep <= WL_P.arcSweep[1]) { arcs++; continue; } } }   // a door swing, not a wall
    if (L < WL_P.chainMinLen) continue;
    const band = wlBuffer([ch.map(p => ({ X: Math.round(p[0] * WL_U), Y: Math.round(p[1] * WL_U) }))], WL_P.band, true);
    if (band.length) out.push(band);
  }
  Object.assign(stats, { strokeSegs: segs.length, chains: chains.length, arcs, strokePieces: out.length });
  return out;
}
function wlPlugsFrom(walls, src, rMm, clip, maxThick, maxArea) {              // thin pieces a closing adds between nearby walls: the door and window gaps
  const closed = wlClosing(src, rMm); if (!closed.length) return [];
  let extra = wlDiff(closed, walls); if (!extra.length) return [];
  if (clip) { extra = wlInter(extra, clip); if (!extra.length) return []; }
  const out = [];
  for (const comp of wlComponents(extra)) {
    const area = wlCompArea(comp); if (!(area > WL_P.plugMinArea)) continue;
    if (wlSides([comp.outer]).min <= maxThick || (maxArea && area <= maxArea)) out.push([comp.outer].concat(comp.holes));
  }
  return out;
}
/* opts: { strokes: 'auto' | true | false, plugs: [{x0,y0,x1,y1}], erases: [...], progress: fn, darkMax }
   result: { rooms: [{ pts, names, areaM2, perimM, bboxMm, centroid, holes }], labels, unassigned, usedStrokes, stats } */
async function findRoomsFromWalls(pn, opts = {}) {
  const t0 = performance.now(), k = mmPerPt(pn); if (!k) throw new Error('The sheet has no scale');
  const MMU = k * WL_U, progress = opts.progress || (() => { }), darkMax = opts.darkMax == null ? WL_P.darkMax : opts.darkMax;
  progress('Reading the sheet\'s line work…'); await wlTick();
  const vec = await pageVectors(pn), lines = await pageLines(pn);
  const labels = wlLabels(lines), openings = wlOpenings(lines);
  const plugBoxes = (opts.plugs || []).map(b => wlBoxU(b, MMU)), eraseBoxes = (opts.erases || []).map(b => wlBoxU(b, MMU));
  const E = eraseBoxes.length ? wlUnion(eraseBoxes) : null;
  const fills = wlFillPieces(vec, MMU, darkMax);
  const base = { shapes: vec.shapes.length, blackFills: vec.shapes.filter(s => s.t === 'fill' && wlIsBlack(s.c, darkMax)).length, fills: fills.length, labels: labels.length, openings: openings.length };
  const runOnce = async (useStrokes) => {
    const stats = { ...base, ranStrokes: useStrokes };
    let pieces = fills.slice();
    if (useStrokes) { progress('Chaining the wall face lines…'); await wlTick(); pieces = pieces.concat(wlStrokePieces(vec, MMU, darkMax, stats)); }
    if (E) pieces = pieces.map(p => wlDiff(p, E)).filter(p => p.length);       // Open wall boxes: bars that are not walls
    stats.wallPieces = pieces.length;
    progress('Joining the walls…'); await wlTick();
    const walls = wlBuffer(wlFlat(pieces), WL_P.swell);                        // 20 mm swell closes hairline gaps; rooms are swelled back below
    progress('Sealing the openings…'); await wlTick();
    let plugs = wlPlugsFrom(walls, walls, WL_P.closeR, null, WL_P.closeThick, WL_P.closeArea);
    const wallBB = walls.map(wlBBox);
    for (let i = 0; i < openings.length; i++) {                                // every door and window code: seal its gap locally
      if (i % 4 === 0) { progress(`Sealing opening ${i + 1} of ${openings.length}…`); await wlTick(); }
      const o = openings[i], X = Math.round(o.x * MMU), Y = Math.round(o.y * MMU), r = o.w / 2 + WL_P.openPad, R = (r + WL_P.openSrc) * WL_U;
      const near = walls.filter((p, j) => wlBBoxHit(wallBB[j], X - R, Y - R, X + R, Y + R)); if (!near.length) continue;
      const src = wlInter(near, wlDisc(X, Y, r + WL_P.openSrc)); if (!src.length) continue;
      plugs = plugs.concat(wlPlugsFrom(src, src, r, wlDisc(X, Y, r + WL_P.openClip), WL_P.openThick, null));
    }
    plugs = plugs.concat(plugBoxes);
    stats.plugs = plugs.length;
    progress('Finding the rooms…'); await wlTick();
    const sealed = wlComponents(wlUnion([walls].concat(plugs)));
    const rooms = [];
    for (const comp of sealed) for (const hole of comp.holes) {
      let g = wlBuffer([wlOrient(hole)], WL_P.swell); if (!g.length) continue;
      if (wlAreaMm2(g) < WL_P.roomMinArea) continue;
      if (useStrokes) { g = wlClosing(g, WL_P.roomClosing); if (!g.length || wlSides(g).min < WL_P.roomMinSide) continue; }   // slits left by leaf lines; cavities between face lines
      const gc = wlComponents(g); if (!gc.length) continue;
      const main = gc.reduce((a, b) => wlCompArea(b) > wlCompArea(a) ? b : a);
      const outer = wlDP(main.outer, WL_P.simplify * WL_U);
      const pts = outer.map(p => ({ x: p.X / MMU, y: p.Y / MMU }));
      const names = []; for (const l of labels) if (wlContains(main, Math.round(l.x * MMU), Math.round(l.y * MMU)) && !names.includes(l.name)) names.push(l.name);
      rooms.push({ pts, names, areaM2: polyAreaPt(pts) * k * k / 1e6, perimM: polyPerimeterPt(pts) * k / 1000, bboxMm: wlBboxMm(pts, k), centroid: wlLabelPoint(pts), holes: main.holes.length, bb: wlBBox(outer) });
    }
    rooms.sort((a, b) => (Math.floor(a.centroid.y / 60) - Math.floor(b.centroid.y / 60)) || (a.centroid.x - b.centroid.x));
    const named = rooms.filter(r => r.names.length); let kept = rooms;
    if (named.length) {                                                        // unnamed shapes far from every named room are title blocks, legends and elevations
      const pad = WL_P.planPad * WL_U, bb = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
      for (const r of named) { bb.x0 = Math.min(bb.x0, r.bb.x0); bb.y0 = Math.min(bb.y0, r.bb.y0); bb.x1 = Math.max(bb.x1, r.bb.x1); bb.y1 = Math.max(bb.y1, r.bb.y1); }
      kept = rooms.filter(r => r.names.length || wlBBoxHit(r.bb, bb.x0 - pad, bb.y0 - pad, bb.x1 + pad, bb.y1 + pad));
    }
    for (const r of kept) delete r.bb;
    const assigned = new Set(); for (const r of kept) for (const n of r.names) assigned.add(n);
    const unassigned = []; for (const l of labels) if (!assigned.has(l.name) && !unassigned.includes(l.name)) unassigned.push(l.name);
    stats.dropped = rooms.length - kept.length;
    return { rooms: kept, unassigned, usedStrokes: useStrokes, stats };
  };
  const score = r => r.rooms.reduce((a, x) => a + x.names.length, 0);
  let out;
  if (opts.strokes === true) out = await runOnce(true);
  else {
    out = await runOnce(false);
    if (opts.strokes !== false && (out.rooms.length < 3 || (labels.length && out.unassigned.length / labels.length > 0.4))) {
      progress('Few rooms from the wall fills — trying the wall face lines too…');
      const r2 = await runOnce(true);
      if (score(r2) > score(out)) out = r2;
    }
  }
  out.labels = labels; out.openings = openings; out.stats.ms = Math.round(performance.now() - t0);
  return out;
}

/* ---------- the app: run, apply, fix boxes, check image ---------- */
async function runFindWalls(o = {}) {
  if (!V.pdf) { if (!o.auto) toast('Open the plan first'); return null; }
  if (typeof ClipperLib === 'undefined') { toast('The geometry library did not load — reload the page and try again', 6000); return null; }
  if (wlBusy) { if (!o.auto) toast('Still finding rooms — wait for it to finish or press Stop'); return null; }
  const pn = V.pageNum; let scaleMsg = '';
  if (!mmPerPt(pn)) {
    const ratio = await findScaleText(pn);
    if (!ratio) { modal.open({ title: 'Set the scale first', body: '<p class="small">Finding rooms from the walls works in millimetres, so the sheet needs a scale. Calibrate on a known dimension or pick a scale from the toolbar, then try again.</p>', ok: 'OK', cancel: null }); return null; }
    setPageScale(pn, ratio * PT_MM, { method: 'preset', calib: null, calibMm: null }); scaleMsg = ` Applied 1:${ratio} from the sheet's scale note — check it with Calibrate.`; updateScaleStatus(); updatePageUI();
  }
  const pg = S.pages[pn] || {};
  if (!o.auto) undo.push();
  const dropUndo = () => { if (!o.auto) { undo.stack.pop(); $('#btnUndo').disabled = !undo.stack.length; } };
  wlBusy = true; wlAbort = false; let res;
  try { res = await findRoomsFromWalls(pn, { strokes: 'auto', plugs: pg.plugs || [], erases: pg.erases || [], progress: aiProgress }); }
  catch (e) { dropUndo(); if (e && e.code === 'cancelled') toast('Stopped — nothing was changed'); else { console.error(e); toast('Finding rooms failed: ' + (e && e.message ? e.message : e), 7000); } return null; }
  finally { wlBusy = false; aiDone(); }
  if (!res.stats.blackFills && !(res.stats.strokeSegs > 0)) {
    dropUndo();
    modal.open({ title: 'No walls in this sheet\'s drawing data', body: `<p class="small">This sheet has no solid black wall fills or thick wall lines, so it is probably a scanned or rasterised plan. Trace the rooms with the Trace room and Rect room tools${CAP.sample ? ', or use Read sheet with Claude' : ''}.</p>`, ok: 'OK', cancel: null });
    return res;
  }
  const ap = await applyWallsRooms(pn, res);
  V.wallsLast = V.wallsLast || {}; V.wallsLast[pn] = res;
  renderAll(); updateScaleStatus(); updatePageUI(); if (!o.auto) showTab('rooms');
  const n = res.rooms.length - ap.skipped;
  toast(`${o.auto ? 'Rooms found again: ' : ''}${n} room${n === 1 ? '' : 's'} from the walls${res.usedStrokes ? ' (using the wall face lines too)' : ''}${ap.unnamed ? `, ${ap.unnamed} without a label` : ''}${ap.skipped ? `, ${ap.skipped} left as traced by hand` : ''}.${res.unassigned.length ? ` Not enclosed: ${res.unassigned.join(', ')}.` : ''}${scaleMsg}`, 9000);
  if (!o.auto && res.unassigned.length) modal.open({ title: 'Labels not inside any room', body: `<p class="small">${esc(res.unassigned.join(', '))}</p><p class="small muted">Outdoor areas such as alfresco and porch are expected here: their walls are open on one side. For an indoor room, close the gap with <b>Wall plug</b>, open a bar that is not a wall with <b>Open wall</b>, or trace the room by hand.</p>`, ok: 'OK', cancel: null });
  return res;
}
async function applyWallsRooms(pn, res) {                                     // replaces this sheet's walls rooms, keeping edits made to rooms found again
  const out = { added: 0, kept: 0, merged: 0, unnamed: 0, skipped: 0 };
  const old = S.rooms.filter(r => r.page === pn && r.src === 'walls'), others = S.rooms.filter(r => r.page === pn && r.src !== 'walls');
  const traced = r => r.pts && r.pts.length >= 3;
  const mutual = (r, fr) => traced(r) && pointInPoly(wlLabelPoint(r.pts), fr.pts) && pointInPoly(fr.centroid, r.pts);
  const reuse = new Set(), remove = new Set(), fresh = [], taken = new Set(S.rooms.map(r => norm(r.name)));
  let nPlace = 1;
  for (let i = 0; i < res.rooms.length; i++) {
    const fr = res.rooms[i];
    if (others.some(r => mutual(r, fr))) { out.skipped++; continue; }         // traced by hand already: leave it alone
    let name = fr.names.join('/'), notes = '';
    if (!name) { try { name = await guessRoomName(pn, fr.pts); } catch (e) { name = ''; } }
    if (!name) { while (taken.has(norm(`ROOM ${nPlace}`))) nPlace++; name = `ROOM ${nPlace++}`; notes = WL_NOTE; out.unnamed++; }
    taken.add(norm(name));
    const room = { id: uid(), name, autoName: name, page: pn, method: 'trace', pts: fr.pts, pt: null, length: 0, width: 0, perimeter: 0, skirting: defaultSkirting(name), deductions: [], notes, src: 'walls', hue: i % WL_PALETTE.length };
    const prev = old.find(r => !reuse.has(r.id) && mutual(r, fr));
    if (prev) {
      reuse.add(prev.id); room.id = prev.id; if (prev.hue != null) room.hue = prev.hue; room.skirting = prev.skirting; room.deductions = prev.deductions || [];
      if (prev.name !== prev.autoName) { room.name = prev.name; if (notes === WL_NOTE) { room.notes = ''; out.unnamed--; } }
      if (prev.notes && prev.notes !== WL_NOTE) room.notes = prev.notes;
      out.kept++;
    } else {
      const dims = others.find(r => !remove.has(r.id) && !traced(r) && r.pt && pointInPoly(r.pt, fr.pts) && (!fr.names.length || fr.names.some(nm => norm(nm) === norm(r.name))));
      if (dims) {                                                             // a room from the text or a Claude read, now with a real outline
        remove.add(dims.id); room.id = dims.id; room.skirting = dims.skirting; room.deductions = dims.deductions || [];
        if (!fr.names.length) { room.name = dims.name; room.autoName = dims.name; room.notes = ''; if (notes === WL_NOTE) out.unnamed--; }
        if (dims.notes && !/size estimated by Claude|No size printed/i.test(dims.notes)) room.notes = dims.notes;
        out.merged++;
      } else out.added++;
    }
    fresh.push(room);
  }
  const gone = new Set(old.filter(r => !reuse.has(r.id)).map(r => r.id));
  S.rooms = S.rooms.filter(r => !gone.has(r.id) && !remove.has(r.id) && !reuse.has(r.id)).concat(fresh);
  for (const d of S.doors) {
    if (gone.has(d.fromRoom)) d.fromRoom = ''; if (gone.has(d.toRoom)) d.toRoom = '';
    if (d.page !== pn || d.x == null) continue;
    const t = DOOR_TYPES[d.type] || {}, two = !t.ext || d.type === 'garage';
    if (d.fromRoom && (d.toRoom || !two)) continue;
    const near = roomsNear(pn, d).filter(r => r.id !== d.fromRoom && r.id !== d.toRoom);
    if (!d.fromRoom && near.length) d.fromRoom = near.shift().id;
    if (two && !d.toRoom && near.length) d.toRoom = near[0].id;
  }
  for (const w of S.windows) { if (gone.has(w.room)) w.room = ''; if (w.page === pn && w.x != null && !w.room) { const near = roomsNear(pn, w); if (near[0]) w.room = near[0].id; } }
  if (UI.openRoom && !S.rooms.some(r => r.id === UI.openRoom)) UI.openRoom = null;
  if (V.sel && (gone.has(V.sel) || remove.has(V.sel))) V.sel = null;
  return out;
}
function wallColour(r) { const c = WL_PALETTE[Math.abs(num(r.hue) | 0) % WL_PALETTE.length]; const n = parseInt(c.slice(1), 16); return { stroke: c, fill: `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},0.3)` }; }
function wallBoxes(pn) { const pg = S.pages[pn] || {}; return (pg.plugs || []).map(b => ({ ...b, kind: 'plug' })).concat((pg.erases || []).map(b => ({ ...b, kind: 'erase' }))); }
function addWallBox(kind, pn, a, b) {
  undo.push();
  const key = kind === 'plug' ? 'plugs' : 'erases', pg = S.pages[pn] = { ...(S.pages[pn] || {}) };
  const box = { id: uid(), x0: Math.min(a.x, b.x), y0: Math.min(a.y, b.y), x1: Math.max(a.x, b.x), y1: Math.max(a.y, b.y) };
  pg[key] = (pg[key] || []).concat([box]); V.sel = box.id;
  saveSoon(); renderRooms(); drawOverlay();
  return runFindWalls({ auto: true });
}
function removeWallBox(id) {
  for (const pn of Object.keys(S.pages)) for (const key of ['plugs', 'erases']) {
    const arr = S.pages[pn][key] || [], i = arr.findIndex(b => b.id === id); if (i < 0) continue;
    undo.push(); arr.splice(i, 1); if (V.sel === id) V.sel = null;
    saveSoon(); renderRooms(); drawOverlay(); toast('Box removed — Undo brings it back');
    if (+pn === V.pageNum) runFindWalls({ auto: true });
    return true;
  }
  return false;
}
function wlDrawBoxes(ctx, z, pn, sel, fsc = 1) {
  for (const b of wallBoxes(pn)) {
    const plug = b.kind === 'plug', col = plug ? '#D62728' : '#FF7F0E', x = b.x0 * z, y = b.y0 * z, w = (b.x1 - b.x0) * z, h = (b.y1 - b.y0) * z;
    ctx.fillStyle = plug ? 'rgba(214,39,40,0.25)' : 'rgba(255,127,14,0.25)'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = sel === b.id ? COL.sel : col; ctx.lineWidth = (sel === b.id ? 2.5 : 1.5) * fsc; ctx.setLineDash([]); ctx.strokeRect(x, y, w, h);
    ctx.font = `600 ${10 * fsc}px ${MONO}`; ctx.fillStyle = col; ctx.textBaseline = 'bottom'; ctx.fillText(plug ? 'wall' : 'open', x, y - 2 * fsc); ctx.textBaseline = 'alphabetic';
  }
}
async function renderCheckCanvas(pn) {                                       // the sheet at up to 2× with the overlay drawn on it
  const page = (pn === V.pageNum && V.page) ? V.page : await V.pdf.getPage(pn);
  const base = page.getViewport({ scale: 1 }), s = Math.min(2, Math.sqrt(16e6 / (base.width * base.height)));
  const vp = page.getViewport({ scale: s }), c = document.createElement('canvas');
  c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
  const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  paintOverlay(ctx, s, pn, { sel: null, draft: null, hover: null, fsc: s });
  return c;
}
async function saveCheckImage(pn = V.pageNum) {
  if (!V.pdf) { toast('Open the plan first'); return; }
  aiProgress('Drawing the check image…');
  try {
    const c = await renderCheckCanvas(pn), blob = await new Promise(res => c.toBlob(res, 'image/png'));
    if (!blob) throw new Error('the image could not be encoded');
    await saveBlob(`${slug(S.project.name)}-${pageTag(pn).toLowerCase().replace(/[^a-z0-9]+/g, '-')}-rooms.png`, blob);
  } catch (e) { console.warn(e); toast('Could not make the check image: ' + (e && e.message ? e.message : e), 6000); }
  finally { aiDone(); }
}
async function saveBlob(filename, blob) {
  if (CAP.downloads) {
    try { await CAP.downloads.save({ filename, data: blob }); toast('Saved ' + filename); return; }
    catch (e) { if (e && e.code === 'declined') return; console.warn(e); }
  }
  if (!window.claude) {
    try { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast('Downloaded ' + filename); return; }
    catch (e) { /* fall through */ }
  }
  const url = URL.createObjectURL(blob);
  modal.open({ title: filename, body: `<p class="small muted">Right-click or press and hold the image to save it.</p><img src="${url}" alt="Check image of the sheet with the rooms drawn on it" style="max-width:100%;height:auto;border:1px solid var(--line)">`, ok: 'Close', cancel: null });
}
