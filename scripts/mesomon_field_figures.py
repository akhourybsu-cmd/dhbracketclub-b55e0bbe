"""Draw the two native Port Marche field atlases from their original 16 px cutouts."""
from pathlib import Path

from PIL import Image, ImageColor, ImageDraw

HUMANS = ['tavian', 'nia', 'bram', 'seli', 'pell', 'captain', 'edda', 'fisher',
          'worker', 'porter', 'lanternkeeper', 'vendor']
SPECIES = ['rillik', 'muddren', 'gleamwing', 'tressel', 'rift-wretch']
DIRECTIONS = ('down', 'left', 'right', 'up')

# Jacket, hair, complexion and collar. Keep the surveyor's coat and Eden cuff
# recognizable from the character portrait and the brass-cuff arrival scene.
CLOTHES = {
    'tavian': ('#467778', '#304346', '#d2a07a', '#9fd6b1'),
    'nia': ('#ab7347', '#384a3a', '#a5af7f', '#e4c17f'),
    'bram': ('#6f795b', '#d0c5a0', '#bb916f', '#a7b18c'),
    'seli': ('#71815b', '#bab290', '#d5b48d', '#d8c698'),
    'pell': ('#9f8751', '#584737', '#bd906c', '#e8cd89'),
    'captain': ('#526d78', '#87918a', '#bd9877', '#dbba75'),
    'edda': ('#776987', '#c1b9ad', '#c39b75', '#e6d8b2'),
    'fisher': ('#717c91', '#393c46', '#c89471', '#c3b98a'),
    'worker': ('#987950', '#59483b', '#ca9570', '#ddb670'),
    'porter': ('#8c7067', '#5e4a40', '#bd8969', '#dbc497'),
    'lanternkeeper': ('#527765', '#47533f', '#cb9e7a', '#edc877'),
    'vendor': ('#a16e60', '#5a4142', '#ca9a74', '#f0c899'),
}

# Shared anatomy. The bright scarf and narrow neck cast a distinct shadow onto
# the shoulders. Hair, clothes and face each have their own middle and side planes.
HEAD = {
    'down': ('...khhkk...', '.khhhhhdkk.', 'khhhhhhhddk', 'khhhhhhdddk',
             'khssshtsshk', 'ksksstksstk', '.ksssvsstk.', '..ktssstkk.'),
    'left': ('....khkk...', '..khhhhdkk.', '.khhhhhhhdk', '.khhhhhhddk',
             '.ksshhhdddk', '.sksshhsddk', 'vssstshhdk.', '.kssstkdk..'),
    'up': ('...khhkk...', '.khhhhhdkk.', 'khhhhhhhddk', 'khhhhhhhddk',
           'khhhhhhhddk', 'kshhhhhddsk', '.khhhdddk..', '..kkhhkk...'),
}
COAT = {
    'down': ('.kcccaaack.', 'kLcccccccrk', 'kLcccccccrk',
             'kvccccccrtk', '.kcccccrrk.', '..krccrrk..'),
    'left': ('..kaaaccck.', '.kaccccccrk', '.kcccccLcrk',
             '.kcccLcccrk', '..kccvcrrk.', '...kccrrk..'),
    'up': ('.kcccLccck.', 'kLcccccccrk', 'kLcccccccrk',
           'kvccccccrtk', '.kcccrrcck.', '..kccrrrk..'),
}


def tone(color, red, green, blue):
    return tuple(max(0, min(255, c + delta)) for c, delta in
                 zip(ImageColor.getrgb(color), (red, green, blue)))


def paint(im, rows, colors, x, y):
    for j, row in enumerate(rows, y):
        for i, color in enumerate(row, x):
            if color != '.':
                im.putpixel((i, j), colors[color])


def palette(values):
    return {key: (ImageColor.getrgb(value) if isinstance(value, str) else value) + (255,)
            for key, value in values.items()}


def person(name, facing, step, index):
    im = Image.new('RGBA', (16, 16))
    d = ImageDraw.Draw(im)
    c, h, s, a = CLOTHES[name]
    colors = palette(dict(
        k='#203035', c=c, L=tone(c, 33, 32, 20), r=tone(c, -30, -28, -19),
        h=h, H=tone(h, 47, 40, 25), d=tone(h, -18, -17, -12),
        s=s, t=tone(s, -40, -34, -20), v=tone(s, 35, 30, 16),
        a=a, b='#896344', g='#deb77a', p='#465455'))
    side = facing in ('left', 'right')
    view = 'left' if side else facing
    bob = int(step == 2)
    # Feet have an overlapping rear boot, a shoe toe and a lit knee.
    boots = [(5, 14 - int(step == 1)), (9, 14 - int(step == 2))]
    if side:
        stride = (0, 1, -1)[step]
        boots = [(6 - stride, 14), (8 + stride, 14 - int(step != 0))]
    for x, y in boots:
        d.rectangle((x, y - 1, x + 2, y), fill=colors['p'])
        d.line((x - int(side), y + 1, x + 2, y + 1), fill=colors['k'])
    paint(im, COAT[view], colors, 2, 8)
    # The corner at the shoulder and break in the belt imply actual folds.
    if not side:
        d.point((4, 9), fill=colors['L'])
    if name in ('tavian', 'bram', 'porter', 'worker', 'fisher'):
        d.line((4, 9, 9, 13) if facing == 'up' else (10, 9, 6, 12), fill=colors['b'])
        d.point((7, 11), fill=colors['g'])
    if name in ('seli', 'vendor'):
        d.polygon([(6, 10), (9, 10), (10, 13), (5, 13)], fill='#cfb58d')
        d.line((7, 10, 8, 10), fill='#ede0b3')
    if name == 'captain' and view == 'down':
        d.line((6, 9, 7, 11, 9, 9), fill='#d8cdab')
        d.point((8, 12), fill=colors['g'])
    paint(im, HEAD[view], colors, 2, bob)
    # The leading face edge of a profile catches the light; the far ear and
    # neck sit in shadow. The fixed screen-left glint is added after mirroring.
    if name in ('nia', 'seli'):
        d.line((2, 6 + bob, 0, 4 + bob), fill=colors['t'])
        d.point((0, 4 + bob), fill=colors['v'])
        if not side:
            d.line((11, 6 + bob, 14, 3 + bob), fill=colors['s'])
        if name == 'seli':
            d.line((11, 6 + bob, 12, 10 + bob), width=2, fill=colors['h'])
            d.point((12, 10 + bob), fill=colors['a'])
        else:
            d.line((8, 1 + bob, 11, bob, 13, 2 + bob), width=2, fill=colors['h'])
    elif name == 'bram' and view != 'up':
        beard = ('hhhhhhd', '.hhHhdd', '..hHdd.') if not side else ('hhhhdd', 'hHhhdd', '.hhdd.')
        paint(im, beard, colors, 4 if not side else 2, 7 + bob)
    elif name == 'edda':
        d.ellipse((10, bob, 14, 4 + bob), fill=colors['h'], outline=colors['d'])
        d.line((11, 1 + bob, 13, 1 + bob), fill=colors['H'])
        if view == 'down':
            d.line((4, 5 + bob, 10, 5 + bob), fill='#7d725b')
            d.point((4, 6 + bob), fill=colors['v'])
            d.point((9, 6 + bob), fill=colors['v'])
    elif name == 'pell' and view != 'up':
        d.line((4, 7 + bob, 6, 7 + bob), fill=colors['d'])
        d.line((9, 3 + bob, 10, 5 + bob), fill=colors['h'])
    elif name == 'tavian':
        d.line((5, 2 + bob, 10, bob), fill=colors['h'])
        d.line((4, 3 + bob, 7, 2 + bob), fill=colors['H'])
        d.point((8, 1 + bob), fill=colors['H'])
    elif name in ('captain', 'worker', 'vendor', 'fisher'):
        # Crown, band and overhanging brim are different constructions.
        if name == 'captain':
            hat = ('..kkkkkk...', '.kLLccccrk.', 'kccccccgcrk', 'kkgggggakk.', '...kkkkk...')
        elif name == 'worker':
            hat = ('...kkkkk...', '..kLLccrrk.', '.kcccccgrrk', 'kggggggggkk')
        elif name == 'fisher':
            hat = ('...kkkk....', '..kLLcckk..', '.kccrccrck.', 'kLcLcccLrrk', '.kkkkkkkkk.')
        else:
            hat = ('.......kk..', '...kkLccrk.', '..kLccccrrk', '.kaaaaaarck')
        paint(im, hat, colors, 2, bob)

    if name == 'porter':
        d.rectangle((10, 8, 14, 12), fill='#64503f')
        d.polygon([(10,8),(12,7),(14,8),(12,9)], fill='#d9ae75')
        d.line((10, 9, 12, 10, 12, 12), fill='#af8357')
    elif name == 'lanternkeeper':
        d.line((3, 10, 1, 12), fill='#776c54')
        d.rectangle((0, 12, 3, 15), fill='#35413b')
        d.line((1, 12, 2, 12), fill='#d0a260')
        d.rectangle((1, 13, 2, 14), fill='#ffdf8f')
    if index in (12, 13):
        x = 11 if index == 12 else 1
        d.rectangle((x, 9, x + 2, 10), fill=colors['r'])
        d.line((x, 9, x + 1, 9), fill=colors['v'])
    if index == 14:
        d.line((4, 5 + bob, 5, 5 + bob), fill=colors['t'])
        d.line((8, 5 + bob, 9, 5 + bob), fill=colors['t'])
    if facing == 'right':
        im = im.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    if name == 'tavian':
        # Fitted to his left wrist: screen right when facing us, screen left
        # from behind. In right profile the far wrist peeks past the coat.
        pen = ImageDraw.Draw(im)
        cuff_x = {'down': 11, 'left': 4, 'right': 10, 'up': 2}[facing]
        cuff_y = 11 + (step == 2) - (step == 1)
        if index == 12:
            cuff_x, cuff_y = 13, 10
            pen.line((11, 9, 13, 9), fill=colors['L'])
        pen.line((cuff_x, cuff_y, cuff_x + 2, cuff_y), fill='#b98a53')
        pen.point((cuff_x, cuff_y), fill='#f1cf87')
        pen.point((cuff_x + 1, cuff_y), fill='#b3f2d1')
        pen.line((cuff_x, cuff_y + 1, cuff_x + 1, cuff_y + 1), fill=colors['s'])
        if view != 'up':
            # One stray lock above the lit cheek; collar, not a glowing bib.
            pen.point((10 if facing == 'right' else 5, bob + 4), fill=colors['d'])
            pen.line((6, 8 + bob, 8, 8 + bob), fill='#d4ad77')
    # A single narrow crest glint keeps the hair volume legible on dark floors.
    for x, y in ((5, 2 + bob), (6, 2 + bob), (4, 3 + bob)):
        if im.getpixel((x, y)) == colors['h']:
            im.putpixel((x, y), colors['H'])
    return im


# Front, profile and rear are separate small drawings. The crest of Rillik's
# ringing tail, the overlapping strata on Muddren, Gleamwing's leaded wings,
# Tressel's rolled plume and the gaps through the Wretch also appear on their
# large illustrated plates. k/s/c/l = outline, near shade, body and upper face;
# a/g = local markings, and n/w = pupil and glint.
CREATURES = {
    'muddren': (
        ('#3d4035','#5b5e47','#84916b','#b2b586','#b7935f','#e3c789','#302e2a','#eedaa0'),
        ('......kkk.......', '....kagllsk.....', '..kallscssckk...',
         '.kagllskalllsk..', '.lccssklcclcsk..', 'kglkagllssklcck.',
         'klcclccsccclcsk.', '.sckklgglkkccsk.', '..klncggcnlssk..',
         '..klllsslllsk...', '.kclagllgascck..', '.kgalskksagalk..', '.kkk....kkkk....'),
        ('......kk........', '....kagllkk.....', '..kallsscslsk...',
         '.lglkagllsscsk..', '.lccklccskalllsk', 'klccclssklcccssk',
         'kllgllkklccsssk.', 'lngllcscccclsk..', 'kgllscsscclccsk.',
         '.kssklskkscssk..', '.kgalcs..kgalsk.', '.kkkk.....kkkk..'),
        ('......kkk.......', '....kagllsk.....', '..kallscssckk...',
         '.kagllskalllsk..', '.lccssklcclcsk..', 'kglkagllssklcck.',
         'klcclccsccclcsk.', '.sckagllsgllcsk.', '..kallssklccsk..',
         '..klcssscllsk...', '.kcllsklssslck..', '.kglskssskaglk..', '.kkk...k...kk...')),
    'gleamwing': (
        ('#3a4145','#4e6967','#4f8b7f','#b4d9ad','#dda75e','#f4d998','#332f34','#faf2b7'),
        ('a............a..', 'klk...a..a..klk.', 'klalk.ak.a.kgak.',
         'kgllck.kakklgak.', '.kalgskggsglak..', '.klglakwckglgk..',
         '..kkcakcgkack...', '..kggskcckagk...', '.kgllk.cs.kglk..',
         '.klak..sk..kalk.', '.kk....k....kk..'),
        ('...........kk...', '.....a...klalk..', '...a.a..kllgak..',
         '....ak.kglalak..', '....kakgglcak...', '...kwgkgllak....',
         '..kglccccask....', '...kscccsggak...', '.....kscklgak...',
         '......k..kalk...', '..........kk....'),
        ('a............a..', 'klk...a..a..klk.', 'klalk.ak.a.kgak.',
         'kglcck.kakklgak.', '.kgalskccsglak..', '.klclakllkglgk..',
         '..kkcaklckack...', '..kggsklskagk...', '.kgllk.cs.kglk..',
         '.klak..sk..kalk.', '.kk....k....kk..')),
    'tressel': (
        ('#4d3935','#805043','#b77b4e','#dba671','#e6c28b','#f5da9e','#382c2f','#fff2bd'),
        ('...k....k.......', '...lck.kck..lkk.', '...kakkack.kllck',
         '...cllccsk.kaack', '..kllccclckkcssk', '..kngllgnskklak.',
         '...lagnglskklck.', '....kgglsk.kcsk.', '...klgglcckccsk.',
         '...kagllcscssk..', '...kcllskcsk....', '...ksck.ksck....', '...kkk..kkk.....'),
        ('..........kkk...', '...k..k..klack..', '...lkkckklsscck.',
         '..kllcckkck.kak.', '.kncllccsk..kak.', 'kggllccsk...kck.',
         '.kgglccllkkksck.', '...kglcclccssk..', '...kallcsscsk...',
         '...klcsskscsk...', '...kssk..ksck...', '...kkk...kkk....'),
        ('...k....k.......', '...lck.kck..lkk.', '...kakkack.kllck',
         '...cllccsk.kaack', '..klllccsckkcssk', '..klcccclckklak.',
         '...kllccsk.klck.', '....kccssk.kcsk.', '...kcccclckccsk.',
         '...kclcccssssk..', '...kcllskcsk....', '...ksck.ksck....', '...kkk..kkk.....')),
    'rift-wretch': (
        ('#332737','#4f3957','#745a80','#ac88a6','#9bd9c4','#e5e3c7','#263e3c','#ddf8d3'),
        ('......l.........', '..k..klk...k....', '..lsklcck.klk...',
         '..kscllcsksk....', '...klcccllsk....', '.lkscagksgask.k.',
         '.ksckkkcclssk.l.', '.....klcccksk...', '..kclsskskcsk...',
         '.klsck..kck.sk..', '.ckk...klsk..l..', '.......ksck.....', '........sk......'),
        ('......lk........', '...k.klck.......', '...lklcck..k....',
         '..kslcclsklk....', '.kagcclssck.....', 'kccllkskklsk.lk.',
         '.kkck...kcsk..k.', '....kslcsk......', '..lklsckk.sk....',
         '..klcsk..kck....', '.kck....ksk.....', '........ks......'),
        ('......l.........', '..k..klk...k....', '..lsklcck.klk...',
         '..kscllcsksk....', '...klcccllsk....', '.lkscllkslcsk.k.',
         '.ksckkkslcssk.l.', '.....kscccksk...', '..kclsskskcsk...',
         '.klsck..kck.sk..', '.ckk...klsk..l..', '.......ksck.....', '........sk......')),
}

# Three views of the river animal. The raised tail sits on a separate plane:
# its ring and finely tapered tip move together without stretching the back.
RILLIK_VIEWS = {
    'down': (
        '...c...s', '...lc..lc', '...laclalc', '...klsklsk',
        '...kllccck', '..ksllccssk', '..kowllwosk', '..kllngllsk',
        '...kggglsk', '...ksgglcck', '...ksgglcssk', '...ksglccssk',
        '...klsccscsk', '...klskscsk', '...kck..kck', '..klsk.kllsk'),
    'left': (
        '.....c..s', '....lc.lc', '...laclac', '...klcklsk',
        '...kllcckk', '..kllllcsk', '.kowcclcsk', 'nggllccsskk',
        '.kgggllclcckk', '..ksgglcclccsk', '...kgglccccssk',
        '...klsclscscssk', '...klskscskcck', '...kck..kk.kck',
        '..klsk....klsk'),
    'up': (
        '...c...s', '...lc..lc', '...laclalc', '...klsklsk',
        '...klllcck', '..kllclccsk', '..ksclccssk', '...kllccsk',
        '...kclccsk', '...kllcccsk', '...kslcccssk', '...kclcccssk',
        '...klsccscsk', '...ksckscsk', '...kck..kck', '..klsk.kllsk'),
}


def river_companion(facing, step):
    colors = palette(dict(k='#273840', s='#475467', c='#637e91', l='#a0b6b8',
                          a='#92cbb6', g='#e6d9b9', w='#e9cd9a', o='#b57e41',
                          n='#29313a', j='#bedfcc'))
    im = Image.new('RGBA', (16, 16))
    # Tail curls up and back. The dark inner rim makes the glass read as a
    # ring around the tail even against pale reeds or glints on the water.
    tail = ('...ksk', '..kssck', '..ksjaj', '...jask', '....csk',
            '...ksck', '..ksck', 'kscck', 'kssk')
    profile = facing in ('left', 'right')
    paint(im, tail, colors, 9, (4 if profile else 3) - step)
    rows = RILLIK_VIEWS['left' if profile else facing]
    paint(im, rows, colors, 0, 16 - len(rows))
    if step:
        # Rillik tests the footing with the near forepaw; the farther hind
        # foot stays planted. This also gives the companion a quiet idle pose.
        x = 2
        paw = im.crop((x, 14, x + 4, 16))
        im.paste((0, 0, 0, 0), (x, 14, x + 4, 16))
        im.paste(paw, (x - 1, 13), paw)
    if facing == 'right':
        im = im.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    return im


def field_creature(name, facing, step):
    if name == 'rillik':
        return river_companion(facing, step)
    colors, front, side, back = CREATURES[name]
    rows = front if facing == 'down' else back if facing == 'up' else side
    pigments = palette(dict(zip('ksclagnw', colors)))
    im = Image.new('RGBA', (16, 16))
    height = len(rows)
    flying = name in ('gleamwing', 'rift-wretch')
    y = 16 - height - int(flying) - int(flying and step)
    paint(im, rows, pigments, 0, y)
    if step and name == 'gleamwing':
        # Upstroke folds the wing tips inward. Keep the face and thorax still.
        width = 3 if facing in ('up', 'down') else 5
        leading = im.crop((16 - width, y, 16, y + 6))
        im.paste((0, 0, 0, 0), (16 - width, y, 16, y + 6))
        im.paste(leading, (15 - width, y + 1), leading)
    elif step and not flying:
        # Lift just the rear paw and keep its hock attached to the haunch.
        paw = im.crop((8, 14, 14, 16))
        im.paste((0, 0, 0, 0), (8, 14, 14, 16))
        im.paste(paw, (9, 13), paw)
    if facing == 'right':
        im = im.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    return im


def field_sheets():
    people = Image.new('RGBA', (16 * 15, 16 * len(HUMANS)))
    for row, name in enumerate(HUMANS):
        for col in range(15):
            direction = DIRECTIONS[col // 3] if col < 12 else 'down'
            frame = person(name, direction, col % 3 if col < 12 else 0, col)
            people.paste(frame, (16 * col, 16 * row))
    creatures = Image.new('RGBA', (16 * 8, 16 * len(SPECIES)))
    for row, name in enumerate(SPECIES):
        for i, direction in enumerate(DIRECTIONS):
            for step in (0, 1):
                creatures.paste(field_creature(name, direction, step), (16 * (2 * i + step), 16 * row))
    return {'people.png': people, 'mesomon.png': creatures}


def write_field_sheets(out):
    for filename, image in field_sheets().items():
        image.save(out / filename, optimize=True)


if __name__ == '__main__':
    from argparse import ArgumentParser
    parser = ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='compare the checked-in atlases to the drawings')
    args = parser.parse_args()
    output = Path(__file__).resolve().parents[1] / 'public/games/mesomon'
    if args.check:
        for name, expected in field_sheets().items():
            with Image.open(output / name) as actual:
                if actual.size != expected.size or actual.convert('RGBA').tobytes() != expected.tobytes():
                    raise SystemExit(f'{name} differs from its field drawings')
    else:
        write_field_sheets(output)
