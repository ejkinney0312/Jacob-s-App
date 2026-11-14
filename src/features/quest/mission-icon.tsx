import { SymbolView, type SymbolViewProps } from 'expo-symbols';

import { useTheme } from '@/hooks/use-theme';

import { hasMissionArt, MissionArt } from './mission-art';

type SymbolName = SymbolViewProps['name'];

/**
 * Maps the content's icon keys to platform symbols. These are system symbols, not custom art
 * (original illustrations come later). Unknown keys fall back to a plain check mark.
 */
const ICONS: Record<string, SymbolName> = {
  hammer: { ios: 'hammer', android: 'hardware', web: 'hardware' },
  tools: { ios: 'wrench.and.screwdriver', android: 'handyman', web: 'handyman' },
  broom: { ios: 'sparkles', android: 'cleaning_services', web: 'cleaning_services' },
  shelf: { ios: 'books.vertical', android: 'shelves', web: 'shelves' },
  leaf: { ios: 'leaf', android: 'eco', web: 'eco' },
  'watering-can': { ios: 'drop', android: 'water_drop', web: 'water_drop' },
  sprout: { ios: 'leaf', android: 'eco', web: 'eco' },
  backpack: { ios: 'backpack', android: 'backpack', web: 'backpack' },
  map: { ios: 'map', android: 'map', web: 'map' },
  check: { ios: 'checkmark.circle', android: 'check_circle', web: 'check_circle' },
};

const FALLBACK: SymbolName = ICONS.check;

/**
 * The mission's picture. A drawn picture (see `art-shapes.ts`) is described in words for screen readers; a plain symbol
 * is only a decoration, because the mission's words carry the meaning.
 */
export function MissionIcon({ icon, size = 96 }: { icon: string; size?: number }) {
  const theme = useTheme();

  if (hasMissionArt(icon)) {
    return <MissionArt icon={icon} size={size} colors={{ line: theme.primary, soft: theme.backgroundSelected }} />;
  }

  return (
    <SymbolView
      name={ICONS[icon] ?? FALLBACK}
      size={size}
      tintColor={theme.primary}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}
