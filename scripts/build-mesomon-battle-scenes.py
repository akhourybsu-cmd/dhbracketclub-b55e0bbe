#!/usr/bin/env python3
"""Bake Port Marche's three illustrated battle landings. Requires Python 3.10+ / Pillow.

The trimmed environment paintings contain the architecture and its lighting. The
quays are composed here at the same 160 × 144 logical coordinates as the actors.
Only the three finished WebPs ship to the browser. --check verifies their pixels.
"""
import argparse
from dataclasses import dataclass, replace
from io import BytesIO
from math import sin
from pathlib import Path
from random import Random

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "art/mesomon/battle-scenes"
OUTPUT = ROOT / "public/games/mesomon/battle-scenes-v1"
SCALE = 4
SIZE = (640, 576)
SCENES = {
    # Each swatch is actual timber or masonry in that painting, before the quays are added.
    "passage-encounter": ("timber", 31, (20, 37, 53, 172)),
    "gleamwing-encounter": ("sandstone", 59, (517, 136, 590, 242)),
    "chamber-boss": ("basalt", 73, (385, 111, 453, 183)),
}
COLORS = {
    "timber": {"top": (91,81,61), "edge": (99,83,64), "wall": (57,55,43),
               "end": (48,48,39), "joint": (31,35,31), "moss": (48,63,42), "wash": (74,111,107)},
    "sandstone": {"top": (122,106,79), "edge": (132,114,86), "wall": (89,77,55),
                  "end": (72,69,52), "joint": (54,54,43), "moss": (62,70,43), "wash": (103,104,80)},
    "basalt": {"top": (82,78,91), "edge": (104,98,114), "wall": (56,54,65),
               "end": (46,46,58), "joint": (40,40,48), "moss": (46,51,56), "wash": (87,83,106)},
}


def px(pt):
    return tuple(round(axis * SCALE) for axis in pt)


def tone(color, amount):
    return tuple(max(0, min(255, round(value + amount))) for value in color)


@dataclass(frozen=True)
class Deck:
    # Back-left, back-right, front-right, front-left. Coordinates increase toward water.
    corners: tuple
    rear: bool
    anchor: tuple
    material: str = "timber"

    def point(self, u, v):
        a, b, c, d = self.corners
        x,y=((1-v)*((1-u)*a[n]+u*b[n]) + v*((1-u)*d[n]+u*c[n]) for n in (0,1))
        # Water undercuts the inside tip. Flagstone courses follow a chamfer;
        # fragments of the older chamber have broken away along jagged joints.
        if self.material == "timber":
            return x,y
        profile = ((5,3,.5,0,0,0,0,.4,1.3,2.7,3.4) if self.material == "sandstone"
                   else (7,3.8,4.1,1.4,.3,2,3.1,2.9,.2,1.6,3.8))
        t=max(0,min(9.999,v*10))
        a,b=profile[int(t):int(t)+2]
        cut=a+(b-a)*(t-int(t))
        weight=(1-u)**3 if self.rear else u**3
        return x+(cut if self.rear else -cut)*weight, y+.35*sin(u*13)*v**2

    @property
    def outline(self):
        return ([self.point(0,0),self.point(1,0)] +
                [self.point(1,j/10) for j in range(1,11)] +
                [self.point(0,j/10) for j in range(10,-1,-1)])


# The margin beyond each landing keeps a leaping fighter visibly above the water.
DECKS = (
    Deck(((98,60), (169,54), (169,68), (94,69)), True, (116,64)),
    Deck(((-13,85), (63,86), (72,98), (-13,109)), False, (45,95)),
)


class Quay:
    def __init__(self, plate, material, seed, swatch, deck):
        self.layer = Image.new("RGBA", SIZE)
        self.draw = ImageDraw.Draw(self.layer)
        self.deck = replace(deck, material=material)
        self.rng = Random(seed + int(deck.rear))
        self.color = COLORS[material]
        self.material = material
        self.depth = 4.7 if deck.rear else 7.6
        # Sample the local brushwork, then add fine film grain so individual
        # blocks can take new light without losing the painting's texture.
        patch = ImageOps.autocontrast(plate.crop(swatch).convert("L"), cutoff=2)
        if material == "timber":
            patch = patch.transpose(Image.Transpose.ROTATE_90)
        grain = Image.new("L", SIZE)
        for y in range(0, SIZE[1], patch.height):
            for x in range(0, SIZE[0], patch.width):
                grain.paste(ImageOps.mirror(patch) if (x // patch.width) % 2 else patch, (x,y))
        noise = Image.frombytes("L", SIZE, self.rng.randbytes(SIZE[0]*SIZE[1]))
        self.grain = Image.blend(grain, noise, .31)

    def face(self, points, color, contrast=20):
        coords = [px(p) for p in points]
        x0 = max(0, min(x for x,_ in coords))
        y0 = max(0, min(y for _,y in coords))
        x1 = min(SIZE[0], max(x for x,_ in coords)+1)
        y1 = min(SIZE[1], max(y for _,y in coords)+1)
        if x1 <= x0 or y1 <= y0:
            return
        mask = Image.new("L", (x1-x0, y1-y0))
        ImageDraw.Draw(mask).polygon([(x-x0,y-y0) for x,y in coords], fill=255)
        texture = ImageOps.colorize(self.grain.crop((x0,y0,x1,y1)), tone(color,-contrast), tone(color,contrast))
        self.layer.paste(texture, (x0,y0), mask)

    def line(self, pts, color, width=1):
        self.draw.line([px(p) for p in pts], fill=color, width=width)

    def joint(self, u, v, du, dv, color, width=1):
        self.line([self.deck.point(u,v), self.deck.point(u+du,v+dv)], color, width)

    def timber(self):
        d = self.deck
        for u in (.13,.42,.73,.96):
            x,y=d.point(u, .96)
            bottom=y+self.depth+self.rng.uniform(2,4)
            self.face([(x-1.5,y),(x+1.7,y),(x+1.1,bottom),(x-1.4,bottom+.45)], self.color["end"])
            self.line([(x-1,y),(x-.95,bottom)],tone(self.color["edge"],-24),2)
            self.line([(x+.56,y+4),(x+.4,bottom-.5)],self.color["joint"])
            end_x,end_y=d.point(u-.19,.92)
            self.face([(x,y+2),(x,y+3.4),(end_x,end_y+7),(end_x,end_y+5.5)],self.color["wall"])
        # The central timber spans the pilings. Irregular end-grain and boards
        # extend over the beam, instead of terminating in a square painted box.
        line=[d.point(0,1),d.point(1,1)]
        self.face([*line,(line[1][0],line[1][1]+2.1),(line[0][0],line[0][1]+3.4)],self.color["wall"])
        self.face(d.outline,self.color["joint"])
        n = 6 if d.rear else 8
        for row in range(n):
            v,w=row/n+.008,(row+1)/n-.008
            near = self.rng.uniform(-.021,.004) if d.rear else -.015
            far = 1.012 if d.rear else self.rng.uniform(.965,1.02)
            joint = self.rng.uniform(.24,.79)
            for a,b in ((near,joint-.002),(joint+.002,far)):
                top=tone(self.color["top"],self.rng.uniform(-8,9))
                self.face([d.point(a,v),d.point(b,v),d.point(b,w),d.point(a,w)],top,23)
                self.joint(a,w,b-a,0,tone(top,15))
                for _ in range(6):
                    uu=self.rng.uniform(a,b)
                    length=min(self.rng.uniform(.03,.2),b-uu)
                    self.joint(uu,self.rng.uniform(v,w),length,self.rng.uniform(-.008,.008),tone(top,self.rng.uniform(-12,12)))
                for uu in (a+.02,b-.02):
                    x,y=d.point(uu,(v+w)/2)
                    self.draw.ellipse([px((x-.18,y-.12)),px((x+.18,y+.15))],fill=self.color["joint"])
        # A split end cap and knots break the line where the pier meets water.
        end = 0 if d.rear else 1
        for v in (.25,.57,.86):
            x,y=d.point(end,v)
            self.line([(x,y),(x+(.6 if d.rear else -.6), y+.7)],tone(self.color["edge"],-13))

    def masonry(self):
        d=self.deck
        # Stone jambs continue under the front edge to the water. The masonry
        # joints follow its receding perspective, including its visible return.
        end=0 if d.rear else 1
        for index in (0,1):
            def wall(u,v):
                x,y=d.point(end,u) if index==0 else d.point(u,1)
                return x,y+self.depth*v

            if index==0:
                self.face([wall(j/10,0) for j in range(11)]+[wall(j/10,1.05) for j in range(10,-1,-1)],self.color["joint"])
            else:
                self.face([wall(0,0),wall(1,0),wall(1,1.05),wall(0,1.05)],self.color["joint"])
            for course,(up,down) in enumerate(((0,.49),(.5,.96))):
                count = 6 if index==0 else 10
                divs=sorted({0.0,1.0,*[max(0,min(1,(i+(.47 if course else 0)+self.rng.uniform(-.13,.13))/count)) for i in range(count+1)]})
                for a1,b1 in zip(divs,divs[1:]):
                    if b1-a1 < .016:
                        continue
                    color=tone(self.color["end" if index==0 else "wall"],self.rng.uniform(-5,9)-(6 if course else 0))
                    margin=.002 if index else .012
                    self.face([wall(a1+margin,up+.03),wall(b1-margin,up),wall(b1,down-.03),wall(a1,down)],color,23)
                    self.line([wall(a1+.004,up+.05),wall(b1-.007,up+.03)],tone(color,10))
                    if course and self.rng.random()<.58:
                        self.line([wall(a1+.01,down-.09),wall((a1+b1)/2,down-.06)],self.color["moss"],2)
        self.face(d.outline,self.color["joint"])
        n = 4 if d.rear else 5
        for row in range(n):
            v,w=row/n,(row+1)/n
            count=5 if self.material=="basalt" else 6
            cuts=sorted({0.0,1.0,*[max(0,min(1,(j+(row%2)*.52+self.rng.uniform(-.19,.19))/count)) for j in range(count+1)]})
            for a,b in zip(cuts,cuts[1:]):
                if b-a < .014:
                    continue
                c=tone(self.color["top"],self.rng.uniform(-8,8))
                bevel=min(.016,(b-a)*.13)
                outline=[(a+bevel,v+.018),(b-.004,v+.009),(b,w-.035),(b-bevel,w-.006),(a,w-.009),(a+.002,v+.05)]
                self.face([d.point(u,t) for u,t in outline],c,22)
                self.joint(a+bevel,v+.022,b-a-bevel-.011,.002,tone(c,10))
                if row==n-1:
                    self.joint(a,w-.01,b-a-bevel,0,tone(c,12),2)
                if self.rng.random()<.28:
                    start=self.rng.uniform(a,b)
                    self.line([d.point(start,v),d.point(start+.008,v+.055),d.point(start+.003,v+.086)],tone(c,-15))
        if self.material=="basalt":
            for u,v in ((.36,.60),(.72,.25),(.9,.9)):
                # Flecks of the same old mineral found in the vaulted ceiling.
                self.line([d.point(u,v),d.point(u+.012,v+.057),d.point(u+.035,v+.074)],(110,94,124))

    def fixtures(self):
        d=self.deck
        if self.material == "timber":
            # Old mooring piles make this an attached wharf, with tarred hoops,
            # bronze end grain and a slack hemp line along the outer margin.
            us=(.13,.36) if not d.rear else (.69,.93)
            tops=[]
            for u in us:
                x,y=d.point(u,.14)
                h=4.2 if d.rear else 6.7
                w=1.3 if d.rear else 1.85
                self.face([(x-w,y),(x-w*.95,y-h),(x+w*.9,y-h+.4),(x+w,y+.3),(x,y+1)], (67,60,43))
                self.line([(x-w*.6,y-h+.8),(x-w*.61,y-.2)],(110,91,64),2)
                self.line([(x+.1,y-h*.94),(x+.25,y-.3)],(41,45,36))
                self.draw.ellipse([px((x-w,y-h-.55)),px((x+w,y-h+.55))],fill=(112,99,73))
                for v in (.28,.42):
                    self.line([(x-w,y-h*v),(x-.2,y-h*v+.36),(x+w,y-h*v+.03)],(40,43,35),3)
                tops.append((x,y-h*.43))
            (x,y),(z,t)=tops
            for j in range(15):
                lo,hi=j/15,(j+1)/15
                self.line([(x+(z-x)*v,y+(t-y)*v+1.3*sin(v*3.14)) for v in (lo,hi)],(125,111,80) if j%3==0 else (82,75,54),2)
            if not d.rear:
                x,y=d.point(.31,1)
                for off in (0,3.45):
                    self.line([(x+off,y-.5),(x+off-.5,y+7)],(54,57,43),4)
                    self.line([(x+off-.3,y),(x+off-.75,y+6.8)],(104,98,70),1)
                for off in (1.2,3.85,6.3):
                    self.line([(x-.25,y+off),(x+3.3,y+off-.45)],(103,92,61),3)
            return
        if self.material == "sandstone":
            u=.81 if d.rear else .26
            x,y=d.point(u,.59)
            w=1.8 if d.rear else 2.6
            self.draw.ellipse([px((x-w*1.7,y-.35)),px((x+w*1.7,y+1.1))],fill=(64,63,48))
            self.face([(x-w,y+.25),(x-w*.63,y-2.6),(x-w,y-3.0),(x+w*.8,y-2.8),(x+w*.69,y-.2),(x,y+.9)],(75,67,45))
            self.draw.ellipse([px((x-w,y-3.4)),px((x+w,y-2.4))],fill=(120,109,76))
            if not d.rear:
                for j in range(3):
                    self.draw.arc([px((x-2-j*.65,y-.5-j*.26)),px((x+3+j*.67,y+1+j*.35))],9,336,fill=(142-j*5,124-j*4,85-j*3),width=2)
                self.line([(x+4,y+1),(x+6,y+2.5),(x+8,y+2.8),(x+10,y+4.1)],(125,113,78),2)
        else:
            # A remnant of the fractured vault with broken slate at its foot.
            u=.89 if d.rear else .19
            x,y=d.point(u,.25)
            self.face([(x-2.8,y),(x-1.7,y-2.0),(x-1.2,y-4.8),(x+.65,y-6.7),(x+1.12,y-4.55),(x+2.2,y-3.8),(x+2.4,y+.2)],(68,64,80),19)
            self.face([(x-.1,y-.1),(x+.65,y-6.7),(x+1.12,y-4.55),(x+2.2,y-3.8),(x+2.4,y+.2)],(54,50,67),17)
            self.line([(x-1.55,y-2.45),(x-1.28,y-4.5),(x+.52,y-6.4)],(106,97,123))
            for _ in range(8):
                dx,dy=self.rng.uniform(-4,5),self.rng.uniform(.2,1.8)
                self.face([(x+dx,y+dy),(x+dx+.7,y+dy-.55),(x+dx+1.8,y+dy+.1),(x+dx+.2,y+dy+.4)],(83,78,93),12)
        # Pad the battered stone foot with a real damp tidemark. Roots and moss
        # catch at joints, never in a long bright stripe across the front face.
        for _ in range(40):
            u=self.rng.random()
            x,y=d.point(u,1)
            extent=self.rng.uniform(.6,3.2)
            y+=self.depth*self.rng.uniform(.65,.98)
            self.line([(x,y+.13),(x+extent*.45,y),(x+extent,y+.16)],tone(self.color["moss"],self.rng.uniform(-7,5)),2)

    def cast_shadow(self):
        # Diffuse occlusion is below the toes only, so air and recoil poses lift naturally.
        x,y=self.deck.anchor
        width=17 if self.deck.rear else 19
        for radius,depth,alpha,blur in ((width,2.05,89,3.8),(width*.66,.70,60,1.35)):
            mask=Image.new("L",SIZE)
            ImageDraw.Draw(mask).ellipse([px((x-radius,y-depth+.20)),px((x+radius,y+depth+.20))],fill=alpha)
            shade=Image.new("RGBA",SIZE,(18,22,25))
            shade.putalpha(mask.filter(ImageFilter.GaussianBlur(blur)))
            self.layer.alpha_composite(shade)

    def composite(self, plate):
        (self.timber if self.material=="timber" else self.masonry)()
        self.fixtures()
        # The lantern, open sluice and rift cast different light onto nearby
        # masonry. Sample the painted light at each point along the platform.
        alpha = self.layer.getchannel("A")
        bounce = plate.convert("RGB").filter(ImageFilter.GaussianBlur(11))
        bounce = bounce.point(lambda channel: min(255, round(1.4 * channel + 44)))
        material = self.layer.convert("RGB")
        lit = Image.blend(material, ImageChops.soft_light(material, bounce), .72)
        self.layer = lit.convert("RGBA")
        self.layer.putalpha(alpha)
        self.cast_shadow()
        # Distort the reflection into small columns of ripples. All offsets are
        # seeded; retrying a build produces the same eddies and brush marks.
        waterline=max(self.deck.point(0,1)[1],self.deck.point(1,1)[1])+self.depth
        start=round(waterline*SCALE)
        reflection=Image.new("RGBA",SIZE)
        rows=19 if self.deck.rear else 37
        for j in range(rows):
            y=start+j
            sample_y=start-1-int(j*1.6)
            shift=round(4*sin(j*.56)+self.rng.uniform(-3,3))
            strip=self.layer.crop((0,sample_y,SIZE[0],sample_y+1))
            strip.putalpha(strip.getchannel("A").point(lambda a: round(a*.24*(1-j/rows))))
            reflection.paste(strip,(shift,y))
        # A displaced, diffused shadow under the lip meets the painted water.
        contact = Image.new("L", SIZE)
        contact.paste(alpha, (1, 5 if self.deck.rear else 9))
        shade = Image.new("RGBA", SIZE, (14, 29, 32))
        shade.putalpha(contact.filter(ImageFilter.GaussianBlur(5)).point(lambda a: a // 3))
        plate.alpha_composite(shade)
        plate.alpha_composite(reflection.filter(ImageFilter.GaussianBlur(.7)))
        plate.alpha_composite(self.layer)
        water=Image.new("RGBA",SIZE)
        pen=ImageDraw.Draw(water)
        for _ in range(23):
            u=self.rng.random()
            x,y=self.deck.point(u,1)
            y+=self.depth+self.rng.uniform(.1,2.6)
            length=self.rng.uniform(1.0,4.1)
            pen.line([px((x-length,y+.10)),px((x,y)),px((x+length*.65,y+.08))],fill=(*self.color["wash"],self.rng.randrange(35,100)),width=1)
        plate.alpha_composite(water)


def compose(scene):
    material,seed,swatch=SCENES[scene]
    with Image.open(SOURCE/f"{scene}.webp") as source:
        if source.size != (627,627):
            raise ValueError(f"{scene}: expected a full source quadrant, got {source.size}")
        source=source.convert("RGB")
    plate=ImageOps.fit(source,SIZE,method=Image.Resampling.LANCZOS,centering=(.5,.40)).convert("RGBA")
    for deck in DECKS:
        Quay(source,material,seed,swatch,deck).composite(plate)
    return plate.convert("RGB")


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check",action="store_true",help="rebuild in memory and compare to the published WebPs")
    check=parser.parse_args().check
    for name in SCENES:
        stage=compose(name)
        encoded=BytesIO()
        stage.save(encoded,"WEBP",quality=89,method=6)
        data=encoded.getvalue()
        path=OUTPUT/f"{name}.webp"
        if len(data)>120*1024:
            raise ValueError(f"{name}: image exceeds the battle scene budget")
        if check:
            encoded.seek(0)
            with Image.open(encoded) as expected, Image.open(path) as actual:
                if actual.size!=SIZE or ImageChops.difference(actual.convert("RGB"),expected.convert("RGB")).getbbox():
                    raise ValueError(f"{path}: stale, rebuild the battle scenes")
        else:
            OUTPUT.mkdir(parents=True,exist_ok=True)
            path.write_bytes(data)
        print(f"{'Verified' if check else 'Built'} {name} ({len(data):,} bytes).")


if __name__=="__main__":
    main()
