# DESIGN-BRIEF-MOBILE-V2.md
**Percolator — Solana Seeker Native App**
**Produced by:** Designer Agent (PERC-506)
**Date:** 2026-03-08
**Status:** Ready for coder implementation

---

## 0. Design Principles

These apply everywhere:

- **Dark-first, always.** Background is `#06060C` (`bgVoid`). Nothing is white.
- **Purple is authority.** `#9945FF` (`accent`) is the one brand colour. Use it on CTAs, active states, live indicators.
- **Green = gain, red = loss.** `#14F195` / `#FF3B5C` — no exceptions.
- **Mono for numbers.** Every price, percentage, leverage, volume uses `JetBrains Mono`. Labels use `Inter`.
- **Min tap target = 48px.** Already in `safeAreas` — enforce it everywhere.
- **Seeker viewport:** 2670×1200 (20:9). Target 390×844 logical pts (3× density).

---

## 1. App Icon + Splash Screen

### 1.1 App Icon — 1024×1024 px PNG

**Concept:** The Percolator `P` glyph inside a dark pill, with a purple radial glow.

| Layer | Spec |
|-------|------|
| Background fill | `#0D0D0F` — solid, no transparency |
| Outer corner radius | Use iOS/Android default mask (supply square; system rounds) |
| Glyph | Bold italic "P" in JetBrains Mono, 480px, white (`#E1E2E8`) |
| Glyph shadow | `rgba(153,69,255,0.6)` blur 48px, spread 0, offset 0 0 |
| Background glow | Radial gradient center: `rgba(153,69,255,0.25)` → transparent, 720px diameter |
| Inner ring (optional) | 1px stroke `rgba(153,69,255,0.2)` at 960px square, corner-radius 240px |

**File:** `public/icons/app-icon-1024.png`

### 1.2 Adaptive Icon (Android) — 512×512 foreground

Same "P" glyph, transparent background. System applies safe-zone mask (108dp, safe zone 72dp).

- Foreground layer: glyph centred at 256×256, no background
- Background layer: solid `#0D0D0F` (supply separately if build requires it)

**File:** `public/icons/adaptive-icon-fg-512.png`

### 1.3 Splash Screen

| Element | Spec |
|---------|------|
| Background | `#0D0D0F` full bleed |
| Logo | Percolator wordmark or "P" glyph, white, max 280px wide, vertically centred |
| Glow | Purple radial `rgba(153,69,255,0.15)` 600px, centred behind logo |
| Loading indicator | None — hide until ready; use `expo-splash-screen` |
| Animation | Fade in from 0 → 1 opacity over 300ms on first render (existing `timing.slow`) |

**File:** `public/icons/splash-1242x2688.png` (Expo convention)

---

## 2. Bottom Tab Bar

### 2.1 Current State

Ionicons (`trending-up`, `bar-chart`, `briefcase`, `menu`) are functional but generic. Tab label font is Mono 10px — correct.

### 2.2 Custom Icon Spec

Each icon is a 24×24 vector shape (SVG → `react-native-svg` or as PNG sprites at 2×/3×).

| Tab | Active icon | Inactive icon | Concept |
|-----|------------|---------------|---------|
| **Markets** | Flame (`🔥`-inspired) filled with accent | Same, outline, textMuted | Hot charts / discovery |
| **Trade** | Candlestick bar chart, 3 bars, filled | Same, outline | Direct trade intent |
| **Portfolio** | Stack of two rounded rects (positions stacked) | Outline | Holdings |
| **More** | 3 horizontal dots, filled | Same | Settings / overflow |

**Active state:**
- Icon fill: `accent` (`#9945FF`)
- Label: `accent`, Mono 10px
- Active indicator: 2px horizontal pill `accent` centered above icon, 24px wide (optional — adds polish)

**Inactive state:**
- Icon fill: `textMuted` (`#454B5F`)
- Label: `textMuted`

**Tab bar container:**
```
backgroundColor: bgInset (#141820)
borderTopColor: border (#1C1F2E)
borderTopWidth: 1px
height: 64px (existing — correct)
paddingTop: 8, paddingBottom: 8
```

### 2.3 Optional: Centre FAB (Quick Trade)

If PM approves a 5th slot: a floating `+` button in the centre well with `accent` bg, white icon, 52px diameter, `elevation: 8`. Taps open a bottom sheet with Long/Short market selector. **Not blocking PERC-506 delivery** — add as follow-up task if desired.

---

## 3. Market Card Layout

### 3.1 Current State
Basic card: symbol, price, change, OI bar, Long/Short buttons.

### 3.2 Revised Spec

```
┌─────────────────────────────────────────────┐
│  [LOGO 36px]  SOL-PERP          $154.82     │
│               Solana Perp   ▲ +2.41% [badge]│
│  ──────────────────────────────────────────  │
│  Vol $4.2M   OI $18.5M   24h █████░░ 62%    │
│                  [LONG ▲]  [SHORT ▼]         │
└─────────────────────────────────────────────┘
```

| Element | Spec |
|---------|------|
| Container | `bgElevated` bg, `border` 1px, `radii.xl` (16px), mx 12, mb 8 |
| Logo | 36×36 circle, `bgInset` fallback, 12px left padding |
| Symbol | JetBrains Mono Bold 15px, `text` colour |
| Name | Inter 12px, `textSecondary`, below symbol |
| Price | JetBrains Mono Bold 18px, `text`, right-aligned |
| Change badge | Pill: `longSubtle` or `shortSubtle` bg, `long`/`short` text, Mono Bold 12px |
| Divider | 1px `border`, full width |
| Stats row | Vol + OI in Inter 11px `textSecondary`. OI bar: `bgInset` track, `accent`/`warning`/`short` fill at 50%/80% thresholds. Bar height 4px, rounded. |
| Buttons | `LONG ▲` — `longSubtle` bg, `long` text. `SHORT ▼` — `shortSubtle` bg, `short` text. Both: `radii.md`, height 36px, flex-1, Mono Bold 12px |

**Hot indicator:** When OI > 80% capacity OR 24h vol > $1M: show `🔥` emoji right of symbol (not an emoji — use a small icon or a pixel-art flame SVG sized 14px).

---

## 4. Trade Screen Layout

### 4.1 Height Distribution (844px logical height)

```
[ SafeArea top — 48px ]
[ Market selector header — 48px ]
[ Timeframe pills — 36px ]
[ Chart area — ~295px (~40% of 734px usable) ]
[ Stats row — 44px scrollable horizontal ]
[ Long/Short toggle — 48px ]
[ Order form — ~215px ]
[ Submit button — 56px ]
[ SafeArea bottom — 40px ]
```

Total usable: 844 − 48 (safe top) − 40 (safe bot) − 64 (tab bar) = 692px usable.
Chart = 40% × 692 ≈ **277px**.

### 4.2 Stats Row (horizontal scroll)

```
Funding  OI       Volume   Spread   Mark     Index
0.012%   $18.5M   $4.2M    $0.04    $154.82  $154.79
```

Each cell: min-width 72px, padding h 12px. `textSecondary` label 10px Inter, `text` value 12px Mono. Scroll horizontally without snap.

Container: `bgInset` bg, 1px `border` top/bottom, height 44px, `ScrollView horizontal showsHorizontalScrollIndicator={false}`.

### 4.3 Long/Short Toggle

Full-width pill row, height 48px, `bgInset` background, `radii.lg`:
- **LONG** selected: `longSubtle` bg, `long` text + `▲` icon, Mono Bold 14px
- **SHORT** selected: `shortSubtle` bg, `short` text + `▼` icon
- Inactive side: transparent, `textMuted`

### 4.4 Leverage Slider

Replace discrete `1x 2x 5x 10x 20x` pills with a **continuous slider** (if build complexity permits) OR keep pills styled as:
- Pill container: `bgInset`, `border` 1px, `radii.full`
- Active pill: `accent` bg, white Mono Bold 12px
- Inactive: transparent, `textMuted`

Slider option (preferred):
- Track: `bgInset`, height 4px, `radii.full`
- Fill: `accent` → selected position
- Thumb: 20px circle, `accent` fill, `bgVoid` border 2px, `elevation: 4`
- Ticks at 1× 2× 5× 10× 20× with labels below in Mono 10px `textMuted`

### 4.5 Size Input

```
[  $ ___________  ] [MAX]
```
- `InputField` component existing, add $ prefix label
- MAX button: `accentPillBg` bg, `accent` text, `radii.full`, 36px height

### 4.6 Submit Button

Height 56px, full width, `radii.lg`.
- Long: `long` (#14F195) bg, `bgVoid` text, JetBrains Mono Bold 14px `OPEN LONG ▲`
- Short: `short` (#FF3B5C) bg, white text, `OPEN SHORT ▼`
- Disabled: `bgInset` bg, `textMuted` text
- Loading: spinner replaces label, same colours

---

## 5. Onboarding Slides

`OnboardingScreen.tsx` exists. This spec covers the 3 illustration + copy slides.

### 5.1 Slide Structure

```
[ Illustration — 280×280px centred ]
[ Heading — Inter Bold 24px ]
[ Body copy — Inter 15px textSecondary, max 2 lines ]
[ Dot indicators ]
[ CTA button ]
```

Background: `bgVoid` (`#06060C`), full bleed. Subtle purple radial glow behind illustration.

### 5.2 Slide 1 — "Perps on Solana"

**Illustration concept:** A candlestick chart rising sharply from left to right, Solana purple/green glow. Stylised, flat-design. 280×280px.

| Element | Value |
|---------|-------|
| Heading | `Trade Any Market` |
| Body | `Perpetual futures on Solana — no expiry, deep liquidity, sub-second settlement.` |
| BG glow | `rgba(153,69,255,0.12)` radial, 400px, centred |

### 5.3 Slide 2 — "On-Chain"

**Illustration concept:** A chain link / lock icon in Solana green with purple accents, minimal.

| Element | Value |
|---------|-------|
| Heading | `Fully On-Chain` |
| Body | `Every trade is settled on Solana. No custodians. Your keys, your perps.` |
| BG glow | `rgba(20,241,149,0.08)` radial, 360px |

### 5.4 Slide 3 — "Deploy in 60s"

**Illustration concept:** A rocket launching from a dark surface, purple trail, Solana sunrise glow.

| Element | Value |
|---------|-------|
| Heading | `Launch Your Own Market` |
| Body | `Create a permissioned perp market in under 60 seconds. List anything.` |
| BG glow | `rgba(153,69,255,0.15)` radial, 420px |

### 5.5 Dot Indicator

- Active: 8px circle, `accent` fill
- Inactive: 6px circle, `border` fill
- Gap: 8px between dots
- Centred, 24px below body copy

### 5.6 CTA

- Last slide: `Get Started` — `accent` bg, white Mono Bold 14px, height 52px, full width, `radii.lg`
- Earlier slides: `Next →` — outlined, `accent` text, `border` border, same size

---

## 6. Color & Typography Confirmation

### 6.1 Confirmed Tokens (from `src/theme/tokens.ts`)

| Token | Hex | Use |
|-------|-----|-----|
| `bgVoid` | `#06060C` | Page backgrounds, modal overlays |
| `bg` | `#0A0A0F` | Default surfaces |
| `bgElevated` | `#0F1018` | Cards, panels |
| `bgInset` | `#141820` | Tab bar, inputs, chips |
| `accent` | `#9945FF` | CTAs, active states, brand |
| `long` | `#14F195` | Long side, positive PnL |
| `short` | `#FF3B5C` | Short side, negative PnL |
| `text` | `#E1E2E8` | Primary text |
| `textSecondary` | `#7A7F96` | Labels, captions |
| `textMuted` | `#454B5F` | Inactive tabs, placeholders |
| `border` | `#1C1F2E` | Card borders, dividers |

**✅ All tokens match `percolatorlaunch.com` `globals.css`** — no changes needed.

### 6.2 Typography Scale (confirmed)

| Use | Font | Size | Weight |
|-----|------|------|--------|
| Prices, percentages, leverage | JetBrains Mono | 11–32px | Bold (700) |
| Headings | Inter | 20–28px | Bold (700) |
| Body / labels | Inter | 12–16px | Regular (400) |
| Tab labels | JetBrains Mono | 10px | SemiBold (600) |
| Buttons | JetBrains Mono | 12–14px | Bold (700) |

**Minimum legibility sizes:**
- Never below `fontSizes.xs` (11px) for any visible text
- Price displays: min 14px
- CTA buttons: min 12px

### 6.3 Dark App Icon Background Note

App icon spec uses `#0D0D0F` (between `bgVoid` and `bg`) for maximum contrast vs the lighter `bg` cards. This is intentional — not a token mismatch.

---

## 7. File Deliverables Summary

| File | Path | Status |
|------|------|--------|
| App icon 1024×1024 | `public/icons/app-icon-1024.png` | 🔲 To generate |
| Adaptive icon foreground 512×512 | `public/icons/adaptive-icon-fg-512.png` | 🔲 To generate |
| Splash screen | `public/icons/splash-1242x2688.png` | 🔲 To generate |
| Custom tab icons (SVG×4) | `src/components/icons/tab-*.svg` | 🔲 Coder to implement |
| Onboarding illustrations (3) | `public/onboarding/slide-{1,2,3}.png` | 🔲 To generate |

**Image generation:** Will use `nano-banana-pro` skill. Images will be placed in the mobile repo `public/` directory once generated.

---

## 8. Implementation Notes for Coder

1. **Tab icons:** The current `Ionicons` approach is fine short-term. When custom SVG icons are ready, swap the `TabIcon` component in `RootNavigator.tsx` — keep the same focused/unfocused colour logic.

2. **Chart height:** In `TradeScreen.tsx`, the chart region should be constrained with `height: screenHeight * 0.40` (using `useWindowDimensions`). Already imported — just apply it to the chart container `View`.

3. **Stats row:** Wrap the stats row in `<ScrollView horizontal showsHorizontalScrollIndicator={false}>`. Each `<View>` cell: `minWidth: 72`, `paddingHorizontal: 12`.

4. **Leverage pills → slider:** If using pills (simpler), apply the active/inactive style above. The slider is a stretch goal — use `@react-native-community/slider` if adding.

5. **Onboarding slides:** The `OnboardingIcon` component in `src/components/ui/OnboardingIcon.tsx` may already scaffold this. Drop the 280×280 illustrations as `<Image>` sources.

6. **Submit button colour:** Must change dynamically with `direction` state — `long` green or `short` red. Never violet for the trade submit action.

---

## 9. Design Review Process

For each section implemented:
1. Coder opens PR with preview screenshots
2. Designer visually reviews via Vercel preview / Expo Go
3. Sign-off comment in Collector API message back to coder

Priority order for implementation:
1. **Chart 40% height** (quick win, high impact)
2. **Stats row horizontal scroll** (already close to done)
3. **Long/Short toggle + submit button colour** (UX clarity)
4. **Market card polish** (logo, hot indicator, divider)
5. **Onboarding slides** (illustrations pending asset generation)
6. **App icon + splash** (pending asset generation)
7. **Custom tab icons** (last — current Ionicons work fine)

---

*End of DESIGN-BRIEF-MOBILE-V2.md*
