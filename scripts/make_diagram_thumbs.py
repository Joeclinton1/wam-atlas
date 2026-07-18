"""
Generate small preview thumbnails of each original paper diagram.

Full-resolution originals live in assets/original-diagrams/*.png and are used
on the model (paper) page. The gallery grid and hover previews only need a
small image, so we emit downscaled copies into assets/original-diagrams/thumb/.

Usage:
  python scripts/make_diagram_thumbs.py [--width 640]
"""
import os
import glob
import argparse
from PIL import Image

SRC_DIR = os.path.join("assets", "original-diagrams")
THUMB_DIR = os.path.join(SRC_DIR, "thumb")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--width", type=int, default=640, help="max thumbnail width in px")
    args = ap.parse_args()

    os.makedirs(THUMB_DIR, exist_ok=True)
    sources = sorted(
        f for f in glob.glob(os.path.join(SRC_DIR, "*.png"))
        if os.path.dirname(f) == SRC_DIR  # skip the thumb/ subdir
    )
    for src in sources:
        name = os.path.basename(src)
        img = Image.open(src).convert("RGB")
        if img.width > args.width:
            h = round(img.height * args.width / img.width)
            img = img.resize((args.width, h), Image.LANCZOS)
        out = os.path.join(THUMB_DIR, name)
        img.save(out, optimize=True)
        print(f"{name}: {img.width}x{img.height}")
    print(f"\n{len(sources)} thumbnails written to {THUMB_DIR}")


if __name__ == "__main__":
    main()
