#!/usr/bin/env python3
"""Original hard-pixel Port Marche assets. No external source image or artwork."""
from PIL import Image, ImageColor, ImageDraw
from pathlib import Path
import json

OUT = Path(__file__).resolve().parent.parent / 'public/games/mesomon'
OUT.mkdir(parents=True, exist_ok=True)
P = dict(ink='#102224', slate='#30474A', teal='#2F6667', sea='#244C52', lightsea='#417F7D', marsh='#657D55', ochre='#C09245', plaster='#D8C9A5', foam='#E8E1C6', eden='#9FD6B1', rift='#36243F', wood='#765740', woodlight='#A67D50', darkwood='#483F32', roof='#91564B', skin='#B87955', brass='#C49443')
TILES = ['water','water2','dock','stone','grass','mud','wall','roof','door','stair','reeds','floor','shelf','table','crate','gate','bridge','rift','rope','rail','lamp','sand','channel','flower','chart','map','satchel','rock','sign','awning','window','ship','planks','black','arch','gear']

def tile(name):
    im=Image.new('RGBA',(16,16),P['slate']); d=ImageDraw.Draw(im)
    def r(box,c): d.rectangle(box, fill=P.get(c,c))
    if name in ['water','water2','channel']:
        r((0,0,15,15),'sea'); off=3 if name=='water2' else 0
        for x,y,w in [(1,3,5),(9,9,6),(2,13,4),(10,1,3)]:
            y=(y+off)%16;r((x,y,min(15,x+w),y),'teal');r((x+1,y+1,min(15,x+w-1),y+1),'lightsea')
        if name=='channel':r((0,0,1,15),'ink')
    elif name in ['dock','bridge','planks','ship','floor']:
        r((0,0,15,15),'wood');
        for y in [0,5,10,15]:r((0,y,15,y),'darkwood')
        for x,y in [(4,0),(11,5),(7,10)]:r((x,y,x,y+4),'darkwood');r((x+2,y+2,x+4,y+2),'woodlight')
        for x,y in [(1,2),(13,7),(3,12)]:r((x,y,x,y),'ochre')
        if name=='ship':r((0,0,2,15),'woodlight');r((3,0,3,15),'darkwood')
        if name=='bridge':r((0,0,15,1),'woodlight');r((0,14,15,15),'darkwood')
    elif name in ['stone','stair','arch']:
        r((0,0,15,15),'slate')
        for y in [0,7,15]:r((0,y,15,y),'ink');r((0,min(y+1,15),15,min(y+1,15)),'#59706B')
        r((7,1,7,6),'ink');r((2,8,2,14),'ink');r((12,8,12,14),'ink')
        r((2,4,4,4),'#6B8076');r((10,11,12,11),'#536B65')
        if name=='stair':
            for y in [3,6,9,12]:r((0,y,15,y),'plaster');r((0,y+1,15,y+1),'ink')
        if name=='arch':r((3,4,12,15),'ink');r((5,2,10,3),'plaster')
    elif name in ['grass','reeds','flower','mud','sand']:
        r((0,0,15,15),'#485B43' if name not in ['mud','sand'] else ('#65574A' if name=='mud' else '#A39A75'))
        for x,y in [(1,2),(7,5),(12,12),(4,13),(13,2),(2,8)]:r((x,y,x+1,y+1),'marsh' if name!='sand' else 'plaster')
        if name=='reeds':
            for x,y in [(2,2),(6,5),(11,1),(13,7)]:r((x,y,x,y+8),'#A3A56D');r((x-1,y,x+1,y+2),'ochre')
        if name=='flower':
            for x,y in [(4,4),(10,11)]:r((x,y,x+2,y+2),'foam');r((x+1,y+1,x+1,y+1),'ochre')
    elif name in ['wall','window']:
        r((0,0,15,15),'plaster');r((0,0,15,1),'#A7997A');r((0,15,15,15),'wood')
        for x,y in [(0,8),(9,4),(4,13)]:r((x,y,min(x+4,15),y),'#B5AB89')
        if name=='window':r((3,3,12,12),'wood');r((4,4,11,11),'teal');r((7,4,8,11),'ochre');r((4,7,11,8),'ochre');r((5,4,6,5),'foam')
    elif name in ['roof','awning']:
        r((0,0,15,15),'roof' if name=='roof' else 'teal')
        if name=='roof':
            for y in [1,6,11]:
                r((0,y,15,y),'#B7765C');r((0,y+1,15,y+1),'#623E36');r(((y*3)%11,y+2,(y*3)%11,y+4),'#623E36')
        else:
            for x in [0,8]:r((x,0,x+3,15),'plaster')
            r((0,14,15,15),'darkwood')
    elif name=='black':r((0,0,15,15),'ink')
    else:
        r((0,0,15,15),'floor' if 'floor' in P else 'wood')
        if name=='door':r((2,0,13,15),'darkwood');r((4,1,11,15),'wood');r((4,2,4,14),'woodlight');r((10,9,11,10),'brass')
        if name=='shelf':
            r((1,1,14,14),'darkwood')
            for y in [4,10,14]:r((1,y,14,y),'woodlight')
            for x in [3,6,9,12]:r((x,1,x+1,3),'eden' if x==9 else 'ochre');r((x,7,x+1,9),'plaster')
        if name=='table':r((1,3,14,12),'darkwood');r((1,3,14,9),'woodlight');r((4,4,10,7),'plaster');r((5,5,8,5),'teal')
        if name=='crate':r((1,1,14,14),'darkwood');r((2,2,13,13),'wood');d.line((2,2,13,13), fill=P['woodlight'],width=2);d.line((13,2,2,13),fill=P['woodlight'],width=2)
        if name in ['gate','rail']:
            r((0,0,15,15),'slate')
            for x in [1,5,9,13]:r((x,0,x+1,15),'ink');r((x,0,x,14),'ochre')
            r((0,3,15,4),'darkwood');r((0,11,15,12),'darkwood')
        if name=='rift':r((0,0,15,15),'ink');d.polygon([(9,0),(5,6),(8,8),(4,15),(10,12),(12,7),(9,6),(12,0)],fill=P['rift']);d.line([(9,1),(7,6),(9,8),(6,14)],fill='#BB8DC1',width=1)
        if name=='rope':r((0,0,15,15),'dock' if 'dock' in P else 'wood');d.ellipse((2,3,13,12),outline=P['ochre'],width=2);d.ellipse((5,5,10,10),outline=P['plaster'])
        if name=='lamp':r((0,0,15,15),'slate');r((7,2,8,15),'darkwood');r((4,3,11,9),'ink');r((5,4,10,8),'ochre');r((6,4,8,7),'foam')
        if name=='chart':r((2,2,13,13),'plaster');d.line([(3,9),(5,7),(7,9),(9,5),(12,8)],fill=P['teal']);d.line([(3,5),(6,5),(9,4),(12,4)],fill=P['roof'])
        if name=='map':r((1,2,14,12),'plaster');d.line([(3,3),(5,5),(4,9),(8,11)],fill=P['teal'],width=2);d.ellipse((9,5,12,8),outline=P['roof'])
        if name=='satchel':r((4,3,11,12),'darkwood');r((5,5,10,11),'woodlight');r((7,5,8,6),'brass')
        if name=='rock':d.polygon([(2,12),(3,5),(7,2),(13,4),(15,10),(11,14)],fill='#60736B');d.line([(4,5),(7,3),(11,4)],fill=P['plaster'])
        if name=='sign':r((7,5,8,15),'wood');r((1,2,14,8),'darkwood');r((3,4,11,4),'plaster');r((3,6,8,6),'ochre')
        if name=='gear':
            d.ellipse((3,3,12,12),fill=P['ochre']);d.ellipse((6,6,9,9),fill=P['ink'])
            for x,y in [(6,1),(6,12),(1,6),(12,6)]:r((x,y,x+2,y+2),'brass')
    return im

def field_tile(name):
    # Ground textures leave quiet space around small silhouettes. Keep prop and
    # building details at the same scale as the 16-pixel doors and stairs.
    if name not in ('stone', 'dock', 'floor', 'water', 'water2', 'grass'):
        return tile(name)
    base = {'stone': '#788780', 'dock': '#916F50', 'floor': '#987858',
            'water': '#315E65', 'water2': '#315E65', 'grass': '#607854'}[name]
    im = Image.new('RGBA', (16, 16), base)
    d = ImageDraw.Draw(im)
    if name == 'stone':
        for x, y, w in [(0, 5, 7), (10, 5, 5), (4, 12, 9)]:
            d.line((x, y, x + w, y), fill='#647771')
        d.line((8, 1, 8, 4), fill='#647771')
        d.line((3, 10, 3, 12), fill='#647771')
        d.line((4, 13, 7, 13), fill='#8F9C90')
    elif name in ('dock', 'floor'):
        for y, joint in [(0, 3), (8, 11)]:
            d.line((0, y, 15, y), fill='#6F5744')
            d.line((joint, y + 1, joint, y + 7), fill='#795E49')
            d.line((joint + 1, y + 1, joint + 3, y + 1), fill='#AC8860')
        d.line((3, 12, 7, 12), fill='#A7815C')
    elif name == 'grass':
        for x, y in [(2, 3), (10, 10)]:
            d.line((x, y, x + 1, y + 2), fill='#82926B')
            d.point((x + 2, y + 1), fill='#82926B')
    else:
        shift = 3 if name == 'water2' else 0
        for x, y in [(2, 3 + shift), (10, 11 - shift)]:
            d.line((x, y, x + 3, y), fill='#4E7D7F')
            d.point((x + 4, y - 1), fill='#4E7D7F')
    return im

# The Wayfarer's two three-tile deckhouses are painted as whole structures.
def deckhouse():
    im = Image.new('RGBA', (48, 48))
    for y in range(3):
        for x in range(3):
            im.paste(field_tile('dock'), (x * 16, y * 16))
    d = ImageDraw.Draw(im)
    d.rectangle((2, 5, 45, 45), fill=P['ink'])
    d.rectangle((3, 28, 44, 43), fill='#9B795B')
    d.line((3, 42, 44, 42), fill='#6D5140', width=2)
    for x in (8, 32):
        d.ellipse((x, 30, x + 7, 37), fill=P['ink'])
        d.ellipse((x + 1, 31, x + 6, 36), fill=P['brass'])
        d.ellipse((x + 2, 32, x + 5, 35), fill=P['sea'])
        d.point((x + 3, 32), fill=P['foam'])
    d.polygon([(1, 26), (4, 3), (7, 1), (40, 1), (43, 3), (46, 26),
               (44, 28), (3, 28)], fill=P['ink'])
    d.polygon([(3, 24), (6, 4), (8, 3), (39, 3), (41, 4), (44, 24)], fill='#658481')
    for x in (12, 23, 34):
        d.line((x, 4, x - 1, 23), fill='#74918B')
    d.line((4, 25, 43, 25), fill='#A2AEA0')
    d.rectangle((17, 8, 29, 16), fill=P['slate'])
    d.rectangle((18, 9, 28, 14), fill='#95A79A')
    for y in (11, 13):
        d.line((20, y, 26, y), fill=P['slate'])
    return im

def ship_detail(name):
    im = field_tile('dock')
    d = ImageDraw.Draw(im)
    if name == 'gangplank':
        d.rectangle((1, 0, 14, 15), fill=P['ink'])
        d.rectangle((3, 0, 12, 15), fill='#B99B72')
        for y in (2, 7, 12):
            d.line((3, y, 12, y), fill='#7E654E')
        for x in (1, 14):
            d.line((x, 0, x, 15), fill=P['brass'])
        for x, y in ((6, 7), (7, 8), (8, 8), (9, 7)):
            d.point((x, y), fill=P['foam'])
    else:
        d.rectangle((0, 0, 5, 15), fill='#315E65')
        d.rectangle((5, 0, 11, 15), fill=P['ink'])
        d.rectangle((7, 0, 10, 15), fill='#B5966B')
        d.line((7, 0, 7, 15), fill='#D1B68A')
        d.rectangle((6, 6, 11, 9), fill=P['darkwood'])
        d.rectangle((6, 6, 10, 7), fill=P['brass'])
        if name == 'starboard':
            im = im.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        elif name == 'bow':
            im = im.transpose(Image.Transpose.ROTATE_90).transpose(Image.Transpose.FLIP_TOP_BOTTOM)
    return im

cabin = deckhouse()
ship_tiles = {name: ship_detail(name) for name in ('port', 'starboard', 'bow', 'gangplank')}
for y in range(3):
    for x in range(3):
        ship_tiles[f'cabin-{x}-{y}'] = cabin.crop((x * 16, y * 16, (x + 1) * 16, (y + 1) * 16))
TILES.extend(ship_tiles)

atlas=Image.new('RGBA',(16*len(TILES),16))
for i,name in enumerate(TILES):atlas.paste(ship_tiles[name] if name in ship_tiles else field_tile(name),(16*i,0))
atlas.save(OUT/'harbor-tiles.png',optimize=True)

HUMANS=['tavian','nia','bram','seli','pell','captain','edda','fisher','worker','porter','lanternkeeper','vendor']

def human(name,direction='down',frame=0):
    im=Image.new('RGBA',(16,24));d=ImageDraw.Draw(im)
    skin={'nia':'#819568','seli':'#C6A47B','bram':'#AE8058','pell':'#BD8B69','captain':'#BD9877','edda':'#C39B75'}.get(name,P['skin'])
    coat={'nia':'#A16D43','bram':'#667353','seli':'#657955','pell':'#A58F55','captain':'#425D69','edda':'#665D78','fisher':'#68758B','worker':'#8F774F','porter':'#826A63','lanternkeeper':'#4D6A5A','vendor':'#A46D57'}.get(name,'#315B5E')
    hair={'bram':'#DDD1AE','seli':'#B6A78B','edda':'#B9B3A0','nia':'#283D33','pell':'#463A2C','captain':'#74776B'}.get(name,'#182B2D')
    def r(box,c):d.rectangle(box,fill=P.get(c,c))
    bob=1 if frame in [1,2] else 0;sy=1 if name=='bram' else (2 if name=='pell' else 0)
    r((4,2+sy,11,9+sy),hair);r((3,4+sy,12,7+sy),hair);r((5,5+sy,10,10+sy),skin)
    if name=='tavian':r((9,0,10,2),hair);r((4,1,9,2),hair)
    if direction=='up':r((4,3+sy,11,9+sy),hair)
    elif direction in ['left','right']:
        x=4 if direction=='left' else 10;r((x,6+sy,x+1,8+sy),skin);r((x,6+sy,x,6+sy),'ink')
    else:r((5,7+sy,5,7+sy),'ink');r((10,7+sy,10,7+sy),'ink')
    if name in ['nia','seli']:r((2,5+sy,4,6+sy),skin);r((11,5+sy,13,6+sy),skin)
    if name=='bram':r((4,8+sy,11,12+sy),hair);r((6,12+sy,9,13+sy),hair)
    r((4,11+sy-bob,11,18),coat);r((3,12+sy-bob,4,16),coat);r((11,12+sy-bob,12,16),coat)
    if direction!='up':r((7,11+sy-bob,8,15),'plaster');r((6,11+sy-bob,9,12+sy-bob),'ochre')
    r((5,18,7,21+(frame==1)),'slate');r((9,18,10,21+(frame==2)),'slate');r((4,21+(frame==1),7,22+(frame==1)),'ink');r((9,21+(frame==2),12,22+(frame==2)),'ink')
    r((3,16,4,17),skin);r((11,16,12,17),skin)
    if name=='tavian':
        cuffx=3 if direction in ['up','left'] else 11;r((cuffx,15,cuffx+1,16),'eden');r((9,13,11,15),'wood');r((10,13,10,13),'brass')
    return im
def stamp(image, rows, palette, x=0, y=0):
    for dy, row in enumerate(rows):
        for dx, pixel in enumerate(row):
            if pixel != '.':
                image.putpixel((x + dx, y + dy), ImageColor.getrgb(palette[pixel]) + (255,))

# Native-resolution cutouts. The broad head and shoulders read above the two boot marks.
def map_person(name, direction, frame, pose):
    im = Image.new('RGBA', (16, 16))
    coat, hair, trim = {
        'tavian': ('#467778', '#304346', '#9FD6B1'), 'nia': ('#AB7347', '#384A3A', '#E4C17F'),
        'bram': ('#6F795B', '#D0C5A0', '#A7B18C'), 'seli': ('#71815B', '#BAB290', '#D8C698'),
        'pell': ('#9F8751', '#584737', '#E8CD89'), 'captain': ('#526D78', '#87918A', '#DBBA75'),
        'edda': ('#776987', '#C1B9AD', '#E6D8B2'), 'fisher': ('#717C91', '#393C46', '#C3B98A'),
        'worker': ('#987950', '#59483B', '#DDB670'), 'porter': ('#8C7067', '#5E4A40', '#DBC497'),
        'lanternkeeper': ('#527765', '#47533F', '#EDC877'), 'vendor': ('#A16E60', '#5A4142', '#F0C899'),
    }[name]
    skin = {'nia': '#A5AF7F', 'bram': '#BB916F', 'seli': '#D5B48D', 'pell': '#BD906C'}.get(name, '#D2A07A')
    palette = dict(k=P['ink'], h=hair, c=coat, s=skin, a=trim, b='#684F3C', p=P['plaster'])
    side = direction in ('left', 'right')
    back = direction == 'up'
    head = [
        '...kkkk...', '.kkhhhhkk.', 'khhhhhhhhk', 'khhhhhhhhk',
        'khssshsssk', 'kssksskssk', '.kssssssk.', '..ksssskk.',
    ]
    if back:
        head[4:] = ['khhhhhhhhk', 'khhhhhhhhk', '.khhhhhhk.', '..kkhhkk..']
    elif side:
        head[4:] = ['ksshhhhhhk', 'sksshhhhhk', 'sssshsshhk', '.ksssskkk.']
    stamp(im, head, palette, 3, int(frame != 0))
    draw = ImageDraw.Draw(im)
    if name in ('captain', 'fisher', 'worker', 'vendor'):
        draw.rectangle((4, 2, 11, 3), fill=coat)
        draw.line((3, 3, 12, 3), fill=trim)
    elif name in ('nia', 'seli'):
        draw.line((2, 4, 4, 6), fill=skin)
        draw.line((13, 4, 11, 6), fill=skin)
    elif name == 'bram' and not back:
        draw.line((5, 7, 10, 7), fill=hair)
    elif name == 'tavian':
        draw.line((6, 2, 9, 1), fill='#627572')
        draw.point((10, 0), fill=hair)
    body = ['..kpaapk..', '.kccaacck.', 'kcccbccack', 'ksccbcccsk', '.kkcccckk.', '..kkkkkk..']
    if back:
        body = ['..kcccck..', '.kcbcccck.', 'kcccbcccck', 'kscccbbcsk', '.kkccbbkk.', '..kkkkkk..']
    elif side:
        body = ['..kaacck..', '..kacccck.', '.kcccbcck.', '.kscbbcck.', '..kkccck..', '...kkkk...']
    stamp(im, body, palette, 3, 8)
    for x, lifted in ((5, frame == 1), (9, frame == 2)):
        y = 13 if lifted else 14
        draw.rectangle((x, y, x + 2, y + 1), fill=P['ink'])
        draw.point((x + 1, y), fill=P['slate'])
    if direction == 'right':
        im = im.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    draw = ImageDraw.Draw(im)
    if name == 'tavian':
        cuff = 4 if direction in ('up', 'left') else 11
        draw.line((cuff, 11, cuff + 1, 11), fill=P['eden'])
    if pose in (12, 13):
        x = 11 if pose == 12 else 2
        draw.rectangle((x, 9, x + 2, 10), fill=P['ink'])
        draw.line((x, 9, x + 1, 9), fill=trim)
    if pose == 14:
        draw.line((6, 6, 9, 6), fill=hair)
    return im

directions = ('down', 'left', 'right', 'up')
sheet = Image.new('RGBA', (16 * 15, 16 * len(HUMANS)))
for row, name in enumerate(HUMANS):
    for col in range(15):
        direction = directions[col // 3] if col < 12 else 'down'
        sheet.paste(map_person(name, direction, col % 3 if col < 12 else 0, col), (col * 16, row * 16))
sheet.save(OUT/'people.png', optimize=True)

SPECIES=['rillik','muddren','gleamwing','tressel','rift-wretch']
def creature(name,side='right',frame=0,large=False):
    im=Image.new('RGBA',(48,48));d=ImageDraw.Draw(im)
    def r(box,c):d.rectangle(box,fill=P.get(c,c))
    bob=1 if frame%2 else 0
    if name=='rillik':
        d.polygon([(7,29+bob),(10,20+bob),(17,18+bob),(21,22+bob),(31,24+bob),(37,30+bob),(31,34+bob),(12,34+bob)],fill=P['ink'])
        d.polygon([(9,28+bob),(11,21+bob),(17,20+bob),(20,24+bob),(30,26+bob),(33,30+bob),(29,32+bob),(12,32+bob)],fill='#577C89')
        d.polygon([(11,20+bob),(9,10+bob),(14,14+bob),(16,20+bob)],fill='#8CAAA6');d.polygon([(17,20+bob),(19,11+bob),(21,16+bob),(20,24+bob)],fill='#8CAAA6')
        r((10,27+bob,18,30+bob),'foam');r((11,23+bob,12,24+bob),'ink');r((8,26+bob,10,27+bob),'ink');r((13,33+bob,17,36+bob),'#577C89');r((27,33+bob,31,36+bob),'#577C89')
        d.line([(31,29+bob),(39,29+bob),(42,24+bob)],fill='#577C89',width=4);d.line([(38,29+bob),(40,26+bob)],fill=P['eden'],width=4);r((24,25+bob,26,26+bob),'eden')
    elif name=='muddren':
        d.polygon([(7,33),(6,25),(12,15),(22,12),(33,18),(39,30),(34,35),(12,36)],fill=P['ink']);d.polygon([(9,30),(9,24),(15,17),(23,15),(31,20),(36,29),(31,33),(13,33)],fill='#7F8763')
        for x,y in [(15,20),(23,18),(30,24)]:d.polygon([(x-3,y+4),(x,y-2),(x+4,y+4)],fill='#B2AB7B')
        r((8,27,18,32),'#AEA77A');r((9,26,10,27),'ink');r((12,32,16,37),'#606953');r((29,32,33,37),'#606953')
    elif name=='gleamwing':
        d.polygon([(22,21),(12,10),(5,12),(7,25),(19,31),(13,36),(19,40),(24,30)],fill=P['ink']);d.polygon([(25,21),(35,10),(43,13),(40,25),(29,31),(35,36),(29,40),(23,30)],fill=P['ink'])
        d.polygon([(20,22),(11,13),(8,15),(11,24),(21,29)],fill='#B8BD9C');d.polygon([(27,22),(36,13),(40,15),(37,24),(27,29)],fill='#C6BB81')
        r((22,19,25,34),'teal');r((21,17,26,21),'ochre');r((22,17,22,17),'ink');r((25,17,25,17),'ink');d.line((22,16,18,12),fill=P['eden']);d.line((25,16,29,12),fill=P['eden']);r((11,18,14,21),'eden');r((34,18,37,21),'foam')
    elif name=='tressel':
        d.polygon([(11,31),(9,21),(13,16),(15,9),(20,15),(25,15),(31,10),(33,21),(36,29),(31,35),(17,35)],fill=P['ink']);d.polygon([(13,29),(12,21),(17,18),(24,18),(29,16),(30,23),(33,29),(28,32),(17,32)],fill='#AE7B51')
        r((15,21,17,23),'foam');r((25,21,27,23),'foam');r((16,22,17,23),'ink');r((25,22,26,23),'ink');r((19,28,24,29),'plaster');r((15,33,18,37),'wood');r((28,33,31,37),'wood');d.line([(32,30),(40,32),(43,24),(39,22)],fill=P['ochre'],width=3);r((35,30,37,31),'plaster')
    else:
        # Broken, asymmetrical negative-space demon: never a creature palette swap.
        d.polygon([(21,6),(27,11),(25,17),(34,14),(39,21),(33,26),(38,37),(27,34),(24,42),(19,34),(8,36),(14,26),(7,22),(14,17),(12,10)],fill='#221E30')
        d.line([(21,8),(23,18),(16,25),(23,31),(24,39)],fill='#9B78AB',width=2);r((16,18,19,19),'eden');r((27,21,30,22),'foam');r((11,29,15,30),'#8A5C97');r((31,10,35,11),'#8A5C97');r((6,17,9,18),'#8A5C97');r((36,32,40,33),'#8A5C97')
    if side=='left':im=im.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    if not large:im=im.resize((16,16),Image.Resampling.NEAREST)
    return im
# The small sprites have their own silhouettes and face placements at map scale.
# k = outline, c = body, l = light plane, a = species marking, e = eye.
FIELD_MONSTERS = {
    'rillik': (('#638897', '#A5BFBC', '#A9E2BC'), [
        '..kk....kk....', '..klk..klk....', '..klckkclk....', '...kcccck.....',
        '..kcccccck....', '..kecclcek..ak', '..kllkkllk.kak', '...kllllckkck.',
        '...kacccckcck.', '..kcccccclkk..', '..kllkkcllk...', '..kkk..kkk....'], [
        '....k...kk....', '...klk.klk....', '...klckcck....', '..kcccccck....',
        '.kecllccck..ak', 'kklllkccck.kak', '.klllcccckkck.', '..kkaccccccck.',
        '...kccccccck..', '..kllkkccclk..', '..kkk..kkkk...']),
    'muddren': (('#7A8868', '#BAC096', '#CDB47E'), [
        '....kk..kk....', '..kkalkkalk...', '.kaallccllak..', '.kllccaccllck.',
        '..kccallccck..', '.kccccllcccck.', '.kceclllleckk.', '.kllllkllllk..',
        '..kllaaallk...', '.kllkkcckllk..', '.kkk.....kkk..'], [
        '......kk......', '....kkalk.kk..', '...kalclkkalk.', '..kllccclcllk.',
        '..kcccccccllck', '.kkccccacccclk', 'kecllccccccck.', 'klllllcccclk..',
        '.kllkkcccllk..', '..kkk...kkk...']),
    'gleamwing': (('#41857C', '#E1D8A7', '#A0DFB8'), [
        'kk..........kk', 'klkk.k..k.kklk', 'klllk.ak.klllk', '.klalkkkklalk.',
        '.klaaceecaalk.', '..kllkcckllk..', '...kkkcckkk...', '..kllkcckllk..',
        '.kllk.kc.kllk.', '..kk..kk..kk..'], [
        '.......kk.....', '.....kkllkk...', '..k.klllaalk..', '...klllaallk..',
        '..kkecllllk...', '.kllcckkk.....', '..kkccccllk...', '....kccclllk..',
        '.....kkckkk...', '.......kk.....']),
    'tressel': (('#B58259', '#E0BE8E', '#E6CC87'), [
        '..kk....kk....', '..klk..klk....', '..kcckkcck....', '..kcccccck..kk',
        '..kellllek.kak', '..kllkkllk..ak', '...kllllck.kak', '...kccccckkck.',
        '...kclllccck..', '..kllkkcllk...', '..kkk..kkk....'], [
        '...kk...k.....', '...klk.klk....', '..kcccccck....', '.kecllccck..kk',
        'kkllllccck.kak', '.kkllcccck..ak', '...kccccckkak.', '...kcllcccck..',
        '..kllkkccclk..', '..kkk...kkk...']),
    'rift-wretch': (('#58455F', '#B68EB8', '#9FD6B1'), [
        '....kk........', '..k.kck...kk..', '..kkklck.kck..', '..kccclkkck...',
        '.kkcaacclcckk.', 'kcccccclleaack', '..kkcclckkk...', '..kcllccck....',
        '.kklk.kccck.k.', 'kck...kckkck..', '......klk.....', '.......k......'], [
        '.....kk.......', '...k.klk..k...', '...kkkclkkck..', '.kkccllcck....',
        'kaaelccck.kk..', '.kcllkkcck....', '..kkcclkkck...', '.klk.kclck....',
        '.kk..kcck.kk..', '....klkk......', '....kk........']),
}

def field_creature(name, direction, step):
    colors, front, profile = FIELD_MONSTERS[name]
    palette = dict(zip('cla', colors), k=P['ink'], e=P['ink'])
    side = direction in ('left', 'right')
    rows = profile if side else front
    if direction == 'up':
        # Hide the face behind a continuous back, retaining the ears, crest and tail.
        rows = [row.replace('e', 'c').replace('llkkll', 'ccllcc') for row in rows]
        middle = len(rows) // 2
        rows[middle] = rows[middle][:4] + 'cllc' + rows[middle][8:]
    im = Image.new('RGBA', (16, 16))
    y = 16 - len(rows) - int(name == 'gleamwing')
    if step:
        # A lifted trailing foot or wingtip changes the silhouette at this scale.
        rows = rows.copy()
        rows[-1] = rows[-1][:len(rows[-1]) // 2] + rows[-1][len(rows[-1]) // 2:].replace('k', '.')
        y -= int(name == 'gleamwing' or name == 'rift-wretch')
    stamp(im, rows, palette, 1, y)
    return im.transpose(Image.Transpose.FLIP_LEFT_RIGHT) if direction == 'right' else im

monsters = Image.new('RGBA', (16 * 8, 16 * len(SPECIES)))
for row, name in enumerate(SPECIES):
    for index, direction in enumerate(directions):
        for step in (0, 1):
            monsters.paste(field_creature(name, direction, step), (16 * (index * 2 + step), 16 * row))
monsters.save(OUT/'mesomon.png', optimize=True)
battle=Image.new('RGBA',(48*len(SPECIES),48))
for i,name in enumerate(SPECIES):battle.paste(creature(name,large=True),(i*48,0))
battle.save(OUT/'battle.png',optimize=True)
portraits=Image.new('RGBA',(48*len(HUMANS),48))
for i,name in enumerate(HUMANS):
    base=human(name).crop((2,0,14,18)).resize((24,36),Image.Resampling.NEAREST);portraits.paste(base,(i*48+12,8))
portraits.save(OUT/'portraits.png',optimize=True)
(OUT/'portraits').mkdir(exist_ok=True)
for i,name in enumerate(HUMANS): portraits.crop((i*48,0,(i+1)*48,48)).save(OUT/'portraits'/f'{name}.png',optimize=True)
for i,name in enumerate(SPECIES): battle.crop((i*48,0,(i+1)*48,48)).save(OUT/'portraits'/f'{name.replace("_","-")}.png',optimize=True)

# Hand-composed harbor key art, rendered at a320x180 pixel canvas.
cover=Image.new('RGBA',(320,180),P['sea']);d=ImageDraw.Draw(cover)
d.rectangle((0,0,319,47),fill='#9CABA0');d.rectangle((0,42,319,54),fill='#6C8D86')
for x,h in [(0,24),(28,31),(58,18),(86,36),(119,23),(156,43),(183,32),(223,19),(252,34),(286,24)]:
    d.rectangle((x,47-h,x+24,55),fill='#617C72');d.polygon([(x-2,47-h),(x+12,37-h),(x+26,47-h)],fill='#476A65')
for y in range(56,180,16):
    for x in range(0,320,16):cover.paste(tile('water2' if ((x+y)//16)%2 else 'water'),(x,y))
for x,y,w,h in [(0,94,120,50),(112,62,208,44),(152,88,40,92),(264,92,56,88)]:
    for yy in range(y,y+h,16):
        for xx in range(x,x+w,16):cover.paste(tile('stone' if y==62 else 'dock'),(xx,yy))
for x,y,w in [(10,58,64),(205,29,66),(275,34,42)]:
    d.rectangle((x,y,x+w,y+44),fill=P['plaster']);d.rectangle((x,y+39,x+w,y+44),fill=P['wood']);d.polygon([(x-4,y),(x+w//2,y-18),(x+w+4,y)],fill=P['roof'])
    for wx in range(x+8,x+w-5,17):d.rectangle((wx,y+9,wx+8,y+20),fill=P['teal']);d.line((wx+4,y+9,wx+4,y+20),fill=P['ochre'])
d.line((90,18,90,100),fill=P['wood'],width=5);d.line((90,19,140,39),fill=P['woodlight'],width=4);d.line((138,39,138,77),fill=P['ink'],width=1);d.rectangle((133,77,143,81),fill=P['wood'])
cover.alpha_composite(human('tavian').resize((32,48),Image.Resampling.NEAREST),(154,103));cover.alpha_composite(creature('rillik',large=True),(179,123));cover.alpha_composite(human('nia'),(110,79))
cover.save(OUT/'cover.png',optimize=True)

# An opaque porthole keeps Rillik legible through round and squircle launcher masks.
launcher = Image.new('RGB', (64, 64), P['ink'])
porthole = ImageDraw.Draw(launcher)
porthole.ellipse((3, 3, 60, 60), fill='#263D3C', outline='#476260')
porthole.ellipse((6, 6, 57, 57), fill=P['darkwood'], outline=P['ochre'], width=2)
porthole.ellipse((9, 9, 54, 54), fill=P['sea'], outline=P['ink'])
porthole.arc((6, 6, 57, 57), 204, 283, fill=P['plaster'])
for x, y in [(22, 15), (36, 13), (42, 22), (18, 44), (30, 48)]:
    porthole.line((x, y, x + 3, y), fill=P['lightsea'])
porthole.ellipse((17, 41, 44, 45), fill=P['ink'])
rillik = creature('rillik', large=True)
launcher.paste(rillik, (7, 7), rillik)
for size in (192, 512):
    launcher.resize((size, size), Image.Resampling.NEAREST).save(OUT / f'icon-{size}.png', optimize=True)

manifest=dict(version=2,original=True,tileSize=16,people=dict(cell=[16,16],frames=15,rows=HUMANS),creatures=dict(cell=[16,16],frames=8,rows=SPECIES),tiles={name:i for i,name in enumerate(TILES)},assets=['harbor-tiles.png','people.png','mesomon.png','battle.png','portraits.png','cover.png']+[f'portraits/{name}.png' for name in HUMANS]+[f'portraits/{name.replace("_","-")}.png' for name in SPECIES])
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Wrote six original PNG atlases/key art and manifest to',OUT)
