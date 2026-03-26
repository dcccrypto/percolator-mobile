/**
 * Security tests for src/hooks/useTrade.ts
 *
 * Coverage:
 *   HIGH-1: uiAmountToRaw — no precision loss for common USD amounts
 *   HIGH-2: zero/NaN/Infinity sizeUsd guard — MWA never called with no-op trade
 *   MED-5:  slab_address on-chain owner verified before parsing data
 */

import { renderHook, act } from '@testing-library/react-native';
import { PublicKey } from '@solana/web3.js';

// ── Connection mock ────────────────────────────────────────────────────────
const mockGetAccountInfo = jest.fn(() => Promise.resolve(null));
const mockGetLatestBlockhash = jest.fn(() =>
  Promise.resolve({
    blockhash: 'GHtXQBsoZHVnNFa9YevAzFr17DJjgHXk3ycTKD5xD3Zi',
    lastValidBlockHeight: 200,
  }),
);

jest.mock('../../src/lib/solana', () => ({
  connection: {
    get getAccountInfo() { return mockGetAccountInfo; },
    get getLatestBlockhash() { return mockGetLatestBlockhash; },
  },
}));

// ── MWA mock ──────────────────────────────────────────────────────────────
const mockSignAndSend = jest.fn(() =>
  Promise.resolve({ signatures: ['trade-sig-xyz999'] }),
);

jest.mock('../../src/hooks/useMWA', () => {
  const { PublicKey: PK } = require('@solana/web3.js');
  return {
    useMWA: () => ({
      publicKey: new PK('7nYhfGQDMFLJFJGQjz5rPpXoQiWC2iqMBfwqXVLvJCNs'),
      signAndSend: mockSignAndSend,
    }),
  };
});

// ── confirmTransaction mock ───────────────────────────────────────────────
jest.mock('../../src/lib/confirmTransaction', () => ({
  confirmTransactionSafe: jest.fn(() => Promise.resolve()),
}));

// ── Constants ──────────────────────────────────────────────────────────────
const TRUSTED_PROGRAM_ID = new PublicKey('GM8zjJ8LTBMv9xEsverh6H6wLyevgMHEJXcEzyY3rY24');
const VAULT_PK           = new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin');
const COLLATERAL_MINT    = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const SLAB_ADDR          = new PublicKey('4hN36wJSoMZPGkRVcWVJQipkfXPJhvA5GZQNM6Czk4wJ');

// ── Slab data builder ─────────────────────────────────────────────────────
// V0 layout: headerLen=72, configOff=72, engineOff=480, acctSize=240
// maxAccounts at engineOff+80=560. maxAccounts=10, preAccountsBytes=200 (8-aligned).
// accountsOff=680, totalSize=3080.
//
// Config field offsets relative to configOff=72:
//   CFG_PROGRAM_ID_OFF=0 → abs 72
//   CFG_VAULT_OFF=128    → abs 200
//   CFG_COLLATERAL_MINT_OFF=160 → abs 232
//
// Account offsets within each 240-byte account entry (from slabLayout.ts):
//   ACCT_KIND_OFF=24, ACCT_OWNER_OFF=184, ACCT_MATCHER_PROGRAM_OFF=120, ACCT_MATCHER_CONTEXT_OFF=152

const V0_HEADER_LEN   = 72;
const V0_ENGINE_OFF   = 480;
const PRE_ACCOUNTS    = 200;
const MAX_ACCOUNTS    = 10;
const ACCT_SIZE       = 240;
const TOTAL_SIZE      = V0_ENGINE_OFF + PRE_ACCOUNTS + MAX_ACCOUNTS * ACCT_SIZE; // 3080

const CFG_PROGRAM_ID_OFF      = 0;
const CFG_VAULT_OFF           = 128;
const CFG_COLLATERAL_MINT_OFF = 160;

// Account field offsets
const ACCT_KIND_OFF           = 24;
const ACCT_OWNER_OFF          = 184;
const ACCT_MATCHER_PROGRAM_OFF = 120;
const ACCT_MATCHER_CONTEXT_OFF = 152;

function buildSlabData(opts: {
  programId?: PublicKey;
  vault?: PublicKey;
  collateralMint?: PublicKey;
  lpOwner?: PublicKey;
  matcherProgram?: PublicKey;
  matcherContext?: PublicKey;
}): Uint8Array {
  const buf = new Uint8Array(TOTAL_SIZE);
  const dv  = new DataView(buf.buffer);

  // maxAccounts at engineOff + 80
  dv.setBigUint64(V0_ENGINE_OFF + 80, BigInt(MAX_ACCOUNTS), true);

  // Config at configOff = headerLen = 72
  const configBase = V0_HEADER_LEN;
  buf.set((opts.programId ?? TRUSTED_PROGRAM_ID).toBytes(), configBase + CFG_PROGRAM_ID_OFF);
  buf.set((opts.vault ?? VAULT_PK).toBytes(),               configBase + CFG_VAULT_OFF);
  buf.set((opts.collateralMint ?? COLLATERAL_MINT).toBytes(), configBase + CFG_COLLATERAL_MINT_OFF);
  // oracleAuthority = zeros → admin oracle path

  // LP account at accountsOff = V0_ENGINE_OFF + PRE_ACCOUNTS = 680
  const accountsOff = V0_ENGINE_OFF + PRE_ACCOUNTS;
  // kind=1 (LP)
  buf[accountsOff + ACCT_KIND_OFF] = 1;
  // LP owner — use byte arrays to avoid base58 parsing issues in tests
  const lpOwner = opts.lpOwner ?? new PublicKey(new Uint8Array(32).fill(0x11));
  buf.set(lpOwner.toBytes(), accountsOff + ACCT_OWNER_OFF);
  // matcherProgram
  const matcherProg = opts.matcherProgram ?? new PublicKey(new Uint8Array(32).fill(0x22));
  buf.set(matcherProg.toBytes(), accountsOff + ACCT_MATCHER_PROGRAM_OFF);
  // matcherContext
  const matcherCtx = opts.matcherContext ?? new PublicKey(new Uint8Array(32).fill(0x33));
  buf.set(matcherCtx.toBytes(), accountsOff + ACCT_MATCHER_CONTEXT_OFF);

  return buf;
}

function makeSlabInfo(data: Uint8Array, owner: PublicKey = TRUSTED_PROGRAM_ID) {
  return { data: Buffer.from(data), owner };
}

// ── Import hook ───────────────────────────────────────────────────────────
import { useTrade } from '../../src/hooks/useTrade';

beforeEach(() => {
  jest.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────
// HIGH-2 — zero / NaN / Infinity sizeUsd guard
// ─────────────────────────────────────────────────────────────────────────

describe('HIGH-2: zero/NaN/Infinity sizeUsd guard', () => {
  it('rejects sizeUsd = 0 before MWA signing', async () => {
    const { result } = renderHook(() => useTrade());
    let res: any;
    await act(async () => {
      res = await result.current.submitTrade({
        slabAddress: SLAB_ADDR.toBase58(),
        userIdx: 0,
        sizeUsd: 0,
        direction: 'long',
      });
    });

    expect(res).toBeNull();
    expect(result.current.error).toMatch(/invalid trade size/i);
    expect(mockSignAndSend).not.toHaveBeenCalled();
    // Confirm no network call was even made
    expect(mockGetAccountInfo).not.toHaveBeenCalled();
  });

  it('rejects sizeUsd = NaN before MWA signing', async () => {
    const { result } = renderHook(() => useTrade());
    let res: any;
    await act(async () => {
      res = await result.current.submitTrade({
        slabAddress: SLAB_ADDR.toBase58(),
        userIdx: 0,
        sizeUsd: NaN,
        direction: 'long',
      });
    });

    expect(res).toBeNull();
    expect(result.current.error).toMatch(/invalid trade size/i);
    expect(mockSignAndSend).not.toHaveBeenCalled();
    expect(mockGetAccountInfo).not.toHaveBeenCalled();
  });

  it('rejects sizeUsd = Infinity before MWA signing', async () => {
    const { result } = renderHook(() => useTrade());
    let res: any;
    await act(async () => {
      res = await result.current.submitTrade({
        slabAddress: SLAB_ADDR.toBase58(),
        userIdx: 0,
        sizeUsd: Infinity,
        direction: 'long',
      });
    });

    expect(res).toBeNull();
    expect(result.current.error).toMatch(/invalid trade size/i);
    expect(mockSignAndSend).not.toHaveBeenCalled();
    expect(mockGetAccountInfo).not.toHaveBeenCalled();
  });

  it('rejects sizeUsd = -Infinity before MWA signing', async () => {
    const { result } = renderHook(() => useTrade());
    let res: any;
    await act(async () => {
      res = await result.current.submitTrade({
        slabAddress: SLAB_ADDR.toBase58(),
        userIdx: 0,
        sizeUsd: -Infinity,
        direction: 'short',
      });
    });

    expect(res).toBeNull();
    expect(result.current.error).toMatch(/invalid trade size/i);
    expect(mockSignAndSend).not.toHaveBeenCalled();
    expect(mockGetAccountInfo).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// HIGH-1 — sizeUsd float→BigInt precision
// ─────────────────────────────────────────────────────────────────────────

describe('HIGH-1: sizeUsd → sizeE6 precision', () => {
  it('100.123456 USD → 100_123_456 e6 (no rounding error)', async () => {
    const slabData = buildSlabData({});
    mockGetAccountInfo.mockResolvedValueOnce(makeSlabInfo(slabData));

    const { result } = renderHook(() => useTrade());
    await act(async () => {
      await result.current.submitTrade({
        slabAddress: SLAB_ADDR.toBase58(),
        userIdx: 0,
        sizeUsd: 100.123456,
        direction: 'long',
      });
    });

    expect(mockSignAndSend).toHaveBeenCalledTimes(1);
    const txBytes: Uint8Array = mockSignAndSend.mock.calls[0][0][0];
    // sizeE6 is i128 LE; for positive long: lo=100_123_456, hi=0
    const expected = BigInt(100_123_456);
    const dv = new DataView(txBytes.buffer, txBytes.byteOffset, txBytes.byteLength);
    let found = false;
    for (let i = 0; i <= txBytes.length - 16; i++) {
      const lo = dv.getBigUint64(i, true);
      const hi = dv.getBigUint64(i + 8, true);
      if (lo === expected && hi === 0n) { found = true; break; }
    }
    expect(found).toBe(true);
  });

  it('1234.000001 USD → 1_234_000_001 e6 (no rounding error)', async () => {
    const slabData = buildSlabData({});
    mockGetAccountInfo.mockResolvedValueOnce(makeSlabInfo(slabData));

    const { result } = renderHook(() => useTrade());
    await act(async () => {
      await result.current.submitTrade({
        slabAddress: SLAB_ADDR.toBase58(),
        userIdx: 0,
        sizeUsd: 1234.000001,
        direction: 'long',
      });
    });

    expect(mockSignAndSend).toHaveBeenCalledTimes(1);
    const txBytes: Uint8Array = mockSignAndSend.mock.calls[0][0][0];
    const expected = BigInt(1_234_000_001);
    const dv = new DataView(txBytes.buffer, txBytes.byteOffset, txBytes.byteLength);
    let found = false;
    for (let i = 0; i <= txBytes.length - 16; i++) {
      const lo = dv.getBigUint64(i, true);
      const hi = dv.getBigUint64(i + 8, true);
      if (lo === expected && hi === 0n) { found = true; break; }
    }
    expect(found).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// MED-5 — on-chain owner check
// ─────────────────────────────────────────────────────────────────────────

describe('MED-5: slab_address on-chain owner check', () => {
  it('rejects trade when slab.owner is not a trusted program', async () => {
    const maliciousOwner = new PublicKey(new Uint8Array(32).fill(0xba));
    const slabData = buildSlabData({});
    mockGetAccountInfo.mockResolvedValueOnce(makeSlabInfo(slabData, maliciousOwner));

    const { result } = renderHook(() => useTrade());
    let res: any;
    await act(async () => {
      res = await result.current.submitTrade({
        slabAddress: SLAB_ADDR.toBase58(),
        userIdx: 0,
        sizeUsd: 100,
        direction: 'long',
      });
    });

    expect(res).toBeNull();
    expect(result.current.error).toMatch(/untrusted program/i);
    expect(mockSignAndSend).not.toHaveBeenCalled();
  });

  it('rejects when slab.owner is trusted but embedded programId is not', async () => {
    const fakeEmbeddedId = new PublicKey(new Uint8Array(32).fill(0xfe));
    const slabData = buildSlabData({ programId: fakeEmbeddedId });
    mockGetAccountInfo.mockResolvedValueOnce(makeSlabInfo(slabData, TRUSTED_PROGRAM_ID));

    const { result } = renderHook(() => useTrade());
    let res: any;
    await act(async () => {
      res = await result.current.submitTrade({
        slabAddress: SLAB_ADDR.toBase58(),
        userIdx: 0,
        sizeUsd: 100,
        direction: 'long',
      });
    });

    expect(res).toBeNull();
    expect(result.current.error).toMatch(/untrusted program/i);
    expect(mockSignAndSend).not.toHaveBeenCalled();
  });

  it('allows trade when both slab.owner and embedded programId are trusted', async () => {
    const slabData = buildSlabData({});
    mockGetAccountInfo.mockResolvedValueOnce(makeSlabInfo(slabData, TRUSTED_PROGRAM_ID));

    const { result } = renderHook(() => useTrade());
    let res: any;
    await act(async () => {
      res = await result.current.submitTrade({
        slabAddress: SLAB_ADDR.toBase58(),
        userIdx: 0,
        sizeUsd: 100,
        direction: 'long',
      });
    });

    expect(mockSignAndSend).toHaveBeenCalledTimes(1);
    expect(res).toEqual({ signature: 'trade-sig-xyz999' });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Functional baseline
// ─────────────────────────────────────────────────────────────────────────

describe('functional baseline', () => {
  it('returns null + error when slab not found on-chain', async () => {
    mockGetAccountInfo.mockResolvedValueOnce(null);
    const { result } = renderHook(() => useTrade());
    let res: any;
    await act(async () => {
      res = await result.current.submitTrade({
        slabAddress: SLAB_ADDR.toBase58(),
        userIdx: 0,
        sizeUsd: 100,
        direction: 'long',
      });
    });
    expect(res).toBeNull();
    expect(result.current.error).toMatch(/market not found/i);
  });
});
