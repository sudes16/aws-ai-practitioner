import { StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { ColorScheme } from '../constants/colors';

/** Simple shadow helper */
export const shadow = (color: string, radius = 4, opacity = 0.1, elevation = 4): ViewStyle => ({
  shadowColor: color,
  shadowOffset: { width: 0, height: radius / 2 },
  shadowOpacity: opacity,
  shadowRadius: radius,
  elevation,
});

/** No-shadow helper */
export const noShadow = (): ViewStyle => ({
  shadowOpacity: 0,
  elevation: 0,
});

/** CSS value helper for web compatibility */
export const cssVal = (val: string | number) => val as any;

/** Shared UI Constants */
export const SHARED_STYLES = (colors: ColorScheme) => StyleSheet.create({
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow('#000', 1, 0.06, 4),
  },
  header: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
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
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    opacity: 0.5,
  }
});
