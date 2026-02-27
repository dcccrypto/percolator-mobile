/**
 * Tests for src/lib/solana.ts
 */
import { CLUSTER } from '../../src/lib/solana';

describe('solana', () => {
  it('defaults to devnet cluster', () => {
    expect(CLUSTER).toBe('devnet');
  });

  it('exports cluster as a valid Solana cluster string', () => {
    expect(['devnet', 'mainnet-beta', 'testnet']).toContain(CLUSTER);
  });
});
