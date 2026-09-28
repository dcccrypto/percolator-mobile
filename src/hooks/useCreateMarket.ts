/**
 * useCreateMarket — server-assisted market deployment for mobile (GH #80).
 *
 * Flow:
 *  1. POST /api/mobile/create-market → server builds 5 UNSIGNED txs
 *  2. Every tx is verified instruction-by-instruction (GH #160,
 *     lib/verifyCreateMarketTxs.ts), simulated, and its decoded cost confirmed
 *     by the user
 *  3. Mobile signs each tx with MWA and sends them in sequence
 *  4. POST /api/markets to register in the dashboard DB
 *
 * The slab, LP portfolio and matcher context are created with
 * createAccountWithSeed from the deployer, so the server never signs anything;
 * the deployer (fee payer) is the only signer.
 */
import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { useMWA } from './useMWA';
import { connection, CLUSTER } from '../lib/solana';
import { confirmTransactionSafe } from '../lib/confirmTransaction';
import { PublicKey } from '@solana/web3.js';
import {
  CREATE_MARKET_PROGRAMS,
  verifyCreateMarketTransactions,
  type VerifiedCreateMarket,
} from '../lib/verifyCreateMarketTxs';

const WEB_API_BASE =
  process.env.EXPO_PUBLIC_WEB_URL ?? 'https://percolatorlaunch.com/api';

// ---------------------------------------------------------------------------
// Security (GH #160): the server builds these transactions, so every one is
// verified instruction-by-instruction in lib/verifyCreateMarketTxs.ts before the
// wallet is asked to sign. A program-id allowlist alone let an appended
// System/SPL transfer to an attacker through. Then the user confirms the
// decoded cost before anything is signed.
// ---------------------------------------------------------------------------

function formatUnits(raw: bigint, decimals: number | null): string {
  if (decimals === null) return `${raw.toString()} (raw units)`;
  const base = 10n ** BigInt(decimals);
  const whole = raw / base;
  const frac = (raw % base).toString().padStart(decimals, '0').replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : whole.toString();
}

function formatSol(lamports: number): string {
  return (lamports / 1_000_000_000).toFixed(4);
}

/** Resolve true only if the user explicitly taps "Sign & Deploy". */
function confirmDeployCost(
  verified: VerifiedCreateMarket,
  requiredCollateral: bigint | null,
  decimals: number | null,
): Promise<boolean> {
  const lines = [
    `SOL: ~${formatSol(verified.rentLamports + verified.maxFeeLamports)} ` +
      `(account rent ${formatSol(verified.rentLamports)} + max fees ${formatSol(verified.maxFeeLamports)})`,
    `Vault seed transfer: ${formatUnits(verified.directTokenTransfer, decimals)} tokens → market vault ` +
      `${verified.vaultAta.toBase58().slice(0, 8)}…`,
  ];
  if (requiredCollateral !== null) {
    lines.push(`Total collateral drawn incl. LP deposit & insurance (server-reported): ${formatUnits(requiredCollateral, decimals)} tokens`);
  }
  lines.push(`\nSlab: ${verified.slab.toBase58()}`);
  return new Promise((resolve) => {
    Alert.alert('Confirm market deployment', lines.join('\n'), [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Sign & Deploy', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}

export type SlabTier = 'small' | 'medium' | 'large';
export type OracleMode = 'admin' | 'hyperp' | 'pyth';

export interface CreateMarketParams {
  /** Token mint address (base58). */
  mint: string;
  /** Human-readable market name. */
  name: string;
  /** Slab tier — controls max accounts and SOL rent cost. Default: "small". */
  tier?: SlabTier;
  /** Oracle mode. Only "admin" supported for devnet beta. */
  oracle_mode?: OracleMode;
  /** DEX pool address for hyperp mode (optional). */
  dex_pool_address?: string;
  /** Initial mark price × 1_000_000. Default: "1000000" ($1.00). */
  initial_price_e6?: string;
}

export interface CreateMarketState {
  deploying: boolean;
  /** Current step label shown to the user. */
  step: string;
  /** Step index (0–5). */
  stepIndex: number;
  error: string | null;
  /** First transaction signature on success. */
  txSignature: string | null;
  /** Deployed slab address on success. */
  slabAddress: string | null;
}

// Match web useCreateMarket STEP_LABELS exactly
const STEP_LABELS = [
  'Creating slab & initializing market...',
  'Oracle setup & pre-LP crank...',
  'Initializing LP...',
  'Depositing collateral, insurance & final crank...',
  'Creating insurance LP mint...',
];

export function useCreateMarket() {
  const { connected, publicKey, signAndSend } = useMWA();
  const [state, setState] = useState<CreateMarketState>({
    deploying: false,
    step: '',
    stepIndex: 0,
    error: null,
    txSignature: null,
    slabAddress: null,
  });

  const deploy = useCallback(
    async (params: CreateMarketParams) => {
      if (!connected || !publicKey) {
        setState((s) => ({ ...s, error: 'Please connect your wallet first.' }));
        return;
      }

      if (!params.mint.trim()) {
        setState((s) => ({ ...s, error: 'Token mint address is required.' }));
        return;
      }

      if (!params.name.trim() || params.name.trim().length < 3) {
        setState((s) => ({
          ...s,
          error: 'Market name must be at least 3 characters.',
        }));
        return;
      }

      const programs = CREATE_MARKET_PROGRAMS[CLUSTER];
      if (!programs) {
        setState((s) => ({
          ...s,
          error: `Market creation is not available on ${CLUSTER}.`,
        }));
        return;
      }

      let mintPk: PublicKey;
      try {
        mintPk = new PublicKey(params.mint.trim());
      } catch {
        setState((s) => ({ ...s, error: 'Invalid token mint address.' }));
        return;
      }

      setState({
        deploying: true,
        step: STEP_LABELS[0],
        stepIndex: 0,
        error: null,
        txSignature: null,
        slabAddress: null,
      });

      try {
        // ── Step 0: Build transactions on server ──────────────────────────────
        const buildRes = await fetch(`${WEB_API_BASE}/mobile/create-market`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deployer: publicKey.toBase58(),
            mint: params.mint.trim(),
            tier: params.tier ?? 'small',
            name: params.name.trim(),
            oracle_mode: params.oracle_mode ?? 'admin',
            dex_pool_address: params.dex_pool_address ?? null,
            initial_price_e6: params.initial_price_e6 ?? '1000000',
          }),
        });

        if (!buildRes.ok) {
          const body = await buildRes.text();
          throw new Error(
            `Server error (${buildRes.status}): ${body || buildRes.statusText}`,
          );
        }

        const result = await buildRes.json();

        if (
          !result.unsigned_txs ||
          !Array.isArray(result.unsigned_txs) ||
          result.unsigned_txs.length !== 5
        ) {
          throw new Error('Unexpected response from server — missing unsigned_txs');
        }

        // ── Decode base64 → Uint8Array ────────────────────────────────────────
        const txBytes: Uint8Array[] = result.unsigned_txs.map((b64: string) => {
          const binary = atob(b64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          return bytes;
        });

        // ── Step 1: Verify + simulate each transaction before signing ─────────
        // Security (GH #160): per-instruction verification, fee payer / signer
        // checks and a canonical round-trip, all BEFORE we touch MWA.
        setState((s) => ({ ...s, step: 'Validating transactions…', stepIndex: 1 }));
        if (typeof result.slab_address !== 'string') {
          throw new Error('Unexpected response from server — missing slab_address');
        }
        let claimedSlab: PublicKey;
        try {
          claimedSlab = new PublicKey(result.slab_address);
        } catch {
          throw new Error('Unexpected response from server — invalid slab_address');
        }
        const verified = await verifyCreateMarketTransactions({
          txBytes,
          user: publicKey,
          mint: mintPk,
          claimedSlab,
          programs,
        });
        const decodedTxs = verified.transactions;

        setState((s) => ({ ...s, step: 'Simulating transactions…', stepIndex: 1 }));
        for (let i = 0; i < decodedTxs.length; i++) {
          const sim = await connection.simulateTransaction(decodedTxs[i]);
          if (sim.value.err) {
            const logs = sim.value.logs?.join('\n') ?? '';
            throw new Error(
              `TX${i + 1} simulation failed: ${JSON.stringify(sim.value.err)}` +
                (logs ? `\nLogs:\n${logs}` : ''),
            );
          }
        }

        // ── Cost confirmation: no blind signing ─────────────────────────────────
        let requiredCollateral: bigint | null = null;
        if (typeof result.required_collateral === 'string' && /^\d+$/.test(result.required_collateral)) {
          requiredCollateral = BigInt(result.required_collateral);
        }
        let decimals: number | null = null;
        try {
          const supply = await connection.getTokenSupply(mintPk);
          decimals = supply.value.decimals;
        } catch {
          decimals = null;
        }
        const approved = await confirmDeployCost(verified, requiredCollateral, decimals);
        if (!approved) {
          throw new Error('Deployment cancelled.');
        }

        // ── Steps 1–5: Sign, send, and confirm each transaction via MWA ────────
        // Match web STEP_LABELS for consistency.
        // We fetch lastValidBlockHeight once — all 5 txs share the same recent
        // blockhash window so a single lookup is sufficient.
        const stepLabels = STEP_LABELS;

        const { lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

        let firstSignature: string | null = null;
        for (let i = 0; i < txBytes.length; i++) {
          setState((s) => ({
            ...s,
            step: stepLabels[i],
            stepIndex: i + 1,
          }));
          const { signatures } = await signAndSend([txBytes[i]]);
          const sig = signatures[0];
          if (!sig) {
            throw new Error(`TX${i + 1} failed: MWA returned no signature`);
          }
          if (i === 0) firstSignature = sig;

          // Confirm on-chain before sending the next tx (each builds on the previous)
          const blockhash = decodedTxs[i].recentBlockhash!;
          await confirmTransactionSafe(connection, sig, blockhash, lastValidBlockHeight);
        }

        const slabAddress: string = verified.slab.toBase58();

        // ── Register market in dashboard DB ───────────────────────────────────
        setState((s) => ({ ...s, step: 'Registering market…', stepIndex: 5 }));
        try {
          const regBody = result.registration ?? {};
          await fetch(`${WEB_API_BASE}/markets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              slab_address: slabAddress,
              mint_address: params.mint.trim(),
              name: params.name.trim(),
              deployer: publicKey.toBase58(),
              oracle_mode: params.oracle_mode ?? 'admin',
              max_leverage: regBody.max_leverage ?? 5,
              trading_fee_bps: regBody.trading_fee_bps ?? 30,
              lp_collateral: regBody.lp_collateral ?? '1000000000',
              initial_price_e6: params.initial_price_e6 ?? '1000000',
            }),
          });
        } catch {
          // Non-fatal — market is on-chain even if DB registration fails
          console.warn('[useCreateMarket] Failed to register market in DB');
        }

        // ── Done ──────────────────────────────────────────────────────────────
        setState({
          deploying: false,
          step: 'Market deployed!',
          stepIndex: 5,
          error: null,
          txSignature: firstSignature,
          slabAddress,
        });

        Alert.alert(
          'Market Deployed 🎉',
          `${params.name.trim()} is live on devnet.\n\nSlab: ${slabAddress.slice(0, 12)}…`,
          [{ text: 'OK' }],
        );
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Market creation failed';
        setState((s) => ({
          ...s,
          deploying: false,
          step: '',
          stepIndex: 0,
          error: msg,
        }));
      }
    },
    [connected, publicKey, signAndSend],
  );

  const reset = useCallback(() => {
    setState({
      deploying: false,
      step: '',
      stepIndex: 0,
      error: null,
      txSignature: null,
      slabAddress: null,
    });
  }, []);

  return { state, deploy, reset };
}
