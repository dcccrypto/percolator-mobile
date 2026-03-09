/**
 * Sentry initialisation and helpers.
 *
 * DSN is read from EXPO_PUBLIC_SENTRY_DSN (set in .env / EAS secrets).
 * When the DSN is absent (local dev, CI) the module is a no-op so the
 * rest of the app compiles and runs without Sentry being present.
 */

/* eslint-disable @typescript-eslint/no-require-imports */

// Lazy reference — populated on first call to getSentry() / initSentry()
let _Sentry: typeof import('@sentry/react-native') | null = null;

function getSentry(): typeof import('@sentry/react-native') | null {
  if (_Sentry) return _Sentry;
  try {
    // Use require() so Jest mocks applied via jest.mock/jest.doMock work correctly.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    _Sentry = require('@sentry/react-native') as typeof import('@sentry/react-native');
    return _Sentry;
  } catch {
    return null;
  }
}

/** Call once in App.tsx before any navigation mounts. */
export function initSentry(): void {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  const Sentry = getSentry();
  if (!Sentry) return;

  Sentry.init({
    dsn,
    // Capture 20% of traces on devnet; tune before mainnet
    tracesSampleRate: 0.2,
    // PII scrubbing: strip wallet addresses from breadcrumbs
    beforeBreadcrumb(breadcrumb) {
      if (
        breadcrumb.message &&
        /[1-9A-HJ-NP-Za-km-z]{32,44}/.test(breadcrumb.message)
      ) {
        breadcrumb.message = breadcrumb.message.replace(
          /[1-9A-HJ-NP-Za-km-z]{32,44}/g,
          '[address]',
        );
      }
      return breadcrumb;
    },
  });
}

/**
 * Capture an exception in Sentry.
 * Safe to call even when Sentry is not initialised — the call is silently
 * dropped instead of throwing.
 *
 * @param err       The caught error value.
 * @param context   Optional key/value extras added as Sentry "extra" data.
 */
export function captureException(
  err: unknown,
  context?: Record<string, unknown>,
): void {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  const Sentry = getSentry();
  if (!Sentry) return;

  try {
    if (context) {
      Sentry.withScope((scope) => {
        Object.entries(context).forEach(([k, v]) => scope.setExtra(k, v));
        Sentry.captureException(err);
      });
    } else {
      Sentry.captureException(err);
    }
  } catch {
    // Never let Sentry errors surface to the user.
  }
}
