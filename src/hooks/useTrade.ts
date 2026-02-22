/**
 * useTrade — builds and submits open-position transactions for mobile.
 *
 * Inlines the minimal instruction-encoding and account-meta helpers from
 * @percolator/core so the mobile bundle stays self-contained.
 *
 * Flow:
 *   1. Read slab account → parse config (programId, vault, oracle, LP 0)
 *   2. Build KeeperCrank instruction (permissionless, callerIdx=65535)
 *   3. Build TradeCpi instruction (using LP 0)
 *   4. Serialize transaction → pass to MWA signAndSend
 */

import { useState, useCallback } from 'react';
import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  SYSVAR_CLOCK_PUBKEY,
  AccountMeta,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import { connection } from '../lib/solana';
import { useMWA } from './useMWA';

// ---------------------------------------------------------------------------
// Instruction tag constants (must match program/src/processor/mod.rs)
// ---------------------------------------------------------------------------
const IX_KEEPER_CRANK = 8;
const IX_TRADE_CPI = 10;

// ---------------------------------------------------------------------------
// Binary encoding helpers
// ---------------------------------------------------------------------------

function encU8(v: number): Uint8Array {
  return new Uint8Array([v & 0xff]);
}

function encU16LE(v: number): Uint8Array {
  const b = new Uint8Array(2);
  new DataView(b.buffer).setUint16(0, v, true);
  return b;
}

function encI128LE(v: bigint): Uint8Array {
  const b = new Uint8Array(16);
  const dv = new DataView(b.buffer);
  // Two's complement for negative numbers
  const unsigned = v < 0n ? v + (1n << 128n) : v;
  const lo = unsigned & BigInt('0xFFFFFFFFFFFFFFFF');
  const hi = (unsigned >> 64n) & BigInt('0xFFFFFFFFFFFFFFFF');
  dv.setBigUint64(0, lo, true);
  dv.setBigUint64(8, hi, true);
  return b;
}

function encBool(v: boolean): Uint8Array {
  return new Uint8Array([v ? 1 : 0]);
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrays) { out.set(a, off); off += a.length; }
  return out;
}

// ---------------------------------------------------------------------------
// Slab binary parsing (config section)
// ---------------------------------------------------------------------------

function readU64LE(buf: Uint8Array, off: number): bigint {
  return new DataView(buf.buffer, buf.byteOffset + off, 8).getBigUint64(0, true);
}

function readPubkey(buf: Uint8Array, off: number): PublicKey {
  return new PublicKey(buf.slice(off, off + 32));
}

const HEADER_LEN = 72;
const CONFIG_OFF = HEADER_LEN; // config starts after header

// Config layout offsets (relative to CONFIG_OFF)
const CFG_PROGRAM_ID_OFF = 0;        // Pubkey (32)
const CFG_ADMIN_OFF = 32;            // Pubkey (32)
const CFG_ORACLE_AUTHORITY_OFF = 64; // Pubkey (32)
const CFG_INDEX_FEED_ID_OFF = 96;    // [u8;32] feed id
const CFG_VAULT_OFF = 128;           // Pubkey (32)
const CFG_COLLATERAL_MINT_OFF = 160; // Pubkey (32)
// CFG total = 320

const ACCT_SIZE = 256;
const ACCT_MATCHER_PROGRAM_OFF = 120;
const ACCT_MATCHER_CONTEXT_OFF = 152;
const ACCT_OWNER_OFF = 184;
const ACCT_KIND_OFF = 24; // 0=User, 1=LP

// Engine section starts at 392 (header=72 + config=320)
const ENGINE_OFF = 392;

// Accounts section starts at ENGINE_OFF + 328 (engine size)
const ACCOUNTS_SECTION_OFF = ENGINE_OFF + 328;

interface SlabConfig {
  programId: PublicKey;
  vault: PublicKey;
  collateralMint: PublicKey;
  oracleAuthority: PublicKey;
  feedIdHex: string;
}

interface LPAccount {
  idx: number;
  owner: PublicKey;
  matcherProgram: PublicKey;
  matcherContext: PublicKey;
}

function parseSlabConfig(data: Uint8Array): SlabConfig {
  const base = CONFIG_OFF;
  const programId = readPubkey(data, base + CFG_PROGRAM_ID_OFF);
  const vault = readPubkey(data, base + CFG_VAULT_OFF);
  const collateralMint = readPubkey(data, base + CFG_COLLATERAL_MINT_OFF);
  const oracleAuthority = readPubkey(data, base + CFG_ORACLE_AUTHORITY_OFF);
  const feedIdBytes = data.slice(base + CFG_INDEX_FEED_ID_OFF, base + CFG_INDEX_FEED_ID_OFF + 32);
  const feedIdHex = Array.from(feedIdBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return { programId, vault, collateralMint, oracleAuthority, feedIdHex };
}

function findFirstLP(data: Uint8Array): LPAccount | null {
  let off = ACCOUNTS_SECTION_OFF;
  let idx = 0;
  while (off + ACCT_SIZE <= data.length) {
    const kind = data[off + ACCT_KIND_OFF];
    if (kind === 1) {
      // LP account
      const owner = readPubkey(data, off + ACCT_OWNER_OFF);
      const matcherProgram = readPubkey(data, off + ACCT_MATCHER_PROGRAM_OFF);
      const matcherContext = readPubkey(data, off + ACCT_MATCHER_CONTEXT_OFF);
      return { idx, owner, matcherProgram, matcherContext };
    }
    off += ACCT_SIZE;
    idx++;
  }
  return null;
}

// ---------------------------------------------------------------------------
// LP PDA derivation (mirrors packages/core/src/solana/pda.ts)
// ---------------------------------------------------------------------------

function deriveLpPda(programId: PublicKey, slab: PublicKey, lpIdx: number): PublicKey {
  const idxBuf = new Uint8Array(2);
  new DataView(idxBuf.buffer).setUint16(0, lpIdx, true);
  const [pda] = PublicKey.findProgramAddressSync(
    [new TextEncoder().encode('lp'), slab.toBytes(), idxBuf],
    programId,
  );
  return pda;
}

// ---------------------------------------------------------------------------
// Oracle account derivation
// ---------------------------------------------------------------------------

const PYTH_PUSH_ORACLE_PROGRAM_ID = new PublicKey(
  'pythWSnswVUd12oZpeFP8e9CVaEqJg25g1Vtc2biRsT',
);

function derivePythPushOraclePDA(feedIdHex: string): PublicKey {
  const feedId = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    feedId[i] = parseInt(feedIdHex.substring(i * 2, i * 2 + 2), 16);
  }
  const shardBuf = new Uint8Array(2);
  const [pda] = PublicKey.findProgramAddressSync(
    [shardBuf, feedId],
    PYTH_PUSH_ORACLE_PROGRAM_ID,
  );
  return pda;
}

// ---------------------------------------------------------------------------
// Instruction builders
// ---------------------------------------------------------------------------

function buildIx(
  programId: PublicKey,
  keys: AccountMeta[],
  data: Uint8Array,
): TransactionInstruction {
  return new TransactionInstruction({ programId, keys, data: Buffer.from(data) });
}

function meta(pubkey: PublicKey, isSigner: boolean, isWritable: boolean): AccountMeta {
  return { pubkey, isSigner, isWritable };
}

function buildKeeperCrankIx(
  programId: PublicKey,
  caller: PublicKey,
  slab: PublicKey,
  oracle: PublicKey,
): TransactionInstruction {
  const data = concat(
    encU8(IX_KEEPER_CRANK),
    encU16LE(65535), // callerIdx = permissionless
    encBool(false),  // allowPanic = false
  );
  return buildIx(programId, [
    meta(caller, true, true),
    meta(slab, false, true),
    meta(SYSVAR_CLOCK_PUBKEY, false, false),
    meta(oracle, false, false),
  ], data);
}

function buildTradeCpiIx(
  programId: PublicKey,
  user: PublicKey,
  lpOwner: PublicKey,
  slab: PublicKey,
  oracle: PublicKey,
  matcherProg: PublicKey,
  matcherCtx: PublicKey,
  lpPda: PublicKey,
  lpIdx: number,
  userIdx: number,
  sizeE6: bigint,
): TransactionInstruction {
  const data = concat(
    encU8(IX_TRADE_CPI),
    encU16LE(lpIdx),
    encU16LE(userIdx),
    encI128LE(sizeE6),
  );
  return buildIx(programId, [
    meta(user, true, true),
    meta(lpOwner, false, false),
    meta(slab, false, true),
    meta(SYSVAR_CLOCK_PUBKEY, false, false),
    meta(oracle, false, false),
    meta(matcherProg, false, false),
    meta(matcherCtx, false, true),
    meta(lpPda, false, false),
  ], data);
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface TradeParams {
  slabAddress: string;
  userIdx: number;
  /** Position size in USD (will be converted to e6). Negative = short. */
  sizeUsd: number;
  direction: 'long' | 'short';
}

export interface TradeResult {
  signature: string;
}

export interface UseTradeResult {
  submitting: boolean;
  error: string | null;
  submitTrade: (params: TradeParams) => Promise<TradeResult | null>;
}

export function useTrade(): UseTradeResult {
  const { publicKey, signAndSend } = useMWA();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitTrade = useCallback(
    async (params: TradeParams): Promise<TradeResult | null> => {
      if (!publicKey) {
        setError('Wallet not connected');
        return null;
      }

      setSubmitting(true);
      setError(null);

      try {
        const slabPk = new PublicKey(params.slabAddress);

        // 1. Fetch slab account data
        const slabInfo = await connection.getAccountInfo(slabPk);
        if (!slabInfo) throw new Error('Market not found on-chain');

        const data = new Uint8Array(slabInfo.data);
        const config = parseSlabConfig(data);
        const lp = findFirstLP(data);
        if (!lp) throw new Error('No LP account found — market has no liquidity');

        // 2. Determine oracle account
        const isAdminOracle =
          !config.oracleAuthority.equals(PublicKey.default) ||
          config.feedIdHex === '0'.repeat(64);
        const oracle = isAdminOracle
          ? slabPk
          : derivePythPushOraclePDA(config.feedIdHex);

        // 3. Derive LP PDA
        const lpPda = deriveLpPda(config.programId, slabPk, lp.idx);

        // 4. Find user account index (scan for owner)
        // If userIdx is provided, use it. Otherwise scan.
        let userIdx = params.userIdx;

        // 5. Convert size to e6 (signed: positive = long, negative = short)
        const absE6 = BigInt(Math.round(Math.abs(params.sizeUsd) * 1_000_000));
        const sizeE6 = params.direction === 'long' ? absE6 : -absE6;

        // 6. Build instructions
        const crankIx = buildKeeperCrankIx(
          config.programId,
          publicKey,
          slabPk,
          oracle,
        );
        const tradeIx = buildTradeCpiIx(
          config.programId,
          publicKey,
          lp.owner,
          slabPk,
          oracle,
          lp.matcherProgram,
          lp.matcherContext,
          lpPda,
          lp.idx,
          userIdx,
          sizeE6,
        );

        // 7. Build transaction
        const { blockhash } = await connection.getLatestBlockhash('confirmed');
        const tx = new Transaction({
          recentBlockhash: blockhash,
          feePayer: publicKey,
        });

        // Add compute budget (trade is ~400k CU with crank)
        tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 600_000 }));
        tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 5000 }));
        tx.add(crankIx);
        tx.add(tradeIx);

        // 8. Serialize and send via MWA
        const serialized = tx.serialize({
          requireAllSignatures: false,
          verifySignatures: false,
        });

        const results = await signAndSend([new Uint8Array(serialized)]);

        return { signature: results[0] };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Transaction failed';
        setError(msg);
        return null;
      } finally {
        setSubmitting(false);
      }
    },
    [publicKey, signAndSend],
  );

  return { submitting, error, submitTrade };
}
