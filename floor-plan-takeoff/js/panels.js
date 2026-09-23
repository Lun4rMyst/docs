/* =========================== calculations =========================== */
function roomName(id) { const r = S.rooms.find(x => x.id === id); return r ? r.name : ''; }
function roomPerimeterMm(r) {
  if (r.method === 'trace') { if (!r.pts || r.pts.length < 3) return null; const k = mmPerPt(r.page); return k ? polyPerimeterPt(r.pts) * k : null; }
  if (r.method === 'dims') return (r.length > 0 && r.width > 0) ? 2 * (num(r.length) + num(r.width)) : null;
  if (r.method === 'perimeter') return r.perimeter > 0 ? num(r.perimeter) : null;
  return null;
}
function roomAreaM2(r) {
  if (r.method === 'trace' && r.pts && r.pts.length >= 3) { const k = mmPerPt(r.page); return k ? polyAreaPt(r.pts) * k * k / 1e6 : null; }
  if (r.method === 'dims' && r.length > 0 && r.width > 0) return num(r.length) * num(r.width) / 1e6;
  return null;
}
const qtyOf = o => Math.max(1, Math.round(num(o.qty, 1)) || 1);
const leavesOf = o => Math.max(1, Math.round(num(o.leaves, 1)) || 1);
function doorSpanMm(d) { return (DOOR_TYPES[d.type] || {}).noLeaf ? num(d.width) : num(d.width) * leavesOf(d); }   // by-others sliders etc: width is the whole opening, leaves are panels
function doorOpeningMm(d) { return (doorSpanMm(d) + num(S.spec.openingAllowance)) * qtyOf(d); }
function roomSkirting(r) {
  const per = roomPerimeterMm(r);
  const doors = S.doors.filter(d => d.skirtDeduct && (d.fromRoom === r.id || d.toRoom === r.id));
  const doorDed = doors.reduce((a, d) => a + doorOpeningMm(d), 0);
  const other = (r.deductions || []).reduce((a, x) => a + num(x.mm), 0);
  const net = (r.skirting && per != null) ? Math.max(0, per - doorDed - other) : 0;
  return { per, doorDed, other, net, doors };
}
function archForDoor(d) {
  const sides = num(d.archSides); if (!sides) return 0;
  const H = num(d.height), W = doorSpanMm(d);
  if (!(H > 0 && W > 0)) return 0;
  return sides * (2 * (H + num(S.spec.archLegAllow)) + (W + num(S.spec.archHeadAllow))) * qtyOf(d);
}
function archForWindow(w) {
  if (!w.arch) return 0;
  const a = num(S.spec.archWinAllow), W = num(w.width), H = num(w.height);
  if (!(W > 0 && H > 0)) return 0;
  return (2 * (W + a) + 2 * (H + a)) * qtyOf(w);
}
function autoLever(d) {
  const t = DOOR_TYPES[d.type] || {};
  if (t.lever && t.lever !== 'auto') return t.lever === 'none' ? '' : t.lever;
  const names = roomName(d.fromRoom) + ' ' + roomName(d.toRoom);
  return /\b(BATH|BATHROOM|ENS|ENSUITE|WC|W\.C|PDR|POWDER|TOILET|BED|BEDROOM|MASTER|LAUNDRY|LDRY)\b/i.test(names) ? 'privacy' : 'passage';
}
function leverFor(d) { return d.lever === 'auto' ? autoLever(d) : (d.lever === 'none' ? '' : d.lever); }
function sizeStr(d) { const H = num(d.height), W = num(d.width), T = num(d.thick); return `${H}×${W}${T ? '×' + T : ''}${leavesOf(d) > 1 ? ` (${leavesOf(d)} leaves)` : ''}`; }
function doorLabel(d) { return (DOOR_TYPES[d.type] || {}).label || d.type; }
function cmpTag(a, b) { const pa = String(a || '').match(/^([A-Za-z]*)\s*-?\s*(\d*)(.*)$/), pb = String(b || '').match(/^([A-Za-z]*)\s*-?\s*(\d*)(.*)$/); return pa[1].localeCompare(pb[1]) || (num(pa[2]) - num(pb[2])) || pa[3].localeCompare(pb[3]); }
function skirtDesc() { const s = S.spec; return [s.skirtSize, s.skirtMaterial, s.skirtProfile].filter(Boolean).join(' '); }
function archDesc() { const s = S.spec; return [s.archSize, s.archMaterial, s.archProfile].filter(Boolean).join(' '); }
function whereStr(d) { const t = DOOR_TYPES[d.type] || {}; return [roomName(d.fromRoom), roomName(d.toRoom) || (t.ext ? 'Outside' : '')].filter(Boolean).join(' → '); }

function calcTakeoff() {
  const sp = S.spec;
  const rooms = S.rooms.map(r => ({ r, ...roomSkirting(r), area: roomAreaM2(r) }));
  const skirtNet = rooms.reduce((a, x) => a + x.net, 0);
  const skirtWaste = skirtNet * (1 + num(sp.skirtWaste) / 100);
  const skirtLengths = num(sp.skirtStock) > 0 ? Math.ceil(skirtWaste / num(sp.skirtStock) - 1e-9) : 0;
  const arch = [];
  for (const d of S.doors) { const lm = archForDoor(d); if (lm > 0) arch.push({ kind: 'door', tag: d.tag, desc: `${doorLabel(d)} ${sizeStr(d)}`, where: whereStr(d), sides: num(d.archSides), qty: qtyOf(d), lm }); }
  for (const w of S.windows) { const lm = archForWindow(w); if (lm > 0) arch.push({ kind: 'window', tag: w.tag, desc: `Window ${w.height} h × ${w.width} w`, where: roomName(w.room), sides: 4, qty: qtyOf(w), lm }); }
  const archNet = arch.reduce((a, x) => a + x.lm, 0);
  const archWaste = archNet * (1 + num(sp.archWaste) / 100);
  const archLengths = num(sp.archStock) > 0 ? Math.ceil(archWaste / num(sp.archStock) - 1e-9) : 0;
  const groups = {}; let doorCount = 0, leafCount = 0, openings = 0;
  for (const d of S.doors) {
    const t = DOOR_TYPES[d.type] || {}, q = qtyOf(d); openings += q;
    if (t.noLeaf) continue;
    doorCount += q; leafCount += q * leavesOf(d);
    const key = [d.type, num(d.height), num(d.width), num(d.thick), leavesOf(d), d.leaf || '', d.colour || '', d.fire ? 'FR' : ''].join('|');
    if (!groups[key]) groups[key] = { type: d.type, label: doorLabel(d), height: num(d.height), width: num(d.width), thick: num(d.thick), leaves: leavesOf(d), leaf: d.leaf || '', colour: d.colour || '', fire: !!d.fire, qty: 0, tags: [] };
    groups[key].qty += q; groups[key].tags.push(d.tag);
  }
  const doorGroups = Object.values(groups).sort((a, b) => a.label.localeCompare(b.label) || b.height - a.height || b.width - a.width);
  const hw = {}; const add = (k, n) => { if (n > 0) hw[k] = (hw[k] || 0) + n; };
  for (const d of S.doors) {
    const t = DOOR_TYPES[d.type] || {}, q = qtyOf(d), lv = leverFor(d), perLeaf = num(d.height) > 2100 ? 4 : 3;
    if (t.hinges) add(`Hinges (${perLeaf} per leaf)`, q * leavesOf(d) * perLeaf);
    if (lv) add(LEVER_LABEL[lv] || lv, q);
    if (t.stop) add('Door stop', q);
    if (t.closer) add('Door closer', q);
    if (t.cavity) add('Cavity slider unit', q);
    if (t.track) add(t.track, q);
  }
  const hardware = Object.entries(hw).map(([item, qty]) => ({ item, qty }));
  const warnings = [];
  const noScale = [...new Set(S.rooms.filter(r => r.method === 'trace' && r.pts && !mmPerPt(r.page)).map(r => r.page))];
  if (noScale.length) warnings.push(`Scale not set on ${noScale.map(pageTag).join(', ')} — traced rooms there have no perimeter yet.`);
  const noSize = rooms.filter(x => x.per == null && !(x.r.method === 'trace' && x.r.pts && !mmPerPt(x.r.page))).map(x => x.r.name);
  if (noSize.length) warnings.push(`Rooms without a size: ${noSize.join(', ')}.`);
  const winNoSize = S.windows.filter(w => w.arch && !(w.width > 0 && w.height > 0)).map(w => w.tag);
  if (winNoSize.length) warnings.push(`Windows without a size, so no architrave counted yet: ${winNoSize.join(', ')}.`);
  const noRoom = S.doors.filter(d => d.skirtDeduct && !d.fromRoom && !d.toRoom).map(d => d.tag);
  if (noRoom.length) warnings.push(`Doors not assigned to a room, so no skirting deduction: ${noRoom.join(', ')}.`);
  const unplaced = [...S.doors.filter(d => d.x == null).map(d => d.tag), ...S.windows.filter(w => w.x == null).map(w => w.tag)];
  if (unplaced.length) warnings.push(`Not located on the plan (from a schedule or added by hand): ${unplaced.join(', ')}.`);
  const byOthers = S.doors.filter(d => (DOOR_TYPES[d.type] || {}).byOthers).map(d => d.tag);
  if (byOthers.length) warnings.push(`Supplied by others and not counted as door leaves: ${byOthers.join(', ')}.`);
  return { rooms, skirtNet, skirtWaste, skirtLengths, arch, archNet, archWaste, archLengths, doorGroups, doorCount, leafCount, openings, hardware, warnings, winCount: S.windows.reduce((a, w) => a + qtyOf(w), 0), winArchCount: S.windows.filter(w => w.arch).reduce((a, w) => a + qtyOf(w), 0) };
}

/* =========================== side panels =========================== */
function showTab(t) {
  UI.tab = t;
  $$('.tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
  $$('.tabpane').forEach(p => p.classList.toggle('on', p.id === 'tab-' + t));
  try { localStorage.setItem('tdt.tab', t); } catch (e) { }
}
$$('.tabs button').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
function updateCounts() { $('#cntRooms').textContent = S.rooms.length; $('#cntDoors').textContent = S.doors.length + S.windows.length; }
function renderAll() { renderRooms(); renderDoors(); renderTakeoff(); updateCounts(); drawOverlay(); saveSoon(); }
const tierLabel = t => ({ complex: 'Complex', default: 'Default', quick: 'Quick' })[t] || t;
function bindEditor(root, obj, onChange) {
  $$('[data-k]', root).forEach(inp => {
    const k = inp.dataset.k;
    if (inp.type === 'checkbox') inp.checked = !!obj[k]; else inp.value = obj[k] ?? '';
    inp.addEventListener('change', () => {
      let v;
      if (inp.type === 'checkbox') v = inp.checked;
      else if (inp.type === 'number' || inp.dataset.num != null) v = inp.value === '' ? 0 : num(inp.value);
      else v = inp.value;
      if (obj[k] === v) return;
      undo.push(); obj[k] = v; if (onChange) onChange(k, v, inp);
    });
  });
}
function rerenderKeepFocus() {
  const a = document.activeElement, card = a && a.closest ? a.closest('.card') : null;
  const k = a && a.dataset ? a.dataset.k : null, id = card ? card.dataset.id : null;
  renderAll();
  if (id && k) { const inp = $(`.card[data-id="${id}"] [data-k="${k}"]`); if (inp) inp.focus({ preventScroll: true }); }
}
function findObj(id) { return S.rooms.find(r => r.id === id) || S.doors.find(d => d.id === id) || S.windows.find(w => w.id === id); }
function shortPage(pn) {
  const p = S.pages[pn];
  if (p && p.label) { const w = p.label.trim().split(/\s+/); return (w.length > 1 ? w.map(x => x[0]).join('') : p.label.slice(0, 3)).toUpperCase(); }
  return 'S' + pn;
}
function roomOptions() { return S.rooms.map(r => `<option value="${r.id}">${esc(r.name)} (${esc(shortPage(r.page))})</option>`).join(''); }

/* ---- spec ---- */
function renderSpec() {
  const s = S.spec;
  $('#tab-spec').innerHTML = `
  <div class="panelhead"><h2>Specification</h2><span class="sp"></span><button class="btn ghost small" id="specSaveDef" title="New projects will start with these settings">Save as my defaults</button><button class="btn ghost small" id="specReset">Reset</button></div>
  <div class="hintbox">Fill this in from the job's finishes schedule. Every figure in the takeoff is worked out from these settings and the rooms, doors and windows you mark up.</div>
  <h3>Skirting</h3>
  <div class="row3"><label>Size (mm)<input data-k="skirtSize" list="dl-skirtsizes"></label><label>Profile<input data-k="skirtProfile" list="dl-profiles"></label><label>Material<input data-k="skirtMaterial" list="dl-materials"></label></div>
  <div class="row3"><label>Stock length (mm)<input data-k="skirtStock" type="number" step="100"></label><label>Waste %<input data-k="skirtWaste" type="number" step="1"></label><label>Colour / finish<input data-k="skirtColour" placeholder="e.g. Dulux Natural White, gloss"></label></div>
  <h3>Architrave</h3>
  <div class="row3"><label>Size (mm)<input data-k="archSize" list="dl-archsizes"></label><label>Profile<input data-k="archProfile" list="dl-profiles"></label><label>Material<input data-k="archMaterial" list="dl-materials"></label></div>
  <div class="row3"><label>Stock length (mm)<input data-k="archStock" type="number" step="100"></label><label>Waste %<input data-k="archWaste" type="number" step="1"></label><label>Colour / finish<input data-k="archColour" placeholder="Same as skirting"></label></div>
  <label class="chk flat"><input data-k="windowsArch" type="checkbox"> Windows get architrave on all four sides (new windows)</label>
  <h3>Measuring rules</h3>
  <div class="row2"><label>Skirting lost per opening: door width + (mm)<input data-k="openingAllowance" type="number" step="10" title="Covers the jamb and architrave each side of the opening"></label><label>Architrave leg: door height + (mm)<input data-k="archLegAllow" type="number" step="10"></label></div>
  <div class="row2"><label>Architrave head: door width + (mm)<input data-k="archHeadAllow" type="number" step="10"></label><label>Window architrave: each piece + (mm)<input data-k="archWinAllow" type="number" step="10"></label></div>
  <div class="row3"><label class="chk flat"><input data-k="skirtWet" type="checkbox"> Timber skirting in wet areas</label><label class="chk flat"><input data-k="skirtRobes" type="checkbox"> Skirting inside robes</label><label class="chk flat"><input data-k="skirtExternal" type="checkbox"> Skirting to outdoor rooms (alfresco, porch, balcony)</label></div>
  <p class="small muted">These set the default for new rooms. You can still switch skirting on or off on each room.</p>
  <h3>Doors</h3>
  <div class="row3"><label>Default height (mm)<input data-k="doorHeight" type="number" step="10"></label><label>Default width (mm)<input data-k="doorWidth" type="number" step="10"></label><label>Thickness (mm)<input data-k="doorThick" type="number"></label></div>
  <div class="row2"><label>Internal leaf<input data-k="doorLeaf" list="dl-leaves"></label><label>External leaf<input data-k="extLeaf" list="dl-leaves"></label></div>
  <div class="row2"><label>Jamb / frame<input data-k="jamb"></label><label>Hardware range<input data-k="hardware" placeholder="e.g. Gainsborough Trilock, matt black"></label></div>
  <div class="row2"><label>Door colour<input data-k="doorColour" placeholder="e.g. Dulux Lexicon Quarter"></label><label>Frame colour<input data-k="frameColour" placeholder="Same as doors"></label></div>
  <h3>Rates for the Databuild export (optional)</h3>
  <div class="row4"><label>Skirting $<input data-k="skirtRate" type="number" step="0.01"></label><label>priced per<select data-k="skirtUnit"><option value="length">stock length</option><option value="lm">lineal metre</option></select></label><label>Architrave $<input data-k="archRate" type="number" step="0.01"></label><label>priced per<select data-k="archUnit"><option value="length">stock length</option><option value="lm">lineal metre</option></select></label></div>
  <div class="row2"><label>Door leaf $ each<input data-k="doorRate" type="number" step="0.01"></label></div>
  <h3>Notes</h3>
  <label>Project notes (printed with the takeoff)<textarea data-k="notes" rows="3"></textarea></label>
  <h3>Reading with Claude</h3>
  <div class="row2"><label>Model tier for reads<select id="aiTier"><option value="complex">Complex: most capable, thinks longest</option><option value="default">Default: balanced everyday model</option><option value="quick">Quick: fastest, no thinking</option></select></label><label>Last read answered by<input id="aiTierApplied" readonly></label></div>
  <p class="small muted">The published app can ask for a tier, not a named model or a thinking budget. If the viewer's plan does not include the tier asked for, the platform answers with a cheaper one and the box on the right shows which.</p>
  <h3>Keyboard</h3>
  <div class="keys"><kbd>V</kbd> select · <kbd>C</kbd> calibrate · <kbd>R</kbd> trace room · <kbd>X</kbd> rect room · <kbd>D</kbd> door · <kbd>W</kbd> window · <kbd>Enter</kbd> close room · <kbd>Esc</kbd> cancel · <kbd>Del</kbd> delete · <kbd>Ctrl</kbd>+<kbd>Z</kbd> undo · <kbd>+</kbd> <kbd>−</kbd> <kbd>0</kbd> zoom · <kbd>Ctrl</kbd>+wheel zoom · <kbd>Space</kbd>+drag pan · <kbd>PgUp</kbd> <kbd>PgDn</kbd> sheets</div>`;
  bindEditor($('#tab-spec'), s, () => { renderRooms(); renderDoors(); renderTakeoff(); drawOverlay(); saveSoon(); });
  $('#aiTier').value = S.project.aiTier || 'complex'; $('#aiTier').onchange = e => { S.project.aiTier = e.target.value; saveSoon(); };
  $('#aiTierApplied').value = S.project.aiTierApplied ? `${tierLabel(S.project.aiTierApplied)} tier${S.project.aiTierAsked && S.project.aiTierAsked !== S.project.aiTierApplied ? ` (asked for ${S.project.aiTierAsked})` : ''}` : 'no reads yet';
  $('#specSaveDef').onclick = () => { try { localStorage.setItem('tdt.spec', JSON.stringify(S.spec)); toast('Saved as your defaults for new projects'); } catch (e) { toast('Could not save defaults in this browser'); } };
  $('#specReset').onclick = () => { undo.push(); S.spec = { ...DEFAULT_SPEC }; renderSpec(); renderAll(); toast('Spec reset'); };
}

/* ---- rooms ---- */
function renderRooms() {
  const el = $('#tab-rooms');
  const list = S.rooms.slice().sort((a, b) => (a.page - b.page) || (S.rooms.indexOf(a) - S.rooms.indexOf(b)));
  el.innerHTML = `
  <div class="panelhead"><h2>Rooms</h2><span class="sp"></span>
    <button class="btn small" id="roomAddDims">+ Room by size</button>
    <button class="btn ghost small" id="roomFindText" ${V.pdf ? '' : 'disabled'} title="Looks for room names with sizes printed under them on this sheet">Find from plan text</button>
    <button class="btn ai small ai-only" id="roomAi" ${V.pdf ? '' : 'disabled'} hidden title="Claude reads the whole sheet and lists its rooms, doors and windows">Read sheet with Claude</button>
  </div>
  ${list.length ? '' : `<div class="hintbox">No rooms yet. Trace them on the plan with <b>Trace room</b> or <b>Rect room</b>, add them by size, or try <b>Find from plan text</b> on a vector PDF${CAP.sample ? ', or <b>Read sheet with Claude</b>' : ''}.</div>`}
  ${list.map(roomCard).join('')}`;
  $('#roomAddDims').onclick = addRoomByDims;
  $('#roomFindText').onclick = runFindRooms;
  $('#roomAi').onclick = () => { if (V.base) aiRead({ x: 0, y: 0, w: V.base.width, h: V.base.height }); };
  updateCapUI();
  bindCards(el);
}
function roomCard(r) {
  const open = UI.openRoom === r.id, sel = V.sel === r.id, sk = roomSkirting(r);
  const meta = sk.per == null ? `<span class="meta warn">needs size</span>` : `<span class="meta">${fm(sk.per)} m${r.skirting ? ` · skirt ${fm(sk.net)} m` : ' · no skirt'}</span>`;
  return `<div class="card${sel ? ' sel' : ''}" data-id="${r.id}" data-kind="room"><div class="cardhead"><span class="tag room">${esc(shortPage(r.page))}</span><span class="ttl">${esc(r.name || 'Unnamed room')}${r.src === 'ai' ? ' <span class="muted small">(Claude)</span>' : ''}</span>${meta}</div>${open ? roomEditor(r) : ''}</div>`;
}
function roomEditor(r) {
  const n = S.project.pageCount || r.page || 1;
  const pages = [...Array(Math.max(n, r.page || 1))].map((_, i) => `<option value="${i + 1}">${esc(pageTag(i + 1))}</option>`).join('');
  return `<div class="editor">
    <div class="row2"><label>Name<input data-k="name" list="dl-rooms"></label><label>Sheet<select data-k="page" data-num>${pages}</select></label></div>
    <div class="row3"><label>Measure by<select data-k="method"><option value="trace">Trace on plan</option><option value="dims">Length × width</option><option value="perimeter">Perimeter</option></select></label>
      <label ${r.method === 'dims' ? '' : 'hidden'}>Length (mm)<input data-k="length" type="number" step="10"></label><label ${r.method === 'dims' ? '' : 'hidden'}>Width (mm)<input data-k="width" type="number" step="10"></label>
      <label ${r.method === 'perimeter' ? '' : 'hidden'}>Perimeter (mm)<input data-k="perimeter" type="number" step="10"></label>
      ${r.method === 'trace' ? `<label>Outline<button class="btn ghost small" data-act="retrace" type="button">${r.pts && r.pts.length >= 3 ? 'Retrace' : 'Trace now'}</button></label>` : ''}</div>
    <div class="stats" data-stats>${roomStats(r)}</div>
    <label class="chk flat"><input data-k="skirting" type="checkbox"> Skirting to this room</label>
    <h3>Other deductions (mm of wall with no skirting)</h3>
    <div>${(r.deductions || []).map((d, i) => `<div class="dedrow"><input data-ded="label" data-i="${i}" list="dl-deductions" value="${esc(d.label)}" placeholder="What" aria-label="Deduction"><input data-ded="mm" data-i="${i}" type="number" step="10" value="${esc(d.mm || '')}" placeholder="mm" aria-label="Millimetres"><button data-act="deldel" data-i="${i}" title="Remove" type="button">×</button></div>`).join('')}</div>
    <button class="btn ghost small" data-act="addded" type="button">+ Add deduction</button>
    <label style="margin-top:8px">Notes<input data-k="notes"></label>
    <div class="editbtns">${r.pts || r.pt ? `<button class="btn ghost small" data-act="locate" type="button">Show on plan</button>` : ''}${!r.pts ? `<button class="btn ghost small" data-act="place" type="button">${r.pt ? 'Move label' : 'Place label on plan'}</button>` : ''}<button class="btn ghost small danger" data-act="del" type="button">Delete room</button></div>
  </div>`;
}
function roomStats(r) {
  const sk = roomSkirting(r), area = roomAreaM2(r);
  if (sk.per == null) return `<span class="warn">No size yet${r.method === 'trace' ? (r.pts ? (mmPerPt(r.page) ? '' : ' — set the sheet scale') : ' — trace the outline') : ''}</span>`;
  return `<span>Perimeter <b>${fm(sk.per)} m</b></span>${area != null ? `<span>Area <b>${area.toFixed(1)} m²</b></span>` : ''}<span>Doors <b>−${fm(sk.doorDed)} m</b> (${sk.doors.length})</span>${sk.other ? `<span>Other <b>−${fm(sk.other)} m</b></span>` : ''}<span>Skirting <b>${r.skirting ? fm(sk.net) + ' m' : 'none'}</b></span>`;
}
function addRoomByDims() {
  const pages = allPages().map(n => `<option value="${n}" ${n === V.pageNum ? 'selected' : ''}>${esc(pageTag(n))}</option>`).join('');
  modal.open({
    title: 'Add room by size',
    body: `<label>Room name<input id="nrName" list="dl-rooms" placeholder="e.g. BED 2"></label><div class="row2"><label>Length (mm)<input id="nrL" type="number" step="10" placeholder="3600"></label><label>Width (mm)<input id="nrW" type="number" step="10" placeholder="3300"></label></div><label>Sheet<select id="nrPage">${pages}</select></label><p class="small muted">Or leave the size blank and type the perimeter in the room's editor afterwards.</p>`,
    ok: 'Add room',
    onOk: () => {
      const name = $('#nrName').value.trim() || 'Room'; undo.push();
      const r = { id: uid(), name, page: num($('#nrPage').value, V.pageNum), method: 'dims', pts: null, pt: null, length: num($('#nrL').value), width: num($('#nrW').value), perimeter: 0, skirting: defaultSkirting(name), deductions: [], notes: '', src: 'manual' };
      S.rooms.push(r); UI.openRoom = r.id; renderAll(); scrollToCard(r.id);
    }
  });
}
async function runFindRooms() {
  if (!V.pdf) return;
  const pn = V.pageNum; undo.push();
  let scaleMsg = '';
  if (!mmPerPt(pn)) { const ratio = await findScaleText(pn); if (ratio) { setPageScale(pn, ratio * PT_MM, { method: 'preset', calib: null, calibMm: null }); scaleMsg = ` Applied 1:${ratio} from the sheet's scale note — check it with Calibrate.`; } }
  const res = await findRoomsFromText(pn);
  if (res.noText) { undo.stack.pop(); $('#btnUndo').disabled = !undo.stack.length; modal.open({ title: 'No text on this sheet', body: `<p class="small">This sheet has no text layer, so it is probably a scanned or rasterised drawing. Trace the rooms with the Trace room and Rect room tools${CAP.sample ? ', or use Read sheet with Claude' : ''}.</p>`, ok: 'OK', cancel: null }); return; }
  renderAll(); updateScaleStatus(); updatePageUI();
  toast((res.added ? `Added ${res.added} room${res.added === 1 ? '' : 's'} from the sheet's labels — check the sizes and the skirting switches.` : 'No new room labels found on this sheet.') + scaleMsg, 6000);
}
async function runFindTags() {
  if (!V.pdf) return;
  undo.push(); const res = await findTagsFromText(V.pageNum);
  if (res.noText) { undo.stack.pop(); $('#btnUndo').disabled = !undo.stack.length; toast('No text layer on this sheet — place doors and windows by hand'); return; }
  renderAll();
  toast(res.doors || res.windows ? `Added ${res.doors} door${res.doors === 1 ? '' : 's'} and ${res.windows} window${res.windows === 1 ? '' : 's'}${res.sched ? ` — schedule read for ${res.sched} tags` : ''}. Check the types, sizes and rooms.` : 'No new D or W tags found on this sheet', 6000);
}

/* ---- doors & windows ---- */
function renderDoors() {
  const el = $('#tab-doors');
  const doors = S.doors.slice().sort((a, b) => cmpTag(a.tag, b.tag)), wins = S.windows.slice().sort((a, b) => cmpTag(a.tag, b.tag));
  el.innerHTML = `
  <div class="panelhead"><h2>Doors &amp; windows</h2><span class="sp"></span>
    <button class="btn small" id="doorAdd">+ Door</button><button class="btn small" id="winAdd" style="background:var(--win);border-color:var(--win);color:#fff">+ Window</button>
    <button class="btn ghost small" id="tagFind" ${V.pdf ? '' : 'disabled'} title="Finds D01 / W01 style tags on this sheet and reads door and window schedule tables">Find tags from plan text</button>
  </div>
  ${doors.length || wins.length ? '' : `<div class="hintbox">Place doors and windows on the plan with the <b>Door</b> and <b>Window</b> tools, or use <b>Find tags from plan text</b> when the plan has D01 / W01 tags and a schedule.</div>`}
  <h3>Doors <span class="cnt">${doors.length}</span></h3>${doors.map(doorCard).join('') || '<p class="small muted">None yet.</p>'}
  <h3>Windows <span class="cnt">${wins.length}</span></h3>${wins.map(winCard).join('') || '<p class="small muted">None yet.</p>'}`;
  $('#doorAdd').onclick = () => { undo.push(); const d = newDoor(V.pageNum, null); S.doors.push(d); UI.openDoor = d.id; renderAll(); scrollToCard(d.id); toast('Door added without a position — use Place on plan to locate it'); };
  $('#winAdd').onclick = () => { undo.push(); const w = newWindow(V.pageNum, null); S.windows.push(w); UI.openWin = w.id; renderAll(); scrollToCard(w.id); toast('Window added without a position — use Place on plan to locate it'); };
  $('#tagFind').onclick = runFindTags;
  bindCards(el);
}
function doorCard(d) {
  const open = UI.openDoor === d.id, sel = V.sel === d.id, where = whereStr(d);
  const meta = `<span class="meta${d.x == null ? ' warn' : ''}">${d.x == null ? 'not placed' : ((DOOR_TYPES[d.type] || {}).noLeaf ? `${doorSpanMm(d)} wide${leavesOf(d) > 1 ? ` (${leavesOf(d)} panels)` : ''}` : sizeStr(d))}</span>`;
  return `<div class="card${sel ? ' sel' : ''}" data-id="${d.id}" data-kind="door"><div class="cardhead"><span class="tag door">${esc(d.tag)}</span><span class="ttl">${esc(doorLabel(d))}${where ? ` <span class="muted">· ${esc(where)}</span>` : ''}</span>${meta}</div>${open ? doorEditor(d) : ''}</div>`;
}
function doorEditor(d) {
  const types = Object.entries(DOOR_TYPES).map(([k, t]) => `<option value="${k}">${esc(t.label)}</option>`).join('');
  return `<div class="editor">
    <div class="row3"><label>Tag<input data-k="tag"></label><label>Type<select data-k="type">${types}</select></label><label>Quantity<input data-k="qty" type="number" min="1" step="1"></label></div>
    <div class="row3"><label>Height (mm)<input data-k="height" type="number" step="10"></label><label>Width per leaf (mm)<input data-k="width" type="number" step="10"></label><label>Leaves<select data-k="leaves" data-num><option value="1">1</option><option value="2">2 (pair)</option><option value="3">3</option><option value="4">4</option></select></label></div>
    <div class="row3"><label>Thickness (mm)<input data-k="thick" type="number"></label><label>Hand / swing<input data-k="hand" list="dl-hands" placeholder="e.g. LH in"></label><label>Furniture<select data-k="lever"><option value="auto">Auto (by room)</option><option value="passage">Passage set</option><option value="privacy">Privacy set</option><option value="entrance">Entrance set</option><option value="dummy">Dummy lever</option><option value="cavity">Cavity set</option><option value="none">None</option></select></label></div>
    <div class="row2"><label>From room<select data-k="fromRoom"><option value="">— none —</option>${roomOptions()}</select></label><label>To room<select data-k="toRoom"><option value="">— outside / none —</option>${roomOptions()}</select></label></div>
    <div class="row2"><label>Leaf / style<input data-k="leaf" list="dl-leaves"></label><label>Colour<input data-k="colour" placeholder="Spec default"></label></div>
    <div class="row3"><label>Architrave<select data-k="archSides" data-num><option value="0">None</option><option value="1">One side</option><option value="2">Both sides</option></select></label><label class="chk"><input data-k="skirtDeduct" type="checkbox"> Deduct from skirting</label><label class="chk"><input data-k="fire" type="checkbox"> Solid core / fire door</label></div>
    <label>Notes<input data-k="notes"></label>
    <div class="stats" data-stats>${doorStats(d)}</div>
    <div class="editbtns">${d.x == null ? `<button class="btn ghost small" data-act="place" type="button">Place on plan</button>` : `<button class="btn ghost small" data-act="locate" type="button">Show on plan</button><button class="btn ghost small" data-act="place" type="button">Move</button>`}<button class="btn ghost small" data-act="dup" type="button">Duplicate</button><button class="btn ghost small danger" data-act="del" type="button">Delete</button></div>
  </div>`;
}
function doorStats(d) { const lv = leverFor(d); return `<span>Architrave <b>${fm(archForDoor(d))} m</b></span><span>Skirting lost <b>${d.skirtDeduct ? fm(doorOpeningMm(d)) + ' m each side' : 'none'}</b></span>${lv ? `<span>Furniture <b>${esc(LEVER_LABEL[lv] || lv)}</b></span>` : ''}`; }
function winCard(w) {
  const open = UI.openWin === w.id, sel = V.sel === w.id, hasSize = w.width > 0 && w.height > 0;
  const meta = `<span class="meta${!hasSize || w.x == null ? ' warn' : ''}">${hasSize ? `${w.height}×${w.width}` : 'size?'}${w.x == null ? ' · not placed' : ''}</span>`;
  return `<div class="card${sel ? ' sel' : ''}" data-id="${w.id}" data-kind="win"><div class="cardhead"><span class="tag win">${esc(w.tag)}</span><span class="ttl">${esc(roomName(w.room) || 'Window')}${w.arch ? '' : ' <span class="muted">· no architrave</span>'}</span>${meta}</div>${open ? winEditor(w) : ''}</div>`;
}
function winEditor(w) {
  return `<div class="editor">
    <div class="row3"><label>Tag<input data-k="tag"></label><label>Room<select data-k="room"><option value="">— none —</option>${roomOptions()}</select></label><label>Quantity<input data-k="qty" type="number" min="1" step="1"></label></div>
    <div class="row3"><label>Height (mm)<input data-k="height" type="number" step="10"></label><label>Width (mm)<input data-k="width" type="number" step="10"></label><label class="chk"><input data-k="arch" type="checkbox"> Architrave</label></div>
    <label>Notes<input data-k="notes"></label>
    <div class="stats" data-stats>${winStats(w)}</div>
    <div class="editbtns">${w.x == null ? `<button class="btn ghost small" data-act="place" type="button">Place on plan</button>` : `<button class="btn ghost small" data-act="locate" type="button">Show on plan</button><button class="btn ghost small" data-act="place" type="button">Move</button>`}<button class="btn ghost small" data-act="dup" type="button">Duplicate</button><button class="btn ghost small danger" data-act="del" type="button">Delete</button></div>
  </div>`;
}
function winStats(w) { return `<span>Architrave <b>${w.arch ? fm(archForWindow(w)) + ' m' : 'none'}</b></span>`; }

/* ---- card wiring shared by rooms, doors and windows ---- */
function bindCards(root) {
  $$('.card', root).forEach(card => {
    const id = card.dataset.id, kind = card.dataset.kind, obj = findObj(id); if (!obj) return;
    $('.cardhead', card).addEventListener('click', () => {
      const key = kind === 'room' ? 'openRoom' : kind === 'door' ? 'openDoor' : 'openWin';
      UI[key] = UI[key] === id ? null : id; if (UI[key]) V.sel = id;
      if (kind === 'room') renderRooms(); else renderDoors();
      drawOverlay();
    });
    const ed = $('.editor', card); if (!ed) return;
    bindEditor(ed, obj, (k, v) => onItemChange(kind, obj, k, v, card));
    $$('[data-ded]', ed).forEach(inp => inp.addEventListener('change', () => {
      const d = obj.deductions[+inp.dataset.i]; if (!d) return;
      undo.push(); if (inp.dataset.ded === 'mm') d.mm = num(inp.value); else d.label = inp.value;
      afterItemChange(kind, obj, card);
    }));
    $$('[data-act]', ed).forEach(btn => btn.addEventListener('click', e => { e.stopPropagation(); cardAction(kind, obj, btn.dataset.act, btn); }));
  });
}
function onItemChange(kind, obj, k, v, card) {
  if (kind === 'door' && k === 'type') { applyDoorType(obj, v); rerenderKeepFocus(); return; }
  if (k === 'method' || k === 'page' || k === 'fromRoom' || k === 'toRoom' || k === 'room') { rerenderKeepFocus(); return; }
  afterItemChange(kind, obj, card);
}
function afterItemChange(kind, obj, card) {
  if (card) {
    const tmp = document.createElement('div'); tmp.innerHTML = kind === 'room' ? roomCard(obj) : kind === 'door' ? doorCard(obj) : winCard(obj);
    const nh = $('.cardhead', tmp), oh = $('.cardhead', card);
    if (nh && oh) { $('.ttl', oh).innerHTML = $('.ttl', nh).innerHTML; $('.meta', oh).outerHTML = $('.meta', nh).outerHTML; }
    const st = $('[data-stats]', card); if (st) st.innerHTML = kind === 'room' ? roomStats(obj) : kind === 'door' ? doorStats(obj) : winStats(obj);
  }
  if (kind === 'room') renderDoors(); else renderRooms();      // the other list shows names and totals that may have changed
  renderTakeoff(); updateCounts(); drawOverlay(); saveSoon();
}
function refreshRoomCard(id) { const r = S.rooms.find(x => x.id === id); if (!r) return; afterItemChange('room', r, $(`.card[data-id="${id}"]`)); }
function cardAction(kind, obj, act, btn) {
  if (act === 'del') deleteItem(obj.id);
  else if (act === 'locate') { const p = obj.pts && obj.pts.length ? centroid(obj.pts) : (obj.pt || (obj.x != null ? { x: obj.x, y: obj.y } : null)); if (!p || !V.pdf) { toast(V.pdf ? 'Not placed on the plan yet' : 'Open the plan first'); return; } V.sel = obj.id; centreOn(p, obj.page); refreshSelection(); }
  else if (act === 'place') { if (!V.pdf) { toast('Open the plan first'); return; } V.place = { kind, id: obj.id }; setTool('select'); if (obj.page && obj.page !== V.pageNum && obj.page <= (S.project.pageCount || 1)) goPage(obj.page); $('#hint').textContent = `Click the plan where ${obj.tag || obj.name || 'it'} goes (Esc to cancel)`; toast(`Click the plan where ${obj.tag || obj.name || 'it'} goes`); }
  else if (act === 'retrace') { if (!V.pdf) { toast('Open the plan first'); return; } V.retrace = obj.id; setTool('poly'); if (obj.page && obj.page !== V.pageNum && obj.page <= (S.project.pageCount || 1)) goPage(obj.page); $('#hint').textContent = `Tracing ${obj.name}: click each corner, then the first corner to close (Esc to cancel)`; toast(`Trace ${obj.name} on the plan`); }
  else if (act === 'addded') { undo.push(); obj.deductions.push({ label: '', mm: 0 }); rerenderKeepFocus(); const inps = $$(`.card[data-id="${obj.id}"] [data-ded="label"]`); if (inps.length) inps[inps.length - 1].focus(); }
  else if (act === 'deldel') { undo.push(); obj.deductions.splice(+btn.dataset.i, 1); rerenderKeepFocus(); }
  else if (act === 'dup') { undo.push(); const c = JSON.parse(JSON.stringify(obj)); c.id = uid(); c.tag = nextTag(kind === 'door' ? 'D' : 'W'); if (c.x != null) c.x += 30 / V.zoom; if (kind === 'door') { S.doors.push(c); UI.openDoor = c.id; } else { S.windows.push(c); UI.openWin = c.id; } renderAll(); scrollToCard(c.id); }
}
function placeItem(p) {
  const pl = V.place; V.place = null; const o = findObj(pl.id); if (!o) return;
  undo.push(); o.page = V.pageNum;
  if (pl.kind === 'room') o.pt = p;
  else {
    o.x = p.x; o.y = p.y; const near = roomsNear(V.pageNum, p);
    if (pl.kind === 'door') { if (!o.fromRoom && near[0]) o.fromRoom = near[0].id; if (!o.toRoom && near[1] && near[1].id !== o.fromRoom) o.toRoom = near[1].id; }
    else if (!o.room && near[0]) o.room = near[0].id;
  }
  V.sel = o.id; renderAll(); $('#hint').textContent = HINTS.select; toast('Placed');
}
