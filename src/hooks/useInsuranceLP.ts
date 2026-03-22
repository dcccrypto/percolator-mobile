/**
 * useInsuranceLP — on-chain insurance LP deposit / withdraw for mobile.
 *
 * Mirrors app/hooks/useInsuranceLP.ts from percolator-launch but uses
 * MWA signAndSend (mobile) instead of web3.js wallet adapter.
 *
 * Instructions:
 *   DepositInsuranceLP (tag 25): deposit collateral → receive LP tokens
 *   WithdrawInsuranceLP (tag 26): burn LP tokens → receive collateral
 *
 * Account layout (matches on-chain processor):
 *   DEPOSIT:  [depositor(s,w), slab(w), depositor_ata(w), vault(w),
 *              token_program, ins_lp_mint(w), depositor_lp_ata(w), vault_authority]
 *   WITHDRAW: [withdrawer(s,w), slab(w), withdrawer_ata(w), vault(w),
 *              token_program, ins_lp_mint(w), withdrawer_lp_ata(w), vault_authority]
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
import {
  detectSlabLayout,
  CFG_PROGRAM_ID_OFF,
  CFG_VAULT_OFF,
  CFG_COLLATERAL_MINT_OFF,
  type SlabLayout,
} from '../lib/slabLayout';

// ── Instruction tags ────────────────────────────────────────────────────────
const IX_DEPOSIT_INSURANCE_LP = 25;
const IX_WITHDRAW_INSURANCE_LP = 26;

// ── SPL constants ───────────────────────────────────────────────────────────
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
const SYSTEM_PROGRAM_ID = new PublicKey('11111111111111111111111111111111');

// ── Encoding helpers ─────────────────────────────────────────────────────────
function encU8(v: number): Uint8Array {
  return new Uint8Array([v & 0xff]);
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

// ── Account meta helpers ─────────────────────────────────────────────────────
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

// ── PDA derivation ────────────────────────────────────────────────────────────

/** Seeds: ["vault", slab_key] */
function deriveVaultAuthority(programId: PublicKey, slab: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [new TextEncoder().encode('vault'), slab.toBytes()],
    programId,
  );
  return pda;
}

/** Seeds: ["ins_lp", slab_key] — insurance LP mint PDA */
function deriveInsuranceLpMint(programId: PublicKey, slab: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [new TextEncoder().encode('ins_lp'), slab.toBytes()],
    programId,
  );
  return pda;
}

/** Derive associated token account address for a given owner + mint. */
function deriveATA(owner: PublicKey, mint: PublicKey): PublicKey {
  const [ata] = PublicKey.findProgramAddressSync(
    [owner.toBytes(), TOKEN_PROGRAM_ID.toBytes(), mint.toBytes()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  return ata;
}

/**
 * Build a create-ATA instruction (idempotent — safe to send even if ATA exists
 * when using the standard create_associated_token_account_idempotent variant).
 * We use the standard instruction and preflight-check before adding.
 */
function buildCreateATAIx(
  payer: PublicKey,
  ataAddress: PublicKey,
  owner: PublicKey,
  mint: PublicKey,
): TransactionInstruction {
  return new TransactionInstruction({
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    keys: [
      meta(payer, true, true),           // funding_account (payer)
      meta(ataAddress, false, true),     // associated_token_account (writable, new)
      meta(owner, false, false),         // wallet_address
      meta(mint, false, false),          // spl_token_mint
      meta(SYSTEM_PROGRAM_ID, false, false), // system_program
      meta(TOKEN_PROGRAM_ID, false, false),  // token_program
    ],
    data: Buffer.from([0x01]), // create idempotent variant (instruction index 1)
  });
}

// ── Slab config parsing ───────────────────────────────────────────────────────

function readPubkey(buf: Uint8Array, off: number): PublicKey {
  return new PublicKey(buf.slice(off, off + 32));
}

interface SlabConfig {
  programId: PublicKey;
  vault: PublicKey;
  collateralMint: PublicKey;
}

function parseSlabConfig(data: Uint8Array, layout: SlabLayout): SlabConfig {
  const base = layout.configOff;
  return {
    programId: readPubkey(data, base + CFG_PROGRAM_ID_OFF),
    vault: readPubkey(data, base + CFG_VAULT_OFF),
    collateralMint: readPubkey(data, base + CFG_COLLATERAL_MINT_OFF),
  };
}

// ── Instruction builders ──────────────────────────────────────────────────────

function buildDepositInsuranceLPIx(
  programId: PublicKey,
  depositor: PublicKey,
  slab: PublicKey,
  depositorAta: PublicKey,
  vault: PublicKey,
  lpMint: PublicKey,
  depositorLpAta: PublicKey,
  vaultAuthority: PublicKey,
  amount: bigint,
): TransactionInstruction {
  const data = concat(encU8(IX_DEPOSIT_INSURANCE_LP), encU64LE(amount));
  return buildIx(programId, [
    meta(depositor, true, true),      // depositor (signer, writable)
    meta(slab, false, true),          // slab (writable)
    meta(depositorAta, false, true),  // depositor_ata (writable)
    meta(vault, false, true),         // vault (writable)
    meta(TOKEN_PROGRAM_ID, false, false), // token_program
    meta(lpMint, false, true),        // ins_lp_mint (writable)
    meta(depositorLpAta, false, true),// depositor_lp_ata (writable)
    meta(vaultAuthority, false, false), // vault_authority
  ], data);
}

function buildWithdrawInsuranceLPIx(
  programId: PublicKey,
  withdrawer: PublicKey,
  slab: PublicKey,
  withdrawerAta: PublicKey,
  vault: PublicKey,
  lpMint: PublicKey,
  withdrawerLpAta: PublicKey,
  vaultAuthority: PublicKey,
  lpAmount: bigint,
): TransactionInstruction {
  const data = concat(encU8(IX_WITHDRAW_INSURANCE_LP), encU64LE(lpAmount));
  return buildIx(programId, [
    meta(withdrawer, true, true),       // withdrawer (signer, writable)
    meta(slab, false, true),            // slab (writable)
    meta(withdrawerAta, false, true),   // withdrawer_ata (writable)
    meta(vault, false, true),           // vault (writable)
    meta(TOKEN_PROGRAM_ID, false, false), // token_program
    meta(lpMint, false, true),          // ins_lp_mint (writable)
    meta(withdrawerLpAta, false, true), // withdrawer_lp_ata (writable)
    meta(vaultAuthority, false, false), // vault_authority
  ], data);
}

// ── Hook types ────────────────────────────────────────────────────────────────

export interface InsuranceLPDepositParams {
  /** Slab (market) address */
  slabAddress: string;
  /** Amount in collateral token base units (e.g. USDC lamports: 1 USDC = 1_000_000) */
  amountBaseUnits: bigint;
}

export interface InsuranceLPWithdrawParams {
  /** Slab (market) address */
  slabAddress: string;
  /** LP token amount to burn (base units) */
  lpAmountBaseUnits: bigint;
}

export interface InsuranceLPResult {
  signature: string;
}

export interface UseInsuranceLPResult {
  submitting: boolean;
  error: string | null;
  depositInsuranceLP: (params: InsuranceLPDepositParams) => Promise<InsuranceLPResult | null>;
  withdrawInsuranceLP: (params: InsuranceLPWithdrawParams) => Promise<InsuranceLPResult | null>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useInsuranceLP(): UseInsuranceLPResult {
  const { publicKey, signAndSend } = useMWA();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const depositInsuranceLP = useCallback(
    async (params: InsuranceLPDepositParams): Promise<InsuranceLPResult | null> => {
      if (!publicKey) {
        setError('Wallet not connected');
        return null;
      }

      setSubmitting(true);
      setError(null);

      try {
        const slabPk = new PublicKey(params.slabAddress);

        // 1. Fetch + parse slab to get program ID, vault, collateral mint
        const slabInfo = await connection.getAccountInfo(slabPk);
        if (!slabInfo) throw new Error('Market not found on-chain');

        const rawData = new Uint8Array(slabInfo.data);
        const layout = detectSlabLayout(rawData);
        if (!layout) throw new Error('Unrecognised slab layout');
        const config = parseSlabConfig(rawData, layout);

        // 2. Derive PDAs
        const lpMint = deriveInsuranceLpMint(config.programId, slabPk);
        const vaultAuth = deriveVaultAuthority(config.programId, slabPk);
        const userCollateralAta = deriveATA(publicKey, config.collateralMint);
        const userLpAta = deriveATA(publicKey, lpMint);

        // 3. Build tx — prepend ATA create-idempotent instructions for both ATAs
        const { blockhash } = await connection.getLatestBlockhash('confirmed');
        const tx = new Transaction({ recentBlockhash: blockhash, feePayer: publicKey });

        tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }));
        tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 5000 }));

        // Create collateral ATA if missing
        const collateralAtaInfo = await connection.getAccountInfo(userCollateralAta);
        if (!collateralAtaInfo) {
          tx.add(buildCreateATAIx(publicKey, userCollateralAta, publicKey, config.collateralMint));
        }

        // Create LP ATA if missing
        const lpAtaInfo = await connection.getAccountInfo(userLpAta);
        if (!lpAtaInfo) {
          tx.add(buildCreateATAIx(publicKey, userLpAta, publicKey, lpMint));
        }

        // Build deposit instruction
        tx.add(buildDepositInsuranceLPIx(
          config.programId,
          publicKey,
          slabPk,
          userCollateralAta,
          config.vault,
          lpMint,
          userLpAta,
          vaultAuth,
          params.amountBaseUnits,
        ));

        // 4. Sign + send via MWA
        const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
        const results = await signAndSend([new Uint8Array(serialized)]);
        return { signature: results.signatures[0] };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Deposit failed';
        setError(msg);
        return null;
      } finally {
        setSubmitting(false);
      }
    },
    [publicKey, signAndSend],
  );

  const withdrawInsuranceLP = useCallback(
    async (params: InsuranceLPWithdrawParams): Promise<InsuranceLPResult | null> => {
      if (!publicKey) {
        setError('Wallet not connected');
        return null;
      }

      setSubmitting(true);
      setError(null);

      try {
        const slabPk = new PublicKey(params.slabAddress);

        // 1. Fetch + parse slab
        const slabInfo = await connection.getAccountInfo(slabPk);
        if (!slabInfo) throw new Error('Market not found on-chain');

        const rawData = new Uint8Array(slabInfo.data);
        const layout = detectSlabLayout(rawData);
        if (!layout) throw new Error('Unrecognised slab layout');
        const config = parseSlabConfig(rawData, layout);

        // 2. Derive PDAs
        const lpMint = deriveInsuranceLpMint(config.programId, slabPk);
        const vaultAuth = deriveVaultAuthority(config.programId, slabPk);
        const userCollateralAta = deriveATA(publicKey, config.collateralMint);
        const userLpAta = deriveATA(publicKey, lpMint);

        // 3. Build tx
        const { blockhash } = await connection.getLatestBlockhash('confirmed');
        const tx = new Transaction({ recentBlockhash: blockhash, feePayer: publicKey });

        tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 150_000 }));
        tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 5000 }));

        // Build withdraw instruction (LP ATA must exist — user must have LP tokens)
        tx.add(buildWithdrawInsuranceLPIx(
          config.programId,
          publicKey,
          slabPk,
          userCollateralAta,
          config.vault,
          lpMint,
          userLpAta,
          vaultAuth,
          params.lpAmountBaseUnits,
        ));

        // 4. Sign + send via MWA
        const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
        const results = await signAndSend([new Uint8Array(serialized)]);
        return { signature: results.signatures[0] };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Withdraw failed';
        setError(msg);
        return null;
      } finally {
        setSubmitting(false);
      }
    },
    [publicKey, signAndSend],
  );

  return { submitting, error, depositInsuranceLP, withdrawInsuranceLP };
}
