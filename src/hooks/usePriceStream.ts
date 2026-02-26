import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * WS URL for real-time price data.
 * The old endpoint (wss://api.percolatorlaunch.com/ws) was removed.
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
    // Return empty string; connect() will bail when it fails to connect
    return '';
  }
  return `wss://devnet.helius-rpc.com/?api-key=${apiKey}`;
}

const WS_URL = buildWsUrl();

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
 */
export function usePriceStream(slabAddresses: string[]) {
  const [prices, setPrices] = useState<Record<string, PriceUpdate>>({});
  const [status, setStatus] = useState<ConnectionState>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (slabAddresses.length === 0) return;
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

      // Subscribe to price channels
      for (const slab of slabAddresses) {
        ws.send(JSON.stringify({ type: 'subscribe', channel: `price:${slab}` }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        if (msg.type === 'price' && msg.slabAddress) {
          setPrices((prev) => ({
            ...prev,
            [msg.slabAddress]: {
              slabAddress: msg.slabAddress,
              price: msg.price,
              markPrice: msg.markPrice ?? msg.price,
              timestamp: Date.now(),
            },
          }));
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

      // Auto-reconnect with exponential backoff
      const attempt = reconnectRef.current++;
      const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
      reconnectTimerRef.current = setTimeout(connect, delay);
    };
  }, [slabAddresses]);

  useEffect(() => {
    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, [connect]);

  return { prices, status };
}
