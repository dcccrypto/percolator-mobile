import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/**
 * Supabase client — guarded against empty credentials.
 * When env vars are missing, the client is still created (to avoid import errors)
 * but `isConfigured` will be false so callers can check before making requests.
 */
export const isConfigured = SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;

let supabase: SupabaseClient;
if (isConfigured) {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
  // Create a dummy client that won't crash on import but will fail gracefully on use.
  // In dev, log a warning so developers know to set env vars.
  if (__DEV__) {
    console.warn(
      '[Supabase] EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are not set. ' +
        'Supabase features will not work.',
    );
  }
  supabase = createClient('https://placeholder.supabase.co', 'placeholder-key');
}

export { supabase };
