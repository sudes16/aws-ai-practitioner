import { Platform } from 'react-native';

/**
 * React Native Web CSS value workaround.
 *
 * RN's StyleSheet types do not accept CSS percentage strings or 'auto'
 * in some layout properties, but these values are valid at runtime on web.
 * Use cssVal() to centralise the cast rather than scattering `as any`.
 *
 * Usage: { width: cssVal(`${pct}%`) }
 */
export const cssVal = (val: string | number): any => val;

// ─── Cross-platform shadow helper ────────────────────────────────────────────
// shadow* style props are deprecated in React Native for Web (>= 0.19).
// This helper emits `boxShadow` on web and the native shadow* props elsewhere.

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const len = h.length === 3 ? 1 : 2;
  const r = parseInt(len === 1 ? h[0] + h[0] : h.slice(0, 2), 16);
  const g = parseInt(len === 1 ? h[1] + h[1] : h.slice(2, 4), 16);
  const b = parseInt(len === 1 ? h[2] + h[2] : h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Returns platform-appropriate shadow styles.
 * Web  → boxShadow string (no deprecation warning)
 * Native → shadowColor / shadowOffset / shadowOpacity / shadowRadius
 *
 * Usage (inside StyleSheet.create):
 *   someStyle: { flex: 1, ...shadow('#000', 2, 0.08, 6), elevation: 3 }
 */
export function shadow(
  color: string,
  offsetY: number,
  opacity: number,
  radius: number,
  offsetX = 0,
): any {
  return Platform.select({
    web: { boxShadow: `${offsetX}px ${offsetY}px ${radius}px ${hexToRgba(color, opacity)}` },
    default: {
      shadowColor: color,
      shadowOffset: { width: offsetX, height: offsetY },
      shadowOpacity: opacity,
      shadowRadius: radius,
    },
  });
}

/** Suppresses an inherited shadow (e.g. on a disabled variant style). */
export function noShadow(): any {
  return Platform.select({
    web: { boxShadow: 'none' },
    default: { shadowOpacity: 0 },
  });
}
