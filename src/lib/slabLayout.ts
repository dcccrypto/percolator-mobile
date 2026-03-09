/**
 * Slab layout auto-detection for V0 (deployed devnet) and V1 (future upgrade).
 *
 * V0: HEADER=72, CONFIG=408, ENGINE_OFF=480, ACCT_SIZE=240
 * V1: HEADER=104, CONFIG=536, ENGINE_OFF=640, ACCT_SIZE=248
 *
 * The accounts section offset is dynamic per-slab (depends on maxAccounts
 * and bitmap size). We read maxAccounts from RiskParams and compute it.
 *
 * Mirrors packages/core/src/solana/slab.ts detectSlabLayout().
 */

// ---- V0 constants (deployed devnet program) ----
const V0_HEADER_LEN = 72;
const V0_CONFIG_LEN = 408;
const V0_ENGINE_OFF = 480;
const V0_ACCT_SIZE = 240;

// ---- V1 constants (future upgrade) ----
const V1_HEADER_LEN = 104;
const V1_CONFIG_LEN = 536;
const V1_ENGINE_OFF = 640;
const V1_ACCT_SIZE = 248;

// Config field offsets (relative to config start)
export const CFG_PROGRAM_ID_OFF = 0;
export const CFG_ADMIN_OFF = 32;
export const CFG_ORACLE_AUTHORITY_OFF = 64;
export const CFG_INDEX_FEED_ID_OFF = 96;
export const CFG_VAULT_OFF = 128;
export const CFG_COLLATERAL_MINT_OFF = 160;

// Engine-relative offsets for RiskParams.max_accounts (u64 at offset 32 within params)
// V0: params start at engine+48, max_accounts at params+32 = engine+80
// V1: params start at engine+48, max_accounts at params+32 = engine+80
const ENGINE_PARAMS_MAX_ACCOUNTS_REL = 80;

// Account field offsets (relative to account start)
export const ACCT_ACCOUNT_ID_OFF = 0;   // u64
export const ACCT_CAPITAL_OFF = 8;       // u128
export const ACCT_KIND_OFF = 24;         // u8 (0=User, 1=LP)
export const ACCT_PNL_OFF = 32;          // i128
export const ACCT_POSITION_SIZE_OFF = 80; // i128
export const ACCT_ENTRY_PRICE_OFF = 96;  // u64
export const ACCT_MATCHER_PROGRAM_OFF = 120;
export const ACCT_MATCHER_CONTEXT_OFF = 152;
export const ACCT_OWNER_OFF = 184;

export interface SlabLayout {
  version: 0 | 1;
  headerLen: number;
  configOff: number;
  engineOff: number;
  acctSize: number;
  accountsOff: number; // absolute offset of accounts array
  maxAccounts: number;
}

function readU64LE(buf: Uint8Array, off: number): bigint {
  return new DataView(buf.buffer, buf.byteOffset + off, 8).getBigUint64(0, true);
}

/**
 * Detect slab layout version from data length and compute accounts offset.
 *
 * Heuristic: V0 slabs have sizes derived from 240-byte accounts;
 * V1 slabs from 248-byte accounts. We try V0 first since that's what's deployed.
 */
export function detectSlabLayout(data: Uint8Array): SlabLayout | null {
  if (data.length < V0_ENGINE_OFF + 88) return null; // too small for any layout

  // Try V0 first (deployed devnet)
  const v0Layout = tryLayout(data, 0, V0_HEADER_LEN, V0_CONFIG_LEN, V0_ENGINE_OFF, V0_ACCT_SIZE);
  if (v0Layout) return v0Layout;

  // Try V1
  const v1Layout = tryLayout(data, 1, V1_HEADER_LEN, V1_CONFIG_LEN, V1_ENGINE_OFF, V1_ACCT_SIZE);
  if (v1Layout) return v1Layout;

  return null;
}

function tryLayout(
  data: Uint8Array,
  version: 0 | 1,
  headerLen: number,
  _configLen: number,
  engineOff: number,
  acctSize: number,
): SlabLayout | null {
  if (data.length < engineOff + ENGINE_PARAMS_MAX_ACCOUNTS_REL + 8) return null;

  try {
    const maxAccountsBig = readU64LE(data, engineOff + ENGINE_PARAMS_MAX_ACCOUNTS_REL);
    const maxAccounts = Number(maxAccountsBig);

    // Sanity: max_accounts should be 1–10000 for any real slab
    if (maxAccounts < 1 || maxAccounts > 10_000) return null;

    // Bitmap words = ceil(maxAccounts / 64)
    const bitmapWords = Math.ceil(maxAccounts / 64);
    // Pre-accounts length = fixed engine fields + bitmap
    // V0: 168 bytes of engine state before bitmap
    // V1: 800 bytes of engine state before bitmap (approximate; includes all new fields)
    // The exact pre-accounts length varies, but we can compute it:
    // accountsOff = engineOff + align8(preAccountsBytes)
    // For a rough approach: total slab = engineOff + preAccounts + maxAccounts * acctSize
    // So: preAccounts = (data.length - engineOff - maxAccounts * acctSize)
    const accountsPayload = maxAccounts * acctSize;
    const preAccountsBytes = data.length - engineOff - accountsPayload;

    // Sanity: pre-accounts section should be positive and reasonable
    if (preAccountsBytes < 100 || preAccountsBytes > 20_000) return null;

    const accountsOff = engineOff + Math.ceil(preAccountsBytes / 8) * 8;

    // Verify: accountsOff + maxAccounts * acctSize should be close to data.length
    const expectedEnd = accountsOff + accountsPayload;
    if (Math.abs(expectedEnd - data.length) > acctSize) return null;

    return {
      version: version as 0 | 1,
      headerLen,
      configOff: headerLen,
      engineOff,
      acctSize,
      accountsOff,
      maxAccounts,
    };
  } catch {
    return null;
  }
}
