import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, radii } from '../../theme/tokens';
import { fonts } from '../../theme/fonts';

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  return (
    <View style={styles.banner}>
      <Text style={styles.text}>⚠ {message}</Text>
      {onRetry && (
        <TouchableOpacity onPress={onRetry} activeOpacity={0.7}>
          <Text style={styles.retry}>Retry</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/** Connection lost banner — shows at top of screen */
export function ConnectionBanner({ status }: { status: string }) {
  if (status === 'connected') return null;

  return (
    <View style={[styles.banner, status === 'connecting' ? styles.warning : styles.error]}>
      <Text style={styles.text}>
        {status === 'connecting' ? '⏳ Reconnecting...' : '❌ Connection lost'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.shortSubtle,
    borderBottomWidth: 1,
    borderBottomColor: colors.shortBorder,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  warning: {
    backgroundColor: colors.warningSubtle,
    borderBottomColor: colors.warningBorder,
  },
  error: {
    backgroundColor: colors.shortSubtle,
    borderBottomColor: colors.shortBorder,
  },
  text: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.text,
  },
  retry: {
    fontFamily: fonts.display,
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent,
  },
});
