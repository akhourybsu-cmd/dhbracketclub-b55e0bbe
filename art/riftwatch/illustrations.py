"""Rebuild both original Pocket illustrations on their native pixel grids.

Run from the repository root with Python and Pillow. Indexed PNG plates retain the exact palette and native hard-pixel edges.
"""
from pathlib import Path
from random import Random
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parents[2] / "public" / "games" / "riftwatch"
INK = "#0b1320"
GLYPHS = {
    "R": ["11110","11011","11011","11110","11110","11011","11011"],
    "I": ["111","010","010","010","010","010","111"],
    "F": ["11111","11000","11000","11110","11000","11000","11000"],
    "T": ["11111","01110","01110","01110","01110","01110","01110"],
    "W": ["1100011","1100011","1100011","1101011","1111111","1111111","0110110"],
    "A": ["01110","11011","11011","11011","11111","11011","11011"],
    "C": ["01111","11000","11000","11000","11000","11000","01111"],
    "H": ["11011","11011","11011","11111","11011","11011","11011"],
}

def facets(draw, shapes, xy=lambda x,y:(x,y)):
    for color, vertices in shapes:
        draw.polygon([xy(*point) for point in vertices],fill=color)

def skiff(draw, ox, oy, scale):
    # Near engine points down-left. Cockpit, curved wing and two nacelles
    # share the forked silhouette of the tiny in-game craft.
    def at(x,y): return round(ox+x*scale), round(oy+y*scale)
    facets(draw, [
        ("#276884",[(6,68),(-24,79),(29,48),(44,44),(68,43)]),
        ("#32aeb1",[(6,66),(-18,76),(33,48),(41,47),(34,54)]),
        ("#99e9c8",[(18,57),(4,65),(29,48),(39,47)]),
        ("#436781",[(30,73),(9,85),(51,53),(62,50)]),
        ("#51baa9",[(34,67),(17,78),(52,52),(58,51)]),
        (INK,[(19,56),(17,51),(34,39),(27,31),(23,11),(24,4),(28,6),(39,24),(57,27),(73,28),(90,21),(113,9),(119,8),(118,13),(96,35),(80,44),(66,55),(54,64),(31,73),(28,70),(47,54),(36,53),(22,60)]),
        ("#24545d",[(25,8),(28,12),(40,27),(59,29),(54,37),(33,40),(27,29)]),
        ("#44a8a4",[(25,8),(39,26),(57,29),(48,30),(33,29)]),
        ("#b5e9c7",[(25,8),(29,13),(39,26),(36,25)]),
        ("#112f40",[(30,24),(37,29),(54,31),(47,33),(31,32)]),
        ("#3a7b81",[(33,34),(43,36),(60,31),(50,40),(36,42)]),
        ("#8c83b0",[(19,51),(41,37),(60,34),(54,40),(37,45),(23,55)]),
        ("#283b54",[(21,55),(37,45),(59,39),(50,46),(26,57)]),
        ("#3d7280",[(23,51),(38,42),(48,40),(41,44),(27,53)]),
        ("#e1d2a1",[(23,49),(41,38),(54,36),(42,40)]),
        ("#166067",[(32,51),(54,37),(91,22),(114,11),(103,24),(83,40),(61,49),(47,53)]),
        ("#53a69c",[(37,48),(56,36),(86,25),(114,10),(108,18),(82,34),(64,38),(51,45)]),
        ("#a2d9b9",[(45,43),(59,34),(89,23),(114,10),(111,14),(86,28),(65,34)]),
        ("#dae7bc",[(62,33),(89,22),(111,11),(92,22),(76,29)]),
        ("#192f41",[(39,50),(56,42),(80,36),(101,23),(87,37),(77,43),(60,49),(49,51)]),
        ("#42747b",[(67,43),(85,38),(101,23),(92,34),(79,44),(64,48)]),
        ("#182f3c",[(51,42),(59,34),(73,27),(82,25),(85,28),(80,34),(66,39)]),
        ("#aa654b",[(55,40),(62,33),(75,27),(81,27),(79,31),(66,37)]),
        ("#e6a657",[(58,37),(65,32),(76,27),(81,27),(74,31),(66,35)]),
        ("#ffe6a3",[(62,34),(67,31),(75,28),(78,28),(68,33)]),
        ("#35505a",[(68,34),(70,32),(73,33),(71,35)]),
        ("#3c6367",[(44,54),(57,44),(66,41),(79,37),(73,47),(57,59),(33,69)]),
        ("#519c91",[(33,68),(54,49),(70,41),(75,40),(66,48),(54,54)]),
        ("#aad6ad",[(35,64),(53,49),(67,42),(73,41),(60,49)]),
        ("#132a3a",[(36,67),(54,55),(67,48),(61,54),(52,60),(33,70)]),
        ("#d8b36c",[(47,56),(49,54),(53,54),(51,56)]),
        ("#b2e8be",[(18,52),(22,49),(27,47),(24,51),(20,54)]),
        ("#d4f4d6",[(31,69),(35,64),(39,62),(36,66)]),
        ("#cf7e56",[(91,29),(97,24),(95,28),(92,30)]),
        ("#e6dfaa",[(111,14),(116,10),(114,13)]),
    ],at)

def sky(w,h,gate,seed):
    im=Image.new("RGB",(w,h),INK)
    d=ImageDraw.Draw(im)
    # Banked cloud strata and mineral light below the tear.
    facets(d,[
        ("#122435",[(0,h*.50),(w*.18,h*.38),(w*.39,h*.41),(w*.73,h*.24),(w,h*.22),(w,h),(0,h)]),
        ("#23344f",[(0,h*.61),(w*.20,h*.47),(w*.5,h*.50),(w*.80,h*.38),(w,h*.33),(w,h),(0,h)]),
        ("#514063",[(0,h*.66),(w*.26,h*.58),(w*.51,h*.60),(w*.82,h*.46),(w,h*.44),(w,h),(0,h)]),
        ("#91596a",[(0,h*.75),(w*.22,h*.66),(w*.49,h*.70),(w*.76,h*.59),(w,h*.52),(w,h),(0,h)]),
        ("#c17c71",[(0,h*.80),(w*.3,h*.69),(w*.56,h*.72),(w*.82,h*.60),(w,h*.58),(w,h),(0,h)]),
    ])
    rand=Random(seed)
    for _ in range(w):
        x,y=rand.randrange(w),rand.randrange(h)
        skycol=im.getpixel((x,y))
        if y<h*.51 and rand.randrange(4)==0:
            d.point((x,y),fill=rand.choice(["#38485e","#57627d","#91a4ae"]))
        elif y>h*.43:
            col=tuple(min(255,v+n) for v,n in zip(skycol,(14,6,5)))
            d.line((x,y,x+rand.randrange(2,16),y),fill=col)
    # Wide, asymmetrical void tear with triangular plates cast out of its rim.
    gx,gy=gate
    def r(x,y): return gx+x,gy+y
    facets(d,[
        ("#342d55",[(-53,36),(-29,14),(-16,-4),(5,-13),(12,-27),(54,-40),(28,-21),(14,3),(-1,14),(-9,23),(-33,26)]),
        ("#724880",[(-45,31),(-25,12),(-17,5),(-14,-4),(8,-13),(13,-23),(45,-35),(28,-22),(17,-5),(7,7),(-13,20)]),
        ("#d88794",[(-36,25),(-17,7),(-13,-4),(7,-12),(15,-23),(40,-32),(24,-19),(11,1),(-4,12),(-11,18)]),
        ("#f6c38f",[(-22,15),(-13,4),(-12,-3),(8,-12),(17,-23),(33,-29),(24,-19),(14,-2),(5,6)]),
        ("#683f68",[(-27,20),(-18,11),(-8,4),(-7,-2),(10,-9),(19,-22),(31,-27),(22,-16),(14,-5),(10,0),(-3,9)]),
        ("#182136",[(-26,19),(-11,7),(-6,-1),(11,-9),(18,-18),(22,-20),(18,-12),(13,-3),(3,6),(-8,12)]),
        ("#aa6898",[(-41,26),(-37,18),(-29,11),(-31,17)]),
        ("#f0aa8a",[(-25,1),(-22,-4),(-18,-5),(-20,-1)]),
        ("#98598c",[(15,-29),(21,-36),(26,-37),(21,-31)]),
        ("#7e5998",[(26,-9),(35,-15),(33,-10),(24,-5)]),
    ],r)
    for _ in range(52):
        vx=rand.randrange(-56,53); vy=round(-vx*.70+rand.choice((-1,1))*rand.randrange(6,24))
        x,y=r(vx,vy)
        d.line((x,y,x+rand.randrange(1,4),y-1),fill=rand.choice(["#97668c","#a86f86","#5a506f"]))
    for i,(col,height,step) in enumerate([("#715a75",.69,9),("#3b455e",.76,8),("#223648",.83,6),("#142635",.92,5)]):
        y0=round(h*height)
        coords=[(0,h)]
        for x in range(-3,w+step,step):
            coords.append((x,y0+rand.randint(-6,5) - (4 if x > w*.77 else 0)))
        d.polygon(coords+[(w+step,h)],fill=col)
    for _ in range(w//3):
        x,y=rand.randrange(w),rand.randrange(round(h*.8),h)
        if im.getpixel((x,y)) in ((34,54,72),(59,69,94)):
            d.line((x,y,x+rand.randrange(1,6),y),fill="#546070")
    # Architectural scale at the edge of the watch line.
    for x,top in [(w*.08,h*.74),(w*.12,h*.78),(w*.89,h*.70),(w*.92,h*.74)]:
        x,y=round(x),round(top)
        d.polygon([(x-3,h),(x-2,y+4),(x,y+1),(x+1,y-4),(x+3,y+3),(x+5,h)],fill="#172b3c")
        d.line((x+1,y-3,x+1,y+3),fill="#799393")
        d.point((x+1,y-4),fill="#ecc286")
    return im

def logo(d,word,x,y,s):
    # Slanted, hand-built wordmark with a cutout under each advancing row.
    for dx,dy,shade in [(1,3,INK),(2,2,"#264753"),(0,0,None)]:
        pen=x
        for char in word:
            letter=GLYPHS[char]
            for row,line in enumerate(letter):
                skew=(6-row)//3
                for col,bit in enumerate(line):
                    if bit=="1":
                        xx=pen+col*s+dx+skew; yy=y+row*s+dy
                        d.rectangle((xx,yy,xx+s-1,yy+s-1), fill=shade or ("#f8f1cb" if row<4 else "#a8daca"))
            pen+=(len(letter[0])+1)*s

def write_plate(im,name):
    im.convert("P",palette=Image.Palette.ADAPTIVE,colors=128).save(OUT/f"{name}.png",optimize=True)

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    cart=sky(192,124,(74,38),721)
    skiff(ImageDraw.Draw(cart),43,27,1.05)
    write_plate(cart,"cartridge")
    title=sky(250,94,(177,23),891)
    d=ImageDraw.Draw(title)
    skiff(d,138,19,.86)
    # A dark translucent print shadow keeps the lettering readable across the cloud bank.
    for x in range(125):
        amount=min(.78,(125-x)/65)
        for y in range(15,77):
            c=title.getpixel((x,y)); title.putpixel((x,y),tuple(round(a*(1-amount)+b*amount) for a,b in zip(c,(12,25,39))))
    logo(d,"RIFT",10,17,3); logo(d,"WATCH",9,43,3)
    d.line((11,71,54,71),fill="#49b5ab");d.line((58,71,66,71),fill="#a9d1b8")
    write_plate(title,"title")
if __name__=="__main__": main()
