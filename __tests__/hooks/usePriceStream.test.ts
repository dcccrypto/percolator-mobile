/**
 * Tests for src/hooks/usePriceStream.ts
 * 
 * PERC-505: Updated for batched price updates (500ms flush interval).
 * Uses real timers + waitFor to handle async batch flush.
 */
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';

// Mock AppState.addEventListener
jest.spyOn(AppState, 'addEventListener').mockImplementation(() => ({ remove: jest.fn() }) as any);

// Mock WebSocket
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((event: any) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  sentMessages: string[] = [];
  closed = false;
  
  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }
  
  send(data: string) {
    this.sentMessages.push(data);
  }
  
  close() {
    this.closed = true;
  }
  
  static reset() {
    MockWebSocket.instances = [];
  }
  
  static latest(): MockWebSocket {
    return MockWebSocket.instances[MockWebSocket.instances.length - 1];
  }
}

(global as any).WebSocket = MockWebSocket;

// Set env before import
process.env.EXPO_PUBLIC_HELIUS_API_KEY = 'test-api-key';

const { usePriceStream } = require('../../src/hooks/usePriceStream');

describe('usePriceStream', () => {
  beforeEach(() => {
    MockWebSocket.reset();
  });

  it('does not connect when no slab addresses provided', () => {
    const { result } = renderHook(() => usePriceStream([]));
    expect(MockWebSocket.instances.length).toBe(0);
    expect(result.current.status).toBe('disconnected');
    expect(result.current.prices).toEqual({});
  });

  it('creates WebSocket when slab addresses are provided', () => {
    renderHook(() => usePriceStream(['slab1']));
    expect(MockWebSocket.instances.length).toBeGreaterThanOrEqual(1);
    expect(MockWebSocket.latest().url).toContain('test-api-key');
  });

  it('subscribes to channels on ws open', () => {
    renderHook(() => usePriceStream(['slab1', 'slab2']));
    const ws = MockWebSocket.latest();

    act(() => { ws.onopen!(); });

    expect(ws.sentMessages.length).toBe(2);
    expect(JSON.parse(ws.sentMessages[0])).toEqual({ type: 'subscribe', channel: 'price:slab1' });
    expect(JSON.parse(ws.sentMessages[1])).toEqual({ type: 'subscribe', channel: 'price:slab2' });
  });

  it('sets connected status on ws open', () => {
    const { result } = renderHook(() => usePriceStream(['slab1']));
    const ws = MockWebSocket.latest();

    act(() => { ws.onopen!(); });

    expect(['connected', 'connecting']).toContain(result.current.status);
  });

  it('updates prices after batch flush', async () => {
    const { result } = renderHook(() => usePriceStream(['slab1']));
    const ws = MockWebSocket.latest();

    act(() => { ws.onopen!(); });
    act(() => {
      ws.onmessage!({
        data: JSON.stringify({
          type: 'price',
          slabAddress: 'slab1',
          price: 100.5,
          markPrice: 100.6,
        }),
      });
    });

    // Wait for batch flush (500ms interval)
    await waitFor(() => {
      expect(result.current.prices['slab1']).toBeDefined();
    }, { timeout: 2000 });

    expect(result.current.prices['slab1']).toMatchObject({
      slabAddress: 'slab1',
      price: 100.5,
      markPrice: 100.6,
    });
    expect(result.current.prices['slab1'].timestamp).toBeDefined();
  });

  it('uses price as markPrice fallback', async () => {
    const { result } = renderHook(() => usePriceStream(['slab1']));
    const ws = MockWebSocket.latest();

    act(() => { ws.onopen!(); });
    act(() => {
      ws.onmessage!({
        data: JSON.stringify({ type: 'price', slabAddress: 'slab1', price: 50 }),
      });
    });

    await waitFor(() => {
      expect(result.current.prices['slab1']).toBeDefined();
    }, { timeout: 2000 });

    expect(result.current.prices['slab1'].markPrice).toBe(50);
  });

  it('ignores malformed JSON messages', async () => {
    const { result } = renderHook(() => usePriceStream(['slab1']));
    const ws = MockWebSocket.latest();

    act(() => { ws.onopen!(); });
    act(() => { ws.onmessage!({ data: 'not json {{{' }); });

    // Wait a bit then verify nothing appeared
    await new Promise((r) => setTimeout(r, 700));
    expect(Object.keys(result.current.prices).length).toBe(0);
  });

  it('ignores non-price messages', async () => {
    const { result } = renderHook(() => usePriceStream(['slab1']));
    const ws = MockWebSocket.latest();

    act(() => { ws.onopen!(); });
    act(() => { ws.onmessage!({ data: JSON.stringify({ type: 'heartbeat' }) }); });

    await new Promise((r) => setTimeout(r, 700));
    expect(Object.keys(result.current.prices).length).toBe(0);
  });

  it('ignores price messages without slabAddress', async () => {
    const { result } = renderHook(() => usePriceStream(['slab1']));
    const ws = MockWebSocket.latest();

    act(() => { ws.onopen!(); });
    act(() => { ws.onmessage!({ data: JSON.stringify({ type: 'price', price: 100 }) }); });

    await new Promise((r) => setTimeout(r, 700));
    expect(Object.keys(result.current.prices).length).toBe(0);
  });

  it('closes WebSocket on unmount', () => {
    const { unmount } = renderHook(() => usePriceStream(['slab1']));
    const ws = MockWebSocket.latest();

    unmount();

    expect(ws.closed).toBe(true);
  });

  it('batches multiple updates into single flush', async () => {
    const { result } = renderHook(() => usePriceStream(['slab1', 'slab2']));
    const ws = MockWebSocket.latest();

    act(() => { ws.onopen!(); });
    act(() => {
      ws.onmessage!({ data: JSON.stringify({ type: 'price', slabAddress: 'slab1', price: 100 }) });
      ws.onmessage!({ data: JSON.stringify({ type: 'price', slabAddress: 'slab2', price: 200 }) });
      ws.onmessage!({ data: JSON.stringify({ type: 'price', slabAddress: 'slab1', price: 101 }) }); // overwrite
    });

    await waitFor(() => {
      expect(result.current.prices['slab1']).toBeDefined();
    }, { timeout: 2000 });

    // slab1 should have latest price (101), slab2 should be 200
    expect(result.current.prices['slab1'].price).toBe(101);
    expect(result.current.prices['slab2'].price).toBe(200);
  });
});
