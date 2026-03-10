import React, { forwardRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { colors, radii, spacing } from '../../theme/tokens';
import { fonts } from '../../theme/fonts';

type ErrorKind = 'no-wallet' | 'cancelled' | 'generic';

interface Props {
  kind: ErrorKind;
  onDismiss: () => void;
}

const CONTENT: Record<ErrorKind, { title: string; body: string; cta: string }> = {
  'no-wallet': {
    title: 'Wallet Required',
    body: 'Install a Solana wallet to start trading on Percolator.',
    cta: 'Get Phantom',
  },
  cancelled: {
    title: 'Connection Cancelled',
    body: 'You cancelled the wallet connection. Tap below to try again.',
    cta: 'Try Again',
  },
  generic: {
    title: 'Connection Failed',
    body: 'Something went wrong connecting your wallet. Please try again.',
    cta: 'Retry',
  },
};

export const WalletErrorSheet = forwardRef<BottomSheet, Props>(
  ({ kind, onDismiss }, ref) => {
    const { title, body, cta } = CONTENT[kind];

    const handleCTA = useCallback(() => {
      if (kind === 'no-wallet') {
        Linking.openURL('https://phantom.app/download');
      }
      onDismiss();
    }, [kind, onDismiss]);

    return (
      <BottomSheet
        ref={ref}
        index={-1}
        snapPoints={[280]}
        enablePanDownToClose
        onClose={onDismiss}
        backgroundStyle={s.bg}
        handleIndicatorStyle={s.handle}
      >
        <BottomSheetView style={s.content}>
          <Text style={s.title}>{title}</Text>
          <Text style={s.body}>{body}</Text>

          <TouchableOpacity style={s.ctaBtn} onPress={handleCTA} activeOpacity={0.8}>
            <Text style={s.ctaText}>{cta}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.dismissBtn} onPress={onDismiss} activeOpacity={0.7}>
            <Text style={s.dismissText}>Dismiss</Text>
          </TouchableOpacity>
        </BottomSheetView>
      </BottomSheet>
    );
  },
);

WalletErrorSheet.displayName = 'WalletErrorSheet';

const s = StyleSheet.create({
  bg: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
  },
  handle: { backgroundColor: colors.border, width: 40 },
  content: {
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.md,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: spacing.md,
  },
  ctaBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: radii.md,
    width: '100%',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  ctaText: {
    fontFamily: fonts.heading,
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dismissBtn: {
    paddingVertical: 8,
  },
  dismissText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textMuted,
  },
});
