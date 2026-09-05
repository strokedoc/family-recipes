# Generates the PWA icons: a steaming pot on a paper field (Tiffin palette).
# Run once: python3 scripts/make-icons.py
from PIL import Image, ImageDraw
import os

PAPER = (0xF3, 0xE7, 0xDC)
CLAY = (0x8C, 0x3A, 0x22)
SURFACE = (0xFF, 0xFA, 0xF5)


def draw_icon(size, pad_ratio, bg):
    img = Image.new('RGB', (size, size), bg)
    d = ImageDraw.Draw(img)
    s = size
    # pot body
    pot_w = s * (0.62 - pad_ratio)
    pot_h = pot_w * 0.62
    cx, cy = s / 2, s * (0.58 + pad_ratio / 2)
    d.rounded_rectangle(
        [cx - pot_w / 2, cy - pot_h / 2, cx + pot_w / 2, cy + pot_h / 2],
        radius=pot_h * 0.28, fill=CLAY)
    # rim
    rim_w = pot_w * 1.14
    d.rounded_rectangle(
        [cx - rim_w / 2, cy - pot_h / 2 - s * 0.02, cx + rim_w / 2, cy - pot_h / 2 + s * 0.045],
        radius=s * 0.02, fill=CLAY)
    # steam: three arcs
    for i, dx in enumerate([-0.14, 0, 0.14]):
        x = cx + dx * pot_w * 1.5
        top = cy - pot_h / 2 - s * (0.20 if i == 1 else 0.15)
        w = s * 0.028
        d.rounded_rectangle([x - w, top, x + w, cy - pot_h / 2 - s * 0.055], radius=w, fill=SURFACE)
    return img


os.makedirs('public/icons', exist_ok=True)
draw_icon(512, 0.0, PAPER).save('public/icons/icon-512.png')
draw_icon(512, 0.0, PAPER).resize((192, 192), Image.LANCZOS).save('public/icons/icon-192.png')
# maskable: extra safe-zone padding
draw_icon(512, 0.12, PAPER).save('public/icons/maskable-512.png')
# apple-touch-icon: 180px, slightly padded
draw_icon(360, 0.04, PAPER).resize((180, 180), Image.LANCZOS).save('public/icons/apple-touch-icon.png')
print('icons written')
