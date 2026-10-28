# Quest Blocks status

Last updated: 2026-10-27 — through the Expo patch update committed (`8379916`, not yet pushed). M4 mission flow built, uncommitted.

## Current setup

- Expo SDK 58 (`expo ~58.0.20`, `expo-router ~58.0.27`), React Native 0.88.0, React 19.3.0, TypeScript ~6.0.3
  (`strict: true`), Expo Router (`src/app/`), npm.
- Tooling: `jest-expo` (Jest 30), ESLint 9 with `eslint-config-expo` (flat config in
  `eslint.config.js`), `@types/node` ^24 (matches Node 24; used only by the SQLite test helper).
- Updated 2026-10-27 with `npx expo install --fix`: `expo` 58.0.19→58.0.20, `expo-router` 58.0.26→58.0.27,
  `@expo/ui` 58.0.23→58.0.24, `expo-web-browser` 58.0.6→58.0.7. It also added the `expo-web-browser`
  config plugin to `app.json`. Re-ran tsc, lint, tests and the iOS simulator afterwards: all fine, and
  the earlier `TabButton` ref fix still type-checks.
- Installed with `npx expo install`: `expo-sqlite`, `expo-secure-store`, `expo-notifications`,
  `expo-speech`, `expo-haptics`. Only `expo-sqlite` is used in code so far. The others are
  installed and ready; their features come in later milestones.
- `app.json`: display name "Quest Blocks"; plugins `expo-sqlite`, `expo-secure-store`,
  and `expo-notifications` with `enableRemoteNotifications: false` (P0 is local reminders only;
  push is P1). No bundle IDs or store settings: distribution is undecided.
- TypeScript fixes preserved: `expo-env.d.ts` (local, gitignored; Expo regenerates it on
  `expo start`) and the `TabButton` ref type in `src/components/app-tabs.web.tsx`.
- No cloud, no backend, no analytics.

### What was built

- **M4 mission flow (new):** tap a quest on Today to open it above the tabs (root Stack with a `(tabs)`
  group; routes moved to `src/app/(tabs)/`, new `src/app/quest/[instanceId].tsx`). One mission per
  screen: system icon, short title, instruction, then always in this order **Replay audio**, **I need
  help**, **Mission complete** (primary button 64 high). Help is a calm preset screen (step again, the
  mission's tip, "ask someone nearby"); it contacts no one. Finishing a mission saves everything in one
  transaction (`completeMission`): done (key missions become "waiting for approval"), the position to
  resume at, and the quest status. A repeated tap is harmless and out-of-order completion is refused.
  Opening a quest marks it started. When all missions are finished the screen says "Quest finished" or
  "All missions finished · N waiting for a caregiver". Read-aloud uses `expo-speech`, speaks on arrival
  unless the "Read missions aloud" switch on Today is off or a screen reader is on, and stops when
  leaving. **Nothing is paid yet**: rewards arrive with M5, so missions finished during M4 testing have no
  ledger rows. Audio/help behavior is proposed in `docs/DECISIONS.md` ("Proposed audio and help behavior (M4)").

- **M3 Today (new):** Today now shows only the quests scheduled for the device's current local date,
  with the formatted date, per-quest status and progress in words plus a bar ("0 of 3 missions
  finished", "Not started · Every day"), earned totals, empty / all-done / loading / error states
  (error has a 64-high "Try again" button), and the demo notice. `loadToday` (`src/db/today.ts`)
  creates the day's instances idempotently; `useToday` reloads on focus, on returning to the app,
  and when the local date changes (checked once a minute while the app is open). Quests are not
  tappable yet; playing one is M4. New pure helpers: `src/domain/progress.ts`, `formatLocalDate`.
  A waiting-for-approval mission counts as finished by the player but earns nothing yet.
- **README** rewritten for Quest Blocks (it was the Expo starter text).

- **M2 schedule engine (new, not shown in the UI yet):** `src/domain/local-date.ts` (real calendar
  validation, exact day arithmetic, weekday, instant → local date in a given time zone),
  `isScheduledOn` / `questsScheduledOn` / stable ID helpers in `src/domain/schedule.ts`, and
  `ensureInstancesForDate` / `listQuestInstances` in `src/db/instances.ts` (idempotent, transactional,
  never resets progress). `parseSchedule` now rejects impossible dates such as `2026-02-30`.
  Rules are **proposed, not approved**; worked examples are in `docs/DECISIONS.md`.

- **Theme** (`src/constants/theme.ts`): calm original light/dark palette. All text pairs checked
  at ≥ 4.5:1 and border/primary at ≥ 3:1 with a WCAG calculation. Sizing tokens for 48 touch
  targets and 64 primary buttons. Body text 18/26, links underlined (not color-only).
- **Navigation**: two tabs, **Today** and **Caregiver** (native tabs on iOS/Android, custom tabs
  on web). Starter screens and components removed. Tab icons are still the starter's PNGs.
- **Domain** (`src/domain/`): types for schedules, quests, missions, instances, progress,
  ledger entries and reward items; schedule parsing/description; reward helpers; demo content.
  `REDEMPTION_ENABLED = false`. No spendable balance, debit or redemption record exists anywhere.
- **SQLite** (`src/db/`): versioned migrations using `PRAGMA user_version`, each in a
  transaction with its version bump; refuses a database from a newer app version.
  Schema v1: players, quests, missions, quest/mission instances (unique per quest + date),
  append-only ledger (unique idempotency key, non-negative amounts, update/delete blocked by
  triggers), reward items, settings.
- **Demo data**: three fictional quests (daily, every 3 days, Fridays) and two demo rewards, all
  titled "Demo". Seeded once, development builds only (`__DEV__`). The Bathroom quest is not
  included, and no total is claimed as verified.
- **Screens**: Today lists quests from SQLite with schedule text, mission count, and earned
  totals (all 0). Caregiver is a placeholder that says the PIN lock and reward spending are not
  active yet. Web shows a "runs on iPhone and Android" notice because SQLite on web needs extra
  setup.

## Checks (run 2026-10-24)

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | Passed, exit 0 |
| `npx expo-doctor` | Passed, 20/20 after `npx expo install --fix` (it had dropped to 19/20 from patch drift). `npx expo install --check`: dependencies up to date |
| `npm run lint` | Passed, exit 0, no warnings. Confirmed it flags bad code (a deliberate probe file was caught, then removed). It found one real error in the starter's `use-color-scheme.web.ts` (setState in an effect); fixed with `useSyncExternalStore`, web file only |
| `npm test -- --runInBand` | Passed: 11 suites, 127 tests. Domain tests (dates, schedules, engine, rewards, demo content) plus database tests (below) |
| Database tests (`src/db/__tests__/`) | Passed. Run our real migration and query code against real SQLite via Node's `node:sqlite`: fresh install, safe re-run, upgrade with data kept, failed migration rolls back and retries, newer database refused, no spend tables, double-pay rejected, no negative amounts, append-only ledger, one instance per quest per date, bad status and orphan rows rejected, seed is idempotent / all-or-nothing / does not restore removed demo rows, corrupt schedule fails loudly, earned totals sum |
| Schedule engine tests | Passed: valid/invalid dates incl. leap years; day math across month, year, leap day and both 2026 US DST changes; local midnight rollover and the 25-hour and 23-hour days in `America/Chicago`; same instant in four zones; every-N-days from the anchor (not before it, no drift over a year); weekly; demo quests due on Sat 10-24, Fri 10-23 and 2026-01-04; instance creation idempotent, no back-fill of missed days, quest-off keeps history, progress preserved, per-date separation, all-or-nothing, rejects invalid date |
| Today tests | Passed: only today's quests; Friday list order; repeat opens don't duplicate or reset progress; completed/approved/waiting counts; rollover at local midnight leaves yesterday untouched; New York vs Chicago for one instant; empty day; ledger totals; all-or-nothing on failure; progress wording; no shaming words; `formatLocalDate` unaffected by device time zone |
| M4 tests | Passed: mission-flow rules (current mission, waiting vs completed, position to save, quest status); database: starts on first mission, completing saves next position and starts the quest, reads back after a "restart", idempotent double tap, refuses skipping ahead / unknown ids, key mission waits and quest is not done until approved, quest completes when the last mission needs no approval, pays nothing, all-or-nothing on failure, dates stay separate, audio setting default/remembered/no duplicates |
| Test sensitivity (mutation check) | Broke the code ten ways (no migration transaction, no ledger triggers, no seed transaction, due-before-anchor, plain INSERT for instances, recreating missions for existing instances, no out-of-order guard, no already-done guard, key missions completing at once, position never saved); every break was caught; code restored and re-run green |
| `npx expo export` for iOS and Android | Passed, both bundles built |
| Run on iOS simulator (iPhone 16 Plus, iOS 18.6, Expo Go) | Passed: migrations ran, demo data seeded, Today and Caregiver tabs render from SQLite. After M3: Today showed "Tuesday, October 27" with only the daily quest (correct: garden quest not due, trail quest is Fridays), so Hermes handles the `Intl` date calls. At the largest iOS accessibility text size, text wrapped and scrolled with nothing clipped (a smoke check, not a VoiceOver test) |
| M4 on the iOS simulator | Mission screen, "Mission 3 of 3" after a relaunch with progress put in the database by script, the "All missions finished · 1 waiting" screen, and Today's progress bar all rendered correctly. **Not exercised on-device:** tapping Mission complete / I need help / Replay audio, the read-aloud switch, and actual speech (no way to send taps in this environment; macOS blocked scripted clicks). Their logic is unit-tested, not their wiring |
| Android (emulator or device) | **Untested.** Bundle builds, but no Android runtime was available |
| Real iPhone / Android hardware | **Untested**, including speech, silent mode and volume behavior |
| Accessibility (VoiceOver, TalkBack, 200% text, Reduce Motion) | **Untested.** Labels and header roles are set; no assistive-tech check has been done |
| Migration upgrade path with real released data | Only tested with a test-only v2; the real app has only v1 |
| `npm audit` | Reports 5 high-severity vulnerabilities; not investigated |

The database tests use Node's SQLite, not `expo-sqlite`. They prove our SQL and migration logic; they do not prove expo-sqlite's native behavior, which was only checked once on the iOS simulator. Android SQLite is untested.

## Known gaps and notes

- Selected-tab color on iOS is the system blue, not the theme's `primary`; set it when icons are redone.
- Caregiver tab uses the starter's "explore" icon as a placeholder; original icons are needed.
- `expo-dev-client` was added automatically by `expo install` and then removed on purpose; add it
  when a development build is needed (required for notification and secure-store testing on devices).
- Database tests need Node 22.5+ (`node:sqlite`); this machine runs Node 24. Older Node would fail them.
- Quests can be played but pay nothing yet (M5). No pause/resume button yet (M6): leaving a quest keeps the position, but there is no explicit Pause control.
- A cold-start deep link (`exp://…/--/quest/…`) opened Today instead of the quest in Expo Go; the same link worked when the app was already running. Normal navigation (tapping a card) is the real path and was not tested by tap. Worth confirming on a real device.
- Mission icons are system symbols (SF Symbols / Material), not original art. The generic "explore" tab icon is still a placeholder.
- Help taps are not recorded (privacy-minimal); the PRD success metric needs them. See `docs/DECISIONS.md`.
- Not verified by tap or on a device: the once-a-minute date check, reload on returning to the app, and the error state (unit tests cover `loadToday`, not the hook or screens; no screen-test library is installed).
- `package.json` still has the starter's `reset-project` script, which would move `src/app` into `example/`. The new README does not mention it; consider removing the script.

## Unresolved decisions (from `docs/DECISIONS.md`)

None have been answered. Reward spending remains unresolved and is kept disabled.

| Decision | Blocks |
| --- | --- |
| Emerald purchases: do they debit spendable balance? | M13 real redemption (disabled). No spend schema exists yet |
| Prototype/content export (quests, Rook dialogue, rewards) | Real content; demo data stands in |
| Bathroom fixture totaling 95 XP / 38 emeralds / 1 block | "Verified" claim in M15 |
| Schedule edge cases (anchor, DST, travel, missed quests, quiet-hours deferral) | M2 merge, M14 |
| Approval transitions (reject, redo, quest-bonus timing) | M8 (no "rejected" status exists) |
| Rook tap-to-talk meaning | M12 |
| Village structures/stages, badge thresholds, starting level | M10, M11 |
| Can P0 add chores, or only enable/disable supplied quests? | Scope of M8; F12 stays P1 |
| Target phones and minimum OS | M15 |
| Distribution, account holder, final app-name availability | Real bundle IDs; store config |
| PIN derivation, retry limits, relock, recovery | M7 real caregiver access |

## Next implementation task

**M5: reward ledger.** Atomic, idempotent payouts: finishing a self-verify mission pays its XP /
emeralds / blocks exactly once (a key mission pays nothing until approved), keyed by mission-instance
id and written in the same transaction as the completion. Earned totals on Today start moving.
Not blocked by open decisions; real *spending* stays disabled. Decide whether missions already finished
during M4 testing should be paid retroactively (proposed: no, they are demo data).
Still waiting for your review of the proposed schedule rules and the audio/help rules in `docs/DECISIONS.md`.
