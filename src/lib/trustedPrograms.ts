import { PublicKey } from '@solana/web3.js';

/**
 * Known trusted Percolator program IDs (devnet + mainnet-beta).
 * Parsed programId from slab config is validated against this set before any
 * PDA derivation or instruction building (slab owner spoofing defence).
 *
 * Single source of truth — used by useCollateral.ts, useTrade.ts, and any
 * future hooks that handle slab-based operations.
 */
export const TRUSTED_PROGRAM_IDS: ReadonlySet<string> = new Set([
  'GM8zjJ8LTBMv9xEsverh6H6wLyevgMHEJXcEzyY3rY24', // devnet v0
  'PCKRHBmNXjTLV7RCM8JCBiJGveKptb6NKZcV7Xhf5wW',  // mainnet-beta (reserved)
]);

/**
 * Validate that the programId parsed from the slab config belongs to the
 * known Percolator program set. Throws if the owner/program is not trusted,
 * preventing PDAs/instructions from being derived from a spoofed account.
 */
export function assertTrustedProgram(programId: PublicKey): void {
  if (!TRUSTED_PROGRAM_IDS.has(programId.toBase58())) {
    throw new Error(`Untrusted program: ${programId.toBase58()}`);
  }
}
