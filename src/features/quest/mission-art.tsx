import { View } from 'react-native';
import Svg, { Circle, Ellipse, Line, Path, Rect } from 'react-native-svg';

import { describeMissionArt } from '@/domain/mission-art';

import { ART, ART_SIZE, type ArtFill, type ArtShape } from './art-shapes';

export interface ArtColors {
  /** Outlines and small solid details. */
  line: string;
  /** The pale fill. */
  soft: string;
}

/** True when a drawing exists for this icon name. */
export function hasMissionArt(icon: string): boolean {
  return Object.hasOwn(ART, icon);
}

/** Draws a list of shapes on the 96 by 96 grid in the given colors. No accessibility wrapper: the caller decides that. */
export function ShapesSvg({ shapes, size, colors }: { shapes: readonly ArtShape[]; size: number; colors: ArtColors }) {
  const fillFor = (fill: ArtFill) => (fill === 'soft' ? colors.soft : fill === 'accent' ? colors.line : 'none');
  const line = { stroke: colors.line, strokeWidth: 3, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
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
    <Svg width={size} height={size} viewBox={`0 0 ${ART_SIZE} ${ART_SIZE}`}>
      {shapes.map(draw)}
    </Svg>
  );
}

/**
 * Draws a mission or quest picture in the given colors, or nothing if there is no drawing for `icon`.
 * `decorative` hides it from screen readers (use it when the words next to it already say everything); otherwise it
 * is announced with its description.
 */
export function MissionArt({ icon, size, colors, decorative = false }: { icon: string; size: number; colors: ArtColors; decorative?: boolean }) {
  if (!hasMissionArt(icon)) return null;
  const shapes = ART[icon];
  const description = describeMissionArt(icon);
  const announced = !decorative && description !== null;
  return (
    <View
      accessible={announced}
      accessibilityRole={announced ? 'image' : undefined}
      accessibilityLabel={announced ? description : undefined}
      importantForAccessibility={announced ? 'yes' : 'no-hide-descendants'}
      accessibilityElementsHidden={!announced}>
      <ShapesSvg shapes={shapes} size={size} colors={colors} />
    </View>
  );
}
