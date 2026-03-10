import React, { useState, useCallback, useEffect, useRef, lazy, Suspense } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text, ActivityIndicator, View, StyleSheet } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import BottomSheet from '@gorhom/bottom-sheet';
import { ConnectWalletSheet } from '../components/wallet/ConnectWalletSheet';
import { useMWA } from '../hooks/useMWA';
import {
  MarketsTabIcon,
  TradeTabIcon,
  PortfolioTabIcon,
  MoreTabIcon,
} from '../components/icons/TabIcons';

import { MarketsScreen } from '../screens/MarketsScreen';
import { TradeScreen } from '../screens/TradeScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';

// Lazy-loaded heavy screens (PERC-505: reduces startup bundle)
const PortfolioScreen = lazy(() =>
  import('../screens/PortfolioScreen').then((m) => ({ default: m.PortfolioScreen }))
);
const FaucetScreen = lazy(() =>
  import('../screens/FaucetScreen').then((m) => ({ default: m.FaucetScreen }))
);
const MarketCreationScreen = lazy(() =>
  import('../screens/MarketCreationScreen').then((m) => ({ default: m.MarketCreationScreen }))
);
const CollateralScreen = lazy(() =>
  import('../screens/CollateralScreen').then((m) => ({ default: m.CollateralScreen }))
);
const EarnScreen = lazy(() =>
  import('../screens/EarnScreen').then((m) => ({ default: m.EarnScreen }))
);
const DashboardScreen = lazy(() =>
  import('../screens/DashboardScreen').then((m) => ({ default: m.DashboardScreen }))
);
const LeaderboardScreen = lazy(() =>
  import('../screens/LeaderboardScreen').then((m) => ({ default: m.LeaderboardScreen }))
);
const StakeScreen = lazy(() =>
  import('../screens/StakeScreen').then((m) => ({ default: m.StakeScreen }))
);
import { colors } from '../theme/tokens';
import { fonts } from '../theme/fonts';
import { usePositionStore } from '../store/positionStore';

const Tab = createBottomTabNavigator();
const MoreStack = createNativeStackNavigator();

/** Active indicator pill above icon + icon wrapped in a column */
function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  let icon: React.ReactNode;
  switch (label) {
    case 'Markets': icon = <MarketsTabIcon focused={focused} />; break;
    case 'Trade':   icon = <TradeTabIcon focused={focused} />;   break;
    case 'Portfolio': icon = <PortfolioTabIcon focused={focused} />; break;
    case 'Earn':    icon = <Text style={{ fontSize: 20 }}>🌿</Text>;     break;
    case 'More':    icon = <MoreTabIcon focused={focused} />;    break;
    default:        icon = null;
  }
  return (
    <View style={tabIconStyles.wrap}>
      {/* 2px accent pill above icon when focused */}
      <View style={[tabIconStyles.indicator, focused && tabIconStyles.indicatorActive]} />
      {icon}
    </View>
  );
}

const tabIconStyles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 4 },
  indicator: { width: 24, height: 2, borderRadius: 1, backgroundColor: 'transparent' },
  indicatorActive: { backgroundColor: colors.accent },
});

/** Suspense fallback for lazy-loaded screens */
function ScreenLoader() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bgVoid, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator color={colors.accent} size="small" />
    </View>
  );
}

/** Wrap a lazy component for use with React Navigation */
function withSuspense<P extends object>(LazyComponent: React.LazyExoticComponent<React.ComponentType<P>>) {
  return function SuspenseWrapper(props: P) {
    return (
      <Suspense fallback={<ScreenLoader />}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}

const LazyPortfolio = withSuspense(PortfolioScreen);
const LazyFaucet = withSuspense(FaucetScreen);
const LazyCreateMarket = withSuspense(MarketCreationScreen);
const LazyCollateral = withSuspense(CollateralScreen);
const LazyEarn = withSuspense(EarnScreen);
const LazyDashboard = withSuspense(DashboardScreen);
const LazyLeaderboard = withSuspense(LeaderboardScreen);
const LazyStake = withSuspense(StakeScreen);

function MoreNavigator() {
  return (
    <MoreStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bgVoid },
      }}
    >
      <MoreStack.Screen name="SettingsHome" component={SettingsScreen} />
      <MoreStack.Screen name="Faucet" component={LazyFaucet} />
      <MoreStack.Screen name="CreateMarket" component={LazyCreateMarket} />
      <MoreStack.Screen name="Collateral" component={LazyCollateral} />
      <MoreStack.Screen name="Dashboard" component={LazyDashboard} />
      <MoreStack.Screen name="Leaderboard" component={LazyLeaderboard} />
      <MoreStack.Screen name="Stake" component={LazyStake} />
    </MoreStack.Navigator>
  );
}

function MainTabs() {
  const openPositionCount = usePositionStore((s) => s.openPositionCount);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bgInset,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontFamily: fonts.mono,
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 0.5,
        },
        tabBarIcon: ({ focused }) => (
          <TabIcon label={route.name} focused={focused} />
        ),
      })}
    >
      <Tab.Screen name="Markets" component={MarketsScreen} />
      <Tab.Screen name="Trade" component={TradeScreen} />
      <Tab.Screen name="Earn" component={LazyEarn} />
      <Tab.Screen
        name="Portfolio"
        component={LazyPortfolio}
        options={{
          tabBarBadge: openPositionCount > 0 ? openPositionCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: colors.accent,
            fontSize: 10,
            fontFamily: fonts.mono,
          },
        }}
      />
      <Tab.Screen name="More" component={MoreNavigator} />
    </Tab.Navigator>
  );
}

const ONBOARDING_KEY = 'percolator_onboarded';

/**
 * Root navigator — shows onboarding on first launch, then main tabs.
 * Onboarding state is persisted in SecureStore so it survives app restarts.
 */
export function RootNavigator() {
  const [onboarded, setOnboarded] = useState<boolean | null>(null); // null = loading
  const { showInstallSheet, dismissInstallSheet } = useMWA();
  const installSheetRef = useRef<BottomSheet>(null);

  // GH #87 — globally mount ConnectWalletSheet so it works from any screen
  useEffect(() => {
    if (showInstallSheet) {
      installSheetRef.current?.expand();
    } else {
      installSheetRef.current?.close();
    }
  }, [showInstallSheet]);

  // Load persisted onboarding state on mount
  useEffect(() => {
    SecureStore.getItemAsync(ONBOARDING_KEY)
      .then((val) => setOnboarded(val === 'true'))
      .catch(() => setOnboarded(false));
  }, []);

  const handleOnboardingComplete = useCallback(async () => {
    setOnboarded(true);
    try {
      await SecureStore.setItemAsync(ONBOARDING_KEY, 'true');
    } catch {
      // Best effort — will re-show onboarding if SecureStore fails
    }
  }, []);

  // Show loading spinner while checking persisted state
  if (onboarded === null) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgVoid, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <>
      {!onboarded ? (
        <OnboardingScreen onComplete={handleOnboardingComplete} />
      ) : (
        <MainTabs />
      )}
      {/* GH #87 — global ConnectWalletSheet so all screens get the branded sheet */}
      <ConnectWalletSheet ref={installSheetRef} onDismiss={dismissInstallSheet} />
    </>
  );
}
