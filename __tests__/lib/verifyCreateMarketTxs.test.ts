/**
 * GH #160 — server-built create-market transactions must be verified per
 * instruction, not just by program id.
 *
 * The "malicious" cases below are the attacks from the issue. Each one passes
 * a program-id-only allowlist (System Program and SPL Token are allowlisted),
 * so each one is a regression test for the blind-sign drain.
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
  createApproveInstruction,
  createAssociatedTokenAccountInstruction,
  createSetAuthorityInstruction,
  AuthorityType,
  createTransferCheckedInstruction,
  createTransferInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import {
  CREATE_MARKET_PROGRAMS,
  deriveAssociatedTokenAddress,
  deriveVaultAuthority,
  verifyCreateMarketTransactions,
} from '../../src/lib/verifyCreateMarketTxs';
import {
  buildFixture,
  Fixture,
  MIN_INIT_MARKET_SEED,
  MATCHER_CTX_RENT,
  PORTFOLIO_RENT,
  PROGRAMS,
  SLAB_RENT,
  serializeTx,
  withAppended,
  withReplaced,
} from '../fixtures/createMarketTxs';

const USER = new PublicKey('5xot9PVkphiX2adznghwrAuxGs2zeWisNSxMW6hU6Hkj');
const MINT = new PublicKey('DJ54k4wH92NTtNP8RuHAwG8si1bevXEknzctDdqYN8eC');
const ATTACKER = Keypair.generate().publicKey;
const ATTACKER_ATA = getAssociatedTokenAddressSync(MINT, ATTACKER);

let fx: Fixture;

beforeAll(async () => {
  fx = await buildFixture(USER, MINT);
});

function verify(txs: Transaction[], overrides: Partial<{ claimedSlab: PublicKey; user: PublicKey; mint: PublicKey }> = {}) {
  return verifyCreateMarketTransactions({
    txBytes: txs.map(serializeTx),
    user: overrides.user ?? USER,
    mint: overrides.mint ?? MINT,
    claimedSlab: overrides.claimedSlab ?? fx.slab,
    programs: PROGRAMS,
  });
}

/** Replace transaction `t` in the batch. */
function batchWith(t: number, tx: Transaction): Transaction[] {
  return fx.txs.map((orig, i) => (i === t ? tx : orig));
}

// Instruction indices inside the fixture's TX0 (after the 2 ComputeBudget ixs).
const TX0_CREATE_SLAB = 2;
const TX0_CREATE_VAULT_ATA = 3;
const TX0_SEED_TRANSFER = 4;

describe('verifyCreateMarketTransactions — happy path (real server shape)', () => {
  it('accepts the 5 transactions the server builds', async () => {
    const v = await verify(fx.txs);
    expect(v.transactions).toHaveLength(5);
    expect(v.slab.equals(fx.slab)).toBe(true);
    expect(v.vaultAta.equals(fx.vaultAta)).toBe(true);
    expect(v.rentLamports).toBe(SLAB_RENT + PORTFOLIO_RENT + MATCHER_CTX_RENT);
    expect(v.directTokenTransfer).toBe(MIN_INIT_MARKET_SEED);
    expect(v.maxFeeLamports).toBe(5 * 5_000);
  });

  it('local ATA / vault derivations match @solana/spl-token and the server formula', () => {
    expect(deriveAssociatedTokenAddress(MINT, USER).equals(getAssociatedTokenAddressSync(MINT, USER))).toBe(true);
    expect(deriveVaultAuthority(PROGRAMS.wrapper, fx.slab).equals(fx.vaultPda)).toBe(true);
    expect(deriveAssociatedTokenAddress(MINT, fx.vaultPda).equals(fx.vaultAta)).toBe(true);
  });

  it('accepts TransferChecked into the vault', async () => {
    const tx0 = withReplaced(
      fx.txs[0],
      TX0_SEED_TRANSFER,
      createTransferCheckedInstruction(fx.userAta, MINT, fx.vaultAta, USER, MIN_INIT_MARKET_SEED, 6),
    );
    await expect(verify(batchWith(0, tx0))).resolves.toBeDefined();
  });

  it('accepts a bounded compute-unit price', async () => {
    const tx3 = withAppended(fx.txs[3], ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 10_000 }));
    const v = await verify(batchWith(3, tx3));
    expect(v.maxFeeLamports).toBe(5 * 5_000 + 14_000);
  });

  it('only the v18 devnet programs are trusted; mainnet fails closed', () => {
    expect(CREATE_MARKET_PROGRAMS.devnet!.wrapper.toBase58()).toBe('GnwdeQrAh4qzChJeVLrM21CXXWC1akjLH3DiijwzEEYZ');
    expect(CREATE_MARKET_PROGRAMS['mainnet-beta']).toBeUndefined();
  });
});

describe('verifyCreateMarketTransactions — GH #160 malicious responses are rejected', () => {
  it('appended SystemProgram.transfer(user -> attacker)', async () => {
    const tx0 = withAppended(
      fx.txs[0],
      SystemProgram.transfer({ fromPubkey: USER, toPubkey: ATTACKER, lamports: 5_000_000_000 }),
    );
    await expect(verify(batchWith(0, tx0))).rejects.toThrow(/System Program "Transfer" is not permitted/);
  });

  it('SPL seed transfer redirected to an attacker token account', async () => {
    const tx0 = withReplaced(
      fx.txs[0],
      TX0_SEED_TRANSFER,
      createTransferInstruction(fx.userAta, ATTACKER_ATA, USER, MIN_INIT_MARKET_SEED),
    );
    await expect(verify(batchWith(0, tx0))).rejects.toThrow(/destination .* is not the market vault/);
  });

  it('extra SPL transfer to the attacker appended to a later tx', async () => {
    const tx4 = withAppended(fx.txs[4], createTransferInstruction(fx.userAta, ATTACKER_ATA, USER, 10n ** 15n));
    await expect(verify(batchWith(4, tx4))).rejects.toThrow(/TX5: .*not the market vault/);
  });

  it('TransferChecked to the attacker', async () => {
    const tx0 = withReplaced(
      fx.txs[0],
      TX0_SEED_TRANSFER,
      createTransferCheckedInstruction(fx.userAta, MINT, ATTACKER_ATA, USER, MIN_INIT_MARKET_SEED, 6),
    );
    await expect(verify(batchWith(0, tx0))).rejects.toThrow(/not the market vault/);
  });

  it('fee payer is not the connected wallet', async () => {
    const tx = new Transaction({ recentBlockhash: fx.txs[1].recentBlockhash!, feePayer: ATTACKER });
    tx.add(...fx.txs[1].instructions);
    await expect(verify(batchWith(1, tx))).rejects.toThrow(/fee payer is .*not the connected wallet/);
  });

  it('an extra required signer besides the user', async () => {
    const coSigner = Keypair.generate().publicKey;
    const tx2 = withAppended(
      fx.txs[2],
      new TransactionInstruction({
        programId: PROGRAMS.wrapper,
        keys: [{ pubkey: coSigner, isSigner: true, isWritable: true }],
        data: Buffer.from([1]),
      }),
    );
    await expect(verify(batchWith(2, tx2))).rejects.toThrow(/only the connected wallet may sign/);
  });

  it('SPL Approve (delegate the user token account to the attacker)', async () => {
    const tx0 = withAppended(fx.txs[0], createApproveInstruction(fx.userAta, ATTACKER, USER, 10n ** 15n));
    await expect(verify(batchWith(0, tx0))).rejects.toThrow(/SPL Token instruction \(tag 4\) is not permitted/);
  });

  it('SPL SetAuthority (hand the token account to the attacker)', async () => {
    const tx0 = withAppended(
      fx.txs[0],
      createSetAuthorityInstruction(fx.userAta, USER, AuthorityType.AccountOwner, ATTACKER),
    );
    await expect(verify(batchWith(0, tx0))).rejects.toThrow(/SPL Token instruction \(tag 6\) is not permitted/);
  });

  it('SPL transfer from a token account that is not the user ATA for this mint', async () => {
    const otherAta = getAssociatedTokenAddressSync(Keypair.generate().publicKey, USER);
    const tx0 = withReplaced(
      fx.txs[0],
      TX0_SEED_TRANSFER,
      createTransferInstruction(otherAta, fx.vaultAta, USER, MIN_INIT_MARKET_SEED),
    );
    await expect(verify(batchWith(0, tx0))).rejects.toThrow(/source is not your token account/);
  });

  it('System Assign / Allocate / TransferWithSeed', async () => {
    const assign = SystemProgram.assign({ accountPubkey: USER, programId: ATTACKER });
    await expect(verify(batchWith(0, withAppended(fx.txs[0], assign)))).rejects.toThrow(/"Assign" is not permitted/);
    const allocate = SystemProgram.allocate({ accountPubkey: USER, space: 10 });
    await expect(verify(batchWith(0, withAppended(fx.txs[0], allocate)))).rejects.toThrow(/"Allocate" is not permitted/);
    const tws = SystemProgram.transfer({
      fromPubkey: fx.slab, basePubkey: USER, seed: 's-x', programId: SystemProgram.programId, toPubkey: ATTACKER, lamports: 1,
    });
    await expect(verify(batchWith(0, withAppended(fx.txs[0], tws)))).rejects.toThrow(/"TransferWithSeed" is not permitted/);
  });

  it('CreateAccountWithSeed with an attacker-owned new account', async () => {
    const seed = 'x-evil';
    const evil = await PublicKey.createWithSeed(USER, seed, ATTACKER);
    const ix = SystemProgram.createAccountWithSeed({
      fromPubkey: USER, basePubkey: USER, seed, newAccountPubkey: evil, lamports: 1_000_000, space: 0, programId: ATTACKER,
    });
    await expect(verify(batchWith(1, withAppended(fx.txs[1], ix)))).rejects.toThrow(/owner .* is not a Percolator program/);
  });

  it('CreateAccountWithSeed whose claimed address does not derive from (base, seed, owner)', async () => {
    const ix = SystemProgram.createAccountWithSeed({
      fromPubkey: USER, basePubkey: USER, seed: 's-other', newAccountPubkey: fx.slab, lamports: SLAB_RENT, space: 25_000, programId: PROGRAMS.wrapper,
    });
    await expect(verify(batchWith(0, withReplaced(fx.txs[0], TX0_CREATE_SLAB, ix)))).rejects.toThrow(/does not derive/);
  });

  it('CreateAccountWithSeed that parks an excessive amount of SOL', async () => {
    const seed = 'p-big';
    const acct = await PublicKey.createWithSeed(USER, seed, PROGRAMS.wrapper);
    const ix = SystemProgram.createAccountWithSeed({
      fromPubkey: USER, basePubkey: USER, seed, newAccountPubkey: acct, lamports: 50_000_000_000, space: 0, programId: PROGRAMS.wrapper,
    });
    await expect(verify(batchWith(1, withAppended(fx.txs[1], ix)))).rejects.toThrow(/exceeds limit/);
  });

  it('ATA create for an attacker-owned account instead of the vault', async () => {
    const ix = createAssociatedTokenAccountInstruction(USER, ATTACKER_ATA, ATTACKER, MINT);
    await expect(verify(batchWith(0, withReplaced(fx.txs[0], TX0_CREATE_VAULT_ATA, ix)))).rejects.toThrow(/ATA create target is not the market vault/);
  });

  it('unbounded compute-unit price (fee drain)', async () => {
    const tx3 = withAppended(fx.txs[3], ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 10n ** 12n }));
    await expect(verify(batchWith(3, tx3))).rejects.toThrow(/compute unit price .* exceeds limit/);
  });

  it('instruction for an unknown program', async () => {
    const ix = new TransactionInstruction({ programId: ATTACKER, keys: [], data: Buffer.alloc(0) });
    await expect(verify(batchWith(3, withAppended(fx.txs[3], ix)))).rejects.toThrow(/untrusted program/);
  });

  it('the old stale program ids are no longer trusted', async () => {
    for (const stale of ['GM8zjJ8LTBMv9xEsverh6H6wLyevgMHEJXcEzyY3rY24', 'PCKRHBmNXjTLV7RCM8JCBiJGveKptb6NKZcV7Xhf5wW']) {
      const ix = new TransactionInstruction({ programId: new PublicKey(stale), keys: [], data: Buffer.alloc(0) });
      await expect(verify(batchWith(3, withAppended(fx.txs[3], ix)))).rejects.toThrow(/untrusted program/);
    }
  });

  it('claimed slab_address that the batch does not create', async () => {
    const other = await PublicKey.createWithSeed(USER, 's-elsewhere', PROGRAMS.wrapper);
    await expect(verify(fx.txs, { claimedSlab: other })).rejects.toThrow(/not the market vault|is not created by the user/);
  });

  it('non-canonical bytes (trailing data after the message)', async () => {
    const bytes = fx.txs.map(serializeTx);
    const padded = new Uint8Array(bytes[0].length + 1);
    padded.set(bytes[0]);
    await expect(
      verifyCreateMarketTransactions({ txBytes: [padded, ...bytes.slice(1)], user: USER, mint: MINT, claimedSlab: fx.slab, programs: PROGRAMS }),
    ).rejects.toThrow(/TX1: /);
  });

  it('a different connected wallet than the one the txs were built for', async () => {
    await expect(verify(fx.txs, { user: ATTACKER })).rejects.toThrow(/fee payer/);
  });
});
