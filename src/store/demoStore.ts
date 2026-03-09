/**
 * Demo mode store — tracks whether the user is in demo/guest mode.
 *
 * Demo mode lets users explore the app without a wallet connection.
 * Called from OnboardingScreen "Try Demo Mode" CTA.
 */
import { create } from 'zustand';

interface DemoState {
  /** True when the user has chosen to explore in demo mode (no wallet). */
  isDemoMode: boolean;
  /** Enter demo/guest mode. Sets isDemoMode = true. */
  enterDemo: () => void;
  /** Exit demo mode (e.g. on wallet connect or explicit sign-out). */
  exitDemo: () => void;
}

export const useDemoStore = create<DemoState>((set) => ({
  isDemoMode: false,
  enterDemo: () => set({ isDemoMode: true }),
  exitDemo: () => set({ isDemoMode: false }),
}));
