"""Room polygons from a Revit-style PDF floor plan: wall fills -> sealed openings -> enclosed holes.
Usage: python3 pipeline.py <job.json>   (job config: dir, pages, items, code_widths, room_re, manual_plugs)"""
import json, re, math, sys
from shapely.geometry import Polygon, Point, box
from shapely.ops import unary_union
from PIL import Image, ImageDraw
MM = 25.4 / 72 * 100
JOB = json.load(open(sys.argv[1]))
D = JOB['dir']; ITEMS = json.load(open(f"{D}/items.json"))
ROOM_RE = re.compile(JOB['room_re'], re.I)
CODE_W = JOB['code_widths']
def geoms(g): return [x for x in (g.geoms if hasattr(g, 'geoms') else [g]) if not x.is_empty]
def sides(g):
    c = list(g.minimum_rotated_rectangle.exterior.coords); a, b = math.dist(c[0], c[1]), math.dist(c[1], c[2]); return min(a, b), max(a, b)
def load_walls(page):
    d = json.load(open(f"{D}/vec{page}.json")); polys = []
    for s in d['shapes']:
        if s['t'] != 'fill' or s['c'] != [0, 0, 0]: continue
        pts = [(x * MM, y * MM) for x, y in s['pts']]
        if len(pts) < 4: continue
        p = Polygon(pts)
        if not p.is_valid: p = p.buffer(0)
        if p.is_empty or p.area <= 0: continue
        mn, mx = sides(p); mrr_area = p.minimum_rotated_rectangle.area
        if mn > 400 and p.area > 0.05e6: continue                  # solid blobs
        if mx < 300: continue                                        # symbols
        if p.area < 0.8 * mrr_area and not (mn <= 400 and mx >= JOB.get('curved_min_len', 1500)): continue   # short curved strips (door arcs)
        polys.append(p)
    if JOB.get('stroke_walls'):
        polys += stroke_walls(d, JOB['stroke_walls'])
    erase = [box(bx0 * MM, by0 * MM, bx1 * MM, by1 * MM) for (bx0, by0, bx1, by1) in JOB.get('erase', {}).get(str(page), [])]
    if erase:
        E = unary_union(erase); polys = [q for p in polys for q in geoms(p.difference(E))]      # drop section markers etc. drawn as thick bars
    return d, polys
def fit_circle(pts):
    import numpy as np
    A = np.array([[2 * x, 2 * y, 1] for x, y in pts]); b = np.array([x * x + y * y for x, y in pts])
    try: cx, cy, c = np.linalg.lstsq(A, b, rcond=None)[0]
    except Exception: return None, None
    r = math.sqrt(max(c + cx * cx + cy * cy, 0)); return (cx, cy), r
def stroke_walls(d, opt):
    from shapely.geometry import LineString
    minw, band = opt.get('min_width', 0.4), opt.get('band_mm', 45)
    segs = []
    for s in d['shapes']:
        if s['t'] != 'stroke' or s['c'] != [0, 0, 0] or s.get('w', 0) < minw: continue
        pts = [(x * MM, y * MM) for x, y in s['pts']]
        if len(pts) < 2: continue
        L = sum(math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1))
        if L < 20: continue
        segs.append(pts)
    # chain short pieces end to end (within 2 mm) to recover arcs / curved walls
    def key(pt): return (round(pt[0] / 2), round(pt[1] / 2))
    ends = {}
    for i, pts in enumerate(segs):
        for e in (pts[0], pts[-1]): ends.setdefault(key(e), []).append(i)
    used = [False] * len(segs); chains = []
    for i in range(len(segs)):
        if used[i]: continue
        used[i] = True; chain = list(segs[i])
        for direction in (1, -1):
            while True:
                end = chain[-1] if direction == 1 else chain[0]
                nxt = [j for j in ends.get(key(end), []) if not used[j]]
                if len(nxt) != 1: break
                j = nxt[0]; used[j] = True; q = list(segs[j])
                if key(q[-1]) == key(end): q.reverse()
                if direction == 1: chain += q[1:]
                else: chain = q[::-1][:-1] + chain if key(q[0]) == key(end) else list(reversed(q))[:-1] + chain
        chains.append(chain)
    out = []; arcs = 0
    for ch in chains:
        L = sum(math.dist(ch[i], ch[i + 1]) for i in range(len(ch) - 1))
        if len(ch) >= 4:
            c, r = fit_circle(ch)
            if r and opt.get('arc_r_min', 450) <= r <= opt.get('arc_r_max', 1400):
                sweep = math.degrees(L / r)
                if 55 <= sweep <= 110: arcs += 1; continue          # a door swing, not a wall
        if L < opt.get('min_len', 150): continue
        out.append(LineString(ch).buffer(band, cap_style=2, join_style=2))
    print(f'  strokes: {len(segs)} thick pieces -> {len(chains)} chains, {arcs} door arcs dropped, {len(out)} wall lines kept')
    return out
def items(page): return [it for it in ITEMS[str(page)] if it['x'] < JOB.get('max_x', 780)]
def centre(it): return ((it['x'] + it['w'] / 2) * MM, (it['y'] - it['fs'] * 0.35) * MM)
def labels(page): return [(it['s'].lower(), *centre(it)) for it in items(page) if ROOM_RE.match(it['s'].strip())]
def openings(page):
    out = []
    for it in items(page):
        s = re.sub(r'\s+OBS$', '', it['s'].strip())
        if s in CODE_W: out.append((s, CODE_W[s], *centre(it)))
    return out
def plugs_from(walls, src, radius, clip=None, max_thick=330, max_area=None):
    closed = src.buffer(radius, join_style=2).buffer(-radius, join_style=2)
    extra = closed.difference(walls)
    if clip is not None: extra = extra.intersection(clip)
    return [g for g in geoms(extra) if g.area > 200 and (sides(g)[0] <= max_thick or (max_area and g.area <= max_area))]
def extract(page):
    d, polys = load_walls(page)
    walls = unary_union([q.buffer(20, join_style=2) for q in polys])
    plugs = plugs_from(walls, walls, 700, max_thick=650, max_area=0.35e6)
    for code, w, x, y in openings(page):
        P = Point(x, y); r = w / 2 + 250
        plugs += plugs_from(walls, walls.intersection(P.buffer(r + 2500)), r, clip=P.buffer(r + 900), max_thick=330)
    for (bx0, by0, bx1, by1) in JOB.get('manual_plugs', {}).get(str(page), []): plugs.append(box(bx0 * MM, by0 * MM, bx1 * MM, by1 * MM))
    sealed = unary_union([walls] + plugs)
    labs = labels(page); rooms = []
    for comp in geoms(sealed):
        for ring in comp.interiors:
            g = Polygon(ring).buffer(20, join_style=2)
            if g.area < 0.5e6: continue
            if JOB.get('stroke_walls'):
                cl = JOB['stroke_walls'].get('closing_mm', 60); g = g.buffer(cl, join_style=2).buffer(-cl, join_style=2)      # fill slits left by door leaf lines (keep < half of thinnest wall + swell)
                if g.is_empty or sides(g)[0] < 350: continue                    # cavity between wall face lines
            g = g.simplify(15, preserve_topology=True)
            if g.centroid.x / MM > JOB.get('skip_x_over', 1e9): continue                  # title block
            names = [l[0] for l in labs if g.contains(Point(l[1], l[2]))]
            b = g.bounds
            rooms.append({'names': names, 'area_m2': round(g.area / 1e6, 2), 'perim_m': round(g.length / 1000, 2), 'ext_m': round(g.exterior.length / 1000, 2), 'holes_m': [round(h.length / 1000, 2) for h in g.interiors], 'holes': [{'bbox_pt': [round(v / MM, 1) for v in Polygon(h).bounds], 'len_m': round(h.length / 1000, 2)} for h in g.interiors], 'bbox_mm': [round(b[2] - b[0]), round(b[3] - b[1])],
                          'pts_pt': [[round(x / MM, 2), round(y / MM, 2)] for x, y in list(g.exterior.coords)[:-1]], 'centroid_pt': [round(g.centroid.x / MM, 1), round(g.centroid.y / MM, 1)]})
    rooms.sort(key=lambda r: (r['centroid_pt'][1] // 60, r['centroid_pt'][0]))
    W, H = d['width'], d['height']; sc = 2.0
    im = Image.new('RGB', (int(W * sc), int(H * sc)), 'white'); dr = ImageDraw.Draw(im)
    cols = ['#9ecae1', '#a1d99b', '#fdae6b', '#bcbddc', '#fdd0a2', '#c7e9c0', '#dadaeb', '#fee6ce', '#e7ba52', '#e7969c', '#b5cf6b', '#ce6dbd', '#de9ed6', '#9c9ede', '#cedb9c', '#e7cb94', '#a55194', '#8c6d31', '#6baed6', '#74c476']
    for i, r in enumerate(rooms): dr.polygon([(x * sc, y * sc) for x, y in r['pts_pt']], fill=cols[i % len(cols)], outline='black')
    for g in plugs: dr.polygon([(x / MM * sc, y / MM * sc) for x, y in g.exterior.coords], fill='#d62728')
    for p in polys: dr.polygon([(x / MM * sc, y / MM * sc) for x, y in p.exterior.coords], fill='black')
    for i, r in enumerate(rooms):
        cx, cy = r['centroid_pt']; dr.text((cx * sc - 20, cy * sc - 5), f"{i}:{'/'.join(r['names']) or '?'} {r['perim_m']}m", fill='red')
    im.save(f'{D}/img/rooms{page}.png'); json.dump({'page': page, 'rooms': rooms}, open(f'{D}/rooms{page}.json', 'w'))
    print(f'page {page}: {len(polys)} wall fills, {len(plugs)} plugs, {len(rooms)} rooms')
    for i, r in enumerate(rooms):
        print(f"  {i:2d} {('/'.join(r['names']) or '?'):22s} area {r['area_m2']:6.2f} m2  perim {r['perim_m']:6.2f} m  bbox {r['bbox_mm'][0]}x{r['bbox_mm'][1]}  at {r['centroid_pt']}  verts {len(r['pts_pt'])}")
    unl = [l[0] for l in labs if not any(l[0] in r['names'] for r in rooms)]
    if unl: print('  labels in no room:', unl)
for pg in JOB['pages']: extract(pg)
