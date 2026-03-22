/**
 * useStake — on-chain stake deposit / withdraw for mobile.
 *
 * Mirrors percolator-launch app/hooks/useStakeDeposit.ts +
 * app/hooks/useStakeWithdraw.ts but uses MWA signAndSend (mobile)
 * instead of the web wallet adapter.
 *
 * Stake program: 6aJb1F9CDCVWCNYFwj8aQsVb696YnW6J1FznteHq4Q6k
 *
 * Instructions:
 *   Deposit (tag 1):  deposit collateral → receive stake LP tokens
 *   Withdraw (tag 2): burn stake LP tokens → receive collateral
 *
 * Pool account layout (offsets, 0-indexed):
 *   [0]       discriminant (u8)
 *   [1..32]   admin pubkey
 *   [33..64]  slab pubkey
 *   [65..96]  lp_mint pubkey
 *   [97..128] vault pubkey
 *
 * Account order:
 *   DEPOSIT:  [user(s), pool(w), user_collateral_ata(w), vault(w),
 *              lp_mint(w), user_lp_ata(w), vault_auth,
 *              deposit_pda(w), token_program, sysvar_clock, system_program]
 *   WITHDRAW: [user(s), pool(w), user_lp_ata(w), lp_mint(w),
 *              vault(w), user_collateral_ata(w), vault_auth,
 *              deposit_pda(w), token_program, sysvar_clock]
 *
 * PDAs:
 *   stake_pool:  ["stake_pool", slab]
 *   vault_auth:  ["vault_auth", pool]
 *   deposit_pda: ["deposit", pool, user]
 *   user LP ATA: associated token address for (user, lp_mint)
 */

import { useState, useCallback } from 'react';
import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  AccountMeta,
  ComputeBudgetProgram,
  SYSVAR_CLOCK_PUBKEY,
  SystemProgram,
} from '@solana/web3.js';
import { connection } from '../lib/solana';
import { useMWA } from './useMWA';

// ── Constants ────────────────────────────────────────────────────────────────

const STAKE_PROGRAM_ID = new PublicKey('6aJb1F9CDCVWCNYFwj8aQsVb696YnW6J1FznteHq4Q6k');
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

/** Instruction tags from STAKE_IX enum */
const STAKE_IX_DEPOSIT = 1;
const STAKE_IX_WITHDRAW = 2;

/** Pool account minimum size: discriminant(1) + admin(32) + slab(32) + lp_mint(32) + vault(32) + ... */
const POOL_ACCOUNT_MIN_SIZE = 186;

/** Pool account byte offsets for lp_mint and vault */
const POOL_LP_MINT_OFFSET = 65;   // after discriminant(1) + admin(32) + slab(32) = 65
const POOL_VAULT_OFFSET = 97;     // after lp_mint(32) = 97

/** Maximum safe amount in base units (10^15) — matches useInsuranceLP */
const MAX_AMOUNT_BASE_UNITS = BigInt('1000000000000000');

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

// ── Security validation ───────────────────────────────────────────────────────

/**
 * Known trusted Percolator program IDs (devnet + mainnet-beta).
 * Slab account owner is validated against this set for defense-in-depth,
 * consistent with useInsuranceLP.assertTrustedProgram() pattern.
 */
const TRUSTED_PROGRAM_IDS: ReadonlySet<string> = new Set([
  'GM8zjJ8LTBMv9xEsverh6H6wLyevgMHEJXcEzyY3rY24', // devnet v0
  'PCKRHBmNXjTLV7RCM8JCBiJGveKptb6NKZcV7Xhf5wW',  // mainnet-beta (reserved)
]);

/**
 * Validate that the slab account owner belongs to the known Percolator program
 * set. Provides defense-in-depth against spoofed slab accounts, consistent
 * with the assertTrustedProgram() pattern in useInsuranceLP.
 */
function assertTrustedProgram(programId: PublicKey, label: string): void {
  if (!TRUSTED_PROGRAM_IDS.has(programId.toBase58())) {
    throw new Error(`Untrusted program for ${label}: ${programId.toBase58()}`);
  }
}

function assertSafeAmount(amount: bigint, label: string): void {
  if (amount <= BigInt(0)) {
    throw new Error(`${label} must be > 0`);
  }
  if (amount > MAX_AMOUNT_BASE_UNITS) {
    throw new Error(`${label} exceeds maximum (${MAX_AMOUNT_BASE_UNITS})`);
  }
}

// ── Account meta helpers ─────────────────────────────────────────────────────

function meta(pubkey: PublicKey, isSigner: boolean, isWritable: boolean): AccountMeta {
  return { pubkey, isSigner, isWritable };
}

// ── PDA derivation ────────────────────────────────────────────────────────────

/** Seeds: ["stake_pool", slab_key] */
function deriveStakePool(slab: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('stake_pool'), slab.toBuffer()],
    STAKE_PROGRAM_ID,
  );
  return pda;
}

/** Seeds: ["vault_auth", pool_key] */
function deriveStakeVaultAuth(pool: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault_auth'), pool.toBuffer()],
    STAKE_PROGRAM_ID,
  );
  return pda;
}

/** Seeds: ["deposit", pool_key, user_key] */
function deriveDepositPda(pool: PublicKey, user: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('deposit'), pool.toBuffer(), user.toBuffer()],
    STAKE_PROGRAM_ID,
  );
  return pda;
}

/** Derive associated token account address. */
function deriveATA(owner: PublicKey, mint: PublicKey): PublicKey {
  const [ata] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  return ata;
}

/** Build idempotent create-ATA instruction. */
function buildCreateATAIx(
  payer: PublicKey,
  ataAddress: PublicKey,
  owner: PublicKey,
  mint: PublicKey,
): TransactionInstruction {
  return new TransactionInstruction({
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    keys: [
      meta(payer, true, true),
      meta(ataAddress, false, true),
      meta(owner, false, false),
      meta(mint, false, false),
      meta(SystemProgram.programId, false, false),
      meta(TOKEN_PROGRAM_ID, false, false),
    ],
    data: Buffer.from([0x01]), // create idempotent variant
  });
}

// ── Pool account parsing ──────────────────────────────────────────────────────

interface StakePoolAccounts {
  pool: PublicKey;
  lpMint: PublicKey;
  vault: PublicKey;
  vaultAuth: PublicKey;
}

async function fetchStakePoolAccounts(
  slab: PublicKey,
  user: PublicKey,
): Promise<StakePoolAccounts & { depositPda: PublicKey }> {
  const pool = deriveStakePool(slab);

  const poolInfo = await connection.getAccountInfo(pool);
  if (!poolInfo || poolInfo.data.length < POOL_ACCOUNT_MIN_SIZE) {
    throw new Error('Stake pool not initialised for this market. Contact admin.');
  }
  if (!poolInfo.owner.equals(STAKE_PROGRAM_ID)) {
    throw new Error('Stake pool account owner mismatch — possible network misconfiguration.');
  }

  const poolData = Buffer.from(poolInfo.data);
  const lpMint = new PublicKey(poolData.subarray(POOL_LP_MINT_OFFSET, POOL_LP_MINT_OFFSET + 32));
  const vault = new PublicKey(poolData.subarray(POOL_VAULT_OFFSET, POOL_VAULT_OFFSET + 32));
  const vaultAuth = deriveStakeVaultAuth(pool);
  const depositPda = deriveDepositPda(pool, user);

  return { pool, lpMint, vault, vaultAuth, depositPda };
}

// ── Instruction builders ──────────────────────────────────────────────────────

/**
 * Build stake deposit instruction.
 *
 * Account order (matches on-chain processor):
 * [user(s), pool(w), user_collateral_ata(w), vault(w),
 *  lp_mint(w), user_lp_ata(w), vault_auth,
 *  deposit_pda(w), token_program, sysvar_clock, system_program]
 */
function buildStakeDepositIx(
  user: PublicKey,
  pool: PublicKey,
  userCollateralAta: PublicKey,
  vault: PublicKey,
  lpMint: PublicKey,
  userLpAta: PublicKey,
  vaultAuth: PublicKey,
  depositPda: PublicKey,
  amount: bigint,
): TransactionInstruction {
  const data = concat(encU8(STAKE_IX_DEPOSIT), encU64LE(amount));
  return new TransactionInstruction({
    programId: STAKE_PROGRAM_ID,
    keys: [
      meta(user, true, false),              // user (signer)
      meta(pool, false, true),              // pool (writable)
      meta(userCollateralAta, false, true), // user_collateral_ata (writable)
      meta(vault, false, true),             // vault (writable)
      meta(lpMint, false, true),            // lp_mint (writable)
      meta(userLpAta, false, true),         // user_lp_ata (writable)
      meta(vaultAuth, false, false),        // vault_auth
      meta(depositPda, false, true),        // deposit_pda (writable)
      meta(TOKEN_PROGRAM_ID, false, false), // token_program
      meta(SYSVAR_CLOCK_PUBKEY, false, false), // sysvar_clock
      meta(SystemProgram.programId, false, false), // system_program
    ],
    data: Buffer.from(data),
  });
}

/**
 * Build stake withdraw instruction.
 *
 * Account order:
 * [user(s), pool(w), user_lp_ata(w), lp_mint(w),
 *  vault(w), user_collateral_ata(w), vault_auth,
 *  deposit_pda(w), token_program, sysvar_clock]
 */
function buildStakeWithdrawIx(
  user: PublicKey,
  pool: PublicKey,
  userLpAta: PublicKey,
  lpMint: PublicKey,
  vault: PublicKey,
  userCollateralAta: PublicKey,
  vaultAuth: PublicKey,
  depositPda: PublicKey,
  lpAmount: bigint,
): TransactionInstruction {
  const data = concat(encU8(STAKE_IX_WITHDRAW), encU64LE(lpAmount));
  return new TransactionInstruction({
    programId: STAKE_PROGRAM_ID,
    keys: [
      meta(user, true, false),              // user (signer)
      meta(pool, false, true),              // pool (writable)
      meta(userLpAta, false, true),         // user_lp_ata (writable)
      meta(lpMint, false, true),            // lp_mint (writable)
      meta(vault, false, true),             // vault (writable)
      meta(userCollateralAta, false, true), // user_collateral_ata (writable)
      meta(vaultAuth, false, false),        // vault_auth
      meta(depositPda, false, true),        // deposit_pda (writable)
      meta(TOKEN_PROGRAM_ID, false, false), // token_program
      meta(SYSVAR_CLOCK_PUBKEY, false, false), // sysvar_clock
    ],
    data: Buffer.from(data),
  });
}

// ── Hook types ────────────────────────────────────────────────────────────────

export interface StakeDepositParams {
  /** Slab (market) address */
  slabAddress: string;
  /** Collateral mint address — required to build user's collateral ATA */
  collateralMint: string;
  /** Deposit amount in collateral token base units (e.g. 1 USDC = 1_000_000) */
  amountBaseUnits: bigint;
}

export interface StakeWithdrawParams {
  /** Slab (market) address */
  slabAddress: string;
  /** Collateral mint address */
  collateralMint: string;
  /** LP token amount to burn (base units) */
  lpAmountBaseUnits: bigint;
}

export interface StakeResult {
  signature: string;
}

export interface UseStakeResult {
  submitting: boolean;
  error: string | null;
  stakeDeposit: (params: StakeDepositParams) => Promise<StakeResult | null>;
  stakeWithdraw: (params: StakeWithdrawParams) => Promise<StakeResult | null>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useStake(): UseStakeResult {
  const { publicKey, signAndSend } = useMWA();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Deposit ──────────────────────────────────────────────────────────────

  const stakeDeposit = useCallback(
    async (params: StakeDepositParams): Promise<StakeResult | null> => {
      if (!publicKey) {
        setError('Wallet not connected');
        return null;
      }

      setSubmitting(true);
      setError(null);

      try {
        const slabPk = new PublicKey(params.slabAddress);
        const collateralMintPk = new PublicKey(params.collateralMint);

        // Validate amount before any network calls
        assertSafeAmount(params.amountBaseUnits, 'Stake deposit amount');

        // Validate slab exists on-chain and owner is a trusted Percolator program
        const slabInfo = await connection.getAccountInfo(slabPk);
        if (!slabInfo) throw new Error('Market not found on-chain');
        assertTrustedProgram(slabInfo.owner, 'Stake slab');

        // Fetch pool accounts + derive PDAs
        const { pool, lpMint, vault, vaultAuth, depositPda } =
          await fetchStakePoolAccounts(slabPk, publicKey);

        // Derive ATAs
        const userCollateralAta = deriveATA(publicKey, collateralMintPk);
        const userLpAta = deriveATA(publicKey, lpMint);

        // Build tx
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
        const tx = new Transaction({ recentBlockhash: blockhash, feePayer: publicKey });

        tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 250_000 }));
        tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 5000 }));

        // Create collateral ATA if missing
        const collAtaInfo = await connection.getAccountInfo(userCollateralAta);
        if (!collAtaInfo) {
          tx.add(buildCreateATAIx(publicKey, userCollateralAta, publicKey, collateralMintPk));
        }

        // Create LP ATA if missing
        const lpAtaInfo = await connection.getAccountInfo(userLpAta);
        if (!lpAtaInfo) {
          tx.add(buildCreateATAIx(publicKey, userLpAta, publicKey, lpMint));
        }

        tx.add(buildStakeDepositIx(
          publicKey,
          pool,
          userCollateralAta,
          vault,
          lpMint,
          userLpAta,
          vaultAuth,
          depositPda,
          params.amountBaseUnits,
        ));

        const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
        const results = await signAndSend([new Uint8Array(serialized)]);
        const signature = results.signatures[0];
        if (!signature) {
          throw new Error('Wallet did not return a transaction signature');
        }

        // Wait for on-chain finality before reporting success
        const confirmation = await connection.confirmTransaction(
          { signature, blockhash, lastValidBlockHeight },
          'confirmed',
        );
        if (confirmation.value.err) {
          throw new Error(
            `Transaction failed on-chain: ${JSON.stringify(confirmation.value.err)}`,
          );
        }

        return { signature };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Stake deposit failed';
        setError(msg);
        return null;
      } finally {
        setSubmitting(false);
      }
    },
    [publicKey, signAndSend],
  );

  // ── Withdraw ─────────────────────────────────────────────────────────────

  const stakeWithdraw = useCallback(
    async (params: StakeWithdrawParams): Promise<StakeResult | null> => {
      if (!publicKey) {
        setError('Wallet not connected');
        return null;
      }

      setSubmitting(true);
      setError(null);

      try {
        const slabPk = new PublicKey(params.slabAddress);
        const collateralMintPk = new PublicKey(params.collateralMint);

        // Validate LP amount before any network calls
        assertSafeAmount(params.lpAmountBaseUnits, 'Stake withdraw amount');

        // Validate slab exists on-chain and owner is a trusted Percolator program
        const slabInfo = await connection.getAccountInfo(slabPk);
        if (!slabInfo) throw new Error('Market not found on-chain');
        assertTrustedProgram(slabInfo.owner, 'Stake slab');

        // Fetch pool accounts + derive PDAs
        const { pool, lpMint, vault, vaultAuth, depositPda } =
          await fetchStakePoolAccounts(slabPk, publicKey);

        // Derive ATAs
        const userCollateralAta = deriveATA(publicKey, collateralMintPk);
        const userLpAta = deriveATA(publicKey, lpMint);

        // Preflight: LP ATA must exist (user must hold LP tokens to withdraw)
        const lpAtaInfo = await connection.getAccountInfo(userLpAta);
        if (!lpAtaInfo) {
          throw new Error(
            `Stake LP token account not found for mint ${lpMint.toBase58().slice(0, 8)}…` +
            ` — deposit first to receive stake LP tokens`,
          );
        }

        // Build tx
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
        const tx = new Transaction({ recentBlockhash: blockhash, feePayer: publicKey });

        tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }));
        tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 5000 }));

        // Create collateral ATA if missing (user may have closed it)
        const collAtaInfo = await connection.getAccountInfo(userCollateralAta);
        if (!collAtaInfo) {
          tx.add(buildCreateATAIx(publicKey, userCollateralAta, publicKey, collateralMintPk));
        }

        tx.add(buildStakeWithdrawIx(
          publicKey,
          pool,
          userLpAta,
          lpMint,
          vault,
          userCollateralAta,
          vaultAuth,
          depositPda,
          params.lpAmountBaseUnits,
        ));

        const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
        const results = await signAndSend([new Uint8Array(serialized)]);
        const signature = results.signatures[0];
        if (!signature) {
          throw new Error('Wallet did not return a transaction signature');
        }

        // Wait for on-chain finality before reporting success
        const confirmation = await connection.confirmTransaction(
          { signature, blockhash, lastValidBlockHeight },
          'confirmed',
        );
        if (confirmation.value.err) {
          throw new Error(
            `Transaction failed on-chain: ${JSON.stringify(confirmation.value.err)}`,
          );
        }

        return { signature };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Stake withdrawal failed';
        setError(msg);
        return null;
      } finally {
        setSubmitting(false);
      }
    },
    [publicKey, signAndSend],
  );

  return { submitting, error, stakeDeposit, stakeWithdraw };
}
