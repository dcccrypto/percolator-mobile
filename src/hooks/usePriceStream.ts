import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { isPriceDeviating } from '../lib/priceOracleCrossCheck';

/**
 * WS URL for real-time price data.
 * Default to the Helius devnet WSS endpoint using EXPO_PUBLIC_HELIUS_API_KEY;
 * override completely with EXPO_PUBLIC_WS_URL.
 */
function buildWsUrl(): string {
  if (process.env.EXPO_PUBLIC_WS_URL) {
    return process.env.EXPO_PUBLIC_WS_URL;
  }
  const apiKey = process.env.EXPO_PUBLIC_HELIUS_API_KEY;
  if (!apiKey) {
    // Hard error: a missing key should be caught at startup, not silently fail
    // at runtime when the user tries to view prices. Set EXPO_PUBLIC_HELIUS_API_KEY
    // in EAS Secrets (production) or .env.local (development).
    throw new Error(
      '[usePriceStream] EXPO_PUBLIC_HELIUS_API_KEY is not set. ' +
        'Add it to EAS Secrets (production) or .env.local (development). ' +
        'Never hardcode API keys in source.',
    );
  }
  return `wss://devnet.helius-rpc.com/?api-key=${apiKey}`;
}

const WS_URL = buildWsUrl();

/** Batch interval for price updates — prevents per-tick re-renders */
const BATCH_INTERVAL_MS = 500;

interface PriceUpdate {
  slabAddress: string;
  price: number;
  markPrice: number;
  timestamp: number;
}

type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

/**
 * Map of slabAddress → trusted oracle reference price (from API index_price).
 * Passed in by the caller so usePriceStream can compare WS prices against
 * the on-chain oracle without needing a direct Pyth SDK dependency.
 *
 * Security Finding #3 — GH#146: WS prices must be cross-checked against the
 * on-chain oracle (Pyth, surfaced via API index_price) before display.
 */
export type OraclePriceMap = Readonly<Record<string, number>>;

/**
 * WebSocket price stream hook.
 * Subscribes to real-time price updates for specified markets.
 *
 * Performance optimizations (PERC-505):
 * - Batches updates every 500ms to avoid per-tick re-renders
 * - Only triggers setState when prices actually changed (ref comparison)
 * - Disconnects WebSocket when app goes to background, reconnects on foreground
 *
 * Security (GH#146 — Finding #3):
 * - On each batch flush, compares WS price against the caller-supplied oracle
 *   reference price (index_price from API). If deviation > 2%, the slab address
 *   is added to `priceWarnings` so the UI can surface a warning banner.
 * - When no oracle price is available for a slab, the WS price is displayed as-is
 *   (no warning — oracle data may not yet be loaded).
 *
 * @param slabAddresses  Markets to subscribe to
 * @param oraclePrices   Map of slabAddress → oracle reference price. Pass the
 *                       `index_price` from the markets API response. Used for
 *                       deviation guard; optional per-slab (missing = no check).
 */
export function usePriceStream(
  slabAddresses: string[],
  oraclePrices: OraclePriceMap = {},
) {
  const [prices, setPrices] = useState<Record<string, PriceUpdate>>({});
  const [status, setStatus] = useState<ConnectionState>('disconnected');
  /**
   * priceWarnings: set of slab addresses whose WS price currently deviates
   * from the on-chain oracle price by more than 2%. The UI should display a
   * warning banner for any market in this set.
   */
  const [priceWarnings, setPriceWarnings] = useState<ReadonlySet<string>>(new Set());

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stable ref for slab addresses to avoid re-creating connect on every render
  const slabsRef = useRef(slabAddresses);
  slabsRef.current = slabAddresses;

  // Stable ref for oracle prices — updated each render without triggering reconnect
  const oraclePricesRef = useRef(oraclePrices);
  oraclePricesRef.current = oraclePrices;

  // Accumulator for batched price updates — only flushed every BATCH_INTERVAL_MS
  const pendingUpdatesRef = useRef<Record<string, PriceUpdate>>({});
  const lastPricesRef = useRef<Record<string, number>>({});

  const flushBatch = useCallback(() => {
    const pending = pendingUpdatesRef.current;
    const keys = Object.keys(pending);
    if (keys.length === 0) return;

    // Check if any price actually changed
    let changed = false;
    for (const key of keys) {
      if (lastPricesRef.current[key] !== pending[key].price) {
        changed = true;
        lastPricesRef.current[key] = pending[key].price;
      }
    }

    if (changed) {
      setPrices((prev) => ({ ...prev, ...pending }));

      // Security Finding #3 — GH#146: cross-check WS prices vs oracle reference
      // Re-evaluate warnings across ALL currently known slab addresses (not just
      // the ones in this batch) so that stale oracle updates can clear warnings too.
      setPriceWarnings((prevWarnings) => {
        const oracle = oraclePricesRef.current;
        const nextWarnings = new Set<string>(prevWarnings);
        let dirty = false;

        for (const slab of keys) {
          const wsPrice = pending[slab]?.price;
          const oraclePrice = oracle[slab];

          // If no oracle price is available, skip — no check possible yet
          if (wsPrice == null || oraclePrice == null || oraclePrice <= 0) {
            // Clear any stale warning for this slab if oracle price is gone
            if (nextWarnings.has(slab)) {
              nextWarnings.delete(slab);
              dirty = true;
            }
            continue;
          }

          const deviating = isPriceDeviating(wsPrice, oraclePrice);
          if (deviating && !nextWarnings.has(slab)) {
            nextWarnings.add(slab);
            dirty = true;
          } else if (!deviating && nextWarnings.has(slab)) {
            nextWarnings.delete(slab);
            dirty = true;
          }
        }

        return dirty ? nextWarnings : prevWarnings;
      });
    }
    pendingUpdatesRef.current = {};
  }, []);

  const connect = useCallback(() => {
    if (slabsRef.current.length === 0) return;
    // WS_URL is validated at module init by buildWsUrl() — if missing, module load throws.
    // No runtime falsy check needed here.

    setStatus('connecting');
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
      reconnectRef.current = 0;

      for (const slab of slabsRef.current) {
        ws.send(JSON.stringify({ type: 'subscribe', channel: `price:${slab}` }));
      }

      // Start batch flush interval
      batchTimerRef.current = setInterval(flushBatch, BATCH_INTERVAL_MS);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        if (msg.type === 'price' && msg.slabAddress) {
          // Accumulate into batch — don't setState per message
          pendingUpdatesRef.current[msg.slabAddress] = {
            slabAddress: msg.slabAddress,
            price: msg.price,
            markPrice: msg.markPrice ?? msg.price,
            timestamp: Date.now(),
          };
        }
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onerror = () => {
      setStatus('error');
    };

    ws.onclose = () => {
      setStatus('disconnected');
      wsRef.current = null;
      if (batchTimerRef.current) {
        clearInterval(batchTimerRef.current);
        batchTimerRef.current = null;
      }
      // Flush any remaining
      flushBatch();

      // Auto-reconnect with exponential backoff + jitter
      const attempt = reconnectRef.current++;
      const baseDelay = Math.min(1000 * Math.pow(2, attempt), 30000);
      const jitter = baseDelay * 0.25 * Math.random();
      reconnectTimerRef.current = setTimeout(connect, baseDelay + jitter);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- slabsRef is stable
  }, [flushBatch]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (batchTimerRef.current) {
      clearInterval(batchTimerRef.current);
      batchTimerRef.current = null;
    }
  }, []);

  // AppState-aware: disconnect on background, reconnect on foreground
  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        if (!wsRef.current) {
          reconnectRef.current = 0;
          connect();
        }
      } else if (nextState === 'background' || nextState === 'inactive') {
        disconnect();
        setStatus('disconnected');
      }
    };

    const sub = AppState.addEventListener('change', handleAppState);
    connect();

    return () => {
      sub.remove();
      disconnect();
    };
  }, [connect, disconnect]);

  return { prices, status, priceWarnings };
}
