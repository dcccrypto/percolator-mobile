#!/usr/bin/env python3
"""
PERC-529: Generate Percolator app icons + splash screen
Implements DESIGN-BRIEF-MOBILE-V2.md Section 1 spec.
"""

import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

FONT_PATH = "/tmp/JetBrainsMono-Bold-Italic.ttf"
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "assets")

# Design tokens
BG_COLOR = (13, 13, 15)          # #0D0D0F
ACCENT   = (153, 69, 255)        # #9945FF
TEXT     = (225, 226, 232)       # #E1E2E8


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def radial_glow(img: Image.Image, cx: int, cy: int, radius: int,
                color: tuple, alpha: float) -> Image.Image:
    """Overlay a soft radial gradient glow on the image (RGBA composite)."""
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    steps = 120
    w, h = img.size
    for i in range(steps, 0, -1):
        r_i = int(radius * i / steps)
        # Clamp ellipse coords to image bounds to prevent edge artifacts
        x0 = max(0, cx - r_i)
        y0 = max(0, cy - r_i)
        x1 = min(w - 1, cx + r_i)
        y1 = min(h - 1, cy + r_i)
        a_i = int(alpha * 255 * (1.0 - i / steps) ** 1.15)
        draw.ellipse([x0, y0, x1, y1], fill=(*color, a_i))
    return Image.alpha_composite(img.convert("RGBA"), overlay)


def make_italic_glyph(char: str, font_size: int, fg_color: tuple,
                      shear: float = 0.22, pad: int = 20) -> Image.Image:
    """
    Render `char` in JetBrains Mono Bold Italic, apply shear for strong italic look.
    Returns a tightly-cropped RGBA image of just the glyph (with `pad` px border).
    `place_glyph` then centres this on any canvas correctly.
    """
    font = ImageFont.truetype(FONT_PATH, font_size)

    # Measure glyph
    tmp_draw = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    bbox = tmp_draw.textbbox((0, 0), char, font=font)
    gw = bbox[2] - bbox[0]
    gh = bbox[3] - bbox[1]

    # Oversized canvas to avoid clipping during shear
    shear_extra = int(abs(shear) * gh) + pad * 2
    canvas_w = gw + shear_extra * 2 + pad * 2
    canvas_h = gh + pad * 2

    # Render glyph in the centre of the oversized canvas
    layer = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    x0 = canvas_w // 2 - gw // 2 - bbox[0]
    y0 = pad - bbox[1]
    d.text((x0, y0), char, font=font, fill=(*fg_color,))

    # Apply italic shear (lean right: top of glyph moves right)
    # x_src = x_dst + shear * y_dst - shear * canvas_h
    data = (1, shear, -shear * canvas_h, 0, 1, 0)
    layer = layer.transform(layer.size, Image.AFFINE, data, resample=Image.BICUBIC)

    # Auto-crop to non-transparent bounding box then make square with equal padding
    # so geometric centre == optical centre
    content_box = layer.getbbox()
    if content_box:
        layer = layer.crop(content_box)
        # Make the cropped glyph square (largest dimension + 2*pad) so centering is trivial
        w, h = layer.size
        side = max(w, h) + pad * 2
        square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
        square.paste(layer, ((side - w) // 2, (side - h) // 2), layer)
        layer = square

    return layer


def place_glyph(canvas: Image.Image, glyph: Image.Image, cx: int, cy: int,
                nudge_x: int = 0, nudge_y: int = 0) -> Image.Image:
    """Paste `glyph` (RGBA) centred at (cx, cy) on `canvas`, return composite.
    nudge_x/nudge_y allow optical correction (positive = right/down)."""
    gw, gh = glyph.size
    x = cx - gw // 2 + nudge_x
    y = cy - gh // 2 + nudge_y
    out = canvas.copy().convert("RGBA")
    out.paste(glyph, (x, y), glyph)
    return out


# ---------------------------------------------------------------------------
# Asset generators
# ---------------------------------------------------------------------------

def generate_app_icon():
    """1024×1024 app icon."""
    SIZE = 1024
    img = Image.new("RGBA", (SIZE, SIZE), (*BG_COLOR, 255))
    cx = cy = SIZE // 2

    # Background glow — boosted for vivid #9945FF
    img = radial_glow(img, cx, cy, 360, ACCENT, 0.40)

    # Inner ring
    d = ImageDraw.Draw(img)
    m = (SIZE - 960) // 2
    d.rounded_rectangle([m, m, SIZE - m, SIZE - m], radius=240,
                        outline=(*ACCENT, 51), width=1)

    # Italic optical nudge: ~3% canvas right to compensate for shear lean
    nx = int(SIZE * 0.03)
    # Glyph glow (blurred purple P behind white P) — double layer for vivid #9945FF
    font_size = 480
    glyph_glow = make_italic_glyph("P", font_size, (*ACCENT,), shear=0.22)
    glyph_glow_blur = glyph_glow.filter(ImageFilter.GaussianBlur(radius=40))
    img = place_glyph(img, glyph_glow_blur, cx, cy, nudge_x=nx)
    # Second glow pass — tighter, brighter to push colour toward true #9945FF
    glyph_glow2 = make_italic_glyph("P", font_size, (*ACCENT,), shear=0.22)
    glyph_glow2 = glyph_glow2.filter(ImageFilter.GaussianBlur(radius=18))
    img = place_glyph(img, glyph_glow2, cx, cy, nudge_x=nx)

    # Sharp white P on top
    glyph_white = make_italic_glyph("P", font_size, (*TEXT,), shear=0.22)
    img = place_glyph(img, glyph_white, cx, cy, nudge_x=nx)

    out_path = os.path.join(OUT_DIR, "icon.png")
    img.convert("RGB").save(out_path, "PNG", optimize=True)
    print(f"✅ icon.png ({SIZE}×{SIZE}) → {out_path}")


def generate_adaptive_icon_fg():
    """512×512 adaptive icon foreground — italic P on transparent bg.
    Glyph scaled to ~55% canvas width for visual weight."""
    SIZE = 512
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    cx = cy = SIZE // 2
    # font_size=410 → glyph width ~283px ≈ 55% of 512px canvas (designer spec)
    font_size = 410
    nx = int(SIZE * 0.03)

    glyph_glow = make_italic_glyph("P", font_size, (*ACCENT,), shear=0.22)
    glyph_glow = glyph_glow.filter(ImageFilter.GaussianBlur(radius=16))
    img = place_glyph(img, glyph_glow, cx, cy, nudge_x=nx)
    # Tighter glow for vivid accent
    glyph_glow2 = make_italic_glyph("P", font_size, (*ACCENT,), shear=0.22)
    glyph_glow2 = glyph_glow2.filter(ImageFilter.GaussianBlur(radius=6))
    img = place_glyph(img, glyph_glow2, cx, cy, nudge_x=nx)

    # Pure #FFFFFF glyph (designer spec: not lavender-grey TEXT)
    glyph_white = make_italic_glyph("P", font_size, (255, 255, 255), shear=0.22)
    img = place_glyph(img, glyph_white, cx, cy, nudge_x=nx)

    out_path = os.path.join(OUT_DIR, "adaptive-icon-foreground.png")
    img.save(out_path, "PNG", optimize=True)
    print(f"✅ adaptive-icon-foreground.png ({SIZE}×{SIZE}) → {out_path}")


def generate_adaptive_icon_bg():
    """512×512 adaptive icon background — solid #0D0D0F."""
    SIZE = 512
    Image.new("RGB", (SIZE, SIZE), BG_COLOR).save(
        os.path.join(OUT_DIR, "adaptive-icon-background.png"), "PNG")
    print(f"✅ adaptive-icon-background.png ({SIZE}×{SIZE})")


def generate_splash():
    """1242×2688 splash screen."""
    W, H = 1242, 2688
    img = Image.new("RGBA", (W, H), (*BG_COLOR, 255))
    cx, cy = W // 2, H // 2 - 100

    # Two-layer radial glow — radii kept well within canvas to prevent edge artifacts
    img = radial_glow(img, cx, cy, 350, ACCENT, 0.32)
    img = radial_glow(img, cx, cy, 500, ACCENT, 0.10)

    # P glyph glow
    font_size = 520
    nx = int(W * 0.03)
    glyph_glow = make_italic_glyph("P", font_size, (*ACCENT,), shear=0.22)
    glyph_glow = glyph_glow.filter(ImageFilter.GaussianBlur(radius=70))
    img = place_glyph(img, glyph_glow, cx, cy, nudge_x=nx)

    # Sharp white P
    glyph_white = make_italic_glyph("P", font_size, (*TEXT,), shear=0.22)
    img = place_glyph(img, glyph_white, cx, cy, nudge_x=nx)

    # Wordmark "PERCOLATOR" (upright, not italic — matches brand wordmark style)
    try:
        font = ImageFont.truetype(FONT_PATH, 90)
        word = "PERCOLATOR"
        tmp = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
        bb = tmp.textbbox((0, 0), word, font=font)
        word_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        wd = ImageDraw.Draw(word_layer)
        wx = cx - (bb[2] - bb[0]) // 2 - bb[0]
        wy = cy + font_size // 2 + 40
        wd.text((wx, wy), word, font=font, fill=(*TEXT, 200))
        img = Image.alpha_composite(img, word_layer)
    except Exception as e:
        print(f"  (wordmark skipped: {e})")

    # Clean bottom/top strips to pure BG to remove any glow edge artifacts
    clean = ImageDraw.Draw(img)
    clean.rectangle([0, H - 200, W, H], fill=(*BG_COLOR, 255))
    clean.rectangle([0, 0, W, 200], fill=(*BG_COLOR, 255))

    out_path = os.path.join(OUT_DIR, "splash.png")
    img.convert("RGB").save(out_path, "PNG", optimize=True)
    print(f"✅ splash.png ({W}×{H}) → {out_path}")


# ---------------------------------------------------------------------------
if __name__ == "__main__":
    print("🔨 Generating Percolator app icons (PERC-529)...")
    generate_app_icon()
    generate_adaptive_icon_fg()
    generate_adaptive_icon_bg()
    generate_splash()
    print("🎉 Done.")
