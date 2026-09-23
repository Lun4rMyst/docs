# Offline tools

Python helpers used while developing the room finder and the takeoffs. They need `shapely`, `numpy` and `Pillow`, and the `vec<page>.json` / `items.json` files made by `../tests/vectors.js` and `../tests/items.js`. Run them from `../tests/jobs/` so the job folder names resolve.

- `pipeline.py <job.json>` — wall fills (and optionally wall face strokes) → sealed openings → enclosed holes as rooms. Writes `<job>/rooms<page>.json` and `<job>/img/rooms<page>.png`. This is the reference implementation that `../js/walls.js` ports.
- `rooms.py` — the earlier Kalinda-only version (no curved-strip rule); produced the Kalinda references.
- `dbg_crop.py <job.json> <page> x0 y0 x1 y1 <out.png>` — gridded crop of a page's fills for placing plug and erase boxes.
- `overlay.py` — draws the Daisy rooms over a rendered sheet and prints the totals table.
- `doors.py`, `doors_job.py` — door and window tags matched to openings and rooms (tagmap).
- `build_project.py`, `build_project_poi.py` — assemble a takeoff project file from the room and tag references.
- `make_sample.py` — generates the small sample plan PDF embedded in the app.
