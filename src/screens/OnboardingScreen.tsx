import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii } from '../theme/tokens';
import { fonts } from '../theme/fonts';
import { useMWA } from '../hooks/useMWA';
import { OnboardingIcon } from '../components/icons/OnboardingIcon';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SLIDES = [
  {
    title: 'Permissionless Perps\non Solana',
    subtitle: 'Trade any asset with leverage. No gatekeepers. No KYC.',
    icon: 'perps' as const,
  },
  {
    title: 'Fully On-Chain',
    subtitle: 'Every trade, every position — verifiable on Solana.',
    icon: 'onchain' as const,
  },
  {
    title: 'Deploy in 60s',
    subtitle: 'Create your own perpetual market in under a minute.',
    icon: 'deploy' as const,
  },
];

const WALLETS = [
  { id: 'seed-vault', name: 'Seed Vault', icon: '🔐', recommended: true },
  { id: 'phantom', name: 'Phantom', icon: '👻', recommended: false },
  { id: 'solflare', name: 'Solflare', icon: '🔵', recommended: false },
];

interface OnboardingScreenProps {
  onComplete: () => void;
}

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showWallets, setShowWallets] = useState(false);
  const { connect, connecting } = useMWA();
  const flatListRef = useRef<FlatList>(null);

  const handleConnect = async () => {
    const pubkey = await connect();
    if (pubkey) onComplete();
  };

  if (showWallets) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.walletScreen}>
          <Text style={styles.walletTitle}>Connect Your Wallet</Text>

          {WALLETS.map((wallet) => (
            <TouchableOpacity
              key={wallet.id}
              style={styles.walletOption}
              onPress={handleConnect}
              disabled={connecting}
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
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          setCurrentSlide(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH));
        }}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
            <View style={styles.slideIconWrap}>
              <OnboardingIcon type={item.icon} size={72} />
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
        onPress={() => setShowWallets(true)}
        activeOpacity={0.8}
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
    marginBottom: 32,
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
