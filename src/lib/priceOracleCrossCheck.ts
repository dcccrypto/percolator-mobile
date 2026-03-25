/**
 * WS price vs on-chain oracle cross-check utility.
 *
 * Security Finding #3 — GH#146 (deferred from PERC-8077 beta, required before mainnet):
 *
 * The WebSocket price feed (Helius) must be validated against the oracle
 * reference price (Pyth, sourced from the Percolator API's `index_price` field)
 * before being displayed to users or used in order-summary calculations.
 *
 * A compromised or manipulated WebSocket feed could show users an incorrect
 * price, leading to bad entry/exit decisions, without affecting on-chain state.
 *
 * Strategy:
 *   - The Percolator API returns `index_price` per market, derived from the
 *     on-chain Pyth oracle by the keeper/indexer. We use this as the trusted
 *     reference rather than adding a direct Pyth SDK dependency on mobile.
 *   - On each batch flush in usePriceStream, compare WS price vs oracle price.
 *   - If deviation > ORACLE_DEVIATION_THRESHOLD, surface a `priceWarnings` flag
 *     that the UI can use to show a warning banner.
 */

/** Maximum allowed fractional deviation between WS price and oracle price: 2% */
export const ORACLE_DEVIATION_THRESHOLD = 0.02;

/**
 * Compute the absolute fractional price deviation between a WebSocket price
 * and an oracle reference price.
 *
 * @param wsPrice    Real-time price from the WebSocket feed
 * @param oraclePrice  Reference price from the on-chain oracle (via API index_price)
 * @returns Fractional deviation (e.g. 0.03 = 3%). Returns Infinity if oraclePrice is 0.
 *
 * @example
 * computeDeviation(102, 100)   // → 0.02
 * computeDeviation(95, 100)    // → 0.05
 * computeDeviation(100.5, 100) // → 0.005
 */
export function computeDeviation(wsPrice: number, oraclePrice: number): number {
  if (!Number.isFinite(oraclePrice) || oraclePrice <= 0) return Infinity;
  if (!Number.isFinite(wsPrice) || wsPrice <= 0) return Infinity;
  return Math.abs(wsPrice - oraclePrice) / oraclePrice;
}

/**
 * Returns true when the WebSocket price deviates from the oracle price by more
 * than `threshold` (default: ORACLE_DEVIATION_THRESHOLD = 2%).
 *
 * @param wsPrice     Real-time price from the WebSocket feed
 * @param oraclePrice Reference price from on-chain oracle
 * @param threshold   Fractional threshold (default 0.02 = 2%)
 *
 * @example
 * isPriceDeviating(103, 100)        // → true  (3% > 2% threshold)
 * isPriceDeviating(101.5, 100)      // → false (1.5% ≤ 2% threshold)
 * isPriceDeviating(106, 100, 0.05)  // → true  (6% > 5% threshold)
 */
export function isPriceDeviating(
  wsPrice: number,
  oraclePrice: number,
  threshold: number = ORACLE_DEVIATION_THRESHOLD,
): boolean {
  return computeDeviation(wsPrice, oraclePrice) > threshold;
}
