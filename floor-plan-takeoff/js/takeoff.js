/* =========================== takeoff & exports =========================== */
function renderTakeoff() {
  const t = calcTakeoff(), sp = S.spec, el = $('#tab-takeoff');
  const roomRows = t.rooms.map(x => `<tr><td>${esc(x.r.name)}</td><td>${esc(shortPage(x.r.page))}</td><td class="n">${x.per == null ? '–' : fm(x.per)}</td><td class="n">${x.doorDed ? '−' + fm(x.doorDed) : ''}</td><td class="n">${x.other ? '−' + fm(x.other) : ''}</td><td class="n">${x.r.skirting ? (x.per == null ? '?' : fm(x.net)) : '<span class="muted">none</span>'}</td></tr>`).join('');
  const archRows = t.arch.map(a => `<tr><td>${esc(a.tag)}</td><td>${esc(a.desc)}</td><td>${esc(a.where)}</td><td class="n">${a.sides}</td><td class="n">${a.qty}</td><td class="n">${fm(a.lm)}</td></tr>`).join('');
  const doorRows = S.doors.slice().sort((a, b) => cmpTag(a.tag, b.tag)).map(d => { const t2 = DOOR_TYPES[d.type] || {}, lv = leverFor(d); return `<tr><td>${esc(d.tag)}</td><td>${esc(whereStr(d))}</td><td>${esc(doorLabel(d))}</td><td class="n">${t2.noLeaf ? `${num(d.width) * leavesOf(d)} w` : esc(sizeStr(d))}</td><td>${esc(d.hand || '')}</td><td>${esc(t2.noLeaf ? '' : d.leaf || '')}</td><td>${esc(t2.noLeaf ? '' : (d.colour || sp.doorColour || ''))}</td><td>${esc(lv ? (LEVER_LABEL[lv] || lv) : '')}</td><td class="n">${qtyOf(d)}</td><td>${esc([d.fire ? 'Solid core / FR' : '', d.notes].filter(Boolean).join(' · '))}</td></tr>`; }).join('');
  const groupRows = t.doorGroups.map(g => `<tr><td>${esc(g.label)}</td><td class="n">${g.height}×${g.width}×${g.thick}${g.leaves > 1 ? ` (${g.leaves} leaves)` : ''}</td><td>${esc(g.leaf)}</td><td>${esc(g.colour || sp.doorColour || '')}</td><td class="n">${g.qty}</td><td class="small muted">${esc(g.tags.join(', '))}</td></tr>`).join('');
  const hwRows = t.hardware.map(h => `<tr><td>${esc(h.item)}</td><td class="n">${h.qty}</td></tr>`).join('');
  el.innerHTML = `
  <div class="panelhead"><h2>Takeoff${S.project.name ? ` — ${esc(S.project.name)}` : ''}</h2><span class="sp"></span>
    <button class="btn small" id="exCsv">Export CSV</button><button class="btn ghost small" id="exDb" title="Headerless 4-field CSV for Databuild's Import Quantities screen">Databuild CSV</button><button class="btn ghost small" id="exTxt">Copy report</button><button class="btn ghost small" id="exPrint">Print</button></div>
  ${t.warnings.length ? `<ul class="warnlist">${t.warnings.map(w => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}
  <div class="tiles">
    <div class="tile"><div class="k">Skirting</div><div class="v">${fm(t.skirtNet)} m</div><div class="s">+${num(sp.skirtWaste)}% waste = ${fm(t.skirtWaste)} m<br>${t.skirtLengths} × ${fm(sp.skirtStock)} m lengths</div></div>
    <div class="tile"><div class="k">Architrave</div><div class="v">${fm(t.archNet)} m</div><div class="s">+${num(sp.archWaste)}% waste = ${fm(t.archWaste)} m<br>${t.archLengths} × ${fm(sp.archStock)} m lengths</div></div>
    <div class="tile door"><div class="k">Doors</div><div class="v">${t.doorCount}</div><div class="s">${t.leafCount} leaves · ${t.openings} openings</div></div>
    <div class="tile win"><div class="k">Windows</div><div class="v">${t.winCount}</div><div class="s">${t.winArchCount} with architrave</div></div>
  </div>
  <h3>Skirting — ${esc(skirtDesc())}${sp.skirtColour ? ` · ${esc(sp.skirtColour)}` : ''}</h3>
  <div class="tablewrap"><table><thead><tr><th>Room</th><th>Sheet</th><th class="n">Perimeter m</th><th class="n">Doors</th><th class="n">Other</th><th class="n">Skirting m</th></tr></thead><tbody>${roomRows || '<tr><td colspan="6" class="muted">No rooms yet</td></tr>'}<tr class="tot"><td colspan="5">Total net</td><td class="n">${fm(t.skirtNet)}</td></tr><tr class="tot"><td colspan="5">With ${num(sp.skirtWaste)}% waste → ${t.skirtLengths} lengths of ${fm(sp.skirtStock)} m</td><td class="n">${fm(t.skirtWaste)}</td></tr></tbody></table></div>
  <h3>Architrave — ${esc(archDesc())}${sp.archColour ? ` · ${esc(sp.archColour)}` : ''}</h3>
  <div class="tablewrap"><table><thead><tr><th>Tag</th><th>Item</th><th>Where</th><th class="n">Sides</th><th class="n">Qty</th><th class="n">Metres</th></tr></thead><tbody>${archRows || '<tr><td colspan="6" class="muted">Nothing yet</td></tr>'}<tr class="tot"><td colspan="5">Total net</td><td class="n">${fm(t.archNet)}</td></tr><tr class="tot"><td colspan="5">With ${num(sp.archWaste)}% waste → ${t.archLengths} lengths of ${fm(sp.archStock)} m</td><td class="n">${fm(t.archWaste)}</td></tr></tbody></table></div>
  <h3>Door schedule</h3>
  <div class="tablewrap"><table><thead><tr><th>Tag</th><th>Location</th><th>Type</th><th class="n">Size</th><th>Hand</th><th>Leaf</th><th>Colour</th><th>Furniture</th><th class="n">Qty</th><th>Notes</th></tr></thead><tbody>${doorRows || '<tr><td colspan="10" class="muted">No doors yet</td></tr>'}</tbody></table></div>
  <h3>Door summary (order list)</h3>
  <div class="tablewrap"><table><thead><tr><th>Type</th><th class="n">Size</th><th>Leaf</th><th>Colour</th><th class="n">Qty</th><th>Tags</th></tr></thead><tbody>${groupRows || '<tr><td colspan="6" class="muted">No door leaves</td></tr>'}</tbody></table></div>
  <p class="small muted">Jamb / frame: ${esc(sp.jamb || '–')} · Frame colour: ${esc(sp.frameColour || sp.doorColour || '–')} · Hardware: ${esc(sp.hardware || '–')}</p>
  <h3>Hardware</h3>
  <div class="tablewrap"><table><thead><tr><th>Item</th><th class="n">Qty</th></tr></thead><tbody>${hwRows || '<tr><td colspan="2" class="muted">Nothing yet</td></tr>'}</tbody></table></div>
  ${sp.notes ? `<h3>Notes</h3><p class="small">${esc(sp.notes)}</p>` : ''}`;
  $('#exCsv').onclick = () => saveFile(`${slug(S.project.name)}-takeoff.csv`, takeoffCsv(t));
  $('#exDb').onclick = () => saveFile(`${slug(S.project.name)}-databuild.csv`, databuildCsv(t));
  $('#exTxt').onclick = async () => { const txt = takeoffText(t); try { await navigator.clipboard.writeText(txt); toast('Report copied to the clipboard'); } catch (e) { modal.text('Takeoff report', txt); } };
  $('#exPrint').onclick = () => { showTab('takeoff'); setTimeout(() => window.print(), 50); };
}
function csvRow(a) { return a.map(v => { v = String(v ?? ''); return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(','); }
function takeoffCsv(t) {
  const sp = S.spec, L = [];
  L.push(csvRow(['Trim & Door Takeoff', S.project.name || '', S.project.pdfName || '', new Date().toISOString().slice(0, 10)]));
  L.push(''); L.push(csvRow(['SKIRTING', skirtDesc(), sp.skirtColour || '']));
  L.push(csvRow(['Room', 'Sheet', 'Perimeter m', 'Door openings m', 'Other deductions m', 'Skirting m']));
  for (const x of t.rooms) L.push(csvRow([x.r.name, pageTag(x.r.page), x.per == null ? '' : fm(x.per), fm(x.doorDed), fm(x.other), x.r.skirting ? (x.per == null ? '' : fm(x.net)) : '0.00']));
  L.push(csvRow(['Total net', '', '', '', '', fm(t.skirtNet)]));
  L.push(csvRow([`With ${num(sp.skirtWaste)}% waste`, '', '', '', '', fm(t.skirtWaste)]));
  L.push(csvRow([`Lengths of ${fm(sp.skirtStock)} m`, '', '', '', '', t.skirtLengths]));
  L.push(''); L.push(csvRow(['ARCHITRAVE', archDesc(), sp.archColour || '']));
  L.push(csvRow(['Tag', 'Item', 'Where', 'Sides', 'Qty', 'Metres']));
  for (const a of t.arch) L.push(csvRow([a.tag, a.desc, a.where, a.sides, a.qty, fm(a.lm)]));
  L.push(csvRow(['Total net', '', '', '', '', fm(t.archNet)]));
  L.push(csvRow([`With ${num(sp.archWaste)}% waste`, '', '', '', '', fm(t.archWaste)]));
  L.push(csvRow([`Lengths of ${fm(sp.archStock)} m`, '', '', '', '', t.archLengths]));
  L.push(''); L.push(csvRow(['DOOR SCHEDULE']));
  L.push(csvRow(['Tag', 'From', 'To', 'Type', 'Height', 'Width per leaf', 'Thickness', 'Leaves', 'Hand', 'Leaf', 'Colour', 'Furniture', 'Architrave sides', 'Qty', 'Notes']));
  for (const d of S.doors.slice().sort((a, b) => cmpTag(a.tag, b.tag))) { const lv = leverFor(d), t2 = DOOR_TYPES[d.type] || {}; L.push(csvRow([d.tag, roomName(d.fromRoom), roomName(d.toRoom) || (t2.ext ? 'Outside' : ''), doorLabel(d), d.height, d.width, d.thick, leavesOf(d), d.hand || '', t2.noLeaf ? '' : d.leaf || '', t2.noLeaf ? '' : (d.colour || sp.doorColour || ''), lv ? (LEVER_LABEL[lv] || lv) : '', d.archSides, qtyOf(d), [d.fire ? 'Solid core / FR' : '', d.notes].filter(Boolean).join(' - ')])); }
  L.push(''); L.push(csvRow(['DOOR SUMMARY']));
  L.push(csvRow(['Type', 'Height', 'Width per leaf', 'Thickness', 'Leaves', 'Leaf', 'Colour', 'Qty', 'Tags']));
  for (const g of t.doorGroups) L.push(csvRow([g.label, g.height, g.width, g.thick, g.leaves, g.leaf, g.colour || sp.doorColour || '', g.qty, g.tags.join(' ')]));
  L.push(csvRow(['Jamb / frame', sp.jamb || '', 'Frame colour', sp.frameColour || sp.doorColour || '', 'Hardware', sp.hardware || '']));
  L.push(''); L.push(csvRow(['WINDOWS']));
  L.push(csvRow(['Tag', 'Room', 'Height', 'Width', 'Architrave', 'Qty', 'Notes']));
  for (const w of S.windows.slice().sort((a, b) => cmpTag(a.tag, b.tag))) L.push(csvRow([w.tag, roomName(w.room), w.height || '', w.width || '', w.arch ? 'yes' : 'no', qtyOf(w), w.notes || '']));
  L.push(''); L.push(csvRow(['HARDWARE']));
  for (const h of t.hardware) L.push(csvRow([h.item, h.qty]));
  if (t.warnings.length) { L.push(''); L.push(csvRow(['CHECK'])); for (const w of t.warnings) L.push(csvRow([w])); }
  return L.join('\r\n');
}
function dbClean(s) { return String(s || '').replace(/(\d+(?:\.\d+)?)\s*m\b/gi, (m, n) => Math.round(parseFloat(n) * 1000) + 'mm').replace(/\./g, '').replace(/\|/g, '-').replace(/\s+/g, ' ').trim(); }
function databuildCsv(t) {
  const sp = S.spec, L = [];
  const row = (code, qty, desc, rate) => L.push(csvRow([code, num(qty).toFixed(2), dbClean(desc), num(rate).toFixed(2)]));
  if (t.skirtNet > 0) { if (sp.skirtUnit === 'lm') row('0004', t.skirtWaste / 1000, `Skirting ${skirtDesc()}${sp.skirtColour ? ' ' + sp.skirtColour : ''}`, sp.skirtRate); else row('0001', t.skirtLengths, `Skirting ${skirtDesc()} ${num(sp.skirtStock)}mm`, sp.skirtRate); }
  if (t.archNet > 0) { if (sp.archUnit === 'lm') row('0004', t.archWaste / 1000, `Architrave ${archDesc()}${sp.archColour ? ' ' + sp.archColour : ''}`, sp.archRate); else row('0001', t.archLengths, `Architrave ${archDesc()} ${num(sp.archStock)}mm`, sp.archRate); }
  for (const g of t.doorGroups) row('0001', g.qty, `Door ${g.label} ${g.height}x${g.width}x${g.thick}${g.leaves > 1 ? ' ' + g.leaves + ' leaf' : ''}${g.leaf ? ' ' + g.leaf : ''}${g.fire ? ' solid core' : ''}${(g.colour || sp.doorColour) ? ' ' + (g.colour || sp.doorColour) : ''}`, sp.doorRate);
  for (const h of t.hardware) row('0001', h.qty, h.item + (sp.hardware ? ' ' + sp.hardware : ''), 0);
  return L.join('\r\n');
}
function takeoffText(t) {
  const sp = S.spec, L = [], pad = (s, n) => String(s ?? '').padEnd(n), rp = (s, n) => String(s ?? '').padStart(n);
  L.push(`TRIM & DOOR TAKEOFF${S.project.name ? ' — ' + S.project.name : ''}`);
  L.push(`Plan: ${S.project.pdfName || '–'} · ${new Date().toLocaleDateString('en-AU')}`);
  L.push(''); L.push(`SKIRTING — ${skirtDesc()}${sp.skirtColour ? ' · ' + sp.skirtColour : ''}`);
  L.push(pad('Room', 22) + pad('Sheet', 8) + rp('Perim', 8) + rp('Doors', 8) + rp('Other', 8) + rp('Skirt', 8));
  for (const x of t.rooms) L.push(pad(x.r.name, 22) + pad(shortPage(x.r.page), 8) + rp(x.per == null ? '–' : fm(x.per), 8) + rp(x.doorDed ? '-' + fm(x.doorDed) : '', 8) + rp(x.other ? '-' + fm(x.other) : '', 8) + rp(x.r.skirting ? (x.per == null ? '?' : fm(x.net)) : 'none', 8));
  L.push(`Total net ${fm(t.skirtNet)} m · with ${num(sp.skirtWaste)}% waste ${fm(t.skirtWaste)} m · ${t.skirtLengths} × ${fm(sp.skirtStock)} m lengths`);
  L.push(''); L.push(`ARCHITRAVE — ${archDesc()}${sp.archColour ? ' · ' + sp.archColour : ''}`);
  for (const a of t.arch) L.push(pad(a.tag, 6) + pad(a.desc, 44) + pad(a.where, 24) + rp(a.sides + ' side' + (a.sides > 1 ? 's' : ''), 8) + rp('×' + a.qty, 4) + rp(fm(a.lm), 8));
  L.push(`Total net ${fm(t.archNet)} m · with ${num(sp.archWaste)}% waste ${fm(t.archWaste)} m · ${t.archLengths} × ${fm(sp.archStock)} m lengths`);
  L.push(''); L.push('DOOR SCHEDULE');
  for (const d of S.doors.slice().sort((a, b) => cmpTag(a.tag, b.tag))) { const t2 = DOOR_TYPES[d.type] || {}, lv = leverFor(d); L.push(pad(d.tag, 6) + pad(whereStr(d).replace(' → ', ' > '), 28) + pad(doorLabel(d), 36) + pad(t2.noLeaf ? `${num(d.width) * leavesOf(d)} w` : sizeStr(d), 22) + pad(d.hand || '', 8) + pad(t2.noLeaf ? '' : (d.leaf || ''), 22) + pad(lv ? (LEVER_LABEL[lv] || lv) : '', 26) + (qtyOf(d) > 1 ? ' ×' + qtyOf(d) : '') + (d.fire ? ' · solid core/FR' : '') + (d.notes ? ' · ' + d.notes : '')); }
  L.push(''); L.push('DOOR SUMMARY');
  for (const g of t.doorGroups) L.push(rp(g.qty, 3) + ' × ' + `${g.label} ${g.height}×${g.width}×${g.thick}${g.leaves > 1 ? ' (' + g.leaves + ' leaves)' : ''}${g.leaf ? ' ' + g.leaf : ''}${(g.colour || sp.doorColour) ? ' — ' + (g.colour || sp.doorColour) : ''}  [${g.tags.join(', ')}]`);
  L.push(`Jamb: ${sp.jamb || '–'} · Frame colour: ${sp.frameColour || sp.doorColour || '–'} · Hardware: ${sp.hardware || '–'}`);
  L.push(''); L.push('WINDOWS');
  for (const w of S.windows.slice().sort((a, b) => cmpTag(a.tag, b.tag))) L.push(pad(w.tag, 6) + pad(roomName(w.room), 22) + pad(w.width > 0 && w.height > 0 ? `${w.height} h × ${w.width} w` : 'size?', 18) + (w.arch ? 'architrave' : 'no architrave') + (qtyOf(w) > 1 ? ' ×' + qtyOf(w) : '') + (w.notes ? ' · ' + w.notes : ''));
  L.push(''); L.push('HARDWARE');
  for (const h of t.hardware) L.push(rp(h.qty, 3) + ' × ' + h.item);
  if (t.warnings.length) { L.push(''); L.push('CHECK'); for (const w of t.warnings) L.push('- ' + w); }
  if (sp.notes) { L.push(''); L.push('NOTES'); L.push(sp.notes); }
  return L.join('\n');
}

/* =========================== top bar & start-up =========================== */
function bindTop() {
  $('#btnOpenPdf').onclick = $('#btnOpenPdf2').onclick = () => $('#pdfFile').click();
  $('#pdfFile').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; openFile(f); });
  $('#btnSample').onclick = $('#btnSample2').onclick = loadSample;
  $('#btnSave').onclick = () => saveFile(`${slug(S.project.name)}-takeoff.json`, JSON.stringify(S, null, 1));
  $('#btnLoad').onclick = () => $('#projFile').click();
  $('#projFile').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try {
      const o = JSON.parse(await f.text()); if (!o || !Array.isArray(o.rooms)) throw new Error('not a takeoff project file');
      undo.push(); applyProject(o); $('#projName').value = S.project.name || '';
      renderSpec(); renderAll(); updateScaleStatus(); updatePageUI();
      toast(`Loaded ${f.name}` + (S.project.pdfName && S.project.pdfName !== V.name ? ` — open ${S.project.pdfName} to see the plan` : ''), 6000);
    } catch (err) { toast('Could not load that file: ' + err.message); }
  });
  $('#btnNew').onclick = () => modal.open({ title: 'Start a new takeoff?', body: '<p class="small">This clears every room, door, window and sheet scale. The spec is kept. Save the project first if you want to come back to it.</p>', ok: 'Clear everything', onOk: () => { undo.push(); S.rooms = []; S.doors = []; S.windows = []; S.pages = {}; S.project.name = ''; $('#projName').value = ''; V.sel = null; renderAll(); updateScaleStatus(); updatePageUI(); } });
  $('#btnUndo').onclick = () => undo.pop();
  $('#projName').addEventListener('input', e => { S.project.name = e.target.value; saveSoon(); });
  $('#projName').addEventListener('change', () => renderTakeoff());
  $$('#toolGrp .tbtn').forEach(b => b.addEventListener('click', () => setTool(b.dataset.tool)));
  $('#prevPage').onclick = () => goPage(V.pageNum - 1); $('#nextPage').onclick = () => goPage(V.pageNum + 1);
  $('#zoomIn').onclick = () => setZoom(V.zoom * 1.25); $('#zoomOut').onclick = () => setZoom(V.zoom / 1.25); $('#zoomFit').onclick = () => fitZoom();
  $('#pageLabel').addEventListener('change', e => { S.pages[V.pageNum] = { ...(S.pages[V.pageNum] || {}), label: e.target.value.trim() }; renderRooms(); renderDoors(); renderTakeoff(); saveSoon(); });
  $('#scalePreset').addEventListener('change', e => {
    const v = e.target.value; if (!v) return;
    if (!V.pdf) { e.target.value = ''; toast('Open a plan first'); return; }
    if (v === 'custom') {
      modal.open({ title: 'Drawing scale', body: `<label>Ratio — the number after 1:<input id="ratioIn" type="number" min="1" value="${Math.round(scaleRatio(V.pageNum)) || 100}"></label><label class="chk flat"><input type="checkbox" id="ratioAll" checked> Apply to every sheet that is not calibrated</label>`, ok: 'Set', onOk: () => { const r = num($('#ratioIn').value); if (!(r > 0)) return false; applyPreset(r, $('#ratioAll').checked); } });
      e.target.value = ''; return;
    }
    applyPreset(num(v), true);
  });
  window.addEventListener('resize', () => drawOverlay());
}
async function loadSample() {
  const b = atob(SAMPLE_PDF_B64), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
  const ok = await openPdf(u, 'sample-plan.pdf');
  if (!ok) return;
  if (!mmPerPt(1)) { setPageScale(1, 100 * PT_MM, { method: 'preset', calib: null, calibMm: null }); afterScaleChange(); }
  if (!S.rooms.length) toast('Sample plan loaded at 1:100. Try “Find from plan text” under Rooms and “Find tags from plan text” under Doors.', 7000);
}
async function init() {
  if (!window.pdfjsLib) $('#emptyMsg').innerHTML = '<span class="err">The PDF engine (pdf.js) did not load. Check your connection and reload the page.</span>';
  else pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  if (!loadSaved()) S.spec = loadDefaultSpec();
  $('#projName').value = S.project.name || '';
  bindTop(); setTool('select'); renderSpec(); renderAll(); updateScaleStatus(); updatePageUI();
  try { const t = localStorage.getItem('tdt.tab'); if (t && $('#tab-' + t)) showTab(t); } catch (e) { }
  if (window.pdfjsLib && S.project.pdfName) {
    const f = await idbGet('pdf');
    if (f && f.bytes && f.name === S.project.pdfName) await openPdf(f.bytes, f.name, { silent: true, noStore: true });
  }
}
init();
