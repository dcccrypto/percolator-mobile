/**
 * jest.env.js — loaded before jest.setup.js via setupFiles.
 *
 * pnpm resolves react-test-renderer transitively to a slightly different patch
 * version than react itself (e.g. 19.2.4 vs 19.1.0). @testing-library/react-
 * native's peer-dep guard throws on any exact-version mismatch; the official
 * escape hatch is RNTL_SKIP_DEPS_CHECK=true.
 *
 * See: https://callstack.github.io/react-native-testing-library/docs/migration-guide
 */
process.env.RNTL_SKIP_DEPS_CHECK = 'true';

// ---------------------------------------------------------------------------
// Test environment stubs for required env vars.
// These are safe placeholder values used only in tests — never real credentials.
// Real values are set via EAS Secrets (production) or .env.local (development).
// ---------------------------------------------------------------------------
process.env.EXPO_PUBLIC_RPC_URL =
  process.env.EXPO_PUBLIC_RPC_URL ||
  'https://devnet.helius-rpc.com/?api-key=test-key-placeholder';
process.env.EXPO_PUBLIC_HELIUS_API_KEY =
  process.env.EXPO_PUBLIC_HELIUS_API_KEY || 'test-key-placeholder';
