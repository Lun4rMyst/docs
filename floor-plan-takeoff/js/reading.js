/* =========================== reading the plan =========================== */
const ROOM_WORDS = "MASTER(?: BED(?:ROOM)?| SUITE)?|MAIN BED(?:ROOM)?|BED(?:ROOM)?\\s*\\d{0,2}|BR\\s*\\d|LIVING(?: ROOM| AREA)?|LOUNGE(?: ROOM)?|FAMILY(?: ROOM)?|MEALS|DINING(?: ROOM)?|KITCHEN|KIT|PANTRY|WIP|BUTLER'?S?(?: PANTRY)?|SCULLERY|STUDY|OFFICE|HOME OFFICE|ENTRY|ENTRANCE|FOYER|HALL(?:WAY)?|PASSAGE|GALLERY|LAUNDRY|LDRY|L'DRY|BATH(?:ROOM)?|ENS(?:UITE)?\\s*\\d?|WC|W\\.C\\.?|PDR|POWDER(?: ROOM)?|TOILET|WIR|WALK[- ]?IN ROBE|ROBE|WARDROBE|GARAGE|DOUBLE GARAGE|ALFRESCO|PORCH|PORTICO|PATIO|VERANDAH?|THEATRE|MEDIA(?: ROOM)?|RUMPUS|ACTIVITY|RETREAT|GAMES(?: ROOM)?|MUD ?ROOM|LINEN|STORE|STORAGE|SITTING(?: ROOM)?|GUEST(?: BED(?:ROOM)?)?|NOOK|BAR|GYM|CELLAR|LIBRARY|PLAYROOM|UTILITY|LOBBY|LANDING|BALCONY|DECK|TERRACE|CARPORT|STAIRS?|VOID|KIDS RETREAT|PARENTS RETREAT|OPEN PLAN(?: LIVING)?|LIVING ?/ ?DINING|KITCHEN ?/ ?MEALS|STUDY NOOK|LINEN CUPBOARD|BROOM|CLOAK|LIFT|BED\\s*\\d\\s*/\\s*STUDY";
const ROOM_RE = new RegExp(`^(?:${ROOM_WORDS})$`, 'i');
const DIM_NUM = "(?:\\d{1,2}[.,]\\d{1,3}|\\d{3,5})";
const DIM_RE = new RegExp(`^(${DIM_NUM})\\s*m?\\s*[xX×]\\s*(${DIM_NUM})\\s*m?$`);
const LABEL_DIM_RE = new RegExp(`^(.*?)\\s+((?:${DIM_NUM})\\s*m?\\s*[xX×]\\s*(?:${DIM_NUM})\\s*m?)$`);
const TAG_RE = /^([DW])\s?-?\s?(\d{1,3})\s?([A-Za-z]?)$/;
const PLAN_TAG_RE = /^([DW])\s?-?\s?(\d{1,3})\s+(\S.*)$/i;   // tag and code on one line, as drawn on a plan: "D04 2424XOSD", "W18 12045DH OBS", "D11 2/720"
function parseCode(kind, code) {
  const c = code.replace(/\s+OBS$/i, '').trim(), U = c.toUpperCase(), dh = num(S.spec.doorHeight, 2040); let m;
  if (kind === 'D') {
    if ((m = U.match(/^2\/(\d{3,4})\s*(CSD)?$/))) return { kind, text: `${c} ${m[2] ? 'cavity slider' : 'hinged'} pair`, h: dh, w: +m[1] };
    if ((m = U.match(/^(\d{3,4})\s*CSD$/))) return { kind, text: `${c} cavity slider`, h: dh, w: +m[1] };
    if ((m = U.match(/^(\d{3,4})\s+(\d{3,4})H$/))) return { kind, text: `${c} hinged, reduced height`, h: +m[2], w: +m[1] };
    if ((m = U.match(/^(\d{2})(\d{2})[A-Z]*RD$/))) return { kind, text: `${c} roller door`, h: +m[1] * 100, w: +m[2] * 100 };
    if ((m = U.match(/^(\d{2})(\d{2})[A-Z]*SD$/))) return { kind, text: `${c} external sliding door`, h: +m[1] * 100, w: +m[2] * 100 };
    if ((m = U.match(/^(\d{3,4})$/))) return { kind, text: `${c} hinged`, h: dh, w: +m[1] };
    return null;
  }
  if ((m = U.match(/^(\d{2})(\d{2})\s+\d{4}\s+CRN/))) return { kind, text: `${c} corner window`, h: +m[1] * 100, w: +m[2] * 200 };
  if ((m = U.match(/^(\d{2})(\d{3})[A-Z]/))) return { kind, text: c, h: +m[1] * 100, w: +m[2] * 10 };       // 12045DH = 1200 h x 450 w
  if ((m = U.match(/^(\d{2})(\d{2})[A-Z]/))) return { kind, text: c, h: +m[1] * 100, w: +m[2] * 100 };      // 0624OXXOSW = 600 h x 2400 w
  return null;
}
const SCALE_RE = /\b1\s*:\s*(\d{2,4})\b/;
const toMm = s => { const v = parseFloat(String(s).replace(',', '.')); return v < 100 ? Math.round(v * 1000) : Math.round(v); };
const norm = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
const normTag = t => String(t || '').trim().toUpperCase().replace(/^([DW])\s*-?\s*0*(\d+)/, (m, a, b) => a + b.padStart(2, '0'));

/* text items on a sheet, merged into lines, in base coordinates */
async function pageLines(pn) {
  if (V.text[pn]) return V.text[pn];
  if (!V.pdf) return [];
  const page = (pn === V.pageNum && V.page) ? V.page : await V.pdf.getPage(pn);
  const vp = page.getViewport({ scale: 1 });
  let tc; try { tc = await page.getTextContent(); } catch (e) { return (V.text[pn] = []); }
  const items = [];
  for (const it of tc.items) {
    if (!it.str || !it.str.trim()) continue;
    const m = pdfjsLib.Util.transform(vp.transform, it.transform);
    const fs = Math.hypot(m[0], m[1]) || Math.hypot(m[2], m[3]) || 8;
    const ux = m[0] / fs, uy = m[1] / fs;
    const ul = Math.hypot(m[2], m[3]) || fs, px = m[2] / ul, py = m[3] / ul;
    const len = it.width || 0;
    const x0 = m[4], y0 = m[5], x1 = x0 + ux * len, y1 = y0 + uy * len;
    items.push({ str: it.str.replace(/\s+/g, ' ').trim(), x0: Math.min(x0, x1), x1: Math.max(x0, x1), fs, horiz: Math.abs(ux) > 0.95, cx: (x0 + x1) / 2 + px * fs * 0.35, cy: (y0 + y1) / 2 + py * fs * 0.35 });
  }
  items.sort((a, b) => (Math.round(a.cy / 2) - Math.round(b.cy / 2)) || (a.x0 - b.x0));
  const lines = [];
  for (const it of items) {
    let L = null;
    if (it.horiz) for (let i = lines.length - 1; i >= 0; i--) {
      const c = lines[i]; if (c.cy < it.cy - it.fs * 2) break;
      if (!c.horiz) continue;
      const tol = Math.max(c.fs, it.fs);
      if (Math.abs(c.cy - it.cy) <= tol * 0.5 && Math.abs(c.fs - it.fs) <= tol * 0.6 && it.x0 - c.x1 <= tol * 1.6 && it.x0 - c.x1 >= -tol * 0.6) { L = c; break; }
    }
    if (L) { L.str += ((it.x0 - L.x1 > it.fs * 0.22 && !L.str.endsWith(' ')) ? ' ' : '') + it.str; L.x1 = Math.max(L.x1, it.x1); L.cx = (L.x0 + L.x1) / 2; }
    else lines.push({ str: it.str, x0: it.x0, x1: it.x1, cx: it.cx, cy: it.cy, fs: it.fs, horiz: it.horiz });
  }
  for (const L of lines) L.str = L.str.replace(/\s+/g, ' ').trim();
  V.text[pn] = lines; return lines;
}
async function guessRoomName(pn, pts) {
  const lines = await pageLines(pn);
  const inside = lines.filter(l => pointInPoly({ x: l.cx, y: l.cy }, pts));
  const lab = inside.find(l => ROOM_RE.test(l.str))
    || inside.find(l => { const m = l.str.match(LABEL_DIM_RE); return m && ROOM_RE.test(m[1]); })
    || inside.find(l => /^[A-Z][A-Z0-9 '/.-]{1,18}$/.test(l.str) && !DIM_RE.test(l.str) && !TAG_RE.test(l.str));
  if (!lab) return '';
  const m = lab.str.match(LABEL_DIM_RE); return (m ? m[1] : lab.str).toUpperCase();
}
async function findScaleText(pn) { const lines = await pageLines(pn); for (const l of lines) { const m = l.str.match(SCALE_RE); if (m && /SCALE|@|A[0-4]\b/i.test(l.str)) return +m[1]; } for (const l of lines) { const m = l.str.match(SCALE_RE); if (m) return +m[1]; } return 0; }

/* rooms from labels like "BED 1" with "3.6 x 3.3" printed near them */
async function findRoomsFromText(pn) {
  const lines = await pageLines(pn);
  if (!lines.length) return { added: 0, noText: true };
  const labels = [], dims = [];
  for (const l of lines) {
    const s = l.str;
    if (ROOM_RE.test(s)) labels.push({ l, name: s.toUpperCase(), dim: null });
    else { const m = s.match(LABEL_DIM_RE); if (m && ROOM_RE.test(m[1])) labels.push({ l, name: m[1].toUpperCase(), dim: m[2] }); else if (DIM_RE.test(s)) dims.push(l); }
  }
  const used = new Set(); let added = 0;
  for (const { l, name, dim } of labels) {
    const p = { x: l.cx, y: l.cy };
    if (S.rooms.some(r => r.page === pn && norm(r.name) === norm(name) && ((r.pt && dist(r.pt, p) < l.fs * 8) || (r.pts && r.pts.length >= 3 && pointInPoly(p, r.pts))))) continue;
    let dimStr = dim, best = null, bd = Infinity;
    if (!dimStr) for (const D of dims) {
      if (used.has(D)) continue;
      const dx = Math.abs(D.cx - l.cx), dy = D.cy - l.cy;
      if (dx < Math.max(l.fs * 8, 40) && dy > -l.fs * 2.5 && dy < l.fs * 4.5) { const d = dx + Math.abs(dy); if (d < bd) { bd = d; best = D; } }
    }
    if (best) { used.add(best); dimStr = best.str; }
    const r = { id: uid(), name, page: pn, pt: p, pts: null, method: 'dims', length: 0, width: 0, perimeter: 0, skirting: defaultSkirting(name), deductions: [], notes: '', src: 'text' };
    if (dimStr) { const m = dimStr.match(DIM_RE); r.length = toMm(m[1]); r.width = toMm(m[2]); }
    else r.notes = 'No size printed by the label — type the size or trace the room';
    S.rooms.push(r); added++;
  }
  return { added, noText: false };
}

/* door and window tags (D01, W3…) on the plan, plus schedule tables */
function inferDoorType(s) {
  s = String(s || '').toUpperCase();
  if (/CAVITY/.test(s)) return 'cavity';
  if (/ROLLER|PANELIFT|SECTIONAL/.test(s)) return 'extother';
  if (/BI-?FOLD/.test(s)) return 'bifold';
  if (/ROBE/.test(s) && /SLID/.test(s)) return 'robe';
  if (/STACK|ALUM|SLIDING DOOR|EXT.*SLID|GLASS SLID|PATIO/.test(s)) return 'extslide';
  if (/GARAGE/.test(s)) return 'garage';
  if (/ENTRY|ENTRANCE|FRONT/.test(s)) return 'entry';
  if (/EXT/.test(s)) return 'external';
  if (/BARN/.test(s)) return 'barn';
  if (/OPENING|CASED|ARCHWAY|NO DOOR/.test(s)) return 'cased';
  if (/ROBE/.test(s)) return 'robe';
  return 'hinged';
}
function applySched(o, info) {
  if (!info) return false;
  if (info.kind === 'D') {
    if (!o.schedText) applyDoorType(o, inferDoorType(info.text));
    if (info.h > 0 && info.w > 0) { if (info.h >= 1900) { o.height = info.h; o.width = info.w; } else if (info.w >= 1900) { o.height = info.w; o.width = info.h; } else { o.height = info.h; o.width = info.w; } }
    if (/DOUBLE|PAIR|2 LEAF|TWIN/i.test(info.text) && o.leaves < 2) o.leaves = 2;
    if (/SOLID CORE|FIRE|SELF.?CLOS/i.test(info.text)) o.fire = true;
  } else if (info.h > 0 && info.w > 0) { o.height = info.h; o.width = info.w; }
  if (!o.notes) o.notes = info.text.slice(0, 90);
  o.schedText = info.text; return true;
}
async function findTagsFromText(pn) {
  const lines = await pageLines(pn);
  if (!lines.length) return { doors: 0, windows: 0, sched: 0, noText: true };
  const sched = {}, marks = [];
  for (const T of lines) {
    const pm = T.str.match(PLAN_TAG_RE);
    if (pm) { const info = parseCode(pm[1].toUpperCase(), pm[3]); if (info) { const tag = normTag(pm[1] + pm[2]); sched[tag] = info; marks.push({ tag, kind: info.kind, x: T.cx, y: T.cy }); continue; } }
    const m = T.str.match(TAG_RE); if (!m) continue;
    const tag = normTag(m[1] + m[2] + m[3]), kind = m[1].toUpperCase();
    const mates = lines.filter(l => l !== T && !TAG_RE.test(l.str) && Math.abs(l.cy - T.cy) < T.fs * 0.7 && l.x0 > T.x1 - T.fs && l.x0 - T.x1 < T.fs * 45).sort((a, b) => a.x0 - b.x0);
    if (mates.length && mates[0].x0 - T.x1 > T.fs * 8) mates.length = 0;   // nearest cell too far away: not a table row
    const rowText = mates.map(l => l.str).join(' ');
    const isRow = mates.length > 0 && (/\d{3,4}\s*[xX×]\s*\d{3,4}/.test(rowText) || (mates.length >= 2 && /HINGED|CAVITY|SLID|BI-?FOLD|ENTRY|EXTERNAL|AWNING|FIXED|CASEMENT|DOUBLE HUNG|STACKER|LOUVRE|OPENING|BARN|PIVOT|GLAZED|FLUSH|PANEL/i.test(rowText)));
    if (isRow) { const sz = rowText.match(/(\d{3,4})\s*[xX×]\s*(\d{3,4})/); sched[tag] = { kind, text: rowText, h: sz ? +sz[1] : 0, w: sz ? +sz[2] : 0 }; }
    else marks.push({ tag, kind, x: T.cx, y: T.cy });
  }
  let doors = 0, windows = 0;
  const byTag = (arr, tag) => arr.find(o => normTag(o.tag) === tag);
  for (const mk of marks) {
    const arr = mk.kind === 'D' ? S.doors : S.windows; const ex = byTag(arr, mk.tag);
    if (ex) { if (ex.x == null) { ex.page = pn; ex.x = mk.x; ex.y = mk.y; if (mk.kind === 'D' && !ex.fromRoom) { const n = roomsNear(pn, mk); ex.fromRoom = n[0] ? n[0].id : ''; ex.toRoom = n[1] ? n[1].id : ''; } } continue; }
    if (mk.kind === 'D') { const d = newDoor(pn, mk); d.tag = mk.tag; d.src = 'text'; applySched(d, sched[mk.tag]); S.doors.push(d); doors++; }
    else { const w = newWindow(pn, mk); w.tag = mk.tag; w.src = 'text'; applySched(w, sched[mk.tag]); S.windows.push(w); windows++; }
  }
  for (const [tag, info] of Object.entries(sched)) {
    const arr = info.kind === 'D' ? S.doors : S.windows; const ex = byTag(arr, tag);
    if (ex) { if (!ex.schedText) applySched(ex, info); continue; }
    if (info.kind === 'D') { const d = newDoor(pn, null); d.tag = tag; d.src = 'schedule'; applySched(d, info); S.doors.push(d); doors++; }
    else { const w = newWindow(pn, null); w.tag = tag; w.src = 'schedule'; applySched(w, info); S.windows.push(w); windows++; }
  }
  return { doors, windows, sched: Object.keys(sched).length, noText: false };
}

/* ---------- Claude reads an area of the plan (published artifact only) ---------- */
let aiCtl = null;
function aiProgress(msg) { $('#aiMsg').textContent = msg; $('#aiProg').hidden = false; }
function aiDone() { $('#aiProg').hidden = true; }
$('#aiStop').addEventListener('click', () => { if (aiCtl) aiCtl.abort(); });
async function renderRegionBlob(page, rx, ry, rw, rh, mp) {
  const s = clamp(Math.sqrt(mp / (rw * rh)), 0.2, 8);
  const vp = page.getViewport({ scale: s, offsetX: -rx * s, offsetY: -ry * s });
  const c = document.createElement('canvas'); c.width = Math.ceil(rw * s); c.height = Math.ceil(rh * s);
  const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  return await new Promise(res => c.toBlob(res, 'image/png'));
}
function buildAiPrompt(nImages, txt) {
  return `You are helping a builder's estimator take off skirting, architrave and doors from an Australian residential floor plan.
${nImages ? `Image 1 shows the selected area of the plan.${nImages > 1 ? ' Images 2 to 5 are the top-left, top-right, bottom-left and bottom-right quarters of the same area, zoomed in so small text is legible.' : ''}` : 'No image is available: work from the extracted text only.'}
Text extracted from the PDF inside this area, one item per line as "text" @ x,y where x and y are percentages of the area's width and height measured from its top-left corner:
${txt || '(no text layer — read the image)'}

List every room, door and window in the area. Rules:
- Dimensions in millimetres. Room sizes are usually printed under the room name as "3.6 x 3.3" (metres) or "3600 x 3300" (mm): give length_mm and width_mm from that. If no size is printed, estimate it from the drawing and the dimension strings and set "estimated": true.
- Include wet areas (bath, ensuite, WC, powder, laundry), robes/WIR, garage, alfresco and porch as rooms too. Set "wet_area": true for bathrooms, ensuites, WCs, powder rooms and laundries.
- Doors: use the tags on the plan (D1, D01, D12…) when present, else leave tag empty. type must be one of: hinged, cavity, robe (sliding robe doors), bifold, cased (an opening with no door), entry (the front door), external (other external hinged doors), garage (door between garage and house), extslide (aluminium sliding or stacker door), barn. Sizes: use the door schedule if one is shown; otherwise 2040 x 820 for internal hinged doors, 2040 x 720 for WC and robe doors, 2040 x 920 for entry doors. leaves = number of door leaves (2 for double doors; 2 to 4 for robe and bifold doors). For extslide and other doors supplied by others, width_mm is the whole opening width (2400 for a 2400 wide slider) and leaves is just the number of panels. from_room and to_room are the room names on each side; use "OUTSIDE" for outside.
- Windows: tag if shown (W1, W01…); width_mm and height_mm from the window schedule or window tags if shown, else null; room = the room the window is in.
- x and y = the position of each item as percentages of the area, top-left origin, like the extracted text.
Reply with only JSON in exactly this shape:
{"scale":"1:100 or null","rooms":[{"name":"BED 1","length_mm":3600,"width_mm":3300,"x":12.5,"y":40.2,"wet_area":false,"estimated":false}],"doors":[{"tag":"D01","type":"hinged","height_mm":2040,"width_mm":820,"leaves":1,"from_room":"HALL","to_room":"BED 1","x":10.1,"y":45.0}],"windows":[{"tag":"W01","width_mm":1800,"height_mm":1200,"room":"BED 1","x":5.0,"y":40.0}],"notes":"anything the estimator should check"}`;
}
async function aiRead(rect) {
  if (!CAP.sample) { toast('Reading with Claude only works in the published app'); return; }
  if (!V.page) return;
  const pn = V.pageNum, page = V.page;
  aiCtl = new AbortController(); const signal = aiCtl.signal;
  aiProgress('Preparing the plan image…');
  try {
    const images = [];
    if (CAP.images) {
      images.push(await renderRegionBlob(page, rect.x, rect.y, rect.w, rect.h, 1.2e6));
      if (CAP.maxImages >= 5 && rect.w * rect.h > 300 * 300) {
        const hw = rect.w / 2, hh = rect.h / 2;
        for (const [qx, qy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) images.push(await renderRegionBlob(page, rect.x + qx * hw, rect.y + qy * hh, hw, hh, 1.2e6));
      }
    }
    if (signal.aborted) return;
    const lines = await pageLines(pn);
    const inR = lines.filter(l => l.cx >= rect.x && l.cx <= rect.x + rect.w && l.cy >= rect.y && l.cy <= rect.y + rect.h);
    let txt = inR.map(l => `${JSON.stringify(l.str)} @ ${((l.cx - rect.x) / rect.w * 100).toFixed(1)},${((l.cy - rect.y) / rect.h * 100).toFixed(1)}`).join('\n');
    if (txt.length > 24000) txt = txt.slice(0, 24000) + '\n…(more text truncated)';
    const prompt = buildAiPrompt(images.length, txt);
    aiProgress('Claude is reading the plan — this can take a minute or two');
    const opts = { modelTier: S.project.aiTier || 'complex', signal, onText: ({ text }) => aiProgress(`Claude is writing up what it found… ${text.length} characters`) };
    if (images.length) opts.images = images;
    const data = await CAP.sample.json(prompt, opts);
    const res = applyAi(data, rect, pn);
    toast(`Claude found ${res.rooms} rooms, ${res.doors} doors and ${res.windows} windows — check them in the Rooms and Doors tabs`, 7000);
    if (data && data.notes) modal.open({ title: 'Notes from Claude', body: `<p class="small">${esc(data.notes)}</p>`, ok: 'OK', cancel: null });
  } catch (e) {
    console.warn(e);
    const code = e && e.code;
    if (code !== 'cancelled') toast(aiErrorCopy(code, e), 6000);
  } finally { aiDone(); aiCtl = null; }
}
function aiErrorCopy(code, e) {
  switch (code) {
    case 'not_granted': case 'sampling_disabled': case 'not_declared': case 'capability_disabled': return 'Claude is not available for this page.';
    case 'rate_limited': return 'Claude is busy or your usage limit was reached — try again in a little while.';
    case 'invalid_json': case 'empty_completion': return 'Claude did not return a usable list — try a smaller area.';
    case 'image_rejected': case 'images_unavailable': return 'The plan image could not be sent — try a smaller area.';
    case 'prompt_too_large': return 'Too much text in that area — select a smaller part of the plan.';
    case 'refused': return 'Claude declined to read that area.';
    default: return 'Reading failed' + (e && e.message ? ': ' + e.message : '') + ' — try again.';
  }
}
function applyAi(data, rect, pn) {
  const out = { rooms: 0, doors: 0, windows: 0 };
  if (!data || typeof data !== 'object') return out;
  undo.push();
  const pos = o => (o && Number.isFinite(+o.x) && Number.isFinite(+o.y)) ? { x: rect.x + clamp(+o.x, 0, 100) / 100 * rect.w, y: rect.y + clamp(+o.y, 0, 100) / 100 * rect.h } : null;
  const roomByName = {}; for (const r of S.rooms) if (r.page === pn) roomByName[norm(r.name)] = r;
  for (const ro of (Array.isArray(data.rooms) ? data.rooms : [])) {
    const name = String(ro && ro.name || '').trim().toUpperCase(); if (!name) continue;
    const L = Math.round(num(ro.length_mm)), W = Math.round(num(ro.width_mm)), p = pos(ro);
    let r = roomByName[norm(name)];
    if (!r) { r = { id: uid(), name, page: pn, pt: p, pts: null, method: 'dims', length: 0, width: 0, perimeter: 0, skirting: defaultSkirting(name), deductions: [], notes: '', src: 'ai' }; S.rooms.push(r); roomByName[norm(name)] = r; out.rooms++; }
    if (r.method === 'dims' && !(r.length > 0 && r.width > 0) && L > 0 && W > 0) { r.length = L; r.width = W; }
    if (ro.estimated && L > 0) r.notes = (r.notes ? r.notes + ' · ' : '') + 'size estimated by Claude — check it';
    if (ro.wet_area && !WET_RE.test(name)) r.skirting = !!S.spec.skirtWet;
    if (!r.pt && !r.pts && p) r.pt = p;
  }
  const findRoom = n => { const k = norm(n); if (!k || /^(OUTSIDE|EXTERNAL|EXT|OUT|NONE|NULL)$/.test(k)) return ''; const r = roomByName[k] || S.rooms.find(x => norm(x.name) === k); return r ? r.id : ''; };
  for (const d0 of (Array.isArray(data.doors) ? data.doors : [])) {
    if (!d0) continue;
    const p = pos(d0), tag = d0.tag ? normTag(d0.tag) : '';
    const ex = tag ? S.doors.find(d => normTag(d.tag) === tag) : null;
    if (ex) { if (ex.x == null && p) { ex.page = pn; ex.x = p.x; ex.y = p.y; } if (!ex.fromRoom) ex.fromRoom = findRoom(d0.from_room); if (!ex.toRoom) ex.toRoom = findRoom(d0.to_room); continue; }
    const d = newDoor(pn, p); if (tag) d.tag = tag; d.src = 'ai';
    const t = String(d0.type || '').toLowerCase();
    applyDoorType(d, DOOR_TYPES[t] ? t : inferDoorType(t));
    if (num(d0.height_mm) > 0) d.height = Math.round(num(d0.height_mm));
    if (num(d0.width_mm) > 0) d.width = Math.round(num(d0.width_mm));
    if (num(d0.leaves) > 0) d.leaves = Math.round(num(d0.leaves));
    const fr = findRoom(d0.from_room), to = findRoom(d0.to_room);
    if (fr || to) { d.fromRoom = fr || to; d.toRoom = fr && to && fr !== to ? to : ''; }
    S.doors.push(d); out.doors++;
  }
  for (const w0 of (Array.isArray(data.windows) ? data.windows : [])) {
    if (!w0) continue;
    const p = pos(w0), tag = w0.tag ? normTag(w0.tag) : '';
    const ex = tag ? S.windows.find(w => normTag(w.tag) === tag) : null;
    if (ex) { if (ex.x == null && p) { ex.page = pn; ex.x = p.x; ex.y = p.y; } if (!(ex.width > 0) && num(w0.width_mm) > 0) ex.width = Math.round(num(w0.width_mm)); if (!(ex.height > 0) && num(w0.height_mm) > 0) ex.height = Math.round(num(w0.height_mm)); if (!ex.room) ex.room = findRoom(w0.room); continue; }
    const w = newWindow(pn, p); if (tag) w.tag = tag; w.src = 'ai';
    if (num(w0.width_mm) > 0) w.width = Math.round(num(w0.width_mm));
    if (num(w0.height_mm) > 0) w.height = Math.round(num(w0.height_mm));
    w.room = findRoom(w0.room) || w.room;
    S.windows.push(w); out.windows++;
  }
  if (data.scale && !mmPerPt(pn)) { const m = String(data.scale).match(/1\s*:\s*(\d{2,4})/); if (m) setPageScale(pn, +m[1] * PT_MM, { method: 'preset', calib: null, calibMm: null }); }
  renderAll(); updateScaleStatus(); updatePageUI();
  return out;
}
