/**
 * ConnectWalletSheet — Branded bottom sheet shown when no MWA wallet is installed.
 * Replaces the raw Alert.alert (GH #77). Single CTA, dark theme, no raw wallet names.
 */
import React, { forwardRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
} from 'react-native';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { colors, radii, spacing } from '../../theme/tokens';
import { fonts } from '../../theme/fonts';

interface Props {
  onDismiss?: () => void;
}

const PHANTOM_URL = 'https://play.google.com/store/apps/details?id=app.phantom';
const SOLFLARE_URL = 'https://play.google.com/store/apps/details?id=com.solflare.mobile';

const INSTALL_OPTIONS = [
  { id: 'phantom', label: 'Get Phantom', icon: '👻', url: PHANTOM_URL },
  { id: 'solflare', label: 'Get Solflare', icon: '🔵', url: SOLFLARE_URL },
] as const;

export const ConnectWalletSheet = forwardRef<BottomSheet, Props>(
  ({ onDismiss }, ref) => {
    const snapPoints = useMemo(() => ['44%'], []);

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          opacity={0.7}
        />
      ),
      [],
    );

    return (
      <BottomSheet
        ref={ref}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        onClose={onDismiss}
        backdropComponent={renderBackdrop}
        backgroundStyle={s.bg}
        handleIndicatorStyle={s.handle}
      >
        <BottomSheetView style={s.content}>
          {/* Icon */}
          <View style={s.iconWrap}>
            <Text style={s.iconGlyph}>🔗</Text>
          </View>

          {/* Heading */}
          <Text style={s.title}>Connect a Wallet</Text>
          <Text style={s.subtitle}>
            A Solana wallet app is required to trade on Percolator. Install one to continue.
          </Text>

          {/* Divider */}
          <View style={s.divider} />

          {/* Install CTAs */}
          <View style={s.optionList}>
            {INSTALL_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.id}
                style={s.optionRow}
                activeOpacity={0.75}
                onPress={() => Linking.openURL(opt.url)}
              >
                <Text style={s.optionIcon}>{opt.icon}</Text>
                <Text style={s.optionLabel}>{opt.label}</Text>
                <Text style={s.optionArrow}>→</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Dismiss */}
          <TouchableOpacity
            style={s.dismissBtn}
            activeOpacity={0.7}
            onPress={onDismiss}
          >
            <Text style={s.dismissText}>Maybe later</Text>
          </TouchableOpacity>
        </BottomSheetView>
      </BottomSheet>
    );
  },
);

ConnectWalletSheet.displayName = 'ConnectWalletSheet';

const s = StyleSheet.create({
  bg: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
  },
  handle: {
    backgroundColor: colors.border,
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing[6],
    paddingTop: spacing[4],
    paddingBottom: spacing[6],
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: radii.full,
    backgroundColor: colors.accentSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing[4],
  },
  iconGlyph: {
    fontSize: 26,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: spacing[4],
    paddingHorizontal: spacing[2],
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: spacing[4],
  },
  optionList: {
    gap: spacing[2],
    marginBottom: spacing[4],
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    backgroundColor: colors.bgInset,
    borderRadius: radii.lg,
    paddingHorizontal: spacing[4],
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionIcon: {
    fontSize: 22,
    marginRight: spacing[3],
  },
  optionLabel: {
    flex: 1,
    fontFamily: fonts.display,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  optionArrow: {
    fontFamily: fonts.mono,
    fontSize: 16,
    color: colors.textMuted,
  },
  dismissBtn: {
    alignItems: 'center',
    paddingVertical: spacing[3],
  },
  dismissText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textMuted,
  },
});
