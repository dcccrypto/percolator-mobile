import { Connection } from '@solana/web3.js';

/**
 * Default to devnet — this is a devnet app. Users should NEVER accidentally
 * hit mainnet. EXPO_PUBLIC_CLUSTER can override (e.g. "mainnet-beta" for prod).
 */
const CLUSTER = (process.env.EXPO_PUBLIC_CLUSTER as 'devnet' | 'mainnet-beta') || 'devnet';

/**
 * RPC URL — must be provided via EAS Secrets / .env.
 * EXPO_PUBLIC_RPC_URL is set in CI (EAS Secrets) and locally via .env.local.
 * We throw at module init so a missing key causes an obvious build-time / startup
 * error rather than silent failures or key exposure in the bundle.
 */
const rpcUrl = process.env.EXPO_PUBLIC_RPC_URL;
if (!rpcUrl) {
  throw new Error(
    '[solana] EXPO_PUBLIC_RPC_URL is not set. ' +
    'Add it to EAS Secrets (production) or .env.local (development). ' +
    'Never hardcode API keys in source.',
  );
}

export const connection = new Connection(rpcUrl, 'confirmed');
export { CLUSTER };
