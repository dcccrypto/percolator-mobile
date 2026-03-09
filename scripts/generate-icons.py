#!/usr/bin/env python3
"""
PERC-529: Generate Percolator app icons + splash screen
Implements DESIGN-BRIEF-MOBILE-V2.md Section 1 spec.
"""

import os
import numpy as np
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
    """Overlay a smooth per-pixel radial gradient glow (no banding).

    Uses numpy to compute distance from (cx, cy) for every pixel, then maps
    distance → alpha via a smooth power curve.  This avoids the concentric-
    ellipse stepping artifact that produced horizontal banding in earlier code.
    """
    w, h = img.size
    ys, xs = np.mgrid[0:h, 0:w]
    dist = np.sqrt((xs - cx).astype(np.float32) ** 2 +
                   (ys - cy).astype(np.float32) ** 2)
    t = np.clip(1.0 - dist / radius, 0.0, 1.0)
    a_arr = (alpha * 255.0 * (t ** 1.15)).astype(np.uint8)

    overlay = np.zeros((h, w, 4), dtype=np.uint8)
    overlay[:, :, 0] = color[0]
    overlay[:, :, 1] = color[1]
    overlay[:, :, 2] = color[2]
    overlay[:, :, 3] = a_arr

    overlay_img = Image.fromarray(overlay, "RGBA")
    return Image.alpha_composite(img.convert("RGBA"), overlay_img)


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
    nx = int(SIZE * 0.015)
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


def measure_glyph_width(font_size: int) -> int:
    """Return the actual rendered sheared width of the P glyph at given font size."""
    glyph = make_italic_glyph("P", font_size, (255, 255, 255), shear=0.22)
    bbox = glyph.getbbox()
    return (bbox[2] - bbox[0]) if bbox else 0


def measure_glyph_size(font_size: int) -> tuple:
    """Return (width, height) of the rendered sheared P glyph at given font size."""
    glyph = make_italic_glyph("P", font_size, (255, 255, 255), shear=0.22)
    bbox = glyph.getbbox()
    if bbox:
        return (bbox[2] - bbox[0], bbox[3] - bbox[1])
    return (0, 0)


def generate_adaptive_icon_fg():
    """512×512 adaptive icon foreground — italic P on transparent bg.

    Android safe zone: 66% of 512px = 338px centred → inset 87px on every edge
    (safe zone spans 87–425px on both axes).

    For CIRCULAR masks the safe zone is a circle of radius 169px (338/2).
    Glyph content radius = glyph_max_dim/2 + blur_extend.
    With blur radius 6, extend ≈ 3×6 = 18px.

    Glyph is scaled so its LARGEST dimension fits within 60% of safe zone
    (202px → radius 101px + 18px blur = 119px, well within 169px circle).
    This fixes clipping under circular/squircle masks.

    No nudge offsets — glyph is centered at exact canvas centre (256, 256).
    Shear compensation for italic lean is handled by make_italic_glyph's
    square-pad step which already centres the glyph geometrically.
    """
    SIZE = 512
    SAFE_INSET = 87           # Android 66% safe zone inset
    SAFE_SIZE = SIZE - 2 * SAFE_INSET   # 338px
    MAX_GLYPH_DIM = int(SAFE_SIZE * 0.60)  # 202px — radius 101px, fits circle masks
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    cx = cy = SIZE // 2

    # Auto-scale font_size so the LARGER glyph dimension ≤ MAX_GLYPH_DIM.
    # Start from a conservative estimate and iterate toward the target.
    font_size = 280
    for _ in range(8):
        gw, gh = measure_glyph_size(font_size)
        largest = max(gw, gh)
        if largest == 0:
            break
        if abs(largest - MAX_GLYPH_DIM) <= 3:
            break
        font_size = int(font_size * MAX_GLYPH_DIM / largest)
    gw, gh = measure_glyph_size(font_size)
    print(f"  adaptive-icon: font_size={font_size}, glyph={gw}×{gh}px "
          f"(safe zone {SAFE_SIZE}px, max_dim={MAX_GLYPH_DIM}px, "
          f"bounds={cx - gh//2}–{cx + gh//2}px vert)")

    # Verify glyph fits within safe zone bounds — hard-clip font_size if needed
    while max(gw, gh) > SAFE_SIZE - 20 and font_size > 100:
        font_size = int(font_size * 0.90)
        gw, gh = measure_glyph_size(font_size)

    # No optical nudge — let make_italic_glyph's square-pad keep true centre.
    # The shear transform moves the visual weight slightly; the square canvas
    # already compensates for this, so geometric centre == safe placement.
    nx = 0
    ny = 0

    glyph_glow = make_italic_glyph("P", font_size, (*ACCENT,), shear=0.22)
    glyph_glow = glyph_glow.filter(ImageFilter.GaussianBlur(radius=6))  # reduced: 12→6 to stay in safe circle
    img = place_glyph(img, glyph_glow, cx, cy, nudge_x=nx, nudge_y=ny)
    # Tighter inner glow for vivid #9945FF
    glyph_glow2 = make_italic_glyph("P", font_size, (*ACCENT,), shear=0.22)
    glyph_glow2 = glyph_glow2.filter(ImageFilter.GaussianBlur(radius=2))  # reduced: 4→2
    img = place_glyph(img, glyph_glow2, cx, cy, nudge_x=nx, nudge_y=ny)

    # Pure #FFFFFF glyph (designer spec: not lavender-grey TEXT)
    glyph_white = make_italic_glyph("P", font_size, (255, 255, 255), shear=0.22)
    img = place_glyph(img, glyph_white, cx, cy, nudge_x=nx, nudge_y=ny)

    out_path = os.path.join(OUT_DIR, "adaptive-icon-foreground.png")
    img.save(out_path, "PNG", optimize=True)

    # Verify all non-transparent pixels are within the 66% safe zone circle (radius 169px)
    result = img.load()
    cx_v, cy_v = SIZE // 2, SIZE // 2
    SAFE_R = (SIZE - 2 * SAFE_INSET) / 2  # 169px
    violations = 0
    for py in range(SIZE):
        for px in range(SIZE):
            if result[px, py][3] > 10:  # non-transparent pixel
                dist = ((px - cx_v) ** 2 + (py - cy_v) ** 2) ** 0.5
                if dist > SAFE_R:
                    violations += 1
    if violations > 0:
        print(f"⚠️  WARNING: {violations} pixels outside safe zone circle (r={SAFE_R:.0f}px) — reduce glyph or blur")
    else:
        print(f"✅ Safe zone verified: all pixels within r={SAFE_R:.0f}px circle")
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
    nx = int(W * 0.015)
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

    # Clean bottom/top strips to pure BG to remove any glow/blur edge artifacts.
    # Increased to 500px bottom (from 200px) after designer flagged noise band at
    # bottom edge (Mar 2026 re-review). Extra margin ensures GaussianBlur halos
    # from the glyph layer are fully covered regardless of glyph placement variance.
    clean = ImageDraw.Draw(img)
    clean.rectangle([0, H - 500, W, H], fill=(*BG_COLOR, 255))
    clean.rectangle([0, 0, W, 200], fill=(*BG_COLOR, 255))
    # Belt-and-suspenders: paste a solid PIL image strip over the very bottom
    # to guarantee no alpha bleed from prior compositing operations.
    bottom_strip = Image.new("RGBA", (W, 500), (*BG_COLOR, 255))
    img.paste(bottom_strip, (0, H - 500))

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
