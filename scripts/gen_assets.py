"""Génère les assets visuels du launcher : fond de scène (nuit, montagnes,
foret, feu de camp) et icône de l'application (canard sur bloc).
Usage: python scripts/gen_assets.py
"""
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ASSETS = Path(__file__).resolve().parent.parent / "assets"
ASSETS.mkdir(exist_ok=True)

random.seed(7)

# ---------------------------------------------------------------------------
# Fond de scène
# ---------------------------------------------------------------------------
W, H = 1205, 812


def lerp_color(c1, c2, t):
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))


def make_sky():
    img = Image.new("RGB", (W, H))
    stops = [
        (0.0, (43, 31, 77)),
        (0.35, (58, 42, 99)),
        (0.6, (91, 63, 122)),
        (0.85, (122, 79, 111)),
        (1.0, (154, 95, 99)),
    ]
    px = img.load()
    for y in range(H):
        t = y / H
        for i in range(len(stops) - 1):
            t0, c0 = stops[i]
            t1, c1 = stops[i + 1]
            if t0 <= t <= t1 or i == len(stops) - 2:
                local_t = 0 if t1 == t0 else (t - t0) / (t1 - t0)
                local_t = min(max(local_t, 0), 1)
                color = lerp_color(c0, c1, local_t)
                break
        for x in range(W):
            px[x, y] = color
    return img


def add_stars(img, count=160):
    draw = ImageDraw.Draw(img, "RGBA")
    for _ in range(count):
        x = random.randint(0, W - 1)
        y = random.randint(0, int(H * 0.55))
        r = random.choice([1, 1, 1, 2])
        alpha = random.randint(90, 220)
        draw.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255, alpha))
    return img


def jagged_polygon(base_y, amplitude, segments, color, seed):
    rnd = random.Random(seed)
    points = [(0, H)]
    step = W / segments
    for i in range(segments + 1):
        x = i * step
        y = base_y - rnd.randint(0, amplitude)
        points.append((x, y))
    points.append((W, H))
    return points


def add_mountains(img):
    draw = ImageDraw.Draw(img, "RGBA")
    pts = jagged_polygon(base_y=int(H * 0.62), amplitude=160, segments=9, color=None, seed=1)
    draw.polygon(pts, fill=(42, 36, 64, 255))
    return img


def add_forest(img):
    draw = ImageDraw.Draw(img, "RGBA")
    rnd = random.Random(3)
    base_y = int(H * 0.82)
    x = 0
    points = [(0, H)]
    while x < W:
        tree_w = rnd.randint(18, 34)
        tree_h = rnd.randint(40, 90)
        peak_x = x + tree_w / 2
        points.append((x, base_y))
        points.append((peak_x, base_y - tree_h))
        points.append((x + tree_w, base_y))
        x += tree_w * rnd.uniform(0.55, 0.85)
    points.append((W, H))
    draw.polygon(points, fill=(28, 24, 48, 255))
    return img


def add_campfire_glow(img):
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(glow)
    cx, cy = W // 2, int(H * 0.86)
    for r, alpha in [(260, 40), (190, 70), (120, 110), (60, 160)]:
        draw.ellipse(
            [cx - r, cy - r, cx + r, cy + r],
            fill=(255, 140, 50, alpha),
        )
    glow = glow.filter(ImageFilter.GaussianBlur(18))
    img.paste(Image.alpha_composite(img.convert("RGBA"), glow).convert("RGB"))
    return img.convert("RGB")


def build_background():
    img = make_sky()
    img = add_stars(img)
    img = add_mountains(img)
    img = add_forest(img)
    img = add_campfire_glow(img)
    img.save(ASSETS / "background.png")
    print("background.png créé")


# ---------------------------------------------------------------------------
# Icône de l'application : canard sur un bloc (clin d'oeil à CrazyTorgnole)
# ---------------------------------------------------------------------------
def build_icon():
    size = 1024
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # fond arrondi degrade nuit -> orange (rappel du launcher)
    bg = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    bg_draw = ImageDraw.Draw(bg)
    for y in range(size):
        t = y / size
        c = lerp_color((43, 31, 77), (255, 122, 60), t)
        bg_draw.line([(0, y), (size, y)], fill=(c[0], c[1], c[2], 255))
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size, size], radius=180, fill=255)
    img.paste(bg, (0, 0), mask)

    cx, cy = size // 2, int(size * 0.58)

    # corps du canard
    body_color = (255, 213, 79)
    draw.ellipse([cx - 260, cy - 160, cx + 260, cy + 220], fill=body_color)
    # tete
    head_cx, head_cy = cx + 90, cy - 260
    draw.ellipse([head_cx - 150, head_cy - 150, head_cx + 150, head_cy + 150], fill=body_color)
    # bec
    draw.polygon(
        [
            (head_cx + 120, head_cy - 10),
            (head_cx + 260, head_cy + 30),
            (head_cx + 120, head_cy + 70),
        ],
        fill=(255, 152, 0),
    )
    # oeil
    draw.ellipse([head_cx + 20, head_cy - 50, head_cx + 60, head_cy - 10], fill=(40, 30, 20))
    # aile
    draw.ellipse([cx - 150, cy - 40, cx + 60, cy + 180], fill=(235, 190, 60))

    img.save(ASSETS / "icon.png")

    icon_sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    img.save(ASSETS / "icon.ico", sizes=icon_sizes)
    print("icon.png / icon.ico créés")


if __name__ == "__main__":
    build_background()
    build_icon()
