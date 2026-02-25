import React, { useState, useCallback, useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text, ActivityIndicator, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import { MarketsScreen } from '../screens/MarketsScreen';
import { TradeScreen } from '../screens/TradeScreen';
import { PortfolioScreen } from '../screens/PortfolioScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { FaucetScreen } from '../screens/FaucetScreen';
import { MarketCreationScreen } from '../screens/MarketCreationScreen';
import { CollateralScreen } from '../screens/CollateralScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { colors } from '../theme/tokens';
import { fonts } from '../theme/fonts';

const Tab = createBottomTabNavigator();
const MoreStack = createNativeStackNavigator();

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Markets: '🏠',
    Trade: '📊',
    Portfolio: '💼',
    More: '⚙',
  };
  return (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>
      {icons[label] ?? '●'}
    </Text>
  );
}

function MoreNavigator() {
  return (
    <MoreStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bgVoid },
      }}
    >
      <MoreStack.Screen name="SettingsHome" component={SettingsScreen} />
      <MoreStack.Screen name="Faucet" component={FaucetScreen} />
      <MoreStack.Screen name="CreateMarket" component={MarketCreationScreen} />
      <MoreStack.Screen name="Collateral" component={CollateralScreen} />
    </MoreStack.Navigator>
  );
}

function MainTabs() {
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
      <Tab.Screen name="Portfolio" component={PortfolioScreen} />
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
