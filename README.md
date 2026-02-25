# Percolator Mobile

Native Solana trading app for the [Percolator](https://github.com/dcccrypto/percolator) perpetual futures protocol — built for the **Solana Seeker** phone with Mobile Wallet Adapter (MWA) integration.

> **⚠️ DISCLAIMER: FOR EDUCATIONAL PURPOSES ONLY** — This code has NOT been audited. Do NOT use in production or with real funds.

---

## What It Does

Trade coin-margined perpetuals on Solana from your phone. Connect your wallet via biometric signing (fingerprint on Seeker), view live markets, manage positions, and deposit/withdraw collateral — all natively, no browser required.

**Key features:**
- **One-tap wallet connect** via Mobile Wallet Adapter (Seed Vault, Phantom, Solflare)
- **Biometric signing** — no seed phrases, no popups
- **Live market data** from on-chain slab accounts and DEX oracles
- **Position management** — open/close longs and shorts with leverage
- **Portfolio view** — real-time PnL, collateral, and liquidation prices
- **Terminal/HUD aesthetic** — matches the percolatorlaunch.com design system

---

## Architecture

```
┌─────────────────────────────────────────┐
│           Percolator Mobile             │
│                                         │
│  React Native 0.81 + Expo 54 (bare)    │
│                                         │
│  ┌───────────┐  ┌───────────────────┐   │
│  │ Screens   │  │ Solana Connection │   │
│  │ - Trade   │  │ @solana/web3.js   │   │
│  │ - Markets │  │                   │   │
│  │ - Folio   │  │ MWA (biometric)   │   │
│  │ - Settings│  │ Seed Vault / etc  │   │
│  └───────────┘  └───────────────────┘   │
│         │                 │             │
│    Supabase          Solana RPC         │
│    (backend)         (devnet/mainnet)   │
└─────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [React Native](https://reactnative.dev) 0.81 + [Expo](https://expo.dev) 54 (bare workflow) |
| Language | TypeScript (strict mode) |
| Wallet | [Solana Mobile Stack](https://solanamobile.com) — Mobile Wallet Adapter (MWA) |
| Blockchain | [@solana/web3.js](https://solana-labs.github.io/solana-web3.js/) |
| Navigation | [React Navigation](https://reactnavigation.org/) (bottom tabs) |
| State | [Zustand](https://zustand-demo.pmnd.rs/) |
| Styling | [NativeWind](https://www.nativewind.dev/) (Tailwind CSS for React Native) |
| Backend | [Supabase](https://supabase.com) |

---

## Prerequisites

- **Node.js** 18+ and npm
- **Android Studio** with Android SDK (API 33+)
- **Java** 17+ (for Android builds)
- **Expo CLI**: `npm install -g expo-cli`
- **EAS CLI**: `npm install -g eas-cli` (for production builds)
- Optionally: a **Solana Seeker** device or Android emulator with a wallet app

---

## Getting Started

### Clone and Install

```bash
git clone https://github.com/dcccrypto/percolator-mobile.git
cd percolator-mobile
npm install
```

### Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
SOLANA_RPC_URL=https://api.devnet.solana.com
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

### Run Development Build

```bash
# Start Metro bundler
npx expo start --dev-client

# Run on Android device/emulator
npx expo run:android

# Run on iOS simulator (macOS only)
npx expo run:ios
```

### Build for Production

```bash
# Android APK (for dApp Store / sideloading)
eas build --platform android --profile production

# Android AAB (for Play Store)
eas build --platform android --profile play-store
```

---

## Project Structure

```
percolator-mobile/
├── src/
│   ├── navigation/         # React Navigation setup (bottom tabs)
│   ├── screens/            # Screen components
│   │   ├── TradeScreen.tsx      # Main trading interface
│   │   ├── MarketsScreen.tsx    # Browse available markets
│   │   ├── PortfolioScreen.tsx  # Positions, PnL, collateral
│   │   └── SettingsScreen.tsx   # RPC, wallet, preferences
│   ├── components/
│   │   ├── ui/             # Shared primitives (Panel, HudCorners, Button)
│   │   └── trade/          # Trading-specific (OrderForm, PositionCard, PriceChart)
│   ├── hooks/
│   │   ├── useMWA.ts       # Mobile Wallet Adapter connection
│   │   └── useTrading.ts   # Trade execution and position management
│   ├── lib/
│   │   ├── solana.ts       # Solana connection + transaction helpers
│   │   ├── supabase.ts     # Supabase client
│   │   └── constants.ts    # Program IDs, endpoints, config
│   ├── theme/              # Design tokens (matches percolatorlaunch.com)
│   └── types/              # TypeScript type definitions
├── android/                # Native Android project
├── ios/                    # Native iOS project
├── App.tsx                 # Root component
├── app.json                # Expo configuration
├── metro.config.js         # Metro bundler config
├── babel.config.js         # Babel config (NativeWind)
├── tsconfig.json           # TypeScript config
└── package.json
```

---

## Design System

The app uses the same design tokens as [percolatorlaunch.com](https://percolatorlaunch.com):

| Token | Value | Usage |
|-------|-------|-------|
| Background | `#0A0A0F` | App background |
| Surface | `#12121A` | Card/panel backgrounds |
| Accent | `#9945FF` | Solana purple — buttons, links |
| Long | `#14F195` | Long positions, positive PnL |
| Short | `#FF3B5C` | Short positions, negative PnL |
| Font | JetBrains Mono | Monospace-first typography |
| Corners | Sharp (0 radius) | Terminal/HUD aesthetic |

---

## Wallet Integration

The app uses the **Mobile Wallet Adapter (MWA)** protocol:

1. User taps "Connect Wallet"
2. MWA discovers on-device wallets (Seed Vault on Seeker, Phantom, Solflare)
3. User selects wallet and authorizes with biometrics
4. All subsequent transaction signing uses biometric confirmation — no popups or seed phrases

```typescript
import { useMWA } from "./hooks/useMWA";

const { connect, signTransaction, publicKey } = useMWA();
await connect();
const signedTx = await signTransaction(transaction);
```

---

## Solana Seeker dApp Store Publishing

For publishing to the Solana dApp Store:

1. Build production APK: `eas build --platform android --profile production`
2. Follow the [Solana dApp Store submission guide](https://docs.solanamobile.com/dapp-publishing/intro)
3. Ensure the app meets dApp Store listing requirements (icon, screenshots, description)

---

## Related Repositories

| Repository | Description |
|-----------|-------------|
| [percolator](https://github.com/dcccrypto/percolator) | Core risk engine crate (Rust) |
| [percolator-prog](https://github.com/dcccrypto/percolator-prog) | Solana on-chain program (wrapper) |
| [percolator-matcher](https://github.com/dcccrypto/percolator-matcher) | Reference matcher program for LP pricing |
| [percolator-stake](https://github.com/dcccrypto/percolator-stake) | Insurance LP staking program |
| [percolator-sdk](https://github.com/dcccrypto/percolator-sdk) | TypeScript SDK for client integration |
| [percolator-ops](https://github.com/dcccrypto/percolator-ops) | Operations dashboard |
| [percolator-launch](https://github.com/dcccrypto/percolator-launch) | Full-stack launch platform (monorepo) |

## License

Apache 2.0 — see [LICENSE](LICENSE).
