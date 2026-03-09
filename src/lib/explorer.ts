/**
 * Explorer URL helpers — supports Solscan, SolanaFM, and Solana Explorer.
 */

type ExplorerName = 'Solscan' | 'SolanaFM' | 'Solana Explorer';

/**
 * Build a transaction explorer URL for the given signature.
 */
export function getExplorerUrl(
  signature: string,
  explorer: ExplorerName,
  cluster: string,
): string {
  const clusterParam = cluster === 'mainnet-beta' ? '' : `?cluster=${cluster}`;

  switch (explorer) {
    case 'Solscan':
      return `https://solscan.io/tx/${signature}${clusterParam}`;
    case 'SolanaFM':
      return `https://solana.fm/tx/${signature}${clusterParam}`;
    case 'Solana Explorer':
      return `https://explorer.solana.com/tx/${signature}${clusterParam}`;
    default:
      return `https://solana.fm/tx/${signature}${clusterParam}`;
  }
}

/**
 * Build an address (account/wallet) explorer URL.
 */
export function getAddressUrl(
  address: string,
  explorer: ExplorerName,
  cluster: string,
): string {
  const clusterParam = cluster === 'mainnet-beta' ? '' : `?cluster=${cluster}`;

  switch (explorer) {
    case 'Solscan':
      return `https://solscan.io/account/${address}${clusterParam}`;
    case 'SolanaFM':
      return `https://solana.fm/address/${address}${clusterParam}`;
    case 'Solana Explorer':
      return `https://explorer.solana.com/address/${address}${clusterParam}`;
    default:
      return `https://solana.fm/address/${address}${clusterParam}`;
  }
}
