/**
 * Tests for src/lib/sentry.ts
 *
 * Validates that:
 * 1. initSentry() is a no-op when EXPO_PUBLIC_SENTRY_DSN is absent.
 * 2. captureException() is a no-op when DSN is absent.
 * 3. captureException() calls Sentry.captureException when DSN is set.
 * 4. captureException() uses withScope to attach context extras.
 * 5. captureException() never throws even if Sentry itself throws.
 */

describe('sentry lib', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    jest.resetModules();
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('initSentry() is a no-op when DSN is absent', () => {
    delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    const { initSentry } = require('../../src/lib/sentry');
    expect(() => initSentry()).not.toThrow();
  });

  it('captureException() is a no-op when DSN is absent', () => {
    delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    const { captureException } = require('../../src/lib/sentry');
    expect(() => captureException(new Error('test'))).not.toThrow();
  });

  it('captureException() calls Sentry.captureException when DSN is present', () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://fake@sentry.io/123';

    const mockCaptureException = jest.fn();
    const mockInit = jest.fn();
    jest.doMock('@sentry/react-native', () => ({
      init: mockInit,
      captureException: mockCaptureException,
      withScope: (cb: (scope: any) => void) => cb({ setExtra: jest.fn() }),
    }), { virtual: true });

    const { initSentry, captureException } = require('../../src/lib/sentry');
    initSentry();

    const err = new Error('MWA failed');
    captureException(err);

    expect(mockCaptureException).toHaveBeenCalledWith(err);
  });

  it('captureException() attaches context via withScope', () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://fake@sentry.io/123';

    const mockSetExtra = jest.fn();
    const mockCaptureException = jest.fn();
    const mockWithScope = jest.fn((cb: (scope: any) => void) =>
      cb({ setExtra: mockSetExtra }),
    );

    jest.doMock('@sentry/react-native', () => ({
      init: jest.fn(),
      captureException: mockCaptureException,
      withScope: mockWithScope,
    }), { virtual: true });

    const { initSentry, captureException } = require('../../src/lib/sentry');
    initSentry();

    const err = new Error('sign failed');
    captureException(err, { hook: 'useMWA.signAndSend', txCount: 1 });

    expect(mockWithScope).toHaveBeenCalled();
    expect(mockSetExtra).toHaveBeenCalledWith('hook', 'useMWA.signAndSend');
    expect(mockSetExtra).toHaveBeenCalledWith('txCount', 1);
  });

  it('captureException() never throws even if Sentry.captureException throws', () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://fake@sentry.io/123';

    jest.doMock('@sentry/react-native', () => ({
      init: jest.fn(),
      captureException: () => {
        throw new Error('Sentry internals exploded');
      },
      withScope: () => {
        throw new Error('Sentry internals exploded');
      },
    }), { virtual: true });

    const { initSentry, captureException } = require('../../src/lib/sentry');
    initSentry();

    expect(() => captureException(new Error('original'))).not.toThrow();
  });
});
