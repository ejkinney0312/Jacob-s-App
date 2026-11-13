import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { View } from 'react-native';
import Svg, { Circle, Ellipse, Line, Path, Rect } from 'react-native-svg';

import { describeMissionArt } from '@/domain/mission-art';
import { useTheme } from '@/hooks/use-theme';

import { ART, ART_SIZE, type ArtFill, type ArtShape } from './art-shapes';

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
  const shapes = Object.hasOwn(ART, icon) ? ART[icon] : null;
  const description = describeMissionArt(icon);

  if (shapes) {
    const fillFor = (fill: ArtFill) => (fill === 'soft' ? theme.backgroundSelected : fill === 'accent' ? theme.primary : 'none');
    const line = { stroke: theme.primary, strokeWidth: 3, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
    const draw = (shape: ArtShape, key: number) => {
      switch (shape.t) {
        case 'path':
          return <Path key={key} d={shape.d} fill={fillFor(shape.fill)} {...line} />;
        case 'rect':
          return <Rect key={key} x={shape.x} y={shape.y} width={shape.w} height={shape.h} rx={shape.r} fill={fillFor(shape.fill)} {...line} />;
        case 'circle':
          return <Circle key={key} cx={shape.cx} cy={shape.cy} r={shape.r} fill={fillFor(shape.fill)} {...line} />;
        case 'ellipse':
          return <Ellipse key={key} cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} fill={fillFor(shape.fill)} {...line} />;
        case 'line':
          return <Line key={key} x1={shape.x1} y1={shape.y1} x2={shape.x2} y2={shape.y2} {...line} />;
      }
    };
    return (
      <View accessible={description !== null} accessibilityRole="image" accessibilityLabel={description ?? undefined} importantForAccessibility={description ? 'yes' : 'no-hide-descendants'}>
        <Svg width={size} height={size} viewBox={`0 0 ${ART_SIZE} ${ART_SIZE}`}>
          {shapes.map(draw)}
        </Svg>
      </View>
    );
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
