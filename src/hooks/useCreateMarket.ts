/**
 * useCreateMarket — server-assisted market deployment for mobile (GH #80).
 *
 * Flow:
 *  1. POST /api/mobile/create-market → server builds 5 partially-signed txs
 *  2. Mobile signs each tx with MWA and sends them in sequence
 *  3. POST /api/markets to register in the dashboard DB
 *
 * The server generates ephemeral slab + matcher-context keypairs and partially signs
 * TX0 and TX2. Mobile only needs to add the deployer (fee-payer) signature.
 */
import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { useMWA } from './useMWA';
import { connection } from '../lib/solana';
import { Transaction } from '@solana/web3.js';

const WEB_API_BASE =
  process.env.EXPO_PUBLIC_WEB_URL ?? 'https://percolatorlaunch.com/api';

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

const STEP_LABELS = [
  'Building transactions…',
  'Creating slab & initializing market…',
  'Oracle setup & crank…',
  'Initializing LP…',
  'Depositing collateral & insurance…',
  'Creating insurance mint…',
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

        // ── Step 1: Simulate each transaction before signing ──────────────────
        setState((s) => ({ ...s, step: 'Simulating transactions…', stepIndex: 1 }));
        for (let i = 0; i < txBytes.length; i++) {
          const tx = Transaction.from(txBytes[i]);
          const sim = await connection.simulateTransaction(tx);
          if (sim.value.err) {
            const logs = sim.value.logs?.join('\n') ?? '';
            throw new Error(
              `TX${i + 1} simulation failed: ${JSON.stringify(sim.value.err)}` +
                (logs ? `\nLogs:\n${logs}` : ''),
            );
          }
        }

        // ── Steps 1–5: Sign and send each transaction via MWA ─────────────────
        const stepLabels = [
          'Signing: create slab & init market…',
          'Signing: oracle setup & crank…',
          'Signing: init LP…',
          'Signing: deposit collateral & insurance…',
          'Signing: create insurance mint…',
        ];

        let firstSignature: string | null = null;
        for (let i = 0; i < txBytes.length; i++) {
          setState((s) => ({
            ...s,
            step: stepLabels[i],
            stepIndex: i + 1,
          }));
          const { signatures } = await signAndSend([txBytes[i]]);
          if (i === 0) firstSignature = signatures[0] ?? null;
        }

        const slabAddress: string = result.slab_address;

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
