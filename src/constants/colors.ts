export type ColorScheme = typeof LightColors;

export const LightColors = {
  // AWS brand
  awsOrange: '#FF9900',
  awsDark: '#1A2B4C',

  // Layout
  background: '#F0F2F5',
  cardBg: '#FFFFFF',
  border: '#E2E8F0',

  // Text
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  textLight: '#FFFFFF',

  // Option states
  optionDefault: '#FFFFFF',
  optionDefaultBorder: '#CBD5E1',
  optionSelected: '#EFF6FF',
  optionSelectedBorder: '#3B82F6',

  // Feedback
  correct: '#16A34A',
  correctBg: '#F0FDF4',
  correctBorder: '#16A34A',
  wrong: '#DC2626',
  wrongBg: '#FEF2F2',
  wrongBorder: '#DC2626',
  missed: '#15803D',
  missedBg: '#DCFCE7',

  // Buttons
  btnPrimary: '#FF9900',
  btnPrimaryText: '#FFFFFF',
  btnSecondary: '#3B82F6',
  btnSecondaryText: '#FFFFFF',
  btnDanger: '#DC2626',
  btnDisabled: '#D1D5DB',
  btnDisabledText: '#9CA3AF',

  // Progress
  progressBg: '#E5E7EB',
  progressFill: '#FF9900',

  // Score
  scorePass: '#16A34A',
  scoreFail: '#DC2626',
  scoreNeutral: '#FF9900',

  // Letter circle
  letterDefault: '#F3F4F6',
  letterDefaultText: '#374151',
  letterSelected: '#3B82F6',
  letterSelectedText: '#FFFFFF',
  letterCorrect: '#16A34A',
  letterCorrectText: '#FFFFFF',
  letterWrong: '#DC2626',
  letterWrongText: '#FFFFFF',
  letterMissed: '#15803D',
  letterMissedText: '#FFFFFF',
};

export const DarkColors: ColorScheme = {
  // AWS brand (unchanged)
  awsOrange: '#FF9900',
  awsDark: '#1A2B4C',

  // Layout
  background: '#0F1117',
  cardBg: '#1C2033',
  border: '#2D3148',

  // Text
  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  textLight: '#FFFFFF',

  // Option states
  optionDefault: '#1C2033',
  optionDefaultBorder: '#3D4466',
  optionSelected: '#1E3A5F',
  optionSelectedBorder: '#3B82F6',

  // Feedback
  correct: '#22C55E',
  correctBg: '#052E16',
  correctBorder: '#22C55E',
  wrong: '#F87171',
  wrongBg: '#2D0707',
  wrongBorder: '#F87171',
  missed: '#4ADE80',
  missedBg: '#052E16',

  // Buttons
  btnPrimary: '#FF9900',
  btnPrimaryText: '#FFFFFF',
  btnSecondary: '#3B82F6',
  btnSecondaryText: '#FFFFFF',
  btnDanger: '#EF4444',
  btnDisabled: '#374151',
  btnDisabledText: '#6B7280',

  // Progress
  progressBg: '#374151',
  progressFill: '#FF9900',

  // Score
  scorePass: '#22C55E',
  scoreFail: '#F87171',
  scoreNeutral: '#FF9900',

  // Letter circle
  letterDefault: '#2D3148',
  letterDefaultText: '#CBD5E1',
  letterSelected: '#3B82F6',
  letterSelectedText: '#FFFFFF',
  letterCorrect: '#22C55E',
  letterCorrectText: '#FFFFFF',
  letterWrong: '#EF4444',
  letterWrongText: '#FFFFFF',
  letterMissed: '#4ADE80',
  letterMissedText: '#000000',
};
