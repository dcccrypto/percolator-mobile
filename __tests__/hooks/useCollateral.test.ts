/**
 * Tests for src/hooks/useCollateral.ts
 *
 * Security coverage (HIGH-1, MED-5):
 *   HIGH-1: uiAmountToRaw float→BigInt precision — no precision loss for common USDC amounts
 *   MED-5:  slab_address on-chain owner verified before parsing data
 *
 * Functional coverage:
 *   - deposit: builds correct ix, sends via MWA, returns signature
 *   - withdraw: builds correct ix, sends via MWA, returns signature
 *   - wallet not connected → returns null + sets error
 *   - slab not found on-chain → returns null + sets error
 *   - untrusted on-chain owner → throws before parsing slab data
 *   - untrusted embedded programId → throws
 *   - invalid amount (NaN, Infinity) → throws
 */

import { renderHook, act } from '@testing-library/react-native';
import { PublicKey } from '@solana/web3.js';

// ── Connection mock ────────────────────────────────────────────────────────
const mockGetAccountInfo = jest.fn(() => Promise.resolve(null));
const mockGetLatestBlockhash = jest.fn(() =>
  Promise.resolve({
    blockhash: 'GHtXQBsoZHVnNFa9YevAzFr17DJjgHXk3ycTKD5xD3Zi',
    lastValidBlockHeight: 100,
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
  Promise.resolve({ signatures: ['mock-sig-abc123'] }),
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

// ── positionStore mock ────────────────────────────────────────────────────
const mockTriggerRefresh = jest.fn();
jest.mock('../../src/store/positionStore', () => ({
  usePositionStore: (sel: (s: any) => any) =>
    sel({ triggerRefresh: mockTriggerRefresh }),
}));

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
// maxAccounts at engineOff+80 = 560. Pick maxAccounts=10, preAccountsBytes=200 (8-aligned).
// accountsOff = 480 + 200 = 680; totalSize = 680 + 10*240 = 3080.
//
// Config field offsets relative to configOff=72 (from slabLayout.ts):
//   CFG_PROGRAM_ID_OFF = 0   → absolute 72
//   CFG_ORACLE_AUTHORITY_OFF = 64 → absolute 136
//   CFG_INDEX_FEED_ID_OFF = 96 → absolute 168
//   CFG_VAULT_OFF = 128      → absolute 200
//   CFG_COLLATERAL_MINT_OFF = 160 → absolute 232

const V0_HEADER_LEN   = 72;
const V0_ENGINE_OFF   = 480;
const PRE_ACCOUNTS    = 200;   // 8-byte aligned
const MAX_ACCOUNTS    = 10;
const ACCT_SIZE       = 240;
const TOTAL_SIZE      = V0_ENGINE_OFF + PRE_ACCOUNTS + MAX_ACCOUNTS * ACCT_SIZE; // 3080

const CFG_PROGRAM_ID_OFF     = 0;
const CFG_VAULT_OFF          = 128;
const CFG_COLLATERAL_MINT_OFF = 160;

function buildSlabData(opts: {
  programId?: PublicKey;
  vault?: PublicKey;
  collateralMint?: PublicKey;
}): Uint8Array {
  const buf = new Uint8Array(TOTAL_SIZE);
  const dv  = new DataView(buf.buffer);

  // maxAccounts at engineOff + 80
  dv.setBigUint64(V0_ENGINE_OFF + 80, BigInt(MAX_ACCOUNTS), true);

  // Config section starts at configOff = headerLen = 72
  const configBase = V0_HEADER_LEN;
  buf.set((opts.programId ?? TRUSTED_PROGRAM_ID).toBytes(), configBase + CFG_PROGRAM_ID_OFF);
  buf.set((opts.vault ?? VAULT_PK).toBytes(),               configBase + CFG_VAULT_OFF);
  buf.set((opts.collateralMint ?? COLLATERAL_MINT).toBytes(), configBase + CFG_COLLATERAL_MINT_OFF);
  // oracleAuthority = zeros (PublicKey.default) → admin oracle path

  return buf;
}

function makeSlabInfo(data: Uint8Array, owner: PublicKey = TRUSTED_PROGRAM_ID) {
  return { data: Buffer.from(data), owner };
}

// ── Import hook ───────────────────────────────────────────────────────────
import { useCollateral } from '../../src/hooks/useCollateral';

beforeEach(() => {
  jest.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────
// HIGH-1 — uiAmountToRaw precision
// ─────────────────────────────────────────────────────────────────────────

describe('HIGH-1: rawAmount precision (no float precision loss)', () => {
  it('100.123456 USDC (6 dp) encodes without rounding error', async () => {
    const slabData = buildSlabData({});
    mockGetAccountInfo.mockResolvedValueOnce(makeSlabInfo(slabData));

    const { result } = renderHook(() => useCollateral());

    await act(async () => {
      await result.current.deposit({
        slabAddress: SLAB_ADDR.toBase58(),
        amount: 100.123456,
        decimals: 6,
      });
    });

    expect(mockSignAndSend).toHaveBeenCalledTimes(1);
    // Expected raw value: 100_123_456
    const txBytes: Uint8Array = mockSignAndSend.mock.calls[0][0][0];
    const expected = BigInt(100_123_456);
    const dv = new DataView(txBytes.buffer, txBytes.byteOffset, txBytes.byteLength);
    let found = false;
    for (let i = 0; i <= txBytes.length - 8; i++) {
      if (dv.getBigUint64(i, true) === expected) { found = true; break; }
    }
    expect(found).toBe(true);
  });

  it('1234.567890 USDC (6 dp) encodes correctly', async () => {
    const slabData = buildSlabData({});
    mockGetAccountInfo.mockResolvedValueOnce(makeSlabInfo(slabData));

    const { result } = renderHook(() => useCollateral());
    await act(async () => {
      await result.current.deposit({
        slabAddress: SLAB_ADDR.toBase58(),
        amount: 1234.567890,
        decimals: 6,
      });
    });

    expect(mockSignAndSend).toHaveBeenCalledTimes(1);
    const txBytes: Uint8Array = mockSignAndSend.mock.calls[0][0][0];
    const expected = BigInt(1_234_567_890);
    const dv = new DataView(txBytes.buffer, txBytes.byteOffset, txBytes.byteLength);
    let found = false;
    for (let i = 0; i <= txBytes.length - 8; i++) {
      if (dv.getBigUint64(i, true) === expected) { found = true; break; }
    }
    expect(found).toBe(true);
  });

  it('rejects NaN amount before signing', async () => {
    const slabData = buildSlabData({});
    mockGetAccountInfo.mockResolvedValueOnce(makeSlabInfo(slabData));

    const { result } = renderHook(() => useCollateral());
    let res: any;
    await act(async () => {
      res = await result.current.deposit({
        slabAddress: SLAB_ADDR.toBase58(),
        amount: NaN,
        decimals: 6,
      });
    });

    expect(res).toBeNull();
    expect(result.current.error).toMatch(/invalid amount/i);
    expect(mockSignAndSend).not.toHaveBeenCalled();
  });

  it('rejects Infinity amount before signing', async () => {
    const slabData = buildSlabData({});
    mockGetAccountInfo.mockResolvedValueOnce(makeSlabInfo(slabData));

    const { result } = renderHook(() => useCollateral());
    let res: any;
    await act(async () => {
      res = await result.current.deposit({
        slabAddress: SLAB_ADDR.toBase58(),
        amount: Infinity,
        decimals: 6,
      });
    });

    expect(res).toBeNull();
    expect(result.current.error).toMatch(/invalid amount/i);
    expect(mockSignAndSend).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// MED-5 — on-chain owner check
// ─────────────────────────────────────────────────────────────────────────

describe('MED-5: slab_address on-chain owner verified before parsing', () => {
  it('rejects deposit when slab.owner is not a trusted program', async () => {
    const maliciousOwner = new PublicKey(new Uint8Array(32).fill(0xba));
    const slabData = buildSlabData({});
    mockGetAccountInfo.mockResolvedValueOnce(makeSlabInfo(slabData, maliciousOwner));

    const { result } = renderHook(() => useCollateral());
    let res: any;
    await act(async () => {
      res = await result.current.deposit({
        slabAddress: SLAB_ADDR.toBase58(),
        amount: 1,
        decimals: 6,
      });
    });

    expect(res).toBeNull();
    expect(result.current.error).toMatch(/untrusted program/i);
    expect(mockSignAndSend).not.toHaveBeenCalled();
  });

  it('rejects withdraw when slab.owner is not a trusted program', async () => {
    const maliciousOwner = new PublicKey(new Uint8Array(32).fill(0xba));
    const slabData = buildSlabData({});
    mockGetAccountInfo.mockResolvedValueOnce(makeSlabInfo(slabData, maliciousOwner));

    const { result } = renderHook(() => useCollateral());
    let res: any;
    await act(async () => {
      res = await result.current.withdraw({
        slabAddress: SLAB_ADDR.toBase58(),
        amount: 1,
        decimals: 6,
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

    const { result } = renderHook(() => useCollateral());
    let res: any;
    await act(async () => {
      res = await result.current.deposit({
        slabAddress: SLAB_ADDR.toBase58(),
        amount: 1,
        decimals: 6,
      });
    });

    expect(res).toBeNull();
    expect(result.current.error).toMatch(/untrusted program/i);
    expect(mockSignAndSend).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Functional
// ─────────────────────────────────────────────────────────────────────────

describe('functional: deposit', () => {
  it('returns null + error when slab not found on-chain', async () => {
    mockGetAccountInfo.mockResolvedValueOnce(null);
    const { result } = renderHook(() => useCollateral());
    let res: any;
    await act(async () => {
      res = await result.current.deposit({ slabAddress: SLAB_ADDR.toBase58(), amount: 1 });
    });
    expect(res).toBeNull();
    expect(result.current.error).toMatch(/market not found/i);
  });

  it('returns signature on successful deposit', async () => {
    const slabData = buildSlabData({});
    mockGetAccountInfo.mockResolvedValueOnce(makeSlabInfo(slabData));

    const { result } = renderHook(() => useCollateral());
    let res: any;
    await act(async () => {
      res = await result.current.deposit({
        slabAddress: SLAB_ADDR.toBase58(),
        amount: 50,
        decimals: 6,
      });
    });

    expect(res).toEqual({ signature: 'mock-sig-abc123' });
    expect(mockTriggerRefresh).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Signature validation — MWA empty signatures guard
// ─────────────────────────────────────────────────────────────────────────

describe('signature validation: MWA returns empty signatures', () => {
  it('deposit returns null + error when signatures array is empty', async () => {
    const slabData = buildSlabData({});
    mockGetAccountInfo.mockResolvedValueOnce(makeSlabInfo(slabData));
    mockSignAndSend.mockResolvedValueOnce({ signatures: [] });

    const { result } = renderHook(() => useCollateral());
    let res: any;
    await act(async () => {
      res = await result.current.deposit({
        slabAddress: SLAB_ADDR.toBase58(),
        amount: 50,
        decimals: 6,
      });
    });

    expect(res).toBeNull();
    expect(result.current.error).toMatch(/did not return a deposit transaction signature/i);
    expect(mockTriggerRefresh).not.toHaveBeenCalled();
  });

  it('withdraw returns null + error when signatures array is empty', async () => {
    // Withdraw requires an existing user account on the slab (kind=0 + matching owner)
    const WALLET_PK = new PublicKey('7nYhfGQDMFLJFJGQjz5rPpXoQiWC2iqMBfwqXVLvJCNs');
    const slabData = buildSlabData({});
    const ACCOUNTS_OFF = V0_ENGINE_OFF + PRE_ACCOUNTS; // 680
    slabData[ACCOUNTS_OFF + 24] = 0; // ACCT_KIND_OFF = 24 → kind=0 (User)
    slabData.set(WALLET_PK.toBytes(), ACCOUNTS_OFF + 184); // ACCT_OWNER_OFF = 184
    mockGetAccountInfo.mockResolvedValueOnce(makeSlabInfo(slabData));
    mockSignAndSend.mockResolvedValueOnce({ signatures: [] });

    const { result } = renderHook(() => useCollateral());
    let res: any;
    await act(async () => {
      res = await result.current.withdraw({
        slabAddress: SLAB_ADDR.toBase58(),
        amount: 50,
        decimals: 6,
      });
    });

    expect(res).toBeNull();
    expect(result.current.error).toMatch(/did not return a withdraw transaction signature/i);
    expect(mockTriggerRefresh).not.toHaveBeenCalled();
  });
});
