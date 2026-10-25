# Quest Blocks implementation plan

Scope: P0 (F1–F11), offline, one shared device, no backend. P1/P2 (F12–F18) are
in the backlog at the end. Sources: `CLAUDE.md`, `docs/PRODUCT_REQUIREMENTS.md`,
`docs/DECISIONS.md`. Where this plan relies on an unconfirmed default from
`DECISIONS.md`, the milestone says so and the default is *proposed, not approved*.

## Ground rules for every milestone

- Small and shippable: app still launches, `npx tsc --noEmit` and `npx expo-doctor`
  pass (plus `npm run lint` / `npm test -- --runInBand` once M0 makes them real).
- Domain rules live in `src/domain/` (pure TypeScript, no React, no native modules).
  Screens and native services (`src/services/`) call into the domain layer.
- Native packages are installed with `npx expo install`. Before touching any Expo
  API, read the SDK 58 docs (see `AGENTS.md`).
- Sample content is labeled **demo**. No invented legacy quests or reward values.
- `docs/STATUS.md` is updated at the end of each milestone with commands actually run.

## Milestones

### M0 — Foundation and tooling
**Covers:** none directly (enables everything).
- Make `npm run lint` work (ESLint is not installed as a project dependency yet).
- Add a test runner (`jest-expo`) so `npm test -- --runInBand` works.
- Create folders: `src/domain`, `src/db`, `src/services`, `src/features`.
- Replace the starter template (tabs titled "Expo Starter", explore screen, hint
  rows) with an empty Today / Caregiver shell. Keep the TypeScript fixes
  (`expo-env.d.ts`, `TabButton` ref type) working.
- Set the app name, slug and placeholder identifiers only as *development*
  values; real bundle IDs wait for the Distribution decision.

**Acceptance:** lint, typecheck, doctor and one trivial passing test all run clean;
app launches on a simulator to an empty Today screen.

### M1 — Local database and migrations
**Covers:** foundation for F1–F11 persistence.
- `expo-sqlite`, versioned migrations, each applied in a transaction.
- Schema: player, quests, missions, quest instances, mission instances (position,
  approval state), ledger entries, rewards, redemptions, badges, settings, reminders.
- Separate **earned totals** (XP, emeralds, blocks) from **spendable emerald
  balance**.
- Repository layer with stable IDs.

**Acceptance:** tests for fresh install, upgrade v1→v2 with data kept, failed
migration rolls back, and no destructive migrations. Data survives an app restart.

### M2 — Schedule engine (domain only)
**Covers:** F1 logic.
- Daily, every-N-days (with persisted anchor date) and weekly-by-weekday rules,
  computed from local calendar dates plus an explicit timezone policy.
- Instance generation is idempotent: reopening Today never duplicates instances.
- **Depends on decision:** schedule edge cases (anchor, travel, DST, missed quests).
  Write concrete worked examples into `DECISIONS.md` and get them approved before
  merging; until then code uses the proposed defaults and tests name them.

**Acceptance:** table-driven tests for each rule type, a DST change, a timezone
change, date rollover at midnight, and repeated generation producing identical IDs.

### M3 — Demo content and Today screen
**Covers:** F1.
- Demo seed (clearly labeled, anonymous): a few quests with missions, plus one
  quest per schedule type. Real/legacy content waits for the prototype export.
- Today lists scheduled quests with progress; empty and all-done states in calm,
  adult wording.

**Acceptance:** Today shows exactly the quests scheduled for the local date; progress
reflects stored state; relaunching the app shows the same instances.

### M4 — Mission flow
**Covers:** F2 (and the mission-position half of F5).
- One mission per screen: icon, short text, Replay audio (`expo-speech`),
  **I need help**, **Mission complete**. Controls consistent in position;
  primary buttons ≥ 64 high, touch targets ≥ 48.
- Current mission position is written on every change.
- "I need help" shows a calm, preset help screen. No caregiver messaging in P0.

**Acceptance:** killing the app mid-quest and reopening returns to the same mission;
audio-off setting respected; works with VoiceOver/TalkBack labels (smoke check).

### M5 — Reward ledger
**Covers:** F3 (self-verify path).
- Atomic, idempotent ledger: one transaction writes the mission completion and its
  payout, keyed by mission-instance ID. Double taps, retries and reopening never pay twice.
- XP, emeralds, blocks only increase. Reward values come from content data, never
  hard-coded.

**Acceptance:** tests for double-tap, retry after simulated crash mid-transaction,
and reopening; ledger sums equal displayed totals.

### M6 — Pause and resume
**Covers:** F5.
- Pause from any mission; Resume returns to exactly the saved mission and state.
- No timers, countdowns or timeouts anywhere in the flow.

**Acceptance:** pause → force-quit → relaunch → resume lands on the same mission with
no lost or duplicated payouts.

### M7 — Caregiver PIN
**Covers:** F6 (access control half).
- `expo-secure-store` holds PIN verification material only; never plaintext, never
  logged. Evaluate a slow, salted derivation supported on-device, plus retry
  limiting, session relock and a recovery path **before** enabling real access
  (record the evaluation in `DECISIONS.md`).
- Optional biometrics are P0-optional and deferred unless trivial.
- Until the evaluation is done, caregiver mode is behind a development-only demo PIN.

**Acceptance:** wrong-PIN lockout/backoff tested; relock on background and timeout;
no PIN material in logs (checked by test and manual log review).

### M8 — Approvals and caregiver editing
**Covers:** F3 (waiting path), F6 (approvals queue, edit rewards/points, quest on/off).
- Key missions become **waiting for approval** and pay nothing yet; approval pays
  exactly once.
- Caregiver can enable/disable supplied quests and edit reward values.
- **Depends on decision:** rejection / redo / quest-bonus timing. Proposed default:
  pending missions block the final quest payout; caregiver can ask for another try
  with no penalty. Implement only after Erin confirms.

**Acceptance:** waiting mission shows no payout; approve pays once even with double
tap or retry; state survives restart; edits never reduce already-earned totals.

### M9 — Quest completion celebration
**Covers:** F4.
- Calm single animation, one soft chime, bonus XP/emeralds/block via the M5 ledger.
- Respects Reduce Motion, audio-off and silent behavior; haptic is optional.
- Reduce Motion variant is a static state, not a stripped-down animation.

**Acceptance:** bonus is paid once; no flashing; works with motion, audio and
haptics each off.

### M10 — Levels and badges
**Covers:** F10.
- Level = floor(XP / 100) + 1, flat 100 XP per level (per PRD).
- Badge engine evaluating earned conditions; badges only accumulate.
- **Depends on decision:** starting level and badge thresholds. Use clearly labeled
  placeholder badges until approved.

**Acceptance:** level boundary tests (99/100/101 XP); badge awarded once; never revoked.

### M11 — Village
**Covers:** F9.
- Four structures with story stages that advance with completed quests; original art.
- **Depends on decision:** structure/stage definitions. Use labeled placeholders.

**Acceptance:** stage derives from persisted progress only; never regresses; readable
without color alone.

### M12 — Rook companion
**Covers:** F8.
- Quest intro, per-mission tip, tap-to-talk, milestone reactions (level up, badge,
  independent finish).
- Tap-to-talk = tap to hear preset dialogue via device TTS. No microphone, no cloud
  AI. **Proposed default pending confirmation** (`DECISIONS.md`).
- Dialogue is demo text, encouraging and adult; no failure or shaming wording.

**Acceptance:** every Rook line has replay audio and a text alternative; nothing
negative on skipped or missed steps.

### M13 — Reward store
**Covers:** F7.
- Caregiver-editable reward costs and redemption log.
- **Real redemption stays disabled** until the emerald-spending decision is confirmed.
  Until then the store is browsable and the log is wired, but nothing is debited.
- Never remove points as punishment.

**Acceptance:** spendable balance and lifetime earned are separate fields; disabled
state is clear to the player and caregiver; log works under test fixtures.

### M14 — Local reminders
**Covers:** F11.
- `expo-notifications`: permission-aware, timezone-aware, quiet-hours-aware,
  duplicate-safe scheduling; caregiver sets time and wording; gentle tone; no
  countdowns or alarm sounds.
- Notification text is safe on a locked screen: no care details, no PIN.
- Reschedule on settings change, timezone change and reboot.

**Acceptance:** unit tests for scheduling math; **physical iPhone and Android**
checks for app-closed delivery and after restart. Delivery is never promised
unconditionally.

### M15 — Accessibility, privacy and P0 acceptance
**Covers:** all of F1–F11 (cross-cutting).
- VoiceOver and TalkBack, 200% text, Reduce Motion, contrast 4.5:1, touch sizes.
- Privacy review: no tracking SDKs, logs clean, no sensitive content in notifications.
- Run the PRD acceptance list on real iPhone and Android hardware.
- **Bathroom check:** only claim "verified" if a supplied or approved fixture totals
  95 XP, 38 emeralds and 1 block.

**Acceptance:** each PRD acceptance item marked pass/fail/untested honestly in
`STATUS.md`. Simulator or Expo Go success alone is not release acceptance.

## Traceability: P0 requirements → milestones

| ID | Requirement | Milestones |
| --- | --- | --- |
| F1 | Today screen with schedules and progress | M2, M3 |
| F2 | One mission per screen | M4 |
| F3 | Self-verify payouts; key missions wait for approval | M5, M8 |
| F4 | Quest completion celebration | M9 |
| F5 | Pause and resume | M4, M6 |
| F6 | PIN caregiver mode | M7, M8 |
| F7 | Reward store and redemption log | M13 |
| F8 | Rook companion | M12 |
| F9 | Village | M11 |
| F10 | Badges and levels | M10 |
| F11 | Local reminders | M14 |

## Backlog (not scheduled; do not build in P0)

| ID | Requirement | Priority | Phase | Notes |
| --- | --- | --- | --- | --- |
| F12 | Full in-app quest builder | P1 | v1.1 | Confirm whether adding chores must move into P0 (open decision) |
| F13 | Separate-device sync and push approval alerts | P1 | v1.1 | Needs backend choice (Supabase/Firebase), accounts, deletion flow |
| F14 | Weekly Chest at 80% and bigger-quest rewards | P1 | v1.1 | |
| F15 | Skip and insights; reschedule without penalty | P1 | v1.1 | |
| F16 | Recorded caregiver voice | P1 | v1.1 | |
| F17 | Optional photo proof | P2 | later | Private storage, camera permission |
| F18 | Demo videos, adaptive prompt reduction, Rook customization, widget | P2 | later | Widget is listed under native capabilities |

Reinstall recovery and cloud backup are **not** part of P0; local SQLite does not
survive uninstall. The app must never imply otherwise.
