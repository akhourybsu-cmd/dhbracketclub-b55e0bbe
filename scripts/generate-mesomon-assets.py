#!/usr/bin/env python3
"""Original hard-pixel Port Marche assets. No external source image or artwork."""
from PIL import Image, ImageColor, ImageDraw
from pathlib import Path
import json

OUT = Path(__file__).resolve().parent.parent / 'public/games/mesomon'
OUT.mkdir(parents=True, exist_ok=True)
P = dict(ink='#102224', slate='#30474A', teal='#2F6667', sea='#244C52', lightsea='#417F7D', marsh='#657D55', ochre='#C09245', plaster='#D8C9A5', foam='#E8E1C6', eden='#9FD6B1', rift='#36243F', wood='#765740', woodlight='#A67D50', darkwood='#483F32', roof='#91564B', skin='#B87955', brass='#C49443')
TILES = ['water','water2','dock','stone','grass','mud','wall','roof','door','stair','reeds','floor','shelf','table','crate','gate','bridge','rift','rope','rail','lamp','sand','channel','flower','chart','map','satchel','rock','sign','awning','window','ship','planks','black','arch','gear']

def field_tile(name):
    """Material studies at the game's native scale. Top light falls to the right."""
    base = {'stone': '#788780', 'floor': '#997759', 'dock': '#916F50',
            'water': '#315E65', 'water2': '#315E65', 'channel': '#234953',
            'roof': '#985c4d', 'wall': '#ceb994', 'window': '#ceb994',
            'rock': '#38474a', 'stair': '#7a877d', 'awning': '#477b79'}
    # Carved furniture and quay fixtures have top, front and return planes.
    if name in ('shelf', 'table', 'crate', 'gear', 'rope', 'lamp','reeds','door','rift'):
        im = field_tile('dock' if name in ('crate','rope') else 'floor' if name in ('shelf','table','door') else 'stone')
        d = ImageDraw.Draw(im)
        def rect(box,color):
            d.rectangle(box,fill=color)
        def line(points,color,width=1):
            d.line(points,fill=color,width=width)
        if name=='crate':
            d.polygon([(0,4),(9,1),(14,3),(15,12),(7,15),(1,13)],fill='#504438')
            d.polygon([(1,4),(8,2),(13,3),(7,6)],fill='#c19b6e')
            d.polygon([(2,5),(7,7),(7,13),(2,12)],fill='#a17750')
            d.polygon([(8,7),(13,5),(13,11),(8,13)],fill='#816348')
            line((2,6,6,12),'#d2a871',2)
            line((8,12,12,6),'#b28b5d')
        elif name=='shelf':
            rect((0,0,15,14),'#4a4036')
            for y in (1,7):
                for x,w,h,col in ((2,2,3,'#b58d5f'),(5,1,4,'#bdba93'),(8,2,2,'#77a492'),(12,1,3,'#ad7156')):
                    rect((x,y+4-h,x+w,y+4),col)
                    d.point((x,y+4-h),fill='#d3bd91')
                rect((0,y+4,15,y+5),'#916d4c')
                line((0,y+4,14,y+4),'#c29668')
            rect((1,13,2,15),'#554437')
            rect((13,13,14,15),'#554437')
        elif name=='table':
            rect((2,6,14,14),'#654e3b')
            rect((3,12,12,14),'#987858')
            d.polygon([(0,5),(2,2),(14,2),(15,8),(13,10),(1,9)],fill='#594838')
            d.polygon([(1,5),(3,3),(13,3),(14,7),(2,8)],fill='#b99060')
            rect((4,4,10,6),'#dbc69f')
            line((5,5,8,5),'#778b78')
        elif name=='door':
            rect((1,0,14,15),'#574e43')
            rect((2,0,12,14),'#b7976c')
            rect((4,2,11,14),'#6b5341')
            rect((5,3,10,10),'#86674c')
            rect((6,4,9,7),'#426166')
            line((6,4,8,4),'#9eab99')
            rect((9,10,10,11),'#d7b67c')
            line((2,15,14,15),'#c1b79a')
        elif name=='rope':
            for box in ((1,4,13,13),(3,5,11,11),(5,6,9,9)):
                d.ellipse(box,outline='#5b4d38',width=2)
                d.arc(box,155,325,fill='#d0a974',width=2)
            line((9,9,12,9,15,12),'#c29a65')
        elif name=='gear':
            d.ellipse((1,2,15,15),fill='#394942')
            d.ellipse((1,1,14,14),outline='#a98a57',width=3)
            d.arc((1,1,14,14),175,290,fill='#dec18a',width=2)
            for a,b in (((3,3),(12,12)),((2,10),(12,4)),((8,2),(7,13))):
                line((*a,*b),'#92794e',2)
            d.ellipse((5,5,10,10),fill='#c3a36a',outline='#595440')
        elif name=='lamp':
            d.ellipse((5,12,13,15),fill='#546760')
            rect((7,6,8,13),'#443f35')
            rect((4,3,11,9),'#4e5142')
            rect((5,4,10,8),'#ddab5c')
            rect((6,4,8,7),'#f3da94')
            d.polygon([(3,3),(7,0),(9,0),(12,3)],fill='#56645a')
            line((4,9,11,9),'#a08b62')
        elif name=='reeds':
            rect((0,0,15,15),'#64795b')
            for x,y,h in ((1,13,5),(5,11,8),(9,15,7),(13,10,8)):
                line((x,y,x+1,y-h),'#435c48',2)
                line((x,y-1,x-2,y-5),'#8fa078')
                line((x+1,y-h,x+1,y-h-2),'#af8957',2)
        else:
            d.polygon([(5,15),(7,10),(3,8),(7,4),(6,1),(12,0),(10,6),(14,8),(10,11),(10,14)],fill='#392e46')
            line((9,0,8,5,10,8,7,12,7,15),'#bc96bc')
            d.point((4,5),fill='#c6abce')
            d.point((12,12),fill='#8e7398')
        return im
    if name in ('planks','ship','bridge','chart','map','satchel','sign'):
        im = field_tile('dock')
        d = ImageDraw.Draw(im)
        if name in ('bridge','ship'):
            d.line((0,0,15,0), fill='#b29571', width=2)
            d.line((0,15,15,15), fill='#5c4c3f', width=2)
        elif name in ('chart','map'):
            d.polygon([(1,3),(5,2),(9,3),(14,2),(13,12),(9,13),(6,12),(2,13)],fill='#d6c69d')
            d.line((3,9,5,7,8,8,11,5,13,5),fill='#649088',width=2)
            d.line((4,4,5,4,7,5),fill='#aa7857')
            d.point((11,9),fill='#925c49')
        elif name=='satchel':
            d.arc((4,1,11,9),180,360,fill='#534a3c',width=2)
            d.rectangle((3,6,12,13),fill='#6d503a')
            d.rectangle((4,5,11,9),fill='#a88155')
            d.rectangle((7,8,8,10),fill='#d2ac70')
        elif name=='sign':
            d.rectangle((7,7,9,15),fill='#5a4938')
            d.rectangle((1,2,14,9),fill='#63523e')
            d.line((2,2,13,2),fill='#bf996a')
            d.line((3,4,11,4),fill='#dbc79e')
            d.line((3,6,8,6),fill='#b99c6c')
        return im
    if name in ('grass','flower','mud','sand'):
        color = {'grass':'#607854','flower':'#607854','mud':'#77695a','sand':'#b6a680'}[name]
        im = Image.new('RGBA',(16,16),color)
        d = ImageDraw.Draw(im)
        if name in ('grass','flower'):
            for x,y in ((3,4),(11,12)):
                d.line((x-2,y-1,x,y+1,x+2,y-2),fill='#81916e')
                if name=='flower':
                    d.rectangle((x,y-3,x+1,y-2),fill='#dace9c')
        else:
            for x,y in ((1,4),(9,11)):
                d.line((x,y,x+3,y),fill='#a29676' if name=='sand' else '#6a6153')
        return im
    if name in ('black','arch','rail','gate'):
        im = Image.new('RGBA',(16,16),P['ink']) if name=='black' else field_tile('stone')
        d = ImageDraw.Draw(im)
        if name=='arch':
            d.polygon([(2,15),(2,6),(5,2),(10,2),(13,5),(13,15)],fill='#b1a68a')
            d.polygon([(4,15),(4,6),(7,4),(10,5),(11,7),(11,15)],fill=P['ink'])
        if name in ('rail','gate'):
            for x in (1,7,13):
                d.rectangle((x,1,x+1,15),fill='#484a40')
                d.line((x,1,x,13),fill='#ab986e')
            for y in (4,11):
                d.rectangle((0,y,15,y+1),fill='#585340')
                d.line((0,y,15,y),fill='#9d875f')
        return im
    im = Image.new('RGBA', (16, 16), base[name])
    d = ImageDraw.Draw(im)
    def line(points, color):
        d.line(points, fill=color)
    def rect(box, color):
        d.rectangle(box, fill=color)
    if name in ('water', 'water2', 'channel'):
        y = 4 if name == 'water' else 10
        d.polygon([(-2,y+2),(2,y),(8,y),(11,y-2),(16,y-2),(16,y),(12,y),(8,y+2)],
                  fill='#38676d' if name != 'channel' else '#305861')
        line((1,y+1,6,y+1), '#48797a')
        line((7,y,9,y-1), '#548382')
        line((10,(y+8)%16,14,(y+8)%16), '#294f59')
    elif name in ('floor','dock'):
        for y,joint in ((0,4),(8,12)):
            rect((0,y,15,y), '#6b5344')
            rect((0,y+1,15,y+1), '#ad8962')
            line((joint,y+2,joint,y+7), '#725844')
            line((joint+2,y+3,joint+2,y+3), '#604c3e')
        line((0,5,3,5), '#9e7955')
        line((6,13,9,13,11,12), '#a5805b')
        if name == 'floor':
            rect((0,9,11,14), '#a58160')
            line((2,12,7,12), '#b18c68')
    elif name in ('rock','stone'):
        dark,light,face = ('#29383e','#52605c','#414e4f') if name=='rock' else ('#62746e','#97a295','#839187')
        for x,y in ((-4,1),(7,1),(1,9),(12,9)):
            d.polygon([(x,y+1),(x+1,y),(x+8,y),(x+9,y+1),(x+8,y+5),(x+1,y+5)],fill=face)
            line((x,y+5,x+7,y+5,x+9,y+3),dark)
            line((x+1,y+1,x+3,y,x+7,y),light)
    elif name=='stair':
        for y in (0,8):
            rect((0,y,15,y+3),'#97a193')
            rect((0,y+3,15,y+3),'#c5c4aa')
            rect((0,y+4,15,y+5),'#586966')
            rect((0,y+6,15,y+7),'#647572')
            line((3+y,y+1,4+y,y+1),'#a8ad9b')
    elif name=='roof':
        for y,offset in ((0,-4),(8,0)):
            for x in range(offset-8,16,8):
                d.polygon([(x,y),(x+7,y),(x+6,y+5),(x+4,y+7),(x,y+6)], fill='#ac6c55')
                line((x,y+1,x+1,y+4), '#c28262')
                line((x+6,y+1,x+5,y+5,x+3,y+6), '#805144')
                line((x,y+7,x+4,y+7), '#63463f')
    elif name=='awning':
        for x in (0,8):
            rect((x,0,x+3,12),'#d1c39d')
            rect((x,1,x,10),'#e8dbb3')
            rect((x+4,1,x+4,10),'#548e83')
        rect((0,11,15,13),'#354d49')
        for x,col in ((0,'#b7a782'),(4,'#46746e'),(8,'#b7a782'),(12,'#46746e')):
            rect((x,11,x+3,13),col)
            rect((x+1,14,x+2,14),col)
        rect((0,15,15,15),'#344641')
    elif name in ('window','wall'):
        rect((0,0,15,1),'#826b58')
        rect((0,2,15,3),'#ac9779')
        line((2,6,5,6), '#dbc7a1')
        line((11,9,14,9), '#bca888')
        rect((0,13,15,15),'#887966')
        line((0,13,15,13),'#aa9475')
        if name=='window':
            rect((3,4,13,13),'#a18b70')
            rect((2,3,12,12),'#5a5145')
            rect((3,4,11,10),'#385962')
            rect((4,4,6,7),'#6c9390')
            line((4,6,6,4),'#abb4a1')
            rect((7,4,7,11),'#997952')
            rect((2,11,12,11),'#dec495')
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
    # Curved zinc roof and its projecting drip edge sit above a glazed pilot house.
    d.polygon([(40,3),(43,5),(46,24),(44,27),(39,23)],fill='#456764')
    d.polygon([(6,5),(9,3),(13,3),(9,23),(4,23)],fill='#819b92')
    d.line((5,23,40,23),fill='#77918a')
    d.line((5,28,43,28),fill='#3c524d',width=2)
    d.rectangle((16,31,29,42),fill='#594f40')
    d.rectangle((17,31,28,40),fill='#d1b489')
    d.rectangle((18,32,27,36),fill='#36575b')
    d.line((19,33,22,33),fill='#94af9d')
    d.line((23,32,23,36),fill='#a1855f')
    d.line((19,39,26,39),fill='#a1855f')
    d.rectangle((42,29,44,42),fill='#745e49')
    d.rectangle((13,15,32,19),fill='#526c67')
    d.polygon([(14,13),(18,7),(30,7),(32,14),(29,17),(15,17)],fill='#405751')
    d.polygon([(15,13),(19,8),(29,8),(30,13)],fill='#bca57d')
    d.rectangle((16,14,30,16),fill='#80795f')
    for x in (19,22,25):
        d.line((x,10,x+2,10),fill='#786f57')
    d.line((4,43,43,43),fill='#c29b6e')
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
    # Model the brow, cheek and jacket independently of travel orientation.
    def shade(color, delta):
        return tuple(max(0,min(255,c+delta)) for c in ImageColor.getrgb(color)) + (255,)
    head_y = int(frame != 0)
    for y in range(1,13):
        for x in range(3,13):
            p=im.getpixel((x,y))
            if p == ImageColor.getrgb(hair)+(255,) and x in (4,5,6) and y==2+head_y:
                im.putpixel((x,y),shade(hair,23))
            if p == ImageColor.getrgb(skin)+(255,) and (x>=10 or y==7+head_y):
                im.putpixel((x,y),shade(skin,-25))
            if p == ImageColor.getrgb(coat)+(255,) and x>=10:
                im.putpixel((x,y),shade(coat,-18))
    if name=='porter':
        draw.rectangle((10,9,13,12),fill='#685240')
        draw.line((10,9,13,9),fill='#c09c6e')
    elif name=='lanternkeeper':
        draw.rectangle((2,11,4,14),fill='#655a45')
        draw.point((3,12),fill='#efcb82')
    elif name=='edda':
        draw.line((5,3+head_y,9,2+head_y),fill='#e0d9bd')
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
    if direction == 'right':
        im = im.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    # Give the torso an underside while keeping the eyes and species markings intact.
    base = ImageColor.getrgb(palette['c'])
    underside = tuple(max(0, v - 17) for v in base) + (255,)
    for py in range(7,15):
        for px in range(1,15):
            if im.getpixel((px,py))[:3] == base:
                below = im.getpixel((px,py+1))
                if below[3] == 0 or below[:3] == ImageColor.getrgb(P['ink']):
                    im.putpixel((px,py), underside)
    return im

monsters = Image.new('RGBA', (16 * 8, 16 * len(SPECIES)))
for row, name in enumerate(SPECIES):
    for index, direction in enumerate(directions):
        for step in (0, 1):
            monsters.paste(field_creature(name, direction, step), (16 * (index * 2 + step), 16 * row))
monsters.save(OUT/'mesomon.png', optimize=True)
def battle_creature(name):
    im = creature(name,large=True)
    d = ImageDraw.Draw(im)
    if name=='rillik':
        d.polygon([(18,22),(22,24),(29,25),(32,28),(25,27),(20,26)],fill='#709391')
        d.polygon([(11,31),(19,30),(24,31),(30,29),(33,30),(30,32),(13,33)],fill='#42636f')
        d.line((11,17,10,12,13,16),fill='#b1c2ac')
        d.line((18,18,19,14),fill='#c1ccaf')
        d.line((13,35,16,35),fill='#78958e')
        d.line((39,30,42,26),fill='#79998e')
    elif name=='muddren':
        for x,y in [(15,20),(23,18),(30,24)]:
            d.polygon([(x,y-2),(x+4,y+4),(x+1,y+4)],fill='#888c67')
            d.line((x-2,y+2,x,y-1),fill='#d2c18d')
        d.line((15,32,22,34,30,31),fill='#596c54',width=2)
        d.line((8,29,12,29),fill='#c4b689')
    elif name=='gleamwing':
        for x,sign in [(10,1),(38,-1)]:
            d.line((x,15,x+3*sign,22,x+10*sign,28),fill='#768c77')
            d.line((x+3*sign,22,x+8*sign,23),fill='#e1c98b')
            d.line((x,16,x+2*sign,15),fill='#dfd8ac',width=2)
        d.line((23,23,23,31),fill='#83a898')
    elif name=='tressel':
        d.polygon([(27,18),(30,17),(31,24),(34,29),(28,32),(22,32),(28,28)],fill='#956546')
        d.line((15,18,16,13,19,16),fill='#d4a06b')
        d.line((14,25,17,27,20,26),fill='#c89161')
        d.line((28,34,30,34),fill='#b68a61')
    else:
        for pts in ([(14,12),(19,10),(22,17),(16,16)],[(31,17),(35,17),(37,20),(32,24)],[(17,28),(21,31),(12,34)],[(28,28),(32,29),(35,34),(30,32)]):
            d.polygon(pts,fill='#4b3b57')
        d.line((21,9,22,13),fill='#c0a1bd')
        d.line((16,24,19,22),fill='#a689ad')
    return im

battle=Image.new('RGBA',(48*len(SPECIES),48))
for i,name in enumerate(SPECIES):battle.paste(battle_creature(name),(i*48,0))
battle.save(OUT/'battle.png',optimize=True)
def portrait(name):
    """Three-quarter busts, with clothing and trade details drawn at portrait scale."""
    im = Image.new('RGBA',(48,48))
    d = ImageDraw.Draw(im)
    coat,hair,skin,trim = {
        'tavian': ('#487676','#304449','#cc9772','#9fd6b1'),
        'nia': ('#ae7951','#3e5140','#a6b482','#dfbd86'),
        'bram': ('#6f795b','#c6bda0','#b48a68','#bbb68a'),
        'seli': ('#70815e','#aca182','#cfb18b','#d8c496'),
        'pell': ('#9c8050','#604d3d','#c09676','#e7c788'),
        'captain': ('#516f78','#999c8e','#c5a27f','#dcbc76'),
        'edda': ('#796d87','#c2bbaa','#bb967c','#e0d3b6'),
        'fisher': ('#738494','#4c4d51','#ba8866','#cbb88b'),
        'worker': ('#a17a4f','#6b5341','#c39770','#e0b174'),
        'porter': ('#92756b','#634f47','#b38565','#d0b694'),
        'lanternkeeper': ('#587965','#4e5849','#ba9272','#edc779'),
        'vendor': ('#a16f61','#664b49','#c19779','#e6bd8f'),
    }[name]
    def tone(color,delta):
        return tuple(max(0,min(255,c+delta)) for c in ImageColor.getrgb(color))
    def poly(points,color):
        d.polygon(points,fill=color)
    ink='#293b3b'
    poly([(3,47),(5,39),(10,34),(17,32),(18,28),(13,20),(13,12),(17,6),(25,3),(32,5),(37,10),(36,24),(32,29),(32,32),(41,35),(45,40),(47,47)],ink)
    poly([(5,47),(7,39),(15,34),(19,33),(29,33),(38,35),(43,40),(45,47)],coat)
    poly([(27,33),(32,33),(39,37),(41,41),(40,47),(29,47)],tone(coat,-22))
    poly([(9,39),(16,35),(19,35),(16,39),(9,42)],tone(coat,23))
    poly([(16,34),(20,30),(28,29),(32,33),(27,38),(22,39)],trim)
    poly([(19,29),(21,25),(29,26),(29,32),(24,35),(20,34)],tone(skin,-25))
    poly([(15,14),(19,8),(27,7),(33,10),(35,16),(33,24),(30,27),(26,30),(20,29),(16,25),(14,21),(15,19)],skin)
    poly([(29,12),(34,13),(33,19),(36,17),(35,22),(31,24),(30,27),(26,29),(24,28),(28,25)],tone(skin,-25))
    poly([(15,14),(15,11),(19,6),(25,5),(31,6),(35,10),(36,14),(34,18),(30,20),(29,14),(24,12),(18,14)],hair)
    poly([(15,12),(18,8),(25,6),(29,7),(23,8),(20,11)],tone(hair,25))
    d.line((17,17,20,16),fill=tone(hair,-8))
    d.line((23,16,27,16),fill=tone(hair,-8))
    d.point((18,18),fill=ink)
    d.line((24,18,25,18),fill=ink)
    d.line((21,19,20,22,22,22),fill=tone(skin,-25))
    d.line((21,25,25,24),fill=tone(skin,-48))
    d.line((19,20,17,21),fill=tone(skin,15))
    d.line((17,35,21,39,26,36),fill=tone(trim,-30),width=2)
    if name in ('captain','worker','fisher','vendor'):
        poly([(11,12),(14,8),(16,5),(29,3),(34,6),(36,10),(31,12),(22,11),(15,14)],tone(coat,-15))
        d.line((13,12,21,10,32,9),fill=trim,width=2)
        if name=='captain':
            d.rectangle((23,6,26,8),fill=trim)
        if name=='fisher':
            d.line((14,9,25,6,33,7),fill=tone(coat,28),width=2)
    elif name in ('nia','seli'):
        poly([(31,18),(42,12),(39,18),(33,23),(31,22)],tone(skin,-16))
        d.line((33,19,39,15),fill=tone(skin,20))
    elif name=='bram':
        poly([(14,22),(18,24),(22,23),(26,22),(31,19),(31,26),(26,32),(20,31),(16,28)],hair)
        d.line((18,25,21,28,25,28),fill=tone(hair,22))
    elif name=='tavian':
        poly([(15,12),(16,7),(20,4),(23,4),(27,1),(27,5),(32,5),(34,7),(25,7),(22,10)],hair)
        d.line((12,47,27,36,31,35),fill='#7d6048',width=3)
        d.rectangle((19,41,22,43),outline='#d3ac70')
    elif name=='edda':
        d.ellipse((33,6,40,14),fill=hair,outline=tone(hair,-38))
        d.line((16,17,20,17,21,20,17,20,16,17,23,17,27,17,26,20,23,20,23,17),fill='#817653')
    elif name=='pell':
        d.line((28,19,28,24),fill=hair,width=2)
        d.line((18,24,20,23,24,23),fill=hair)
    if name in ('bram','porter','worker'):
        d.line((12,36,17,47),fill=tone(coat,-30),width=4)
        d.rectangle((13,39,16,41),outline=trim)
    if name=='lanternkeeper':
        d.ellipse((28,37,33,43),fill='#896c45',outline='#d5b37b')
        d.rectangle((30,39,31,41),fill='#f1d295')
    return im

portraits=Image.new('RGBA',(48*len(HUMANS),48))
for i,name in enumerate(HUMANS):
    portraits.paste(portrait(name),(i*48,0))
portraits.save(OUT/'portraits.png',optimize=True)
(OUT/'portraits').mkdir(exist_ok=True)
for i,name in enumerate(HUMANS): portraits.crop((i*48,0,(i+1)*48,48)).save(OUT/'portraits'/f'{name}.png',optimize=True)
for i,name in enumerate(SPECIES): battle.crop((i*48,0,(i+1)*48,48)).save(OUT/'portraits'/f'{name.replace("_","-")}.png',optimize=True)

def scenery():
    sheet = Image.new('RGBA', (128, 64))
    d = ImageDraw.Draw(sheet)
    # A timber sheer-leg crane with a geared drum, pulley and rope sling.
    d.ellipse((6,39,43,47),fill='#34454380')
    d.polygon([(5,37),(17,33),(38,37),(42,40),(29,45),(5,41)],fill='#493e34')
    d.polygon([(5,37),(18,33),(38,37),(28,41)],fill='#b08d61')
    d.line((11,38,21,18,31,39),fill='#423e35',width=5)
    d.line((11,37,21,17,31,38),fill='#93754f',width=3)
    d.line((17,36,17,5),fill='#443c35',width=7)
    d.line((15,34,15,6),fill='#c59e6b',width=2)
    d.line((18,35,18,6),fill='#97734f',width=3)
    d.polygon([(11,10),(12,4),(19,3),(43,10),(46,13),(42,16)],fill='#463e38')
    d.polygon([(12,6),(17,4),(43,11),(42,13)],fill='#cba678')
    d.line((19,24,37,13),fill='#554637',width=4)
    d.line((19,22,36,13),fill='#a78153',width=2)
    d.line((22,28,41,12),fill='#52635b')
    d.ellipse((38,9,45,16),fill='#403e34',outline='#b28c52')
    d.point((41,12),fill='#dfbf80')
    d.line((43,16,43,28),fill='#665338')
    d.line((43,27,45,29,43,32,41,32,40,30),fill='#3b403b',width=2)
    d.ellipse((12,26,23,37),fill='#47473b',outline='#b9965c',width=2)
    d.ellipse((15,29,20,34),fill='#94764e',outline='#594e37')
    d.line((17,31,23,28),fill='#e0bc78')
    # A sluice wheel mounted on a cast-iron pedestal.
    d.polygon([(51,27),(56,23),(73,23),(78,27),(75,30),(52,30)],fill='#39474a')
    d.polygon([(55,26),(59,14),(69,14),(73,27)],fill='#60716c')
    d.ellipse((51,1,76,26),fill='#293c40')
    d.ellipse((53,3,74,24),fill='#748079',outline='#bd9961',width=2)
    d.ellipse((56,6,71,21),fill='#344b4b')
    for tip in ((64,4),(72,8),(73,17),(66,23),(57,21),(54,13),(57,6)):
        d.line((64,14,*tip),fill='#a48c63',width=2)
    d.arc((52,2,75,25),175,292,fill='#e4c48b',width=2)
    d.ellipse((60,10,67,17),fill='#544d3d',outline='#d0ab6d',width=2)
    # High prow and swept transom, painted at an angle to the quay.
    d.polygon([(81,21),(87,14),(104,6),(124,4),(122,14),(111,23),(92,29),(84,28)],fill='#284a52')
    d.polygon([(81,19),(87,12),(106,4),(126,2),(123,13),(111,21),(91,27),(83,25)],fill='#493f37')
    d.polygon([(82,18),(89,12),(107,5),(124,3),(119,12),(103,20),(87,24)],fill='#d0a36e')
    d.polygon([(86,18),(92,12),(110,6),(121,5),(116,11),(102,18),(89,22)],fill='#526c69')
    d.line((85,24,92,25,110,19,120,12),fill='#a1624b',width=2)
    for x,y in ((91,15),(99,11),(109,7)):
        d.line((x,y,x+5,y+4),fill='#332f2b',width=3)
        d.line((x,y-1,x+5,y+3),fill='#c39669',width=2)
    d.line((90,23,115,6),fill='#d7b785')
    return sheet

scenery().save(OUT/'scenery.png', optimize=True)

def harbor_cover():
    im = Image.new('RGBA', (320,180), '#b5c0aa')
    d = ImageDraw.Draw(im)
    def poly(points,color):
        d.polygon(points,fill=color)
    def line(points,color,width=1):
        d.line(points,fill=color,width=width)
    def box(points,color):
        d.rectangle(points,fill=color)
    # Warm estuary light separates the remote skyline, breakwater and working quay.
    for y,c in ((13,'#c1c8ad'),(29,'#d9cfac'),(43,'#e3d0a6')):
        box((0,y,319,64),c)
    d.ellipse((207,17,228,38),fill='#f0ddb0')
    for x,y,w in [(9,19,44),(83,9,26),(139,27,31),(254,15,39)]:
        poly([(x,y+2),(x+6,y),(x+w-7,y),(x+w,y+2)],'#d8d4b6')
    poly([(0,49),(17,44),(35,45),(52,40),(76,46),(94,44),(117,50),(145,42),(160,41),(179,45),(208,39),(232,42),(255,36),(281,43),(300,38),(319,42),(319,67),(0,67)],'#9cae9d')
    for x,y,w,h in [(0,52,25,8),(27,48,15,12),(48,47,30,13),(86,50,16,10),(126,49,24,11),(154,46,17,14),(178,50,21,10),(255,48,29,12),(290,45,31,15)]:
        box((x,y,x+w,y+h),'#78958a')
        poly([(x-2,y),(x+4,y-5),(x+w-5,y-5),(x+w+2,y)],'#6d8a82')
    box((0,61,319,179),'#49767a')
    for y,spacing in [(65,37),(70,51),(77,49),(85,54),(97,72),(113,91),(134,116)]:
        for x in range(-(y%9),320,spacing):
            w=spacing//3
            line((x,y,x+w,y,x+w+2,y-1),'#67928c')
    for i in range(9):
        w=3+i*2
        line((218-w+i%3,65+3*i,218+w-i%4,65+3*i),'#b5b497')
    # The distant tide beacon and its sloping breakwater.
    poly([(226,64),(245,56),(287,57),(319,53),(319,67),(254,68)],'#516f70')
    box((260,33,267,57),'#c6b799')
    poly([(264,34),(267,34),(268,57),(265,57)],'#8a8f80')
    box((258,32,269,34),'#455f60')
    box((260,27,267,31),'#556864')
    box((261,28,263,31),'#e6c881')
    poly([(258,27),(264,21),(270,27)],'#536661')
    # A foreground customs house with a side elevation and an overhanging roof.
    poly([(0,76),(75,64),(105,74),(105,99),(0,123)],'#746d59')
    poly([(0,67),(60,55),(60,93),(0,109)],'#c5a984')
    poly([(60,55),(90,63),(90,88),(60,93)],'#947d65')
    poly([(-7,67),(17,37),(59,33),(67,53)],'#885746')
    poly([(17,37),(45,32),(76,35),(92,61),(65,56),(57,37)],'#aa7054')
    line((0,66,64,53,91,61),'#4f5042',3)
    for x,y in ((8,75),(27,71),(46,67),(68,66)):
        box((x,y,x+7,y+12),'#655e4e')
        box((x+1,y+1,x+5,y+9),'#527473')
        line((x+2,y+2,x+4,y+2),'#abc0a8')
        line((x+3,y+1,x+3,y+10),'#987951')
    box((31,26,36,37),'#82654f')
    box((29,25,37,27),'#afa080')
    # A moored vessel behind the near jetty. Rigging stays open against the sky.
    poly([(93,82),(112,84),(149,82),(156,77),(149,89),(103,95)],'#344d50')
    line((94,82,109,85,146,82,154,78),'#d1b580',2)
    line((121,83,121,35),'#6f6650',2)
    line((97,83,121,36,150,81),'#78857b')
    poly([(119,41),(117,73),(100,77)],'#d7c8a1')
    poly([(124,44),(142,70),(124,74)],'#b9b599')
    line((119,76,145,70),'#766e57',2)
    # Pier beams and pilings cast separate shadows into the tidal water.
    for x,y in [(10,123),(64,108),(107,100),(171,126),(237,109),(292,97)]:
        poly([(x,y),(x+6,y-1),(x+5,y+23),(x+1,y+25)],'#334d50')
        line((x+1,y+3,x+1,y+18),'#786e56',2)
        line((x+2,y+25,x+13,y+25),'#365e65')
    poly([(0,110),(99,84),(113,96),(0,128)],'#715a46')
    poly([(0,108),(99,82),(113,91),(0,122)],'#ae8a62')
    line((0,122,113,91),'#d1ac78',2)
    poly([(60,180),(60,153),(305,78),(319,81),(319,180)],'#4a4840')
    poly([(60,151),(303,77),(319,81),(319,105),(102,179),(60,179)],'#b3936a')
    for x in range(60,334,13):
        y=151-(x-60)*74//243
        line((x,y,x+28,y+12),'#876e52')
        line((x+1,y,x+28,y+11),'#c2a178')
    line((92,179,319,103),'#d5b382',3)
    poly([(106,180),(319,109),(319,116),(132,180)],'#725b47')
    # A timber jib frames the harbor panorama on the right.
    for pts,color,width in [
        ((278,102,278,6),'#353d37',10),((275,100,275,7),'#a68055',4),
        ((279,66,238,31),'#534b3a',7),((278,62,239,29),'#ae885c',3),
        ((292,-6,225,28),'#423f34',9),((292,-8,224,26),'#b58f63',4),
        ((225,28,225,58),'#575c4f',1),((228,28,228,58),'#73755f',1),
        ((248,105,276,67,299,94),'#514a3b',6)]:
        line(pts,color,width)
    d.ellipse((221,25,230,34),fill='#454b40',outline='#ae935e',width=2)
    line((225,58,222,61,225,65,229,63),'#50574b',2)
    # Distinct foreground silhouettes bookend the two travelers.
    for x,y in ((104,147),(205,116),(298,88)):
        box((x,y-7,x+5,y+4),'#575241')
        d.ellipse((x-1,y-9,x+6,y-5),fill='#d0ad7a',outline='#796549')
    # Retaining beams hold up the near face of the jetty. A net hangs over the cap.
    for x in range(121,330,34):
        y=178-(x-100)//3
        poly([(x,y+3),(x+7,y),(x+7,179),(x+2,179)],'#5d5141')
        line((x+2,y+4,x+2,179),'#71614b',2)
    for i in range(8):
        x=247+i*5
        y=130-i*2
        line((x,y,x+4,y+17,x+8,y+20),'#8c8769')
        line((x,y+15,x+7,y+6),'#838068')
    for x,y in ((275,97),(297,90),(297,74)):
        poly([(x,y),(x+13,y-5),(x+24,y),(x+10,y+6)],'#b79366')
        poly([(x,y),(x+10,y+6),(x+10,y+20),(x,y+14)],'#90704e')
        poly([(x+10,y+6),(x+24,y),(x+24,y+14),(x+10,y+20)],'#745d45')
        line((x+2,y+3,x+9,y+16),'#b08c61',2)
        line((x+12,y+16,x+22,y+3),'#9c7953',2)
    d.ellipse((149,133,183,139),fill='#776c54')
    d.ellipse((178,128,211,134),fill='#776c54')
    # Tavian turns back from the quay, his windblown scarf and cuff catching the light.
    poly([(155,135),(157,127),(159,119),(157,116),(155,121),(152,121),(153,114),
          (157,109),(157,106),(155,103),(157,97),(163,95),(169,96),(171,100),
          (170,105),(168,108),(173,113),(175,120),(173,123),(170,120),
          (168,124),(170,132),(173,134),(172,136),(167,136),(163,126),
          (160,132),(160,136),(154,137)],'#263c40')
    poly([(156,114),(159,109),(166,108),(170,110),(173,117),(170,118),
          (167,115),(167,122),(158,123),(159,115),(155,119)],'#487879')
    poly([(157,113),(159,110),(163,110),(160,114)],'#76a19a')
    poly([(158,101),(163,99),(168,101),(168,104),(166,107),(162,108),(158,105)],'#c2936c')
    line((166,102,166,104,164,106),'#a37858')
    line((157,101,161,99,165,99,169,101),'#35494a',2)
    line((157,98,160,96,165,96),'#647a71')
    d.point((159,103),fill='#364340')
    poly([(158,108),(163,109),(167,107),(169,109),(163,113),(158,111)],'#c19b66')
    poly([(163,110),(157,112),(151,110),(147,112),(151,108),(157,110)],'#bd8d58')
    line((171,117,173,117),'#a2d7b4',2)
    line((159,122,167,111),'#795e46',2)
    box((157,119,161,124),'#8c6e4e')
    line((157,119,161,119),'#c19b63')
    line((157,134,159,133),'#657469',2)
    im.alpha_composite(creature('rillik',large=True),(175,95))
    return im

harbor_cover().save(OUT/'cover.png',optimize=True)

def fieldcase():
    """A brass cuff rests on its side in the felt-lined field instrument case."""
    im = Image.new('RGB', (216,90), '#574d40')
    d = ImageDraw.Draw(im)
    poly = d.polygon
    line = d.line
    # Rolled leather lip and inset green felt tray.
    poly([(0,7),(10,0),(207,0),(215,6),(215,83),(209,89),(5,89),(0,83)],fill='#977654')
    poly([(3,8),(11,3),(205,3),(212,8),(212,79),(206,85),(10,85),(3,79)],fill='#554c3f')
    poly([(8,12),(15,7),(201,7),(207,12),(207,74),(200,80),(15,80),(8,74)],fill='#273e3f')
    poly([(11,16),(17,11),(200,11),(204,15),(204,72),(199,77),(16,77),(11,72)],fill='#435954')
    line([(15,75),(199,75),(203,72)],fill='#607064')
    for x in range(14,204,9):
        line((x,4,x+3,4),fill='#c2a078')
        line((x,84,x+3,84),fill='#bd986e')
    # Pressed corners and rivets secure the case.
    for x,sign in ((1,1),(214,-1)):
        for y,dy in ((2,1),(87,-1)):
            poly([(x,y),(x+13*sign,y),(x+10*sign,y+3*dy),(x+4*sign,y+4*dy),(x+2*sign,y+11*dy),(x,y+12*dy)],fill='#b69a6d')
            d.point((x+3*sign,y+2*dy),fill='#685c47')
    # Folded cream letter under a leather retaining loop.
    for points,col in [
        ([(151,21),(191,16),(198,46),(157,53)],'#344944'),
        ([(148,18),(190,13),(195,43),(153,49)],'#9f967c'),
        ([(148,17),(189,12),(194,41),(153,47)],'#c4b999'),
        ([(151,19),(186,14),(172,34)],'#ded0ad'),
        ([(154,44),(167,28),(173,34),(181,23),(193,40)],'#d1c4a2')]:
        poly(points,fill=col)
    line((149,18,172,34,188,14),fill='#ab9d7e')
    poly([(180,11),(185,10),(192,45),(187,46)],fill='#76634d')
    line((181,12,187,44),fill='#a38963')
    # Cord is wound into an irregular oval. The loose end doubles back through its turns.
    for offset in (0,3,6,9):
        ring=(128+offset,47+offset//2,180-offset,72-offset//2)
        d.ellipse(ring,outline='#394640',width=4)
        d.ellipse((ring[0],ring[1]-1,ring[2],ring[3]-1),outline='#a28960',width=2)
        d.arc((ring[0],ring[1]-1,ring[2],ring[3]-1),170,287,fill='#c2a777',width=2)
    line([(153,62),(167,66),(177,68),(187,67),(193,62),(189,60)],fill='#384942',width=4)
    line([(153,61),(167,65),(177,67),(187,66),(193,61),(189,59)],fill='#bea477',width=2)
    # A broad open cylinder. The two distinct rims show its bore and thickness.
    d.ellipse((34,49,121,73),fill='#344a45')
    poly([(36,32),(43,23),(64,17),(87,15),(99,18),(109,25),(115,39),
          (114,50),(107,59),(76,69),(55,68),(43,61),(36,47)],fill='#463e34')
    poly([(42,30),(62,21),(84,17),(95,18),(105,23),(109,30),(80,43),(52,48)],fill='#b79963')
    poly([(47,41),(67,32),(104,24),(111,30),(114,41),(111,51),
          (104,56),(73,66),(58,65)],fill='#8f754e')
    poly([(53,51),(82,42),(114,34),(113,41),(83,50),(55,59)],fill='#a98a57')
    poly([(56,61),(83,54),(110,45),(110,50),(102,56),(74,65),(60,65)],fill='#685d43')
    line((70,64,103,54,109,49),fill='#baa16b',width=2)
    line((79,19,88,18,97,20,104,25),fill='#e2c58c',width=2)
    d.ellipse((34,23,73,69), fill='#6e6046',outline='#534b39')
    d.ellipse((33,22,70,66), fill='#c3a56d')
    d.ellipse((37,26,66,62), fill='#363c35')
    d.ellipse((41,29,65,60), fill='#544c3e')
    d.arc((37,26,66,62),13,147,fill='#99845a',width=2)
    d.arc((34,23,69,65),170,307,fill='#e4cb94',width=2)
    # Recessed, dark sea-glass core with a burnished bezel and a small winding lug.
    poly([(66,30),(71,22),(86,18),(97,21),(101,28),(96,35),(78,41),(69,38)],fill='#5d5743')
    poly([(65,28),(71,21),(86,17),(96,20),(99,26),(94,32),(77,38),(68,35)],fill='#d0b47c')
    poly([(69,28),(73,23),(86,20),(94,22),(96,26),(92,30),(77,35),(71,33)],fill='#474e42')
    poly([(72,28),(75,24),(86,21),(92,23),(93,27),(89,29),(77,33),(73,31)],fill='#4b6a63')
    poly([(73,28),(76,25),(86,22),(83,26),(76,30)],fill='#718b79')
    poly([(76,31),(84,26),(92,24),(93,27),(88,29),(78,32)],fill='#344f4d')
    line((73,23,83,20),fill='#e5c98e')
    for x,y in ((67,30),(94,21),(77,36)):
        d.point((x,y),fill='#705e42')
    poly([(96,36),(103,33),(108,35),(108,40),(101,43),(96,41)],fill='#64553e')
    line((97,36,103,34,106,35),fill='#c4a56c',width=2)
    return im

fieldcase().save(OUT/'fieldcase.png',optimize=True)

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

field_plates = [f'field-guide/{name}.webp' for name in SPECIES]
battle_scenes = [f'battle-scenes-v1/{key}.webp' for key in ('passage-encounter', 'gleamwing-encounter', 'chamber-boss')]
manifest = dict(
    version=4, original=True, tileSize=16,
    scenery={'crane':dict(x=0,y=0,width=48,height=48),'wheel':dict(x=48,y=0,width=32,height=32),'skiff':dict(x=80,y=0,width=48,height=32)},
    people=dict(cell=[16, 16], frames=15, rows=HUMANS),
    creatures=dict(cell=[16, 16], frames=8, rows=SPECIES),
    battle=dict(file='creature-battle-v1.png', cell=[192, 192], rows=SPECIES, poses=['rest', 'ready', 'action', 'recoil']),
    fieldGuide=dict(size=[512, 512], files=field_plates),
    battleScenes=dict(version=1, size=[640, 576], files=battle_scenes),
    tiles={name: i for i, name in enumerate(TILES)},
    assets=['harbor-tiles.png','people.png','mesomon.png','creature-battle-v1.png','portraits.png','cover.png','scenery.png','fieldcase.png']
        + [f'portraits/{name}.png' for name in HUMANS + SPECIES] + field_plates + battle_scenes,
)
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Wrote original Port Marche artwork and manifest to',OUT)
