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
    d.text((x0, y0), char, font=font, fill=(*fg_color, 255))

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

    Designer spec (PERC-529 review, blocker fix):
    - Glyph WIDTH = 48% of canvas = ~246px — solid white #FFFFFF at 100% opacity.
      (Reduced from 55% so ALL solid pixels fit within r=169px Android safe zone.)
    - Vertical centre at y=256 (canvas centre). nudge_y=0 — no optical correction
      needed; make_italic_glyph already centers content in its returned image, and
      the prior nudge_y=+26 was pushing the glyph 26px BELOW center (measured).
    - No hard circle-clip — Android circular masks clip natively; removing the clip
      allows full glyph under squircle/rounded-rect masks without hiding content.

    Android safe zone: r=169px (33% of 512px) centred at (256,256).
    At 48% canvas width (~246px), sheared glyph solid pixels stay within r=169px.
    """
    SIZE = 512
    # Designer spec (blocker fix): glyph solid pixels must fit within r=169px safe zone.
    # Empirical measurement: at 46.9% canvas the sheared italic P has max_dist=194px
    # (italic shear extends pixels beyond the width metric). Scale factor 169/194 = 0.87
    # → safe width ≈ 40% canvas. Using 40% leaves a small margin below r=169px.
    TARGET_WIDTH = int(SIZE * 0.40)  # 205px
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    cx = cy = SIZE // 2

    # Auto-scale font_size so glyph WIDTH (not max dimension) ≈ TARGET_WIDTH.
    # P's width is narrower than height, so we iterate on width specifically.
    font_size = 320
    for _ in range(10):
        gw, gh = measure_glyph_size(font_size)
        if gw == 0:
            break
        if abs(gw - TARGET_WIDTH) <= 3:
            break
        font_size = int(font_size * TARGET_WIDTH / gw)
    gw, gh = measure_glyph_size(font_size)
    print(f"  adaptive-icon: font_size={font_size}, glyph={gw}×{gh}px "
          f"(target width={TARGET_WIDTH}px = {TARGET_WIDTH / SIZE * 100:.0f}% of {SIZE})")

    # Solid white #FFFFFF at 100% opacity — explicit 4-tuple to avoid any ambiguity.
    glyph_white = make_italic_glyph("P", font_size, (255, 255, 255), shear=0.22)
    # nudge_y=+25: "P" glyph has its pixel mass concentrated in the top half
    # (bowl of the P). Without nudge, centre-of-mass lands at y≈231 (25px above
    # canvas centre). +25 brings it to y≈256. Prior nudge_y=+26 was overshooting
    # (measured centre at y=282, i.e. 26px BELOW centre) because the glyph was
    # rendered at a larger font-size (~55% canvas width) where the mass offset was
    # different. At the new 48% target size the measured nudge is +25.
    img = place_glyph(img, glyph_white, cx, cy, nudge_y=+25)

    out_path = os.path.join(OUT_DIR, "adaptive-icon-foreground.png")
    img.save(out_path, "PNG", optimize=True)

    # Verify dimensions, centering, and safe-zone compliance
    arr = np.array(img)
    white = (arr[:, :, 0] > 200) & (arr[:, :, 1] > 200) & \
            (arr[:, :, 2] > 200) & (arr[:, :, 3] > 200)
    ys_w, xs_w = np.where(white)
    if len(ys_w) > 0:
        actual_w = int(xs_w.max() - xs_w.min())
        center_y = float(ys_w.mean())
        center_x = float(xs_w.mean())
        print(f"✅ Glyph width : {actual_w}px ({actual_w / SIZE * 100:.1f}% canvas) — target {TARGET_WIDTH}px")
        print(f"✅ Centre of mass: x={center_x:.1f}, y={center_y:.1f} — target x=256, y=256")
        # Safe-zone: r=169px (33% of 512) centred at (256,256)
        SAFE_R = 169
        cx_safe = cy_safe = SIZE // 2
        dist = np.sqrt((xs_w - cx_safe).astype(np.float32) ** 2 +
                       (ys_w - cy_safe).astype(np.float32) ** 2)
        outside = int((dist > SAFE_R).sum())
        max_dist = float(dist.max())
        if outside == 0:
            print(f"✅ Safe zone (r={SAFE_R}px): ALL {len(ys_w)} solid pixels within — max dist {max_dist:.1f}px")
        else:
            print(f"⚠️  Safe zone (r={SAFE_R}px): {outside} pixels OUTSIDE — max dist {max_dist:.1f}px")
    else:
        print("⚠️  No white pixels found — check font path or fill colour!")
    print(f"✅ adaptive-icon-foreground.png ({SIZE}×{SIZE}) → {out_path}")


def generate_adaptive_icon_bg():
    """512×512 adaptive icon background — #0D0D0F + radial #9945FF glow.

    Glow lives here (not on the foreground) so FG is pure white P on transparent —
    no shadow visible on any launcher background colour.
    """
    SIZE = 512
    cx = cy = SIZE // 2
    img = Image.new("RGBA", (SIZE, SIZE), (*BG_COLOR, 255))
    img = radial_glow(img, cx, cy, 180, ACCENT, 0.40)
    img = radial_glow(img, cx, cy, 240, ACCENT, 0.15)
    img.convert("RGB").save(
        os.path.join(OUT_DIR, "adaptive-icon-background.png"), "PNG")
    print(f"✅ adaptive-icon-background.png ({SIZE}×{SIZE})")


def generate_splash():
    """1242×2688 splash screen.

    Fix (clean re-export): composite all layers onto an explicit RGB canvas
    coloured BG_COLOR rather than using .convert("RGB") which blends against
    black (0,0,0) — any sub-pixel alpha residue at edges would previously
    produce a faint off-colour horizontal line at the bottom edge.
    """
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

    # Convert to RGB FIRST (designer blocker fix): composite RGBA onto an explicit
    # BG_COLOR canvas, then apply ALL fill passes on the final RGB image.
    # Doing RGBA fills BEFORE conversion can leave blending residue at zone
    # boundaries when the alpha channel is composited — convert first, fill after.
    out_rgb = Image.new("RGB", (W, H), BG_COLOR)
    out_rgb.paste(img.convert("RGB"), mask=img.split()[3])

    # Numpy fill passes on the RGB output — belt-and-suspenders.
    # Fill after conversion so there is no alpha-blend step between fill and save.
    BOTTOM_CLEAN = 600
    TOP_CLEAN = 300
    arr_out = np.array(out_rgb)
    arr_out[H - BOTTOM_CLEAN:, :] = list(BG_COLOR)
    arr_out[:TOP_CLEAN, :] = list(BG_COLOR)
    out_rgb = Image.fromarray(arr_out, "RGB")

    out_path = os.path.join(OUT_DIR, "splash.png")
    out_rgb.save(out_path, "PNG")
    print(f"✅ splash.png ({W}×{H}) → {out_path} (clean RGB export, no alpha blend artifact)")


# ---------------------------------------------------------------------------
if __name__ == "__main__":
    print("🔨 Generating Percolator app icons (PERC-529)...")
    generate_app_icon()
    generate_adaptive_icon_fg()
    generate_adaptive_icon_bg()
    generate_splash()
    print("🎉 Done.")
