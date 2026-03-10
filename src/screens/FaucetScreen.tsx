/**
 * FaucetScreen — redesigned per designer hackathon spec.
 *
 * Per designer spec: HACKATHON-MOBILE-UX-SPECS.md §2
 *
 * 3 sections:
 *   1. SOL Balance — JetBrains Mono 40sp, "Devnet" amber subtext
 *   2. Airdrop SOL — violet full-width CTA, loading + success states
 *   3. Mint Test Tokens — CA input + secondary MINT TOKENS button
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Animated,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { colors } from '../theme/tokens';
import { fonts } from '../theme/fonts';
import { connection } from '../lib/solana';
import { useMWA } from '../hooks/useMWA';

// Spec-exact design tokens
const VIOLET = '#7C3AED';
const AMBER = '#E5A100';
const ACCENT = '#9945FF';
const BG_CARD = '#0F1018';
const BG_INSET = '#141820';
const BORDER = '#1C1F2E';
const TEXT = '#E1E2E8';
const TEXT_MUTED = '#454B5F';
const TEXT_SECONDARY = '#7A7F96';
const GREEN_SUCCESS = '#14F195';
const RED_ERROR = '#FF3B5C';
const AMBER_BG = '#1A1200';

// Toast types
type ToastState = { type: 'success' | 'error'; message: string } | null;

function Toast({ state }: { state: ToastState }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!state) {
      opacity.setValue(0);
      return;
    }
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2500),
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [state, opacity]);

  if (!state) return null;

  return (
    <Animated.View
      style={[
        toastStyles.container,
        state.type === 'success' ? toastStyles.success : toastStyles.error,
        { opacity },
      ]}
      pointerEvents="none"
    >
      <Text style={toastStyles.text}>{state.message}</Text>
    </Animated.View>
  );
}

const toastStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    zIndex: 100,
  },
  success: { backgroundColor: GREEN_SUCCESS },
  error: { backgroundColor: RED_ERROR },
  text: {
    color: '#06060C',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});

type AirdropButtonState = 'idle' | 'loading' | 'success';

export function FaucetScreen() {
  const navigation = useNavigation<any>();
  const { connected, publicKey, balance, refreshBalance } = useMWA();

  const [airdropState, setAirdropState] = useState<AirdropButtonState>('idle');
  const [caInput, setCaInput] = useState('');
  const [mintLoading, setMintLoading] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [inputFocused, setInputFocused] = useState(false);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3200);
  }, []);

  const handleAirdrop = useCallback(async () => {
    if (!connected || !publicKey || airdropState !== 'idle') return;
    setAirdropState('loading');
    try {
      const lamports = 2 * LAMPORTS_PER_SOL;
      const sig = await connection.requestAirdrop(publicKey, lamports);
      await connection.confirmTransaction(sig, 'confirmed');
      setAirdropState('success');
      refreshBalance();
      setTimeout(() => setAirdropState('idle'), 2000);
    } catch (err) {
      setAirdropState('idle');
      const msg = err instanceof Error ? err.message : 'Airdrop failed';
      showToast('error', msg);
    }
  }, [connected, publicKey, airdropState, refreshBalance, showToast]);

  const handleMintTokens = useCallback(async () => {
    if (!caInput.trim() || mintLoading) return;
    setMintLoading(true);
    try {
      // Backend faucet endpoint: POST /api/faucet/mint
      // Use the same env-var base as MarketCreationScreen so Railway URL is respected.
      const API_BASE = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://percolatorlaunch.com/api';
      const resp = await fetch(`${API_BASE}/faucet/mint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mint: caInput.trim(), wallet: publicKey?.toBase58() }),
      });
      if (!resp.ok) throw new Error(`Server error: ${resp.status}`);
      showToast('success', '✓ Test tokens minted!');
      setCaInput('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Mint failed';
      showToast('error', msg);
    } finally {
      setMintLoading(false);
    }
  }, [caInput, mintLoading, publicKey, showToast]);

  // Airdrop button appearance
  const airdropBg =
    airdropState === 'success' ? GREEN_SUCCESS : VIOLET;
  const airdropTextColor =
    airdropState === 'success' ? '#06060C' : '#FFFFFF';
  const airdropLabel =
    airdropState === 'loading'
      ? null
      : airdropState === 'success'
      ? '✓ 2 SOL Requested'
      : 'REQUEST SOL AIRDROP';

  const mintDisabled = !caInput.trim() || mintLoading;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {/* Toast overlay */}
      <Toast state={toast} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Faucet</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── SECTION 1: SOL BALANCE ── */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>YOUR SOL BALANCE</Text>
          <Text style={styles.balanceValue}>
            {connected && balance != null
              ? `${balance.toFixed(2)} SOL`
              : '0.00 SOL'}
          </Text>
          <Text style={styles.networkBadge}>Devnet</Text>
        </View>

        {/* ── SECTION 2: AIRDROP SOL ── */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[
              styles.airdropBtn,
              { backgroundColor: airdropBg },
              (!connected || airdropState !== 'idle') && styles.airdropBtnDisabled,
            ]}
            onPress={handleAirdrop}
            disabled={!connected || airdropState !== 'idle'}
            activeOpacity={0.85}
          >
            {airdropState === 'loading' ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={[styles.airdropBtnText, { color: airdropTextColor }]}>
                🪂  {airdropLabel}
              </Text>
            )}
          </TouchableOpacity>
          <Text style={styles.airdropHint}>
            ~2 SOL per request · Devnet only
          </Text>
        </View>

        {/* ── SECTION 3: MINT TOKENS ── */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>MINT TEST TOKENS</Text>

          <Text style={styles.inputLabel}>Token Contract Address</Text>
          <TextInput
            style={[
              styles.caInput,
              inputFocused && styles.caInputFocused,
            ]}
            value={caInput}
            onChangeText={setCaInput}
            placeholder="Enter CA..."
            placeholderTextColor={TEXT_MUTED}
            autoCapitalize="none"
            autoCorrect={false}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
          />

          <TouchableOpacity
            style={[
              styles.mintBtn,
              mintDisabled && styles.mintBtnDisabled,
            ]}
            onPress={handleMintTokens}
            disabled={mintDisabled}
            activeOpacity={0.8}
          >
            {mintLoading ? (
              <ActivityIndicator color={ACCENT} size="small" />
            ) : (
              <Text style={styles.mintBtnText}>MINT TOKENS</Text>
            )}
          </TouchableOpacity>
        </View>

        {!connected && (
          <Text style={styles.connectHint}>Connect your wallet to use the faucet.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bgVoid,
  },

  // Header
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 32,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  backArrow: {
    fontSize: 28,
    color: TEXT,
    fontWeight: '300',
    lineHeight: 32,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: TEXT,
    fontFamily: fonts.display,
  },

  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },

  // Section 1 — Balance card
  balanceCard: {
    marginHorizontal: 16,
    marginTop: 32,
    backgroundColor: BG_CARD,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
  },
  balanceLabel: {
    fontFamily: fonts.display,
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_SECONDARY,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  balanceValue: {
    fontFamily: fonts.mono,
    fontSize: 40,
    fontWeight: '700',
    color: TEXT,
    lineHeight: 48,
  },
  networkBadge: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '500',
    color: AMBER,
    fontFamily: fonts.body,
  },

  // Section wrapper
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },

  // Section 2 — Airdrop
  airdropBtn: {
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  airdropBtnDisabled: {
    opacity: 0.55,
  },
  airdropBtnText: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: fonts.display,
  },
  airdropHint: {
    marginTop: 8,
    fontSize: 12,
    color: TEXT_MUTED,
    textAlign: 'center',
    fontFamily: fonts.body,
  },

  // Section 3 — Mint tokens
  sectionHeader: {
    fontFamily: fonts.display,
    fontSize: 11,
    fontWeight: '600',
    color: TEXT_SECONDARY,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  inputLabel: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: TEXT_SECONDARY,
    marginBottom: 6,
  },
  caInput: {
    height: 52,
    borderRadius: 12,
    backgroundColor: BG_INSET,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 16,
    fontSize: 13,
    color: TEXT,
    fontFamily: fonts.mono,
  },
  caInputFocused: {
    borderColor: VIOLET,
  },
  mintBtn: {
    height: 52,
    borderRadius: 12,
    backgroundColor: BG_INSET,
    borderWidth: 1,
    borderColor: ACCENT,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  mintBtnDisabled: {
    opacity: 0.4,
  },
  mintBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: ACCENT,
    fontFamily: fonts.display,
  },

  connectHint: {
    marginTop: 24,
    fontSize: 13,
    color: TEXT_MUTED,
    textAlign: 'center',
    fontFamily: fonts.body,
  },
});
