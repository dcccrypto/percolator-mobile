/**
 * Tests for src/hooks/useStake.ts
 *
 * Covers:
 *   - stakeDeposit: wallet not connected → null + error
 *   - stakeDeposit: slab not found → null + error
 *   - stakeDeposit: pool not initialised → null + error
 *   - stakeDeposit: pool owner mismatch → null + error
 *   - stakeDeposit: amount validation (zero, over MAX) → null + error
 *   - stakeDeposit: happy path — creates ATAs when missing, sends via MWA
 *   - stakeDeposit: happy path — skips ATA creation when accounts exist
 *   - stakeWithdraw: wallet not connected → null + error
 *   - stakeWithdraw: LP ATA missing → null + error (deposit first)
 *   - stakeWithdraw: happy path — sends via MWA, returns signature
 */

import { renderHook, act } from '@testing-library/react-native';
import { PublicKey } from '@solana/web3.js';

// ── Mock lib/solana ─────────────────────────────────────────────────────────
const mockGetAccountInfo = jest.fn(() => Promise.resolve(null));
const mockGetLatestBlockhash = jest.fn(() =>
  Promise.resolve({
    blockhash: 'GHtXQBsoZHVnNFa9YevAzFr17DJjgHXk3ycTKD5xD3Zi',
    lastValidBlockHeight: 100,
  }),
);
jest.mock('../../src/lib/solana', () => ({
  connection: {
    getAccountInfo: (...args: any[]) =>
      (global as any).__mockGetAccountInfo?.(...args) ?? Promise.resolve(null),
    getLatestBlockhash: (...args: any[]) =>
      (global as any).__mockGetLatestBlockhash?.(...args) ??
      Promise.resolve({ blockhash: 'test', lastValidBlockHeight: 100 }),
  },
}));

// ── Constants ───────────────────────────────────────────────────────────────
const STAKE_PROGRAM_ID = new PublicKey('6aJb1F9CDCVWCNYFwj8aQsVb696YnW6J1FznteHq4Q6k');
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

const SLAB_PK         = new PublicKey('7MkErbg12MdHkzZzL6GzvQ6fQgZbxnT25zxKxbdrRDvr');
const COLLATERAL_MINT = new PublicKey('469vYhbWceW3qCTY7Qho8ZvwxDdjWvYebxFBsyCS4Zzm');
const LP_MINT         = new PublicKey('3Zmwb5h7iViC5ebwFjJJ8ty2CHRHYQPVrNJKnsWXcH1t');
const VAULT           = new PublicKey('2qJthtqNuo47hokFuvALds5LKw8J6sy5uqyJDv3ywqM3');

/**
 * Build a minimal stake pool account buffer.
 *
 * Stake pool layout (0-indexed):
 *   [0]      discriminant (u8)      → 0x01
 *   [1..32]  admin pubkey           → filler
 *   [33..64] slab pubkey            → filler
 *   [65..96] lp_mint pubkey
 *   [97..128] vault pubkey
 *   [129..186+] remaining fields    → zeroed
 *
 * Total minimum size: 186 bytes.
 */
function makePoolAccountData(lpMint: PublicKey, vault: PublicKey): Buffer {
  const buf = Buffer.alloc(200); // > 186 minimum
  buf[0] = 0x01; // discriminant
  // admin (bytes 1..32) and slab (bytes 33..64) left as zeros (not parsed by hook)
  lpMint.toBuffer().copy(buf, 65);
  vault.toBuffer().copy(buf, 97);
  return buf;
}

// ── Wallet store helpers ────────────────────────────────────────────────────
const { useWalletStore } = require('../../src/store/walletStore');

const USER_PK = new PublicKey('5xot9PVkphiX2adznghwrAuxGs2zeWisNSxMW6hU6Hkj');

function setupConnectedWallet(): PublicKey {
  const store = useWalletStore();
  store.connected = true;
  store.publicKey = USER_PK;
  return USER_PK;
}

function setupDisconnectedWallet() {
  const store = useWalletStore();
  store.connected = false;
  store.publicKey = null;
}

const mockTransact = require('@solana-mobile/mobile-wallet-adapter-protocol').transact;

// ── Hook under test ─────────────────────────────────────────────────────────
import { useStake } from '../../src/hooks/useStake';

// ── Tests ───────────────────────────────────────────────────────────────────

describe('useStake', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).__mockGetAccountInfo = mockGetAccountInfo;
    (global as any).__mockGetLatestBlockhash = mockGetLatestBlockhash;
    mockGetAccountInfo.mockResolvedValue(null);
    mockGetLatestBlockhash.mockResolvedValue({
      blockhash: 'GHtXQBsoZHVnNFa9YevAzFr17DJjgHXk3ycTKD5xD3Zi',
      lastValidBlockHeight: 100,
    });
  });

  afterEach(() => {
    setupDisconnectedWallet();
  });

  // ── stakeDeposit ──────────────────────────────────────────────────────────

  describe('stakeDeposit', () => {
    it('returns null and sets error when wallet not connected', async () => {
      setupDisconnectedWallet();
      const { result } = renderHook(() => useStake());

      let returnVal: any;
      await act(async () => {
        returnVal = await result.current.stakeDeposit({
          slabAddress: SLAB_PK.toBase58(),
          collateralMint: COLLATERAL_MINT.toBase58(),
          amountBaseUnits: 1_000_000n,
        });
      });

      expect(returnVal).toBeNull();
      expect(result.current.error).toMatch(/wallet not connected/i);
      expect(result.current.submitting).toBe(false);
    });

    it('returns null and sets error when slab not found on-chain', async () => {
      setupConnectedWallet();
      // getAccountInfo returns null for slab → market not found
      const { result } = renderHook(() => useStake());

      let returnVal: any;
      await act(async () => {
        returnVal = await result.current.stakeDeposit({
          slabAddress: SLAB_PK.toBase58(),
          collateralMint: COLLATERAL_MINT.toBase58(),
          amountBaseUnits: 1_000_000n,
        });
      });

      expect(returnVal).toBeNull();
      expect(result.current.error).toMatch(/market not found/i);
    });

    it('returns null and sets error when stake pool not initialised (null pool account)', async () => {
      setupConnectedWallet();
      mockGetAccountInfo
        .mockResolvedValueOnce({ data: Buffer.alloc(100), owner: STAKE_PROGRAM_ID }) // slab OK
        .mockResolvedValueOnce(null); // pool account missing

      const { result } = renderHook(() => useStake());

      let returnVal: any;
      await act(async () => {
        returnVal = await result.current.stakeDeposit({
          slabAddress: SLAB_PK.toBase58(),
          collateralMint: COLLATERAL_MINT.toBase58(),
          amountBaseUnits: 1_000_000n,
        });
      });

      expect(returnVal).toBeNull();
      expect(result.current.error).toMatch(/stake pool not initialised/i);
    });

    it('returns null and sets error when pool account too small', async () => {
      setupConnectedWallet();
      mockGetAccountInfo
        .mockResolvedValueOnce({ data: Buffer.alloc(100), owner: STAKE_PROGRAM_ID }) // slab OK
        .mockResolvedValueOnce({ data: Buffer.alloc(50), owner: STAKE_PROGRAM_ID }); // pool too small

      const { result } = renderHook(() => useStake());

      let returnVal: any;
      await act(async () => {
        returnVal = await result.current.stakeDeposit({
          slabAddress: SLAB_PK.toBase58(),
          collateralMint: COLLATERAL_MINT.toBase58(),
          amountBaseUnits: 1_000_000n,
        });
      });

      expect(returnVal).toBeNull();
      expect(result.current.error).toMatch(/stake pool not initialised/i);
    });

    it('returns null and sets error when pool account owner mismatch', async () => {
      setupConnectedWallet();
      const poolData = makePoolAccountData(LP_MINT, VAULT);
      mockGetAccountInfo
        .mockResolvedValueOnce({ data: Buffer.alloc(100), owner: STAKE_PROGRAM_ID }) // slab OK
        .mockResolvedValueOnce({ data: poolData, owner: TOKEN_PROGRAM_ID }); // wrong owner

      const { result } = renderHook(() => useStake());

      let returnVal: any;
      await act(async () => {
        returnVal = await result.current.stakeDeposit({
          slabAddress: SLAB_PK.toBase58(),
          collateralMint: COLLATERAL_MINT.toBase58(),
          amountBaseUnits: 1_000_000n,
        });
      });

      expect(returnVal).toBeNull();
      expect(result.current.error).toMatch(/owner mismatch/i);
    });

    it('returns null and sets error for zero amount', async () => {
      setupConnectedWallet();
      // Amount is validated before slab fetch — no mock needed

      const { result } = renderHook(() => useStake());

      let returnVal: any;
      await act(async () => {
        returnVal = await result.current.stakeDeposit({
          slabAddress: SLAB_PK.toBase58(),
          collateralMint: COLLATERAL_MINT.toBase58(),
          amountBaseUnits: 0n,
        });
      });

      expect(returnVal).toBeNull();
      expect(result.current.error).toMatch(/must be > 0/i);
    });

    it('returns null and sets error for amount exceeding MAX_AMOUNT_BASE_UNITS', async () => {
      setupConnectedWallet();
      // Amount is validated before slab fetch — no mock needed

      const { result } = renderHook(() => useStake());

      let returnVal: any;
      await act(async () => {
        returnVal = await result.current.stakeDeposit({
          slabAddress: SLAB_PK.toBase58(),
          collateralMint: COLLATERAL_MINT.toBase58(),
          amountBaseUnits: BigInt('1000000000000001'), // MAX + 1
        });
      });

      expect(returnVal).toBeNull();
      expect(result.current.error).toMatch(/exceeds maximum/i);
    });

    it('sends deposit tx and returns signature (ATAs missing → creates both)', async () => {
      setupConnectedWallet();
      const poolData = makePoolAccountData(LP_MINT, VAULT);

      mockGetAccountInfo
        .mockResolvedValueOnce({ data: Buffer.alloc(100), owner: STAKE_PROGRAM_ID }) // slab
        .mockResolvedValueOnce({ data: poolData, owner: STAKE_PROGRAM_ID })          // pool
        .mockResolvedValueOnce(null) // collateral ATA missing
        .mockResolvedValueOnce(null); // LP ATA missing

      const { result } = renderHook(() => useStake());

      let returnVal: any;
      await act(async () => {
        returnVal = await result.current.stakeDeposit({
          slabAddress: SLAB_PK.toBase58(),
          collateralMint: COLLATERAL_MINT.toBase58(),
          amountBaseUnits: 5_000_000n,
        });
      });

      expect(mockTransact).toHaveBeenCalled();
      expect(returnVal).not.toBeNull();
      expect(returnVal.signature).toBeTruthy();
      expect(result.current.error).toBeNull();
      expect(result.current.submitting).toBe(false);
    });

    it('sends deposit tx without ATA creates when ATAs already exist', async () => {
      setupConnectedWallet();
      const poolData = makePoolAccountData(LP_MINT, VAULT);
      const existingAta = { data: Buffer.alloc(165), owner: TOKEN_PROGRAM_ID };

      mockGetAccountInfo
        .mockResolvedValueOnce({ data: Buffer.alloc(100), owner: STAKE_PROGRAM_ID }) // slab
        .mockResolvedValueOnce({ data: poolData, owner: STAKE_PROGRAM_ID })          // pool
        .mockResolvedValueOnce(existingAta) // collateral ATA exists
        .mockResolvedValueOnce(existingAta); // LP ATA exists

      const { result } = renderHook(() => useStake());

      let returnVal: any;
      await act(async () => {
        returnVal = await result.current.stakeDeposit({
          slabAddress: SLAB_PK.toBase58(),
          collateralMint: COLLATERAL_MINT.toBase58(),
          amountBaseUnits: 1_000_000n,
        });
      });

      expect(mockTransact).toHaveBeenCalled();
      expect(returnVal).not.toBeNull();
      expect(returnVal.signature).toBeTruthy();
      expect(result.current.error).toBeNull();
    });

    it('accepts MAX_AMOUNT_BASE_UNITS exactly (boundary — at limit)', async () => {
      setupConnectedWallet();
      const poolData = makePoolAccountData(LP_MINT, VAULT);

      mockGetAccountInfo
        .mockResolvedValueOnce({ data: Buffer.alloc(100), owner: STAKE_PROGRAM_ID })
        .mockResolvedValueOnce({ data: poolData, owner: STAKE_PROGRAM_ID })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const { result } = renderHook(() => useStake());

      let returnVal: any;
      await act(async () => {
        returnVal = await result.current.stakeDeposit({
          slabAddress: SLAB_PK.toBase58(),
          collateralMint: COLLATERAL_MINT.toBase58(),
          amountBaseUnits: BigInt('1000000000000000'), // exactly MAX
        });
      });

      // Should NOT error with "exceeds maximum"
      expect(result.current.error).toBeNull();
      expect(returnVal).not.toBeNull();
    });
  });

  // ── stakeWithdraw ─────────────────────────────────────────────────────────

  describe('stakeWithdraw', () => {
    it('returns null and sets error when wallet not connected', async () => {
      setupDisconnectedWallet();
      const { result } = renderHook(() => useStake());

      let returnVal: any;
      await act(async () => {
        returnVal = await result.current.stakeWithdraw({
          slabAddress: SLAB_PK.toBase58(),
          collateralMint: COLLATERAL_MINT.toBase58(),
          lpAmountBaseUnits: 500_000n,
        });
      });

      expect(returnVal).toBeNull();
      expect(result.current.error).toMatch(/wallet not connected/i);
    });

    it('returns null and sets error when LP ATA missing (must deposit first)', async () => {
      setupConnectedWallet();
      const poolData = makePoolAccountData(LP_MINT, VAULT);

      // Flow: slab → pool → lpAta (null → throws before collAta check)
      // Only 3 calls needed — do NOT add extra mockResolvedValueOnce for collAta
      mockGetAccountInfo
        .mockResolvedValueOnce({ data: Buffer.alloc(100), owner: STAKE_PROGRAM_ID }) // slab
        .mockResolvedValueOnce({ data: poolData, owner: STAKE_PROGRAM_ID })          // pool
        .mockResolvedValueOnce(null); // LP ATA missing → throws

      const { result } = renderHook(() => useStake());

      let returnVal: any;
      await act(async () => {
        returnVal = await result.current.stakeWithdraw({
          slabAddress: SLAB_PK.toBase58(),
          collateralMint: COLLATERAL_MINT.toBase58(),
          lpAmountBaseUnits: 500_000n,
        });
      });

      expect(returnVal).toBeNull();
      expect(result.current.error).toMatch(/lp token account not found/i);
    });

    it('returns null and sets error for zero LP amount', async () => {
      setupConnectedWallet();
      // Amount is validated before slab fetch — no mock needed

      const { result } = renderHook(() => useStake());

      let returnVal: any;
      await act(async () => {
        returnVal = await result.current.stakeWithdraw({
          slabAddress: SLAB_PK.toBase58(),
          collateralMint: COLLATERAL_MINT.toBase58(),
          lpAmountBaseUnits: 0n,
        });
      });

      expect(returnVal).toBeNull();
      expect(result.current.error).toMatch(/must be > 0/i);
    });

    it('returns null and sets error for LP amount exceeding MAX', async () => {
      setupConnectedWallet();
      // Amount is validated before slab fetch — no mock needed

      const { result } = renderHook(() => useStake());

      let returnVal: any;
      await act(async () => {
        returnVal = await result.current.stakeWithdraw({
          slabAddress: SLAB_PK.toBase58(),
          collateralMint: COLLATERAL_MINT.toBase58(),
          lpAmountBaseUnits: BigInt('1000000000000001'), // MAX + 1
        });
      });

      expect(returnVal).toBeNull();
      expect(result.current.error).toMatch(/exceeds maximum/i);
    });

    it('sends withdraw tx and returns signature (LP ATA exists)', async () => {
      setupConnectedWallet();
      const poolData = makePoolAccountData(LP_MINT, VAULT);
      const existingLpAta = { data: Buffer.alloc(165), owner: TOKEN_PROGRAM_ID };
      const existingCollAta = { data: Buffer.alloc(165), owner: TOKEN_PROGRAM_ID };

      mockGetAccountInfo
        .mockResolvedValueOnce({ data: Buffer.alloc(100), owner: STAKE_PROGRAM_ID }) // slab
        .mockResolvedValueOnce({ data: poolData, owner: STAKE_PROGRAM_ID })          // pool
        .mockResolvedValueOnce(existingLpAta)  // LP ATA exists (preflight)
        .mockResolvedValueOnce(existingCollAta); // collateral ATA exists

      const { result } = renderHook(() => useStake());

      let returnVal: any;
      await act(async () => {
        returnVal = await result.current.stakeWithdraw({
          slabAddress: SLAB_PK.toBase58(),
          collateralMint: COLLATERAL_MINT.toBase58(),
          lpAmountBaseUnits: 500_000n,
        });
      });

      expect(mockTransact).toHaveBeenCalled();
      expect(returnVal).not.toBeNull();
      expect(returnVal.signature).toBeTruthy();
      expect(result.current.error).toBeNull();
      expect(result.current.submitting).toBe(false);
    });

    it('creates collateral ATA when missing on withdraw', async () => {
      setupConnectedWallet();
      const poolData = makePoolAccountData(LP_MINT, VAULT);
      const existingLpAta = { data: Buffer.alloc(165), owner: TOKEN_PROGRAM_ID };

      mockGetAccountInfo
        .mockResolvedValueOnce({ data: Buffer.alloc(100), owner: STAKE_PROGRAM_ID }) // slab
        .mockResolvedValueOnce({ data: poolData, owner: STAKE_PROGRAM_ID })          // pool
        .mockResolvedValueOnce(existingLpAta) // LP ATA exists
        .mockResolvedValueOnce(null);          // collateral ATA missing → creates it

      const { result } = renderHook(() => useStake());

      let returnVal: any;
      await act(async () => {
        returnVal = await result.current.stakeWithdraw({
          slabAddress: SLAB_PK.toBase58(),
          collateralMint: COLLATERAL_MINT.toBase58(),
          lpAmountBaseUnits: 500_000n,
        });
      });

      expect(mockTransact).toHaveBeenCalled();
      expect(returnVal).not.toBeNull();
      expect(returnVal.signature).toBeTruthy();
      expect(result.current.error).toBeNull();
    });

    it('accepts MAX_AMOUNT_BASE_UNITS exactly on withdraw (boundary — at limit)', async () => {
      setupConnectedWallet();
      const poolData = makePoolAccountData(LP_MINT, VAULT);
      const existingLpAta = { data: Buffer.alloc(165), owner: TOKEN_PROGRAM_ID };
      const existingCollAta = { data: Buffer.alloc(165), owner: TOKEN_PROGRAM_ID };

      // Flow: slab → pool → lpAta (preflight) → collAta
      mockGetAccountInfo
        .mockResolvedValueOnce({ data: Buffer.alloc(100), owner: STAKE_PROGRAM_ID }) // slab
        .mockResolvedValueOnce({ data: poolData, owner: STAKE_PROGRAM_ID })          // pool
        .mockResolvedValueOnce(existingLpAta)   // LP ATA
        .mockResolvedValueOnce(existingCollAta); // collateral ATA

      const { result } = renderHook(() => useStake());

      let returnVal: any;
      await act(async () => {
        returnVal = await result.current.stakeWithdraw({
          slabAddress: SLAB_PK.toBase58(),
          collateralMint: COLLATERAL_MINT.toBase58(),
          lpAmountBaseUnits: BigInt('1000000000000000'), // exactly MAX
        });
      });

      expect(result.current.error).toBeNull();
      expect(returnVal).not.toBeNull();
    });
  });
});
