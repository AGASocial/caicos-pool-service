/**
 * Sistema de Diseño Centralizado - Cadenza (Brass & Linen)
 *
 * Brand source: brand/index.html v1.0
 * Tokens mirror globals.css; use CSS variables in components when possible.
 */

export const theme = {
  colors: {
    // Brand accent — Brass (#C7A85F)
    primary: {
      medium: '#C7A85F',
      DEFAULT: 'oklch(0.744 0.099 87.0)',
      dark: 'oklch(0.65 0.09 87)',
      darker: 'oklch(0.55 0.08 87)',
      lightest: 'oklch(0.96 0.03 87)',
      light: 'oklch(0.90 0.06 87)',
    },
    // Warm surfaces — Linen / hairline
    secondary: {
      DEFAULT: 'oklch(0.977 0.007 80.7)',
      dark: 'oklch(0.927 0.016 82.8)',
      light: 'oklch(0.950 0.014 84.6)',
      lightest: '#FFFFFF',
    },
    success: {
      DEFAULT: 'oklch(0.537 0.086 157.4)',
      dark: 'oklch(0.45 0.08 157)',
      light: 'oklch(0.95 0.035 157)',
      text: 'oklch(0.38 0.08 157)',
    },
    warning: {
      DEFAULT: 'oklch(0.626 0.125 70.4)',
      dark: 'oklch(0.52 0.11 70)',
      light: 'oklch(0.96 0.04 80)',
      text: 'oklch(0.42 0.10 70)',
    },
    error: {
      DEFAULT: 'oklch(0.540 0.147 28.1)',
      dark: 'oklch(0.45 0.13 28)',
      light: 'oklch(0.95 0.04 28)',
      text: 'oklch(0.40 0.12 28)',
    },
    info: {
      DEFAULT: 'oklch(0.508 0.074 244.0)',
      dark: 'oklch(0.42 0.07 244)',
      light: 'oklch(0.95 0.03 244)',
      text: 'oklch(0.36 0.07 244)',
    },
  },

  gradients: {
    primary: 'linear-gradient(135deg, oklch(0.744 0.099 87.0) 0%, oklch(0.65 0.09 87) 100%)',
    primaryLight: 'linear-gradient(135deg, oklch(0.977 0.007 80.7) 0%, oklch(0.950 0.014 84.6) 100%)',
    primaryDark: 'linear-gradient(135deg, oklch(0.65 0.09 87) 0%, oklch(0.55 0.08 87) 100%)',
    success: 'linear-gradient(135deg, oklch(0.537 0.086 157.4) 0%, oklch(0.45 0.08 157) 100%)',
    card: 'linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)',
    cardDark: 'linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)',
    hero: 'radial-gradient(circle at top center, oklch(0.744 0.099 87.0 / 0.25), transparent 70%)',
  },

  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    DEFAULT: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    md: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    lg: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    xl: '0 25px 50px -12px rgb(0 0 0 / 0.25)',
    primary: '0 10px 15px -3px oklch(0.744 0.099 87.0 / 0.3), 0 4px 6px -4px oklch(0.744 0.099 87.0 / 0.2)',
    primaryLg: '0 20px 25px -5px oklch(0.744 0.099 87.0 / 0.4), 0 8px 10px -6px oklch(0.744 0.099 87.0 / 0.3)',
    inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
    glow: '0 0 20px oklch(0.744 0.099 87.0 / 0.5)',
  },

  radius: {
    sm: '0.5rem',
    DEFAULT: '0.75rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '2.5rem',
    full: '9999px',
  },

  spacing: {
    xs: '0.5rem',
    sm: '0.75rem',
    DEFAULT: '1rem',
    md: '1.5rem',
    lg: '2rem',
    xl: '3rem',
    '2xl': '4rem',
  },

  transitions: {
    fast: '150ms ease-in-out',
    DEFAULT: '300ms cubic-bezier(0.22, 1, 0.36, 1)',
    slow: '420ms cubic-bezier(0.22, 1, 0.36, 1)',
    spring: '500ms cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  },
} as const;

export const lightTheme = {
  background: 'oklch(0.977 0.007 80.7)',
  foreground: 'oklch(0.188 0.013 248.5)',
  card: 'oklch(1 0 0)',
  cardForeground: 'oklch(0.188 0.013 248.5)',
  popover: 'oklch(1 0 0)',
  popoverForeground: 'oklch(0.188 0.013 248.5)',
  primary: theme.colors.primary.DEFAULT,
  primaryForeground: 'oklch(0.195 0.026 85.8)',
  secondary: theme.colors.secondary.DEFAULT,
  secondaryForeground: 'oklch(0.366 0.015 259.8)',
  muted: theme.colors.secondary.light,
  mutedForeground: 'oklch(0.551 0.023 264.4)',
  accent: theme.colors.secondary.dark,
  accentForeground: 'oklch(0.188 0.013 248.5)',
  destructive: theme.colors.error.DEFAULT,
  destructiveForeground: '#ffffff',
  border: 'oklch(0.927 0.016 82.8)',
  input: 'oklch(0.927 0.016 82.8)',
  ring: theme.colors.primary.DEFAULT,
} as const;

export const darkTheme = {
  background: 'oklch(0.212 0.013 258.4)',
  foreground: 'oklch(0.950 0.014 84.6)',
  card: 'oklch(0.26 0.014 258)',
  cardForeground: 'oklch(0.950 0.014 84.6)',
  popover: 'oklch(0.26 0.014 258)',
  popoverForeground: 'oklch(0.950 0.014 84.6)',
  primary: theme.colors.primary.DEFAULT,
  primaryForeground: 'oklch(0.195 0.026 85.8)',
  secondary: 'oklch(0.30 0.014 258)',
  secondaryForeground: 'oklch(0.950 0.014 84.6)',
  muted: 'oklch(0.30 0.014 258)',
  mutedForeground: 'oklch(0.74 0.018 258)',
  accent: 'oklch(0.32 0.020 258)',
  accentForeground: 'oklch(0.950 0.014 84.6)',
  destructive: 'oklch(0.60 0.16 28)',
  destructiveForeground: 'oklch(1 0 0)',
  border: 'oklch(0.34 0.014 258)',
  input: 'oklch(0.34 0.014 258)',
  ring: theme.colors.primary.DEFAULT,
} as const;

export type Theme = typeof theme;
