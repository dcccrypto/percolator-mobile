/**
 * useCollateral — deposit and withdraw collateral for a user position.
 *
 * Uses the same slab binary parsing as useTrade to build DepositCollateral
 * and WithdrawCollateral instructions.
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
// Instruction tag constants
// ---------------------------------------------------------------------------
const IX_INIT_USER = 1;
const IX_DEPOSIT_COLLATERAL = 3;
const IX_WITHDRAW_COLLATERAL = 4;

// SPL Token Program
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

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

function encU64LE(v: bigint): Uint8Array {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, v, true);
  return b;
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrays) {
    out.set(a, off);
    off += a.length;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Slab parsing (minimal — config section only)
// ---------------------------------------------------------------------------

function readPubkey(buf: Uint8Array, off: number): PublicKey {
  return new PublicKey(buf.slice(off, off + 32));
}

const HEADER_LEN = 72;
const CONFIG_OFF = HEADER_LEN;
const CFG_PROGRAM_ID_OFF = 0;
const CFG_ORACLE_AUTHORITY_OFF = 64;
const CFG_INDEX_FEED_ID_OFF = 96;
const CFG_VAULT_OFF = 128;
const CFG_COLLATERAL_MINT_OFF = 160;

const ACCOUNTS_SECTION_OFF = 720; // header(72) + config(320) + engine(328)
const ACCT_SIZE = 256;
const ACCT_KIND_OFF = 24;
const ACCT_OWNER_OFF = 184;

const PYTH_PUSH_ORACLE_PROGRAM_ID = new PublicKey(
  'pythWSnswVUd12oZpeFP8e9CVaEqJg25g1Vtc2biRsT',
);

interface SlabConfig {
  programId: PublicKey;
  vault: PublicKey;
  collateralMint: PublicKey;
  oracleAuthority: PublicKey;
  feedIdHex: string;
}

function parseSlabConfig(data: Uint8Array): SlabConfig {
  const base = CONFIG_OFF;
  return {
    programId: readPubkey(data, base + CFG_PROGRAM_ID_OFF),
    vault: readPubkey(data, base + CFG_VAULT_OFF),
    collateralMint: readPubkey(data, base + CFG_COLLATERAL_MINT_OFF),
    oracleAuthority: readPubkey(data, base + CFG_ORACLE_AUTHORITY_OFF),
    feedIdHex: Array.from(data.slice(base + CFG_INDEX_FEED_ID_OFF, base + CFG_INDEX_FEED_ID_OFF + 32))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(''),
  };
}

function deriveATA(owner: PublicKey, mint: PublicKey): PublicKey {
  const [ata] = PublicKey.findProgramAddressSync(
    [owner.toBytes(), TOKEN_PROGRAM_ID.toBytes(), mint.toBytes()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  return ata;
}

function deriveVaultAuthority(programId: PublicKey, slab: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [new TextEncoder().encode('vault'), slab.toBytes()],
    programId,
  );
  return pda;
}

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

function findUserIdx(data: Uint8Array, owner: PublicKey): number {
  let off = ACCOUNTS_SECTION_OFF;
  let idx = 0;
  while (off + ACCT_SIZE <= data.length) {
    const kind = data[off + ACCT_KIND_OFF];
    const acctOwner = readPubkey(data, off + ACCT_OWNER_OFF);
    if (kind === 0 && acctOwner.equals(owner)) return idx;
    off += ACCT_SIZE;
    idx++;
  }
  return -1;
}

// ---------------------------------------------------------------------------
// Instruction builders
// ---------------------------------------------------------------------------

function meta(pubkey: PublicKey, isSigner: boolean, isWritable: boolean): AccountMeta {
  return { pubkey, isSigner, isWritable };
}

function buildIx(
  programId: PublicKey,
  keys: AccountMeta[],
  data: Uint8Array,
): TransactionInstruction {
  return new TransactionInstruction({ programId, keys, data: Buffer.from(data) });
}

function buildInitUserIx(
  programId: PublicKey,
  user: PublicKey,
  slab: PublicKey,
  userAta: PublicKey,
  vault: PublicKey,
): TransactionInstruction {
  const data = concat(encU8(IX_INIT_USER), encU64LE(0n));
  return buildIx(programId, [
    meta(user, true, true),
    meta(slab, false, true),
    meta(userAta, false, true),
    meta(vault, false, true),
    meta(TOKEN_PROGRAM_ID, false, false),
  ], data);
}

function buildDepositIx(
  programId: PublicKey,
  user: PublicKey,
  slab: PublicKey,
  userAta: PublicKey,
  vault: PublicKey,
  userIdx: number,
  amount: bigint,
): TransactionInstruction {
  const data = concat(encU8(IX_DEPOSIT_COLLATERAL), encU16LE(userIdx), encU64LE(amount));
  return buildIx(programId, [
    meta(user, true, true),
    meta(slab, false, true),
    meta(userAta, false, true),
    meta(vault, false, true),
    meta(TOKEN_PROGRAM_ID, false, false),
    meta(SYSVAR_CLOCK_PUBKEY, false, false),
  ], data);
}

function buildWithdrawIx(
  programId: PublicKey,
  user: PublicKey,
  slab: PublicKey,
  vault: PublicKey,
  userAta: PublicKey,
  vaultPda: PublicKey,
  oracle: PublicKey,
  userIdx: number,
  amount: bigint,
): TransactionInstruction {
  const data = concat(encU8(IX_WITHDRAW_COLLATERAL), encU16LE(userIdx), encU64LE(amount));
  return buildIx(programId, [
    meta(user, true, true),
    meta(slab, false, true),
    meta(vault, false, true),
    meta(userAta, false, true),
    meta(vaultPda, false, false),
    meta(TOKEN_PROGRAM_ID, false, false),
    meta(SYSVAR_CLOCK_PUBKEY, false, false),
    meta(oracle, false, false),
  ], data);
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface CollateralParams {
  slabAddress: string;
  /** Amount in token units (e.g. 100.0 USDC). Will be converted to raw units using mint decimals (default 6). */
  amount: number;
  decimals?: number;
}

export interface CollateralResult {
  signature: string;
}

export interface UseCollateralResult {
  submitting: boolean;
  error: string | null;
  deposit: (params: CollateralParams) => Promise<CollateralResult | null>;
  withdraw: (params: CollateralParams) => Promise<CollateralResult | null>;
}

export function useCollateral(): UseCollateralResult {
  const { publicKey, signAndSend } = useMWA();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deposit = useCallback(
    async (params: CollateralParams): Promise<CollateralResult | null> => {
      if (!publicKey) {
        setError('Wallet not connected');
        return null;
      }
      setSubmitting(true);
      setError(null);

      try {
        const slabPk = new PublicKey(params.slabAddress);
        const slabInfo = await connection.getAccountInfo(slabPk);
        if (!slabInfo) throw new Error('Market not found on-chain');

        const data = new Uint8Array(slabInfo.data);
        const config = parseSlabConfig(data);

        const userAta = deriveATA(publicKey, config.collateralMint);

        // Check if user has an account on the slab
        let userIdx = findUserIdx(data, publicKey);
        const needsInit = userIdx < 0;

        if (needsInit) {
          // Count total accounts for new index
          let total = 0;
          let scanOff = ACCOUNTS_SECTION_OFF;
          while (scanOff + ACCT_SIZE <= data.length) {
            total++;
            scanOff += ACCT_SIZE;
          }
          userIdx = total;
        }

        const decimals = params.decimals ?? 6;
        const rawAmount = BigInt(Math.round(params.amount * 10 ** decimals));

        const { blockhash } = await connection.getLatestBlockhash('confirmed');
        const tx = new Transaction({ recentBlockhash: blockhash, feePayer: publicKey });

        tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: needsInit ? 400_000 : 200_000 }));
        tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 5000 }));

        if (needsInit) {
          tx.add(buildInitUserIx(config.programId, publicKey, slabPk, userAta, config.vault));
        }

        tx.add(buildDepositIx(config.programId, publicKey, slabPk, userAta, config.vault, userIdx, rawAmount));

        const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
        const results = await signAndSend([new Uint8Array(serialized)]);
        return { signature: results.signatures[0] };
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Deposit failed');
        return null;
      } finally {
        setSubmitting(false);
      }
    },
    [publicKey, signAndSend],
  );

  const withdraw = useCallback(
    async (params: CollateralParams): Promise<CollateralResult | null> => {
      if (!publicKey) {
        setError('Wallet not connected');
        return null;
      }
      setSubmitting(true);
      setError(null);

      try {
        const slabPk = new PublicKey(params.slabAddress);
        const slabInfo = await connection.getAccountInfo(slabPk);
        if (!slabInfo) throw new Error('Market not found on-chain');

        const data = new Uint8Array(slabInfo.data);
        const config = parseSlabConfig(data);

        const userIdx = findUserIdx(data, publicKey);
        if (userIdx < 0) throw new Error('No account found on this market — deposit first');

        const userAta = deriveATA(publicKey, config.collateralMint);
        const vaultPda = deriveVaultAuthority(config.programId, slabPk);

        // Determine oracle
        const isAdminOracle =
          !config.oracleAuthority.equals(PublicKey.default) || config.feedIdHex === '0'.repeat(64);
        const oracle = isAdminOracle ? slabPk : derivePythPushOraclePDA(config.feedIdHex);

        const decimals = params.decimals ?? 6;
        const rawAmount = BigInt(Math.round(params.amount * 10 ** decimals));

        const { blockhash } = await connection.getLatestBlockhash('confirmed');
        const tx = new Transaction({ recentBlockhash: blockhash, feePayer: publicKey });

        tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }));
        tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 5000 }));
        tx.add(buildWithdrawIx(
          config.programId,
          publicKey,
          slabPk,
          config.vault,
          userAta,
          vaultPda,
          oracle,
          userIdx,
          rawAmount,
        ));

        const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
        const results = await signAndSend([new Uint8Array(serialized)]);
        return { signature: results.signatures[0] };
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Withdraw failed');
        return null;
      } finally {
        setSubmitting(false);
      }
    },
    [publicKey, signAndSend],
  );

  return { submitting, error, deposit, withdraw };
}
