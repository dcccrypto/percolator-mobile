import { Connection, clusterApiUrl } from '@solana/web3.js';

/**
 * Default to devnet — this is a devnet app. Users should NEVER accidentally
 * hit mainnet. EXPO_PUBLIC_CLUSTER can override (e.g. "mainnet-beta" for prod).
 */
const CLUSTER = (process.env.EXPO_PUBLIC_CLUSTER as 'devnet' | 'mainnet-beta') || 'devnet';
const RPC_URL = process.env.EXPO_PUBLIC_RPC_URL || clusterApiUrl(CLUSTER);

export const connection = new Connection(RPC_URL, 'confirmed');
export { CLUSTER };
