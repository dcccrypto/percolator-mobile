import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

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
    console.warn(
      '[usePriceStream] EXPO_PUBLIC_HELIUS_API_KEY is not set. ' +
        'Price streaming will not work. Set it in your .env file.',
    );
    return '';
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
 * WebSocket price stream hook.
 * Subscribes to real-time price updates for specified markets.
 *
 * Performance optimizations (PERC-505):
 * - Batches updates every 500ms to avoid per-tick re-renders
 * - Only triggers setState when prices actually changed (ref comparison)
 * - Disconnects WebSocket when app goes to background, reconnects on foreground
 */
export function usePriceStream(slabAddresses: string[]) {
  const [prices, setPrices] = useState<Record<string, PriceUpdate>>({});
  const [status, setStatus] = useState<ConnectionState>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stable ref for slab addresses to avoid re-creating connect on every render
  const slabsRef = useRef(slabAddresses);
  slabsRef.current = slabAddresses;

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
    }
    pendingUpdatesRef.current = {};
  }, []);

  const connect = useCallback(() => {
    if (slabsRef.current.length === 0) return;
    if (!WS_URL) {
      setStatus('error');
      return;
    }

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

  return { prices, status };
}
