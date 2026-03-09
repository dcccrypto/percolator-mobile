/**
 * Percolator slab binary layout detection — mobile-safe port of
 * packages/core/src/solana/slab.ts layout constants.
 *
 * Supports V0 (deployed devnet, HEADER=72 / CONFIG=408 / ACCT=240) and
 * V1 (future upgrade, HEADER=104 / CONFIG=536 / ACCT=248).
 *
 * All offsets in this file must stay in sync with the authoritative source:
 *   percolator-launch/packages/core/src/solana/slab.ts
 */

// ── V0 layout (deployed devnet program) ──────────────────────────────────────
// InsuranceFund: {balance: U128, fee_revenue: U128} = 32 bytes
// RiskParams: 56 bytes
// No mark_price, no long_oi/short_oi, no emergency OI cap fields
// Account: 240 bytes (no last_partial_liquidation_slot)
const V0_HEADER_LEN = 72;
const V0_ENGINE_OFF = 480;   // align_up(72 + 408, 8) = 480
const V0_BITMAP_OFF = 320;   // engine-relative offset of bitmap
const V0_ACCOUNT_SIZE = 240;

// ── V1 layout (future program upgrade) ───────────────────────────────────────
// InsuranceFund expanded, RiskParams 288 bytes, Account 248 bytes
const V1_HEADER_LEN = 104;
const V1_ENGINE_OFF = 640;   // align_up(104 + 536, 8) = 640
const V1_BITMAP_OFF = 656;   // engine-relative offset of bitmap
const V1_ACCOUNT_SIZE = 248;

// Tiers supported by the program (maxAccounts per slab)
const TIERS = [64, 256, 1024, 4096] as const;

// Number of bytes between end of bitmap and start of next_free[] array:
//   num_used_accounts: u16 (2) + _pad: [u8;6] (6) + next_account_id: u64 (8) + free_head: u16 (2) = 18
const POST_BITMAP_BYTES = 18;

function computeSlabSize(
  engineOff: number,
  bitmapOff: number,
  accountSize: number,
  maxAccounts: number,
): number {
  const bitmapWords = Math.ceil(maxAccounts / 64);
  const bitmapBytes = bitmapWords * 8;
  const nextFreeBytes = maxAccounts * 2;
  const preAccountsLen = bitmapOff + bitmapBytes + POST_BITMAP_BYTES + nextFreeBytes;
  const accountsOffRel = Math.ceil(preAccountsLen / 8) * 8;
  return engineOff + accountsOffRel + maxAccounts * accountSize;
}

function computeAccountsOff(
  engineOff: number,
  bitmapOff: number,
  maxAccounts: number,
): number {
  const bitmapWords = Math.ceil(maxAccounts / 64);
  const bitmapBytes = bitmapWords * 8;
  const nextFreeBytes = maxAccounts * 2;
  const preAccountsLen = bitmapOff + bitmapBytes + POST_BITMAP_BYTES + nextFreeBytes;
  return engineOff + Math.ceil(preAccountsLen / 8) * 8;
}

// Pre-compute (size → maxAccounts) maps for fast lookup
const V0_SIZES = new Map<number, number>();
const V1_SIZES = new Map<number, number>();
for (const n of TIERS) {
  V0_SIZES.set(computeSlabSize(V0_ENGINE_OFF, V0_BITMAP_OFF, V0_ACCOUNT_SIZE, n), n);
  V1_SIZES.set(computeSlabSize(V1_ENGINE_OFF, V1_BITMAP_OFF, V1_ACCOUNT_SIZE, n), n);
}

export interface SlabLayoutInfo {
  version: 0 | 1;
  headerLen: number;
  engineOff: number;
  accountSize: number;
  maxAccounts: number;
  /** Absolute byte offset in the slab where the accounts array starts. */
  accountsOff: number;
}

/**
 * Detect slab layout version and tier from the raw data length.
 * Returns null for unrecognised sizes.
 */
export function detectLayout(dataLen: number): SlabLayoutInfo | null {
  const v0n = V0_SIZES.get(dataLen);
  if (v0n !== undefined) {
    return {
      version: 0,
      headerLen: V0_HEADER_LEN,
      engineOff: V0_ENGINE_OFF,
      accountSize: V0_ACCOUNT_SIZE,
      maxAccounts: v0n,
      accountsOff: computeAccountsOff(V0_ENGINE_OFF, V0_BITMAP_OFF, v0n),
    };
  }
  const v1n = V1_SIZES.get(dataLen);
  if (v1n !== undefined) {
    return {
      version: 1,
      headerLen: V1_HEADER_LEN,
      engineOff: V1_ENGINE_OFF,
      accountSize: V1_ACCOUNT_SIZE,
      maxAccounts: v1n,
      accountsOff: computeAccountsOff(V1_ENGINE_OFF, V1_BITMAP_OFF, v1n),
    };
  }
  return null;
}

// ── Config layout offsets (relative to configOff = headerLen) ────────────────
// Matches parseConfig() in packages/core/src/solana/slab.ts (borsh-packed, no padding).
//
//   collateralMint        Pubkey  +0
//   vaultPubkey           Pubkey  +32
//   indexFeedId           Pubkey  +64
//   maxStalenessSlots     u64     +96
//   confFilterBps         u16     +104
//   vaultAuthorityBump    u8      +106
//   invert                u8      +107
//   unitScale             u32     +108
//   fundingHorizonSlots   u64     +112
//   ...funding params...
//   oracleAuthority       Pubkey  +288
//   authorityPriceE6      u64     +320
//   ...
//
export const CFG_COLLATERAL_MINT_OFF = 0;   // relative to configOff
export const CFG_VAULT_OFF           = 32;  // relative to configOff
export const CFG_FEED_ID_OFF         = 64;  // relative to configOff (indexFeedId)
export const CFG_ORACLE_AUTHORITY_OFF = 288; // relative to configOff

// ── Account field offsets (relative to start of each account slot) ───────────
// First 240 bytes are identical in V0 and V1.
export const ACCT_ACCOUNT_ID_OFF    = 0;   // u64
export const ACCT_CAPITAL_OFF       = 8;   // U128 (16 bytes)
export const ACCT_KIND_OFF          = 24;  // u8  (0=User, 1=LP)
export const ACCT_PNL_OFF           = 32;  // I128 (16 bytes)
export const ACCT_POSITION_SIZE_OFF = 80;  // I128 (16 bytes)
export const ACCT_ENTRY_PRICE_OFF   = 96;  // u64
export const ACCT_MATCHER_PROG_OFF  = 120; // Pubkey (32 bytes)
export const ACCT_MATCHER_CTX_OFF   = 152; // Pubkey (32 bytes)
export const ACCT_OWNER_OFF         = 184; // Pubkey (32 bytes)
