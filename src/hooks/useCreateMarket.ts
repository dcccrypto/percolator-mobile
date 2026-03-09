import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { useMWA } from './useMWA';
import { connection } from '../lib/solana';
import { Transaction } from '@solana/web3.js';

const WEB_API_BASE =
  process.env.EXPO_PUBLIC_WEB_URL ?? 'https://percolatorlaunch.com/api';

interface CreateMarketParams {
  name: string;
  oracle: string;
  maxLeverage: number;
  fundingRate: number;
  insurance: number;
  makerFee: number;
  takerFee: number;
  mode: 'quick' | 'manual';
}

interface CreateMarketState {
  deploying: boolean;
  step: string;
  error: string | null;
  txSignature: string | null;
}

export function useCreateMarket() {
  const { connected, publicKey, signAndSend } = useMWA();
  const [state, setState] = useState<CreateMarketState>({
    deploying: false,
    step: '',
    error: null,
    txSignature: null,
  });

  const deploy = useCallback(
    async (params: CreateMarketParams) => {
      if (!connected || !publicKey) {
        setState((s) => ({
          ...s,
          error: 'Please connect your wallet first.',
        }));
        return;
      }

      if (!params.name.trim()) {
        setState((s) => ({ ...s, error: 'Market name is required.' }));
        return;
      }

      if (params.name.trim().length < 3) {
        setState((s) => ({
          ...s,
          error: 'Market name must be at least 3 characters.',
        }));
        return;
      }

      setState({
        deploying: true,
        step: 'Preparing market…',
        error: null,
        txSignature: null,
      });

      try {
        setState((s) => ({
          ...s,
          step: 'Requesting deployment…',
        }));

        const res = await fetch(`${WEB_API_BASE}/markets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: params.name.trim(),
            oracle: params.oracle.trim() || undefined,
            max_leverage: params.maxLeverage,
            funding_rate_bps: Math.round(params.fundingRate * 100),
            insurance_amount: Math.round(params.insurance * 1_000_000),
            maker_fee_bps: Math.round(params.makerFee * 100),
            taker_fee_bps: Math.round(params.takerFee * 100),
            mode: params.mode,
            deployer: publicKey.toBase58(),
          }),
        });

        if (!res.ok) {
          const body = await res.text();
          throw new Error(
            `API error (${res.status}): ${body || res.statusText}`,
          );
        }

        const result = await res.json();

        if (result.unsigned_txs && Array.isArray(result.unsigned_txs)) {
          setState((s) => ({
            ...s,
            step: 'Sign in your wallet…',
          }));

          const txBytes = result.unsigned_txs.map((b64: string) => {
            const binary = atob(b64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
              bytes[i] = binary.charCodeAt(i);
            }
            return bytes;
          });

          setState((s) => ({
            ...s,
            step: 'Simulating transaction…',
          }));

          for (let i = 0; i < txBytes.length; i++) {
            const tx = Transaction.from(txBytes[i]);
            const sim = await connection.simulateTransaction(tx);
            if (sim.value.err) {
              const logs = sim.value.logs?.join('\n') ?? '';
              throw new Error(
                `Transaction ${i + 1} simulation failed: ${JSON.stringify(sim.value.err)}${logs ? `\nLogs:\n${logs}` : ''}`,
              );
            }
          }

          setState((s) => ({
            ...s,
            step: 'Sign in your wallet…',
          }));

          const { signatures } = await signAndSend(txBytes);

          setState({
            deploying: false,
            step: 'Market deployed!',
            error: null,
            txSignature: signatures[0] ?? null,
          });

          Alert.alert(
            'Market Deployed',
            `${params.name} has been created on devnet.\n\nTx: ${(signatures[0] ?? '').slice(0, 20)}…`,
            [{ text: 'OK' }],
          );
        } else if (result.slab_address) {
          setState({
            deploying: false,
            step: 'Market created!',
            error: null,
            txSignature: result.tx_signature ?? null,
          });

          Alert.alert(
            'Market Created',
            `${params.name} is live on devnet.`,
            [{ text: 'OK' }],
          );
        } else {
          throw new Error('Unexpected API response format');
        }
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Market creation failed';
        setState({
          deploying: false,
          step: '',
          error: msg,
          txSignature: null,
        });
      }
    },
    [connected, publicKey, signAndSend],
  );

  const reset = useCallback(() => {
    setState({
      deploying: false,
      step: '',
      error: null,
      txSignature: null,
    });
  }, []);

  return { state, deploy, reset };
}
