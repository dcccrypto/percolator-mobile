import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Linking,
  Vibration,
  ActivityIndicator,
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii } from '../theme/tokens';
import { fonts } from '../theme/fonts';
import { useMWA } from '../hooks/useMWA';
import { useDemoStore } from '../store/demoStore';
import { OnboardingSlide, OnboardingSlideData } from '../components/onboarding/OnboardingSlide';
// GH #87 — ConnectWalletSheet moved to RootNavigator
// BottomSheet import removed — GH #87 (ConnectWalletSheet now in RootNavigator)

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/** Crossfade + slide duration in ms */
const TRANSITION_MS = 300;

const SLIDES: OnboardingSlideData[] = [
  {
    index: 1,
    title: 'Permissionless Perps\non Solana',
    subtitle: 'Trade any asset with leverage. No gatekeepers. No KYC.',
  },
  {
    index: 2,
    title: 'Fully On-Chain',
    subtitle: 'Every trade, every position — verifiable on Solana.',
  },
  {
    index: 3,
    title: 'Deploy in 60s',
    subtitle: 'Create your own perpetual market in under a minute.',
  },
];

const WALLETS = [
  { id: 'seed-vault', name: 'Seed Vault', icon: '🔐', recommended: true },
  { id: 'phantom', name: 'Phantom', icon: '👻', recommended: false },
  { id: 'solflare', name: 'Solflare', icon: '🔵', recommended: false },
];

type ConnectStep = null | 'connecting' | 'authorizing' | 'done';

const CONNECT_STEP_TEXT: Record<NonNullable<ConnectStep>, string> = {
  connecting: 'Connecting...',
  authorizing: 'Authorizing...',
  done: 'Done!',
};

interface OnboardingScreenProps {
  onComplete: () => void;
}

// SlideView is replaced by the OnboardingSlide component (react-native-reanimated).

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slideKey, setSlideKey] = useState(0); // forces SlideView remount → re-triggers animation
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | 'none'>('none');
  const [showWallets, setShowWallets] = useState(false);
  const [connectStep, setConnectStep] = useState<ConnectStep>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const { connect, error: mwaError } = useMWA();
  const enterDemo = useDemoStore((s) => s.enterDemo);

  const isTransitioning = useRef(false);

  // GH #87 — ConnectWalletSheet logic moved to RootNavigator (global mount)

  // Translate raw MWA errors into user-friendly messages
  React.useEffect(() => {
    if (!mwaError) return;
    if (mwaError.includes('WALLET_NOT_FOUND') || mwaError.includes('Found no installed wallet')) {
      setConnectError(
        'No compatible wallet app found. Please install Phantom or Solflare from the Play Store and try again.',
      );
    } else if (mwaError.includes('CANCELED') || mwaError.includes('cancelled')) {
      setConnectError('Wallet connection was cancelled.');
    } else {
      // Do not expose raw MWA SDK error strings to users (issue #42)
      // Raw string should be sent to Sentry/logging before mainnet
      setConnectError('Wallet connection failed. Please try again.');
    }
  }, [mwaError]);

  const goToSlide = (next: number, direction: 'left' | 'right') => {
    if (isTransitioning.current) return;
    if (next < 0 || next >= SLIDES.length) return;
    isTransitioning.current = true;
    setSlideDirection(direction);
    setCurrentSlide(next);
    setSlideKey((k) => k + 1);
    setTimeout(() => {
      isTransitioning.current = false;
    }, TRANSITION_MS + 50);
  };

  // Swipe: dx < -50 → next, dx > 50 → prev
  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) =>
      Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderRelease: (_, g) => {
      if (g.dx < -50) {
        Vibration.vibrate(8);
        goToSlide(currentSlide + 1, 'right');
      } else if (g.dx > 50) {
        Vibration.vibrate(8);
        goToSlide(currentSlide - 1, 'left');
      }
    },
  });

  const handleSkip = () => {
    Vibration.vibrate(10);
    onComplete();
  };

  const handleGetStarted = () => {
    Vibration.vibrate(15);
    setShowWallets(true);
  };

  const handleConnect = async () => {
    if (connectStep !== null) return;
    setConnectError(null);
    Vibration.vibrate(15);
    setConnectStep('connecting');
    await new Promise((r) => setTimeout(r, 350));
    setConnectStep('authorizing');
    try {
      const pubkey = await connect();
      if (pubkey) {
        setConnectStep('done');
        await new Promise((r) => setTimeout(r, 400));
        onComplete();
      } else {
        setConnectStep(null);
      }
    } catch {
      setConnectStep(null);
    }
  };

  if (showWallets) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.walletScreen}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => {
              setConnectStep(null);
              setConnectError(null);
              setShowWallets(false);
            }}
            activeOpacity={0.7}
            disabled={connectStep !== null}
          >
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          <Text style={styles.walletTitle}>Connect Your Wallet</Text>

          {connectStep !== null && (
            <View style={styles.connectingRow}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={styles.connectingText}>{CONNECT_STEP_TEXT[connectStep]}</Text>
            </View>
          )}

          {connectError !== null && (
            <View style={styles.errorRow}>
              <Text style={styles.errorText}>{connectError}</Text>
              {connectError.includes('Play Store') && (
                <TouchableOpacity
                  style={styles.installBtn}
                  onPress={() =>
                    Linking.openURL(
                      'https://play.google.com/store/apps/details?id=app.phantom',
                    )
                  }
                  activeOpacity={0.7}
                >
                  <Text style={styles.installBtnText}>Install Phantom</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {WALLETS.map((wallet) => (
            <TouchableOpacity
              key={wallet.id}
              style={[styles.walletOption, connectStep !== null && styles.walletOptionDisabled]}
              onPress={handleConnect}
              disabled={connectStep !== null}
              activeOpacity={0.7}
            >
              <Text style={styles.walletIcon}>{wallet.icon}</Text>
              <View style={styles.walletInfo}>
                <Text style={styles.walletName}>{wallet.name}</Text>
                {wallet.recommended && (
                  <View style={styles.recommendedBadge}>
                    <Text style={styles.recommendedText}>Recommended</Text>
                  </View>
                )}
              </View>
              <Text style={styles.walletArrow}>→</Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={styles.importLink}
            activeOpacity={0.7}
            onPress={handleConnect}
            disabled={connectStep !== null}
          >
            <Text style={styles.importLinkText}>
              Already have an account? <Text style={styles.importLinkAccent}>Connect wallet</Text>
            </Text>
          </TouchableOpacity>
        </View>

        {/* GH #87 — ConnectWalletSheet moved to RootNavigator for global coverage */}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Skip button */}
      <View style={styles.skipRow}>
        <TouchableOpacity
          onPress={handleSkip}
          activeOpacity={0.7}
          style={styles.skipBtn}
          testID="onboarding-skip"
        >
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Animated carousel area — swipe left/right to navigate */}
      <View style={styles.carouselArea} {...panResponder.panHandlers}>
        <OnboardingSlide
          key={slideKey}
          slide={SLIDES[currentSlide]}
          direction={slideDirection}
          durationMs={TRANSITION_MS}
          screenWidth={SCREEN_WIDTH}
        />
      </View>

      {/* Pagination dots — tappable */}
      <View style={styles.pagination}>
        {SLIDES.map((_, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => {
              if (i !== currentSlide) {
                Vibration.vibrate(8);
                goToSlide(i, i > currentSlide ? 'right' : 'left');
              }
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <View style={[styles.dot, currentSlide === i && styles.dotActive]} />
          </TouchableOpacity>
        ))}
      </View>

      {/* CTA — "Next →" on slides 1-2, "Get Started" on last slide (section 5.6) */}
      {currentSlide < SLIDES.length - 1 ? (
        <TouchableOpacity
          style={styles.ctaOutline}
          onPress={() => {
            Vibration.vibrate(8);
            goToSlide(currentSlide + 1, 'right');
          }}
          activeOpacity={0.8}
          testID="onboarding-next"
        >
          <Text style={styles.ctaOutlineText}>Next →</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.ctaGroup}>
          <TouchableOpacity
            style={styles.cta}
            onPress={handleGetStarted}
            activeOpacity={0.8}
            testID="onboarding-cta"
          >
            <Text style={styles.ctaText}>Get Started</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.demoBtn}
            onPress={() => {
              Vibration.vibrate(10);
              enterDemo();
              onComplete();
            }}
            activeOpacity={0.8}
            testID="onboarding-demo"
          >
            <Text style={styles.demoBtnText}>Try Demo Mode</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgVoid,
  },
  skipRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  skipBtn: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  skipText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textMuted,
  },
  carouselArea: {
    flex: 1,
    overflow: 'hidden',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.textMuted,
  },
  dotActive: {
    backgroundColor: colors.accent,
    width: 24,
  },
  cta: {
    backgroundColor: colors.accent,
    height: 52,
    borderRadius: radii.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctaText: {
    fontFamily: fonts.display,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  ctaOutline: {
    height: 52,
    borderRadius: radii.xl,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ctaOutlineText: {
    fontFamily: fonts.display,
    fontSize: 16,
    fontWeight: '700',
    color: colors.accent,
  },
  // Wallet screen
  backBtn: {
    alignSelf: 'flex-start',
    marginBottom: 24,
    paddingVertical: 4,
  },
  backText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
  },
  walletScreen: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  walletTitle: {
    fontFamily: fonts.display,
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 24,
  },
  connectingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
    backgroundColor: colors.accentSubtle,
    borderRadius: radii.md,
    paddingVertical: 10,
  },
  connectingText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.accent,
    fontWeight: '600',
  },
  walletOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    height: 64,
    borderRadius: radii.lg,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  walletOptionDisabled: {
    opacity: 0.5,
  },
  walletIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  walletInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  walletName: {
    fontFamily: fonts.display,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  recommendedBadge: {
    backgroundColor: colors.longSubtle,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  recommendedText: {
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: '600',
    color: colors.long,
  },
  walletArrow: {
    fontFamily: fonts.mono,
    fontSize: 18,
    color: colors.textMuted,
  },
  importLink: {
    marginTop: 24,
    alignItems: 'center',
    paddingVertical: 8,
  },
  importLinkText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textSecondary,
  },
  importLinkAccent: {
    color: colors.accent,
    fontWeight: '600',
  },
  ctaGroup: {
    gap: 8,
    marginHorizontal: 24,
    marginBottom: 24,
  },
  demoBtn: {
    height: 48,
    borderRadius: radii.xl,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed' as any,
  },
  demoBtnText: {
    fontFamily: fonts.display,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  errorRow: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderRadius: radii.lg,
    padding: 14,
    marginBottom: 16,
    alignItems: 'center' as const,
  },
  errorText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: '#ef4444',
    textAlign: 'center' as const,
    lineHeight: 18,
  },
  installBtn: {
    marginTop: 10,
    backgroundColor: colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: radii.full,
  },
  installBtnText: {
    fontFamily: fonts.display,
    fontSize: 13,
    fontWeight: '700' as const,
    color: colors.text,
  },
});
