# Quest Blocks

## Product and scope
Build a native iOS and Android app using React Native, Expo and TypeScript.
Quest Blocks helps an adult early reader finish chores independently. A Quest
contains Missions. Rook is an original encouraging companion. The block village
grows through progress. Use adult, respectful language and calm original art.

Read docs/PRODUCT_REQUIREMENTS.md before planning features. It is the imported
PRD snapshot. Read docs/DECISIONS.md for conflicts and missing information.
The PRD and confirmed decisions govern product behavior; do not silently resolve
conflicting requirements. Record assumptions and ask only for decisions that
block the current task. Continue independent work.

P0 is F1–F11: Today, mission flow, approvals, completion rewards, pause/resume,
PIN caregiver mode, reward store, Rook, village, levels/badges and local reminders.
P1 is quest builder, separate-device sync/push, Weekly Chest, insights and recorded
voice. P2 is photos, videos, adaptive prompts, companion customization and widget.
Start offline on one shared device. Do not add a backend to P0 by default.

## Implementation
- Use the scaffold's Expo Router convention, TypeScript strict checking and npm.
- Use SQLite with versioned migrations and transactions for durable local data.
- Keep domain rules separate from screens and native services.
- Use expo-notifications, expo-speech, expo-secure-store and expo-haptics.
- Install native packages through npx expo install to match the selected SDK.
- Keep PIN verification material in SecureStore, never plaintext or logs.
  Evaluate a supported slow salted PIN derivation method, retry limiting,
  session relocking and recovery before enabling real caregiver access.
- Derive recurring quest instances from local calendar dates and explicit timezone
  rules; use stable IDs. Reopening Today must not create duplicate instances.
- Persist mission position, approval state and payouts across app restarts.
- Use atomic, idempotent reward transactions. Double taps, retries, approvals
  and reopening must never pay twice. A waiting mission earns no payout yet.
- Keep XP, blocks and earned badges cumulative. Emerald spending policy is
  unresolved; keep earned-total and spendable-balance concepts separate and
  leave real redemption disabled until docs/DECISIONS.md is confirmed.
- Levels use 100 XP per level; confirm starting level and badge thresholds.
- Do not invent missing legacy quest content or mission reward values.
  Label sample content as demo. Never claim the Bathroom total is verified
  without a supplied or explicitly approved fixture totaling 95 XP, 38 emeralds
  and one block.
- Make reminders permission-aware, timezone-aware, quiet-hours-aware and
  duplicate-safe. Test physical devices; never promise unconditional delivery.
- Treat notification payloads as potentially visible on a locked phone.

## Accessibility and privacy
- One mission per screen; icon plus short phrase; consistent controls.
- Provide replay audio, Help, Pause and lossless Resume.
- Minimum touch areas 48 logical units; primary buttons at least 64 high.
- Support VoiceOver, TalkBack, 200 percent text and Reduce Motion.
- Text contrast at least 4.5 to 1; never use color as the only signal.
- No flashing, countdowns, punishment, shaming or punitive point removal.
- Respect audio-off, volume and silent behavior; motion/audio/haptics are optional.
- No player email, ads, tracking SDKs or third-party analytics in P0.
- Use anonymous demo data in development. Exclude care instructions, PINs and
  sensitive content from logs, notifications, screenshots and crash reports.
- Care routines are caregiver-authored reminders only, never medical guidance.
- Original art, names and sound only; no Minecraft assets or store-listing wording.

## Working agreement
First inspect existing files and package.json. Do not overwrite this file during
/init. Make small working milestones. Explain changes in plain language.
Do not commit secrets, .env files, signing credentials, real household data or
local databases. Do not publish, submit to stores or buy services without Erin's
instruction. CLAUDE.md guides behavior; it is not an enforced permission boundary.

Before implementation, create docs/IMPLEMENTATION_PLAN.md mapping F1–F18 to phases
and acceptance checks. Keep docs/STATUS.md updated after each milestone with
completed work, commands actually run, results, blockers and the next step.

## Validation
After scaffolding confirm scripts before using them. Expected commands are:
- npx expo-doctor
- npx tsc --noEmit
- npm run lint when the script exists
- npm test -- --runInBand after the test runner is configured

Use meaningful tests for recurrence, restart/resume, atomic payouts, approvals,
redemptions and migrations. Test notifications, secure storage and accessibility
on development builds on real iPhone and Android hardware. Report untested
platforms honestly. Simulator or Expo Go success alone is not release acceptance.
