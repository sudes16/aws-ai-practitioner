import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Share,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../constants/types';
import { getQuestionReports, deleteQuestionReport, QuestionReport } from '../utils/storage';
import { formatDate } from '../utils/dateUtils';
import { useTheme } from '../contexts/ThemeContext';
import { ColorScheme } from '../constants/colors';
import { SHARED_STYLES } from '../utils/styleUtils';

type Props = NativeStackScreenProps<RootStackParamList, 'Reports'>;

const CATEGORY_LABEL: Record<QuestionReport['category'], string> = {
  wrong_answer: 'Wrong Answer',
  typo: 'Typo / Spelling',
  unclear: 'Unclear / Confusing',
  other: 'Other',
};

const CATEGORY_COLOR: Record<QuestionReport['category'], string> = {
  wrong_answer: '#DC2626',
  typo: '#D97706',
  unclear: '#2563EB',
  other: '#6B7280',
};

export default function ReportsScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const shared = useMemo(() => SHARED_STYLES(colors), [colors]);
  const [reports, setReports] = useState<QuestionReport[]>([]);

  useFocusEffect(
    useCallback(() => {
      getQuestionReports().then(r => setReports([...r].reverse())); // newest first
    }, []),
  );

  const handleDelete = async (timestamp: string) => {
    await deleteQuestionReport(timestamp);
    setReports(prev => prev.filter(r => r.timestamp !== timestamp));
  };

  const handleExport = async () => {
    if (reports.length === 0) return;
    const header = [
      `AWS Quiz — My Question Reports (${reports.length})`,
      `Exported: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
      '',
    ];
    const rows = reports.flatMap(r => {
      const lines = [
        `Q#${r.questionNumber} | ${CATEGORY_LABEL[r.category]} | ${formatDate(r.timestamp)}`,
        `"${r.questionText}"`,
      ];
      if (r.note) lines.push(`Note: ${r.note}`);
      lines.push('');
      return lines;
    });
    const text = [...header, ...rows].join('\n');

    try {
      if (Platform.OS === 'web') {
        const nav = navigator as any;
        if (nav.share) {
          await nav.share({ title: 'My Question Reports', text });
        } else if (nav.clipboard?.writeText) {
          await nav.clipboard.writeText(text);
        }
      } else {
        await Share.share({ message: text });
      }
    } catch {
      /* user cancelled */
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      {/* Header */}
      <View style={shared.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>⚠️ Question Reports</Text>
        <TouchableOpacity
          style={styles.exportBtn}
          onPress={handleExport}
          disabled={reports.length === 0}
        >
          <Text style={[styles.exportBtnText, reports.length === 0 && styles.exportBtnTextDisabled]}>
            Export
          </Text>
        </TouchableOpacity>
      </View>

      {reports.length === 0 ? (
        /* ── Empty state ── */
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>✓</Text>
          <Text style={styles.emptyTitle}>No reports yet</Text>
          <Text style={styles.emptySub}>
            Tap ⚠ Report on any question during a quiz to flag it for review.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.countLabel}>
            {reports.length} report{reports.length !== 1 ? 's' : ''}
          </Text>

          {reports.map(r => (
            <View key={r.timestamp} style={styles.card}>
              {/* Card header row */}
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <View
                    style={[
                      styles.badge,
                      { backgroundColor: CATEGORY_COLOR[r.category] + '22', borderColor: CATEGORY_COLOR[r.category] },
                    ]}
                  >
                    <Text style={[styles.badgeText, { color: CATEGORY_COLOR[r.category] }]}>
                      {CATEGORY_LABEL[r.category]}
                    </Text>
                  </View>
                  <Text style={styles.qNum}>Q#{r.questionNumber}</Text>
                </View>
                <View style={styles.cardHeaderRight}>
                  <Text style={styles.dateText}>{formatDate(r.timestamp)}</Text>
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDelete(r.timestamp)}
                    accessibilityLabel="Delete report"
                    accessibilityRole="button"
                  >
                    <Text style={styles.deleteBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Question text */}
              <Text style={styles.questionText} numberOfLines={2}>
                {r.questionText}
              </Text>

              {/* User note */}
              {r.note ? (
                <View style={styles.noteRow}>
                  <Text style={styles.noteText}>💬 {r.note}</Text>
                </View>
              ) : null}
            </View>
          ))}

          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const makeStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.awsDark },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
      backgroundColor: colors.awsDark,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(255,255,255,0.12)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    backBtnText: { color: '#fff', fontSize: 20, fontWeight: '700', lineHeight: 22 },
    headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: colors.textLight },
    exportBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: 'rgba(255,255,255,0.12)',
    },
    exportBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
    exportBtnTextDisabled: { opacity: 0.4 },

    scroll: { flex: 1, backgroundColor: colors.background },
    scrollContent: { padding: 16 },

    countLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 12,
      paddingHorizontal: 4,
    },

    card: {
      backgroundColor: colors.cardBg,
      borderRadius: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    cardHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
    },
    cardHeaderRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },

    badge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      borderWidth: 1,
    },
    badgeText: { fontSize: 11, fontWeight: '700' },

    qNum: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textSecondary,
    },

    dateText: {
      fontSize: 12,
      color: colors.textMuted,
    },

    deleteBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.wrongBg ?? 'rgba(220,38,38,0.1)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    deleteBtnText: {
      color: colors.wrong,
      fontSize: 12,
      fontWeight: '700',
    },

    questionText: {
      fontSize: 13,
      color: colors.textPrimary,
      lineHeight: 19,
      marginBottom: 6,
    },

    noteRow: {
      marginTop: 4,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    noteText: {
      fontSize: 12,
      color: colors.textSecondary,
      lineHeight: 17,
    },

    /* Empty state */
    empty: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 40,
      backgroundColor: colors.background,
    },
    emptyIcon: {
      fontSize: 48,
      marginBottom: 16,
      color: colors.correct,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.textPrimary,
      marginBottom: 8,
    },
    emptySub: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
  });
