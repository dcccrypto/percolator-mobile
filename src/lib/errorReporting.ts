/**
 * errorReporting.ts — lightweight error-capture abstraction.
 *
 * Raw MWA / wallet errors are captured here (server-side / remote only).
 * Sanitized, user-facing strings are handled by the UI layer separately.
 *
 * Wiring Sentry (devops checklist):
 *  1. `npx expo install @sentry/react-native`
 *  2. Run `npx @sentry/wizard@latest -i reactNative` (patches native build files)
 *  3. Set `EXPO_PUBLIC_SENTRY_DSN` in `.env` / Expo EAS Secrets
 *  4. Uncomment the Sentry block in `initErrorReporting()` below
 *  5. Remove the `_consoleFallback` path
 */

type SentryLike = {
  init: (opts: { dsn: string; environment?: string }) => void;
  captureException: (error: unknown, ctx?: object) => string;
  captureMessage: (message: string, ctx?: object) => string;
};

let _sentry: SentryLike | null = null;

/**
 * Call once at app startup (e.g. in App.tsx before rendering).
 * No-op when `EXPO_PUBLIC_SENTRY_DSN` is not set.
 */
export function initErrorReporting(): void {
  const dsn = process.env['EXPO_PUBLIC_SENTRY_DSN'];
  if (!dsn) return;

  // TODO(devops): uncomment after `npx expo install @sentry/react-native` is run
  // and native pods/gradle files are patched:
  //
  // const Sentry = require('@sentry/react-native') as SentryLike;
  // Sentry.init({
  //   dsn,
  //   environment: process.env['EXPO_PUBLIC_ENV'] ?? 'production',
  // });
  // _sentry = Sentry;

  console.warn(
    '[ErrorReporting] EXPO_PUBLIC_SENTRY_DSN is set but @sentry/react-native is not yet installed. ' +
    'Follow the devops checklist in src/lib/errorReporting.ts to complete Sentry wiring.',
  );
}

/**
 * Capture a raw (unsanitized) exception for remote monitoring.
 * Never exposed to the user — UI layer uses its own sanitized messages.
 *
 * @param error   The raw Error object (or unknown thrown value)
 * @param context Optional key-value metadata (hook name, operation, etc.)
 */
export function captureException(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  if (_sentry) {
    _sentry.captureException(error, context ? { extra: context } : undefined);
  } else {
    // Console fallback (dev + pre-Sentry production builds).
    // Intentionally verbose so errors are easy to spot in dev.
    console.error('[ErrorReporting] captureException:', error, context ?? '');
  }
}

/**
 * Capture a diagnostic message (non-fatal).
 */
export function captureMessage(
  message: string,
  context?: Record<string, unknown>,
): void {
  if (_sentry) {
    _sentry.captureMessage(
      message,
      context ? { extra: context } : undefined,
    );
  } else {
    console.warn('[ErrorReporting] captureMessage:', message, context ?? '');
  }
}

/**
 * Exposed for testing — allows tests to inject a mock Sentry instance.
 * No-op in production builds so test infrastructure never ships as an
 * active code path.
 *
 * @internal — import only in test files
 */
export function _setReporterForTest(mock: SentryLike | null): void {
  if (process.env['NODE_ENV'] === 'production') return;
  _sentry = mock;
}
