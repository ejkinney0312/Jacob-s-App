import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, PixelFont, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'display' | 'stat' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  // Links are underlined and colored, so color is never the only signal.
  const color = theme[themeColor ?? (type === 'linkPrimary' ? 'link' : 'text')];

  return <Text style={[{ color }, styles[type], style]} {...rest} />;
}

const styles = StyleSheet.create({
  small: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: 500,
  },
  smallBold: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: 700,
  },
  default: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: 500,
  },
  // A big pixel-style headline. For a few words only; it is not used for anything long.
  display: {
    fontFamily: PixelFont,
    fontSize: 40,
    lineHeight: 48,
  },
  // A big number on a stat tile, in the pixel font. Short numbers only.
  stat: {
    fontFamily: PixelFont,
    fontSize: 32,
    lineHeight: 40,
  },
  title: {
    fontSize: 36,
    fontWeight: 700,
    lineHeight: 44,
  },
  subtitle: {
    fontSize: 26,
    lineHeight: 34,
    fontWeight: 600,
  },
  link: {
    lineHeight: 26,
    fontSize: 16,
  },
  linkPrimary: {
    lineHeight: 26,
    fontSize: 16,
    textDecorationLine: 'underline',
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
  },
});
