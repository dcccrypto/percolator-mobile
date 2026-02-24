import React, { useState, useCallback } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';

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

/**
 * Root navigator — shows onboarding on first launch, then main tabs.
 * Onboarding is shown until the user connects a wallet.
 */
export function RootNavigator() {
  // TODO: persist onboarding completion state with SecureStore
  const [onboarded, setOnboarded] = useState(false);

  const handleOnboardingComplete = useCallback(() => {
    setOnboarded(true);
  }, []);

  if (!onboarded) {
    return <OnboardingScreen onComplete={handleOnboardingComplete} />;
  }

  return <MainTabs />;
}
