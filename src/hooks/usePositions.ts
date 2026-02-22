/**
 * usePositions — fetches all open positions for the connected wallet.
 *
 * Strategy: iterate all markets from the API, fetch each slab account
 * from the RPC, parse the account table to find entries owned by this
 * wallet, then enrich with the latest oracle price.
 *
 * The parsing logic mirrors @percolator/core's slab.ts but is inlined
 * here so the mobile bundle doesn't need to depend on a Node-only pkg.
 */

import { useState, useEffect, useCallback } from 'react';
import { PublicKey } from '@solana/web3.js';
import { connection } from '../lib/solana';
import { api } from '../lib/api';

// ---------------------------------------------------------------------------
// Binary parsing helpers (mirrors packages/core/src/solana/slab.ts)
// ---------------------------------------------------------------------------

function readU8(buf: Uint8Array, off: number): number {
  return buf[off];
}

function readU64LE(buf: Uint8Array, off: number): bigint {
  const dv = new DataView(buf.buffer, buf.byteOffset + off, 8);
  return dv.getBigUint64(0, true);
}

function readU128LE(buf: Uint8Array, off: number): bigint {
  const lo = readU64LE(buf, off);
  const hi = readU64LE(buf, off + 8);
  return (hi << 64n) | lo;
}

function readI128LE(buf: Uint8Array, off: number): bigint {
  const unsigned = readU128LE(buf, off);
  const SIGN_BIT = 1n << 127n;
  return unsigned >= SIGN_BIT ? unsigned - (1n << 128n) : unsigned;
}

function readPubkey(buf: Uint8Array, off: number): string {
  const bytes = buf.slice(off, off + 32);
  return new PublicKey(bytes).toBase58();
}

// Account layout offsets (matches Rust struct)
const ACCT_SIZE = 256; // each account slot is 256 bytes (incl. padding)
const ACCT_ACCOUNT_ID_OFF = 0;
const ACCT_CAPITAL_OFF = 8;
const ACCT_KIND_OFF = 24;
const ACCT_PNL_OFF = 32;
const ACCT_POSITION_SIZE_OFF = 80;
const ACCT_ENTRY_PRICE_OFF = 96;
const ACCT_OWNER_OFF = 184;

// Slab header + config start offsets (matches slab.ts ENGINE_OFF = 392)
const ACCOUNTS_SECTION_OFF = 392 + 328; // header(72) + config(320) + engine(328)

function parseAccounts(
  data: Uint8Array,
  ownerBase58: string,
): ParsedAccount[] {
  const results: ParsedAccount[] = [];
  let offset = ACCOUNTS_SECTION_OFF;

  while (offset + ACCT_SIZE <= data.length) {
    try {
      const kindByte = readU8(data, offset + ACCT_KIND_OFF);
      // kind 0 = User, kind 1 = LP; skip if invalid
      if (kindByte > 1) { offset += ACCT_SIZE; continue; }

      const owner = readPubkey(data, offset + ACCT_OWNER_OFF);
      if (owner === ownerBase58) {
        const capital = readU128LE(data, offset + ACCT_CAPITAL_OFF);
        const positionSize = readI128LE(data, offset + ACCT_POSITION_SIZE_OFF);
        const pnl = readI128LE(data, offset + ACCT_PNL_OFF);
        const entryPrice = readU64LE(data, offset + ACCT_ENTRY_PRICE_OFF);
        const accountId = readU64LE(data, offset + ACCT_ACCOUNT_ID_OFF);

        // Only include accounts with non-zero capital
        if (capital > 0n) {
          results.push({ accountId, capital, pnl, positionSize, entryPrice, owner });
        }
      }
    } catch {
      // skip malformed slot
    }
    offset += ACCT_SIZE;
  }
  return results;
}

interface ParsedAccount {
  accountId: bigint;
  capital: bigint;      // in e6 (USDC micro-units)
  pnl: bigint;          // realised PnL in e6
  positionSize: bigint; // signed, in e6 (positive = long, negative = short)
  entryPrice: bigint;   // in e6
  owner: string;
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface Position {
  id: string;          // `${slabAddress}:${accountId}`
  symbol: string;
  slabAddress: string;
  direction: 'long' | 'short';
  leverage: number;
  entryPrice: number;  // USD
  currentPrice: number; // USD (oracle)
  size: number;        // SOL (base token units)
  liqPrice: number;    // USD estimate
  pnl: number;         // USD realised + unrealised
  pnlPercent: number;
  capital: number;     // USD collateral deposited
}

export interface UsePositionsResult {
  positions: Position[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

// ---------------------------------------------------------------------------
// Price conversion helpers
// ---------------------------------------------------------------------------

function e6ToNumber(val: bigint): number {
  return Number(val) / 1_000_000;
}

function estimateLiqPrice(
  entryPriceE6: bigint,
  capitalE6: bigint,
  positionSizeE6: bigint,
  maintenanceMarginBps = 500n, // 5%
): number {
  if (positionSizeE6 === 0n || capitalE6 === 0n || entryPriceE6 === 0n) return 0;
  const isLong = positionSizeE6 > 0n;
  const absSize = isLong ? positionSizeE6 : -positionSizeE6;

  // notional = absSize * entryPrice / 1e6
  // liq when: (notional - capital + mm) / notional = 1
  // simplified: liqPrice = entryPrice * (1 - capital/notional + mm_ratio)
  const notionalE12 = absSize * entryPriceE6; // 1e12
  const capitalE12 = capitalE6 * 1_000_000n;

  const mmRatioE6 = maintenanceMarginBps * 100n; // bps → e6
  // liqPriceE6 = entryPriceE6 * (notional - capital + mm*notional) / notional
  //            = entryPriceE6 * (1 - capital/notional + mmRatio/1e6)

  if (isLong) {
    // Long: liq when price falls to:  entry * (1 - capital/notional + mm)
    const liqE6 = (entryPriceE6 * (notionalE12 - capitalE12 + mmRatioE6 * notionalE12 / 1_000_000n)) / notionalE12;
    return e6ToNumber(liqE6 > 0n ? liqE6 : 0n);
  } else {
    // Short: liq when price rises to: entry * (1 + capital/notional - mm)
    const liqE6 = (entryPriceE6 * (notionalE12 + capitalE12 - mmRatioE6 * notionalE12 / 1_000_000n)) / notionalE12;
    return e6ToNumber(liqE6);
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePositions(walletPublicKey: string | null): UsePositionsResult {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!walletPublicKey) {
      setPositions([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    async function load() {
      try {
        // 1. Fetch all markets
        const markets = await api.getMarkets();
        const found: Position[] = [];

        // 2. For each market, fetch the slab account and parse positions
        await Promise.allSettled(
          markets.map(async (market) => {
            try {
              const slabPubkey = new PublicKey(market.slabAddress);
              const accountInfo = await connection.getAccountInfo(slabPubkey);
              if (!accountInfo) return;

              const data = new Uint8Array(accountInfo.data);
              const accounts = parseAccounts(data, walletPublicKey!);

              for (const acct of accounts) {
                if (acct.positionSize === 0n) continue; // no open position

                const isLong = acct.positionSize > 0n;
                const absSize = isLong ? acct.positionSize : -acct.positionSize;

                const entryPrice = e6ToNumber(acct.entryPrice);
                const currentPrice = market.lastPrice ?? entryPrice;
                const capitalUsd = e6ToNumber(acct.capital);
                const sizeUnits = e6ToNumber(absSize); // base token units

                // Unrealised PnL
                const priceMove = isLong
                  ? currentPrice - entryPrice
                  : entryPrice - currentPrice;
                const unrealisedPnl = priceMove * sizeUnits;
                const realisedPnl = e6ToNumber(acct.pnl);
                const totalPnl = unrealisedPnl + realisedPnl;
                const pnlPercent = capitalUsd > 0 ? (totalPnl / capitalUsd) * 100 : 0;

                // Leverage estimate
                const notional = sizeUnits * entryPrice;
                const leverage = capitalUsd > 0 ? notional / capitalUsd : 0;

                const liqPrice = estimateLiqPrice(
                  acct.entryPrice,
                  acct.capital,
                  acct.positionSize,
                );

                found.push({
                  id: `${market.slabAddress}:${acct.accountId.toString()}`,
                  symbol: market.symbol,
                  slabAddress: market.slabAddress,
                  direction: isLong ? 'long' : 'short',
                  leverage: Math.round(leverage * 10) / 10,
                  entryPrice,
                  currentPrice,
                  size: sizeUnits,
                  liqPrice,
                  pnl: totalPnl,
                  pnlPercent: Math.round(pnlPercent * 100) / 100,
                  capital: capitalUsd,
                });
              }
            } catch {
              // market not parseable — skip silently
            }
          }),
        );

        if (!cancelled) {
          // Sort: most at-risk first (closest to liq price)
          found.sort((a, b) => {
            const aDist = a.direction === 'long'
              ? a.currentPrice - a.liqPrice
              : a.liqPrice - a.currentPrice;
            const bDist = b.direction === 'long'
              ? b.currentPrice - b.liqPrice
              : b.liqPrice - b.currentPrice;
            return aDist - bDist;
          });
          setPositions(found);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load positions');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [walletPublicKey, tick]);

  return { positions, loading, error, refresh };
}
