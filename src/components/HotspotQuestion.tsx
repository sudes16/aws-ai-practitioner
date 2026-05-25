import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { shadow } from '../utils/styleUtils';
import { ColorScheme } from '../constants/colors';

interface HotspotQuestionProps {
  /** The answer choices pool, e.g. {"A": "Real-time inference", "B": "Batch transform"} */
  options: Record<string, string>;
  /** Correct answer letter per row, e.g. ["A","B","A"] — length = number of rows */
  correctOrder: string[];
  /**
   * Optional item descriptions for matching-style questions.
   * When provided: each row shows the item text as a card (matching layout).
   * When absent/empty: rows are labeled "Step 1", "Step 2", … (ordering layout).
   */
  itemLabels?: string[];
  /** Parent-managed selections; index = row, value = chosen letter or '' */
  selections: string[];
  onSelectionsChange: (selections: string[]) => void;
  submitted: boolean;
  isReviewing: boolean;
  reviewSelections?: string[];
}

export default function HotspotQuestion({
  options,
  correctOrder,
  itemLabels,
  selections,
  onSelectionsChange,
  submitted,
  isReviewing,
  reviewSelections,
}: HotspotQuestionProps) {
  const [openStep, setOpenStep] = useState<number | null>(null);
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const isLocked = submitted || isReviewing;
  const effectiveSelections = isReviewing ? (reviewSelections ?? []) : selections;
  const optionEntries = Object.entries(options);
  const numSteps = correctOrder.length;
  const isMatchingLayout = !!(itemLabels && itemLabels.length > 0);

  const getStatus = (idx: number): 'correct' | 'wrong' | 'neutral' => {
    if (!isLocked) return 'neutral';
    const chosen = (effectiveSelections[idx] ?? '').toUpperCase();
    return chosen === correctOrder[idx].toUpperCase() ? 'correct' : 'wrong';
  };

  const handleSelect = (stepIdx: number, letter: string) => {
    const next = [...selections];
    next[stepIdx] = letter;
    onSelectionsChange(next);
    setOpenStep(null);
  };

  // ── Shared dropdown button renderer ─────────────────────────────────────
  const renderDropdown = (i: number) => {
    const status = getStatus(i);
    const chosenLetter = effectiveSelections[i] ?? '';
    const chosenText = chosenLetter ? (options[chosenLetter] ?? chosenLetter) : '';
    const borderStyle =
      isLocked && status === 'correct'
        ? styles.dropdownCorrect
        : isLocked && status === 'wrong'
        ? styles.dropdownWrong
        : null;

    return (
      <View>
        <TouchableOpacity
          style={[styles.dropdown, borderStyle]}
          onPress={() => !isLocked && setOpenStep(i)}
          disabled={isLocked}
          activeOpacity={isLocked ? 1 : 0.7}
          accessibilityRole="button"
          accessibilityLabel={
            isMatchingLayout
              ? `Item ${i + 1}: ${chosenText || 'Select an answer'}`
              : `Step ${i + 1}: ${chosenText || 'Select an answer'}`
          }
        >
          <Text
            style={[styles.dropdownText, !chosenText && styles.dropdownPlaceholder]}
            numberOfLines={2}
          >
            {chosenText || 'Select an answer…'}
          </Text>
          {!isLocked && <Text style={styles.arrow}>▼</Text>}
          {isLocked && status === 'correct' && (
            <Text style={[styles.statusIcon, { color: colors.correct }]}>✓</Text>
          )}
          {isLocked && status === 'wrong' && (
            <Text style={[styles.statusIcon, { color: colors.wrong }]}>✗</Text>
          )}
        </TouchableOpacity>
        {isLocked && status === 'wrong' && (
          <Text style={styles.correctHint}>
            ✓ Correct: {options[correctOrder[i]] ?? correctOrder[i]}
          </Text>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.hint}>
        {isMatchingLayout
          ? 'Match each item to the correct answer using the dropdown.'
          : 'For each step, tap the dropdown and select the correct answer.'}
      </Text>

      {Array.from({ length: numSteps }, (_, i) => {
        if (isMatchingLayout) {
          // ── Card layout for matching questions ───────────────────────────
          const status = getStatus(i);
          return (
            <View
              key={i}
              style={[
                styles.matchCard,
                isLocked && status === 'correct' && styles.matchCardCorrect,
                isLocked && status === 'wrong' && styles.matchCardWrong,
              ]}
            >
              <Text style={styles.matchItemIndex}>Item {i + 1}</Text>
              <Text style={styles.matchItemText}>{itemLabels![i]}</Text>
              {renderDropdown(i)}
            </View>
          );
        } else {
          // ── Row layout for ordering questions ────────────────────────────
          return (
            <View key={i} style={styles.stepRow}>
              <View style={styles.stepLabelWrap}>
                <Text style={styles.stepLabel}>Step {i + 1}</Text>
              </View>
              <View style={styles.stepRight}>{renderDropdown(i)}</View>
            </View>
          );
        }
      })}

      {/* ── Option picker modal ── */}
      <Modal
        visible={openStep !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setOpenStep(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          onPress={() => setOpenStep(null)}
          activeOpacity={1}
        >
          <TouchableOpacity
            style={styles.pickerCard}
            activeOpacity={1}
            onPress={() => {/* swallow inner touches */}}
          >
            <Text style={styles.pickerTitle}>
              {isMatchingLayout
                ? `Item ${(openStep ?? 0) + 1} — Select the correct answer:`
                : `Step ${(openStep ?? 0) + 1} — Select the correct answer:`}
            </Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {optionEntries.map(([letter, text]) => {
                const isSelected =
                  (effectiveSelections[openStep ?? 0] ?? '') === letter;
                return (
                  <TouchableOpacity
                    key={letter}
                    style={[
                      styles.pickerOption,
                      isSelected && styles.pickerOptionSelected,
                    ]}
                    onPress={() => handleSelect(openStep!, letter)}
                    activeOpacity={0.75}
                  >
                    <View
                      style={[
                        styles.pickerBadge,
                        isSelected && styles.pickerBadgeSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.pickerBadgeText,
                          isSelected && styles.pickerBadgeTextSelected,
                        ]}
                      >
                        {letter}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.pickerOptionText,
                        isSelected && styles.pickerOptionTextSelected,
                      ]}
                    >
                      {text}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const makeStyles = (colors: ColorScheme) => StyleSheet.create({
  container: { marginTop: 4 },
  hint: {
    fontSize: 13,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: 14,
  },

  // ── Ordering layout ──
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  stepLabelWrap: { width: 58, paddingTop: 13 },
  stepLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  stepRight: { flex: 1 },

  // ── Matching layout ──
  matchCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
  },
  matchCardCorrect: {
    borderColor: colors.correct,
    backgroundColor: colors.correctBg,
  },
  matchCardWrong: {
    borderColor: colors.wrong,
    backgroundColor: colors.wrongBg,
  },
  matchItemIndex: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  matchItemText: {
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
    marginBottom: 10,
  },

  // ── Shared dropdown ──
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBg,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
  },
  dropdownCorrect: {
    borderColor: colors.correct,
    backgroundColor: colors.correctBg,
  },
  dropdownWrong: {
    borderColor: colors.wrong,
    backgroundColor: colors.wrongBg,
  },
  dropdownText: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  dropdownPlaceholder: { color: colors.textMuted, fontStyle: 'italic' },
  arrow: { fontSize: 11, color: colors.textSecondary, marginLeft: 8 },
  statusIcon: { fontSize: 16, fontWeight: '700', marginLeft: 8 },
  correctHint: {
    fontSize: 12,
    color: colors.correct,
    marginTop: 5,
    marginLeft: 4,
    fontStyle: 'italic',
  },

  // ── Modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.52)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  pickerCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 480,
    maxHeight: 460,
    ...shadow('#000', 6, 0.22, 14),
    elevation: 10,
  },
  pickerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 14,
    letterSpacing: 0.2,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: 9,
    marginBottom: 7,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  pickerOptionSelected: {
    borderColor: colors.awsOrange,
    backgroundColor: colors.optionSelected,
  },
  pickerBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  pickerBadgeSelected: { backgroundColor: colors.awsOrange },
  pickerBadgeText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  pickerBadgeTextSelected: { color: '#FFFFFF' },
  pickerOptionText: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  pickerOptionTextSelected: { fontWeight: '500', color: colors.textPrimary },
});
