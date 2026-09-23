/* =========================== viewer =========================== */
const viewer = $('#viewer'), stage = $('#stage'), pdfC = $('#pdfCanvas'), ovC = $('#ovCanvas');
const COL = { room: '#1D5DB5', roomFill: 'rgba(29,93,181,0.13)', roomOff: '#6E7684', roomOffFill: 'rgba(110,118,132,0.12)', door: '#D2601C', win: '#0F8577', calib: '#B8267D', ai: '#7A3FC2', sel: '#14171C', sub: '#4B5361' };

async function openPdf(bytes, name, opts = {}) {
  if (!window.pdfjsLib) { toast('The PDF engine did not load — check your connection and reload.'); return false; }
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const keep = data.slice();
  let doc;
  try { doc = await pdfjsLib.getDocument({ data: data.slice() }).promise; }
  catch (e) { console.error(e); toast('Could not open that PDF: ' + (e && e.message ? e.message : e)); return false; }
  if (V.pdf) { try { V.pdf.destroy(); } catch (e) { } }
  V.pdf = doc; V.bytes = keep; V.name = name; V.text = {}; V.sel = null; V.draft = null;
  const changed = S.project.pdfName !== name;
  S.project.pdfName = name; S.project.pageCount = doc.numPages;
  if (changed) S.project.lastPage = 1;
  $('#emptyState').hidden = true;
  await goPage(clamp(S.project.lastPage || 1, 1, doc.numPages));
  fitZoom();
  if (!opts.silent) toast(`Opened ${name} — ${doc.numPages} sheet${doc.numPages === 1 ? '' : 's'}`);
  if (!opts.noStore) idbPut('pdf', { name, bytes: keep });
  saveSoon(); renderRooms(); renderDoors(); renderTakeoff();
  return true;
}
async function openFile(f) {
  if (!f) return;
  if (!/\.pdf$/i.test(f.name) && f.type !== 'application/pdf') { toast('Please choose a PDF file'); return; }
  const buf = await f.arrayBuffer(); await openPdf(new Uint8Array(buf), f.name);
}

async function goPage(n) {
  if (!V.pdf) return;
  n = clamp(n, 1, V.pdf.numPages);
  const req = (V.pageReq = (V.pageReq || 0) + 1);
  V.pageNum = n; S.project.lastPage = n; V.draft = null;
  const page = await V.pdf.getPage(n);
  if (req !== V.pageReq) return;
  V.page = page; V.base = page.getViewport({ scale: 1 });
  updatePageUI();
  await renderPage();
  drawOverlay(); updateScaleStatus(); saveSoon();
}

function sizeStage() {
  if (!V.base) return;
  const cssW = Math.max(1, Math.round(V.base.width * V.zoom)), cssH = Math.max(1, Math.round(V.base.height * V.zoom));
  let dpr = window.devicePixelRatio || 1;
  const maxPx = 22e6; if (cssW * cssH * dpr * dpr > maxPx) dpr = Math.sqrt(maxPx / (cssW * cssH));
  V.dpr = dpr;
  for (const c of [pdfC, ovC]) { c.width = Math.round(cssW * dpr); c.height = Math.round(cssH * dpr); c.style.width = cssW + 'px'; c.style.height = cssH + 'px'; }
  stage.style.width = (cssW + 48) + 'px'; stage.style.height = (cssH + 48) + 'px';
  $('#zoomVal').textContent = Math.round(V.zoom * 100) + '%';
}
async function renderPage() {
  if (!V.page) return;
  sizeStage();
  const id = ++V.renderId;
  if (V.renderTask) { try { V.renderTask.cancel(); } catch (e) { } }
  const ctx = pdfC.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, pdfC.width, pdfC.height);
  const vp = V.page.getViewport({ scale: V.zoom * V.dpr });
  const task = V.page.render({ canvasContext: ctx, viewport: vp });
  V.renderTask = task;
  try { await task.promise; } catch (e) { /* cancelled by a newer render */ }
  if (V.renderTask === task) V.renderTask = null;
  if (id === V.renderId) drawOverlay();
}
function fitZoom() {
  if (!V.base) return;
  const w = Math.max(100, viewer.clientWidth - 48), h = Math.max(100, viewer.clientHeight - 48);
  V.zoom = clamp(Math.min(w / V.base.width, h / V.base.height), 0.05, 8);
  viewer.scrollLeft = 0; viewer.scrollTop = 0;
  renderPage(); updateScaleStatus();
}
function setZoom(z, cx, cy) {
  if (!V.base) return;
  z = clamp(z, 0.05, 8);
  const r = viewer.getBoundingClientRect();
  if (cx == null) { cx = r.width / 2; cy = r.height / 2; }
  const bx = (viewer.scrollLeft + cx - 24) / V.zoom, by = (viewer.scrollTop + cy - 24) / V.zoom;
  V.zoom = z; sizeStage();
  viewer.scrollLeft = bx * z + 24 - cx; viewer.scrollTop = by * z + 24 - cy;
  renderPage(); updateScaleStatus();
}
function toBase(e) { const r = pdfC.getBoundingClientRect(); return { x: (e.clientX - r.left) / V.zoom, y: (e.clientY - r.top) / V.zoom }; }
function centreOn(p, pn) {
  if (!V.base) return;
  const go = pn && pn !== V.pageNum ? goPage(pn) : Promise.resolve();
  go.then(() => { const r = viewer.getBoundingClientRect(); viewer.scrollLeft = p.x * V.zoom + 24 - r.width / 2; viewer.scrollTop = p.y * V.zoom + 24 - r.height / 2; drawOverlay(); });
}

/* ---------- scale ---------- */
function mmPerPt(pn) { const p = S.pages[pn]; return p && p.mmPerPt > 0 ? p.mmPerPt : 0; }
function scaleRatio(pn) { const k = mmPerPt(pn); return k ? k / PT_MM : 0; }
function setPageScale(pn, k, info) { S.pages[pn] = { ...(S.pages[pn] || {}), mmPerPt: k, ...info }; }
function pageTag(pn) { const p = S.pages[pn]; return p && p.label ? p.label : 'Sheet ' + pn; }
function ratioStr(pn) { const r = scaleRatio(pn); return r ? '1:' + (r >= 10 ? Math.round(r) : r.toFixed(1)) : 'not set'; }
function updateScaleStatus() {
  const el = $('#scaleStatus');
  if (!V.pdf) { el.innerHTML = S.project.pdfName ? `<span class="warn">Re-open ${esc(S.project.pdfName)}</span> to see the plan — rooms, doors and windows are kept` : 'No plan loaded'; return; }
  const pg = S.pages[V.pageNum] || {}; const k = mmPerPt(V.pageNum);
  if (!k) { el.innerHTML = `<span class="warn">Scale not set for this sheet</span> — Calibrate on a known dimension, or pick a scale`; return; }
  el.innerHTML = `<span class="ok">Scale ${ratioStr(V.pageNum)}</span> ${pg.method === 'calibrated' ? `calibrated on ${pg.calibMm} mm` : 'preset (assumes true paper size)'} · 1 m = ${(1000 / k * V.zoom).toFixed(0)} px`;
}
function updatePageUI() {
  const n = V.pdf ? V.pdf.numPages : 0;
  $('#pageInfo').textContent = V.pdf ? `${V.pageNum} / ${n}` : '–';
  $('#prevPage').disabled = !V.pdf || V.pageNum <= 1; $('#nextPage').disabled = !V.pdf || V.pageNum >= n;
  $('#pageLabel').value = (S.pages[V.pageNum] && S.pages[V.pageNum].label) || '';
  const ratio = Math.round(scaleRatio(V.pageNum)); const sel = $('#scalePreset');
  sel.value = [...sel.options].some(o => o.value === String(ratio)) ? String(ratio) : '';
}
function afterScaleChange() { updateScaleStatus(); updatePageUI(); renderRooms(); renderTakeoff(); drawOverlay(); saveSoon(); }
function allPages() { return V.pdf ? [...Array(V.pdf.numPages)].map((_, i) => i + 1) : [V.pageNum]; }
function applyPreset(ratio, all) {
  if (!V.pdf) return;
  undo.push(); const k = ratio * PT_MM;
  for (const n of (all ? allPages() : [V.pageNum])) {
    if (all && n !== V.pageNum && S.pages[n] && S.pages[n].method === 'calibrated') continue;   // keep calibrated sheets
    setPageScale(n, k, { method: 'preset', calib: null, calibMm: null });
  }
  afterScaleChange(); toast(`Scale 1:${ratio} set — this assumes the PDF is at true paper size`);
}
function finishCalib(a, b) {
  const dpt = dist(a, b); if (dpt * V.zoom < 4) { toast('Points too close — click the two ends of a dimension'); return; }
  const pn = V.pageNum; const prev = S.pages[pn] && S.pages[pn].calibMm;
  modal.open({
    title: 'Calibrate scale',
    body: `<label>Real length of the line you marked (mm)<input id="calibMm" type="number" inputmode="decimal" min="1" value="${prev || ''}" placeholder="e.g. 3600"></label>
           <label class="chk flat"><input type="checkbox" id="calibAll"> Apply this scale to every sheet</label>
           <p class="small muted">Use the longest dimension string you can find — a whole wall rather than a door — for the best accuracy.</p>`,
    ok: 'Set scale',
    onOk: () => {
      const mm = num($('#calibMm').value); if (!(mm > 0)) return false;
      undo.push(); const k = mm / dpt;
      for (const n of ($('#calibAll').checked ? allPages() : [pn])) setPageScale(n, k, { method: 'calibrated', calibMm: mm, calib: n === pn ? { a, b } : ((S.pages[n] || {}).calib || null) });
      afterScaleChange(); toast(`Scale set to ${ratioStr(pn)}`);
    }
  });
}

/* ---------- geometry ---------- */
function polyPerimeterPt(pts) { let s = 0; for (let i = 0; i < pts.length; i++) s += dist(pts[i], pts[(i + 1) % pts.length]); return s; }
function polyAreaPt(pts) { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p.x * q.y - q.x * p.y; } return Math.abs(a) / 2; }
function centroid(pts) { let x = 0, y = 0; for (const p of pts) { x += p.x; y += p.y; } return { x: x / pts.length, y: y / pts.length }; }
function pointInPoly(p, pts) { let inside = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside; } return inside; }
function distToSeg(p, a, b) { const l2 = dist(a, b) ** 2; if (!l2) return dist(p, a); const t = clamp(((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2, 0, 1); return dist(p, { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) }); }
function distToPoly(p, pts) { if (pointInPoly(p, pts)) return 0; let m = Infinity; for (let i = 0; i < pts.length; i++) m = Math.min(m, distToSeg(p, pts[i], pts[(i + 1) % pts.length])); return m; }
function snapOrtho(prev, p, off) {
  if (off || !prev) return p;
  const ang = Math.abs(Math.atan2(p.y - prev.y, p.x - prev.x)) * 180 / Math.PI;
  if (ang < 7 || ang > 173) return { x: p.x, y: prev.y };
  if (Math.abs(ang - 90) < 7) return { x: prev.x, y: p.y };
  return p;
}

/* ---------- overlay ---------- */
function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function drawLabel(ctx, x, y, title, sub, col, sel) {
  ctx.font = `600 12px ${MONO}`; const tw = ctx.measureText(title).width;
  ctx.font = `11px ${MONO}`; const sw = sub ? ctx.measureText(sub).width : 0;
  const w = Math.max(tw, sw) + 16, h = sub ? 34 : 20;
  ctx.fillStyle = 'rgba(255,255,255,0.93)'; ctx.strokeStyle = sel ? COL.sel : col; ctx.lineWidth = sel ? 2 : 1;
  roundRect(ctx, x - w / 2, y - h / 2, w, h, 4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `600 12px ${MONO}`; ctx.fillText(title, x, sub ? y - 7 : y);
  if (sub) { ctx.fillStyle = COL.sub; ctx.font = `11px ${MONO}`; ctx.fillText(sub, x, y + 8); }
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}
function drawMarker(ctx, x, y, tag, col, sel, square) {
  ctx.font = `600 11px ${MONO}`; const w = Math.max(28, ctx.measureText(tag).width + 12), h = 18, py = y - 16;
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, sel ? 4 : 3, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, py + h / 2); ctx.stroke();
  ctx.fillStyle = col; ctx.strokeStyle = sel ? COL.sel : 'rgba(255,255,255,0.9)'; ctx.lineWidth = sel ? 2.5 : 1.5;
  roundRect(ctx, x - w / 2, py - h / 2, w, h, square ? 3 : 9); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(tag, x, py + 0.5);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}
function drawHandle(ctx, x, y, hot) { ctx.fillStyle = hot ? COL.room : '#fff'; ctx.strokeStyle = COL.sel; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.rect(x - 4, y - 4, 8, 8); ctx.fill(); ctx.stroke(); }
function drawTip(ctx, x, y, text) { ctx.font = `11px ${MONO}`; const w = ctx.measureText(text).width + 10; ctx.fillStyle = 'rgba(20,23,28,0.85)'; roundRect(ctx, x, y - 16, w, 18, 3); ctx.fill(); ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.fillText(text, x + 5, y - 7); ctx.textBaseline = 'alphabetic'; }
function drawCalib(ctx, a, b, text) {
  ctx.strokeStyle = COL.calib; ctx.lineWidth = 2; ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  const ang = Math.atan2(b.y - a.y, b.x - a.x), nx = -Math.sin(ang) * 7, ny = Math.cos(ang) * 7;
  for (const p of [a, b]) { ctx.beginPath(); ctx.moveTo(p.x + nx, p.y + ny); ctx.lineTo(p.x - nx, p.y - ny); ctx.stroke(); }
  drawTip(ctx, (a.x + b.x) / 2 + 8, (a.y + b.y) / 2 - 8, text);
}
function drawOverlay() {
  if (!V.page || !ovC.width) return;
  const z = V.zoom, ctx = ovC.getContext('2d');
  ctx.setTransform(V.dpr, 0, 0, V.dpr, 0, 0);
  ctx.clearRect(0, 0, ovC.width / V.dpr, ovC.height / V.dpr);
  const pn = V.pageNum, k = mmPerPt(pn);
  const P = p => ({ x: p.x * z, y: p.y * z });
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  for (const r of S.rooms) {
    if (r.page !== pn) continue;
    const sel = V.sel === r.id, col = r.skirting ? COL.room : COL.roomOff;
    if (r.pts && r.pts.length >= 2) {
      ctx.beginPath(); r.pts.forEach((p, i) => { const q = P(p); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); }); ctx.closePath();
      ctx.fillStyle = r.skirting ? COL.roomFill : COL.roomOffFill; ctx.fill();
      ctx.strokeStyle = sel ? COL.sel : col; ctx.lineWidth = sel ? 2.5 : 1.5; ctx.setLineDash(r.skirting ? [] : [6, 4]); ctx.stroke(); ctx.setLineDash([]);
      const c = P(centroid(r.pts));
      drawLabel(ctx, c.x, c.y, r.name || 'Room', k ? fm(polyPerimeterPt(r.pts) * k) + ' m' : 'no scale', col, sel);
      if (sel) for (const p of r.pts) { const q = P(p); drawHandle(ctx, q.x, q.y, false); }
    } else if (r.pt) {
      const q = P(r.pt);
      const sub = r.method === 'dims' && r.length && r.width ? `${r.length} × ${r.width}` : (r.method === 'perimeter' && r.perimeter ? fm(r.perimeter) + ' m' : 'size?');
      drawLabel(ctx, q.x, q.y, r.name || 'Room', sub, col, sel);
    }
  }
  for (const d of S.doors) if (d.page === pn && d.x != null) drawMarker(ctx, d.x * z, d.y * z, d.tag || 'D', COL.door, V.sel === d.id, false);
  for (const w of S.windows) if (w.page === pn && w.x != null) drawMarker(ctx, w.x * z, w.y * z, w.tag || 'W', COL.win, V.sel === w.id, true);
  const pg = S.pages[pn];
  if (pg && pg.calib && pg.method === 'calibrated') drawCalib(ctx, P(pg.calib.a), P(pg.calib.b), `${pg.calibMm} mm`);
  const d = V.draft, h = V.hover;
  if (d) {
    ctx.strokeStyle = d.kind === 'ai' ? COL.ai : (d.kind === 'calib' ? COL.calib : COL.room); ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]);
    if (d.kind === 'poly') {
      ctx.beginPath(); d.pts.forEach((p, i) => { const q = P(p); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); });
      const last = d.pts[d.pts.length - 1]; const s = h ? snapOrtho(last, h, V.noSnap) : null;
      if (s) { const q = P(s); ctx.lineTo(q.x, q.y); }
      ctx.stroke(); ctx.setLineDash([]);
      d.pts.forEach((p, i) => { const q = P(p); drawHandle(ctx, q.x, q.y, i === 0 && d.pts.length >= 3); });
      if (s) { const q = P(s); drawTip(ctx, q.x + 12, q.y - 12, k ? Math.round(dist(last, s) * k) + ' mm' : 'no scale'); }
    } else if (d.kind === 'rect' && h) {
      const a = P(d.pts[0]), b = P(h); ctx.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y)); ctx.setLineDash([]);
      drawTip(ctx, b.x + 12, b.y - 12, k ? `${Math.round(Math.abs(h.x - d.pts[0].x) * k)} × ${Math.round(Math.abs(h.y - d.pts[0].y) * k)} mm` : 'no scale');
    } else if (d.kind === 'calib' && h) {
      drawCalib(ctx, P(d.pts[0]), P(h), k ? Math.round(dist(d.pts[0], h) * k) + ' mm' : 'enter length after 2nd click');
    } else if (d.kind === 'ai') {
      const a = P(d.pts[0]), b = P(d.pts[1]); const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y), w = Math.abs(b.x - a.x), hh = Math.abs(b.y - a.y);
      ctx.fillStyle = 'rgba(122,63,194,0.08)'; ctx.fillRect(x, y, w, hh); ctx.strokeRect(x, y, w, hh); ctx.setLineDash([]);
    }
    ctx.setLineDash([]);
  }
}

/* ---------- tools ---------- */
const HINTS = {
  select: 'Click an item to edit it · drag to move · drag empty space (or hold Space) to pan · Ctrl+wheel zooms · Delete removes',
  calib: 'Click one end of a dimension string, then the other end, and type its length',
  poly: 'Click each corner along the inside face of the walls · click the first corner or press Enter to close · Backspace removes a corner · hold Alt to turn off right-angle snap',
  rect: 'Click two opposite corners of the room',
  door: 'Click the door on the plan — it will be assigned to the rooms either side',
  window: 'Click the window on the plan',
  ai: 'Drag a box around the part of the plan you want Claude to read'
};
function setTool(t, opts) {
  V.tool = t; V.draft = null; V.aiQueueMode = !!(t === 'ai' && opts && opts.queue);
  $$('#toolGrp .tbtn').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tool === t)));
  viewer.className = 'viewer tool-' + t;
  $('#hint').textContent = V.aiQueueMode ? 'Drag a box around each area you want queued for Claude. Press V when you are done.' : (HINTS[t] || '');
  drawOverlay();
}
let panState = null;
function startPan(e) { panState = { x: e.clientX, y: e.clientY, sl: viewer.scrollLeft, st: viewer.scrollTop }; try { stage.setPointerCapture(e.pointerId); } catch (err) { } viewer.classList.add('panning'); }
function endPan() { panState = null; if (!V.space) viewer.classList.remove('panning'); }
function hitTest(p) {
  const z = V.zoom, pn = V.pageNum;
  const pill = o => { const dx = (p.x - o.x) * z, dy = (p.y - o.y) * z; return Math.abs(dx) < 18 && dy > -28 && dy < 8; };
  for (const d of [...S.doors].reverse()) if (d.page === pn && d.x != null && pill(d)) return { kind: 'door', obj: d };
  for (const w of [...S.windows].reverse()) if (w.page === pn && w.x != null && pill(w)) return { kind: 'window', obj: w };
  const selRoom = S.rooms.find(r => r.id === V.sel);
  if (selRoom && selRoom.pts && selRoom.page === pn) { const i = selRoom.pts.findIndex(q => dist(p, q) * z <= 8); if (i >= 0) return { kind: 'vertex', obj: selRoom, idx: i }; }
  for (const r of [...S.rooms].reverse()) if (r.page === pn && r.pt && !r.pts && Math.abs(p.x - r.pt.x) * z < 40 && Math.abs(p.y - r.pt.y) * z < 18) return { kind: 'roomPt', obj: r };
  for (const r of [...S.rooms].reverse()) if (r.page === pn && r.pts && r.pts.length >= 3 && pointInPoly(p, r.pts)) return { kind: 'room', obj: r };
  return null;
}
stage.addEventListener('pointerdown', e => {
  if (!V.page) return;
  if (e.button === 1 || (e.button === 0 && V.space)) { e.preventDefault(); startPan(e); return; }
  if (e.button !== 0) return;
  viewer.focus({ preventScroll: true });
  const p = toBase(e);
  switch (V.tool) {
    case 'select': {
      if (V.place) { placeItem(p); break; }
      const hit = hitTest(p);
      if (hit) {
        V.sel = hit.obj.id;
        const orig = hit.kind === 'vertex' ? { ...hit.obj.pts[hit.idx] } : hit.kind === 'roomPt' ? { ...hit.obj.pt } : hit.kind === 'room' ? null : { x: hit.obj.x, y: hit.obj.y };
        V.drag = { hit, start: p, orig, moved: false };
        try { stage.setPointerCapture(e.pointerId); } catch (err) { }
        onSelect(hit);
      } else { if (V.sel) { V.sel = null; refreshSelection(); } startPan(e); }
      drawOverlay(); break;
    }
    case 'calib':
      if (!V.draft) V.draft = { kind: 'calib', pts: [p] };
      else { const a = V.draft.pts[0]; V.draft = null; finishCalib(a, p); }
      drawOverlay(); break;
    case 'poly':
      if (!V.draft) V.draft = { kind: 'poly', pts: [p] };
      else { const pts = V.draft.pts; if (pts.length >= 3 && dist(pts[0], p) * V.zoom < 12) finishPoly(); else pts.push(snapOrtho(pts[pts.length - 1], p, e.altKey)); }
      drawOverlay(); break;
    case 'rect':
      if (!V.draft) V.draft = { kind: 'rect', pts: [p] };
      else { const a = V.draft.pts[0]; V.draft = null; finishRect(a, p); }
      drawOverlay(); break;
    case 'door': addDoorAt(p); break;
    case 'window': addWindowAt(p); break;
    case 'ai': V.draft = { kind: 'ai', pts: [p, p] }; try { stage.setPointerCapture(e.pointerId); } catch (err) { } drawOverlay(); break;
  }
});
stage.addEventListener('pointermove', e => {
  if (!V.page) return;
  if (panState) { viewer.scrollLeft = panState.sl - (e.clientX - panState.x); viewer.scrollTop = panState.st - (e.clientY - panState.y); return; }
  const p = toBase(e); V.hover = p; V.noSnap = e.altKey;
  if (V.drag) {
    const d = V.drag; if (!d.orig) return;
    if (!d.moved) { if (dist(d.start, p) * V.zoom < 3) return; undo.push(); d.moved = true; }
    const dx = p.x - d.start.x, dy = p.y - d.start.y, o = d.hit.obj;
    if (d.hit.kind === 'vertex') o.pts[d.hit.idx] = { x: d.orig.x + dx, y: d.orig.y + dy };
    else if (d.hit.kind === 'roomPt') o.pt = { x: d.orig.x + dx, y: d.orig.y + dy };
    else { o.x = d.orig.x + dx; o.y = d.orig.y + dy; }
    drawOverlay(); return;
  }
  if (V.draft) { if (V.draft.kind === 'ai') V.draft.pts[1] = p; drawOverlay(); }
});
stage.addEventListener('pointerup', e => {
  if (panState) { endPan(); return; }
  if (V.drag) {
    const d = V.drag; V.drag = null;
    if (d.moved) { if (d.hit.kind === 'vertex') refreshRoomCard(d.hit.obj.id); else if (d.hit.kind === 'door' || d.hit.kind === 'window') { const near = roomsNear(d.hit.obj.page, d.hit.obj); if (d.hit.kind === 'door' && !d.hit.obj.fromRoom && near[0]) d.hit.obj.fromRoom = near[0].id; } renderTakeoff(); saveSoon(); drawOverlay(); }
    return;
  }
  if (V.draft && V.draft.kind === 'ai') {
    const [a, b] = V.draft.pts; V.draft = null; drawOverlay();
    const r = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
    if (r.w * V.zoom > 20 && r.h * V.zoom > 20) { if (V.aiQueueMode) queueAiRead(r, V.pageNum, false); else aiRead(r); } else toast('Drag a larger box');
  }
});
stage.addEventListener('pointercancel', () => { panState = null; V.drag = null; viewer.classList.remove('panning'); });
stage.addEventListener('dblclick', e => {
  if (V.tool === 'poly' && V.draft && V.draft.kind === 'poly') {
    e.preventDefault(); const pts = V.draft.pts, n = pts.length;
    if (n >= 2 && dist(pts[n - 1], pts[n - 2]) * V.zoom < 6) pts.pop();
    finishPoly();
  }
});
viewer.addEventListener('wheel', e => {
  if (!(e.ctrlKey || e.metaKey) || !V.base) return;
  e.preventDefault(); const r = viewer.getBoundingClientRect();
  setZoom(V.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12), e.clientX - r.left, e.clientY - r.top);
}, { passive: false });
['dragenter', 'dragover'].forEach(ev => viewer.addEventListener(ev, e => { e.preventDefault(); viewer.classList.add('drop'); }));
['dragleave', 'drop'].forEach(ev => viewer.addEventListener(ev, e => { e.preventDefault(); viewer.classList.remove('drop'); }));
viewer.addEventListener('drop', e => { const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) openFile(f); });

function onSelect(hit) {
  if (hit.kind === 'door') { UI.openDoor = hit.obj.id; showTab('doors'); renderDoors(); scrollToCard(hit.obj.id); }
  else if (hit.kind === 'window') { UI.openWin = hit.obj.id; showTab('doors'); renderDoors(); scrollToCard(hit.obj.id); }
  else { UI.openRoom = hit.obj.id; showTab('rooms'); renderRooms(); scrollToCard(hit.obj.id); }
}
function refreshSelection() { $$('.card').forEach(c => c.classList.toggle('sel', c.dataset.id === V.sel)); drawOverlay(); }
function scrollToCard(id) { const c = $(`.card[data-id="${id}"]`); if (c) c.scrollIntoView({ block: 'nearest' }); }

/* ---------- creating items ---------- */
function finishPoly() {
  const pts = V.draft ? V.draft.pts : null; V.draft = null; drawOverlay();
  if (!pts || pts.length < 3) { toast('A room needs at least 3 corners'); return; }
  addRoomFromPts(pts);
}
function finishRect(a, b) {
  if (Math.abs(a.x - b.x) * V.zoom < 4 || Math.abs(a.y - b.y) * V.zoom < 4) { drawOverlay(); return; }
  addRoomFromPts([{ x: a.x, y: a.y }, { x: b.x, y: a.y }, { x: b.x, y: b.y }, { x: a.x, y: b.y }]);
}
async function addRoomFromPts(pts) {
  const pn = V.pageNum, k = mmPerPt(pn);
  if (V.retrace) {
    const r = S.rooms.find(x => x.id === V.retrace); V.retrace = null;
    if (r) { undo.push(); r.pts = pts; r.pt = null; r.method = 'trace'; r.page = pn; V.sel = r.id; UI.openRoom = r.id; setTool('select'); renderAll(); toast(`${r.name} traced`); return; }
  }
  let guess = ''; try { guess = await guessRoomName(pn, pts); } catch (e) { }
  modal.open({
    title: 'New room',
    body: `<label>Room name<input id="roomName" list="dl-rooms" value="${esc(guess)}" placeholder="e.g. BED 1"></label>
           <div class="stats"><span>Perimeter <b>${k ? fm(polyPerimeterPt(pts) * k) + ' m' : 'set the scale first'}</b></span><span>Area <b>${k ? (polyAreaPt(pts) * k * k / 1e6).toFixed(1) + ' m²' : '–'}</b></span></div>`,
    ok: 'Add room',
    onOk: () => {
      const name = $('#roomName').value.trim() || 'Room';
      undo.push();
      const r = { id: uid(), name, page: pn, method: 'trace', pts, pt: null, length: 0, width: 0, perimeter: 0, skirting: defaultSkirting(name), deductions: [], notes: '', src: 'trace' };
      S.rooms.push(r); UI.openRoom = r.id; V.sel = r.id; renderAll(); showTab('rooms'); scrollToCard(r.id);
    }
  });
}
function nextTag(prefix) {
  let m = 0; for (const o of (prefix === 'D' ? S.doors : S.windows)) { const mm = String(o.tag || '').match(/^[A-Za-z]+\s*-?\s*(\d+)/); if (mm) m = Math.max(m, +mm[1]); }
  return prefix + String(m + 1).padStart(2, '0');
}
function roomsNear(pn, p) {
  if (!p || p.x == null) return [];
  const k = mmPerPt(pn) || 35; const tol = 450 / k;
  const traced = S.rooms.filter(r => r.page === pn && r.pts && r.pts.length >= 3).map(r => ({ r, d: distToPoly(p, r.pts) })).filter(x => x.d <= tol).sort((a, b) => a.d - b.d).map(x => x.r);
  if (traced.length) return traced;
  return S.rooms.filter(r => r.page === pn && r.pt && !r.pts).map(r => ({ r, d: dist(p, r.pt) })).filter(x => x.d <= 4000 / k).sort((a, b) => a.d - b.d).slice(0, 2).map(x => x.r);
}
function newDoor(pn, p) {
  const sp = S.spec, near = roomsNear(pn, p);
  return { id: uid(), tag: nextTag('D'), page: pn, x: p ? p.x : null, y: p ? p.y : null, type: 'hinged', height: num(sp.doorHeight, 2040), width: num(sp.doorWidth, 820), thick: num(sp.doorThick, 35), leaves: 1, hand: '', leaf: sp.doorLeaf, colour: '', lever: 'auto', archSides: 2, skirtDeduct: true, fire: false, fromRoom: near[0] ? near[0].id : '', toRoom: near[1] ? near[1].id : '', qty: 1, notes: '', src: 'manual' };
}
function applyDoorType(d, type) {
  const t = DOOR_TYPES[type] || DOOR_TYPES.hinged, sp = S.spec; d.type = type;
  d.archSides = t.arch; d.fire = !!t.fire; if (t.leaves) d.leaves = t.leaves; else if (d.leaves > 1 && (type === 'hinged' || type === 'cavity')) d.leaves = 1;
  if (t.height) d.height = t.height; else if (!(d.height > 0) || d.height === 2100) d.height = num(sp.doorHeight, 2040);
  if (t.width) d.width = t.width; else if (!(d.width > 0) || d.width === 2400 || d.width === 920) d.width = num(sp.doorWidth, 820);
  d.thick = t.ext ? 40 : num(sp.doorThick, 35);
  d.leaf = t.noLeaf ? '' : (t.ext ? sp.extLeaf : sp.doorLeaf);
  d.lever = t.lever === 'auto' ? 'auto' : t.lever;
  if (t.ext && type !== 'garage') d.toRoom = '';
}
function addDoorAt(p) { undo.push(); const d = newDoor(V.pageNum, p); S.doors.push(d); UI.openDoor = d.id; V.sel = d.id; renderAll(); showTab('doors'); scrollToCard(d.id); }
function newWindow(pn, p) { const near = roomsNear(pn, p); return { id: uid(), tag: nextTag('W'), page: pn, x: p ? p.x : null, y: p ? p.y : null, width: 0, height: 0, arch: !!S.spec.windowsArch, room: near[0] ? near[0].id : '', qty: 1, notes: '', src: 'manual' }; }
function addWindowAt(p) { undo.push(); const w = newWindow(V.pageNum, p); S.windows.push(w); UI.openWin = w.id; V.sel = w.id; renderAll(); showTab('doors'); scrollToCard(w.id); }
function deleteItem(id) {
  const ri = S.rooms.findIndex(r => r.id === id), di = S.doors.findIndex(d => d.id === id), wi = S.windows.findIndex(w => w.id === id);
  if (ri < 0 && di < 0 && wi < 0) return;
  undo.push();
  if (ri >= 0) { S.rooms.splice(ri, 1); for (const d of S.doors) { if (d.fromRoom === id) d.fromRoom = ''; if (d.toRoom === id) d.toRoom = ''; } for (const w of S.windows) if (w.room === id) w.room = ''; }
  if (di >= 0) S.doors.splice(di, 1);
  if (wi >= 0) S.windows.splice(wi, 1);
  if (V.sel === id) V.sel = null;
  renderAll(); toast('Deleted — Undo brings it back');
}

/* ---------- keyboard ---------- */
document.addEventListener('keydown', e => {
  if (!$('#modal').hidden) return;
  const inField = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !inField) { e.preventDefault(); undo.pop(); return; }
  if (inField) return;
  if (e.key === ' ') { if (!e.repeat) { V.space = true; viewer.classList.add('panning'); } e.preventDefault(); return; }
  const k = e.key.toLowerCase();
  const tools = { v: 'select', c: 'calib', r: 'poly', x: 'rect', d: 'door', w: 'window', a: 'ai' };
  if (tools[k] && !e.ctrlKey && !e.metaKey && !e.altKey) { if (k === 'a' && !CAP.sample) return; setTool(tools[k]); return; }
  if (e.key === 'Escape') { if (V.place || V.retrace) { V.place = null; V.retrace = null; setTool('select'); toast('Cancelled'); } else if (V.draft) { V.draft = null; drawOverlay(); } else if (V.sel) { V.sel = null; refreshSelection(); } return; }
  if (e.key === 'Enter' && V.draft && V.draft.kind === 'poly') { finishPoly(); return; }
  if (e.key === 'Backspace' && V.draft && V.draft.kind === 'poly') { V.draft.pts.pop(); if (!V.draft.pts.length) V.draft = null; drawOverlay(); return; }
  if ((e.key === 'Delete' || e.key === 'Backspace') && V.sel) { deleteItem(V.sel); return; }
  if (e.key === '+' || e.key === '=') setZoom(V.zoom * 1.2);
  else if (e.key === '-' || e.key === '_') setZoom(V.zoom / 1.2);
  else if (e.key === '0') fitZoom();
  else if (e.key === 'PageDown') goPage(V.pageNum + 1);
  else if (e.key === 'PageUp') goPage(V.pageNum - 1);
});
document.addEventListener('keyup', e => { if (e.key === ' ') { V.space = false; if (!panState) viewer.classList.remove('panning'); } });
