/**
 * useStake — LP token staking deposit & withdraw via percolator-stake program.
 *
 * Program ID (devnet): 6aJb1F9CDCVWCNYFwj8aQsVb696YnW6J1FznteHq4Q6k
 *
 * Instruction tags:
 *   1 = Deposit  (9 bytes: [tag u8, amount u64 LE])
 *   2 = Withdraw (9 bytes: [tag u8, lpAmount u64 LE])
 *
 * Deposit accounts (11):
 *   0: user (signer)
 *   1: pool (writable) — PDA ["stake_pool", slab]
 *   2: userCollateralAta (writable)
 *   3: vault (writable)
 *   4: lpMint (writable)
 *   5: userLpAta (writable)
 *   6: vaultAuth — PDA ["vault_auth", pool]
 *   7: depositPda (writable) — PDA ["stake_deposit", pool, user]
 *   8: TOKEN_PROGRAM
 *   9: CLOCK_SYSVAR
 *  10: SYSTEM_PROGRAM
 *
 * Withdraw accounts (10):
 *   0: user (signer)
 *   1: pool (writable)
 *   2: userLpAta (writable)
 *   3: lpMint (writable)
 *   4: vault (writable)
 *   5: userCollateralAta (writable)
 *   6: vaultAuth
 *   7: depositPda (writable)
 *   8: TOKEN_PROGRAM
 *   9: CLOCK_SYSVAR
 */

import { useState, useCallback } from 'react';
import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  AccountMeta,
  ComputeBudgetProgram,
  SYSVAR_CLOCK_PUBKEY,
} from '@solana/web3.js';
import { connection } from '../lib/solana';
import { useMWA } from './useMWA';

const STAKE_PROGRAM_ID = new PublicKey(
  process.env.EXPO_PUBLIC_STAKE_PROGRAM_ID ?? '6aJb1F9CDCVWCNYFwj8aQsVb696YnW6J1FznteHq4Q6k',
);

const IX_STAKE_DEPOSIT = 1;
const IX_STAKE_WITHDRAW = 2;

const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
const SYSTEM_PROGRAM_ID = new PublicKey('11111111111111111111111111111111');

// ── Binary helpers ──

function encU8(v: number): Uint8Array { return new Uint8Array([v & 0xff]); }

function encU64LE(v: bigint): Uint8Array {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, v, true);
  return b;
}

function concat(...a: Uint8Array[]): Uint8Array {
  const t = a.reduce((s, x) => s + x.length, 0);
  const o = new Uint8Array(t);
  let off = 0;
  for (const x of a) { o.set(x, off); off += x.length; }
  return o;
}

function meta(pubkey: PublicKey, isSigner: boolean, isWritable: boolean): AccountMeta {
  return { pubkey, isSigner, isWritable };
}

// ── PDA derivation ──

function deriveStakePool(slab: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [new TextEncoder().encode('stake_pool'), slab.toBytes()],
    STAKE_PROGRAM_ID,
  );
  return pda;
}

function deriveVaultAuth(pool: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [new TextEncoder().encode('vault_auth'), pool.toBytes()],
    STAKE_PROGRAM_ID,
  );
  return pda;
}

function deriveDepositPda(pool: PublicKey, user: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [new TextEncoder().encode('stake_deposit'), pool.toBytes(), user.toBytes()],
    STAKE_PROGRAM_ID,
  );
  return pda;
}

function deriveATA(owner: PublicKey, mint: PublicKey): PublicKey {
  const [ata] = PublicKey.findProgramAddressSync(
    [owner.toBytes(), TOKEN_PROGRAM_ID.toBytes(), mint.toBytes()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  return ata;
}

function createATAInstruction(
  payer: PublicKey, ata: PublicKey, owner: PublicKey, mint: PublicKey,
): TransactionInstruction {
  return new TransactionInstruction({
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    keys: [
      meta(payer, true, true),
      meta(ata, false, true),
      meta(owner, false, false),
      meta(mint, false, false),
      meta(SYSTEM_PROGRAM_ID, false, false),
      meta(TOKEN_PROGRAM_ID, false, false),
    ],
    data: Buffer.alloc(0),
  });
}

// StakePool state layout offsets (352 bytes)
const POOL_COLLATERAL_MINT_OFF = 72;
const POOL_LP_MINT_OFF = 104;
const POOL_VAULT_OFF = 136;

function readPubkey(buf: Uint8Array, off: number): PublicKey {
  return new PublicKey(buf.slice(off, off + 32));
}

// ── Hook ──

export interface StakeParams {
  /** Slab address of the market this pool covers */
  slabAddress: string;
  amount: number;
  decimals?: number;
}

export function useStake() {
  const { publicKey, signAndSend } = useMWA();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deposit = useCallback(
    async (params: StakeParams): Promise<string | null> => {
      if (!publicKey) { setError('Wallet not connected'); return null; }
      setSubmitting(true);
      setError(null);

      try {
        const slabPk = new PublicKey(params.slabAddress);
        const poolPk = deriveStakePool(slabPk);

        // Fetch pool account to read mints and vault
        const poolInfo = await connection.getAccountInfo(poolPk);
        if (!poolInfo) throw new Error('Stake pool not found on-chain');

        const poolData = new Uint8Array(poolInfo.data);
        const collateralMint = readPubkey(poolData, POOL_COLLATERAL_MINT_OFF);
        const lpMint = readPubkey(poolData, POOL_LP_MINT_OFF);
        const vault = readPubkey(poolData, POOL_VAULT_OFF);

        const vaultAuth = deriveVaultAuth(poolPk);
        const depositPda = deriveDepositPda(poolPk, publicKey);
        const userCollateralAta = deriveATA(publicKey, collateralMint);
        const userLpAta = deriveATA(publicKey, lpMint);

        const decimals = params.decimals ?? 6;
        const rawAmount = BigInt(Math.round(params.amount * 10 ** decimals));
        const ixData = concat(encU8(IX_STAKE_DEPOSIT), encU64LE(rawAmount));

        const { blockhash } = await connection.getLatestBlockhash('confirmed');
        const tx = new Transaction({ recentBlockhash: blockhash, feePayer: publicKey });

        tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }));
        tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 5000 }));

        // Create ATAs if needed
        const [colAtaInfo, lpAtaInfo] = await Promise.all([
          connection.getAccountInfo(userCollateralAta),
          connection.getAccountInfo(userLpAta),
        ]);
        if (!colAtaInfo) tx.add(createATAInstruction(publicKey, userCollateralAta, publicKey, collateralMint));
        if (!lpAtaInfo) tx.add(createATAInstruction(publicKey, userLpAta, publicKey, lpMint));

        tx.add(new TransactionInstruction({
          programId: STAKE_PROGRAM_ID,
          keys: [
            meta(publicKey, true, false),
            meta(poolPk, false, true),
            meta(userCollateralAta, false, true),
            meta(vault, false, true),
            meta(lpMint, false, true),
            meta(userLpAta, false, true),
            meta(vaultAuth, false, false),
            meta(depositPda, false, true),
            meta(TOKEN_PROGRAM_ID, false, false),
            meta(SYSVAR_CLOCK_PUBKEY, false, false),
            meta(SYSTEM_PROGRAM_ID, false, false),
          ],
          data: Buffer.from(ixData),
        }));

        const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
        const results = await signAndSend([new Uint8Array(serialized)]);
        return results.signatures[0] ?? null;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Stake failed');
        return null;
      } finally {
        setSubmitting(false);
      }
    },
    [publicKey, signAndSend],
  );

  const withdraw = useCallback(
    async (params: StakeParams): Promise<string | null> => {
      if (!publicKey) { setError('Wallet not connected'); return null; }
      setSubmitting(true);
      setError(null);

      try {
        const slabPk = new PublicKey(params.slabAddress);
        const poolPk = deriveStakePool(slabPk);

        const poolInfo = await connection.getAccountInfo(poolPk);
        if (!poolInfo) throw new Error('Stake pool not found on-chain');

        const poolData = new Uint8Array(poolInfo.data);
        const collateralMint = readPubkey(poolData, POOL_COLLATERAL_MINT_OFF);
        const lpMint = readPubkey(poolData, POOL_LP_MINT_OFF);
        const vault = readPubkey(poolData, POOL_VAULT_OFF);

        const vaultAuth = deriveVaultAuth(poolPk);
        const depositPda = deriveDepositPda(poolPk, publicKey);
        const userCollateralAta = deriveATA(publicKey, collateralMint);
        const userLpAta = deriveATA(publicKey, lpMint);

        const decimals = params.decimals ?? 6;
        const rawAmount = BigInt(Math.round(params.amount * 10 ** decimals));
        const ixData = concat(encU8(IX_STAKE_WITHDRAW), encU64LE(rawAmount));

        const { blockhash } = await connection.getLatestBlockhash('confirmed');
        const tx = new Transaction({ recentBlockhash: blockhash, feePayer: publicKey });

        tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }));
        tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 5000 }));

        tx.add(new TransactionInstruction({
          programId: STAKE_PROGRAM_ID,
          keys: [
            meta(publicKey, true, false),
            meta(poolPk, false, true),
            meta(userLpAta, false, true),
            meta(lpMint, false, true),
            meta(vault, false, true),
            meta(userCollateralAta, false, true),
            meta(vaultAuth, false, false),
            meta(depositPda, false, true),
            meta(TOKEN_PROGRAM_ID, false, false),
            meta(SYSVAR_CLOCK_PUBKEY, false, false),
          ],
          data: Buffer.from(ixData),
        }));

        const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
        const results = await signAndSend([new Uint8Array(serialized)]);
        return results.signatures[0] ?? null;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unstake failed');
        return null;
      } finally {
        setSubmitting(false);
      }
    },
    [publicKey, signAndSend],
  );

  return { submitting, error, deposit, withdraw };
}
