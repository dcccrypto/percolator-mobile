import { Connection, clusterApiUrl } from '@solana/web3.js';

const CLUSTER = 'mainnet-beta';
const RPC_URL = process.env.EXPO_PUBLIC_RPC_URL || clusterApiUrl(CLUSTER);

export const connection = new Connection(RPC_URL, 'confirmed');
export { CLUSTER };
