import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { TradeScreen } from '../screens/TradeScreen';
import { PortfolioScreen } from '../screens/PortfolioScreen';
import { MarketsScreen } from '../screens/MarketsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { colors, fontSizes } from '../theme/tokens';
import { fonts } from '../theme/fonts';

const Tab = createBottomTabNavigator();

export function RootNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingBottom: 4,
          height: 56,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontFamily: fonts.mono,
          fontSize: fontSizes.xs,
          fontWeight: '600',
          letterSpacing: 1,
          textTransform: 'uppercase',
        },
      }}
    >
      <Tab.Screen name="Trade" component={TradeScreen} />
      <Tab.Screen name="Portfolio" component={PortfolioScreen} />
      <Tab.Screen name="Markets" component={MarketsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
