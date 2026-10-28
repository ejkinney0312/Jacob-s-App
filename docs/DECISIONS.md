# Decisions to confirm

These questions come from the PRD or are implementation choices needed to make it executable. Proposed defaults are recommendations, not approved product changes.

| Topic | Issue | Proposed handling until confirmed |
| --- | --- | --- |
| Emerald purchases | F7 says emeralds buy rewards, but acceptance says emeralds never decrease. | Track lifetime earned separately from spendable balance. Keep real redemption disabled until Erin confirms whether purchases debit spendable balance. Never deduct as punishment. |
| Missing prototype | PRD references existing entities, Rook dialogue and chores, but contains no prototype files or full content export. | Build architecture and clearly marked demo content. Request the actual prototype/export before claiming migration is complete. |
| Bathroom math | Total of 95 XP, 38 emeralds and 1 block is specified without mission allocations. | Obtain or approve an explicit fixture. Do not invent allocations and call them migrated requirements. |
| Cloud scope | Overview mentions backup and sync; F13 and technical plan place backend/sync in P1. | P0 is local on one device. Reinstall recovery is unavailable without a separate backup/restore feature. Never imply SQLite survives uninstall. |
| Quest creation | Goals say caregivers add chores, but full builder F12 is P1. | P0 enables/disables supplied quests and edits rewards/values. Confirm whether adding chores must move into P0. |
| Approval flow | Waiting payout is defined; rejection, redo and quest-bonus timing are unspecified. | Propose pending missions block final quest payout; caregiver can request another try without penalty. Confirm before implementing those transitions. |
| Rook tap to talk | PRD does not clarify whether this means replaying Rook speech or microphone conversation. | Recommend tap-to-hear preset dialogue with device TTS, no microphone or cloud AI in P0. Confirm before adding conversational AI. |
| Schedule rules | Daily, every N days and weekday schedules are specified; anchor dates, timezone travel, DST, quiet-hours deferral and missed quest handling are not. | Write concrete examples before recurrence implementation; persist local date, timezone policy and interval anchor. |
| Progress content | Four village structures, story stages, badges and starting level lack complete definitions. | Label placeholders/demo; get approved content and thresholds before release acceptance. |
| Target phones | PRD asks which phones Jacob uses. | Support both platforms in architecture; validate minimum OS versions against selected Expo SDK and actual family devices. |
| Distribution | Public vs family-only, account holder and final app-name availability are open. | Use development builds first. Confirm identifiers and account ownership before store configuration. Test tracks and unlisted distribution are not interchangeable. |

Record answers below with date and confirmed behavior. Update CLAUDE.md and the implementation plan when decisions change. Do not edit the source snapshot to hide conflicts.

## Proposed schedule rules (M2): awaiting Erin's confirmation

Status: **proposed, not approved.** The schedule engine (`src/domain/schedule.ts`,
`src/domain/local-date.ts`, `src/db/instances.ts`) implements these defaults and the tests
name them. Each example below is checked by a test (`src/domain/__tests__/` and `src/db/__tests__/instances.test.ts`), except rule 10, which is deferred. Say "confirmed" or give a change for each
rule; if a rule changes, the engine and its tests change with it.

Examples use Erin's calendar: Friday 2026-10-23, Saturday 2026-10-24, Sunday 2026-11-01.

| # | Rule (proposed default) | Worked example |
| --- | --- | --- |
| 1 | **Dates are calendar days, not clock times.** A quest is due on a date such as `2026-10-24`. Counting days never involves hours, so daylight saving cannot shift a quest. | Clocks fall back on Sun 2026-11-01 (a 25-hour day). An every-3-days quest anchored 2026-10-29 is due 10-29, **11-01**, 11-04, 11-07. Nothing moves. |
| 2 | **Every N days counts from an anchor date.** The anchor day itself is due, then every N days after. | Every 3 days, anchor 2026-10-01: due 10-01, 10-04, 10-07 … 10-22, **10-25**. It is *not* due on 10-24 (23 days after the anchor). |
| 3 | **Nothing is due before the anchor date.** | Same quest on 2026-09-28: not due. |
| 4 | **Weekly quests use the weekday of the local date.** | "Fridays": due Fri 2026-10-23, not due Sat 2026-10-24, due Fri 2026-10-30. |
| 5 | **"Today" follows the phone's current time zone.** There is no fixed home zone. The date changes at local midnight. | 11:30 pm Sat 10-24 in Chicago is 12:30 am Sun 10-25 in New York. A phone flown from one to the other shows Today = 10-25 after landing. |
| 6 | **Each date keeps its own instance forever.** A quest on a date has one stable ID (`quest:date`). Changing time zone, reopening Today or restarting the app never creates a duplicate or resets progress. | After the flight above, Sat 10-24's half-finished quest is untouched; Sun 10-25 starts fresh. |
| 7 | **No catch-up for missed days.** If a day passes with the quest not done, nothing is created for it later, nothing is penalized, and Today shows only today's quests. (Reports on skipped quests are P1 / F15.) | Quest due 10-24 was never opened. On 10-25 Today shows 10-25's quests only. No points are removed. |
| 8 | **Missions added to a quest later appear from the next day.** An instance that already exists keeps the missions it started with, so a quest never changes under the player mid-day. | Caregiver adds a 4th mission on 10-24 after the quest has started: 10-24 stays at 3 missions, 10-25 has 4. |
| 9 | **Turning a quest off hides it from new days but keeps history.** Instances already created stay. | Quest switched off on 10-24: no new instances from then on; existing 10-23 and 10-24 instances remain. |
| 10 | **Reminders and quiet hours are not decided here.** Deferral when a reminder falls in quiet hours, and what a reminder says on a travel day, are decided when reminders are built (M14). | Not applicable yet. |

Open choices inside these rules, if you would rather decide them differently:

- **Rule 5:** a fixed household time zone (for example, always Central) instead of following the phone.
  Better if the phone is often set to a different zone; worse if the family travels.
- **Rule 7:** keep missed quests visible for a day ("catch up") instead of dropping them.
- **Rule 8:** add new missions to quests already started today.

Answer (date and confirmed behavior): _not yet answered_

## Proposed audio and help behavior (M4): awaiting Erin's confirmation

Status: **proposed, not approved.** Implemented as described; each point is easy to change.

| # | Rule (proposed default) | Why / alternative |
| --- | --- | --- |
| 1 | **Read aloud on arrival.** When a mission appears and audio is on, its instruction is spoken once. "Replay audio" speaks it again. | The PRD calls the button "replay", which implies it plays first. Alternative: speak only when tapped. |
| 2 | **One audio switch, on Today** ("Read missions aloud", default on), stored on the device. When off, nothing is spoken and "Replay audio" shows as disabled and reads "Audio is off". | PRD: "setting to turn all audio off". Alternative: put it behind the caregiver PIN. |
| 3 | **Never auto-speak over a screen reader.** If VoiceOver or TalkBack is on, the step is not spoken automatically; "Replay audio" still works. | Avoids two voices talking at once. |
| 4 | **Silent mode and volume follow the phone.** On iPhone, silent mode mutes speech (documented `expo-speech` behavior). Speech stops when Jacob leaves the screen or moves to the next step. | Matches "respect audio-off, volume and silent behavior". Needs checking on a real iPhone and Android phone. |
| 5 | **"I need help" shows preset help only.** The step again, the mission's tip, and "it is fine to ask someone nearby for a hand". It contacts no one and records nothing. | CLAUDE.md: no caregiver messaging in P0. |
| 6 | **Opening a quest marks it started.** A quest that was opened but not progressed shows "In progress". | Alternative: only mark it started after the first mission is finished. |
| 7 | **Missions must be done in order.** A stale or duplicate tap cannot skip ahead; a repeated tap on a finished mission does nothing. | Prevents double payouts later. |
| 8 | **A key mission waits and pays nothing.** When Jacob finishes it, he sees "waiting for a caregiver to check". The quest only counts as done once every mission is finished and none is waiting. | Same as the proposed approval default (table above, "Approval flow"). |

Not decided here, and worth deciding before the metrics exist: the PRD's success metric "missions completed without tapping *I need help*" needs help taps to be recorded. M4 records nothing, to keep data minimal. Say if you want a count stored on the device (no names, no content).

Answer (date and confirmed behavior): _not yet answered_

## Proposed reward payout rules (M5): awaiting Erin's confirmation

Status: **proposed, not approved.** Implemented as described (`src/db/ledger.ts`, `src/db/quest-flow.ts`).
Real spending is **not** part of this and stays disabled; see "Emerald purchases" in the table above.

| # | Rule (proposed default) | Why / alternative |
| --- | --- | --- |
| 1 | **A self-verify mission pays the moment it is finished**, with the XP, emeralds and blocks stored for that mission. | PRD F3. |
| 2 | **A key mission pays nothing while it waits**, and pays when a caregiver approves it (built in M8), under the same payout key, so approval can never double-pay. | PRD F3 and acceptance criteria. |
| 3 | **The quest bonus is paid once, when the quest becomes complete.** If a key mission is waiting, the bonus waits too. | Follows the proposed approval default. Alternative: pay the bonus as soon as Jacob finishes his part. |
| 4 | **Amounts are copied into the ledger when paid.** Editing a mission's reward later never changes what was already earned. | Earned totals must never change after the fact. |
| 5 | **Nothing is paid retroactively.** Missions finished before the ledger existed (development testing only) earn nothing. | They were demo data. |
| 6 | **Earned totals only grow.** The ledger is append-only: no edits, no deletions, no negative amounts, and a reward of zero writes no row. | PRD: "points never removed". |
| 7 | **The same recurring mission pays again on each new day**, once per day. | Each day is a separate instance. |

Answer (date and confirmed behavior): _not yet answered_

## Proposed pause and resume behavior (M6): awaiting Erin's confirmation

Status: **proposed, not approved.** Implemented as described.

| # | Rule (proposed default) | Why / alternative |
| --- | --- | --- |
| 1 | **A Pause button on every mission screen**, between "I need help" and "Mission complete". Pausing returns to Today. It is not on the help screen or the finished screen. | CLAUDE.md: provide Pause and lossless Resume. Alternative: a smaller control in the header. |
| 2 | **Today shows a paused quest in words:** "Paused at mission 2 of 3. Tap to resume." | A clear Resume on Today (plan M6). |
| 3 | **Tapping a paused quest resumes it straight away** at the saved mission, with no extra confirmation screen. | Fewer steps for Jacob. Alternative: a "Welcome back, resume?" screen. |
| 4 | **Leaving with the back button does the same job.** The place is saved either way; the card just says "In progress" instead of "Paused". | Nothing is ever lost. |
| 5 | **Pausing pays nothing and takes nothing back.** Finished missions, earned totals and waiting-for-approval missions stay exactly as they were. | Rewards never decrease. |
| 6 | **A paused quest stays on its own date.** At local midnight it is no longer on Today; there is no catch-up and no penalty (schedule rule 7). | Alternative: carry unfinished or paused quests over until done. This is the one most worth deciding. |
| 7 | **Nothing times out.** A quest can stay paused all day; there are no timers or countdowns on screen. (The app quietly checks once a minute whether the date changed; that is never shown.) | PRD: no timeouts or countdowns that can be lost. |

Answer (date and confirmed behavior): _not yet answered_

## PIN protection evaluation (M7): awaiting Erin's confirmation

Status: **evaluated and implemented as a proposal; not approved.** CLAUDE.md asks for this evaluation
before real caregiver access is enabled. Nothing sensitive sits behind the PIN yet (approvals and
editing arrive in M8), and **M8 should not ship until you confirm or change the points below.**
Code: `src/domain/caregiver-pin.ts`, `src/domain/caregiver-session.ts`, `src/services/caregiver-pin.ts`.

**What the PIN is for.** Keeping Jacob, a visitor, or someone who picks up the phone from approving
key missions and editing rewards. It is not meant to stop a determined attacker who has copied the
phone's storage. That assumption drives most of the choices below.

| Topic | Proposed default | Why, and what I measured |
| --- | --- | --- |
| **Format** | Exactly 6 digits. Repeats (111111) and straight runs (123456, 654321, 789012) are refused. | 4 digits is only 10,000 possibilities. Alternatives: 8 digits, or a passphrase (harder to type daily). |
| **Where it lives** | Only a salted verifier, in `expo-secure-store` (iOS Keychain / Android Keystore), set to `WHEN_UNLOCKED_THIS_DEVICE_ONLY`. The PIN itself is never saved. | Documented: Android SecureStore is excluded from backups; `THIS_DEVICE_ONLY` entries do not move to a new iPhone. |
| **Reinstalls** | Each record carries a random per-install id kept in the app database. A PIN left in the iOS Keychain by an earlier install is ignored after a reinstall. | Expo's docs say iOS entries *can* survive an uninstall. Without this, a fresh install could demand a PIN nobody remembers. |
| **Key derivation** | **PBKDF2-HMAC-SHA256 from `@noble/hashes`, 10,000 iterations, 16-byte random salt.** The iteration count is stored with each record, and a PIN is re-stored at the current strength the next time it is entered, so it can be raised later. | `expo-crypto` has **no** key-derivation function (it only has hashes and random numbers), so a library is needed. Measured on the iOS simulator under Hermes (a fast Mac CPU): **10,000 iterations = 0.73 s, 100,000 = 7.0 s, 300,000 = 20.9 s, 600,000 = 42 s.** The same work takes 14 ms to 0.55 s in Node, which is misleading: the usual server-side advice (600,000) is unusable in JavaScript on a phone. At 10,000, checking a PIN took about 0.7 s and setting one about 1.4 s (two derivations). **Real phones are slower, so this must be re-measured on yours.** |
| **Honest limit of the above** | The slow hash is a modest extra layer, not the main protection. | A 6-digit PIN has only a million possibilities; even a very high iteration count would not stop someone who could copy the stored data and try every PIN on fast hardware. The real protection is secure storage plus the retry limit. |
| **Other options considered** | (1) A single SHA-256: rejected, far too fast. (2) scrypt in JavaScript: memory-heavy and slower in Hermes; **not measured**, so not chosen. (3) Native PBKDF2/Argon2 (for example `react-native-quick-crypto`): fast and would allow far higher counts, but it is a third-party native module that needs a development build. Worth doing only if you want protection against someone who copies the phone's storage; deferred. | |
| **Randomness** | Salts and the recovery code use `getRandomValues` from `expo-crypto`. | The docs call that one cryptographically secure; they say `getRandomBytes` can fall back to `Math.random` in development, so it is not used. |
| **Retry limiting** | 5 wrong tries, then a wait of 30 s that doubles each time up to 15 minutes. Wrong PINs and wrong recovery codes share one counter. A correct entry resets it. The wait is shown as a fixed clock time ("try again at 7:43 PM"), never a ticking countdown. | At the 15-minute cap that is about 100 guesses a day, so trying every 6-digit PIN would take about 27 years. Trade-off: someone mashing the screen can lock the caregiver out for up to 15 minutes. |
| **How guesses are counted** | The guess is counted **before** it is checked, so stopping the app mid-check gains nothing. Many guesses at once are lined up and counted one by one. Moving the phone's clock back cannot shorten a wait. A retry counter that cannot be read is treated as "locked", never as "reset". | Each of these is covered by a test, and I confirmed the tests fail when the protection is removed. |
| **Relocking** | Caregiver mode is held in memory only. It locks when you leave the Caregiver tab, when the app leaves the foreground, after 5 minutes without a touch, if the clock goes backwards, and always when the app closes. | Alternative: a longer idle time, or staying open until you tap Lock. |
| **Forgotten PIN: recovery** | A 10-character recovery code (50 bits, letters and numbers with no look-alikes) is shown **once** when the PIN is set. Only its hash is kept. Entering it lets you choose a new PIN, and it is replaced by a new code each time it is used. A new code can be made from the unlocked screen (needs the PIN). | Without recovery, a forgotten PIN means reinstalling the app, which also erases the quests and progress on the phone. The code should be written on paper and kept somewhere safe, not on this phone. Alternatives: no recovery; or a cloud account (not in the first release). |
| **If the saved PIN is damaged** | The app never treats a damaged PIN as "no PIN set". It offers the recovery code. If there is no recovery code either, it says so and the only way out is reinstalling. | Failing open would let anyone set a new PIN by corrupting the data. |
| **Logging** | The PIN and recovery code are never logged or put in an error message. A test watches every `console` method through all PIN flows; I also reviewed every `console` call in the app (4 dev-only warnings of error messages, none in PIN code). | CLAUDE.md privacy rule. |
| **Face ID / fingerprint** | Not built. | Optional in the PRD. Needs a development build (SecureStore's `requireAuthentication` is not supported in Expo Go) and a Face ID permission message. |
| **Not built yet** | A "change PIN" screen (the code and tests exist; no screen yet). | Planned with the caregiver tools in M8. |

**Questions for you:** Is a 6-digit PIN right (or 4 or 8)? Are the wait times acceptable? Is 5 minutes idle
the right relock time? Do you want a recovery code, and who will keep it? Is a wait of roughly a second
when entering the PIN acceptable, or should I look at a native key-derivation module? Which phones will
use it, so I can measure there?

**Not verified:** timing and storage on real iPhone and Android hardware (only the iOS simulator in Expo
Go), Android Keystore behavior, whether the iOS Keychain really survives a reinstall on a device, screen
reader behavior on the PIN forms, and typing a PIN on a real keyboard (no way to tap in this environment).

Answer (date and confirmed behavior): _not yet answered_
