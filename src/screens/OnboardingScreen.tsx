import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Dimensions,
  Vibration,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii } from '../theme/tokens';
import { fonts } from '../theme/fonts';
import { useMWA } from '../hooks/useMWA';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// eslint-disable-next-line @typescript-eslint/no-require-imports
const SLIDE_IMAGES = {
  perps: require('../../assets/onboarding/slide-1-perps.png') as number,
  onchain: require('../../assets/onboarding/slide-2-onchain.png') as number,
  deploy: require('../../assets/onboarding/slide-3-deploy.png') as number,
};

const SLIDES = [
  {
    title: 'Permissionless Perps\non Solana',
    subtitle: 'Trade any asset with leverage. No gatekeepers. No KYC.',
    image: 'perps' as const,
  },
  {
    title: 'Fully On-Chain',
    subtitle: 'Every trade, every position — verifiable on Solana.',
    image: 'onchain' as const,
  },
  {
    title: 'Deploy in 60s',
    subtitle: 'Create your own perpetual market in under a minute.',
    image: 'deploy' as const,
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

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showWallets, setShowWallets] = useState(false);
  const [connectStep, setConnectStep] = useState<ConnectStep>(null);
  const { connect } = useMWA();
  const flatListRef = useRef<FlatList>(null);

  const handleSkip = () => {
    Vibration.vibrate(10);
    onComplete();
  };

  const handleGetStarted = () => {
    Vibration.vibrate(15);
    setShowWallets(true);
  };

  const handleConnect = async () => {
    if (connectStep !== null) return; // prevent double-tap
    Vibration.vibrate(15);
    setConnectStep('connecting');
    // Brief pause so user sees "Connecting..." before MWA dialog opens
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
          {/* Back button */}
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => {
              setConnectStep(null);
              setShowWallets(false);
            }}
            activeOpacity={0.7}
            disabled={connectStep !== null}
          >
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          <Text style={styles.walletTitle}>Connect Your Wallet</Text>

          {/* Loading step indicator */}
          {connectStep !== null && (
            <View style={styles.connectingRow}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={styles.connectingText}>{CONNECT_STEP_TEXT[connectStep]}</Text>
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

          <TouchableOpacity style={styles.importLink} activeOpacity={0.7}>
            <Text style={styles.importText}>Already have an account? Import wallet</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Skip button — visible from slide 1 */}
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

      <FlatList
        ref={flatListRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          setCurrentSlide(idx);
          Vibration.vibrate(8);
        }}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
            <View style={styles.slideIconWrap} testID={`slide-icon-${item.image}`}>
              <Image
                source={SLIDE_IMAGES[item.image]}
                style={styles.slideImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.slideTitle}>{item.title}</Text>
            <Text style={styles.slideSubtitle}>{item.subtitle}</Text>
          </View>
        )}
      />

      {/* Pagination dots */}
      <View style={styles.pagination}>
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, currentSlide === i && styles.dotActive]}
          />
        ))}
      </View>

      {/* CTA */}
      <TouchableOpacity
        style={styles.cta}
        onPress={handleGetStarted}
        activeOpacity={0.8}
        testID="onboarding-cta"
      >
        <Text style={styles.ctaText}>Get Started →</Text>
      </TouchableOpacity>
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
  slide: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  slideIconWrap: {
    marginBottom: 24,
    alignItems: 'center' as const,
  },
  slideImage: {
    width: SCREEN_WIDTH * 0.7,
    height: SCREEN_WIDTH * 0.7,
  },
  slideTitle: {
    fontFamily: fonts.display,
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  slideSubtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
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
    marginHorizontal: 24,
    marginBottom: 24,
  },
  ctaText: {
    fontFamily: fonts.display,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
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
  },
  importText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textSecondary,
  },
});
