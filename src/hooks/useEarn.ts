/**
 * useEarn — insurance vault deposit (LP mint) and withdraw (LP burn).
 *
 * Instruction tags:
 *   25 = DepositInsuranceLP  (9 bytes: [tag u8, amount u64 LE])
 *   26 = WithdrawInsuranceLP (9 bytes: [tag u8, lpAmount u64 LE])
 *
 * Accounts (both instructions, same order):
 *   0: user (signer)
 *   1: slab
 *   2: userCollateralAta (writable)
 *   3: vault (writable)
 *   4: tokenProgram
 *   5: insLpMint (writable) — PDA ["ins_lp", slab]
 *   6: userLpAta (writable)
 *   7: vaultAuthority — PDA ["vault", slab]
 */

import { useState, useCallback } from 'react';
import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  AccountMeta,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import { connection } from '../lib/solana';
import { useMWA } from './useMWA';

const IX_DEPOSIT_INSURANCE_LP = 25;
const IX_WITHDRAW_INSURANCE_LP = 26;

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

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrays) { out.set(a, off); off += a.length; }
  return out;
}

function readPubkey(buf: Uint8Array, off: number): PublicKey {
  return new PublicKey(buf.slice(off, off + 32));
}

// Slab config offsets
const HEADER_LEN = 72;
const CONFIG_OFF = HEADER_LEN;
const CFG_PROGRAM_ID_OFF = 0;
const CFG_VAULT_OFF = 128;
const CFG_COLLATERAL_MINT_OFF = 160;

function meta(pubkey: PublicKey, isSigner: boolean, isWritable: boolean): AccountMeta {
  return { pubkey, isSigner, isWritable };
}

function deriveATA(owner: PublicKey, mint: PublicKey): PublicKey {
  const [ata] = PublicKey.findProgramAddressSync(
    [owner.toBytes(), TOKEN_PROGRAM_ID.toBytes(), mint.toBytes()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  return ata;
}

function deriveInsLpMint(programId: PublicKey, slab: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [new TextEncoder().encode('ins_lp'), slab.toBytes()],
    programId,
  );
  return pda;
}

function deriveVaultAuthority(programId: PublicKey, slab: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [new TextEncoder().encode('vault'), slab.toBytes()],
    programId,
  );
  return pda;
}

/** Create ATA instruction (if it doesn't exist yet). */
function createATAInstruction(
  payer: PublicKey,
  ata: PublicKey,
  owner: PublicKey,
  mint: PublicKey,
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

// ── Hook ──

export interface EarnParams {
  slabAddress: string;
  amount: number;
  decimals?: number;
}

export function useEarn() {
  const { publicKey, signAndSend } = useMWA();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deposit = useCallback(
    async (params: EarnParams): Promise<string | null> => {
      if (!publicKey) { setError('Wallet not connected'); return null; }
      setSubmitting(true);
      setError(null);

      try {
        const slabPk = new PublicKey(params.slabAddress);
        const slabInfo = await connection.getAccountInfo(slabPk);
        if (!slabInfo) throw new Error('Market not found on-chain');

        const data = new Uint8Array(slabInfo.data);
        const programId = readPubkey(data, CONFIG_OFF + CFG_PROGRAM_ID_OFF);
        const vault = readPubkey(data, CONFIG_OFF + CFG_VAULT_OFF);
        const collateralMint = readPubkey(data, CONFIG_OFF + CFG_COLLATERAL_MINT_OFF);

        const insLpMint = deriveInsLpMint(programId, slabPk);
        const vaultAuth = deriveVaultAuthority(programId, slabPk);
        const userAta = deriveATA(publicKey, collateralMint);
        const userLpAta = deriveATA(publicKey, insLpMint);

        const decimals = params.decimals ?? 6;
        const rawAmount = BigInt(Math.round(params.amount * 10 ** decimals));
        const ixData = concat(encU8(IX_DEPOSIT_INSURANCE_LP), encU64LE(rawAmount));

        const { blockhash } = await connection.getLatestBlockhash('confirmed');
        const tx = new Transaction({ recentBlockhash: blockhash, feePayer: publicKey });

        tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }));
        tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 5000 }));

        // Create ATAs if needed
        const [userAtaInfo, userLpAtaInfo] = await Promise.all([
          connection.getAccountInfo(userAta),
          connection.getAccountInfo(userLpAta),
        ]);
        if (!userAtaInfo) tx.add(createATAInstruction(publicKey, userAta, publicKey, collateralMint));
        if (!userLpAtaInfo) tx.add(createATAInstruction(publicKey, userLpAta, publicKey, insLpMint));

        tx.add(new TransactionInstruction({
          programId,
          keys: [
            meta(publicKey, true, false),
            meta(slabPk, false, false),
            meta(userAta, false, true),
            meta(vault, false, true),
            meta(TOKEN_PROGRAM_ID, false, false),
            meta(insLpMint, false, true),
            meta(userLpAta, false, true),
            meta(vaultAuth, false, false),
          ],
          data: Buffer.from(ixData),
        }));

        const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
        const results = await signAndSend([new Uint8Array(serialized)]);
        return results.signatures[0] ?? null;
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
    async (params: EarnParams): Promise<string | null> => {
      if (!publicKey) { setError('Wallet not connected'); return null; }
      setSubmitting(true);
      setError(null);

      try {
        const slabPk = new PublicKey(params.slabAddress);
        const slabInfo = await connection.getAccountInfo(slabPk);
        if (!slabInfo) throw new Error('Market not found on-chain');

        const data = new Uint8Array(slabInfo.data);
        const programId = readPubkey(data, CONFIG_OFF + CFG_PROGRAM_ID_OFF);
        const vault = readPubkey(data, CONFIG_OFF + CFG_VAULT_OFF);
        const collateralMint = readPubkey(data, CONFIG_OFF + CFG_COLLATERAL_MINT_OFF);

        const insLpMint = deriveInsLpMint(programId, slabPk);
        const vaultAuth = deriveVaultAuthority(programId, slabPk);
        const userAta = deriveATA(publicKey, collateralMint);
        const userLpAta = deriveATA(publicKey, insLpMint);

        const decimals = params.decimals ?? 6;
        const rawAmount = BigInt(Math.round(params.amount * 10 ** decimals));
        const ixData = concat(encU8(IX_WITHDRAW_INSURANCE_LP), encU64LE(rawAmount));

        const { blockhash } = await connection.getLatestBlockhash('confirmed');
        const tx = new Transaction({ recentBlockhash: blockhash, feePayer: publicKey });

        tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }));
        tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 5000 }));

        tx.add(new TransactionInstruction({
          programId,
          keys: [
            meta(publicKey, true, false),
            meta(slabPk, false, false),
            meta(userAta, false, true),
            meta(vault, false, true),
            meta(TOKEN_PROGRAM_ID, false, false),
            meta(insLpMint, false, true),
            meta(userLpAta, false, true),
            meta(vaultAuth, false, false),
          ],
          data: Buffer.from(ixData),
        }));

        const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
        const results = await signAndSend([new Uint8Array(serialized)]);
        return results.signatures[0] ?? null;
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
