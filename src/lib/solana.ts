import { Connection, clusterApiUrl } from '@solana/web3.js';

/**
 * Default to devnet — this is a devnet app. Users should NEVER accidentally
 * hit mainnet. EXPO_PUBLIC_CLUSTER can override (e.g. "mainnet-beta" for prod).
 */
const CLUSTER = (process.env.EXPO_PUBLIC_CLUSTER as 'devnet' | 'mainnet-beta') || 'devnet';
const RPC_URL = process.env.EXPO_PUBLIC_RPC_URL || 'https://devnet.helius-rpc.com/?api-key=ecfc91c7-b704-4c37-b10e-a277392830aa';

export const connection = new Connection(RPC_URL, 'confirmed');
export { CLUSTER };
