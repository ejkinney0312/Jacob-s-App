# Quest Blocks status

Last updated: 2026-10-24 — foundation committed (`a36c01d`); jest-expo installed.

## Current setup

- Expo SDK 58 (`expo ~58.0.19`), React Native 0.88.0, React 19.3.0, TypeScript ~6.0.3
  (`strict: true`), Expo Router (`src/app/`), npm.
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
| `npx expo-doctor` | Passed, 20/20 |
| Lint | **Not run: lint is not configured.** No ESLint config or dependency; `expo lint` would install packages. Needs your OK (see next task). |
| `npm test -- --runInBand` | Passed: 2 suites, 13 tests (schedule parsing/description, reward helpers, demo content sanity). Runner: `jest-expo` preset, Jest 30. **No database or migration tests yet** |
| Migration SQL in real SQLite (Node 24 `node:sqlite`, throwaway script outside the repo) | Passed: v1 applies; rejects negative amounts, duplicate mission position, duplicate quest instance per date, duplicate idempotency key, bad status; ledger update and delete are blocked |
| Schedule parsing (same throwaway script) | Passed: 3 demo schedules parse and describe correctly; 4 malformed inputs rejected |
| `npx expo export` for iOS and Android | Passed, both bundles built |
| Run on iOS simulator (iPhone 16 Plus, iOS 18.6, Expo Go) | Passed: migrations ran, demo data seeded, Today and Caregiver tabs render from SQLite |
| Android (emulator or device) | **Untested.** Bundle builds, but no Android runtime was available |
| Real iPhone / Android hardware | **Untested** |
| Accessibility (VoiceOver, TalkBack, 200% text, Reduce Motion) | **Untested.** Labels and header roles are set; no assistive-tech check has been done |
| Migration upgrade path (v1 → v2) | Untested; only v1 exists |
| `npm audit` | Reports 5 high-severity vulnerabilities; not investigated |

The Node migration check was a one-off. It is not a repeatable test and is not in the repo; migrations still need permanent tests.

## Known gaps and notes

- Selected-tab color on iOS is the system blue, not the theme's `primary`; set it when icons are redone.
- Caregiver tab uses the starter's "explore" icon as a placeholder; original icons are needed.
- `expo-dev-client` was added automatically by `expo install` and then removed on purpose; add it
  when a development build is needed (required for notification and secure-store testing on devices).
- Migration SQL v1 has no automated test and has not been tested through an upgrade.
- The app has no player-facing flow yet: no mission play, no payouts, no schedule evaluation.
  Today lists every active quest, not only those scheduled for the day, and says so on screen.

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

**Finish M0 tooling, then M2 (schedule engine).**

1. **Needs your OK:** make `npm run lint` real (install ESLint and `eslint-config-expo` via the
   Expo route, commit the config).
2. Turn the one-off Node migration check into permanent tests (needs a small adapter over
   `node:sqlite`, since `expo-sqlite` is native).
3. M2: pure-domain recurrence engine for daily, every-N-days and weekly rules, idempotent instance
   generation, table-driven tests including DST, timezone change and midnight rollover.
   It will use the proposed defaults for the unresolved schedule edge cases and name them in
   the tests; write concrete worked examples into `DECISIONS.md` for your approval before merge.
