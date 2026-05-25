import React, { useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { ColorScheme } from '../constants/colors';
import { stripMarkdown } from '../utils/quizEngine';

interface Props {
  visible: boolean;
  explanation: string;
  correctAnswer: string;
  isCorrect: boolean | null;
  onClose: () => void;
}

export default function ExplanationModal({
  visible,
  explanation,
  correctAnswer,
  isCorrect,
  onClose,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>📖 Explanation</Text>
              {isCorrect !== null && (
                <View
                  style={[
                    styles.resultPill,
                    isCorrect ? styles.pillCorrect : styles.pillWrong,
                  ]}
                >
                  <Text style={styles.pillText}>
                    {isCorrect ? '✓ Correct' : '✗ Wrong'}
                  </Text>
                </View>
              )}
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close explanation" accessibilityRole="button">
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Correct answer row */}
          <View style={styles.answerRow}>
            <Text style={styles.answerLabel}>Correct Answer: </Text>
            <Text style={styles.answerValue}>{correctAnswer}</Text>
          </View>

          {/* Explanation body */}
          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.explanationText}>
              {stripMarkdown(explanation)}
            </Text>
            <View style={{ height: 24 }} />
          </ScrollView>

          <TouchableOpacity style={styles.doneBtn} onPress={onClose} accessibilityLabel="Close explanation" accessibilityRole="button">
            <Text style={styles.doneBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (colors: ColorScheme) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingBottom: 20,
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  resultPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  pillCorrect: {
    backgroundColor: colors.correctBg,
  },
  pillWrong: {
    backgroundColor: colors.wrongBg,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  answerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.correctBg,
  },
  answerLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  answerValue: {
    fontSize: 14,
    color: colors.correct,
    fontWeight: '700',
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 12,
    maxHeight: 420,
  },
  explanationText: {
    fontSize: 15,
    color: colors.textPrimary,
    lineHeight: 24,
    flexShrink: 1,
    // break long URLs so they don't cause horizontal overflow
    ...({ overflowWrap: 'break-word', wordBreak: 'break-word' } as object),
  },
  doneBtn: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: colors.awsDark,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  doneBtnText: {
    color: colors.textLight,
    fontSize: 16,
    fontWeight: '700',
  },
});
