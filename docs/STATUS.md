# Quest Blocks status

Last updated: 2026-10-24 — foundation committed (`a36c01d`, `0c45db0`); ESLint and database tests added, uncommitted.

## Current setup

- Expo SDK 58 (`expo ~58.0.19`), React Native 0.88.0, React 19.3.0, TypeScript ~6.0.3
  (`strict: true`), Expo Router (`src/app/`), npm.
- Tooling: `jest-expo` (Jest 30), ESLint 9 with `eslint-config-expo` (flat config in
  `eslint.config.js`), `@types/node` ^24 (matches Node 24; used only by the SQLite test helper).
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
| `npm run lint` | Passed, exit 0, no warnings. Confirmed it flags bad code (a deliberate probe file was caught, then removed). It found one real error in the starter's `use-color-scheme.web.ts` (setState in an effect); fixed with `useSyncExternalStore`, web file only |
| `npm test -- --runInBand` | Passed: 4 suites, 31 tests. Domain tests (schedules, rewards, demo content) plus database tests (below) |
| Database tests (`src/db/__tests__/`) | Passed. Run our real migration and query code against real SQLite via Node's `node:sqlite`: fresh install, safe re-run, upgrade with data kept, failed migration rolls back and retries, newer database refused, no spend tables, double-pay rejected, no negative amounts, append-only ledger, one instance per quest per date, bad status and orphan rows rejected, seed is idempotent / all-or-nothing / does not restore removed demo rows, corrupt schedule fails loudly, earned totals sum |
| Test sensitivity (mutation check) | Broke the code three ways (no migration transaction, no ledger triggers, no seed transaction); each was caught by exactly one test; code restored and re-run green |
| `npx expo export` for iOS and Android | Passed, both bundles built |
| Run on iOS simulator (iPhone 16 Plus, iOS 18.6, Expo Go) | Passed: migrations ran, demo data seeded, Today and Caregiver tabs render from SQLite |
| Android (emulator or device) | **Untested.** Bundle builds, but no Android runtime was available |
| Real iPhone / Android hardware | **Untested** |
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

**M2: schedule engine** (pure domain, no decisions needed to start).

- Recurrence for daily, every-N-days and weekly rules, idempotent instance generation, and
  table-driven tests including DST, timezone change and midnight rollover.
- It uses the proposed defaults for the unresolved schedule edge cases and names them in the tests.
  Write concrete worked examples into `DECISIONS.md` for your approval before merging.
- Then M3 (Today shows only what is scheduled for the date, with progress) and M4 (mission flow).
