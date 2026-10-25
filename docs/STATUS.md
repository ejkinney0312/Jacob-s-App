# Quest Blocks status

Last updated: 2026-10-24 (planning only; no features built yet)

## Current setup

- Expo SDK 58 (`expo ~58.0.19`), React Native 0.88.0, React 19.3.0, TypeScript ~6.0.3
  with `strict: true`, Expo Router (routes in `src/app/`), npm (`package-lock.json`).
- Project is still the **unmodified Expo starter template**: tabs titled "Expo Starter",
  an explore screen and demo components. No Quest Blocks features exist.
- Not installed yet: `expo-sqlite`, `expo-notifications`, `expo-speech`,
  `expo-secure-store`, `expo-haptics`, a test runner, ESLint as a project dependency.
- Git: `main`, two commits. `9b18ef4` fixes the `TabButton` ref type.
  `CLAUDE.md`, `docs/PRODUCT_REQUIREMENTS.md`, `docs/DECISIONS.md`,
  `docs/IMPLEMENTATION_PLAN.md` and this file are **uncommitted**.
- `expo-env.d.ts` exists locally but is gitignored. Expo regenerates it on
  `npx expo start`; a fresh clone needs that run before `tsc` passes.
- A stray `eslint` binary is in `node_modules` from an earlier `expo lint` attempt that
  was reverted in `package.json`. Treat it as untracked; M0 will install it properly.

## Checks (run 2026-10-24)

| Command | Result |
| --- | --- |
| `npx tsc --noEmit` | Passed, exit 0 |
| `npx expo-doctor` | Passed, 20/20 checks |
| `npx expo lint` | **Not passing.** No ESLint config or project dependency; the command tried to auto-install and was reverted. Not a code failure. |
| `npm test` | Not run; no test runner configured |
| Real iPhone / Android hardware | Untested (nothing to test yet) |
| `npm audit` | Reported 5 high-severity vulnerabilities during an earlier install; not investigated |

## Unresolved decisions (from `docs/DECISIONS.md`)

None have been answered. Blocks listed are the earliest milestone affected.

| Decision | Blocks |
| --- | --- |
| Emerald purchases: do they debit spendable balance? | M13 real redemption (kept disabled) |
| Prototype/content export (quests, Rook dialogue, rewards) | Real content; M3 uses labeled demo data |
| Bathroom fixture totaling 95 XP / 38 emeralds / 1 block | "Verified" claim in M15 |
| Schedule edge cases (anchor, DST, travel, missed quests, quiet-hours deferral) | M2 merge, M14 |
| Approval transitions (reject, redo, quest-bonus timing) | M8 |
| Rook tap-to-talk meaning | M12 (default: preset dialogue via TTS) |
| Four village structures, story stages, badge thresholds, starting level | M10, M11 |
| Can P0 add chores, or only enable/disable supplied quests? | Scope of M8; F12 stays P1 unless moved |
| Target phones and minimum OS | M15 device testing |
| Distribution, account holder, final app-name availability | Real bundle IDs; store config |
| PIN derivation method, retry limits, relock and recovery | M7 real caregiver access (demo PIN only until then) |

Also noted: `CLAUDE.md` asks the plan to map F1–F18. The plan covers P0 (F1–F11) in
milestones and lists F12–F18 as backlog rows; it does not schedule them.

## Next implementation task

**M0 — Foundation and tooling**, none of which needs a decision:
1. Make `npm run lint` work (install ESLint via the Expo-supported route and commit the
   config). This adds dependencies, so confirm with Erin first.
2. Add `jest-expo` so `npm test -- --runInBand` runs one trivial passing test.
3. Create `src/domain`, `src/db`, `src/services`, `src/features`.
4. Replace the starter shell with an empty Today screen, keeping the TypeScript fixes.

M1 (SQLite + migrations) follows and is also unblocked.
