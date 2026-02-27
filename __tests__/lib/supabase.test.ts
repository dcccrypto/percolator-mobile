/**
 * Tests for src/lib/supabase.ts
 */
import { isConfigured, supabase } from '../../src/lib/supabase';

describe('supabase', () => {
  it('exports isConfigured flag', () => {
    expect(typeof isConfigured).toBe('boolean');
  });

  it('isConfigured is false when env vars are not set', () => {
    // In test env, EXPO_PUBLIC_SUPABASE_URL and KEY are not set
    expect(isConfigured).toBe(false);
  });

  it('exports a supabase client (even when not configured)', () => {
    expect(supabase).toBeDefined();
    expect(typeof supabase).toBe('object');
  });
});
