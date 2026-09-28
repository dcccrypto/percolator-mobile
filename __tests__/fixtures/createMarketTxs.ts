/**
 * Fixture: the five transactions POST /api/mobile/create-market builds
 * (percolator-launch origin/playground, app/app/api/mobile/create-market/route.ts
 * + app/lib/mobile-market-funding-ixs.ts), reconstructed with the SAME encoders
 * the server uses — @solana/web3.js SystemProgram / ComputeBudgetProgram and
 * @solana/spl-token createAssociatedTokenAccountInstruction /
 * createTransferInstruction / getAssociatedTokenAddress — so the verifier's
 * hand-rolled SPL/ATA decoding is checked against the real encodings, not
 * against itself.
 *
 * Wrapper (Percolator) instructions are opaque to the client verifier (allowed by
 * program id), so their data is a placeholder tag byte; account lists follow the
 * route's shapes.
 */
import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import {
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import { CREATE_MARKET_PROGRAMS } from '../../src/lib/verifyCreateMarketTxs';

export const PROGRAMS = CREATE_MARKET_PROGRAMS.devnet!;
export const BLOCKHASH = 'GHtXQBsoZHVnNFa9YevAzFr17DJjgHXk3ycTKD5xD3Zi';
export const MIN_INIT_MARKET_SEED = 500_000_000n;
export const SLAB_RENT = 181_000_000;
export const PORTFOLIO_RENT = 65_946_240;
export const MATCHER_CTX_RENT = 3_118_080;

export interface Fixture {
  user: PublicKey;
  mint: PublicKey;
  slab: PublicKey;
  lpPortfolio: PublicKey;
  matcherCtx: PublicKey;
  vaultPda: PublicKey;
  vaultAta: PublicKey;
  userAta: PublicKey;
  /** Built (unsigned) transactions — mutate a copy, then `serialize()`. */
  txs: Transaction[];
}

export function wrapperIx(
  tag: number,
  keys: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[],
): TransactionInstruction {
  return new TransactionInstruction({
    programId: PROGRAMS.wrapper,
    keys,
    data: Buffer.from([tag]),
  });
}

const w = (pubkey: PublicKey, isSigner = false, isWritable = true) => ({ pubkey, isSigner, isWritable });

function newTx(feePayer: PublicKey): Transaction {
  const tx = new Transaction({ recentBlockhash: BLOCKHASH, feePayer });
  tx.add(ComputeBudgetProgram.requestHeapFrame({ bytes: 131072 }));
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }));
  return tx;
}

export async function buildFixture(user: PublicKey, mint: PublicKey, nonce = '0123456789abcdef01234567'): Promise<Fixture> {
  const { wrapper, matcher } = PROGRAMS;
  const slabSeed = `s-${nonce}`;
  const lpSeed = `p-${nonce}`;
  const ctxSeed = `m-${nonce}`;
  const slab = await PublicKey.createWithSeed(user, slabSeed, wrapper);
  const lpPortfolio = await PublicKey.createWithSeed(user, lpSeed, wrapper);
  const matcherCtx = await PublicKey.createWithSeed(user, ctxSeed, matcher);
  const [vaultPda] = PublicKey.findProgramAddressSync([Buffer.from('vault'), slab.toBuffer()], wrapper);
  const vaultAta = getAssociatedTokenAddressSync(mint, vaultPda, true);
  const userAta = getAssociatedTokenAddressSync(mint, user);
  const nftRegistry = Keypair.generate().publicKey;
  const delegate = Keypair.generate().publicKey;

  // TX0: createAccountWithSeed(slab) + create vault ATA + seed transfer + InitMarket + SetNftProgramId
  const tx0 = newTx(user);
  tx0.add(
    SystemProgram.createAccountWithSeed({
      fromPubkey: user,
      basePubkey: user,
      seed: slabSeed,
      newAccountPubkey: slab,
      lamports: SLAB_RENT,
      space: 25_000,
      programId: wrapper,
    }),
    createAssociatedTokenAccountInstruction(user, vaultAta, vaultPda, mint),
    createTransferInstruction(userAta, vaultAta, user, MIN_INIT_MARKET_SEED),
    wrapperIx(0, [w(user, true), w(slab), w(mint, false, false)]),
    wrapperIx(73, [w(user, true), w(slab, false, false), w(nftRegistry), w(SystemProgram.programId, false, false)]),
  );

  // TX1: createAccountWithSeed(LP portfolio) + InitUser
  const tx1 = newTx(user);
  tx1.add(
    SystemProgram.createAccountWithSeed({
      fromPubkey: user,
      basePubkey: user,
      seed: lpSeed,
      newAccountPubkey: lpPortfolio,
      lamports: PORTFOLIO_RENT,
      space: 9347,
      programId: wrapper,
    }),
    wrapperIx(1, [w(user, true), w(slab), w(lpPortfolio)]),
  );

  // TX2: createAccountWithSeed(matcher ctx, owner = matcher) + SetMatcherConfig + InitMatcherCtx
  const tx2 = newTx(user);
  tx2.add(
    SystemProgram.createAccountWithSeed({
      fromPubkey: user,
      basePubkey: user,
      seed: ctxSeed,
      newAccountPubkey: matcherCtx,
      lamports: MATCHER_CTX_RENT,
      space: 320,
      programId: matcher,
    }),
    wrapperIx(68, [w(user, true), w(slab), w(lpPortfolio), w(matcher, false, false), w(matcherCtx), w(delegate, false, false)]),
    wrapperIx(83, [w(user, true), w(slab), w(lpPortfolio), w(matcher, false, false), w(matcherCtx), w(delegate, false, false)]),
  );

  // TX3: DepositCollateral + TopUpInsurance + PermissionlessCrank (token moves are CPIs)
  const tokenProgram = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
  const tx3 = newTx(user);
  tx3.add(
    wrapperIx(3, [w(user, true), w(slab), w(lpPortfolio), w(userAta), w(vaultAta), w(tokenProgram, false, false)]),
    wrapperIx(9, [w(user, true), w(slab), w(userAta), w(vaultAta), w(tokenProgram, false, false)]),
    wrapperIx(5, [w(user, true), w(slab), w(lpPortfolio)]),
  );

  // TX4: TopUpBackingBucket x2
  const tx4 = newTx(user);
  tx4.add(
    wrapperIx(90, [w(user, true), w(slab), w(userAta), w(vaultAta), w(tokenProgram, false, false)]),
    wrapperIx(90, [w(user, true), w(slab), w(userAta), w(vaultAta), w(tokenProgram, false, false)]),
  );

  return { user, mint, slab, lpPortfolio, matcherCtx, vaultPda, vaultAta, userAta, txs: [tx0, tx1, tx2, tx3, tx4] };
}

export function serializeTx(tx: Transaction): Uint8Array {
  return new Uint8Array(tx.serialize({ requireAllSignatures: false, verifySignatures: false }));
}

/** Rebuild a transaction with extra instructions appended (fresh message). */
export function withAppended(tx: Transaction, ...ixs: TransactionInstruction[]): Transaction {
  const out = new Transaction({ recentBlockhash: tx.recentBlockhash!, feePayer: tx.feePayer! });
  out.add(...tx.instructions, ...ixs);
  return out;
}

/** Rebuild a transaction with instruction `index` replaced. */
export function withReplaced(tx: Transaction, index: number, ix: TransactionInstruction): Transaction {
  const out = new Transaction({ recentBlockhash: tx.recentBlockhash!, feePayer: tx.feePayer! });
  out.add(...tx.instructions.map((orig, i) => (i === index ? ix : orig)));
  return out;
}
