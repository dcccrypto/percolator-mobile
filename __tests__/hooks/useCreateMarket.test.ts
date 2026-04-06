/**
 * Tests for src/hooks/useCreateMarket.ts
 *
 * Covers:
 *   1. Happy path: all 5 txs sign+send+confirm → state shows success
 *   2. Wallet not connected → error state
 *   3. Server returns error → error state
 *   4. confirmTransactionSafe throws on TX3 → error, deployment aborted
 *   5. MWA returns empty signatures → error before confirmation
 */

import { renderHook, act } from '@testing-library/react-native';
import { PublicKey, Transaction } from '@solana/web3.js';
import { Alert } from 'react-native';

// ── Spy on Alert.alert ───────────────────────────────────────────────────
const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

// ── Mock global fetch ────────────────────────────────────────────────────
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

// ── Mock global atob (base64 decode) ─────────────────────────────────────
// Node has Buffer but not always atob in older versions; ensure it exists.
if (typeof global.atob === 'undefined') {
  global.atob = (b64: string) => Buffer.from(b64, 'base64').toString('binary');
}

// ── Mock lib/solana (connection singleton) ───────────────────────────────
const mockSimulateTransaction = jest.fn(() =>
  Promise.resolve({ value: { err: null, logs: [] } }),
);
const mockGetLatestBlockhash = jest.fn(() =>
  Promise.resolve({
    blockhash: 'GHtXQBsoZHVnNFa9YevAzFr17DJjgHXk3ycTKD5xD3Zi',
    lastValidBlockHeight: 200,
  }),
);

jest.mock('../../src/lib/solana', () => ({
  connection: {
    simulateTransaction: (...args: any[]) =>
      (global as any).__mockSimulateTransaction?.(...args) ??
      Promise.resolve({ value: { err: null, logs: [] } }),
    getLatestBlockhash: (...args: any[]) =>
      (global as any).__mockGetLatestBlockhash?.(...args) ??
      Promise.resolve({ blockhash: 'test', lastValidBlockHeight: 100 }),
  },
}));

// ── Mock confirmTransactionSafe ──────────────────────────────────────────
const mockConfirmTransactionSafe = jest.fn(() => Promise.resolve());
jest.mock('../../src/lib/confirmTransaction', () => ({
  confirmTransactionSafe: (...args: any[]) =>
    (global as any).__mockConfirmTransactionSafe?.(...args) ?? Promise.resolve(),
}));

// ── Mock useMWA ──────────────────────────────────────────────────────────
const DEPLOYER_PK = new PublicKey('5xot9PVkphiX2adznghwrAuxGs2zeWisNSxMW6hU6Hkj');
const mockSignAndSend = jest.fn(() =>
  Promise.resolve({ signatures: ['sig-abc-123'] }),
);

let mockConnected = true;
let mockPublicKey: PublicKey | null = DEPLOYER_PK;

jest.mock('../../src/hooks/useMWA', () => ({
  useMWA: () => ({
    get connected() { return mockConnected; },
    get publicKey() { return mockPublicKey; },
    signAndSend: mockSignAndSend,
  }),
}));

// ── Mock Transaction.from ────────────────────────────────────────────────
// The hook calls Transaction.from(bytes) then inspects instructions.
// We need to return objects with trusted program IDs so assertTrustedPrograms passes.
const SYSTEM_PROGRAM = new PublicKey('11111111111111111111111111111111');
const PERCOLATOR_PROGRAM = new PublicKey('GM8zjJ8LTBMv9xEsverh6H6wLyevgMHEJXcEzyY3rY24');

const origTransactionFrom = Transaction.from;
let transactionFromSpy: jest.SpyInstance;

function makeMockTransaction(): Transaction {
  const tx = new Transaction();
  // Add a fake instruction with a trusted programId
  tx.instructions = [
    {
      programId: SYSTEM_PROGRAM,
      keys: [],
      data: Buffer.alloc(0),
    } as any,
    {
      programId: PERCOLATOR_PROGRAM,
      keys: [],
      data: Buffer.alloc(0),
    } as any,
  ];
  return tx;
}

// ── Fake base64 transaction payloads ─────────────────────────────────────
// The hook decodes base64 → Uint8Array → Transaction.from(). Since we mock
// Transaction.from, the actual bytes don't matter. We use valid base64 strings.
const FAKE_B64_TX = Buffer.from('fake-tx-payload-bytes').toString('base64');
const SLAB_ADDRESS = 'SomeSlabAddress1234567890abcdefghijklmno';

function makeServerResponse(overrides?: Record<string, any>) {
  return {
    unsigned_txs: [FAKE_B64_TX, FAKE_B64_TX, FAKE_B64_TX, FAKE_B64_TX, FAKE_B64_TX],
    slab_address: SLAB_ADDRESS,
    ...overrides,
  };
}

function mockFetchSuccess() {
  // First call: POST /mobile/create-market → 200 with txs
  // Second call: POST /markets → 200 (registration)
  mockFetch
    .mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(makeServerResponse()),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });
}

// ── Import hook under test ───────────────────────────────────────────────
import { useCreateMarket } from '../../src/hooks/useCreateMarket';

// ── Test helpers ─────────────────────────────────────────────────────────
const DEFAULT_PARAMS = {
  mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  name: 'Test Market',
  tier: 'small' as const,
};

// ── Setup / Teardown ─────────────────────────────────────────────────────
beforeEach(() => {
  jest.resetAllMocks();

  // Wire global shims for jest.mock factories
  (global as any).__mockSimulateTransaction = mockSimulateTransaction;
  (global as any).__mockGetLatestBlockhash = mockGetLatestBlockhash;
  (global as any).__mockConfirmTransactionSafe = mockConfirmTransactionSafe;

  // Reset defaults
  mockConnected = true;
  mockPublicKey = DEPLOYER_PK;
  mockConfirmTransactionSafe.mockResolvedValue(undefined);
  mockSimulateTransaction.mockResolvedValue({ value: { err: null, logs: [] } });
  mockSignAndSend.mockResolvedValue({ signatures: ['sig-abc-123'] });

  // Spy on Transaction.from to return controlled mock transactions
  transactionFromSpy = jest
    .spyOn(Transaction, 'from')
    .mockImplementation(() => makeMockTransaction());
});

afterEach(() => {
  transactionFromSpy.mockRestore();
});

// ── Tests ────────────────────────────────────────────────────────────────

describe('useCreateMarket', () => {
  // ── 1. Happy path ─────────────────────────────────────────────────────

  describe('happy path: all 5 txs confirm successfully', () => {
    it('transitions through states and ends with success', async () => {
      mockFetchSuccess();

      const { result } = renderHook(() => useCreateMarket());

      await act(async () => {
        await result.current.deploy(DEFAULT_PARAMS);
      });

      // Final state: success
      expect(result.current.state.deploying).toBe(false);
      expect(result.current.state.error).toBeNull();
      expect(result.current.state.txSignature).toBe('sig-abc-123');
      expect(result.current.state.slabAddress).toBe(SLAB_ADDRESS);
      expect(result.current.state.step).toBe('Market deployed!');
    });

    it('calls signAndSend 5 times (once per transaction)', async () => {
      mockFetchSuccess();

      const { result } = renderHook(() => useCreateMarket());

      await act(async () => {
        await result.current.deploy(DEFAULT_PARAMS);
      });

      expect(mockSignAndSend).toHaveBeenCalledTimes(5);
    });

    it('calls confirmTransactionSafe 5 times (once per transaction)', async () => {
      mockFetchSuccess();

      const { result } = renderHook(() => useCreateMarket());

      await act(async () => {
        await result.current.deploy(DEFAULT_PARAMS);
      });

      expect(mockConfirmTransactionSafe).toHaveBeenCalledTimes(5);
    });

    it('calls simulateTransaction 5 times before any signing', async () => {
      mockFetchSuccess();

      const { result } = renderHook(() => useCreateMarket());

      await act(async () => {
        await result.current.deploy(DEFAULT_PARAMS);
      });

      expect(mockSimulateTransaction).toHaveBeenCalledTimes(5);
    });

    it('decodes all 5 base64 transactions via Transaction.from', async () => {
      mockFetchSuccess();

      const { result } = renderHook(() => useCreateMarket());

      await act(async () => {
        await result.current.deploy(DEFAULT_PARAMS);
      });

      expect(transactionFromSpy).toHaveBeenCalledTimes(5);
    });

    it('sends POST to /mobile/create-market with correct body', async () => {
      mockFetchSuccess();

      const { result } = renderHook(() => useCreateMarket());

      await act(async () => {
        await result.current.deploy(DEFAULT_PARAMS);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/mobile/create-market'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining(DEPLOYER_PK.toBase58()),
        }),
      );
    });

    it('sends POST to /markets for registration after success', async () => {
      mockFetchSuccess();

      const { result } = renderHook(() => useCreateMarket());

      await act(async () => {
        await result.current.deploy(DEFAULT_PARAMS);
      });

      // Second fetch call is the registration
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('/markets'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining(SLAB_ADDRESS),
        }),
      );
    });

    it('shows Alert.alert on success', async () => {
      mockFetchSuccess();

      const { result } = renderHook(() => useCreateMarket());

      await act(async () => {
        await result.current.deploy(DEFAULT_PARAMS);
      });

      expect(alertSpy).toHaveBeenCalledWith(
        expect.stringContaining('Deployed'),
        expect.stringContaining(DEFAULT_PARAMS.name),
        expect.any(Array),
      );
    });
  });

  // ── 2. Wallet not connected ───────────────────────────────────────────

  describe('wallet not connected', () => {
    it('sets error and does not call fetch', async () => {
      mockConnected = false;
      mockPublicKey = null;

      const { result } = renderHook(() => useCreateMarket());

      await act(async () => {
        await result.current.deploy(DEFAULT_PARAMS);
      });

      expect(result.current.state.error).toMatch(/connect your wallet/i);
      expect(result.current.state.deploying).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockSignAndSend).not.toHaveBeenCalled();
    });
  });

  // ── 3. Server returns error ───────────────────────────────────────────

  describe('server returns error', () => {
    it('sets error state with server message on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve('rate limit exceeded'),
      });

      const { result } = renderHook(() => useCreateMarket());

      await act(async () => {
        await result.current.deploy(DEFAULT_PARAMS);
      });

      expect(result.current.state.error).toMatch(/Server error \(500\)/);
      expect(result.current.state.error).toMatch(/rate limit exceeded/);
      expect(result.current.state.deploying).toBe(false);
      expect(mockSignAndSend).not.toHaveBeenCalled();
    });

    it('sets error when server returns malformed response (no unsigned_txs)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ some_other_field: 'oops' }),
      });

      const { result } = renderHook(() => useCreateMarket());

      await act(async () => {
        await result.current.deploy(DEFAULT_PARAMS);
      });

      expect(result.current.state.error).toMatch(/missing unsigned_txs/i);
      expect(result.current.state.deploying).toBe(false);
    });

    it('sets error when server returns wrong number of transactions', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            unsigned_txs: [FAKE_B64_TX, FAKE_B64_TX], // only 2, need 5
            slab_address: SLAB_ADDRESS,
          }),
      });

      const { result } = renderHook(() => useCreateMarket());

      await act(async () => {
        await result.current.deploy(DEFAULT_PARAMS);
      });

      expect(result.current.state.error).toMatch(/missing unsigned_txs/i);
      expect(result.current.state.deploying).toBe(false);
    });
  });

  // ── 4. confirmTransactionSafe throws on TX3 ──────────────────────────

  describe('confirmTransactionSafe throws on TX3', () => {
    it('sets error and aborts deployment', async () => {
      mockFetchSuccess();

      // First 2 confirms succeed, third throws
      mockConfirmTransactionSafe
        .mockResolvedValueOnce(undefined) // TX1
        .mockResolvedValueOnce(undefined) // TX2
        .mockRejectedValueOnce(
          new Error('Transaction failed on-chain: {"InstructionError":[0,{"Custom":6001}]}'),
        );

      const { result } = renderHook(() => useCreateMarket());

      await act(async () => {
        await result.current.deploy(DEFAULT_PARAMS);
      });

      expect(result.current.state.error).toMatch(/Transaction failed on-chain/);
      expect(result.current.state.deploying).toBe(false);
      // Only 3 signAndSend calls (aborted after TX3 failed confirmation)
      expect(mockSignAndSend).toHaveBeenCalledTimes(3);
      expect(mockConfirmTransactionSafe).toHaveBeenCalledTimes(3);
      // No registration call
      expect(mockFetch).toHaveBeenCalledTimes(1); // only the build call
    });
  });

  // ── 5. MWA returns empty signatures ───────────────────────────────────

  describe('MWA returns empty signatures', () => {
    it('sets error when signAndSend returns null signature', async () => {
      mockFetchSuccess();

      mockSignAndSend.mockResolvedValueOnce({
        signatures: [null],
      });

      const { result } = renderHook(() => useCreateMarket());

      await act(async () => {
        await result.current.deploy(DEFAULT_PARAMS);
      });

      // The fix checks signatures[0] is not null/undefined before confirming
      // If it is null, an error should be thrown
      expect(result.current.state.error).toBeTruthy();
      expect(result.current.state.deploying).toBe(false);
    });

    it('sets error when signAndSend returns empty array', async () => {
      mockFetchSuccess();

      mockSignAndSend.mockResolvedValueOnce({
        signatures: [],
      });

      const { result } = renderHook(() => useCreateMarket());

      await act(async () => {
        await result.current.deploy(DEFAULT_PARAMS);
      });

      expect(result.current.state.error).toBeTruthy();
      expect(result.current.state.deploying).toBe(false);
    });
  });

  // ── Input validation ──────────────────────────────────────────────────

  describe('input validation', () => {
    it('rejects empty mint address', async () => {
      const { result } = renderHook(() => useCreateMarket());

      await act(async () => {
        await result.current.deploy({ ...DEFAULT_PARAMS, mint: '  ' });
      });

      expect(result.current.state.error).toMatch(/mint address is required/i);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('rejects market name shorter than 3 characters', async () => {
      const { result } = renderHook(() => useCreateMarket());

      await act(async () => {
        await result.current.deploy({ ...DEFAULT_PARAMS, name: 'AB' });
      });

      expect(result.current.state.error).toMatch(/at least 3 characters/i);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // ── Simulation failure ────────────────────────────────────────────────

  describe('simulation failure', () => {
    it('sets error when simulateTransaction returns err', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(makeServerResponse()),
      });

      mockSimulateTransaction.mockResolvedValueOnce({
        value: {
          err: { InstructionError: [0, { Custom: 1 }] },
          logs: ['Program log: Error processing'],
        },
      });

      const { result } = renderHook(() => useCreateMarket());

      await act(async () => {
        await result.current.deploy(DEFAULT_PARAMS);
      });

      expect(result.current.state.error).toMatch(/TX1 simulation failed/);
      expect(result.current.state.deploying).toBe(false);
      expect(mockSignAndSend).not.toHaveBeenCalled();
    });
  });

  // ── Security: untrusted program detection ─────────────────────────────

  describe('untrusted program detection', () => {
    it('aborts when a transaction contains an untrusted program', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(makeServerResponse()),
      });

      const MALICIOUS_PROGRAM = new PublicKey(new Uint8Array(32).fill(0xba));
      transactionFromSpy.mockImplementation(() => {
        const tx = new Transaction();
        tx.instructions = [
          {
            programId: MALICIOUS_PROGRAM,
            keys: [],
            data: Buffer.alloc(0),
          } as any,
        ];
        return tx;
      });

      const { result } = renderHook(() => useCreateMarket());

      await act(async () => {
        await result.current.deploy(DEFAULT_PARAMS);
      });

      expect(result.current.state.error).toMatch(/untrusted program/i);
      expect(result.current.state.deploying).toBe(false);
      expect(mockSignAndSend).not.toHaveBeenCalled();
    });
  });

  // ── reset() ───────────────────────────────────────────────────────────

  describe('reset', () => {
    it('clears state back to initial values', async () => {
      mockFetchSuccess();

      const { result } = renderHook(() => useCreateMarket());

      await act(async () => {
        await result.current.deploy(DEFAULT_PARAMS);
      });

      expect(result.current.state.txSignature).toBeTruthy();

      act(() => {
        result.current.reset();
      });

      expect(result.current.state.deploying).toBe(false);
      expect(result.current.state.step).toBe('');
      expect(result.current.state.stepIndex).toBe(0);
      expect(result.current.state.error).toBeNull();
      expect(result.current.state.txSignature).toBeNull();
      expect(result.current.state.slabAddress).toBeNull();
    });
  });

  // ── Registration failure is non-fatal ─────────────────────────────────

  describe('registration failure is non-fatal', () => {
    it('still reports success when /markets POST fails', async () => {
      // First fetch: build txs succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(makeServerResponse()),
      });
      // Second fetch: registration fails
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useCreateMarket());

      await act(async () => {
        await result.current.deploy(DEFAULT_PARAMS);
      });

      // Market is on-chain even if DB registration fails
      expect(result.current.state.error).toBeNull();
      expect(result.current.state.txSignature).toBe('sig-abc-123');
      expect(result.current.state.slabAddress).toBe(SLAB_ADDRESS);
      expect(result.current.state.step).toBe('Market deployed!');
    });
  });
});
