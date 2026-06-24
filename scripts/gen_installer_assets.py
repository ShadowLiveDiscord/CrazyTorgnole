"""Génère les images de l'installeur NSIS (header + sidebar) à partir du
logo et du fond déjà utilisés par le launcher (assets/icon.png, assets/background.png).
Usage: python scripts/gen_installer_assets.py
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"

FONT_BOLD = "C:/Windows/Fonts/segoeuib.ttf"
FONT_REGULAR = "C:/Windows/Fonts/segoeui.ttf"

HEADER_SIZE = (150, 57)
SIDEBAR_SIZE = (164, 314)


def cover_resize(img, size):
    return ImageOps.fit(img, size, method=Image.LANCZOS, centering=(0.5, 0.35))


def build_header():
    bg = Image.open(ASSETS / "background.png").convert("RGB")
    header = cover_resize(bg, HEADER_SIZE)

    overlay = Image.new("RGBA", HEADER_SIZE, (10, 4, 20, 170))
    header = Image.alpha_composite(header.convert("RGBA"), overlay)

    face = Image.open(ASSETS / "icon.png").convert("RGBA")
    face = face.resize((50, 50), Image.LANCZOS)
    header.paste(face, (HEADER_SIZE[0] - 54, 3), face)

    draw = ImageDraw.Draw(header)
    font = ImageFont.truetype(FONT_BOLD, 14)
    draw.text((10, 20), "Nebula Launcher", font=font, fill=(225, 200, 255, 255))

    header.convert("RGB").save(ASSETS / "installerHeader.bmp")
    print("installerHeader.bmp créé")


def build_sidebar():
    bg = Image.open(ASSETS / "background.png").convert("RGB")
    sidebar = cover_resize(bg, SIDEBAR_SIZE).convert("RGBA")

    tint = Image.new("RGBA", SIDEBAR_SIZE, (20, 5, 35, 90))
    sidebar = Image.alpha_composite(sidebar, tint)

    shade = Image.new("RGBA", SIDEBAR_SIZE, (0, 0, 0, 0))
    ImageDraw.Draw(shade).rectangle(
        [0, SIDEBAR_SIZE[1] - 150, SIDEBAR_SIZE[0], SIDEBAR_SIZE[1]],
        fill=(10, 4, 18, 200),
    )
    shade = shade.filter(ImageFilter.GaussianBlur(8))
    sidebar = Image.alpha_composite(sidebar, shade)

    face = Image.open(ASSETS / "icon.png").convert("RGBA")
    face = face.resize((110, 110), Image.LANCZOS)
    fx = (SIDEBAR_SIZE[0] - face.width) // 2
    sidebar.paste(face, (fx, 20), face)

    draw = ImageDraw.Draw(sidebar)
    title_font = ImageFont.truetype(FONT_BOLD, 18)
    sub_font = ImageFont.truetype(FONT_REGULAR, 11)

    title = "Nebula Launcher"
    tw = draw.textlength(title, font=title_font)
    draw.text(((SIDEBAR_SIZE[0] - tw) / 2, 218), title, font=title_font, fill=(235, 220, 255, 255))

    sub = "Launcher Minecraft"
    sw = draw.textlength(sub, font=sub_font)
    draw.text(((SIDEBAR_SIZE[0] - sw) / 2, 242), sub, font=sub_font, fill=(195, 140, 255, 255))

    sidebar.convert("RGB").save(ASSETS / "installerSidebar.bmp")
    sidebar.convert("RGB").save(ASSETS / "uninstallerSidebar.bmp")
    print("installerSidebar.bmp / uninstallerSidebar.bmp créés")


if __name__ == "__main__":
    build_header()
    build_sidebar()
