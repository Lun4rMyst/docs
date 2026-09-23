"""Gridded debug crop: python3 dbg_crop.py <job.json> <page> x0 y0 x1 y1 <out.png>  (pt coords)"""
import json, sys, math
from PIL import Image, ImageDraw
sys.argv, args = sys.argv[:2], sys.argv[2:]
exec(open('pipeline.py').read().split('for pg in JOB')[0])   # reuse loaders
page = int(args[0]); x0, y0, x1, y1 = map(float, args[1:5]); out = args[5]
d, polys = load_walls(page)
rooms = json.load(open(f'{D}/rooms{page}.json'))['rooms']
sc = 8.0
im = Image.new('RGB', (int((x1 - x0) * sc), int((y1 - y0) * sc)), 'white'); dr = ImageDraw.Draw(im)
def T(x, y): return ((x - x0) * sc, (y - y0) * sc)
cols = ['#9ecae1', '#a1d99b', '#fdae6b', '#bcbddc', '#fdd0a2', '#c7e9c0', '#dadaeb', '#fee6ce', '#e7ba52', '#e7969c']
for i, r in enumerate(rooms): dr.polygon([T(x, y) for x, y in r['pts_pt']], fill=cols[i % len(cols)])
for p in polys:
    for g in geoms(p): dr.polygon([T(x / MM, y / MM) for x, y in g.exterior.coords], fill='black')
for (bx0, by0, bx1, by1) in JOB.get('manual_plugs', {}).get(str(page), []): dr.rectangle([T(bx0, by0), T(bx1, by1)], outline='red', width=3)
for gx in range(int(math.ceil(x0 / 10)) * 10, int(x1) + 1, 10):
    dr.line([T(gx, y0), T(gx, y1)], fill='#2b8cbe' if gx % 50 == 0 else '#c6dbef', width=1); dr.text((T(gx, y0)[0] + 2, 2), str(gx), fill='blue')
for gy in range(int(math.ceil(y0 / 10)) * 10, int(y1) + 1, 10):
    dr.line([T(x0, gy), T(x1, gy)], fill='#2b8cbe' if gy % 50 == 0 else '#c6dbef', width=1); dr.text((2, T(x0, gy)[1] + 2), str(gy), fill='blue')
for it in items(page):
    if x0 <= it['x'] <= x1 and y0 <= it['y'] <= y1: dr.text(T(it['x'], it['y'] - it['fs']), it['s'], fill='#d62728')
im.save(out); print('wrote', out, im.size)
