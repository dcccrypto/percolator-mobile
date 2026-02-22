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
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(239, 68, 68, 0.2)',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  warning: {
    backgroundColor: 'rgba(234, 179, 8, 0.1)',
    borderBottomColor: 'rgba(234, 179, 8, 0.2)',
  },
  error: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderBottomColor: 'rgba(239, 68, 68, 0.2)',
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
