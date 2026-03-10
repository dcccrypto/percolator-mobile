import React from 'react';
import { View, TextInput, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, radii } from '../../theme/tokens';
import { fonts } from '../../theme/fonts';

interface InputFieldProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
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
          <Text style={styles.rightAction} onPress={rightAction.onPress}>
            {rightAction.label}
          </Text>
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
  rightAction: {
    fontFamily: fonts.display,
    fontSize: 13,
    fontWeight: '600',
    color: colors.cyan,
    marginLeft: 8,
  },
});
