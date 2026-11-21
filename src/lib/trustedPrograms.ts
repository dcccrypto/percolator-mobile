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
  // v2.2 devnet fresh-address set, deployed 2026-11-06. Verified executable
  // on devnet 2026-11-21 via getAccountInfo / solana program show.
  '5NGgnU2j315Ci2tso8VJDEthaVExuiKG3tn4xnur28xe', // wrapper
  'DfTxJUT5BbERs1tR33dP82kaUJ1NLymRxXErXAYXcDam', // matcher
  'DWUNq2iYh6Sdgdv3qv7aWJNJGhoK25FqyQrqDUrDD9zs', // nft
  'A6DVNubvzMMETQinK6bipekkaTTrkUu2RMw2kBoJrdkE', // stake
  'GM8zjJ8LTBMv9xEsverh6H6wLyevgMHEJXcEzyY3rY24', // historical devnet v0
  'PCKRHBmNXjTLV7RCM8JCBiJGveKptb6NKZcV7Xhf5wW',  // reserved mainnet-beta (not the 11-06 set)
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
