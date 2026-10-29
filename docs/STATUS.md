# Quest Blocks status

Last updated: 2026-10-28 — pushed through M12 (`c7d7f2c`). M13 reward store with demo rewards built, uncommitted.

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

- **M13 reward store with demo rewards (new), redeeming OFF:** the player sees a **Reward store** on the Progress tab (under the
  level): the two demo rewards with their costs and calm affordability text ("6 more emeralds to go."), **"Emeralds available"
  and "Earned in total ... never goes down" as two separate numbers**, and buttons that say "Redeeming is turned off". The
  caregiver's Reward store panel (behind the PIN) says "Redeeming: Off" and why, lets them change each cost (1 to 1000 emeralds,
  applies from now on) and show or hide each reward, and shows the **redemption log**. **Migration v5** adds a permanent
  `redemptions` log (never edited or deleted; title and cost copied in; unique request key). `redeemReward` does everything in one
  transaction (policy, reward exists and is shown, enough emeralds available, record it), is idempotent per request key, queued, and
  **writes nothing and reads nothing unless the policy is on; the app always uses the default, which is off.** The **ledger stays
  earn-only**: redeeming lowers only "Available" (earned minus redeemed), never "Earned". **This does not decide the open emerald-spending
  question**; see `docs/DECISIONS.md` ("Proposed reward store (M13)"). Redeeming itself is exercised only by tests.

- **M12 Rook with placeholder lines (new):** Rook, the companion, is a reusable card (avatar, his words as text, "Hear Rook")
  that reads the line on screen with the phone's text-to-speech. **Nothing is spoken until tapped; there is no microphone,
  no recording, no network and no AI.** On **Today** he gives a greeting, or one calm reaction to anything new ("You reached
  Level 2 and the village grew. You can see what changed on the Progress and Village tabs.") with an "Another line" button that
  shows and says the next line; this **replaces** the separate "What's new" card (and its two unused helper functions were removed).
  On a **mission** he welcomes the player to a quest nothing has been finished in yet and gives the mission's tip, **below
  the controls so they stay in the same place on every mission** (a first version put him above them and pushed "Mission
  complete" off the screen; caught on the simulator and moved). Every line is a clearly labelled demo placeholder ("Demo lines"),
  adult and warm, with no exclamation marks, pressure, failure or missed-day wording (a test enforces it on every line).
  The quest welcome is built from the quest's name and mission count. **"Independent finish" is deliberately not built** (it needs
  "I need help" taps recorded, which is undecided). No database changes. See `docs/DECISIONS.md` ("Proposed Rook (M12)").

- **M11 village with placeholder structures (new):** a **Village tab** (now Today, Progress, Village, Caregiver) shows four
  clearly labelled **demo placeholder structures** (Workshop, Garden, Lookout, Bridge; 21 blocks in all, each with story
  stages). The village is a pure function of **blocks earned** from the ledger, filled in order, so a stage can never go
  backwards; it needs no table of its own. Blocks show as filled or outlined squares and every stage and structure is also
  stated in words (Built / Next / Later; Not started / Building / Complete). Extra blocks beyond 21 are kept ("complete for
  now"). Opening Village lists the stages that just grew with their story lines and records them as seen; Today shows
  "N new stages in the village" until then. **A conflict in the PRD is resolved as a proposal, not silently:** the overview
  says blocks grow the village but F9 says completed quests, so blocks drive it (a quest with a zero-block bonus adds nothing).
  See `docs/DECISIONS.md` ("Proposed village (M11)"). The structures, stages and stories are unconfirmed.

- **M10 levels and placeholder badges (new):** Level = floor(XP / 100) + 1 (flat 100 XP per level, starting at
  Level 1 as a proposal), shown on Today with a bar and "35 of 100 XP towards Level 3". A new **Progress tab**
  (Today, Progress, Caregiver) shows the level and six **demo placeholder badges** (First mission, First quest,
  First block, Three days, Level 2, Emerald pocket), each marked "Demo badge", with "Earned on …" or "Not earned
  yet" in words. Badges use only cumulative counts (no streaks), are awarded inside the same transaction as the
  payout that earns them, are earned once, and cannot be removed or re-dated (**migration v4**: an `earned_badges`
  table with triggers, like the ledger). A key mission earns nothing, and so no badge, until it is approved.
  Opening Progress catches up any badge already earned before badges existed. Today shows a short "What's new"
  note (level reached, new badges) until Progress is opened; level-up and new-badge facts are stored, not
  returned from payouts, so Rook (M12) can react to them later. Fixed "1 blocks" on Today (now "1 block").
  The starting level and every badge are **unconfirmed**; see `docs/DECISIONS.md` ("Proposed levels and badges (M10)").

- **M9 quest completion celebration (new):** when a quest becomes complete, Jacob sees one calm celebration, once:
  a block settles into place (0.7 s), the words fade in, one soft chime plays, and it shows the bonus that was
  actually paid (read from the ledger) and "Nice work." Nothing loops or flashes. **Reduce Motion** shows the
  finished picture at once (nothing moves; not a shortened animation); the screen waits for the system's
  answer before drawing anything, so it never starts moving for someone who asked it not to. The chime is
  **original**, synthesized by `scripts/chime-synth.js` into `assets/sounds/quest-chime.wav` (about 1.6 s, quiet),
  played with `expo-audio` with **silent mode respected** (the library plays through silent mode by default, so
  the app turns that off) and only when the audio switch is on. The switch on Today is now "Read aloud and
  sounds". A new "Gentle vibration" switch controls one light haptic tap on **Mission complete**.
  Screen readers hear one announcement. It is recorded as shown the moment it appears (**migration v3**
  adds `celebrated_at`; quests finished earlier are backfilled so nothing celebrates retroactively), so it
  never repeats; a quest completed by a caregiver's approval is celebrated the next time Jacob opens it.
  Showing it pays nothing. Added `expo-audio` and its required peer `expo-asset` (found by `expo-doctor`).
  Proposed behavior is in `docs/DECISIONS.md` ("Proposed celebration behavior (M9)").

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
| `npx expo-doctor` | **19/20 on 2026-10-28**: Expo published another round of patch versions overnight (`expo` 58.0.21, `expo-router` 58.0.28, `@expo/ui` 58.0.25, `expo-asset` 58.0.19, `expo-constants`, `expo-font`, `expo-image`, `expo-linking`, `expo-notifications`, `expo-splash-screen`, and more), so the installed ones trail by one. Not caused by our code; fix with `npx expo install --fix` (needs your OK, then re-run everything). It was 20/20 until then. Earlier: passed 20/20 after `npx expo install --fix` (it had dropped to 19/20 from patch drift). `npx expo install --check`: dependencies up to date |
| `npm run lint` | Passed, exit 0, no warnings. Confirmed it flags bad code (a deliberate probe file was caught, then removed). It found one real error in the starter's `use-color-scheme.web.ts` (setState in an effect); fixed with `useSyncExternalStore`, web file only |
| `npm test -- --runInBand` | Passed: 30 suites, 544 tests. Domain tests (dates, schedules, engine, rewards, demo content) plus database tests (below) |
| Database tests (`src/db/__tests__/`) | Passed. Run our real migration and query code against real SQLite via Node's `node:sqlite`: fresh install, safe re-run, upgrade with data kept, failed migration rolls back and retries, newer database refused, no spend tables, double-pay rejected, no negative amounts, append-only ledger, one instance per quest per date, bad status and orphan rows rejected, seed is idempotent / all-or-nothing / does not restore removed demo rows, corrupt schedule fails loudly, earned totals sum |
| Schedule engine tests | Passed: valid/invalid dates incl. leap years; day math across month, year, leap day and both 2026 US DST changes; local midnight rollover and the 25-hour and 23-hour days in `America/Chicago`; same instant in four zones; every-N-days from the anchor (not before it, no drift over a year); weekly; demo quests due on Sat 10-24, Fri 10-23 and 2026-01-04; instance creation idempotent, no back-fill of missed days, quest-off keeps history, progress preserved, per-date separation, all-or-nothing, rejects invalid date |
| Today tests | Passed: only today's quests; Friday list order; repeat opens don't duplicate or reset progress; completed/approved/waiting counts; rollover at local midnight leaves yesterday untouched; New York vs Chicago for one instant; empty day; ledger totals; all-or-nothing on failure; progress wording; no shaming words; `formatLocalDate` unaffected by device time zone |
| M4 tests | Passed: mission-flow rules (current mission, waiting vs completed, position to save, quest status); database: starts on first mission, completing saves next position and starts the quest, reads back after a "restart", idempotent double tap, refuses skipping ahead / unknown ids, key mission waits and quest is not done until approved, quest completes when the last mission needs no approval, pays nothing, all-or-nothing on failure, dates stay separate, audio setting default/remembered/no duplicates |
| M5 tests (`src/db/__tests__/rewards.test.ts`) | Passed: `payOnce` pays once and zero on repeat, rejects negative / fractional / NaN / infinite, no row for zero; self-verify mission pays stored amounts; key mission pays nothing while waiting; double tap, retry and reopen never pay twice; two simultaneous taps pay once; overlapping completions of different missions are ordered; opening/restarting/reloading Today never pays; the same mission pays again on another day; amounts come from content and later edits don't change past payouts; quest bonus paid once, and held back while a mission waits; crash while recording the payout / after it was written / while paying the bonus each roll everything back, and a retry pays exactly once; a failed call doesn't block the queue; ledger sum = Today's displayed totals; totals never decrease; entries can't be changed or removed |
| M6 tests (`src/db/__tests__/pause-resume.test.ts` + domain) | Passed: pause keeps position and finished missions exactly; harmless twice; no effect on not-started or completed quests; only that quest on that day; opening a paused quest resumes at the same mission; survives a "force-quit" (state reloaded from storage, Today shows paused at the right place); finishing a mission on a paused quest returns it to in progress; five pause/resume cycles change nothing else; completed quest stays completed; pause/resume/stale taps pay each mission exactly once; pausing pays nothing and removes nothing; a pause racing a completion lines up and pays once; pausing a quest that is only waiting on approval keeps the waiting mission and no bonus; paused wording has no shaming words |
| M7 tests (`src/domain/__tests__/caregiver-*.test.ts`, `src/services/__tests__/caregiver-pin.test.ts`, `src/features/caregiver/__tests__/messages.test.ts`) | Passed. Policy: PIN format, lockout schedule (5 free, 30 s doubling to 15 min, about 27 years to try every PIN at the cap), clock-back protection, recovery-code alphabet (no bias, no look-alikes) and tolerant typing, session idle/clock rules. Service against real PBKDF2: only salted hashes stored (no PIN or code anywhere in storage), refuses weak PINs, different salt every time, right/wrong PIN, wrong guesses counted and locked, wait honoured and the right PIN refused during it, survives restart, counted even if the app stops mid-check, 8 simultaneous guesses count one by one, malformed input not counted, damaged / corrupted / stale-install data fails closed, change PIN, recovery code (typed sloppily, rotated, shares the limit, works when the PIN record is damaged), strength upgrade on next entry, the real 10,000-iteration setting works, no secret in any console method or error message. Messages: fixed clock time rounded up, no countdown, no shaming words |
| M8 tests (`approvals.test.ts`, `caregiver-edits.test.ts`, migration v2 tests, domain and message tests) | Passed. Queue: empty until a key mission finishes, details and reward shown, all days oldest first, nothing paid while waiting. Approve: pays the mission and the bonus in one go, never twice (repeat, double tap, retry, two at once), no bonus while another mission waits, survives a restart, shows correctly on Today, pays the amount stored at approval, never un-pauses a quest, works for an earlier day. Not waiting / unknown / already paid: nothing happens. Another try: mission becomes current again, nothing paid or removed, counter and resume position correct, can be tried and approved later and still pays once, no limit, harmless twice, cannot undo an approval, leaves a paused quest paused. Crashes at the bonus, at the quest update and at another-try each roll back and a retry pays once. Totals never decrease through any mix. Edits: switching off hides from Today immediately, keeps progress, creates no new days, waiting missions still approvable; reward edits saved, apply to future pay only, never change the ledger or earned totals, refuse negative / fractional / too large / NaN / other quest's mission / unknown quest with nothing saved, all-or-nothing on failure. Migration v2: a v1 database with data upgrades with every row kept and the counter at 0, rejects negatives, applies once. Wording: no reject/deny/penalty words |
| M9 tests (`celebration.test.ts` ×2, `chime-asset.test.ts`, migration v3) | Passed. Domain: Reduce Motion gives the still mode and only then; fades are 300 ms or longer and the whole thing is under 3 s with no loop setting; wording names the paid bonus, has no reward line when it was zero, one screen-reader announcement, and no childish or exclamatory words. Database: not due until the quest is finished or while a key mission waits; due with the amount actually paid even after rewards are edited; due after approval; still due until marked; shown once, harmless to mark twice (keeps the first time), stays gone after reopen / pause / reload; cannot be marked for an unfinished quest; showing it pays nothing and changes no totals; the bonus is still paid exactly once; haptics setting default / remembered / not duplicated. Chime file: plain mono 16-bit 44.1 kHz PCM with a consistent header, 1 to 2.5 s, peak 0.1 to 0.35 of full scale and never clipping, starts and ends at silence, no abrupt jumps between samples, loudest in the first half second and only fading after, equals exactly what the script synthesizes, under 200 KB. Migration v3: upgrades v2 keeping rows, backfills finished quests, applies from v1 through all steps |
| M10 tests (`progression.test.ts`, `badges.test.ts`, `progress.test.ts`, migration v4) | Passed. Levels: 0 / 1 / 99 / 100 / 101 / 199 / 200 / 999 / 1000 / 10,000 XP, never below the start or down as XP grows, fractions never reach a full bar, wording has no pressure words. Badges: all demo, unique `demo-` ids, no streak or time-limit wording, each condition met exactly at its threshold and not one short, several awarded at once, an earned badge never returned or removed. Database: first mission / quest / block awarded with their payouts; a key mission earns nothing while waiting and its badges arrive on approval with the approval time; Level 2 at exactly 100 XP and not 99; Emerald pocket at 25 not 24; Three days only after three different days and two quests on one day count once; stats count missions paid but not the bonus; never awarded twice or re-dated however often checked, and still once when two checks race each other; cannot be deleted or renamed or re-dated, only marked seen; an unknown badge id is kept but not shown or counted; a crash while awarding rolls back the mission, its payout and the badge, and a retry awards once; Progress catches up pre-badge progress and is safe to repeat; opening it pays nothing; unseen counts, "new" tags, seen clears them, a later badge is new again; a level reached is noted once, a multi-level jump once, and survives a lowered seen mark; Today carries the note. Migration v4: upgrades from v3 keeping rows, one row per badge, no delete or re-date |
| M11 tests (`village.test.ts` domain + database) | Passed. Definitions: four demo structures with unique `demo-` ids, every stage costs 1 or more whole blocks and has a story ending in a full stop, no pressure or shaming words, 21 blocks in total. Building: nothing built at 0 with Foundation next; stages build exactly at their block counts (1, 3, 4 blocks); a part-filled stage is shown honestly (Bloom 1 of 2); complete at exactly 21 and extra blocks saved; bad numbers handled; **only ever grows over 0 to 40 blocks**; exactly one stage current until complete; same blocks give the same village; other definitions work. Stages built between two counts: in order, empty if nothing new or if the seen mark is ahead, a part-fill is not new. Database: starts empty; a finished quest's bonus block builds the first stage; missions alone build nothing; a zero-block bonus adds nothing; same village after a restart; complete at 21; stays built when rewards are later edited to zero; blocks cannot be changed or deleted; loading and marking seen change nothing earned; new-stage counts clear once viewed and then count only later growth; the seen mark only moves forward and a damaged mark is treated as never seen; Today and the pending milestones carry the note |
| M12 tests (`rook.test.ts`) | Passed. Greeting lines: demo content with unique ids, adult and warm with no exclamation marks and none of the failure / shaming / pressure / baby-talk / boasting words, no missed-day, streak or comparison wording. Reaction line: null when nothing is new; level, singular and plural badges and village growth each phrased correctly with the right tab named; everything new combined in one line; always calm and positive. Today's lines: reaction first then general lines; they cycle forever and handle negative or fractional indexes. Quest welcome: name and singular / plural mission count; welcome plus tip at the start, tip only once under way, welcome only when there is no tip, nothing when there is nothing to say; the text shown is the text spoken. Two older helper tests were removed with the functions they covered |
| M13 tests (`reward-store.test.ts` domain + database, migration v5) | Passed. Domain: the policy is off by default; earned and available stay separate, earned never lowered, available never below zero; costs accept 1 to 1000 and nothing else, typed input parsed strictly; affordability, cost and off / on wording (the off state names the reason to both audiences) with no pressure words. Database: demo rewards listed cheapest first and labelled demo; **under the default policy and under an explicit off policy, redeeming writes nothing however often it is tried and even for an unknown id**; with a test-only on policy: redeeming logs the entry with copied title and cost, lowers only available, **leaves the ledger and earned totals untouched**, allows spending exactly everything and refuses the next, refuses too expensive / unknown / switched-off rewards, charges once for a repeated request key and for two identical taps at once, lines up different requests so available never goes below zero, never lets spent exceed earned across 12 attempts, keeps earning after spending, rolls back and then retries exactly once after a crash. Log: newest first, keeps cost and title after the reward is re-priced / hidden / renamed, cannot be edited or deleted, refuses a free or negative cost and a duplicate key in the table itself. Cost edits: new cost saved, smallest and largest accepted, 0 / negative / fractional / too large / NaN refused with nothing changed, unknown reward reported, show / hide keeps the reward, earned untouched. Migration v5: upgrades from v4 keeping rows, enforces reward, cost and key rules. The earlier "no spending tables" test became "the ledger stays earn-only" |
| Test sensitivity (mutation check) | Broke the code seventy-two ways (earlier ones: migration/seed transactions, ledger triggers, schedule and instance rules, mission-order and double-tap guards, key-mission waiting, position saving; M5: plain INSERT for payouts, paying waiting missions, no call serialization, hard-coded rewards, bonus paid while a mission waits, payout key not unique per day; M6: pausing any status, opening not resuming, finishing a mission leaving a paused quest paused, pause resetting the position; M7: counting a guess after checking it, no queueing of overlapping guesses, trusting a clock set back, an unreadable counter resetting to zero, accepting records from another install, storing the PIN in plaintext, not rotating the recovery code, accepting guesses while locked; M8: bonus paid while another mission waits, approving un-pausing a quest, another-try forgetting where to resume, overlapping approvals not queued, approval without a transaction, reward edits not validated, Today still showing a switched-off quest; M9: marking again overwriting the first time, due for an unfinished quest, due again after being shown, showing the stored bonus instead of the paid one, Reduce Motion still animating, no backfill, marking an unfinished quest; M10: level boundary off by one, plain INSERT for badges, badge triggers removed, approving not awarding, bonus counted as a paid mission, a day counted twice, threshold off by one, level reached never noted; M11: a stage built one block early, every unbuilt stage shown as current, a part-filled stage counted as new, the seen mark moving backwards, new stages ignoring what was seen, extra blocks lost; M12: the reaction not saying where to look, "another line" not wrapping, the welcome repeated on every mission, an exclamation mark in a greeting, a greeting that pressures, the reaction hidden behind general lines, village growth forgotten; M13: redeeming while the policy is off, overspending, a repeated request charged again, redeeming never lowering available, overlapping requests not queued, redeeming a hidden reward, redemption log triggers removed, costs not validated, available going below zero); every break was caught. One break (plain INSERT) first survived because the in-code check hid it; I added a test that races two awards and it is now caught; code restored and re-run green |
| `npx expo export` for iOS and Android | Passed, both bundles built |
| Run on iOS simulator (iPhone 16 Plus, iOS 18.6, Expo Go) | Passed: migrations ran, demo data seeded, Today and Caregiver tabs render from SQLite. After M3: Today showed "Tuesday, October 27" with only the daily quest (correct: garden quest not due, trail quest is Fridays), so Hermes handles the `Intl` date calls. At the largest iOS accessibility text size, text wrapped and scrolled with nothing clipped (a smoke check, not a VoiceOver test) |
| M4 on the iOS simulator | Mission screen, "Mission 3 of 3" after a relaunch with progress put in the database by script, the "All missions finished · 1 waiting" screen, and Today's progress bar all rendered correctly. **Not exercised on-device:** tapping Mission complete / I need help / Replay audio, the read-aloud switch, and actual speech (no way to send taps in this environment; macOS blocked scripted clicks). Their logic is unit-tested, not their wiring |
| M5 on the iOS simulator | App boots and Today renders with the new ledger code (totals 0, new demo notice). **Payouts were not exercised on-device**: no way to tap Mission complete here. Payout behavior is covered by the database tests against real SQLite via Node, not by expo-sqlite on a device |
| M6 on the iOS simulator | With the database set to "paused at mission 2" by script, Today showed "Paused · … Paused at mission 2 of 3. Tap to resume." with the bar at one third. Opening the quest (deep link, running the app's real code) changed the stored status `paused` → `inProgress`, position stayed 2, the ledger stayed empty, and the screen showed Mission 2 of 3 with the Pause button. **Not exercised on-device:** tapping Pause itself and the return to Today (no way to send taps here). Its logic and the database write are unit-tested |
| M7 on the iOS simulator (Hermes, real SecureStore, real `expo-crypto`, Expo Go) | A temporary self-test (removed, nothing left in the repo) ran the real service: set PIN, right and wrong PIN, restart, recovery-code reset, new PIN works and old one is refused, a different install id ignores the entry, nothing secret in stored values, cleanup. All passed. **Timing under Hermes: PBKDF2 at 10,000 iterations 0.73 s, 100,000 7.0 s, 300,000 20.9 s, 600,000 42 s**; with the chosen 10,000, verifying took about 0.7 s and setting a PIN 1.4 s. Screens photographed: set-PIN, enter-PIN, and the locked message ("try again at 8:21 PM"). **Not exercised by tap:** typing digits, the Unlock / Set PIN / Forgot buttons, the recovery-code screen, the unlocked screen and relock on tab-leave / background / idle |
| M8 on the iOS simulator | With the unlocked view forced on for screenshots only (a temporary change, removed; I cannot type a PIN here) and the database set by script: the Approvals panel showed the waiting mission with its day, what approving adds, and the Approve / Ask for another try buttons; the Quests panel showed the on/off switch and Edit rewards; the reward editor showed the stored amounts (5 / 2 / 0 per mission, bonus 10 / 4 / 1); Today showed "3 of 3 missions finished · 1 waiting for approval"; Jacob's mission screen showed the calm another-try note. **The existing on-device database was upgraded from v1 to v2 by the real app** and kept working. **Not exercised by tap:** Approve, Ask for another try, the quest switch, typing in the editor and Save, so none of the new buttons' wiring ran on a device, and the PIN gate in front of all of this was bypassed for the screenshots. The database logic behind each button is unit-tested |
| M9 on the iOS simulator | On a fresh database the app created, migrated (v1 to v3) and seeded correctly, and an existing v2 database was upgraded to v3 on launch. With a finished quest and a paid bonus in the database the celebration showed the block, "Quest finished", the quest name, "Bonus: 10 XP · 4 emeralds · 1 block" and "Nice work.", and the real app recorded `celebrated_at` and paid nothing (the ledger kept exactly its rows); reopening showed the plain finished screen, so it is once only. Reduce Motion detection read `false` normally and `true` after turning the simulator's setting on, and the screen drew nothing until the answer arrived. No audio errors in the log. **Not possible here:** hearing the chime, feeling a haptic, watching the animation play (screenshots only), pressing Mission complete to trigger it by tap. |
| M10 on the iOS simulator | The real app upgraded the existing database v3 to v4 on launch. With progress added to the database (135 XP, 30 emeralds, 1 block, a finished quest) Today showed "135 XP · 30 emeralds · 1 block", Level 2, the bar at 35 of 100, and "What's new: You reached Level 2."; opening Progress showed Level 2, "You reached Level 2.", the demo notice, "5 of 6 earned" with each badge's "New" tag, "Earned on Tuesday, October 27" and "Demo badge"; the real app awarded the 5 badges (catch-up), marked them seen, recorded level 2 as seen and changed no ledger rows; Today then showed no "What's new" note. The three-tab bar rendered. **Not exercised by tap:** switching tabs. The Progress-tab icon is an SF Symbol / Material symbol while the other two tabs still use the starter's PNGs |
| M11 on the iOS simulator | On a fresh database (created, migrated to v4 and seeded by the real app) with 6 blocks in the ledger: Today showed "6 blocks" and "What's new: 5 new stages in the village."; Village showed "6 of 21 blocks placed", "Next: Garden · Bloom, 1 more block.", the five stages that grew with their story lines, the demo notice, the Workshop complete with three filled squares and "3 of 3 blocks placed", and the Garden with three filled and one outlined square, "3 of 4 blocks placed" and Built / Next stage labels; the real app recorded the seen mark (6) and changed no ledger rows; the growth card was gone on the second visit. The four-tab bar rendered. **Not exercised by tap:** switching tabs. The Village-tab icon is an SF Symbol / Material symbol while two tabs still use the starter's PNGs |
| M12 on the iOS simulator | On a fresh database (130 XP and 2 blocks in the ledger) Today showed Rook with a bird avatar, "Demo lines", "You reached Level 2 and the village grew. You can see what changed on the Progress and Village tabs.", and "Hear Rook" and "Another line" buttons. On a quest's first mission Rook showed the welcome and the tip ("Today's quest is Demo: Tidy the Workshop. It has 3 missions. Take them one at a time. A tip: Start with the big ones."). **That first layout put Rook above the controls and pushed "Mission complete" below the fold; I moved him below them and re-checked that every control is back in its original position.** No errors in the log. **Not possible here:** tapping Hear Rook or Another line and hearing the speech (no way to send taps or hear audio). The speech path is the same `expo-speech` call the mission instruction already uses |
| M13 on the iOS simulator | A fresh database (created, migrated to v5 and seeded by the real app) with 14 emeralds earned and one synthetic log entry (a 10-emerald snack, added by script because the app cannot create one while redeeming is off). Progress showed "Emeralds available: 4", "Earned in total: 14. This number never goes down.", the two demo rewards with "6 more emeralds to go." and "16 more emeralds to go.", the demo notice, and dimmed "Redeeming is turned off" buttons. The caregiver panel (forced into view for the screenshot with a temporary change that was removed, since I cannot type a PIN here) showed "Redeeming: Off" and its reason, "Emeralds earned in total: 14 (never goes down) · Available: 4", each reward's show / hide switch and cost field with Save cost, and the redemption log entry. The text size was shrunk to fit the screens and restored. **Not exercised by tap:** Save cost, the switches, and everything behind the PIN. The simulator database was deleted afterwards because of the synthetic rows |
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
- Existing progress from before badges existed is only turned into badges when Progress is first opened, so Today's "new badges" note does not appear for it until then (only matters for old development data). The level note works at once.
- **Sound and haptics are unverified on any device**: the chime was never heard, the silent-switch behavior is untested on a real iPhone (Android has no silent switch; its volume control applies), and haptics do not run on the simulator. The block is a system symbol and the chime is synthesized; both are placeholders for original art and sound.
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

**M14: local reminders.** Scheduled local notifications per quest at caregiver-set times, gentle tone, permission-aware, timezone-aware, quiet-hours-aware and
duplicate-safe, with text that is safe on a locked screen (no care details, no PIN). This needs unresolved schedule decisions (quiet-hours deferral, travel days) and **a
development build on real iPhone and Android hardware to test honestly**: Expo Go cannot prove that a reminder fires with the app closed or after a restart, and CLAUDE.md
says never to promise unconditional delivery. I will build the scheduling logic and its tests, and say plainly what is untested. Adding `expo-dev-client` for that is a new
dependency, so I will ask first.
Then M15 (accessibility, privacy review and P0 acceptance on real hardware).
**Please review the proposed rules in `docs/DECISIONS.md`: schedule, audio/help, payouts, pause, PIN, approvals, celebration, levels and badges, village, Rook and now the reward store.** The PIN evaluation
should be confirmed before the caregiver tools are used for real, and the "Emerald purchases" decision now blocks turning redeeming on.
