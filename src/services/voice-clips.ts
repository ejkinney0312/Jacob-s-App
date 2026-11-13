/**
 * The recorded voice clips, by mission id (see `src/domain/voice-clips.ts` for which words each says). They are bundled
 * with the app, so they play with no network. Each is a short spoken line made for the starter chores only.
 * The paths must be written out in full for the bundler to include them.
 */
export const CLIP_SOURCES: Readonly<Record<string, number>> = {
  'starter-bathroom-1': require('@/assets/voices/starter-bathroom-1.mp3'),
  'starter-bathroom-2': require('@/assets/voices/starter-bathroom-2.mp3'),
  'starter-bathroom-3': require('@/assets/voices/starter-bathroom-3.mp3'),
  'starter-bathroom-4': require('@/assets/voices/starter-bathroom-4.mp3'),
  'starter-bathroom-5': require('@/assets/voices/starter-bathroom-5.mp3'),
  'starter-bathroom-6': require('@/assets/voices/starter-bathroom-6.mp3'),
  'starter-bathroom-7': require('@/assets/voices/starter-bathroom-7.mp3'),
  'starter-bathroom-8': require('@/assets/voices/starter-bathroom-8.mp3'),
  'starter-bathroom-9': require('@/assets/voices/starter-bathroom-9.mp3'),
  'starter-bathroom-10': require('@/assets/voices/starter-bathroom-10.mp3'),
  'starter-bathroom-11': require('@/assets/voices/starter-bathroom-11.mp3'),
  'starter-kitchen-1': require('@/assets/voices/starter-kitchen-1.mp3'),
  'starter-kitchen-2': require('@/assets/voices/starter-kitchen-2.mp3'),
  'starter-kitchen-3': require('@/assets/voices/starter-kitchen-3.mp3'),
  'starter-kitchen-4': require('@/assets/voices/starter-kitchen-4.mp3'),
  'starter-kitchen-5': require('@/assets/voices/starter-kitchen-5.mp3'),
  'starter-kitchen-6': require('@/assets/voices/starter-kitchen-6.mp3'),
  'starter-kitchen-7': require('@/assets/voices/starter-kitchen-7.mp3'),
  'starter-laundry-1': require('@/assets/voices/starter-laundry-1.mp3'),
  'starter-laundry-2': require('@/assets/voices/starter-laundry-2.mp3'),
  'starter-laundry-3': require('@/assets/voices/starter-laundry-3.mp3'),
  'starter-laundry-4': require('@/assets/voices/starter-laundry-4.mp3'),
  'starter-laundry-5': require('@/assets/voices/starter-laundry-5.mp3'),
};
