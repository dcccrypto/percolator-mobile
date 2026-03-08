/**
 * PartialCloseSheet — Bottom sheet for partial position close.
 * User picks a percentage (25/50/75/100) or enters custom size.
 */
import React, { useState, useCallback, useMemo, forwardRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { colors, radii } from '../../theme/tokens';
import { fonts } from '../../theme/fonts';
import type { Position } from '../../hooks/usePositions';

const PERCENT_PRESETS = [25, 50, 75, 100];

interface Props {
  position: Position | null;
  submitting: boolean;
  onClose: (position: Position, sizeToClose: number) => void;
}

export const PartialCloseSheet = forwardRef<BottomSheet, Props>(
  ({ position, submitting, onClose }, ref) => {
    const [selectedPct, setSelectedPct] = useState<number | null>(null);
    const [customSize, setCustomSize] = useState('');

    const snapPoints = useMemo(() => ['45%'], []);

    const sizeToClose = useMemo(() => {
      if (!position) return 0;
      if (selectedPct != null) {
        return (position.size * selectedPct) / 100;
      }
      const parsed = parseFloat(customSize);
      return isNaN(parsed) ? 0 : Math.min(parsed, position.size);
    }, [position, selectedPct, customSize]);

    const handlePctPress = useCallback((pct: number) => {
      setSelectedPct(pct);
      setCustomSize('');
    }, []);

    const handleCustomChange = useCallback((text: string) => {
      setCustomSize(text);
      setSelectedPct(null);
    }, []);

    const handleSubmit = useCallback(() => {
      if (!position || sizeToClose <= 0) return;
      onClose(position, sizeToClose);
    }, [position, sizeToClose, onClose]);

    if (!position) return null;

    const isLong = position.direction === 'long';
    const estimatedPnl =
      sizeToClose > 0
        ? ((isLong
            ? position.currentPrice - position.entryPrice
            : position.entryPrice - position.currentPrice) *
            sizeToClose)
        : 0;
    const pnlPositive = estimatedPnl >= 0;

    return (
      <BottomSheet
        ref={ref}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backgroundStyle={sheetStyles.bg}
        handleIndicatorStyle={sheetStyles.indicator}
      >
        <BottomSheetView style={sheetStyles.content}>
          <Text style={sheetStyles.title}>
            Close {position.direction.toUpperCase()} {position.symbol}
          </Text>

          {/* Current position info */}
          <View style={sheetStyles.infoRow}>
            <Text style={sheetStyles.infoLabel}>Position Size</Text>
            <Text style={sheetStyles.infoValue}>{position.size.toFixed(4)}</Text>
          </View>
          <View style={sheetStyles.infoRow}>
            <Text style={sheetStyles.infoLabel}>Entry</Text>
            <Text style={sheetStyles.infoValue}>${position.entryPrice.toFixed(2)}</Text>
          </View>
          <View style={sheetStyles.infoRow}>
            <Text style={sheetStyles.infoLabel}>Current</Text>
            <Text style={sheetStyles.infoValue}>${position.currentPrice.toFixed(2)}</Text>
          </View>

          {/* Percentage presets */}
          <View style={sheetStyles.pctRow}>
            {PERCENT_PRESETS.map((pct) => (
              <TouchableOpacity
                key={pct}
                style={[
                  sheetStyles.pctBtn,
                  selectedPct === pct && sheetStyles.pctBtnActive,
                ]}
                onPress={() => handlePctPress(pct)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    sheetStyles.pctText,
                    selectedPct === pct && sheetStyles.pctTextActive,
                  ]}
                >
                  {pct}%
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Custom size input */}
          <View style={sheetStyles.customRow}>
            <Text style={sheetStyles.customLabel}>Or enter size:</Text>
            <TextInput
              style={sheetStyles.customInput}
              value={customSize}
              onChangeText={handleCustomChange}
              placeholder="0.00"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
            />
          </View>

          {/* Estimated PnL */}
          {sizeToClose > 0 && (
            <View style={sheetStyles.infoRow}>
              <Text style={sheetStyles.infoLabel}>Est. PnL on close</Text>
              <Text
                style={[
                  sheetStyles.infoValue,
                  { color: pnlPositive ? colors.long : colors.short },
                ]}
              >
                {pnlPositive ? '+' : ''}${estimatedPnl.toFixed(2)}
              </Text>
            </View>
          )}

          {/* Close button */}
          <TouchableOpacity
            style={[
              sheetStyles.closeBtn,
              (sizeToClose <= 0 || submitting) && sheetStyles.closeBtnDisabled,
            ]}
            onPress={handleSubmit}
            disabled={sizeToClose <= 0 || submitting}
            activeOpacity={0.8}
          >
            {submitting ? (
              <ActivityIndicator color={colors.text} size="small" />
            ) : (
              <Text style={sheetStyles.closeBtnText}>
                Close {sizeToClose > 0 ? sizeToClose.toFixed(4) : '—'}{' '}
                {position.symbol.split('-')[0]}
              </Text>
            )}
          </TouchableOpacity>
        </BottomSheetView>
      </BottomSheet>
    );
  },
);

PartialCloseSheet.displayName = 'PartialCloseSheet';

const sheetStyles = StyleSheet.create({
  bg: {
    backgroundColor: colors.bgElevated,
  },
  indicator: {
    backgroundColor: colors.textMuted,
    width: 40,
  },
  content: {
    padding: 20,
    gap: 12,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoLabel: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textMuted,
  },
  infoValue: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  pctRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  pctBtn: {
    flex: 1,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.bgInset,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  pctBtnActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  pctText: {
    fontFamily: fonts.mono,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  pctTextActive: {
    color: colors.text,
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  customLabel: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textSecondary,
  },
  customInput: {
    flex: 1,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.bgInset,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.text,
  },
  closeBtn: {
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.short,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  closeBtnDisabled: {
    opacity: 0.4,
  },
  closeBtnText: {
    fontFamily: fonts.display,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
});
