/**
 * SuccessToast — slides down after a successful trade submission.
 * Shows tx signature with a link to Solscan.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Linking } from 'react-native';
import { colors, radii } from '../../theme/tokens';
import { fonts } from '../../theme/fonts';

interface Props {
  visible: boolean;
  txSignature: string | null;
  message?: string;
  durationMs?: number;
  onDismiss: () => void;
}

export function SuccessToast({
  visible,
  txSignature,
  message = 'Trade submitted!',
  durationMs = 4000,
  onDismiss,
}: Props) {
  const translateY = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 12,
      }).start();

      const timer = setTimeout(() => {
        Animated.timing(translateY, {
          toValue: -100,
          duration: 200,
          useNativeDriver: true,
        }).start(() => onDismiss());
      }, durationMs);

      return () => clearTimeout(timer);
    } else {
      translateY.setValue(-100);
    }
  }, [visible, durationMs, onDismiss, translateY]);

  if (!visible) return null;

  const shortSig = txSignature
    ? `${txSignature.slice(0, 8)}…${txSignature.slice(-8)}`
    : null;

  const explorerUrl = txSignature
    ? `https://solscan.io/tx/${txSignature}?cluster=devnet`
    : null;

  return (
    <Animated.View style={[s.container, { transform: [{ translateY }] }]}>
      <View style={s.inner}>
        <Text style={s.checkmark}>✓</Text>
        <View style={s.textCol}>
          <Text style={s.message}>{message}</Text>
          {shortSig && explorerUrl && (
            <TouchableOpacity onPress={() => Linking.openURL(explorerUrl)}>
              <Text style={s.sig}>{shortSig} — View on Solscan ↗</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    zIndex: 1000,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radii.md,
    backgroundColor: colors.longSubtle,
    borderWidth: 1,
    borderColor: colors.long,
  },
  checkmark: {
    fontSize: 20,
    color: colors.long,
  },
  textCol: {
    flex: 1,
    gap: 2,
  },
  message: {
    fontFamily: fonts.display,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  sig: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.long,
  },
});
