import json, re, math
from shapely.geometry import Polygon, MultiPolygon, Point
from shapely.ops import unary_union
from PIL import Image, ImageDraw
MM = 25.4 / 72 * 100
ROOM_RE = re.compile(r"^(bed \d|wir|ens \d|bath|ldry|rumpus|linen|store|lounge|gym|garage|living|dining|kit|butlers|pdr|wc|balcony|alfresco|patio|entertainment|porch)$", re.I)
ITEMS = json.load(open('kalinda/items.json'))
MANUAL_PLUGS = {5: [(448.5, 591.3, 508.6, 595.9)]}   # kitchen/butlers joinery line (no wall drawn): x0,y0,x1,y1 in pt
# wall opening widths by the code printed on the plan (from the door and window schedules, sheets 09 and 10)
CODE_W = {'2424OXSD': 2410, '2436OXXSD': 3582, '2424XOSD': 2410, '2424RD': 2410, '2448OXXOSD': 4782, '2448 SSSF': 4800, '2448 PANELIFT DOOR': 4860,
          '0921OXXOSW': 2110, '1224OXXOSW': 2410, '1227OXXOSW': 2710, '0915XOSW': 1510, '0624OXXOSW': 2410, '2109DH': 910, '2106FG': 610, '0624XOXSW': 2410,
          '1221OXXOSW': 2110, '0418LW/3': 1784, '2130OXXOSW': 3010, '0924LW/4': 2400, '1218OXXOSW': 1810, '0909OXSW': 910,
          '870': 925, '720': 770, '820': 875, '1200': 1250, '2/420': 840, '2/520': 1040, '720csd': 1440, '870csd': 1740, '2/820csd': 3280}

def geoms(g): return [x for x in (g.geoms if hasattr(g, 'geoms') else [g]) if not x.is_empty]
def min_side(g):
    c = list(g.minimum_rotated_rectangle.exterior.coords)
    return min(math.dist(c[0], c[1]), math.dist(c[1], c[2]))
def load_walls(page):
    d = json.load(open(f'kalinda/vec{page}.json')); polys = []
    for s in d['shapes']:
        if s['t'] != 'fill' or s['c'] != [0, 0, 0]: continue
        pts = [(x * MM, y * MM) for x, y in s['pts']]
        if len(pts) < 4: continue
        p = Polygon(pts)
        if not p.is_valid: p = p.buffer(0)
        if p.is_empty or p.area <= 0: continue
        mrr = p.minimum_rotated_rectangle
        c = list(mrr.exterior.coords); a, b = math.dist(c[0], c[1]), math.dist(c[1], c[2])
        if min(a, b) > 400 and p.area > 0.05e6: continue          # solid blobs (arrows, boxes)
        if max(a, b) < 300: continue                               # symbols (smoke alarms, lights)
        if p.area < 0.8 * mrr.area: continue                        # curved strips (door swing arcs)
        polys.append(p)
    return d, polys
def items(page): return [it for it in ITEMS[str(page)] if it['x'] < 780]
def centre(it): return ((it['x'] + it['w'] / 2) * MM, (it['y'] - it['fs'] * 0.35) * MM)
def labels(page): return [(it['s'].lower(), *centre(it)) for it in items(page) if ROOM_RE.match(it['s'])]
def openings(page):
    out = []
    for it in items(page):
        s = it['s'].strip()
        if s in CODE_W: out.append((s, CODE_W[s], *centre(it)))
    return out
def plugs_from(walls, src, radius, clip=None, max_thick=330, max_area=None):
    closed = src.buffer(radius, join_style=2).buffer(-radius, join_style=2)
    extra = closed.difference(walls)
    if clip is not None: extra = extra.intersection(clip)
    return [g for g in geoms(extra) if g.area > 200 and (min_side(g) <= max_thick or (max_area and g.area <= max_area))]

def extract(page):
    d, polys = load_walls(page)
    walls = unary_union([q.buffer(20, join_style=2) for q in polys])          # 20 mm swell closes hairline gaps; rooms are swelled back below
    plugs = plugs_from(walls, walls, 700, max_thick=650, max_area=0.35e6)
    from shapely.geometry import box as _box
    for (bx0, by0, bx1, by1) in MANUAL_PLUGS.get(page, []): plugs.append(_box(bx0 * MM, by0 * MM, bx1 * MM, by1 * MM))          # swing doors, small cupboards, corners
    for code, w, x, y in openings(page):                                          # every scheduled opening, sealed locally
        P = Point(x, y); r = w / 2 + 250
        plugs += plugs_from(walls, walls.intersection(P.buffer(r + 2500)), r, clip=P.buffer(r + 900), max_thick=330)
    sealed = unary_union([walls] + plugs)
    labs = labels(page); rooms = []
    for comp in geoms(sealed):
        for ring in comp.interiors:
            g = Polygon(ring).buffer(20, join_style=2)
            if g.area < 0.5e6: continue
            g = g.simplify(15, preserve_topology=True)
            names = [l[0] for l in labs if g.contains(Point(l[1], l[2]))]
            b = g.bounds
            rooms.append({'names': names, 'area_m2': round(g.area / 1e6, 2), 'perim_m': round(g.length / 1000, 2), 'bbox_mm': [round(b[2] - b[0]), round(b[3] - b[1])],
                          'pts_pt': [[round(x / MM, 2), round(y / MM, 2)] for x, y in list(g.exterior.coords)[:-1]], 'centroid_pt': [round(g.centroid.x / MM, 1), round(g.centroid.y / MM, 1)]})
    rooms.sort(key=lambda r: (r['centroid_pt'][1] // 60, r['centroid_pt'][0]))
    W, H = d['width'], d['height']; sc = 2.0
    im = Image.new('RGB', (int(W * sc), int(H * sc)), 'white'); dr = ImageDraw.Draw(im)
    cols = ['#9ecae1', '#a1d99b', '#fdae6b', '#bcbddc', '#fdd0a2', '#c7e9c0', '#dadaeb', '#fee6ce', '#e7ba52', '#e7969c', '#b5cf6b', '#ce6dbd', '#de9ed6', '#9c9ede', '#cedb9c', '#e7cb94', '#a55194', '#8c6d31']
    for i, r in enumerate(rooms): dr.polygon([(x * sc, y * sc) for x, y in r['pts_pt']], fill=cols[i % len(cols)], outline='black')
    for g in plugs: dr.polygon([(x / MM * sc, y / MM * sc) for x, y in g.exterior.coords], fill='#d62728')
    for p in polys: dr.polygon([(x / MM * sc, y / MM * sc) for x, y in p.exterior.coords], fill='black')
    for i, r in enumerate(rooms):
        cx, cy = r['centroid_pt']; dr.text((cx * sc - 20, cy * sc - 5), f"{i}:{'/'.join(r['names']) or '?'} {r['perim_m']}m", fill='red')
    im.save(f'kalinda/img/rooms{page}.png'); json.dump({'page': page, 'rooms': rooms}, open(f'kalinda/rooms{page}.json', 'w'))
    print(f'page {page}: {len(polys)} wall fills, {len(plugs)} plugs, {len(rooms)} rooms')
    for i, r in enumerate(rooms):
        print(f"  {i:2d} {('/'.join(r['names']) or '?'):22s} area {r['area_m2']:6.2f} m2  perim {r['perim_m']:6.2f} m  bbox {r['bbox_mm'][0]}x{r['bbox_mm'][1]}  at {r['centroid_pt']}  verts {len(r['pts_pt'])}")
    unl = [l[0] for l in labs if not any(l[0] in r['names'] for r in rooms)]
    if unl: print('  labels in no room:', unl)
for pg in (4, 5): extract(pg)
