// Design tokens aligned with Neura Pool brand system
// Font: Inter | Roundness: 12px
// Primary: Deep Teal #0D7C8F | Secondary: Midnight Blue #1A3A52 | Accent: Bright Cyan #00D9FF
const primaryTeal = '#0D7C8F';      // Deep Teal - Primary brand color
const secondaryBlue = '#1A3A52';    // Midnight Blue - Secondary color
const accentCyan = '#00D9FF';       // Bright Cyan - Accent/CTAs
const tintColorLight = primaryTeal;
const tintColorDark = accentCyan;

export default {
  light: {
    text: '#1e293b',
    background: '#f5f7f8',
    tint: tintColorLight,
    tabIconDefault: '#94a3b8',
    tabIconSelected: tintColorLight,
    card: '#ffffff',
    border: '#e2e8f0',
    borderSubtle: '#f1f5f9',
    muted: '#64748b',
    mutedSecondary: '#94a3b8',
    placeholder: '#94a3b8',
    inputBg: '#ffffff',
    inputBgAlt: '#f8fafc',
    inputBgDisabled: '#f1f5f9',
    inputFocusBorder: tintColorLight,
    inputFocusRing: 'rgba(0, 102, 204, 0.15)',
    buttonPrimary: accentCyan,        // Bright Cyan for primary CTAs (Start Service, Mark Complete)
    buttonPrimaryText: '#ffffff',
    buttonPrimaryShadow: 'rgba(0, 217, 255, 0.20)',
    buttonSuccess: '#16a34a',
    buttonSuccessText: '#ffffff',
    buttonSuccessShadow: 'rgba(22, 163, 74, 0.20)',
    buttonDanger: '#dc2626',
    buttonDangerText: '#ffffff',
    buttonOutline: '#e2e8f0',
    buttonOutlineText: '#64748b',
    error: '#dc2626',
    link: '#0066cc',
    headerBg: '#ffffff',
    sectionHeaderBg: 'rgba(248, 250, 252, 0.5)',
    warningBg: '#fef3c7',
    warningBorder: '#f59e0b',
    warningText: '#92400e',
    photoButtonBg: '#f1f5f9',
    thumbBg: '#f1f5f9',
    progressBarBg: 'rgba(13, 124, 143, 0.15)',   // Deep Teal - subtle background
    progressBarFill: primaryTeal,                  // Deep Teal - primary fill
    progressBarGradientEnd: accentCyan,            // Bright Cyan - accent gradient
    chipBg: 'rgba(13, 124, 143, 0.10)',   // Deep Teal with low opacity
    chipText: primaryTeal,
    chipBgAlt: '#f5f7f8',
    sectionIconBlueBg: 'rgba(13, 124, 143, 0.10)',  // Deep Teal accent
    sectionIconBlueText: primaryTeal,
    sectionIconGreenBg: '#dcfce7',
    sectionIconGreenText: '#16a34a',
    sectionIconAmberBg: '#fef3c7',
    sectionIconAmberText: '#d97706',
    sectionIconPurpleBg: '#f3e8ff',
    sectionIconPurpleText: '#9333ea',
    badgeBg: 'rgba(0, 102, 204, 0.10)',
    switchTrack: '#e2e8f0',
    switchTrackActive: tintColorLight,
    divider: '#f1f5f9',
    overlay: 'rgba(0, 0, 0, 0.4)',
  },
  dark: {
    text: '#f1f5f9',
    background: '#0f1923',
    tint: accentCyan,
    tabIconDefault: '#64748b',
    tabIconSelected: accentCyan,
    card: '#1e293b',
    border: '#334155',
    borderSubtle: '#1e293b',
    muted: '#94a3b8',
    mutedSecondary: '#64748b',
    placeholder: '#64748b',
    inputBg: '#0f172a',
    inputBgAlt: '#0f172a',
    inputBgDisabled: '#0f172a',
    inputFocusBorder: accentCyan,
    inputFocusRing: 'rgba(0, 217, 255, 0.15)',
    buttonPrimary: accentCyan,
    buttonPrimaryText: '#ffffff',
    buttonPrimaryShadow: 'rgba(0, 217, 255, 0.20)',
    buttonSuccess: '#16a34a',
    buttonSuccessText: '#ffffff',
    buttonSuccessShadow: 'rgba(22, 163, 74, 0.20)',
    buttonDanger: '#ef4444',
    buttonDangerText: '#ffffff',
    buttonOutline: '#334155',
    buttonOutlineText: '#94a3b8',
    error: '#f87171',
    link: accentCyan,
    headerBg: '#1e293b',
    sectionHeaderBg: 'rgba(30, 41, 59, 0.3)',
    warningBg: '#422c1a',
    warningBorder: '#f59e0b',
    warningText: '#fcd34d',
    photoButtonBg: '#334155',
    thumbBg: '#1e293b',
    progressBarBg: 'rgba(13, 124, 143, 0.20)',     // Deep Teal - subtle background
    progressBarFill: accentCyan,                    // Bright Cyan - primary fill
    progressBarGradientEnd: primaryTeal,            // Deep Teal - secondary gradient
    chipBg: 'rgba(0, 217, 255, 0.15)',             // Bright Cyan accent
    chipText: accentCyan,
    chipBgAlt: '#1e293b',
    sectionIconBlueBg: 'rgba(0, 217, 255, 0.15)',  // Bright Cyan accent
    sectionIconBlueText: accentCyan,
    sectionIconGreenBg: 'rgba(22, 163, 74, 0.15)',
    sectionIconGreenText: '#4ade80',
    sectionIconAmberBg: 'rgba(217, 119, 6, 0.15)',
    sectionIconAmberText: '#fbbf24',
    sectionIconPurpleBg: 'rgba(147, 51, 234, 0.15)',
    sectionIconPurpleText: '#c084fc',
    badgeBg: 'rgba(0, 217, 255, 0.15)',
    switchTrack: '#334155',
    switchTrackActive: accentCyan,
    divider: '#1e293b',
    overlay: 'rgba(0, 0, 0, 0.6)',
  },
};
