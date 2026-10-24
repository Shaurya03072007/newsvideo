export type ThemeMode = 'light' | 'dark';

export interface ThemeColors {
  bgPage: string;
  bgSurface: string;
  bgElevated: string;
  border: string;
  borderSubtle: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  primaryHover: string;
  primaryText: string;
  accent: string;
  accentBg: string;
  tagBg: string;
  tagText: string;
  cardShadow: string;
}

export interface ThemeDefinition {
  id: string;
  name: string;
  nameTelugu: string;
  description: string;
  category: string;
  categoryTelugu: string;
  mode: ThemeMode;
  colors: ThemeColors;
}
