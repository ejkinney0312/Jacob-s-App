import { SymbolView, type SymbolViewProps } from 'expo-symbols';

import { useTheme } from '@/hooks/use-theme';

type SymbolName = SymbolViewProps['name'];

/** System symbols as placeholders for original badge art. Unknown keys fall back to a plain seal. */
const ICONS: Record<string, SymbolName> = {
  flag: { ios: 'flag.fill', android: 'flag', web: 'flag' },
  seal: { ios: 'checkmark.seal.fill', android: 'verified', web: 'verified' },
  block: { ios: 'cube.fill', android: 'deployed_code', web: 'deployed_code' },
  calendar: { ios: 'calendar', android: 'calendar_month', web: 'calendar_month' },
  level: { ios: 'arrow.up.circle.fill', android: 'arrow_circle_up', web: 'arrow_circle_up' },
  gem: { ios: 'diamond.fill', android: 'diamond', web: 'diamond' },
};

/** Decorative: the badge's words carry the meaning. Earned badges use the main color, others a quiet one. */
export function BadgeIcon({ icon, earned, size = 40 }: { icon: string; earned: boolean; size?: number }) {
  const theme = useTheme();
  return (
    <SymbolView
      name={ICONS[icon] ?? ICONS.seal}
      size={size}
      tintColor={earned ? theme.primary : theme.textSecondary}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}
