/**
 * Tests for src/hooks/useInsuranceLP.ts
 *
 * Covers:
 *   - depositInsuranceLP: builds correct ix, sends via MWA, returns signature
 *   - withdrawInsuranceLP: builds correct ix, sends via MWA, returns signature
 *   - wallet not connected → returns null + sets error
 *   - slab not found on-chain → returns null + sets error
 *   - unknown slab layout → returns null + sets error
 *   - creates collateral ATA + LP ATA when missing
 *   - skips ATA creation when accounts already exist
 */

import { renderHook, act } from '@testing-library/react-native';
import { PublicKey, Transaction } from '@solana/web3.js';

// ── Mock lib/solana so we control the connection singleton ─────────────────
// jest.mock factory is hoisted, so use jest.fn() inside the factory and
// re-expose the mocks via module.__getMock() for per-test control.
const mockGetAccountInfo = jest.fn(() => Promise.resolve(null));
const mockGetLatestBlockhash = jest.fn(() =>
  Promise.resolve({
    blockhash: 'GHtXQBsoZHVnNFa9YevAzFr17DJjgHXk3ycTKD5xD3Zi',
    lastValidBlockHeight: 100,
  }),
);
jest.mock('../../src/lib/solana', () => {
  // These are re-assigned by the outer scope mocks after hoisting,
  // but we need the factory to reference module-level jest.fn() instances.
  // Use a shared object so the connection reference is stable.
  return {
    connection: {
      getAccountInfo: (...args: any[]) => (global as any).__mockGetAccountInfo?.(...args) ?? Promise.resolve(null),
      getLatestBlockhash: (...args: any[]) => (global as any).__mockGetLatestBlockhash?.(...args) ?? Promise.resolve({ blockhash: 'test', lastValidBlockHeight: 100 }),
    },
  };
});

// ── Constants ──────────────────────────────────────────────────────────────

const PROGRAM_ID = new PublicKey('GM8zjJ8LTBMv9xEsverh6H6wLyevgMHEJXcEzyY3rY24');
const VAULT_PK   = new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin');
const COLLATERAL_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

// ── Mock slab data builder ─────────────────────────────────────────────────
//
// V0 layout: engineOff=480, acctSize=240.
// detectSlabLayout reads maxAccounts (u64 LE) at engineOff+80 = 560.
// Sanity: maxAccounts in [1,10000].
// preAccountsBytes = data.length - engineOff - maxAccounts*acctSize  (must be 100-20000)
// accountsOff = engineOff + ceil(preAccountsBytes/8)*8
// expectedEnd = accountsOff + maxAccounts*acctSize must equal data.length.
//
// Pick maxAccounts=10, preAccountsBytes=200 (8-byte aligned):
//   data.length = 480 + 200 + 10*240 = 3080
//   accountsOff = 480 + ceil(200/8)*8 = 480+200 = 680
//   expectedEnd = 680 + 2400 = 3080 ✓

const V0_ENGINE_OFF = 480;
const V0_ACCT_SIZE  = 240;
const MAX_ACCOUNTS  = 10;
const PRE_ACCOUNTS  = 200; // must be 8-byte aligned
const SLAB_LEN      = V0_ENGINE_OFF + PRE_ACCOUNTS + MAX_ACCOUNTS * V0_ACCT_SIZE; // 3080

function makeMockSlabData(): Uint8Array {
  const buf = new Uint8Array(SLAB_LEN);

  // Write config section (configOff = headerLen = 72 for V0)
  const CFG_OFF = 72;
  // programId at CFG_OFF+0
  buf.set(PROGRAM_ID.toBytes(), CFG_OFF + 0);
  // vault at CFG_OFF+128
  buf.set(VAULT_PK.toBytes(), CFG_OFF + 128);
  // collateralMint at CFG_OFF+160
  buf.set(COLLATERAL_MINT.toBytes(), CFG_OFF + 160);

  // Write maxAccounts (u64 LE) at engineOff+80 = 560
  const MAX_ACCOUNTS_OFF = V0_ENGINE_OFF + 80;
  const dv = new DataView(buf.buffer, MAX_ACCOUNTS_OFF, 8);
  dv.setBigUint64(0, BigInt(MAX_ACCOUNTS), true);

  return buf;
}

// ── Wallet store helpers ───────────────────────────────────────────────────

const { useWalletStore } = require('../../src/store/walletStore');

function setupConnectedWallet(): PublicKey {
  const store = useWalletStore();
  const pk = new PublicKey('5xot9PVkphiX2adznghwrAuxGs2zeWisNSxMW6hU6Hkj');
  store.connected = true;
  store.publicKey = pk;
  return pk;
}

function setupDisconnectedWallet() {
  const store = useWalletStore();
  store.connected = false;
  store.publicKey = null;
}

const mockTransact = require('@solana-mobile/mobile-wallet-adapter-protocol').transact;

// ── Hook under test ────────────────────────────────────────────────────────

import { useInsuranceLP } from '../../src/hooks/useInsuranceLP';

// ── Tests ──────────────────────────────────────────────────────────────────

describe('useInsuranceLP', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    // Wire global shims so the jest.mock factory delegates to our jest.fn()
    (global as any).__mockGetAccountInfo = mockGetAccountInfo;
    (global as any).__mockGetLatestBlockhash = mockGetLatestBlockhash;
    // Reset defaults
    mockGetAccountInfo.mockResolvedValue(null);
    mockGetLatestBlockhash.mockResolvedValue({
      blockhash: 'GHtXQBsoZHVnNFa9YevAzFr17DJjgHXk3ycTKD5xD3Zi',
      lastValidBlockHeight: 100,
    });
  });

  afterEach(() => {
    setupDisconnectedWallet();
  });

  // ── depositInsuranceLP ─────────────────────────────────────────────────

  describe('depositInsuranceLP', () => {
    it('returns null and sets error when wallet not connected', async () => {
      setupDisconnectedWallet();
      const { result } = renderHook(() => useInsuranceLP());

      let returnVal: any;
      await act(async () => {
        returnVal = await result.current.depositInsuranceLP({
          slabAddress: PROGRAM_ID.toBase58(),
          amountBaseUnits: 1_000_000n,
        });
      });

      expect(returnVal).toBeNull();
      expect(result.current.error).toMatch(/wallet not connected/i);
      expect(result.current.submitting).toBe(false);
    });

    it('returns null and sets error when slab not found on-chain', async () => {
      setupConnectedWallet();
      // Connection mock returns null by default (slab missing)
      const { result } = renderHook(() => useInsuranceLP());

      let returnVal: any;
      await act(async () => {
        returnVal = await result.current.depositInsuranceLP({
          slabAddress: PROGRAM_ID.toBase58(),
          amountBaseUnits: 1_000_000n,
        });
      });

      expect(returnVal).toBeNull();
      expect(result.current.error).toMatch(/market not found/i);
    });

    it('returns null and sets error for unrecognised slab layout (tiny buffer)', async () => {
      setupConnectedWallet();
      mockGetAccountInfo.mockResolvedValueOnce({
        data: Buffer.alloc(10),
        owner: PROGRAM_ID,
      });

      const { result } = renderHook(() => useInsuranceLP());

      let returnVal: any;
      await act(async () => {
        returnVal = await result.current.depositInsuranceLP({
          slabAddress: PROGRAM_ID.toBase58(),
          amountBaseUnits: 1_000_000n,
        });
      });

      expect(returnVal).toBeNull();
      expect(result.current.error).toMatch(/unrecognised slab layout/i);
    });

    it('sends deposit tx and returns signature (ATAs missing → creates both)', async () => {
      setupConnectedWallet();
      const slabData = makeMockSlabData();

      mockGetAccountInfo
        .mockResolvedValueOnce({ data: Buffer.from(slabData), owner: PROGRAM_ID }) // slab
        .mockResolvedValueOnce(null) // collateral ATA missing
        .mockResolvedValueOnce(null); // LP ATA missing

      const { result } = renderHook(() => useInsuranceLP());

      let returnVal: any;
      await act(async () => {
        returnVal = await result.current.depositInsuranceLP({
          slabAddress: PROGRAM_ID.toBase58(),
          amountBaseUnits: 5_000_000n,
        });
      });

      expect(mockTransact).toHaveBeenCalled();
      expect(returnVal).not.toBeNull();
      expect(returnVal.signature).toBeTruthy(); // MWA mock returns Uint8Array; real returns string
      expect(result.current.error).toBeNull();
      expect(result.current.submitting).toBe(false);
    });

    it('sends deposit tx and returns signature (ATAs already exist → no ATA creates)', async () => {
      setupConnectedWallet();
      const slabData = makeMockSlabData();
      const existingAta = { data: Buffer.alloc(165), owner: TOKEN_PROGRAM_ID };

      mockGetAccountInfo
        .mockResolvedValueOnce({ data: Buffer.from(slabData), owner: PROGRAM_ID }) // slab
        .mockResolvedValueOnce(existingAta) // collateral ATA exists
        .mockResolvedValueOnce(existingAta); // LP ATA exists

      const addSpy = jest.spyOn(Transaction.prototype, 'add');
      const { result } = renderHook(() => useInsuranceLP());

      await act(async () => {
        await result.current.depositInsuranceLP({
          slabAddress: PROGRAM_ID.toBase58(),
          amountBaseUnits: 1_000_000n,
        });
      });

      // Expected: ComputeBudgetLimit + ComputeBudgetPrice + DepositInsuranceLP = 3
      expect(addSpy.mock.calls.length).toBe(3);
      addSpy.mockRestore();
    });

    it('sends deposit tx with 5 instructions when both ATAs missing (ComputeBudget×2 + ATA×2 + Deposit)', async () => {
      setupConnectedWallet();
      const slabData = makeMockSlabData();

      mockGetAccountInfo
        .mockResolvedValueOnce({ data: Buffer.from(slabData), owner: PROGRAM_ID })
        .mockResolvedValueOnce(null)  // collateral ATA missing → create
        .mockResolvedValueOnce(null); // LP ATA missing → create

      const addSpy = jest.spyOn(Transaction.prototype, 'add');
      const { result } = renderHook(() => useInsuranceLP());

      await act(async () => {
        await result.current.depositInsuranceLP({
          slabAddress: PROGRAM_ID.toBase58(),
          amountBaseUnits: 1_000_000n,
        });
      });

      // Expected: ComputeBudgetLimit + ComputeBudgetPrice + createCollateralATA + createLpATA + DepositInsuranceLP = 5
      expect(addSpy.mock.calls.length).toBe(5);
      addSpy.mockRestore();
    });
  });

  // ── withdrawInsuranceLP ────────────────────────────────────────────────

  describe('withdrawInsuranceLP', () => {
    it('returns null and sets error when wallet not connected', async () => {
      setupDisconnectedWallet();
      const { result } = renderHook(() => useInsuranceLP());

      let returnVal: any;
      await act(async () => {
        returnVal = await result.current.withdrawInsuranceLP({
          slabAddress: PROGRAM_ID.toBase58(),
          lpAmountBaseUnits: 1_000_000n,
        });
      });

      expect(returnVal).toBeNull();
      expect(result.current.error).toMatch(/wallet not connected/i);
    });

    it('returns null and sets error when slab not found on-chain', async () => {
      setupConnectedWallet();
      // default: getAccountInfo returns null
      const { result } = renderHook(() => useInsuranceLP());

      let returnVal: any;
      await act(async () => {
        returnVal = await result.current.withdrawInsuranceLP({
          slabAddress: PROGRAM_ID.toBase58(),
          lpAmountBaseUnits: 1_000_000n,
        });
      });

      expect(returnVal).toBeNull();
      expect(result.current.error).toMatch(/market not found/i);
    });

    it('sends withdraw tx and returns signature', async () => {
      setupConnectedWallet();
      const slabData = makeMockSlabData();
      const existingAta = { lamports: 1 };

      // getAccountInfo calls: slab, collateralAta, lpAta (all exist for a valid withdraw)
      mockGetAccountInfo
        .mockResolvedValueOnce({ data: Buffer.from(slabData), owner: PROGRAM_ID })
        .mockResolvedValueOnce(existingAta)  // collateral ATA exists
        .mockResolvedValueOnce(existingAta); // LP ATA exists

      const { result } = renderHook(() => useInsuranceLP());

      let returnVal: any;
      await act(async () => {
        returnVal = await result.current.withdrawInsuranceLP({
          slabAddress: PROGRAM_ID.toBase58(),
          lpAmountBaseUnits: 2_000_000n,
        });
      });

      expect(mockTransact).toHaveBeenCalled();
      expect(returnVal).not.toBeNull();
      expect(returnVal.signature).toBeTruthy(); // MWA mock returns Uint8Array; real returns string
      expect(result.current.error).toBeNull();
      expect(result.current.submitting).toBe(false);
    });

    it('withdraw tx has exactly 3 instructions (ComputeBudget×2 + WithdrawInsuranceLP) when both ATAs exist', async () => {
      setupConnectedWallet();
      const slabData = makeMockSlabData();
      const existingAta = { lamports: 1 };

      // Both ATAs exist → no extra ATA create ix, just 2 CU budget + 1 withdraw = 3 total
      mockGetAccountInfo
        .mockResolvedValueOnce({ data: Buffer.from(slabData), owner: PROGRAM_ID })
        .mockResolvedValueOnce(existingAta)  // collateral ATA
        .mockResolvedValueOnce(existingAta); // LP ATA

      const addSpy = jest.spyOn(Transaction.prototype, 'add');
      const { result } = renderHook(() => useInsuranceLP());

      await act(async () => {
        await result.current.withdrawInsuranceLP({
          slabAddress: PROGRAM_ID.toBase58(),
          lpAmountBaseUnits: 1_000_000n,
        });
      });

      expect(addSpy.mock.calls.length).toBe(3);
      addSpy.mockRestore();
    });
  });

  // ── submitting state ───────────────────────────────────────────────────

  describe('submitting state', () => {
    it('is false initially', () => {
      const { result } = renderHook(() => useInsuranceLP());
      expect(result.current.submitting).toBe(false);
    });

    it('error is null initially', () => {
      const { result } = renderHook(() => useInsuranceLP());
      expect(result.current.error).toBeNull();
    });
  });

  // ── Security: slab owner validation ───────────────────────────────────────

  describe('slab owner / program validation', () => {
    it('deposit rejects slab with untrusted programId', async () => {
      setupConnectedWallet();
      const slabData = makeMockSlabData();

      // Overwrite programId bytes in config with a random unknown key
      const UNKNOWN_PROGRAM = new PublicKey('So11111111111111111111111111111111111111112');
      slabData.set(UNKNOWN_PROGRAM.toBytes(), 72 + 0); // CFG_OFF + CFG_PROGRAM_ID_OFF

      mockGetAccountInfo.mockResolvedValueOnce({
        data: Buffer.from(slabData),
        owner: UNKNOWN_PROGRAM,
      });

      const { result } = renderHook(() => useInsuranceLP());
      let returnVal: any;
      await act(async () => {
        returnVal = await result.current.depositInsuranceLP({
          slabAddress: UNKNOWN_PROGRAM.toBase58(),
          amountBaseUnits: 1_000_000n,
        });
      });

      expect(returnVal).toBeNull();
      expect(result.current.error).toMatch(/untrusted program/i);
    });

    it('withdraw rejects slab with untrusted programId', async () => {
      setupConnectedWallet();
      const slabData = makeMockSlabData();

      const UNKNOWN_PROGRAM = new PublicKey('So11111111111111111111111111111111111111112');
      slabData.set(UNKNOWN_PROGRAM.toBytes(), 72 + 0);

      mockGetAccountInfo.mockResolvedValueOnce({
        data: Buffer.from(slabData),
        owner: UNKNOWN_PROGRAM,
      });

      const { result } = renderHook(() => useInsuranceLP());
      let returnVal: any;
      await act(async () => {
        returnVal = await result.current.withdrawInsuranceLP({
          slabAddress: UNKNOWN_PROGRAM.toBase58(),
          lpAmountBaseUnits: 1_000_000n,
        });
      });

      expect(returnVal).toBeNull();
      expect(result.current.error).toMatch(/untrusted program/i);
    });
  });

  // ── Security: amount overflow guard ───────────────────────────────────────

  describe('amount overflow guard', () => {
    it('deposit rejects amount exceeding MAX_AMOUNT_BASE_UNITS', async () => {
      setupConnectedWallet();
      const slabData = makeMockSlabData();
      mockGetAccountInfo.mockResolvedValueOnce({
        data: Buffer.from(slabData),
        owner: PROGRAM_ID,
      });

      const { result } = renderHook(() => useInsuranceLP());
      let returnVal: any;
      await act(async () => {
        returnVal = await result.current.depositInsuranceLP({
          slabAddress: PROGRAM_ID.toBase58(),
          amountBaseUnits: BigInt('9999999999999999999'), // way over 10^15
        });
      });

      expect(returnVal).toBeNull();
      expect(result.current.error).toMatch(/exceeds maximum/i);
    });

    it('withdraw rejects amount exceeding MAX_AMOUNT_BASE_UNITS', async () => {
      setupConnectedWallet();
      const slabData = makeMockSlabData();
      mockGetAccountInfo.mockResolvedValueOnce({
        data: Buffer.from(slabData),
        owner: PROGRAM_ID,
      });

      const { result } = renderHook(() => useInsuranceLP());
      let returnVal: any;
      await act(async () => {
        returnVal = await result.current.withdrawInsuranceLP({
          slabAddress: PROGRAM_ID.toBase58(),
          lpAmountBaseUnits: BigInt('9999999999999999999'),
        });
      });

      expect(returnVal).toBeNull();
      expect(result.current.error).toMatch(/exceeds maximum/i);
    });
  });

  // ── Security: withdraw LP ATA preflight ───────────────────────────────────

  describe('withdraw LP ATA preflight', () => {
    it('withdraw fails with descriptive error when LP ATA is missing', async () => {
      setupConnectedWallet();
      const slabData = makeMockSlabData();

      // getAccountInfo calls (in order): slab, collateralAta, lpAta
      mockGetAccountInfo
        .mockResolvedValueOnce({ data: Buffer.from(slabData), owner: PROGRAM_ID }) // slab
        .mockResolvedValueOnce({ lamports: 1 })  // collateral ATA exists
        .mockResolvedValueOnce(null);             // LP ATA missing

      const { result } = renderHook(() => useInsuranceLP());
      let returnVal: any;
      await act(async () => {
        returnVal = await result.current.withdrawInsuranceLP({
          slabAddress: PROGRAM_ID.toBase58(),
          lpAmountBaseUnits: 1_000_000n,
        });
      });

      expect(returnVal).toBeNull();
      expect(result.current.error).toMatch(/lp token account not found/i);
    });
  });
});
