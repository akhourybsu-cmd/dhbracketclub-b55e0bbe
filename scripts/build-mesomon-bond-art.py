#!/usr/bin/env python3
"""Export the first bond's three original harbor paintings at twice phone resolution."""
import argparse
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "art/mesomon/first-bond"
OUTPUT = ROOT / "public/games/mesomon/first-bond-v1"
FRAMES = ("return", "offer", "touch")
SIZE = (640, 480)


def export(frame, check):
    with Image.open(SOURCE / f"{frame}.webp") as original:
        if original.size != (724, 543):
            raise ValueError(f"{frame}: expected the complete 4:3 scene")
        scene = original.convert("RGB").resize(SIZE, Image.Resampling.LANCZOS)
    encoded = BytesIO()
    scene.save(encoded, "WEBP", quality=83, method=6)
    if encoded.tell() > 90 * 1024:
        raise ValueError(f"{frame}: exceeds the 90 KiB scene budget")
    path = OUTPUT / f"{frame}.webp"
    if check:
        encoded.seek(0)
        with Image.open(encoded) as expected, Image.open(path) as actual:
            if actual.size != SIZE or ImageChops.difference(expected, actual).getbbox():
                raise ValueError(f"{path} differs from the source painting")
    else:
        OUTPUT.mkdir(parents=True, exist_ok=True)
        path.write_bytes(encoded.getvalue())
    print(f"{'Verified' if check else 'Built'} {frame} ({path.stat().st_size:,} bytes)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="compare each published scene to its source")
    check = parser.parse_args().check
    for frame in FRAMES:
        export(frame, check)
