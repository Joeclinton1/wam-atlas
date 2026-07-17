"""
Tooling to pull the main architecture-diagram figure out of a paper PDF and
save it as a uniformly-canvased PNG for the "original diagrams" atlas toggle.

Usage:
  python scripts/diagram_extract.py preview <pdf> [--pages 1-3] [--out DIR]
      Render whole pages to PNG at review resolution so a human/agent can
      pick the figure bounding box by eye.

  python scripts/diagram_extract.py crop <pdf> <page0> <x0> <y0> <x1> <y1> <out.png>
      page0 is 0-indexed. x0,y0,x1,y1 are FRACTIONS of the page (0..1),
      not points, so the same command reads the same regardless of the
      page's physical size.

  python scripts/diagram_extract.py canvas <src.png> <out.png> [--w 1600] [--h 1100]
      Contain-fit src.png onto a fixed white canvas (no cropping of content),
      centered, with a small margin. This is the step that makes every
      model's original-diagram image the same pixel size for the grid/toggle.
"""
import sys
import os
import argparse
import fitz  # PyMuPDF
from PIL import Image

RENDER_DPI = 300
PREVIEW_DPI = 150


def cmd_preview(args):
    doc = fitz.open(args.pdf)
    os.makedirs(args.out, exist_ok=True)
    base = os.path.splitext(os.path.basename(args.pdf))[0]
    lo, hi = (1, min(4, len(doc))) if not args.pages else map(int, args.pages.split("-"))
    for i in range(lo - 1, min(hi, len(doc))):
        page = doc[i]
        pix = page.get_pixmap(dpi=PREVIEW_DPI)
        out_path = os.path.join(args.out, f"{base}_p{i+1}.png")
        pix.save(out_path)
        print(out_path, page.rect.width, page.rect.height)


def cmd_crop(args):
    doc = fitz.open(args.pdf)
    page = doc[args.page0]
    w, h = page.rect.width, page.rect.height
    clip = fitz.Rect(args.x0 * w, args.y0 * h, args.x1 * w, args.y1 * h)
    pix = page.get_pixmap(dpi=RENDER_DPI, clip=clip)
    pix.save(args.out)
    print(f"saved {args.out} ({pix.width}x{pix.height})")


def cmd_canvas(args):
    src = Image.open(args.src).convert("RGB")
    canvas = Image.new("RGB", (args.w, args.h), "white")
    margin = 40
    max_w, max_h = args.w - 2 * margin, args.h - 2 * margin
    scale = min(max_w / src.width, max_h / src.height, 1.0 if args.no_upscale else 999)
    new_w, new_h = max(1, int(src.width * scale)), max(1, int(src.height * scale))
    resized = src.resize((new_w, new_h), Image.LANCZOS)
    x = (args.w - new_w) // 2
    y = (args.h - new_h) // 2
    canvas.paste(resized, (x, y))
    canvas.save(args.out)
    print(f"saved {args.out} ({args.w}x{args.h}, content {new_w}x{new_h})")


def main():
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)

    pv = sub.add_parser("preview")
    pv.add_argument("pdf")
    pv.add_argument("--pages", default=None, help="e.g. 1-4")
    pv.add_argument("--out", default="scratch_previews")
    pv.set_defaults(func=cmd_preview)

    cr = sub.add_parser("crop")
    cr.add_argument("pdf")
    cr.add_argument("page0", type=int)
    cr.add_argument("x0", type=float)
    cr.add_argument("y0", type=float)
    cr.add_argument("x1", type=float)
    cr.add_argument("y1", type=float)
    cr.add_argument("out")
    cr.set_defaults(func=cmd_crop)

    cv = sub.add_parser("canvas")
    cv.add_argument("src")
    cv.add_argument("out")
    cv.add_argument("--w", type=int, default=1600)
    cv.add_argument("--h", type=int, default=1100)
    cv.add_argument("--no-upscale", action="store_true")
    cv.set_defaults(func=cmd_canvas)

    args = p.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
