import json, re
R = {4: json.load(open('kalinda/rooms4.json'))['rooms'], 5: json.load(open('kalinda/rooms5.json'))['rooms']}
TM = json.load(open('kalinda/tagmap.json'))
PT_MM = 25.4 / 72
def room(page, idx, name, skirting, notes='', deductions=None):
    r = R[page][idx]
    return {'id': f'r{page}-{idx}', 'name': name, 'page': page, 'method': 'trace', 'pts': [{'x': x, 'y': y} for x, y in r['pts_pt']], 'pt': None,
            'length': 0, 'width': 0, 'perimeter': 0, 'skirting': skirting, 'deductions': deductions or [], 'notes': notes, 'src': 'trace'}
rooms = [
    room(4, 1, 'BED 3', True), room(4, 0, 'BED 3 WIR', True, 'Confirm skirting inside WIRs (robe fit-out by client)'),
    room(4, 3, 'BED 4', True), room(4, 2, 'BED 4 WIR', True, 'Confirm skirting inside WIRs'),
    room(4, 4, 'LAUNDRY', False, 'Tiled: skirting tile to 200 high (spec)'),
    room(4, 5, 'RUMPUS + PASSAGE', True, 'Open-plan run incl. passage to beds 3/4; linen and WC openings deducted as doors', [{'label': 'Rumpus kitchenette cabinets (est.)', 'mm': 3500}]),
    room(4, 7, 'BATH', False, 'Tiled'), room(4, 8, 'ENS 3', False, 'Tiled'),
    room(4, 9, 'BED 5', True, 'Robe recess is a square-set opening (Vari 01) and is included in the run'),
    room(4, 10, 'LOUNGE (GRANNY FLAT)', True, '', [{'label': 'Lounge kitchenette cabinets (est.)', 'mm': 3000}]),
    room(5, 5, 'BED 2', True), room(5, 0, 'BED 2 WIR', True, 'Confirm skirting inside WIRs'),
    room(5, 1, 'ENS 2', False, 'Tiled'), room(5, 2, 'STORE (UPPER)', True, 'Tiled floor per tiling schedule, no skirting tile listed: confirm timber skirting'),
    room(5, 3, 'GYM', True, '2/520 store cupboard sealed off (no skirting inside)'),
    room(5, 6, 'HALL (BED 2 WING)', True, 'Between bed 2 / gym / garage door; double cavity slider to living is square set'),
    room(5, 4, 'GARAGE', False, 'Concrete, no skirting'),
    room(5, 7, 'LIVING / DINING / KITCHEN / ENTRY', True, 'One continuous run incl. entry nook and bed 1 lobby; kitchen island is freestanding', [{'label': 'Kitchen wall joinery incl. fridge tower (est.)', 'mm': 5000}, {'label': 'TV unit joinery (est.)', 'mm': 3000}]),
    room(5, 13, 'BUTLERS', True, 'Joinery line to kitchen (concealed cabinetmaker door)', [{'label': 'Benches and back of fridge tower (est.)', 'mm': 4600}]),
    room(5, 9, 'BED 1', True, 'Lux batten panelling wall to robe: confirm whether skirting runs under panelling'),
    room(5, 8, 'BED 1 WIR', True, 'Confirm skirting inside WIRs'), room(5, 11, 'BED 1 ROBE (CONCEALED DOOR)', True, 'Concealed 2.7 m door in panelled wall (Vari 01)'),
    room(5, 12, 'ENS 1 + WC', False, 'Tiled'), room(5, 14, 'POWDER', False, 'Tiled'),
]
rid = {r['name']: r['id'] for r in rooms}
def pos(page, tag):
    for m in TM[str(page)]:
        if m['tag'] == tag: return m['x'], m['y']
    return None, None
def door(tag, page, typ, w, h, frm, to, arch, leaf, lever='auto', leaves=1, thick=35, fire=False, notes='', qty=1, xy=None, skirt=True):
    x, y = xy or pos(page, tag)
    return {'id': 'd-' + re.sub(r'\W', '', tag), 'tag': tag, 'page': page, 'x': x, 'y': y, 'type': typ, 'height': h, 'width': w, 'thick': thick, 'leaves': leaves, 'hand': '',
            'leaf': leaf, 'colour': '', 'lever': lever, 'archSides': arch, 'skirtDeduct': skirt, 'fire': fire, 'fromRoom': rid.get(frm, ''), 'toRoom': rid.get(to, ''), 'qty': qty, 'notes': notes, 'src': 'schedule'}
HUME = 'Hume Accent HAG 11 hollowcore'
GJ = 'Aluminium by G.James (by others)'
doors = [
    # ground floor
    door('D1', 4, 'extslide', 2410, 2400, 'BED 3', '', 1, GJ, 'none', notes='2424OXSD sliding door to patio; timber reveal + architrave inside'),
    door('D2', 4, 'extother', 925, 2400, 'LAUNDRY', '', 1, 'Aluminium glass swing door, G.James (Vari 03)', 'none', thick=0, notes='Laundry external door; hardware by window supplier'),
    door('D3', 4, 'extslide', 3582, 2400, 'RUMPUS + PASSAGE', '', 1, GJ, 'none', notes='2436OXXSD sliding door to patio'),
    door('D4', 4, 'extslide', 2410, 2400, 'LOUNGE (GRANNY FLAT)', '', 1, GJ, 'none', notes='2424XOSD sliding door to entertainment'),
    door('D6', 4, 'extslide', 2410, 2400, '', '', 0, 'Manual lift roller door 24x24 (by others)', 'none', notes='Roller door to external store; no trim', skirt=False),
    door('D7', 4, 'hinged', 870, 2340, 'BED 5', 'LOUNGE (GRANNY FLAT)', 2, HUME, 'passage', notes='Bed 5 door; hardware schedule lists no privacy set for bed 5: confirm'),
    door('D8', 4, 'hinged', 720, 2340, 'ENS 3', 'BED 5', 2, HUME, 'passage', notes='Ens 3 door; pencil stop; schedule lists no privacy set for ens 3: confirm'),
    door('D9', 4, 'hinged', 870, 2340, 'LAUNDRY', 'RUMPUS + PASSAGE', 2, HUME, 'passage', notes='Laundry internal door; pencil stop'),
    door('D10', 4, 'hinged', 870, 2340, 'BED 3', 'RUMPUS + PASSAGE', 2, HUME, 'privacy', notes='Bed 3 door'),
    door('D11', 4, 'cavity', 720, 2340, 'BED 3 WIR', 'BED 3', 2, HUME, 'cavity', notes='720csd to bed 3 WIR; K36 edge pull'),
    door('D12', 4, 'hinged', 870, 2340, 'BED 4', 'RUMPUS + PASSAGE', 2, HUME, 'privacy', notes='Bed 4 door'),
    door('D13', 4, 'hinged', 720, 2340, 'RUMPUS + PASSAGE', '', 2, HUME, 'privacy', notes='Lower WC door (privacy per schedule; pencil stop); WC tiled, not a skirting room'),
    door('D14', 4, 'hinged', 720, 2340, 'BATH', '', 2, HUME, 'privacy', notes='Bath door from WC lobby; pencil stop'),
    door('D37', 4, 'cavity', 720, 2340, 'BED 4 WIR', 'BED 4', 2, HUME, 'cavity', notes='720csd to bed 4 WIR (Vari 01); K36 edge pull', xy=(478.7, 255.0)),
    door('D38', 4, 'hinged', 420, 2340, 'RUMPUS + PASSAGE', '', 1, HUME, 'dummy', leaves=2, qty=2, notes='Linen: two 2/420 openings = 4 doors (Vari 06, client hardware)', xy=(434.9, 418.0)),
    # upper floor
    door('D16', 5, 'extother', 1200, 2340, 'LIVING / DINING / KITCHEN / ENTRY', '', 0, 'Parkwood Strata SV04 pivot, black (by others)', 'none', thick=0, notes='Entry pivot; square set; Regal pull handles + Eufy lock (client supply)'),
    door('D17', 5, 'extslide', 4860, 2400, 'GARAGE', '', 0, 'Sectional panelift door, Knotwood clad (by others)', 'none', notes='Garage door', skirt=False),
    door('D18', 5, 'extother', 875, 2100, 'GARAGE', '', 0, 'Strata TGV aluminium hinged door, G.James (Vari 03/07)', 'none', thick=0, notes='Garage external door, head at 2100; no trim (garage)', skirt=False),
    door('D19', 5, 'extslide', 2410, 2400, 'BED 2', '', 1, GJ, 'none', notes='2424XOSD sliding door to balcony'),
    door('D20', 5, 'extslide', 4782, 2400, 'LIVING / DINING / KITCHEN / ENTRY', '', 0, GJ, 'none', notes='2448OXXOSD sliding door to balcony; square set (spec)'),
    door('D36', 5, 'extslide', 4800, 2400, 'LIVING / DINING / KITCHEN / ENTRY', '', 0, 'G.James 2448 XXXO stacker (Vari 03)', 'none', notes='Alfresco stacker; square set (spec)', xy=(590.0, 500.0)),
    door('D21', 5, 'hinged', 870, 2340, 'LIVING / DINING / KITCHEN / ENTRY', 'GARAGE', 2, 'Solid core flush panel (Vari 01)', 'entrance', fire=True, notes='Internal garage door: solid core, keyed lever, deadlock (client supply)'),
    door('D22', 5, 'hinged', 520, 2340, 'GYM', '', 1, HUME, 'dummy', leaves=2, notes='Gym store cupboard 2/520 (schedule width 1640: check); Vari 01 two doors'),
    door('D23', 5, 'hinged', 870, 2340, 'GYM', 'HALL (BED 2 WING)', 2, HUME, 'privacy', notes='Gym door'),
    door('D25', 5, 'hinged', 720, 2340, 'ENS 2', 'STORE (UPPER)', 2, HUME, 'privacy', notes='Ens 2 door (privacy per schedule); opens off the store per plan: check; pencil stops to ens 2 and store'),
    door('D26', 5, 'hinged', 870, 2340, 'BED 2', 'HALL (BED 2 WING)', 2, HUME, 'privacy', notes='Bed 2 door'),
    door('D27', 5, 'cavity', 720, 2340, 'BED 2 WIR', 'BED 2', 2, HUME, 'cavity', notes='720csd to bed 2 WIR'),
    door('D28', 5, 'cavity', 720, 2340, 'BED 2', 'ENS 2', 2, HUME, 'cavity', notes='720csd bed 2 to ens 2; T99 PRIVACY flush pull + K36 edge pull'),
    door('D29', 5, 'hinged', 870, 2340, 'BED 1', 'LIVING / DINING / KITCHEN / ENTRY', 0, HUME, 'privacy', notes='Bed 1 entry: Ezi-jamb, no architrave (spec)'),
    door('D30', 5, 'cavity', 870, 2340, 'BED 1 WIR', 'BED 1', 2, HUME, 'cavity', notes='870csd to bed 1 WIR'),
    door('D31', 5, 'cavity', 870, 2340, 'ENS 1 + WC', 'BED 1', 2, HUME, 'cavity', notes='870csd bed 1 to ens 1; T99 PRIVACY flush pull + K36 edge pull'),
    door('D33', 5, 'cavity', 870, 2340, 'ENS 1 + WC', 'LIVING / DINING / KITCHEN / ENTRY', 2, HUME, 'cavity', notes='870csd (third cavity in bed 1 suite): confirm location', xy=(371.5, 596.0)),
    door('D32', 5, 'hinged', 720, 2700, 'BED 1 ROBE (CONCEALED DOOR)', 'BED 1', 0, 'Solid core, concealed in Lux panelling', 'none', fire=True, notes='2.7 m high concealed door, push to open, shadowline (Vari 01); hinge TBC'),
    door('D34', 5, 'hinged', 720, 2340, 'POWDER', 'LIVING / DINING / KITCHEN / ENTRY', 0, HUME, 'privacy', notes='Powder: Ezi-jamb, no architrave (spec); pencil stop'),
    door('D35', 5, 'hinged', 870, 2340, 'STORE (UPPER)', 'HALL (BED 2 WING)', 2, HUME, 'passage', notes='Store door'),
    door('DX1', 5, 'cavity', 820, 2340, 'HALL (BED 2 WING)', 'LIVING / DINING / KITCHEN / ENTRY', 0, HUME, 'cavity', leaves=2, notes='2/820 double cavity sliders, square set (Vari 10); not in the door schedule', xy=(451.7, 356.0)),
]
def win(tag, page, h, w, roomname, arch=True, notes='', xy=None):
    x, y = xy or pos(page, tag)
    return {'id': 'w-' + tag, 'tag': tag, 'page': page, 'x': x, 'y': y, 'width': w, 'height': h, 'arch': arch, 'room': rid.get(roomname, ''), 'qty': 1, 'notes': notes, 'src': 'schedule'}
windows = [
    win('W1', 4, 900, 2110, 'BED 4', notes='0921OXXOSW (Vari 02)'), win('W17', 4, 600, 2410, 'BED 3', notes='0624OXXOSW'),
    win('W2', 4, 1200, 2410, 'LOUNGE (GRANNY FLAT)', notes='1224OXXOSW'), win('W3', 4, 1200, 2710, 'LOUNGE (GRANNY FLAT)', notes='1227OXXOSW'),
    win('W20', 4, 2100, 910, 'LOUNGE (GRANNY FLAT)', notes='2109DH in lieu of lounge hinged door (Vari 03)', xy=(429.7, 551.0)),
    win('W4', 4, 1200, 2410, 'BED 5', notes='1224OXXOSW'), win('W5', 4, 900, 1510, '', arch=False, notes='0915XOSW to external store: no architrave'),
    win('W6', 5, 2100, 610, 'LIVING / DINING / KITCHEN / ENTRY', arch=False, notes='2106FG hallway window: square set (spec)'),
    win('W7', 5, 600, 2410, 'GARAGE', arch=False, notes='0624XOXSW garage: no architrave'), win('W8', 5, 1200, 2110, 'GYM', notes='1221OXXOSW'),
    win('W9', 5, 400, 1784, 'ENS 2', notes='0418LW/3 louvre, obscure; confirm reveal detail in tiled room', xy=(421.0, 189.0)),
    win('W10', 5, 2100, 3010, 'BED 1', notes='2130OXXOSW (Vari 03)'), win('W11', 5, 900, 2400, 'ENS 1 + WC', notes='0924LW/4 louvre, obscure; confirm reveal detail in tiled room'),
    win('W12', 5, 1200, 1810, 'BUTLERS', notes='1218OXXOSW'), win('W13', 5, 900, 910, 'POWDER', notes='0909OXSW obscure; confirm reveal detail in tiled room'),
]
spec = {'skirtProfile': 'Splayed AS8', 'skirtSize': '91x11', 'skirtMaterial': 'Pre-primed Ezitrim Plus', 'skirtStock': 5400, 'skirtWaste': 10, 'skirtColour': 'Wattyl Aqua Trim satin, colour TBC', 'skirtRate': 0, 'skirtUnit': 'length',
        'archProfile': 'Splayed AS8', 'archSize': '66x11', 'archMaterial': 'Pre-primed Ezitrim Plus', 'archStock': 5400, 'archWaste': 10, 'archColour': 'Wattyl Aqua Trim satin, colour TBC', 'archRate': 0, 'archUnit': 'length',
        'windowsArch': True, 'openingAllowance': 200, 'archLegAllow': 100, 'archHeadAllow': 250, 'archWinAllow': 150, 'skirtWet': False, 'skirtRobes': True, 'skirtExternal': False,
        'doorHeight': 2340, 'doorWidth': 870, 'doorThick': 35, 'doorLeaf': HUME, 'extLeaf': 'Solid core flush panel', 'jamb': 'Treated pine; Ezi-jamb to bed 1 entry and powder',
        'doorColour': 'Wattyl Aqua Trim satin, colour TBC', 'frameColour': 'Wattyl Aqua Trim satin, colour TBC', 'hardware': 'Handle House L10 Potts Point matt black (client supply); T60 Hirline hinges black; T95 magnetic / T106 pencil stops; K36 edge pulls to cavities', 'doorRate': 0,
        'notes': 'Square set cornice throughout. Timber reveals and architraves to windows and sliding doors except: alfresco stacker, entry pivot, hallway window, balcony sliding door and windows over, 3x highlight windows over living (square set). Living double cavity sliders square set (Vari 10). Ezi-jamb (no architrave) to bed 1 entry and powder doors. Wet areas tiled with skirting tile.'}
project = {'v': 1, 'project': {'name': '5 Kalinda Ave, Mooloolaba - Barthelson (PBKAL05)', 'pdfName': 'PBKAL5_Plans_FWD_-_5_Kalinda_20260917080901411v16.pdf', 'pageCount': 12, 'lastPage': 4, 'aiTier': 'complex'},
           'spec': spec, 'pages': {'4': {'mmPerPt': 100 * PT_MM, 'method': 'preset', 'label': 'Ground floor'}, '5': {'mmPerPt': 100 * PT_MM, 'method': 'preset', 'label': 'Upper floor'}, '9': {'mmPerPt': 100 * PT_MM, 'method': 'preset', 'label': 'Schedules GF'}, '10': {'mmPerPt': 100 * PT_MM, 'method': 'preset', 'label': 'Schedules UF'}},
           'rooms': rooms, 'doors': doors, 'windows': windows}
json.dump(project, open('kalinda/kalinda-takeoff.json', 'w'), indent=1)
missing = [d['tag'] for d in doors if d['x'] is None] + [w['tag'] for w in windows if w['x'] is None]
print('rooms', len(rooms), 'doors', len(doors), 'windows', len(windows), 'unplaced:', missing)
