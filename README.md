# Percolator Mobile

A React Native (Expo, bare workflow) trading app for Percolator perpetual futures on Solana, built with the Solana Mobile Stack so it works on Seeker and other Android devices. Wallet signing goes through Mobile Wallet Adapter (MWA).

This code has not been audited. Do not use it with real funds.

## What is in it

Screens in `src/screens/`: Markets, Trade, Portfolio, Collateral, Earn, Stake, Leaderboard, Market Creation, Faucet, Settings, Dashboard, Onboarding. Data comes from Percolator's HTTP API, Supabase, and Solana RPC (slab accounts are parsed on the device). State is in Zustand, navigation in React Navigation.

```
src/screens/      screen components
src/components/   shared UI and trading components
src/hooks/        wallet (useMWA), trading, positions, market data
src/lib/          RPC/Solana helpers, API client, slab layout, trusted program list
src/theme/        design tokens and fonts
android/, ios/    native projects
__tests__/        jest tests
```

## Build and run

Requires Node.js 18+, pnpm, and for device builds the Android SDK and JDK 17+. The lockfile in CI is `pnpm-lock.yaml`; `npm ci` does not currently work against `package-lock.json`.

```bash
git clone https://github.com/dcccrypto/percolator-mobile.git
cd percolator-mobile
pnpm install
cp .env.example .env     # fill in your own values
pnpm start               # Metro, dev client
pnpm android             # build and run on a device or emulator
pnpm test                # jest
```

Needed in `.env`: `EXPO_PUBLIC_RPC_URL` and `EXPO_PUBLIC_HELIUS_API_KEY` (your own keys, never commit them), `EXPO_PUBLIC_CLUSTER` (`devnet` by default), and the Supabase URL and anon key. `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_WEB_URL` point at the Percolator backend APIs; check `src/lib/api.ts` for the defaults.

Release APK builds and sideloading are described in [DISTRIBUTION.md](./DISTRIBUTION.md).

## Programs

The app only accepts slabs owned by programs listed in `src/lib/trustedPrograms.ts`. Devnet programs get redeployed, so update that list (and your `.env`) when you point the app at a different deployment.

## Related repositories

| Repository | What it is |
|-----------|------------|
| [percolator-launch](https://github.com/dcccrypto/percolator-launch) | Web app |
| [percolator-sdk](https://github.com/dcccrypto/percolator-sdk) | TypeScript SDK |
| [percolator-prog](https://github.com/dcccrypto/percolator-prog) | On-chain wrapper program |
| [percolator-stake](https://github.com/dcccrypto/percolator-stake) | Insurance LP staking program |
| [percolator](https://github.com/dcccrypto/percolator) | Risk engine crate (Rust) |

## License

Apache 2.0, see [LICENSE](LICENSE).
