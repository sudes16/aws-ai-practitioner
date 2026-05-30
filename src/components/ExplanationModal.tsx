import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { ColorScheme } from '../constants/colors';
import { stripMarkdown } from '../utils/quizEngine';
import { getAiExplanation, getAiKey } from '../utils/aiService';

interface Props {
  visible: boolean;
  explanation: string;
  correctAnswer: string;
  isCorrect: boolean | null;
  onClose: () => void;
  // Optional context for AI
  questionText?: string;
  optionsText?: string;
}

export default function ExplanationModal({
  visible,
  explanation,
  correctAnswer,
  isCorrect,
  onClose,
  questionText,
  optionsText,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const handleFetchAi = async () => {
    if (!questionText || !optionsText) return;

    const key = await getAiKey();
    if (!key) {
      setAiError("To use AI insights, please add your Gemini API Key in the Settings tab.");
      return;
    }

    setAiError(null);
    setLoadingAi(true);
    try {
      const result = await getAiExplanation(questionText, optionsText, correctAnswer);
      setAiExplanation(result);
    } finally {
      setLoadingAi(false);
    }
  };

  const handleClose = () => {
    setAiExplanation(null);
    setAiError(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
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
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn} accessibilityLabel="Close explanation" accessibilityRole="button">
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

            {aiExplanation && (
              <View style={styles.aiBox}>
                <Text style={styles.aiTitle}>✨ Gemini AI Insights</Text>
                <Text style={styles.aiText}>{aiExplanation}</Text>
              </View>
            )}

            {aiError && (
              <View style={[styles.aiBox, { borderColor: colors.wrong + '60' }]}>
                <Text style={[styles.aiTitle, { color: colors.wrong }]}>🔑 Setup Required</Text>
                <Text style={styles.aiText}>{aiError}</Text>
              </View>
            )}

            {loadingAi && (
              <View style={styles.aiLoading}>
                <ActivityIndicator color={colors.awsOrange} />
                <Text style={styles.aiLoadingText}>Gemini is thinking...</Text>
              </View>
            )}

            {!aiExplanation && !loadingAi && questionText && (
              <TouchableOpacity style={styles.aiBtn} onPress={handleFetchAi}>
                <Text style={styles.aiBtnText}>💡 Deep Dive with AI</Text>
              </TouchableOpacity>
            )}

            <View style={{ height: 24 }} />
          </ScrollView>

          <TouchableOpacity style={styles.doneBtn} onPress={handleClose} accessibilityLabel="Close explanation" accessibilityRole="button">
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
  },
  aiBox: {
    marginTop: 20,
    padding: 16,
    backgroundColor: colors.awsOrange + '15',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.awsOrange + '40',
  },
  aiTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.awsOrange,
    marginBottom: 8,
  },
  aiText: {
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 22,
    fontStyle: 'italic',
  },
  aiBtn: {
    marginTop: 20,
    paddingVertical: 12,
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.awsOrange,
    alignItems: 'center',
  },
  aiBtnText: {
    color: colors.awsOrange,
    fontWeight: '700',
    fontSize: 14,
  },
  aiLoading: {
    marginTop: 24,
    alignItems: 'center',
    gap: 10,
  },
  aiLoadingText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
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
