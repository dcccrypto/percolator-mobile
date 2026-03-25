import { Connection } from '@solana/web3.js';

/**
 * Confirm a transaction using the blockhash context form, which validates
 * against the specific blockhash window and checks confirmation.value.err so
 * dropped/replaced transactions don't silently succeed.
 *
 * Error handling:
 * - On-chain failures (err !== null): re-thrown so callers can surface them.
 * - Network/RPC/polling errors: logged as warnings (tx may still land), not re-thrown.
 *   Explicit timeout/signature-not-found errors are treated as non-fatal polling noise.
 */
export async function confirmTransactionSafe(
  connection: Connection,
  signature: string,
  blockhash: string,
  lastValidBlockHeight: number,
): Promise<void> {
  try {
    const confirmation = await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      'confirmed',
    );
    if (confirmation.value.err) {
      throw new Error(`Transaction failed on-chain: ${JSON.stringify(confirmation.value.err)}`);
    }
  } catch (confirmErr) {
    // Re-throw definitive on-chain failures
    if (confirmErr instanceof Error && confirmErr.message.startsWith('Transaction failed on-chain')) {
      throw confirmErr;
    }
    // Log non-fatal polling/network/timeout errors — sig may still land
    console.warn('[confirmTransaction] Confirmation polling error (tx may still land):', confirmErr);
  }
}
