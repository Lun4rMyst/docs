import json, re
R = {3: json.load(open('poi/rooms3.json'))['rooms'], 4: json.load(open('poi/rooms4.json'))['rooms']}
TM = json.load(open('poi/tagmap.json'))
PT_MM = 25.4 / 72
def find(page, *names):
    for r in R[page]:
        if all(n in r['names'] for n in names): return r
    raise KeyError(names)
def room(page, names, name, skirting, notes='', deductions=None, r=None):
    r = r or find(page, *names)
    return {'id': 'r-' + re.sub(r'\W+', '-', name.lower()), 'name': name, 'page': page, 'method': 'trace', 'pts': [{'x': x, 'y': y} for x, y in r['pts_pt']], 'pt': None,
            'length': 0, 'width': 0, 'perimeter': 0, 'skirting': skirting, 'deductions': deductions or [], 'notes': notes, 'src': 'trace'}
rooms = [
    # ground floor (page 3)
    room(3, ['kitchen', 'living'], 'LIVING/DINING/KITCHEN', True,
         'One open-plan run incl. hall and entry: living, dining, kitchen, butlers (open to kitchen), entry, hall, guest-bath lobby, guest robe under stairs. Polished concrete floor. Store cupboard sealed at its doors.',
         [{'label': 'Kitchen benches on butlers wall + window bay (est.)', 'mm': 8000}, {'label': 'Butlers pantry/fridge/linen joinery both sides (est.)', 'mm': 6950},
          {'label': 'Laundry lobby step edge (open, no wall)', 'mm': 1200}]),
    room(3, ['guest bed'], 'GUEST BED', True, 'Polished concrete; robe under stairs is a separate walk-in via 1200 cavity slider'),
    room(3, ['studio'], 'STUDIO', True, 'Polished concrete; 50 step at west edge', [{'label': 'Studio kitchenette (snk/mfs) joinery (est.)', 'mm': 2300}]),
    room(3, ['guest bath'], 'GUEST BATH + WC', False, 'Tiled (pool bathroom); tiled window reveal'),
    room(3, ['pdr'], 'POWDER', False, 'Tiled; accessed off the laundry'),
    room(3, ["l'dry"], 'LAUNDRY + LOBBY', False, 'Tiled; includes the step-down lobby to the garage door'),
    room(3, ['garage'], 'GARAGE', True, 'Skirting to garage; roller door and access door openings deducted'),
    # upper floor (page 4)
    room(4, ['rumpus'], 'RUMPUS / HALL / STUDY', True, 'Open-plan run incl. hall to beds, study nook and bath lobby (archway). Void balustrade is a 1050 high wall: hall-side face taken as equal to the void edge it replaces.'),
    room(4, ['bed 1'], 'BED 1 + WIR', True, 'Bed 1, entry lobby and WIR are one space (WIR opening has no door). Confirm skirting inside WIR behind drawer towers.',
         [{'label': 'Ensuite opening 1360 wide (no door)', 'mm': 1360}]),
    room(4, ['bed 2'], 'BED 2', True, 'Robe recess excluded (vinyl sliding doors)'),
    room(4, ['bed 3'], 'BED 3', True, 'Robe recess excluded (vinyl sliding doors)'),
    room(4, ['bed 4'], 'BED 4', True, 'Robe recess excluded (vinyl sliding doors)'),
    room(4, ['wll'], 'WALK-IN LINEN', True, 'Confirm skirting behind linen shelving'),
    room(4, ['ensuite'], 'ENSUITE', False, 'Tiled; open to bed 1 lobby (1360 opening)'),
    room(4, ['wc'], 'ENSUITE WC', False, 'Tiled', r=[x for x in R[4] if x['names'] == ['wc']][0]),
    room(4, ['main bath'], 'MAIN BATH', False, 'Tiled'),
    room(4, ['wc', 'wc'], 'UPPER WC', False, 'Tiled', r=[x for x in R[4] if x['names'] == ['wc', 'wc']][0]),
]
rid = {r['name']: r['id'] for r in rooms}
OPEN = 'LIVING/DINING/KITCHEN'; HALL = 'RUMPUS / HALL / STUDY'
def pos(page, tag):
    for m in TM[str(page)]:
        if m['tag'] == tag: return m['x'], m['y']
    return None, None
def door(tag, page, typ, w, h, frm, to, arch, leaf, lever='auto', leaves=1, thick=35, fire=False, notes='', qty=1, xy=None, skirt=True):
    x, y = xy or pos(page, tag)
    return {'id': 'd-' + re.sub(r'\W', '', tag), 'tag': tag, 'page': page, 'x': x, 'y': y, 'type': typ, 'height': h, 'width': w, 'thick': thick, 'leaves': leaves, 'hand': '',
            'leaf': leaf, 'colour': '', 'lever': lever, 'archSides': arch, 'skirtDeduct': skirt, 'fire': fire, 'fromRoom': rid.get(frm, ''), 'toRoom': rid.get(to, ''), 'qty': qty, 'notes': notes, 'src': 'schedule'}
HC = 'Painted flush panel hollowcore (Vari 05)'
SC = 'Painted flush panel solid core (Vari 05)'
GJ = 'Aluminium by G.James / Bradnams (by others)'
doors = [
    door('D01', 3, 'extother', 1255, 2400, OPEN, '', 1, 'Aluminium entry door, Bradnams inline pull + smart lock (by others)', 'none', thick=0, notes='Entry door 1200; architrave inside assumed (spec silent): confirm'),
    door('D02', 3, 'extslide', 1810, 2400, 'STUDIO', '', 1, GJ, 'none', notes='2418XOSD to studio; timber reveal + architrave inside'),
    door('D03', 3, 'extother', 925, 2400, 'GUEST BATH + WC', '', 1, 'Aluminium glazed hinged door, G.James (by others)', 'none', thick=0, notes='870 external door from guest (pool) bath vanity passage; tiled room: confirm reveal detail'),
    door('D04', 3, 'extslide', 2410, 2400, 'GUEST BED', '', 1, GJ, 'none', notes='2424XOSD to pool deck'),
    door('D05', 3, 'extslide', 4182, 2400, OPEN, '', 1, GJ, 'none', notes='2442OXXOSD living/dining to alfresco'),
    door('D06', 3, 'extslide', 2410, 2400, OPEN, '', 1, GJ, 'none', notes='2424XOSD kitchen south'),
    door('D07', 3, 'extother', 2710, 2400, 'GARAGE', '', 0, 'Roller door 2427RD, Colorbond Surfmist (by others)', 'none', thick=0, notes='Garage rear roller door; no trim, opening deducted from garage skirting'),
    door('D08', 3, 'extother', 2710, 2400, 'GARAGE', '', 0, 'Roller door 2427RD, Colorbond Surfmist (by others)', 'none', thick=0, notes='Garage front roller door; no trim, opening deducted from garage skirting'),
    door('D09', 3, 'extother', 2710, 2400, 'GARAGE', '', 0, 'Roller door 2427RD, Colorbond Surfmist (by others)', 'none', thick=0, notes='Garage front roller door; no trim, opening deducted from garage skirting'),
    door('D10', 3, 'cavity', 870, 2340, OPEN, 'GARAGE', 2, HC, 'cavity', notes='870csd hall to garage (C55 passage + K36 pulls); confirm any self-closing/solid core requirement'),
    door('D11', 3, 'hinged', 720, 2340, OPEN, '', 1, HC, 'dummy', leaves=2, notes='2/720 GF store cupboard (4 rows shelving); architrave outside only; pair with ball catches/dummy levers: confirm'),
    door('D12', 3, 'cavity', 870, 2340, OPEN, 'GUEST BATH + WC', 2, HC, 'cavity', notes='870csd guest bath (T1 privacy cavity set); pencil stop'),
    door('D13', 3, 'hinged', 870, 2340, OPEN, 'GUEST BED', 2, HC, 'privacy', notes='Guest bed door (privacy per Vari 05)'),
    door('D14', 3, 'cavity', 1200, 2400, 'GUEST BED', OPEN, 2, HC, 'cavity', notes='2400 x 1200 cavity slider to guest robe under stairs (spec); C55 passage + K36 pulls; robe walls measured with the open-plan run'),
    door('D15', 3, 'hinged', 820, 1400, OPEN, '', 0, 'Flush EZI-Jamb concealed door, push to open (spec)', 'none', notes='Reduced-height under-stair store door off living, square set: no architrave; push-to-open catch'),
    door('D16', 3, 'hinged', 820, 2340, 'LAUNDRY + LOBBY', '', 1, HC, 'dummy', leaves=2, notes='2/820 washer/dryer cupboard in laundry; architrave outside only; pair hardware: confirm'),
    door('D17', 3, 'cavity', 720, 2340, 'LAUNDRY + LOBBY', 'POWDER', 2, HC, 'cavity', notes='720csd powder room off laundry (T1 privacy cavity set); pencil stop'),
    door('D18', 3, 'hinged', 820, 2340, OPEN, 'LAUNDRY + LOBBY', 2, HC, 'passage', notes='Laundry door from hall; pencil stop laundry side'),
    door('D19', 3, 'hinged', 870, 2340, 'LAUNDRY + LOBBY', 'GARAGE', 2, HC, 'passage', notes='Garage access door from laundry lobby: schedule shows a plain 870; confirm solid core / self-closer / keyed set'),
    door('D20', 3, 'hinged', 620, 2340, 'STUDIO', '', 1, HC, 'dummy', notes='Studio broom cupboard 620 (2 high shelves); architrave outside only'),
    door('D21', 4, 'extslide', 2410, 2400, HALL, '', 1, GJ, 'none', notes='2424XOSD rumpus to balcony'),
    door('D22', 4, 'extslide', 3582, 2400, 'BED 1 + WIR', '', 1, GJ, 'none', notes='2436XXOSD bed 1 to balcony'),
    door('D23', 4, 'cavity', 720, 2340, HALL, 'MAIN BATH', 2, HC, 'cavity', notes='720csd main bath (Vari 05 swing to cavity for towel rail); T1 privacy cavity set; pencil stop'),
    door('D24', 4, 'hinged', 720, 2340, HALL, 'UPPER WC', 2, HC, 'privacy', notes='Upper WC door; pencil stop'),
    door('D25', 4, 'hinged', 720, 2340, HALL, 'WALK-IN LINEN', 2, HC, 'passage', notes='Walk-in linen door'),
    door('D26', 4, 'hinged', 870, 2340, HALL, 'BED 1 + WIR', 2, SC, 'privacy', fire=False, notes='Bed 1 suite door: solid core upgrade (spec); opens into the lobby shared by WIR and ensuite'),
    door('D27', 4, 'hinged', 720, 2340, 'ENSUITE', 'ENSUITE WC', 2, HC, 'privacy', notes='Ensuite WC door; pencil stop'),
    door('D28', 4, 'hinged', 870, 2340, HALL, 'BED 2', 2, HC, 'privacy', notes='Bed 2 door'),
    door('D29', 4, 'hinged', 870, 2340, HALL, 'BED 3', 2, HC, 'privacy', notes='Bed 3 door'),
    door('D30', 4, 'hinged', 870, 2340, HALL, 'BED 4', 2, HC, 'privacy', notes='Bed 4 door'),
    door('R2', 4, 'robeOthers', 1870, 2100, 'BED 2', '', 1, 'Vinyl sliding robe doors, aluminium frame, mirror centre (by robe supplier)', 'none', thick=0, notes='Bed 2 robe opening 1870 (schedule note 3/820 q/slide: check panel count for this width); architrave to opening', xy=(630.0, 327.0)),
    door('R3', 4, 'robeOthers', 2500, 2100, 'BED 3', '', 1, 'Vinyl sliding robe doors, aluminium frame, mirror centre (by robe supplier)', 'none', thick=0, notes='Bed 3 robe opening 2500 (3/820 q/slide); architrave to opening', xy=(758.0, 327.0)),
    door('R4', 4, 'robeOthers', 2500, 2100, 'BED 4', '', 1, 'Vinyl sliding robe doors, aluminium frame, mirror centre (by robe supplier)', 'none', thick=0, notes='Bed 4 robe opening 2500 (3/820 q/slide); architrave to opening', xy=(863.0, 327.0)),
]
def win(tag, page, h, w, roomname, arch=True, notes='', xy=None):
    x, y = xy or pos(page, tag)
    return {'id': 'w-' + tag, 'tag': tag, 'page': page, 'x': x, 'y': y, 'width': w, 'height': h, 'arch': arch, 'room': rid.get(roomname, ''), 'qty': 1, 'notes': notes, 'src': 'schedule'}
windows = [
    win('W01', 3, 2100, 610, 'GARAGE', arch=False, notes='2106FG garage: no architrave'),
    win('W02', 3, 2400, 1210, 'GUEST BATH + WC', arch=False, notes='2412FG guest bath: tiled window reveal (plan note)'),
    win('W03', 3, 2400, 910, OPEN, notes='2409LW/1 louvre, stair/living north'),
    win('W04', 3, 2400, 1800, OPEN, notes='2409 + 2409 corner fixed glass, living NW'),
    win('W05', 3, 2400, 1610, OPEN, notes='2416FG (2 panels) living west'),
    win('W06', 3, 2400, 1197, OPEN, notes='2412LW/2 louvres living west'),
    win('W07', 3, 600, 2410, OPEN, notes='0624FG over kitchen bench'),
    win('W24', 3, 600, 2410, 'STUDIO', notes='0624OXXOSW studio east'),
    win('W08', 4, 2100, 910, HALL, notes='2109LW/1 louvre at east end of hall'),
    win('W09', 4, 1200, 2410, 'BED 4', notes='1224OXXOSW'), win('W10', 4, 1200, 2410, 'BED 3', notes='1224OXXOSW'), win('W11', 4, 1200, 2410, 'BED 2', notes='1224OXXOSW'),
    win('W12', 4, 2100, 3010, HALL, notes='2130FG (3 panels) rumpus north'),
    win('W13', 4, 2400, 1800, HALL, notes='2409 + 2409 corner fixed glass, rumpus NW'),
    win('W14', 4, 2300, 610, HALL, notes='2306LW/1 louvre rumpus west'),
    win('W15', 4, 2300, 610, 'BED 1 + WIR', notes='2306LW/1 louvre bed 1 west'),
    win('W16', 4, 2100, 610, 'BED 1 + WIR', notes='2106DH in WIR'),
    win('W17', 4, 1200, 1510, 'ENSUITE', arch=False, notes='1215OXSW ensuite: tiled window reveal (plan note)'),
    win('W18', 4, 1200, 460, 'ENSUITE', arch=False, notes='12045DH obscure, ensuite shower: tiled reveal assumed'),
    win('W19', 4, 400, 1500, HALL, arch=False, notes='0415FG study, 2700 head height, square set (plan note)'),
    win('W20', 4, 900, 610, 'UPPER WC', arch=False, notes='0906XOSW obscure, WC: tiled reveal assumed'),
    win('W21', 4, 900, 1510, 'MAIN BATH', arch=False, notes='0915XOSW main bath: tiled window reveal (plan note)'),
    win('W22', 4, 1200, 2410, 'BED 1 + WIR', notes='1224OXXOSW bed 1 south (Vari 01, was 0624)'),
    win('W23', 4, 600, 2410, 'BED 4', notes='0624OXXOSW bed 4 east'),
]
spec = {'skirtProfile': 'Splayed', 'skirtSize': '66x11', 'skirtMaterial': 'Pre-primed Ezitrim Plus', 'skirtStock': 5400, 'skirtWaste': 10, 'skirtColour': 'Wattyl Aquatrim, Dulux Natural White (per colour schedule)', 'skirtRate': 0, 'skirtUnit': 'length',
        'archProfile': 'Splayed', 'archSize': '42x11', 'archMaterial': 'Pre-primed Ezitrim Plus', 'archStock': 5400, 'archWaste': 10, 'archColour': 'Wattyl Aquatrim, Dulux Natural White (per colour schedule)', 'archRate': 0, 'archUnit': 'length',
        'windowsArch': True, 'openingAllowance': 200, 'archLegAllow': 100, 'archHeadAllow': 250, 'archWinAllow': 150, 'skirtWet': False, 'skirtRobes': True, 'skirtExternal': False,
        'doorHeight': 2340, 'doorWidth': 870, 'doorThick': 35, 'doorLeaf': HC, 'extLeaf': SC, 'jamb': 'Treated pine; EZI-Jamb to under-stair store',
        'doorColour': 'Wattyl Aquatrim, Dulux Natural White', 'frameColour': 'Wattyl Aquatrim, Dulux Natural White',
        'hardware': 'Handle House L14 Kilmore SS lever matt white; T1 round cavity privacy / C55 cavity passage + K36 pulls; white Hirline hinges; T95 magnetic / T106 pencil stops (tiled areas); privacy to all beds, baths, ensuite, WCs, powder (Vari 05)', 'doorRate': 0,
        'notes': 'Spec: skirting splayed 66x11 and architrave splayed 42x11 (colour schedule lists 66x11 bevel AS3 for both: confirm which profile). Timber reveals and architraves to all windows and sliding glass doors except tiled reveals (ensuite and bathroom windows) and the square-set study window. Wet areas tiled, no timber skirting. Internal doors painted flush hollowcore 2340 high (Vari 05), solid core to bed 1.'}
project = {'v': 1, 'project': {'name': '84 Point Cartwright Drive, Buddina - Stone residence (PBPOI84 The Waypoint)', 'pdfName': 'PBPOI84_Plans_84_Point_Cartwright_Drive_FWD_20260806103431301v20.pdf', 'pageCount': 23, 'lastPage': 3, 'aiTier': 'complex'},
           'spec': spec, 'pages': {'3': {'mmPerPt': 100 * PT_MM, 'method': 'preset', 'label': 'Ground floor'}, '4': {'mmPerPt': 100 * PT_MM, 'method': 'preset', 'label': 'Upper floor'}, '8': {'mmPerPt': 75 * PT_MM, 'method': 'preset', 'label': 'Schedules GF (1:75)'}, '9': {'mmPerPt': 100 * PT_MM, 'method': 'preset', 'label': 'Schedules UF'}},
           'rooms': rooms, 'doors': doors, 'windows': windows}
json.dump(project, open('poi/poi-takeoff-project.json', 'w'), indent=1)
missing = [d['tag'] for d in doors if d['x'] is None] + [w['tag'] for w in windows if w['x'] is None]
print('rooms', len(rooms), 'doors', len(doors), 'windows', len(windows), 'unplaced:', missing)
