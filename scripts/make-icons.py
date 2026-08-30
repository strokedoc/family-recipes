# Generates the PWA icons: a steaming pot on a turmeric field.
# Run once: python3 scripts/make-icons.py
from PIL import Image, ImageDraw
import os

PAPER = (250, 243, 231)
CHILI = (160, 52, 24)
TURMERIC = (226, 161, 60)
CREAM = (255, 246, 233)


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
        radius=pot_h * 0.28, fill=CHILI)
    # rim
    rim_w = pot_w * 1.14
    d.rounded_rectangle(
        [cx - rim_w / 2, cy - pot_h / 2 - s * 0.02, cx + rim_w / 2, cy - pot_h / 2 + s * 0.045],
        radius=s * 0.02, fill=CHILI)
    # steam: three arcs
    for i, dx in enumerate([-0.14, 0, 0.14]):
        x = cx + dx * pot_w * 1.5
        top = cy - pot_h / 2 - s * (0.20 if i == 1 else 0.15)
        w = s * 0.028
        d.rounded_rectangle([x - w, top, x + w, cy - pot_h / 2 - s * 0.055], radius=w, fill=CREAM)
    return img


os.makedirs('public/icons', exist_ok=True)
draw_icon(512, 0.0, TURMERIC).save('public/icons/icon-512.png')
draw_icon(512, 0.0, TURMERIC).resize((192, 192), Image.LANCZOS).save('public/icons/icon-192.png')
# maskable: extra safe-zone padding
draw_icon(512, 0.12, TURMERIC).save('public/icons/maskable-512.png')
# apple-touch-icon: 180px, slightly padded, paper background reads well on iOS
draw_icon(360, 0.04, TURMERIC).resize((180, 180), Image.LANCZOS).save('public/icons/apple-touch-icon.png')
print('icons written')
