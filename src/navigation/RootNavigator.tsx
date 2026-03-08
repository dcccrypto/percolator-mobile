import React, { useState, useCallback, useEffect, lazy, Suspense } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text, ActivityIndicator, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as SecureStore from 'expo-secure-store';

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
import { colors } from '../theme/tokens';
import { fonts } from '../theme/fonts';
import { usePositionStore } from '../store/positionStore';

const Tab = createBottomTabNavigator();
const MoreStack = createNativeStackNavigator();

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
    Markets: 'trending-up',
    Trade: 'bar-chart',
    Portfolio: 'briefcase',
    More: 'menu',
  };
  return (
    <Ionicons
      name={icons[label] ?? 'ellipse'}
      size={22}
      color={focused ? colors.accent : colors.textMuted}
    />
  );
}

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

  if (!onboarded) {
    return <OnboardingScreen onComplete={handleOnboardingComplete} />;
  }

  return <MainTabs />;
}
