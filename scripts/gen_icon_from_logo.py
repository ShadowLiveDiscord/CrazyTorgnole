"""Construit l'icône carrée de l'app (assets/icon.png + assets/icon.ico) à partir
du logo Nebula exporté de Canva (assets/nebula_logo_raw.png, fond blanc).
Usage: python scripts/gen_icon_from_logo.py
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
SIZE = 1024


def remove_white_bg(img, threshold=235):
    img = img.convert("RGBA")
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if r >= threshold and g >= threshold and b >= threshold:
                px[x, y] = (r, g, b, 0)
    return img


def radial_backdrop(size):
    bg = Image.new("RGB", (size, size), (8, 4, 16))
    glow = Image.new("L", (size, size), 0)
    ImageDraw.Draw(glow).ellipse(
        [size * 0.08, size * 0.08, size * 0.92, size * 0.92], fill=255
    )
    glow = glow.filter(ImageFilter.GaussianBlur(size * 0.12))
    violet = Image.new("RGB", (size, size), (60, 20, 90))
    bg = Image.composite(violet, bg, glow)
    return bg.convert("RGBA")


def build():
    logo = remove_white_bg(Image.open(ASSETS / "nebula_logo_raw.png"))
    logo = logo.resize((int(SIZE * 0.92), int(SIZE * 0.92)), Image.LANCZOS)

    icon = radial_backdrop(SIZE)
    pos = ((SIZE - logo.width) // 2, (SIZE - logo.height) // 2)
    icon.alpha_composite(logo, pos)

    icon_rgb = icon.convert("RGB")
    icon_rgb.save(ASSETS / "icon.png")
    icon_rgb.save(ROOT / "src" / "assets" / "images" / "icon.png")

    icon_sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    icon_rgb.save(ASSETS / "icon.ico", sizes=icon_sizes)
    print("icon.png / icon.ico régénérés")


if __name__ == "__main__":
    build()
