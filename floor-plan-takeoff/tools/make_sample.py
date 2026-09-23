#!/usr/bin/env python3
"""Generate a small vector floor-plan PDF (A3 landscape, 1:100) for demos and tests.
Hand-built PDF, no dependencies."""
import zlib, sys

PT = 72 / 25.4          # points per mm (paper)
SC = PT * 10            # points per metre at 1:100 (10 mm paper per metre)
W, H = 1190.55, 841.89  # A3 landscape
OX, OY = 170.0, 150.0   # house origin (bottom-left) on the page

ops = []
def mv(x, y): ops.append(f"{x:.2f} {y:.2f} m")
def ln(x, y): ops.append(f"{x:.2f} {y:.2f} l")
def stroke(): ops.append("S")
def width(w): ops.append(f"{w:.2f} w")
def gray(g): ops.append(f"{g:.2f} G")
def rect(x, y, w, h): ops.append(f"{x:.2f} {y:.2f} {w:.2f} {h:.2f} re")
def text(x, y, s, size=9, bold=False):
    s = s.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
    ops.append(f"BT /{'F2' if bold else 'F1'} {size} Tf {x:.2f} {y:.2f} Td ({s}) Tj ET")
def X(m): return OX + m * SC
def Y(m): return OY + m * SC
def wall(x1, y1, x2, y2, w=2.0):
    width(w); mv(X(x1), Y(y1)); ln(X(x2), Y(y2)); stroke()

# ---- rooms (x, y, w, h in metres, label, dims text) ----
rooms = [
    (0.0, 0.0, 5.8, 6.0, "GARAGE",  "5.8 x 6.0"),
    (5.8, 0.0, 2.2, 4.0, "ENTRY",   "2.2 x 4.0"),
    (8.0, 0.0, 3.6, 4.0, "BED 1",   "3.6 x 4.0"),
    (11.6, 0.0, 2.4, 2.2, "ENS",    "2.4 x 2.2"),
    (11.6, 2.2, 2.4, 1.8, "WIR",    "2.4 x 1.8"),
    (5.8, 4.0, 4.6, 5.0, "LIVING",  "4.6 x 5.0"),
    (10.4, 4.0, 3.6, 3.0, "KITCHEN","3.6 x 3.0"),
    (10.4, 7.0, 3.6, 2.0, "MEALS",  "3.6 x 2.0"),
    (0.0, 6.0, 2.4, 3.0, "LAUNDRY", "2.4 x 3.0"),
    (2.4, 6.0, 3.4, 3.0, "BED 2",   "3.4 x 3.0"),
]
gray(0.0)
# external outline (thick)
width(6.0); rect(X(0), Y(0), 14 * SC, 9 * SC); stroke()
# internal walls
gray(0.15)
wall(5.8, 0, 5.8, 9)
wall(8.0, 0, 8.0, 4)
wall(11.6, 0, 11.6, 4)
wall(5.8, 4, 14, 4)
wall(10.4, 4, 10.4, 9)
wall(10.4, 7, 14, 7)
wall(11.6, 2.2, 14, 2.2)
wall(0, 6, 5.8, 6)
wall(2.4, 6, 2.4, 9)

# room labels and sizes
for (x, y, w, h, name, dims) in rooms:
    cx, cy = X(x + w / 2), Y(y + h / 2)
    tw = len(name) * 5.6
    text(cx - tw / 2, cy + 3, name, 10, True)
    text(cx - len(dims) * 2.6, cy - 9, dims, 8)

# ---- doors: (tag, x, y in m, orientation 'h' = opening runs along x, width m) ----
doors = [
    ("D01", 6.9, 0.0, "h", 0.92),   # entry
    ("D02", 5.8, 2.0, "v", 0.82),   # garage -> entry
    ("D03", 8.0, 2.0, "v", 0.82),   # entry -> bed 1
    ("D04", 11.6, 1.1, "v", 0.72),  # bed 1 -> ens (cavity)
    ("D05", 11.6, 3.1, "v", 0.72),  # bed 1 -> wir
    ("D06", 6.9, 4.0, "h", 1.20),   # entry -> living (cased opening)
    ("D07", 5.8, 7.5, "v", 0.82),   # living -> bed 2
    ("D08", 1.2, 6.0, "h", 0.82),   # laundry -> garage
    ("D09", 0.0, 7.5, "v", 0.82),   # laundry external
    ("D10", 14.0, 8.0, "v", 2.40),  # meals sliding (alum)
]
def door(tag, x, y, o, w):
    # white-out the wall opening, draw leaf + arc-ish swing
    ops.append("q 1 g 1 G")
    width(8.0)
    if o == "h":
        mv(X(x - w / 2), Y(y)); ln(X(x + w / 2), Y(y)); stroke()
    else:
        mv(X(x), Y(y - w / 2)); ln(X(x), Y(y + w / 2)); stroke()
    ops.append("Q")
    gray(0.2); width(1.2)
    if o == "h":
        mv(X(x - w / 2), Y(y)); ln(X(x - w / 2), Y(y + w)); stroke()
        # quarter-circle approximation with bezier
        k = 0.5523 * w
        ops.append(f"{X(x - w/2):.2f} {Y(y + w):.2f} m {X(x - w/2 + k):.2f} {Y(y + w):.2f} {X(x + w/2):.2f} {Y(y + k):.2f} {X(x + w/2):.2f} {Y(y):.2f} c S")
        text(X(x) - 8, Y(y) - 14 if y == 0 else Y(y) + 5, tag, 7)
    else:
        mv(X(x), Y(y - w / 2)); ln(X(x + w), Y(y - w / 2)); stroke()
        k = 0.5523 * w
        ops.append(f"{X(x + w):.2f} {Y(y - w/2):.2f} m {X(x + w):.2f} {Y(y - w/2 + k):.2f} {X(x + k):.2f} {Y(y + w/2):.2f} {X(x):.2f} {Y(y + w/2):.2f} c S")
        text(X(x) + 4 if x < 14 else X(x) + 8, Y(y) + w * SC / 2 + 3, tag, 7)
for d in doors: door(*d)

# ---- windows: (tag, x, y, orientation, width m) ----
windows = [
    ("W01", 9.8, 0.0, "h", 1.8), ("W02", 12.8, 0.0, "h", 1.2), ("W03", 8.1, 9.0, "h", 2.4),
    ("W04", 4.1, 9.0, "h", 1.5), ("W05", 1.2, 9.0, "h", 0.9), ("W06", 12.2, 9.0, "h", 1.8),
    ("W07", 14.0, 5.5, "v", 1.8), ("W08", 14.0, 3.1, "v", 0.9),
]
def window(tag, x, y, o, w):
    ops.append("q 1 g 1 G"); width(8.0)
    if o == "h": mv(X(x - w/2), Y(y)); ln(X(x + w/2), Y(y)); stroke()
    else: mv(X(x), Y(y - w/2)); ln(X(x), Y(y + w/2)); stroke()
    ops.append("Q"); gray(0.3); width(0.8)
    if o == "h":
        for dy in (-2.0, 0.0, 2.0):
            mv(X(x - w/2), Y(y) + dy); ln(X(x + w/2), Y(y) + dy); stroke()
        text(X(x) - 8, Y(y) - 16 if y == 0 else Y(y) + 8, tag, 7)
    else:
        for dx in (-2.0, 0.0, 2.0):
            mv(X(x) + dx, Y(y - w/2)); ln(X(x) + dx, Y(y + w/2)); stroke()
        text(X(x) + 8, Y(y) - 3, tag, 7)
for w in windows: window(*w)

# ---- overall dimension strings ----
gray(0.0); width(0.6)
dy = Y(-1.0)
mv(X(0), dy); ln(X(14), dy); stroke()
for xm in (0, 5.8, 8.0, 11.6, 14):
    mv(X(xm), dy - 6); ln(X(xm), dy + 6); stroke()
    mv(X(xm), Y(0) - 4); ln(X(xm), dy - 8); stroke()
for (a, b) in ((0, 5.8), (5.8, 8.0), (8.0, 11.6), (11.6, 14)):
    s = f"{int(round((b - a) * 1000))}"
    text(X((a + b) / 2) - len(s) * 2.2, dy + 4, s, 7)
text(X(7) - 12, dy - 18, "14 000", 8)
dx = X(-1.0)
mv(dx, Y(0)); ln(dx, Y(9)); stroke()
for ym in (0, 4.0, 6.0, 9.0):
    mv(dx - 6, Y(ym)); ln(dx + 6, Y(ym)); stroke()
    mv(X(0) - 4, Y(ym)); ln(dx + 8, Y(ym)); stroke()
for (a, b) in ((0, 4.0), (4.0, 6.0), (6.0, 9.0)):
    s = f"{int(round((b - a) * 1000))}"
    ops.append(f"BT /F1 7 Tf 0 1 -1 0 {dx - 4:.2f} {Y((a + b)/2) - len(s)*2.2:.2f} Tm ({s}) Tj ET")
ops.append(f"BT /F1 8 Tf 0 1 -1 0 {dx - 18:.2f} {Y(4.5) - 12:.2f} Tm (9 000) Tj ET")

# ---- title & schedules ----
text(X(0), Y(9) + 40, "GROUND FLOOR PLAN", 14, True)
text(X(0), Y(9) + 24, "SCALE 1:100 @ A3", 9)
sx, sy = X(15.0), Y(8.6)
text(sx, sy, "DOOR SCHEDULE", 9, True)
rows = [
    ("D01", "2040 x 920", "ENTRY DOOR HINGED"),
    ("D02", "2040 x 820", "HINGED SOLID CORE SELF CLOSING"),
    ("D03", "2040 x 820", "HINGED"),
    ("D04", "2040 x 720", "CAVITY SLIDER"),
    ("D05", "2040 x 720", "HINGED"),
    ("D06", "2040 x 1200", "CASED OPENING"),
    ("D07", "2040 x 820", "HINGED"),
    ("D08", "2040 x 820", "HINGED"),
    ("D09", "2040 x 820", "EXTERNAL HINGED"),
    ("D10", "2100 x 2400", "ALUMINIUM SLIDING DOOR"),
]
for i, (t, s, d) in enumerate(rows):
    yy = sy - 14 * (i + 1)
    text(sx, yy, t, 7); text(sx + 34, yy, s, 7); text(sx + 90, yy, d, 7)
sy2 = sy - 14 * (len(rows) + 2)
text(sx, sy2, "WINDOW SCHEDULE", 9, True)
wrows = [("W01", "1200 x 1800", "SLIDING"), ("W02", "600 x 1200", "AWNING"), ("W03", "1200 x 2400", "SLIDING"),
         ("W04", "1200 x 1500", "SLIDING"), ("W05", "600 x 900", "AWNING"), ("W06", "1200 x 1800", "SLIDING"),
         ("W07", "1200 x 1800", "SLIDING"), ("W08", "600 x 900", "AWNING")]
for i, (t, s, d) in enumerate(wrows):
    yy = sy2 - 14 * (i + 1)
    text(sx, yy, t, 7); text(sx + 34, yy, s, 7); text(sx + 90, yy, d, 7)

# title block
gray(0.0); width(1.0)
rect(W - 330, 30, 300, 70); stroke()
text(W - 320, 80, "SAMPLE RESIDENCE", 11, True)
text(W - 320, 64, "12 EXAMPLE STREET  -  DEMONSTRATION PLAN ONLY", 7)
text(W - 320, 48, "SHEET A-02   GROUND FLOOR PLAN   1:100 @ A3", 7)
text(W - 320, 36, "Sample drawing generated for the Trim & Door Takeoff app", 6)

content = ("\n".join(ops)).encode("latin-1")
comp = content  # uncompressed so the file is plain ASCII

objs = []
objs.append(b"<< /Type /Catalog /Pages 2 0 R >>")
objs.append(b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
objs.append(f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {W} {H}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>".encode())
objs.append(b"<< /Length " + str(len(comp)).encode() + b" >>\nstream\n" + comp + b"\nendstream")
objs.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>")
objs.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>")

out = bytearray(b"%PDF-1.4\n")
offsets = []
for i, o in enumerate(objs, 1):
    offsets.append(len(out))
    out += f"{i} 0 obj\n".encode() + o + b"\nendobj\n"
xref = len(out)
out += f"xref\n0 {len(objs)+1}\n".encode()
out += b"0000000000 65535 f \n"
for off in offsets:
    out += f"{off:010d} 00000 n \n".encode()
out += f"trailer\n<< /Size {len(objs)+1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
path = sys.argv[1] if len(sys.argv) > 1 else "sample-plan.pdf"
open(path, "wb").write(out)
print(path, len(out), "bytes")
