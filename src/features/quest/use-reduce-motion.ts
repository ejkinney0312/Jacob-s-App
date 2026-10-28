import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * True while the system's Reduce Motion setting is on. Until the answer arrives it assumes yes, so a
 * celebration never starts moving for someone who asked for no motion.
 */
export function useReduceMotion(): { reduceMotion: boolean; ready: boolean } {
  const [state, setState] = useState<{ reduceMotion: boolean; ready: boolean }>({ reduceMotion: true, ready: false });

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (active) setState({ reduceMotion: value, ready: true });
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      setState({ reduceMotion: value, ready: true });
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return state;
}
