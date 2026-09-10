/**
 * New Chester brand theme.
 * Colors are defined for light and dark mode, following the scaffold's
 * `useTheme()` / `Colors[scheme]` convention.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#1C1C1E',
    textSecondary: '#6C6C70',
    textTertiary: '#8E8E93',
    background: '#ffffff',
    groupedBackground: '#F6F4F8',
    backgroundElement: '#F7F7F9',
    backgroundSelected: '#EDE1F7',
    card: '#ffffff',
    separator: '#E5E0EA',
    chevron: '#C7C7CC',
    primary: '#B565E8',
    primaryDeep: '#7C3FA8',
    primaryPale: '#F3E9FB',
    onPrimary: '#ffffff',
    success: '#34C759',
    danger: '#FF3B30',
  },
  dark: {
    text: '#F2F2F7',
    textSecondary: '#AEAEB2',
    textTertiary: '#8E8E93',
    background: '#000000',
    groupedBackground: '#000000',
    backgroundElement: '#1C1C1E',
    backgroundSelected: '#2C2233',
    card: '#1C1C1E',
    separator: '#38383A',
    chevron: '#48484A',
    primary: '#C77CEE',
    primaryDeep: '#E7CFF9',
    primaryPale: '#2C2233',
    onPrimary: '#ffffff',
    success: '#30D158',
    danger: '#FF453A',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` -> San Francisco */
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  sm: 8,
  md: 11,
  lg: 14,
  xl: 20,
  pill: 999,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
