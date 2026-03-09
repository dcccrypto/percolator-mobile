/**
 * Tests for src/lib/errorReporting.ts
 *
 * Verifies that:
 *  - captureException forwards to Sentry when a mock reporter is injected
 *  - captureException falls back to console.error when no reporter is set
 *  - captureMessage behaves symmetrically
 *  - initErrorReporting is a no-op when EXPO_PUBLIC_SENTRY_DSN is absent
 */
import {
  captureException,
  captureMessage,
  initErrorReporting,
  _setReporterForTest,
} from '../../src/lib/errorReporting';

describe('errorReporting', () => {
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    // Suppress console output during tests
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    // Reset reporter to null before each test
    _setReporterForTest(null);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    _setReporterForTest(null);
  });

  // ── captureException ───────────────────────────────────────────────────

  it('captureException: calls console.error when no Sentry reporter is set', () => {
    const err = new Error('raw MWA error');
    captureException(err);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[ErrorReporting] captureException:',
      err,
      '',
    );
  });

  it('captureException: passes context to console.error', () => {
    const err = new Error('connect failed');
    captureException(err, { source: 'useMWA.connect' });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[ErrorReporting] captureException:',
      err,
      { source: 'useMWA.connect' },
    );
  });

  it('captureException: forwards to Sentry.captureException when reporter is set', () => {
    const mockCaptureException = jest.fn().mockReturnValue('event-id');
    const mockSentry = {
      init: jest.fn(),
      captureException: mockCaptureException,
      captureMessage: jest.fn(),
    };
    _setReporterForTest(mockSentry);

    const err = new Error('wallet timeout');
    captureException(err, { source: 'useMWA.connect' });

    expect(mockCaptureException).toHaveBeenCalledWith(err, {
      extra: { source: 'useMWA.connect' },
    });
    // Console fallback should NOT be called
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('captureException: forwards without context when context is omitted', () => {
    const mockCaptureException = jest.fn().mockReturnValue('event-id');
    _setReporterForTest({
      init: jest.fn(),
      captureException: mockCaptureException,
      captureMessage: jest.fn(),
    });

    const err = new Error('no context error');
    captureException(err);

    expect(mockCaptureException).toHaveBeenCalledWith(err, undefined);
  });

  it('captureException: handles non-Error thrown values', () => {
    captureException('string thrown value');
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[ErrorReporting] captureException:',
      'string thrown value',
      '',
    );
  });

  it('captureException: handles null error gracefully', () => {
    expect(() => captureException(null)).not.toThrow();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  // ── captureMessage ─────────────────────────────────────────────────────

  it('captureMessage: calls console.warn when no reporter is set', () => {
    captureMessage('diagnostic message');
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[ErrorReporting] captureMessage:',
      'diagnostic message',
      '',
    );
  });

  it('captureMessage: forwards to Sentry.captureMessage when reporter is set', () => {
    const mockCaptureMessage = jest.fn().mockReturnValue('event-id');
    _setReporterForTest({
      init: jest.fn(),
      captureException: jest.fn(),
      captureMessage: mockCaptureMessage,
    });

    captureMessage('auth token missing', { wallet: 'phantom' });

    expect(mockCaptureMessage).toHaveBeenCalledWith('auth token missing', {
      extra: { wallet: 'phantom' },
    });
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  // ── initErrorReporting ─────────────────────────────────────────────────

  it('initErrorReporting: is a no-op when EXPO_PUBLIC_SENTRY_DSN is not set', () => {
    delete process.env['EXPO_PUBLIC_SENTRY_DSN'];
    expect(() => initErrorReporting()).not.toThrow();
    // No reporter installed — console fallback still active
    captureException(new Error('test'));
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('initErrorReporting: warns when DSN is set but SDK not installed', () => {
    process.env['EXPO_PUBLIC_SENTRY_DSN'] = 'https://fake@sentry.io/123';
    initErrorReporting();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('@sentry/react-native is not yet installed'),
    );
    delete process.env['EXPO_PUBLIC_SENTRY_DSN'];
  });
});
