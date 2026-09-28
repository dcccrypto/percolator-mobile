/**
 * Tests for src/hooks/useCreateMarket.ts
 *
 * Covers:
 *   1. Happy path: all 5 txs sign+send+confirm → state shows success
 *   2. Wallet not connected → error state
 *   3. Server returns error → error state
 *   4. confirmTransactionSafe throws on TX3 → error, deployment aborted
 *   5. MWA returns empty signatures → error before confirmation
 *   6. GH #160: server-built txs are verified per instruction (real tx bytes,
 *      built by __tests__/fixtures/createMarketTxs.ts) and the user confirms
 *      the decoded cost before anything is signed.
 */

import { renderHook, act } from '@testing-library/react-native';
import { PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import { Alert } from 'react-native';

// ── Spy on Alert.alert ───────────────────────────────────────────────────
// The cost-confirmation Alert resolves only on a button press; by default the
// test "user" taps "Sign & Deploy". Set confirmChoice = 'Cancel' to decline.
let confirmChoice: 'Sign & Deploy' | 'Cancel' = 'Sign & Deploy';
function autoConfirmAlert(_title: string, _msg?: string, buttons?: any[]) {
  const b = buttons?.find((x) => x.text === confirmChoice);
  b?.onPress?.();
}
const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(autoConfirmAlert as any);

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
  get CLUSTER() {
    return (global as any).__mockCluster ?? 'devnet';
  },
  connection: {
    getTokenSupply: () => Promise.resolve({ value: { decimals: 6 } }),
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

// ── Real server-shaped transactions (GH #160) ─────────────────────────────
// The hook now verifies every instruction, so the fixtures are the real 5-tx
// shape the server builds, serialized to base64 exactly as the route does.
import { buildFixture, Fixture, serializeTx, withAppended } from '../fixtures/createMarketTxs';
import { SystemProgram, Keypair } from '@solana/web3.js';

const MINT = 'DJ54k4wH92NTtNP8RuHAwG8si1bevXEknzctDdqYN8eC';
let fx: Fixture;
let SLAB_ADDRESS: string;
let GOOD_B64: string[];
const toB64 = (tx: Transaction) => Buffer.from(serializeTx(tx)).toString('base64');

beforeAll(async () => {
  fx = await buildFixture(DEPLOYER_PK, new PublicKey(MINT));
  SLAB_ADDRESS = fx.slab.toBase58();
  GOOD_B64 = fx.txs.map(toB64);
});

const FAKE_B64_TX = Buffer.from('fake-tx-payload-bytes').toString('base64');

function makeServerResponse(overrides?: Record<string, any>) {
  return {
    unsigned_txs: GOOD_B64,
    slab_address: SLAB_ADDRESS,
    required_collateral: '3600000000',
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
  mint: MINT,
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
  alertSpy.mockImplementation(autoConfirmAlert as any);
  confirmChoice = 'Sign & Deploy';
  (global as any).__mockCluster = 'devnet';

  // Call-through spy: counts decodes without faking them.
  transactionFromSpy = jest.spyOn(Transaction, 'from');
});

afterEach(() => {
  transactionFromSpy.mockRestore();
});

let transactionFromSpy: jest.SpyInstance;

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
      // (verification decodes each tx once)
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

  // ── Security (GH #160): no blind signing ──────────────────────────────

  describe('GH #160: server-built transactions are verified before signing', () => {
    function mockBuildResponse(resp: Record<string, any>) {
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(resp) });
    }

    it('aborts, without signing, when TX1 has an appended SystemProgram.transfer to an attacker', async () => {
      const attacker = Keypair.generate().publicKey;
      const drained = withAppended(
        fx.txs[0],
        SystemProgram.transfer({ fromPubkey: DEPLOYER_PK, toPubkey: attacker, lamports: 5_000_000_000 }),
      );
      mockBuildResponse(makeServerResponse({ unsigned_txs: [toB64(drained), ...GOOD_B64.slice(1)] }));

      const { result } = renderHook(() => useCreateMarket());
      await act(async () => {
        await result.current.deploy(DEFAULT_PARAMS);
      });

      expect(result.current.state.error).toMatch(/System Program "Transfer" is not permitted/);
      expect(result.current.state.deploying).toBe(false);
      expect(mockSignAndSend).not.toHaveBeenCalled();
      expect(mockSimulateTransaction).not.toHaveBeenCalled();
    });

    it('aborts when a transaction contains an untrusted program', async () => {
      const evil = new TransactionInstruction({
        programId: new PublicKey(new Uint8Array(32).fill(0xba)),
        keys: [],
        data: Buffer.alloc(0),
      });
      mockBuildResponse(
        makeServerResponse({ unsigned_txs: [...GOOD_B64.slice(0, 3), toB64(withAppended(fx.txs[3], evil)), GOOD_B64[4]] }),
      );

      const { result } = renderHook(() => useCreateMarket());
      await act(async () => {
        await result.current.deploy(DEFAULT_PARAMS);
      });

      expect(result.current.state.error).toMatch(/untrusted program/i);
      expect(mockSignAndSend).not.toHaveBeenCalled();
    });

    it('aborts when slab_address is not the slab the transactions create', async () => {
      mockBuildResponse(makeServerResponse({ slab_address: Keypair.generate().publicKey.toBase58() }));

      const { result } = renderHook(() => useCreateMarket());
      await act(async () => {
        await result.current.deploy(DEFAULT_PARAMS);
      });

      expect(result.current.state.error).toMatch(/do not sign/);
      expect(mockSignAndSend).not.toHaveBeenCalled();
    });

    it('rejects undecodable transaction bytes', async () => {
      mockBuildResponse(makeServerResponse({ unsigned_txs: [FAKE_B64_TX, ...GOOD_B64.slice(1)] }));

      const { result } = renderHook(() => useCreateMarket());
      await act(async () => {
        await result.current.deploy(DEFAULT_PARAMS);
      });

      expect(result.current.state.error).toMatch(/TX1: could not decode/);
      expect(mockSignAndSend).not.toHaveBeenCalled();
    });

    it('shows the decoded cost and does not sign if the user cancels', async () => {
      confirmChoice = 'Cancel';
      mockBuildResponse(makeServerResponse());

      const { result } = renderHook(() => useCreateMarket());
      await act(async () => {
        await result.current.deploy(DEFAULT_PARAMS);
      });

      const confirmCall = alertSpy.mock.calls.find((c) => c[0] === 'Confirm market deployment');
      expect(confirmCall).toBeDefined();
      expect(confirmCall![1]).toMatch(/Vault seed transfer: 500 tokens/);
      expect(confirmCall![1]).toMatch(/Total collateral .*: 3600 tokens/);
      expect(confirmCall![1]).toContain(SLAB_ADDRESS);
      expect(result.current.state.error).toMatch(/cancelled/i);
      expect(mockSignAndSend).not.toHaveBeenCalled();
    });

    it('fails closed on a cluster with no trusted create-market programs', async () => {
      (global as any).__mockCluster = 'mainnet-beta';

      const { result } = renderHook(() => useCreateMarket());
      await act(async () => {
        await result.current.deploy(DEFAULT_PARAMS);
      });

      expect(result.current.state.error).toMatch(/not available on mainnet-beta/);
      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockSignAndSend).not.toHaveBeenCalled();
    });

    it('signs exactly the verified bytes', async () => {
      mockFetchSuccess();

      const { result } = renderHook(() => useCreateMarket());
      await act(async () => {
        await result.current.deploy(DEFAULT_PARAMS);
      });

      expect(mockSignAndSend).toHaveBeenCalledTimes(5);
      mockSignAndSend.mock.calls.forEach((call: any[], i: number) => {
        expect(Buffer.from(call[0][0]).toString('base64')).toBe(GOOD_B64[i]);
      });
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
