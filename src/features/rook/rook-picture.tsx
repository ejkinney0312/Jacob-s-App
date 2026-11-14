import { Image } from 'react-native';

import type { RookPose } from '@/domain/rook';

/**
 * Rook's pictures, by pose. They are bundled, transparent and all drawn on the same canvas, resting on the same bottom
 * line, so switching pose never makes Rook jump. The paths must be written out in full for the bundler to include them.
 */
export const ROOK_PICTURES: Readonly<Record<RookPose, number>> = {
  idle: require('@/assets/images/rook/rook-idle.png'),
  wave: require('@/assets/images/rook/rook-wave.png'),
  cheer: require('@/assets/images/rook/rook-cheer.png'),
  proud: require('@/assets/images/rook/rook-proud.png'),
  thinking: require('@/assets/images/rook/rook-thinking.png'),
};

/**
 * Rook in one pose. Decoration for screen readers: the name "Rook" and the words next to it carry the meaning, so the
 * picture is hidden from them.
 */
export function RookPicture({ pose, size }: { pose: RookPose; size: number }) {
  return (
    <Image
      source={ROOK_PICTURES[pose]}
      style={{ width: size, height: size }}
      resizeMode="contain"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}
