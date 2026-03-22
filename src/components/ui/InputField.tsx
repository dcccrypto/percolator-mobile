import React from 'react';
import { View, TextInput, Text, Pressable, StyleSheet, ViewStyle } from 'react-native';
import { colors, radii } from '../../theme/tokens';
import { fonts } from '../../theme/fonts';

interface InputFieldProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  /** Prefix displayed inside the input row — e.g. "$" for size inputs. */
  prefix?: string;
  suffix?: string;
  rightAction?: { label: string; onPress: () => void };
  keyboardType?: 'default' | 'numeric' | 'decimal-pad';
  /** Maximum number of characters allowed. Enforced natively on iOS/Android. */
  maxLength?: number;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  style?: ViewStyle;
}

export function InputField({
  label,
  value,
  onChangeText,
  placeholder,
  prefix,
  suffix,
  rightAction,
  keyboardType = 'default',
  maxLength,
  autoCapitalize,
  autoCorrect,
  style,
}: InputFieldProps) {
  return (
    <View style={style}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.container}>
        {prefix && <Text style={styles.prefix}>{prefix}</Text>}
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          keyboardType={keyboardType}
          maxLength={maxLength}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          selectionColor={colors.accent}
        />
        {suffix && <Text style={styles.suffix}>{suffix}</Text>}
        {rightAction && (
          <Pressable
            onPress={rightAction.onPress}
            style={({ pressed }) => [styles.maxBtn, pressed && { opacity: 0.75 }]}
            accessibilityRole="button"
            accessibilityLabel={rightAction.label}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.maxBtnText}>{rightAction.label}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    backgroundColor: colors.bgInset,
    borderRadius: radii.lg,
    paddingHorizontal: 16,
  },
  prefix: {
    fontFamily: fonts.mono,
    fontSize: 20,
    color: colors.textMuted,
    marginRight: 4,
  },
  input: {
    flex: 1,
    fontFamily: fonts.mono,
    fontSize: 20,
    color: colors.text,
  },
  suffix: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.textMuted,
    marginLeft: 8,
  },
  /** §4.5 MAX button — accentPillBg bg, accent text, radii.full, 36px height */
  maxBtn: {
    backgroundColor: colors.accentPillBg,
    borderRadius: radii.full,
    height: 36,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  maxBtnText: {
    fontFamily: fonts.display,
    fontSize: 13,
    fontWeight: '700',
    color: colors.accent,
    letterSpacing: 0.5,
  },
});
