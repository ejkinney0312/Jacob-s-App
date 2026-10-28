# Quest Blocks status

Last updated: 2026-10-27 — M7 committed (`cc722ac`; M5, M6, M7 not yet pushed). M8 approvals and caregiver editing built, uncommitted.

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

- **M8 approvals and caregiver editing (new, behind the PIN):** the unlocked Caregiver tab now has an
  **Approvals** list (finished key missions from any day, with what approving adds), **Approve**, and **Ask
  for another try**; a **Quests** list with an on/off switch per quest and **Edit rewards**; and an inline
  reward editor (per-mission amounts and the quest bonus, whole numbers 0 to 1000). `approveMission`
  (`src/db/approvals.ts`) runs in one transaction: mark approved, pay the mission under the same payout key
  a self-verify mission uses (so it can never double-pay), and if that finishes the quest (nothing else
  waiting) pay the bonus. `requestAnotherTry` puts the mission back as current, pays and removes nothing,
  keeps a paused quest paused, and counts the tries so Jacob sees "Your caregiver asked for another try on
  this step. That's okay." Quests switched off vanish from Today immediately and keep their progress.
  Edits (`src/db/caregiver-edits.ts`) are all-or-nothing, validated, and never touch earned totals. New
  **migration v2** adds the tries counter. Editing is inline in the Caregiver tab because a separate screen
  would count as leaving the tab and relock the PIN session. Rules are proposed in `docs/DECISIONS.md`
  ("Proposed approval and caregiver editing rules (M8)"), built on the unresolved "Approval flow" row.

- **M7 caregiver PIN (new):** the Caregiver tab is now a real lock. Set a 6-digit PIN (repeats and runs
  refused), type it again, and get a one-time **recovery code**; enter the PIN to unlock; "Forgot PIN?"
  takes the recovery code and a new PIN; unlocked mode has Lock now and New recovery code. Only a
  PBKDF2-HMAC-SHA256 verifier (10,000 iterations, random salt) is stored, in `expo-secure-store`
  (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`); the PIN and code are never saved or logged. 5 wrong tries, then waits
  of 30 s doubling to 15 min, shown as a fixed clock time rounded up to the minute (never a countdown); every
  guess is counted before it is checked, overlapping guesses are queued, a clock set backwards cannot shorten
  a wait, and an unreadable counter fails closed to "locked". Records carry a per-install id so a PIN left in
  the iOS Keychain by an earlier install is ignored. Damaged data fails closed and offers recovery.
  Caregiver mode lives in memory only and locks when the tab is left, when the app leaves the foreground,
  after 5 idle minutes, and when the app closes. Policy is in `src/domain/caregiver-*.ts`; the service is
  `src/services/caregiver-pin.ts`. Added `expo-crypto` (secure random numbers) and `@noble/hashes` 1.8.0
  (PBKDF2; `expo-crypto` has none). **The evaluation CLAUDE.md requires, with measured timings, is in
  `docs/DECISIONS.md` ("PIN protection evaluation (M7)") and is awaiting your confirmation.** There is no
  hard-coded demo PIN (a secret in source would defeat the point); in development you set your own.

- **M6 pause and resume (new):** a **Pause** button on every mission screen (order: Replay audio, I need
  help, Pause, Mission complete). `pauseQuest` sets an in-progress quest to `paused` and nothing else: the
  saved position, finished missions and ledger are untouched, it is harmless to press twice, and it does
  nothing to a quest that is not in progress. `openQuest` (renamed from `startQuest`) starts a
  not-started quest and **resumes** a paused one at exactly the saved mission. Both calls are queued with
  `completeMission`, so a pause landing during a completion lines up behind it. Finishing a mission on a
  quest that still says paused puts it back in progress. Today shows "Paused at mission 2 of 3. Tap to
  resume." No timers or countdowns. Proposed rules are in `docs/DECISIONS.md` ("Proposed pause and
  resume behavior (M6)").

- **M5 reward ledger (new):** finishing a mission now pays. `completeMission` runs in ONE transaction:
  mark the mission done, pay its stored reward, save the position, update the quest, and, if that
  completes the quest, pay the quest bonus. A key mission waits and pays nothing. Payouts go through
  `payOnce` (`src/db/ledger.ts`): keyed by what earned them (`mission:<mission instance>` /
  `questBonus:<quest instance>`), `INSERT OR IGNORE` on a unique key, whole non-negative numbers only,
  zero rewards write no row, and the call returns what was actually written. Overlapping calls on one
  database are queued (`src/db/exclusive.ts`). Earned totals on Today are the ledger sum and only grow.
  `completeMission` now returns `{ outcome, paid, bonus, questCompleted }` for the celebration (M9).
  Real spending is untouched: there is no spend path, balance or debit. Payout rules are proposed in
  `docs/DECISIONS.md` ("Proposed reward payout rules (M5)"). The Today demo notice now says anything
  earned is for testing only.

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
| `npm test -- --runInBand` | Passed: 19 suites, 337 tests. Domain tests (dates, schedules, engine, rewards, demo content) plus database tests (below) |
| Database tests (`src/db/__tests__/`) | Passed. Run our real migration and query code against real SQLite via Node's `node:sqlite`: fresh install, safe re-run, upgrade with data kept, failed migration rolls back and retries, newer database refused, no spend tables, double-pay rejected, no negative amounts, append-only ledger, one instance per quest per date, bad status and orphan rows rejected, seed is idempotent / all-or-nothing / does not restore removed demo rows, corrupt schedule fails loudly, earned totals sum |
| Schedule engine tests | Passed: valid/invalid dates incl. leap years; day math across month, year, leap day and both 2026 US DST changes; local midnight rollover and the 25-hour and 23-hour days in `America/Chicago`; same instant in four zones; every-N-days from the anchor (not before it, no drift over a year); weekly; demo quests due on Sat 10-24, Fri 10-23 and 2026-01-04; instance creation idempotent, no back-fill of missed days, quest-off keeps history, progress preserved, per-date separation, all-or-nothing, rejects invalid date |
| Today tests | Passed: only today's quests; Friday list order; repeat opens don't duplicate or reset progress; completed/approved/waiting counts; rollover at local midnight leaves yesterday untouched; New York vs Chicago for one instant; empty day; ledger totals; all-or-nothing on failure; progress wording; no shaming words; `formatLocalDate` unaffected by device time zone |
| M4 tests | Passed: mission-flow rules (current mission, waiting vs completed, position to save, quest status); database: starts on first mission, completing saves next position and starts the quest, reads back after a "restart", idempotent double tap, refuses skipping ahead / unknown ids, key mission waits and quest is not done until approved, quest completes when the last mission needs no approval, pays nothing, all-or-nothing on failure, dates stay separate, audio setting default/remembered/no duplicates |
| M5 tests (`src/db/__tests__/rewards.test.ts`) | Passed: `payOnce` pays once and zero on repeat, rejects negative / fractional / NaN / infinite, no row for zero; self-verify mission pays stored amounts; key mission pays nothing while waiting; double tap, retry and reopen never pay twice; two simultaneous taps pay once; overlapping completions of different missions are ordered; opening/restarting/reloading Today never pays; the same mission pays again on another day; amounts come from content and later edits don't change past payouts; quest bonus paid once, and held back while a mission waits; crash while recording the payout / after it was written / while paying the bonus each roll everything back, and a retry pays exactly once; a failed call doesn't block the queue; ledger sum = Today's displayed totals; totals never decrease; entries can't be changed or removed |
| M6 tests (`src/db/__tests__/pause-resume.test.ts` + domain) | Passed: pause keeps position and finished missions exactly; harmless twice; no effect on not-started or completed quests; only that quest on that day; opening a paused quest resumes at the same mission; survives a "force-quit" (state reloaded from storage, Today shows paused at the right place); finishing a mission on a paused quest returns it to in progress; five pause/resume cycles change nothing else; completed quest stays completed; pause/resume/stale taps pay each mission exactly once; pausing pays nothing and removes nothing; a pause racing a completion lines up and pays once; pausing a quest that is only waiting on approval keeps the waiting mission and no bonus; paused wording has no shaming words |
| M7 tests (`src/domain/__tests__/caregiver-*.test.ts`, `src/services/__tests__/caregiver-pin.test.ts`, `src/features/caregiver/__tests__/messages.test.ts`) | Passed. Policy: PIN format, lockout schedule (5 free, 30 s doubling to 15 min, about 27 years to try every PIN at the cap), clock-back protection, recovery-code alphabet (no bias, no look-alikes) and tolerant typing, session idle/clock rules. Service against real PBKDF2: only salted hashes stored (no PIN or code anywhere in storage), refuses weak PINs, different salt every time, right/wrong PIN, wrong guesses counted and locked, wait honoured and the right PIN refused during it, survives restart, counted even if the app stops mid-check, 8 simultaneous guesses count one by one, malformed input not counted, damaged / corrupted / stale-install data fails closed, change PIN, recovery code (typed sloppily, rotated, shares the limit, works when the PIN record is damaged), strength upgrade on next entry, the real 10,000-iteration setting works, no secret in any console method or error message. Messages: fixed clock time rounded up, no countdown, no shaming words |
| M8 tests (`approvals.test.ts`, `caregiver-edits.test.ts`, migration v2 tests, domain and message tests) | Passed. Queue: empty until a key mission finishes, details and reward shown, all days oldest first, nothing paid while waiting. Approve: pays the mission and the bonus in one go, never twice (repeat, double tap, retry, two at once), no bonus while another mission waits, survives a restart, shows correctly on Today, pays the amount stored at approval, never un-pauses a quest, works for an earlier day. Not waiting / unknown / already paid: nothing happens. Another try: mission becomes current again, nothing paid or removed, counter and resume position correct, can be tried and approved later and still pays once, no limit, harmless twice, cannot undo an approval, leaves a paused quest paused. Crashes at the bonus, at the quest update and at another-try each roll back and a retry pays once. Totals never decrease through any mix. Edits: switching off hides from Today immediately, keeps progress, creates no new days, waiting missions still approvable; reward edits saved, apply to future pay only, never change the ledger or earned totals, refuse negative / fractional / too large / NaN / other quest's mission / unknown quest with nothing saved, all-or-nothing on failure. Migration v2: a v1 database with data upgrades with every row kept and the counter at 0, rejects negatives, applies once. Wording: no reject/deny/penalty words |
| Test sensitivity (mutation check) | Broke the code thirty-five ways (earlier ones: migration/seed transactions, ledger triggers, schedule and instance rules, mission-order and double-tap guards, key-mission waiting, position saving; M5: plain INSERT for payouts, paying waiting missions, no call serialization, hard-coded rewards, bonus paid while a mission waits, payout key not unique per day; M6: pausing any status, opening not resuming, finishing a mission leaving a paused quest paused, pause resetting the position; M7: counting a guess after checking it, no queueing of overlapping guesses, trusting a clock set back, an unreadable counter resetting to zero, accepting records from another install, storing the PIN in plaintext, not rotating the recovery code, accepting guesses while locked; M8: bonus paid while another mission waits, approving un-pausing a quest, another-try forgetting where to resume, overlapping approvals not queued, approval without a transaction, reward edits not validated, Today still showing a switched-off quest); every break was caught; code restored and re-run green |
| `npx expo export` for iOS and Android | Passed, both bundles built |
| Run on iOS simulator (iPhone 16 Plus, iOS 18.6, Expo Go) | Passed: migrations ran, demo data seeded, Today and Caregiver tabs render from SQLite. After M3: Today showed "Tuesday, October 27" with only the daily quest (correct: garden quest not due, trail quest is Fridays), so Hermes handles the `Intl` date calls. At the largest iOS accessibility text size, text wrapped and scrolled with nothing clipped (a smoke check, not a VoiceOver test) |
| M4 on the iOS simulator | Mission screen, "Mission 3 of 3" after a relaunch with progress put in the database by script, the "All missions finished · 1 waiting" screen, and Today's progress bar all rendered correctly. **Not exercised on-device:** tapping Mission complete / I need help / Replay audio, the read-aloud switch, and actual speech (no way to send taps in this environment; macOS blocked scripted clicks). Their logic is unit-tested, not their wiring |
| M5 on the iOS simulator | App boots and Today renders with the new ledger code (totals 0, new demo notice). **Payouts were not exercised on-device**: no way to tap Mission complete here. Payout behavior is covered by the database tests against real SQLite via Node, not by expo-sqlite on a device |
| M6 on the iOS simulator | With the database set to "paused at mission 2" by script, Today showed "Paused · … Paused at mission 2 of 3. Tap to resume." with the bar at one third. Opening the quest (deep link, running the app's real code) changed the stored status `paused` → `inProgress`, position stayed 2, the ledger stayed empty, and the screen showed Mission 2 of 3 with the Pause button. **Not exercised on-device:** tapping Pause itself and the return to Today (no way to send taps here). Its logic and the database write are unit-tested |
| M7 on the iOS simulator (Hermes, real SecureStore, real `expo-crypto`, Expo Go) | A temporary self-test (removed, nothing left in the repo) ran the real service: set PIN, right and wrong PIN, restart, recovery-code reset, new PIN works and old one is refused, a different install id ignores the entry, nothing secret in stored values, cleanup. All passed. **Timing under Hermes: PBKDF2 at 10,000 iterations 0.73 s, 100,000 7.0 s, 300,000 20.9 s, 600,000 42 s**; with the chosen 10,000, verifying took about 0.7 s and setting a PIN 1.4 s. Screens photographed: set-PIN, enter-PIN, and the locked message ("try again at 8:21 PM"). **Not exercised by tap:** typing digits, the Unlock / Set PIN / Forgot buttons, the recovery-code screen, the unlocked screen and relock on tab-leave / background / idle |
| M8 on the iOS simulator | With the unlocked view forced on for screenshots only (a temporary change, removed; I cannot type a PIN here) and the database set by script: the Approvals panel showed the waiting mission with its day, what approving adds, and the Approve / Ask for another try buttons; the Quests panel showed the on/off switch and Edit rewards; the reward editor showed the stored amounts (5 / 2 / 0 per mission, bonus 10 / 4 / 1); Today showed "3 of 3 missions finished · 1 waiting for approval"; Jacob's mission screen showed the calm another-try note. **The existing on-device database was upgraded from v1 to v2 by the real app** and kept working. **Not exercised by tap:** Approve, Ask for another try, the quest switch, typing in the editor and Save, so none of the new buttons' wiring ran on a device, and the PIN gate in front of all of this was bypassed for the screenshots. The database logic behind each button is unit-tested |
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
- A paused quest stays on its own date: at midnight it is no longer on Today (proposed, see DECISIONS).
- Approvals and editing are only reachable by tapping; none of those taps could be exercised here. The caregiver screens (approvals, quests, editor) have no automated UI tests, only the database, domain and message logic underneath. Nothing notifies the caregiver that a mission is waiting (push is P1).
- Caregiver PIN: no "change PIN" screen yet (the code and tests exist). No Face ID / fingerprint. Secure storage was only exercised in Expo Go on the iOS simulator, **not** on a development build or real hardware, so it is not release-acceptable. Android Keystore is untested. `expo-dev-client` was deliberately not added.
- Metro prints a harmless warning from `@noble/hashes` 1.8.0 ("crypto.js is not listed in exports ... falling back to file-based resolution"). It still works. Version 2.x is ESM-only and would need Jest changes; not worth it now.
- Quests can be played and pay, but there is no feedback on a payout beyond Today's totals (the celebration is M9). Approving a waiting mission does not exist yet (M8), so a key mission's reward and the quest bonus stay unpaid for now.
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

**M9: quest completion celebration.** A calm single animation and one soft chime when a quest is finished, showing the
bonus already paid by the ledger (`completeMission` and `approveMission` return `questCompleted` and `bonus`
for this). It must respect Reduce Motion (a static state, not a weakened animation), audio-off and silent mode,
never flash, and have an optional haptic. Not blocked by decisions; needs real-device checks for sound and haptics.
After that: M10 (levels and badges) and M11 (village). Both need approved content from you (badge thresholds, starting
level, the four structures and their stages), so I will use clearly labelled placeholders unless you send it.
**Please review the proposed rules in `docs/DECISIONS.md`: schedule, audio/help, payouts, pause, PIN and now approvals.** The
PIN evaluation in particular should be confirmed before the caregiver tools are used for real.
