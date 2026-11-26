#!/usr/bin/env python3
"""Compile original, right-facing cutouts into the Port Marche field guide and battle atlas.

Run with Python 3.10+ and Pillow (including WebP support). --check validates the
checked-in images against the source drawings and animation rigs without writing.
"""
import argparse
from dataclasses import dataclass
from math import cos, hypot, radians, sin
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "art/mesomon/creatures"
OUT = ROOT / "public/games/mesomon"
FRAME = 192
SUPERSAMPLE = 2
BASELINE = 180
ROWS = ("rillik", "muddren", "gleamwing", "tressel", "rift-wretch")
POSES = ("rest", "ready", "action", "recoil")
Point = tuple[float, float]


@dataclass(frozen=True)
class Pose:
    angle: float = 0
    dx: float = 0
    dy: float = 0


@dataclass(frozen=True)
class Joint:
    """Center, radius and hinge in trimmed subject coordinates. Travel is in frame pixels."""
    part: str
    center: Point
    radius: Point
    hinge: Point
    poses: tuple[Pose, Pose, Pose]


# Each joint moves only the painted anatomy inside its oval. Outside all ovals
# the original pixels stay registered, including supporting feet and wing roots.
RIGS = {
    "rillik": (
        Joint("ringed tail", (.17,.50), (.32,.40), (.39,.66), (Pose(-4), Pose(21,-1,-2), Pose(-14))),
        Joint("chest and muzzle", (.81,.43), (.33,.40), (.67,.69), (Pose(-2,0,-1), Pose(7,4,1), Pose(-9,-3,-1))),
        Joint("reed fins", (.72,.13), (.25,.29), (.79,.30), (Pose(5), Pose(-13), Pose(10))),
        Joint("raised forepaw", (.90,.79), (.17,.20), (.80,.73), (Pose(3), Pose(-13,2,-1), Pose(9,-1,1))),
    ),
    "muddren": (
        Joint("mossy carapace", (.42,.31), (.48,.51), (.46,.76), (Pose(0,0,-1), Pose(-2,1,4), Pose(4,-2,-2))),
        Joint("armored neck and muzzle", (.81,.47), (.32,.39), (.64,.65), (Pose(2), Pose(8,5,3), Pose(-10,-4,-2))),
        Joint("rear armor", (.15,.53), (.24,.38), (.31,.65), (Pose(-2), Pose(-8), Pose(7))),
    ),
    "tressel": (
        Joint("corded tail", (.23,.24), (.36,.40), (.30,.54), (Pose(4), Pose(-21,1,-2), Pose(15,-2))),
        Joint("shoulders and jaw", (.78,.42), (.34,.37), (.63,.68), (Pose(-2,0,-1), Pose(8,3,2), Pose(-11,-4,-2))),
        Joint("ear tips", (.79,.29), (.19,.20), (.79,.40), (Pose(4), Pose(-13), Pose(11))),
        Joint("foreleg", (.85,.78), (.19,.24), (.74,.66), (Pose(-2), Pose(-17,2,-1), Pose(11,-2))),
    ),
    "rift-wretch": (
        Joint("split mask", (.72,.27), (.35,.36), (.59,.43), (Pose(2,0,-1), Pose(12,3,-2), Pose(-11,-3,2))),
        Joint("orbiting splinters", (.24,.25), (.31,.26), (.48,.38), (Pose(4,-1,-1), Pose(-12,-3,-3), Pose(9,2,2))),
        Joint("lower shield", (.44,.62), (.40,.22), (.53,.55), (Pose(-2,0,1), Pose(-13,4,2), Pose(9,-2,1))),
        Joint("tail shards", (.48,.85), (.25,.28), (.48,.64), (Pose(-3,0,1), Pose(12,-3,1), Pose(-11,2,-1))),
    ),
}


def cutout(species: str) -> Image.Image:
    path = SOURCE / f"{species}.png"
    with Image.open(path) as original:
        image = original.convert("RGBA")
    alpha = image.getchannel("A")
    if alpha.getextrema()[0] >= 128:
        raise ValueError(f"{path}: expected a transparent cutout")
    # Remove stray near-invisible matte pixels before framing; keep painted antialiasing.
    image.putalpha(alpha.point(lambda value: 0 if value < 5 else value))
    box = image.getchannel("A").getbbox()
    if not box:
        raise ValueError(f"{path}: artwork is empty")
    return image.crop(box)


def fit(image: Image.Image, width: int, height: int) -> Image.Image:
    scale = min(width / image.width, height / image.height)
    size = (max(1, round(image.width * scale)), max(1, round(image.height * scale)))
    if scale > 1 and max(image.size) < 250:
        return image.resize(size, Image.Resampling.NEAREST)
    result = image.resize(size, Image.Resampling.LANCZOS)
    if scale > 1.25:
        # Restore ink edges on guide enlargements while retaining the transparent outline.
        sharp = result.convert("RGB").filter(ImageFilter.UnsharpMask(radius=.9, percent=75, threshold=4))
        sharp.putalpha(result.getchannel("A"))
        return sharp
    return result


def guide(source: Image.Image) -> Image.Image:
    art = fit(source, 468, 456)
    plate = Image.new("RGBA", (512, 512))
    plate.alpha_composite(art, ((512 - art.width) // 2, (512 - art.height) // 2))
    return plate


def battle_plate(source: Image.Image, airborne: bool = False):
    art = fit(source, (156 if airborne else 164) * SUPERSAMPLE, 151 * SUPERSAMPLE)
    size = FRAME * SUPERSAMPLE
    left, top = (size - art.width) // 2, (BASELINE - (9 if airborne else 0)) * SUPERSAMPLE - art.height
    stage = Image.new("RGBA", (size, size))
    stage.alpha_composite(art, (left, top))
    return stage, (left, top, art.width, art.height)


def pose_frame(stage: Image.Image, box: tuple[int, int, int, int], joints: tuple[Joint, ...], column: int):
    if column == 0:
        return stage.resize((FRAME, FRAME), Image.Resampling.LANCZOS)
    left, top, width, height = box
    transforms = []
    steps = 4
    for joint in joints:
        pose = joint.poses[column - 1]
        theta = radians(-pose.angle / steps)
        transforms.append((
            left + joint.center[0] * width, top + joint.center[1] * height,
            1 / (joint.radius[0] * width), 1 / (joint.radius[1] * height),
            left + joint.hinge[0] * width, top + joint.hinge[1] * height,
            pose.dx * SUPERSAMPLE / steps, pose.dy * SUPERSAMPLE / steps, cos(theta), sin(theta),
        ))

    def sample(x: int, y: int):
        source_x, source_y = x, y
        # Integrate local rotations gradually to retain volume at overlapping joints.
        for _ in range(steps):
            x, y = source_x, source_y
            for cx, cy, rx, ry, hx, hy, dx, dy, cosine, sine in transforms:
                distance = hypot((x - cx) * rx, (y - cy) * ry)
                if distance >= 1:
                    continue
                # Full influence near a bone and a smooth falloff at its outer joint.
                t = min(1, (1 - distance) / .60)
                weight = t * t * (3 - 2 * t)
                px, py = x - hx - dx, y - hy - dy
                source_x += (hx + cosine * px - sine * py - x) * weight
                source_y += (hy + sine * px + cosine * py - y) * weight
        return source_x, source_y

    # Compute shared vertices once. A four-pixel mesh preserves connected ink
    # outlines where limbs meet; no cut seams or sliding rectangular layers.
    step = 4 * SUPERSAMPLE
    coords = range(0, stage.width + 1, step)
    vertices = {(x, y): sample(x, y) for y in coords for x in coords}
    mesh = []
    for y in range(0, stage.height, step):
        for x in range(0, stage.width, step):
            r, b = x + step, y + step
            quad = vertices[x,y] + vertices[x,b] + vertices[r,b] + vertices[r,y]
            mesh.append(((x, y, r, b), quad))
    bent = stage.transform(stage.size, Image.Transform.MESH, mesh, Image.Resampling.BICUBIC)
    return bent.resize((FRAME, FRAME), Image.Resampling.LANCZOS)


# Thin moth wings retain all their painted veins and tip shapes when turned
# about the thorax. Split along the original ink lines on the flattened drawing.
# Polygon points and hinges are normalized to the trimmed, right-facing source.
WINGS = (
    (((.55,.54),(.647,.55),(.69,.62),(.72,.68),(.76,.70),(.78,1),(1,1),(1,.58),(.74,.56)),
     (.675,.57), (1, 5, -4)),  # far hindwing
    (((.731,.485),(.743,.538),(.722,.568),(.72,.59),(.88,.62),(1,.60),(1,.02),(.90,.10)),
     (.736,.53), (-3, -9, 6)),  # far forewing
    (((-.1,.65),(.24,.56),(.392,.557),(.51,.524),(.52,.548),(.47,.58),(.43,.654),
      (.409,.731),(.366,.80),(.27,.86),(.12,1.09),(-.1,1.1)),
     (.515,.547), (3, 9, -6)),  # near hindwing
    (((-.1,-.12),(.50,-.12),(.54,.393),(.564,.456),(.571,.478),(.539,.503),
      (.480,.519),(.421,.54),(.299,.563),(.19,.564),(-.1,.47)),
     (.551,.489), (-3, -9, 6)),  # near forewing
)


def wing_frame(stage, box, column):
    if column == 0:
        return stage.resize((FRAME, FRAME), Image.Resampling.LANCZOS)
    left, top, width, height = box

    def point(xy):
        return left + xy[0] * width, top + xy[1] * height

    alpha = stage.getchannel("A")
    body = stage.copy()
    body_alpha = alpha.copy()
    lifted = Image.new("RGBA", stage.size)
    for polygon, pivot, angles in WINGS:
        mask = Image.new("L", stage.size)
        ImageDraw.Draw(mask).polygon([point(xy) for xy in polygon], fill=255)
        wing = stage.copy()
        wing.putalpha(ImageChops.multiply(alpha, mask))
        # Leave a narrow overlap inside the hinges to preserve the dark contour.
        body_alpha = ImageChops.subtract(body_alpha, mask.filter(ImageFilter.MinFilter(5)))
        lifted.alpha_composite(wing.rotate(angles[column - 1], Image.Resampling.BICUBIC, center=point(pivot)))
    body.putalpha(body_alpha)
    lifted.alpha_composite(body)
    return lifted.resize((FRAME, FRAME), Image.Resampling.LANCZOS)


def validate_frame(species: str, pose: str, frame: Image.Image, rest: Image.Image | None):
    alpha = frame.getchannel("A")
    box = alpha.point(lambda value: 255 if value > 64 else 0).getbbox()
    if not box or min(box[0], box[1], FRAME - box[2], FRAME - box[3]) < 4:
        raise ValueError(f"{species}/{pose}: silhouette touches frame edge")
    if rest is None:
        return
    rest_box = rest.getchannel("A").point(lambda value: 255 if value > 64 else 0).getbbox()
    if species in ("rillik", "muddren", "tressel") and abs(box[3] - rest_box[3]) > 3:
        raise ValueError(f"{species}/{pose}: feet drift from the landing")
    # Measure on a matte: transparent RGB metadata must never count as animation.
    def preview(cell, size):
        matte = Image.new("RGB", cell.size, "#354447")
        matte.paste(cell, mask=cell.getchannel("A"))
        return matte.resize((size, size), Image.Resampling.LANCZOS)
    for size, minimum in [(FRAME, 55), (48, 3)]:
        difference = ImageChops.difference(preview(frame, size), preview(rest, size))
        changed = sum(difference.convert("L").histogram()[10:])
        if changed < minimum:
            raise ValueError(f"{species}/{pose}: pose is unreadable at {size}px ({changed} changed pixels)")


def indexed_atlas(image: Image.Image) -> Image.Image:
    """Reserve most colors for opaque paint and retain four antialiased edge bands."""
    bands = ((10, 63, 5), (64, 127, 8), (128, 191, 12), (192, 247, 15), (248, 255, 215))
    band_for_alpha = [-1] * 256
    samples = [bytearray() for _ in bands]
    alpha_sums = [0] * len(bands)
    for i, (low, high, _) in enumerate(bands):
        for alpha in range(low, high + 1):
            band_for_alpha[alpha] = i

    pixels = iter(image.tobytes())
    for red, green, blue, alpha in zip(pixels, pixels, pixels, pixels):
        band = band_for_alpha[alpha]
        if band >= 0:
            samples[band].extend((red, green, blue))
            alpha_sums[band] += alpha

    alpha = image.getchannel("A")
    rgb = image.convert("RGB")
    indexed = Image.new("P", image.size)
    palette = [0, 0, 0]
    opacity = [0]
    for i, (low, high, count) in enumerate(bands):
        if not samples[i]:
            continue
        length = len(samples[i]) // 3
        values = Image.frombytes("RGB", (length, 1), bytes(samples[i]))
        colors = values.quantize(count, Image.Quantize.MEDIANCUT).getpalette()[:3 * count]
        # Fill every index of the nearest-color reference. Duplicate its final
        # entry so a color cannot be remapped to an unused default black slot.
        reference = Image.new("P", (1, 1))
        reference.putpalette(colors + colors[-3:] * (256 - count))
        start = len(opacity)
        mapped = rgb.quantize(palette=reference, dither=Image.Dither.NONE)
        mapped = mapped.point([start + min(n, count - 1) for n in range(256)])
        mask = alpha.point([255 if low <= n <= high else 0 for n in range(256)])
        indexed.paste(mapped, mask=mask)
        palette.extend(colors)
        opacity.extend([255 if high == 255 else round(alpha_sums[i] / length)] * count)
    indexed.putpalette(palette)
    indexed.info["transparency"] = bytes(opacity)
    return indexed


def emit(image: Image.Image, path: Path, check: bool, **options):
    if check:
        with Image.open(path) as stored:
            expected = stored.convert("RGBA")
        # Compare visible pixels, not the encoder's treatment of RGB at zero alpha.
        actual = image.convert("RGBA").convert("RGBa")
        if expected.size != image.size or expected.convert("RGBa").tobytes() != actual.tobytes():
            raise ValueError(f"{path}: stale, run {Path(__file__).name}")
    else:
        path.parent.mkdir(parents=True, exist_ok=True)
        image.save(path, **options)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="verify the public guide plates and every atlas frame")
    check = parser.parse_args().check
    sheet = Image.new("RGBA", (FRAME * len(POSES), FRAME * len(ROWS)))
    for row, species in enumerate(ROWS):
        source = cutout(species)
        emit(guide(source), OUT / "field-guide" / f"{species}.webp", check, lossless=True, method=6)
        stage, box = battle_plate(source, airborne=species == "gleamwing")
        rest = None
        for column, pose in enumerate(POSES):
            frame = (wing_frame(stage, box, column) if species == "gleamwing"
                     else pose_frame(stage, box, RIGS[species], column))
            validate_frame(species, pose, frame, rest)
            sheet.paste(frame, (column * FRAME, row * FRAME))
            if column == 0:
                rest = frame
    emit(indexed_atlas(sheet), OUT / "creature-battle-v1.png", check, optimize=True)
    print(f"{'Verified' if check else 'Built'} {len(ROWS)} guide plates and {len(ROWS) * len(POSES)} battle poses.")


if __name__ == "__main__":
    main()
