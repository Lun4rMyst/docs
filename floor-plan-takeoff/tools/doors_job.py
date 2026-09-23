import json, re, math, sys
import numpy as np
from shapely.geometry import Polygon, Point
MM = 25.4 / 72 * 100
JOB = json.load(open(sys.argv[1])); D = JOB['dir']
IT = json.load(open(f'{D}/items.json'))
def centre(i): return (i['x'] + i['w'] / 2, i['y'] - i['fs'] * 0.35)
def plan_tags(p):
    out = []
    for i in IT[str(p)]:
        m = re.match(r'^([DW]\d{1,2})\s+(.+)$', i['s'])
        if m and i['x'] > 120: out.append({'tag': m.group(1), 'code': m.group(2).strip(), 'pos': centre(i)})
    return out
CODE_RE = re.compile(r'^(\d{4}[A-Za-z/() ]{2,16}|\d{3,4}csd|2/\d{3}(csd)?|870|720|820|620|1200|2\d{3} \w+|820 1400h)$')
def code_items(p): return [(re.sub(r'\s+OBS$', '', i['s'].strip()), centre(i)) for i in IT[str(p)] if i['x'] < JOB.get('max_x', 780) and CODE_RE.match(re.sub(r'\s+OBS$', '', i['s'].strip()))]
def fit(src, dst):
    A = np.array(src); B = np.array(dst); sa = A - A.mean(0); sb = B - B.mean(0)
    s = (sa * sb).sum() / (sa * sa).sum(); t = B.mean(0) - s * A.mean(0)
    return s, t, np.linalg.norm(s * A + t - B, axis=1)
def map_sheet(src, dst):
    tags = plan_tags(src); codes = code_items(dst); pairs = []
    for tg in tags:
        c = re.sub(r'\s+OBS$', '', tg['code']); cand = [pos for s, pos in codes if s == c]
        if len(cand) == 1: pairs.append((tg['pos'], cand[0], tg['tag']))
    s, t, res = fit([p[0] for p in pairs], [p[1] for p in pairs])
    print(f'sheet {src}->{dst}: scale {s:.4f} shift ({t[0]:.1f},{t[1]:.1f}) from {len(pairs)} unique codes, max residual {res.max():.1f} pt')
    used = set(); out = []
    for tg in tags:
        mx, my = s * tg['pos'][0] + t[0], s * tg['pos'][1] + t[1]; c = re.sub(r'\s+OBS$', '', tg['code']); best = None
        for k, (sc, pos) in enumerate(codes):
            if sc != c or k in used: continue
            dd = math.hypot(pos[0] - mx, pos[1] - my)
            if dd < 45 and (best is None or dd < best[0]): best = (dd, k, pos)
        if best: used.add(best[1]); out.append({**tg, 'x': best[2][0], 'y': best[2][1], 'snap': round(best[0], 1)})
        else: out.append({**tg, 'x': mx, 'y': my, 'snap': None})
    return out
def rooms_near(rooms, x, y, tol_mm=450):
    P = Point(x * MM, y * MM); res = []
    for r in rooms:
        g = Polygon([(px * MM, py * MM) for px, py in r['pts_pt']]); d = 0 if g.contains(P) else g.exterior.distance(P)
        if d <= tol_mm: res.append((d, '/'.join(r['names']) or f"?{r['bbox_mm'][0]}x{r['bbox_mm'][1]}"))
    res.sort(); return res
allout = {}
for src, dst in JOB['tag_sheets'].items():
    rooms = json.load(open(f'{D}/rooms{dst}.json'))['rooms']
    mapped = map_sheet(int(src), dst); allout[dst] = mapped
    print(f'--- sheet {dst} ---')
    for m in sorted(mapped, key=lambda z: (z['tag'][0], int(re.sub(r'\D', '', z['tag'])))):
        near = rooms_near(rooms, m['x'], m['y'])
        print(f"  {m['tag']:4s} {m['code']:20s} at ({m['x']:.0f},{m['y']:.0f}) snap={m['snap']}  rooms: " + ', '.join(f'{n}({d:.0f})' for d, n in near[:3]))
json.dump(allout, open(f'{D}/tagmap.json', 'w'))
