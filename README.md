# Percolator Mobile

Solana Seeker native trading app — React Native + Expo bare workflow.

## Stack

- **React Native** 0.81 + **Expo** 54 (bare workflow)
- **Solana Mobile Stack** — Mobile Wallet Adapter (MWA) for Seed Vault signing
- **@solana/web3.js** — Solana transaction building
- **React Navigation** — Bottom tab navigation
- **Supabase** — Backend data
- **Zustand** — State management
- **NativeWind** — Tailwind CSS for React Native

## Prerequisites

- Node.js 18+
- Android SDK / Android Studio
- Java 17+ (for Android builds)
- Expo CLI: `npm install -g expo-cli`
- EAS CLI: `npm install -g eas-cli` (for builds)

## Setup

```bash
# Clone
git clone https://github.com/dcccrypto/percolator-mobile.git
cd percolator-mobile

# Install
npm install

# Configure environment
cp .env.example .env
# Edit .env with your RPC URL and Supabase credentials

# Start Metro bundler
npx expo start --dev-client

# Run on Android (requires emulator or device)
npx expo run:android
```

## Project Structure

```
src/
├── navigation/     # React Navigation setup
├── screens/        # Screen components (Trade, Portfolio, Markets, Settings)
├── components/
│   ├── ui/         # Shared primitives (Panel, HudCorners)
│   └── trade/      # Trading-specific components
├── hooks/          # Custom hooks (useMWA, useTrading)
├── lib/            # Solana connection, Supabase client, constants
├── theme/          # Design tokens matching percolatorlaunch.com
└── types/          # TypeScript types
```

## Design System

Uses the same design tokens as `percolatorlaunch.com`:
- Dark theme (`#0A0A0F` background)
- Solana purple accent (`#9945FF`)
- JetBrains Mono monospace-first typography
- Terminal/HUD aesthetic with sharp corners
- Green for long positions (`#14F195`), Red for short (`#FF3B5C`)

## Wallet Integration

Uses Mobile Wallet Adapter (MWA) protocol to connect with on-device wallets
(Seed Vault Wallet on Seeker, Phantom, Solflare, etc.). All transaction signing
is biometric (fingerprint) — no popups or seed phrases.

## dApp Store Publishing

See the `solana-seeker-mobile` skill reference for full dApp Store publishing checklist.

```bash
# Build production APK
eas build --platform android --profile production
```
