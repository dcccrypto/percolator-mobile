/**
 * WizardProgressBar — 5-step horizontal progress indicator for CreateMarketWizard.
 *
 * Per designer spec: HACKATHON-MOBILE-UX-SPECS.md §4
 *
 * States:
 *   Done    — accent circle with ✓, connector filled
 *   Active  — larger circle with pulse animation, bold label
 *   Pending — muted circle, dim label
 *
 * On screens <375dp: show numbers only, active step label above as tooltip pill.
 */
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  useWindowDimensions,
} from 'react-native';

const ACCENT = '#9945FF';
const VIOLET_ACTIVE = '#7C3AED';
const VIOLET_RING = '#C084FC';
const BG_INSET = '#141820';
const BORDER = '#1C1F2E';
const TEXT = '#E1E2E8';
const TEXT_MUTED = '#454B5F';
const BG_CONTAINER = '#0A0A0F';

const STEPS = [
  'Market Details',
  'Oracle Config',
  'Parameters',
  'Liquidity',
  'Review & Launch',
];

interface WizardProgressBarProps {
  currentStep: number; // 0-indexed
  totalSteps?: number;
}

function StepNode({
  index,
  label,
  state,
  compact,
}: {
  index: number;
  label: string;
  state: 'done' | 'active' | 'pending';
  compact: boolean;
}) {
  // Pulse animation for active step
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (state !== 'active') {
      pulseAnim.setValue(1);
      return;
    }

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 1000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1.0,
          duration: 1000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [state, pulseAnim]);

  const circleSize =
    state === 'done' ? 24 : state === 'active' ? 28 : 22;

  return (
    <View style={nodeStyles.wrapper}>
      {/* Active tooltip pill above (compact mode only) */}
      {compact && state === 'active' && (
        <View style={nodeStyles.tooltipPill}>
          <Text style={nodeStyles.tooltipText} numberOfLines={1}>
            {label}
          </Text>
        </View>
      )}

      {/* Circle */}
      <Animated.View
        style={[
          nodeStyles.circle,
          {
            width: circleSize,
            height: circleSize,
            borderRadius: circleSize / 2,
          },
          state === 'done' && nodeStyles.circleDone,
          state === 'active' && nodeStyles.circleActive,
          state === 'pending' && nodeStyles.circlePending,
          state === 'active' && { transform: [{ scale: pulseAnim }] },
        ]}
      >
        {state === 'done' ? (
          <Text style={nodeStyles.checkmark}>✓</Text>
        ) : (
          <Text
            style={[
              nodeStyles.stepNumber,
              state === 'active' && nodeStyles.stepNumberActive,
              state === 'pending' && nodeStyles.stepNumberPending,
            ]}
          >
            {index + 1}
          </Text>
        )}
      </Animated.View>

      {/* Label — hidden in compact mode */}
      {!compact && (
        <Text
          style={[
            nodeStyles.label,
            state === 'done' && nodeStyles.labelDone,
            state === 'active' && nodeStyles.labelActive,
            state === 'pending' && nodeStyles.labelPending,
          ]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {label}
        </Text>
      )}
    </View>
  );
}

const nodeStyles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    flex: 1,
  },
  circle: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleDone: {
    backgroundColor: ACCENT,
  },
  circleActive: {
    backgroundColor: VIOLET_ACTIVE,
    borderWidth: 2,
    borderColor: VIOLET_RING,
  },
  circlePending: {
    backgroundColor: BG_INSET,
    borderWidth: 1.5,
    borderColor: BORDER,
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  stepNumber: {
    fontWeight: '500',
    fontSize: 11,
  },
  stepNumberActive: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  stepNumberPending: {
    color: TEXT_MUTED,
  },
  label: {
    marginTop: 4,
    fontSize: 9,
    fontWeight: '400',
    textAlign: 'center',
  },
  labelDone: {
    color: ACCENT,
    fontWeight: '600',
  },
  labelActive: {
    color: TEXT,
    fontSize: 10,
    fontWeight: '700',
  },
  labelPending: {
    color: TEXT_MUTED,
  },
  tooltipPill: {
    position: 'absolute',
    top: -28,
    backgroundColor: BORDER,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    minWidth: 60,
    alignItems: 'center',
  },
  tooltipText: {
    color: TEXT,
    fontSize: 9,
    fontWeight: '600',
  },
});

interface ConnectorProps {
  filled: boolean;
}

function Connector({ filled }: ConnectorProps) {
  const fillAnim = useRef(new Animated.Value(filled ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(fillAnim, {
      toValue: filled ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [filled, fillAnim]);

  return (
    <View style={connectorStyles.track}>
      <Animated.View
        style={[
          connectorStyles.fill,
          {
            flex: fillAnim,
          },
        ]}
      />
    </View>
  );
}

const connectorStyles = StyleSheet.create({
  track: {
    flex: 1,
    height: 2,
    backgroundColor: BORDER,
    alignSelf: 'center',
    overflow: 'hidden',
    flexDirection: 'row',
  },
  fill: {
    height: 2,
    backgroundColor: ACCENT,
  },
});

export function WizardProgressBar({
  currentStep,
  totalSteps = 5,
}: WizardProgressBarProps) {
  const { width } = useWindowDimensions();
  const compact = width < 375;
  const steps = STEPS.slice(0, totalSteps);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {steps.map((label, i) => {
          const state: 'done' | 'active' | 'pending' =
            i < currentStep ? 'done' : i === currentStep ? 'active' : 'pending';

          return (
            <React.Fragment key={label}>
              <StepNode
                index={i}
                label={label}
                state={state}
                compact={compact}
              />
              {i < steps.length - 1 && (
                <Connector filled={i < currentStep} />
              )}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 64,
    paddingHorizontal: 16,
    backgroundColor: BG_CONTAINER,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
