import json, re, math
import numpy as np
from shapely.geometry import Polygon, Point
MM = 25.4 / 72 * 100
IT = json.load(open('kalinda/items.json'))
R4 = json.load(open('kalinda/rooms4.json'))['rooms']; R5 = json.load(open('kalinda/rooms5.json'))['rooms']
def centre(i): return (i['x'] + i['w'] / 2, i['y'] - i['fs'] * 0.35)
def plan_tags(p):
    out = []
    for i in IT[str(p)]:
        m = re.match(r'^([DW]\d{1,2})\s+(.+)$', i['s'])
        if m and i['x'] > 60: out.append({'tag': m.group(1), 'code': m.group(2).strip(), 'pos': centre(i)})
    return out
def code_items(p):
    return [(i['s'].strip(), centre(i)) for i in IT[str(p)] if i['x'] < 780 and re.match(r'^(\d{4}[A-Z/]{2,7}( OBS)?|\d{3}csd|2/\d{3}csd|2/\d{3}|870|720|820|1200|2448 SSSF|2448 PANELIFT DOOR|0418LW/3|0924LW/4|720 2700)$', i['s'].strip())]
def fit(src, dst):
    # similarity without rotation: dst = s*src + t
    A = np.array(src); B = np.array(dst)
    sa = A - A.mean(0); sb = B - B.mean(0)
    s = (sa * sb).sum() / (sa * sa).sum()
    t = B.mean(0) - s * A.mean(0)
    res = np.linalg.norm(s * A + t - B, axis=1)
    return s, t, res
def map_sheet(src_page, dst_page):
    tags = plan_tags(src_page); codes = code_items(dst_page)
    pairs = []
    for tg in tags:
        c = tg['code'].replace(' OBS', '')
        cand = [pos for s, pos in codes if s.replace(' OBS', '') == c]
        if len(cand) == 1: pairs.append((tg['pos'], cand[0], tg['tag']))
    s, t, res = fit([p[0] for p in pairs], [p[1] for p in pairs])
    print(f'sheet {src_page}->{dst_page}: scale {s:.4f} shift ({t[0]:.1f},{t[1]:.1f}) from {len(pairs)} unique codes; residuals: ' + ', '.join(f'{p[2]}={r:.1f}' for p, r in zip(pairs, res)))
    used = set(); out = []
    for tg in tags:
        mx, my = s * tg['pos'][0] + t[0], s * tg['pos'][1] + t[1]
        c = tg['code'].replace(' OBS', '')
        best = None
        for k, (sc, pos) in enumerate(codes):
            if sc.replace(' OBS', '') != c or k in used: continue
            d = math.hypot(pos[0] - mx, pos[1] - my)
            if d < 45 and (best is None or d < best[0]): best = (d, k, pos)
        if best: used.add(best[1]); out.append({**tg, 'x': best[2][0], 'y': best[2][1], 'snap': round(best[0], 1)})
        else: out.append({**tg, 'x': mx, 'y': my, 'snap': None})
    return out
def rooms_near(rooms, x, y, tol_mm=450):
    P = Point(x * MM, y * MM); res = []
    for r in rooms:
        if not r['names'] and r['area_m2'] < 2: continue
        g = Polygon([(px * MM, py * MM) for px, py in r['pts_pt']])
        d = 0 if g.contains(P) else g.exterior.distance(P)
        if d <= tol_mm: res.append((d, r))
    res.sort(key=lambda z: z[0]); return res
NAMES = {}
def rname(r, page):
    key = (page, tuple(r['centroid_pt']))
    return NAMES.get(key) or '/'.join(r['names']) or f"?{r['bbox_mm'][0]}x{r['bbox_mm'][1]}"
allout = {}
for src, dst, rooms in ((9, 4, R4), (10, 5, R5)):
    mapped = map_sheet(src, dst); allout[dst] = mapped
    print(f'--- sheet {dst} ---')
    for m in sorted(mapped, key=lambda z: (z['tag'][0], int(re.sub(r"\D", "", z['tag'])))):
        near = rooms_near(rooms, m['x'], m['y'])
        print(f"  {m['tag']:4s} {m['code']:20s} at ({m['x']:.0f},{m['y']:.0f}) snap={m['snap']}  rooms: " + ', '.join(f"{rname(r, dst)}({d:.0f}mm)" for d, r in near[:3]))
json.dump(allout, open('kalinda/tagmap.json', 'w'))
