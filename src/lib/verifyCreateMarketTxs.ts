/**
 * verifyCreateMarketTxs — per-instruction verification of the server-built
 * market-deployment transactions (GH #160).
 *
 * useCreateMarket is the one flow in the app that signs transaction bytes it did
 * not build itself: POST /api/mobile/create-market returns five unsigned legacy
 * transactions and the wallet adds the deployer's signature. The previous guard
 * only checked each instruction's PROGRAM ID against an allowlist that included
 * the System Program and SPL Token in full, and never looked at the accounts or
 * data, nor at the fee payer. A compromised or MITM'd API response could append
 * `SystemProgram.transfer(user -> attacker)` or an SPL `Transfer` to an
 * attacker's token account and it would be signed without complaint.
 *
 * This module treats the server response as untrusted input and only lets
 * through instructions whose effect on the user's funds is fully determined by
 * values the client derives itself:
 *
 *   - Transaction shape: legacy tx, fee payer == user, the user is the ONLY
 *     required signer, and the bytes re-serialize exactly (what we verified is
 *     byte-for-byte what gets signed).
 *   - System Program: ONLY CreateAccountWithSeed, funded by and seeded from the
 *     user, whose claimed address re-derives from (base, seed, owner), owned by
 *     a Percolator program (wrapper / matcher), with bounded rent.
 *   - SPL Token: ONLY Transfer / TransferChecked, from the user's own ATA for the
 *     mint the USER chose, with the user as authority, and ONLY into the market
 *     vault ATA recomputed locally from (mint, vault-authority PDA of the slab).
 *   - Associated Token program: ONLY Create / CreateIdempotent of that same
 *     recomputed vault ATA, paid for by the user.
 *   - ComputeBudget: ONLY RequestHeapFrame / SetComputeUnitLimit /
 *     SetComputeUnitPrice, with caps (an unbounded CU price is a fee drain).
 *   - Percolator wrapper / matcher / nft / stake programs: allowed by program id.
 *     Their account/authority checks are the on-chain program's job.
 *
 * Everything else is rejected. There is no network access in here, so it is
 * unit-testable without mocks.
 */
import {
  ComputeBudgetInstruction,
  ComputeBudgetProgram,
  PublicKey,
  SystemInstruction,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';

// ---------------------------------------------------------------------------
// Program IDs
// ---------------------------------------------------------------------------

export const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
);
const SYSTEM_PROGRAM_ID = SystemProgram.programId;
const COMPUTE_BUDGET_PROGRAM_ID = ComputeBudgetProgram.programId;

export interface PercolatorProgramSet {
  /** Percolator wrapper (market) program — owns the slab + LP portfolio. */
  wrapper: PublicKey;
  /** Matcher program — owns the matcher context account. */
  matcher: PublicKey;
  /** Position-NFT program (referenced by SetNftProgramId). */
  nft: PublicKey;
  /** Stake / vault program. */
  stake: PublicKey;
}

/**
 * Programs the create-market server route builds against, per cluster.
 *
 * devnet = the live v18 deployment (percolator-launch app/lib/config.ts devnet
 * config, which /api/mobile/create-market uses). The route refuses every
 * network other than devnet (GH#1950), so mainnet-beta has NO entry: market
 * creation fails closed there instead of trusting a placeholder program id.
 *
 * Replaces the stale allowlist (GM8zjJ8… devnet v0 — dead; PCKRHBm… mainnet
 * "reserved" placeholder — never deployed).
 */
export const CREATE_MARKET_PROGRAMS: Readonly<
  Partial<Record<'devnet' | 'mainnet-beta', PercolatorProgramSet>>
> = {
  devnet: {
    wrapper: new PublicKey('GnwdeQrAh4qzChJeVLrM21CXXWC1akjLH3DiijwzEEYZ'),
    matcher: new PublicKey('4seJWjv3R5qfXY8R5ntuPHWsoqcVvaxvfFSnU2AnGMhT'),
    nft: new PublicKey('CNGBPZRALk9Xu8BdgWNyrLJ7daQ9eJYFf1GnEEC7YCU3'),
    stake: new PublicKey('GCHhcgwPyrai8SWHEVWw3odedguFXEtJobNnWSfWBCU3'),
  },
};

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

/**
 * Upper bound on lamports for any single account created with seed. The largest
 * legitimate account (the slab, v17MarketAccountLen(14) ≈ 26 KB) needs ~0.18 SOL
 * of rent; 2 SOL leaves room for growth while stopping a response that parks an
 * arbitrary amount of the user's SOL in a new account.
 */
export const MAX_CREATE_ACCOUNT_LAMPORTS = 2_000_000_000;
/** Max compute-unit price (micro-lamports/CU). At 1.4M CU this is ≈ 0.0014 SOL. */
export const MAX_COMPUTE_UNIT_PRICE_MICROLAMPORTS = 1_000_000n;
export const MAX_COMPUTE_UNIT_LIMIT = 1_400_000;
export const MAX_HEAP_FRAME_BYTES = 256 * 1024;
/** Base fee per signature (lamports). */
export const LAMPORTS_PER_SIGNATURE = 5_000;

// ---------------------------------------------------------------------------
// Derivations (kept local so the checks do not depend on server-supplied values)
// ---------------------------------------------------------------------------

/** Canonical associated-token-account address for (mint, owner) under SPL Token. */
export function deriveAssociatedTokenAddress(mint: PublicKey, owner: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  )[0];
}

/** ASCII "vault" — kept as bytes so this module has no Buffer global dependency. */
const VAULT_SEED = new Uint8Array([0x76, 0x61, 0x75, 0x6c, 0x74]);

/** Market vault authority PDA: seeds ["vault", slab] under the wrapper program. */
export function deriveVaultAuthority(wrapper: PublicKey, slab: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [VAULT_SEED, slab.toBuffer()],
    wrapper,
  )[0];
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

export class CreateMarketVerificationError extends Error {
  constructor(message: string) {
    super(`${message} Deployment aborted — do not sign.`);
    this.name = 'CreateMarketVerificationError';
  }
}

export interface VerifyCreateMarketParams {
  /** Raw server-supplied transaction bytes, in send order. */
  txBytes: Uint8Array[];
  /** Connected wallet — must be fee payer, sole signer, and funding source. */
  user: PublicKey;
  /** Collateral mint the USER chose (client input, not a server echo). */
  mint: PublicKey;
  /** Slab address the server claims it is creating. */
  claimedSlab: PublicKey;
  /** Program set for the active cluster. */
  programs: PercolatorProgramSet;
}

export interface VerifiedCreateMarket {
  /** Decoded transactions, byte-identical to `txBytes`. */
  transactions: Transaction[];
  /** The slab, proven to be created in this batch by the user, owned by the wrapper. */
  slab: PublicKey;
  /** Locally derived market vault ATA (the only permitted token destination). */
  vaultAta: PublicKey;
  /** Lamports moved into newly created accounts (rent). */
  rentLamports: number;
  /** Upper bound on network fees: base signature fees + priority fees. */
  maxFeeLamports: number;
  /** Tokens moved by top-level SPL transfers (all into `vaultAta`). */
  directTokenTransfer: bigint;
}

function eq(a: PublicKey, b: PublicKey): boolean {
  return a.equals(b);
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function readU64LE(data: Uint8Array, offset: number): bigint {
  let v = 0n;
  for (let i = 7; i >= 0; i--) v = (v << 8n) | BigInt(data[offset + i]);
  return v;
}

/**
 * Verify every server-built create-market transaction. Throws
 * CreateMarketVerificationError on the first violation; returns the decoded
 * transactions plus a cost summary on success.
 */
export async function verifyCreateMarketTransactions(
  p: VerifyCreateMarketParams,
): Promise<VerifiedCreateMarket> {
  const { txBytes, user, mint, claimedSlab, programs } = p;
  const { wrapper, matcher, nft, stake } = programs;
  const percolatorPrograms = [wrapper, matcher, nft, stake];
  const allowedOwners = [wrapper, matcher];

  const userAta = deriveAssociatedTokenAddress(mint, user);
  const vaultAuthority = deriveVaultAuthority(wrapper, claimedSlab);
  const vaultAta = deriveAssociatedTokenAddress(mint, vaultAuthority);

  const transactions: Transaction[] = [];
  let slabCreated = false;
  let rentLamports = 0;
  let maxFeeLamports = 0;
  let directTokenTransfer = 0n;

  for (let t = 0; t < txBytes.length; t++) {
    const bytes = txBytes[t];
    const label = `TX${t + 1}`;
    const fail = (msg: string): never => {
      throw new CreateMarketVerificationError(`${label}: ${msg}.`);
    };

    // ── Decode + canonical round-trip ────────────────────────────────────────
    let tx: Transaction;
    try {
      tx = Transaction.from(bytes);
    } catch (e) {
      throw fail(`could not decode as a legacy transaction (${(e as Error).message})`);
    }
    let reserialized: Uint8Array;
    try {
      reserialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
    } catch (e) {
      throw fail(`could not re-serialize (${(e as Error).message})`);
    }
    if (!bytesEqual(reserialized, bytes)) {
      fail('non-canonical encoding — verified message would differ from signed bytes');
    }

    // ── Fee payer + signer set ───────────────────────────────────────────────
    if (!tx.feePayer || !eq(tx.feePayer, user)) {
      fail(`fee payer is ${tx.feePayer?.toBase58() ?? '(none)'}, not the connected wallet`);
    }
    if (tx.signatures.length !== 1 || !eq(tx.signatures[0].publicKey, user)) {
      fail(
        `required signers are [${tx.signatures.map((s) => s.publicKey.toBase58()).join(', ')}]; ` +
          'only the connected wallet may sign',
      );
    }
    let cuLimit = 200_000 * tx.instructions.length; // runtime default when unset
    let cuPrice = 0n;

    // ── Per-instruction checks ───────────────────────────────────────────────
    for (let k = 0; k < tx.instructions.length; k++) {
      const ix: TransactionInstruction = tx.instructions[k];
      const where = `instruction ${k}`;
      const pid = ix.programId;

      if (eq(pid, SYSTEM_PROGRAM_ID)) {
        let type: string;
        try {
          type = SystemInstruction.decodeInstructionType(ix);
        } catch {
          return fail(`${where}: undecodable System Program instruction`);
        }
        if (type !== 'CreateWithSeed') {
          return fail(`${where}: System Program "${type}" is not permitted`);
        }
        const c = SystemInstruction.decodeCreateWithSeed(ix);
        if (ix.keys.length !== 2) {
          fail(`${where}: CreateAccountWithSeed must use exactly [from, newAccount]`);
        }
        if (!eq(c.fromPubkey, user) || !eq(c.basePubkey, user)) {
          fail(`${where}: CreateAccountWithSeed must be funded by and based on the connected wallet`);
        }
        if (!allowedOwners.some((o) => eq(o, c.programId))) {
          fail(`${where}: new account owner ${c.programId.toBase58()} is not a Percolator program`);
        }
        let derived: PublicKey;
        try {
          derived = await PublicKey.createWithSeed(c.basePubkey, c.seed, c.programId);
        } catch {
          return fail(`${where}: invalid seed`);
        }
        if (!eq(derived, c.newAccountPubkey)) {
          fail(`${where}: new account address does not derive from (base, seed, owner)`);
        }
        if (!Number.isSafeInteger(c.lamports) || c.lamports < 0 || c.lamports > MAX_CREATE_ACCOUNT_LAMPORTS) {
          fail(`${where}: account funding ${c.lamports} lamports exceeds limit`);
        }
        rentLamports += c.lamports;
        if (eq(c.newAccountPubkey, claimedSlab)) {
          if (!eq(c.programId, wrapper)) fail(`${where}: slab must be owned by the wrapper program`);
          slabCreated = true;
        }
        continue;
      }

      if (eq(pid, TOKEN_PROGRAM_ID)) {
        const d = ix.data;
        let source: PublicKey;
        let dest: PublicKey;
        let authority: PublicKey;
        let amount: bigint;
        if (d.length === 9 && d[0] === 3) {
          // Transfer: [source, destination, authority]
          if (ix.keys.length !== 3) return fail(`${where}: SPL Transfer must have exactly 3 accounts`);
          [source, dest, authority] = ix.keys.map((m) => m.pubkey);
          amount = readU64LE(d, 1);
        } else if (d.length === 10 && d[0] === 12) {
          // TransferChecked: [source, mint, destination, authority]
          if (ix.keys.length !== 4) return fail(`${where}: SPL TransferChecked must have exactly 4 accounts`);
          if (!eq(ix.keys[1].pubkey, mint)) return fail(`${where}: TransferChecked mint mismatch`);
          source = ix.keys[0].pubkey;
          dest = ix.keys[2].pubkey;
          authority = ix.keys[3].pubkey;
          amount = readU64LE(d, 1);
        } else {
          return fail(`${where}: SPL Token instruction (tag ${d[0]}) is not permitted`);
        }
        if (!eq(authority, user)) fail(`${where}: SPL transfer authority is not the connected wallet`);
        if (!eq(source, userAta)) fail(`${where}: SPL transfer source is not your token account for this mint`);
        if (!eq(dest, vaultAta)) {
          fail(`${where}: SPL transfer destination ${dest.toBase58()} is not the market vault`);
        }
        directTokenTransfer += amount;
        continue;
      }

      if (eq(pid, ASSOCIATED_TOKEN_PROGRAM_ID)) {
        const d = ix.data;
        const isCreate = d.length === 0 || (d.length === 1 && (d[0] === 0 || d[0] === 1));
        if (!isCreate) return fail(`${where}: Associated Token instruction is not permitted`);
        if (ix.keys.length !== 6) return fail(`${where}: ATA create must have exactly 6 accounts`);
        const [payer, ata, owner, ataMint, sys, tok] = ix.keys.map((m) => m.pubkey);
        if (!eq(payer, user)) fail(`${where}: ATA create must be paid by the connected wallet`);
        if (!eq(ata, vaultAta) || !eq(owner, vaultAuthority) || !eq(ataMint, mint)) {
          fail(`${where}: ATA create target is not the market vault`);
        }
        if (!eq(sys, SYSTEM_PROGRAM_ID) || !eq(tok, TOKEN_PROGRAM_ID)) {
          fail(`${where}: ATA create has unexpected program accounts`);
        }
        continue;
      }

      if (eq(pid, COMPUTE_BUDGET_PROGRAM_ID)) {
        let type: string;
        try {
          type = ComputeBudgetInstruction.decodeInstructionType(ix);
        } catch {
          return fail(`${where}: undecodable ComputeBudget instruction`);
        }
        if (type === 'RequestHeapFrame') {
          const { bytes: heap } = ComputeBudgetInstruction.decodeRequestHeapFrame(ix);
          if (heap > MAX_HEAP_FRAME_BYTES) fail(`${where}: heap frame too large`);
        } else if (type === 'SetComputeUnitLimit') {
          const { units } = ComputeBudgetInstruction.decodeSetComputeUnitLimit(ix);
          if (units > MAX_COMPUTE_UNIT_LIMIT) fail(`${where}: compute unit limit too large`);
          cuLimit = units;
        } else if (type === 'SetComputeUnitPrice') {
          const { microLamports } = ComputeBudgetInstruction.decodeSetComputeUnitPrice(ix);
          cuPrice = BigInt(microLamports);
          if (cuPrice > MAX_COMPUTE_UNIT_PRICE_MICROLAMPORTS) {
            fail(`${where}: compute unit price ${cuPrice} exceeds limit`);
          }
        } else {
          fail(`${where}: ComputeBudget "${type}" is not permitted`);
        }
        continue;
      }

      if (percolatorPrograms.some((q) => eq(q, pid))) continue;

      fail(`${where}: untrusted program ${pid.toBase58()}`);
    }

    maxFeeLamports +=
      tx.signatures.length * LAMPORTS_PER_SIGNATURE +
      Number((cuPrice * BigInt(Math.min(cuLimit, MAX_COMPUTE_UNIT_LIMIT)) + 999_999n) / 1_000_000n);
    transactions.push(tx);
  }

  if (!slabCreated) {
    throw new CreateMarketVerificationError(
      `Slab ${claimedSlab.toBase58()} is not created by the user in these transactions.`,
    );
  }

  return { transactions, slab: claimedSlab, vaultAta, rentLamports, maxFeeLamports, directTokenTransfer };
}
