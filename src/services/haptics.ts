import * as Haptics from 'expo-haptics';

/**
 * One gentle tap. Haptics are optional: iOS skips them in Low Power Mode or when the Taptic Engine is
 * off, and some phones have none, so a failure is silently fine.
 */
export async function gentleTap(): Promise<void> {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // Not available: carry on.
  }
}
