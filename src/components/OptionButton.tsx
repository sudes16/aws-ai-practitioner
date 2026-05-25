import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { ColorScheme } from '../constants/colors';
import { OptionState } from '../constants/types';

interface Props {
  letter: string;
  text: string;
  state: OptionState;
  onPress: () => void;
  disabled: boolean;
  isMulti: boolean;
}

function makeStateStyles(colors: ColorScheme) {
  return {
    default: {
      container: { backgroundColor: colors.optionDefault, borderColor: colors.optionDefaultBorder },
      letter: { backgroundColor: colors.letterDefault },
      letterText: { color: colors.letterDefaultText },
    },
    selected: {
      container: { backgroundColor: colors.optionSelected, borderColor: colors.optionSelectedBorder },
      letter: { backgroundColor: colors.letterSelected },
      letterText: { color: colors.letterSelectedText },
    },
    correct: {
      container: { backgroundColor: colors.correctBg, borderColor: colors.correctBorder },
      letter: { backgroundColor: colors.letterCorrect },
      letterText: { color: colors.letterCorrectText },
      indicator: '✓',
    },
    wrong: {
      container: { backgroundColor: colors.wrongBg, borderColor: colors.wrongBorder },
      letter: { backgroundColor: colors.letterWrong },
      letterText: { color: colors.letterWrongText },
      indicator: '✗',
    },
    missed: {
      container: { backgroundColor: colors.missedBg, borderColor: colors.missedBg },
      letter: { backgroundColor: colors.letterMissed },
      letterText: { color: colors.letterMissedText },
      indicator: '✓',
    },
  } as Record<OptionState, { container: object; letter: object; letterText: object; indicator?: string }>;
}

export default function OptionButton({
  letter,
  text,
  state,
  onPress,
  disabled,
  isMulti,
}: Props) {
  const { colors } = useTheme();
  const stateStyles = useMemo(() => makeStateStyles(colors), [colors]);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const s = stateStyles[state];
  const showCheckBox = isMulti;

  return (
    <TouchableOpacity
      style={[styles.container, s.container]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.75}
      accessibilityLabel={`Option ${letter}: ${text}`}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected: state === 'selected' }}
    >
      {/* Checkbox or Radio indicator */}
      {showCheckBox ? (
        <View
          style={[
            styles.checkbox,
            state === 'selected' || state === 'correct'
              ? styles.checkboxChecked
              : state === 'wrong'
              ? styles.checkboxWrong
              : {},
          ]}
        >
          {(state === 'selected' || state === 'correct' || state === 'wrong' || state === 'missed') && (
            <Text style={styles.checkMark}>{state === 'wrong' ? '✗' : '✓'}</Text>
          )}
        </View>
      ) : (
        <View style={[styles.radio, state === 'selected' ? styles.radioSelected : {}]}>
          {state === 'selected' && <View style={styles.radioDot} />}
        </View>
      )}

      {/* Letter Badge */}
      <View style={[styles.letterCircle, s.letter]}>
        <Text style={[styles.letterText, s.letterText]}>{letter}</Text>
      </View>

      {/* Option Text */}
      <Text style={styles.optionText}>{text}</Text>

      {/* Result indicator */}
      {s.indicator && (
        <Text
          style={[
            styles.indicator,
            { color: state === 'wrong' ? colors.wrong : colors.correct },
          ]}
        >
          {s.indicator}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const makeStyles = (colors: ColorScheme) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    gap: 10,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.optionDefaultBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: colors.letterSelected,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.letterSelected,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.optionDefaultBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.letterSelected,
    borderColor: colors.letterSelected,
  },
  checkboxWrong: {
    backgroundColor: colors.wrong,
    borderColor: colors.wrong,
  },
  checkMark: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  letterCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  letterText: {
    fontSize: 14,
    fontWeight: '700',
  },
  optionText: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  indicator: {
    fontSize: 18,
    fontWeight: '700',
    flexShrink: 0,
  },
});
