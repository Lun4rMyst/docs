import json
from PIL import Image, ImageDraw, ImageFont
R = json.load(open('daisy/rooms4.json'))['rooms']
im = Image.open('daisy/img/p4-2x.png').convert('RGBA'); sc = 2.0
ov = Image.new('RGBA', im.size, (0, 0, 0, 0)); dr = ImageDraw.Draw(ov)
cols = [(31,119,180),(255,127,14),(44,160,44),(214,39,40),(148,103,189),(140,86,75),(227,119,194),(127,127,127),(188,189,34),(23,190,207),(255,187,120),(152,223,138),(255,152,150),(197,176,213),(196,156,148),(247,182,210),(219,219,141)]
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 22); small = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 18)
for i, r in enumerate(R):
    c = cols[i % len(cols)]; pts = [(x * sc, y * sc) for x, y in r['pts_pt']]
    dr.polygon(pts, fill=c + (90,), outline=c + (255,), width=3)
out = Image.alpha_composite(im, ov); d2 = ImageDraw.Draw(out)
for i, r in enumerate(R):
    c = cols[i % len(cols)]; cx, cy = r['centroid_pt']; nm = '/'.join(n for n in r['names'] if n != 'robe') or 'unnamed'
    if 'kitchen' in r['names']: nm = 'kitchen/entry/living/dining + hall'
    L = nm; s2 = f"{r['bbox_mm'][0]} x {r['bbox_mm'][1]}  {r['area_m2']} m2  {r['perim_m']} m" if len(r['pts_pt']) <= 8 else f"{r['area_m2']} m2  {r['perim_m']} m"
    w = max(d2.textlength(L, font=font), d2.textlength(s2, font=small)) + 12
    x0, y0 = cx * sc - w / 2, cy * sc - 26
    d2.rectangle([x0, y0, x0 + w, y0 + 50], fill=(255, 255, 255, 230), outline=c, width=2)
    d2.text((x0 + 6, y0 + 2), L, fill=(0, 0, 0), font=font); d2.text((x0 + 6, y0 + 27), s2, fill=(60, 60, 60), font=small)
J = json.load(open('daisy/job.json'))
for (bx0, by0, bx1, by1) in J['manual_plugs']['4']: d2.rectangle([bx0 * sc, by0 * sc - 6, bx1 * sc, by1 * sc + 6], outline=(214, 39, 40), width=4)
out = out.crop((int(40 * sc), int(270 * sc), int(1000 * sc), int(620 * sc)))
out.convert('RGB').save('daisy/img/daisy-rooms.png')
tot = sum(r['area_m2'] for r in R); gar = sum(r['area_m2'] for r in R if 'garage' in r['names']); house = tot - gar
print(f"rooms {len(R)}  house {house:.2f} m2 (plan 224.76)  garage {gar:.2f} m2 (plan 43.13)  total {tot:.2f} m2 (plan 267.89)  = {tot/267.89*100:.1f}%")
for r in R: print(f"  {('/'.join(r['names']) or 'unnamed'):34s} {r['bbox_mm'][0]:5d} x {r['bbox_mm'][1]:5d}  {r['area_m2']:6.2f} m2  {r['perim_m']:6.2f} m")
