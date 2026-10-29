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

## Proposed schedule rules (M2): confirmed by Erin 2026-10-28 (proposal accepted as written)

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

Answer (date and confirmed behavior): **Confirmed by Erin, 2026-10-28: the proposal above is accepted as written.** See "Answers recorded".

## Proposed audio and help behavior (M4): confirmed by Erin 2026-10-28 (proposal accepted as written)

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

Answer (date and confirmed behavior): **Confirmed by Erin, 2026-10-28: the proposal above is accepted as written.** See "Answers recorded".

## Proposed reward payout rules (M5): confirmed by Erin 2026-10-28 (proposal accepted as written)

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

Answer (date and confirmed behavior): **Confirmed by Erin, 2026-10-28: the proposal above is accepted as written.** See "Answers recorded".

## Proposed pause and resume behavior (M6): confirmed by Erin 2026-10-28 (proposal accepted as written)

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

Answer (date and confirmed behavior): **Confirmed by Erin, 2026-10-28: the proposal above is accepted as written.** See "Answers recorded".

## PIN protection evaluation (M7): confirmed by Erin 2026-10-28 (proposal accepted as written)

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

Answer (date and confirmed behavior): **Confirmed by Erin, 2026-10-28: the proposal above is accepted as written.** See "Answers recorded".

## Proposed approval and caregiver editing rules (M8): confirmed by Erin 2026-10-28 (proposal accepted as written)

Status: **proposed, not approved.** This is built on the defaults suggested in the "Approval flow" row of the
table above. That row is still open; the original text is unchanged. Everything here sits behind the caregiver PIN.

| # | Rule (proposed default) | Why / alternative |
| --- | --- | --- |
| 1 | **A finished key mission appears in the caregiver's Approvals list**, from any day, oldest first, with the quest, the mission, the day, and what approving adds. The caregiver has to open the Caregiver tab to see it: there are no notifications in the first release. | Push alerts to a second phone are P1 (F13). |
| 2 | **Approve** pays the mission once, using the same payout key a self-verify mission uses, so approving can never double-pay, however many times it is tapped. | PRD acceptance criteria. |
| 3 | **The quest bonus is paid when the last waiting mission is approved**, and only then, if nothing else is still waiting. | Same as the proposed payout rule 3. Alternative: pay the bonus as soon as Jacob finishes his part. |
| 4 | **The amount paid is the amount stored at the moment of approval**, not at the moment Jacob finished. If a caregiver lowers a reward while a mission waits, the lower amount is paid. | Simple, and earned totals are never reduced. Alternative: lock in the amount when Jacob finishes the mission; that needs a small extra column. |
| 5 | **"Ask for another try"** sends a waiting mission back to being the current one. It pays nothing and takes nothing away, has no limit on tries, and counts the tries. Jacob sees: "Your caregiver asked for another try on this step. That's okay." | No rejection with a reason and no negative wording. Alternative: let the caregiver type a short message for Jacob (not built). |
| 6 | **A mission already approved cannot be sent back.** | Nothing earned is ever undone. |
| 7 | **Approving or asking for another try never changes a paused quest to in progress.** Approving the last waiting mission still completes it. | A caregiver action should not restart something Jacob paused. |
| 8 | **Turning a quest off hides it from Today straight away** (even if today's day was already created), creates no new days, and keeps all progress. Turning it back on shows it exactly as it was. A waiting mission from a quest that is off can still be approved. *(This sharpens schedule rule 9 above, which only said existing days "stay".)* | Alternative: let today's already-started instance stay on Today until midnight. |
| 9 | **Reward amounts can be edited per mission and for the quest bonus**, whole numbers from 0 to 1000 in each box. Edits apply to what is earned from now on; **earned totals and the ledger never change.** | 1000 is a typo guard, not a game rule. Setting an amount to 0 is allowed. |
| 10 | **Not in this release:** adding quests, renaming or reordering missions, editing the words and tips (the P1 quest builder, F12). Whether adding chores must move into the first release is still an open decision in the table above. | |
| 11 | **Editing and approving run behind the PIN session only.** The session locks when the tab is left, so editing happens inside the Caregiver tab, not on a separate screen. | A separate screen would count as leaving the tab and relock. |

Answer (date and confirmed behavior): **Confirmed by Erin, 2026-10-28: the proposal above is accepted as written.** See "Answers recorded".

## Proposed celebration behavior (M9): confirmed by Erin 2026-10-28 (proposal accepted as written)

Status: **proposed, not approved.** Implemented as described. The celebration pays nothing; the quest bonus is
paid by the ledger when the quest completes, and the celebration only shows what was paid.

| # | Rule (proposed default) | Why / alternative |
| --- | --- | --- |
| 1 | **When.** The celebration appears once per finished quest: right after Jacob finishes the last mission of a quest with no key missions, or the next time he opens the quest after a caregiver approves the last waiting mission. It is recorded as shown the moment it appears, so it never repeats. Quests finished before this existed are not celebrated retroactively. | Alternative: also celebrate on Today when a quest is approved while the app is open (not built). |
| 2 | **What.** One block settles into place over 0.7 s, the words fade in over 0.45 s, and one soft chime plays. It shows the quest name, the bonus that was actually paid ("Bonus: 10 XP · 4 emeralds · 1 block", left out if the bonus was zero), and "Nice work." Nothing loops, flashes, bounces, counts down or compares scores. | PRD: calm animation, one soft chime. No confetti or streaks on purpose. |
| 3 | **Reduce Motion.** With the system's Reduce Motion on, nothing moves: the finished picture is shown at once. It is not a shorter animation. | CLAUDE.md. |
| 4 | **Sound.** The chime plays only if the one audio switch on Today is on. That switch is now labelled **"Read aloud and sounds"** and turns off both. It respects the phone's silent switch (the audio library plays through silent mode by default; the app turns that off) and the volume buttons, and mixes with other audio instead of stopping it. | PRD: a setting to turn all audio off. Alternative: separate switches for reading aloud and for the chime. |
| 5 | **Vibration.** One light tap each time **Mission complete** is pressed, controlled by a new **"Gentle vibration"** switch on Today (default on). No extra tap at the celebration, to avoid doubling. | PRD: one gentle tap on mission complete, user-toggleable. iPhones skip it in Low Power Mode or when the Taptic Engine is off. |
| 6 | **Screen readers.** The message is announced once ("Quest finished. Bonus: ... Nice work."). The chime still plays. | |
| 7 | **Wording.** Adult and warm: no exclamation marks, no childish praise, no pressure to do more. | CLAUDE.md. |
| 8 | **The chime and the block are placeholders for original art and sound.** The chime is synthesized by `scripts/chime-synth.js` (two soft notes, about 1.6 s, quiet) so it is original; the block is a system symbol. | Original art and sound only. |

Answer (date and confirmed behavior): **Confirmed by Erin, 2026-10-28: the proposal above is accepted as written.** See "Answers recorded".

## Proposed levels and badges (M10): confirmed by Erin 2026-10-28 (proposal accepted as written)

Status: **proposed, not approved.** CLAUDE.md says the starting level and badge thresholds must be confirmed, and
no real badge content has been supplied, so **every badge below is a clearly labelled demo placeholder.** The
level formula follows the PRD ("flat 100 XP per level"). Nothing here pays or removes anything.

| # | Rule (proposed default) | Why / alternative |
| --- | --- | --- |
| 1 | **Level = floor(XP ÷ 100) + 1.** 0 to 99 XP is Level 1, 100 to 199 is Level 2, and so on. XP only grows, so a level never goes down. | PRD F10. **The starting level is the open question:** Level 1 at zero (proposed) or Level 0. |
| 2 | **The six placeholder badges** (ids start with `demo-`): First mission (1 mission paid), First quest (1 quest finished), First block (1 block earned), Three days (a quest finished on 3 different days), Level 2 (100 XP), Emerald pocket (25 emeralds earned in total). | Placeholders only. Send the real badge names, art, and how each is earned, and they replace these. |
| 3 | **Only cumulative totals and counts, never streaks, time limits or "in a row".** "Three days" means three different days, not three consecutive ones. | CLAUDE.md: no shaming or punishment; a missed day must cost nothing. |
| 4 | **A badge is earned when the payout that earns it happens**, inside the same transaction, so a badge can never exist without its reward. A key mission counts only once a caregiver approves it; while it waits, it earns no badge. | Matches "a waiting mission earns no payout yet". |
| 5 | **Earned once and never taken away.** The database refuses to delete or change an earned badge (only the "seen" mark can change), the same way it protects the ledger. | PRD: points and badges never decrease. |
| 6 | **Catch-up.** Opening Progress awards any badge already earned by progress made before badges existed. | Safe to repeat; it never re-dates or removes one. |
| 7 | **Where Jacob sees it.** A new **Progress** tab shows the level, a bar, and every badge with its words ("Earned on …" or "Not earned yet") and a "Demo badge" label; Today shows the level and a short "What's new" note (level reached, new badges) until Progress is opened. No pop-ups; Rook's milestone reactions come in M12. | Alternative: hide badges until earned, so there is nothing to "not have yet". |
| 8 | **Not-yet-earned badges are shown with how to earn them.** | Alternative above, if this feels like pressure. |
| 9 | **Not built: an "independent finish" badge.** PRD F8 names it as a Rook milestone, but it needs "I need help" taps to be recorded, which is an open decision (see the audio and help proposal). | |
| 10 | **Badge pictures are system symbols**, placeholders for original art. | Original art only. |

**Questions for you:** Starting level 1 or 0? What should the real badges be, and what earns each? Do you want
the not-yet-earned badges visible?

Answer (date and confirmed behavior): **Confirmed by Erin, 2026-10-28: the proposal above is accepted as written.** See "Answers recorded".

## Proposed village (M11): confirmed by Erin 2026-10-28 (proposal accepted as written)

Status: **proposed, not approved.** The PRD asks for "four structures and story stages" (F9) but never defines
them, so **every structure, stage and story line is a clearly labelled demo placeholder.** The village pays
nothing and removes nothing: it only shows what has already been earned.

| # | Rule (proposed default) | Why / alternative |
| --- | --- | --- |
| 1 | **The village grows with building blocks earned**, a cumulative total from the ledger. A finished quest earns its block through the quest bonus. **This resolves a conflict in the PRD:** the overview says blocks "grow a village", but F9 says the village grows "with completed quests". | Blocks give the block reward a purpose. Consequence: a quest whose bonus is set to 0 blocks adds nothing to the village. Alternative: count finished quests instead. **This is the main question.** |
| 2 | **Four placeholder structures, 21 blocks in all:** Workshop (3 stages, 1 + 1 + 1 blocks), Garden (1 + 1 + 2), Lookout (2 + 2 + 2), Bridge (2 + 3 + 3). Each stage has a short story line shown once it is built. | Placeholders. Send the real structures, stages and stories, and they replace these. |
| 3 | **Blocks are placed in order**, finishing one stage, then the next, one structure after another. | Alternative: all four structures grow at the same time. |
| 4 | **It never goes backwards.** It is computed only from blocks earned, and the ledger cannot be changed or deleted, so a built stage stays built. There is no decay and nothing is lost for a missed day or for editing rewards later. | CLAUDE.md: cumulative, no punishment. |
| 5 | **When all 21 blocks are placed the village is "complete for now".** Extra blocks are kept and shown as saved. | Alternative: new structures arrive in a later release. With the demo rewards (1 block per finished quest) 21 blocks is about three weeks of daily quests; please say if the pace feels wrong. |
| 6 | **New growth is shown once.** Today shows "N new stages in the village" until the Village tab is opened, and the Village tab lists the stages that grew, with their story lines. | Same pattern as badges and levels. |
| 7 | **Readable without color.** Blocks are filled or outlined squares, and every stage and structure also says "Built / Next / Later" and "Not started / Building / Complete" in words. | CLAUDE.md. |
| 8 | **The pictures are plain squares and text, placeholders for original art.** | Original art only. |

**Questions for you:** Should the village grow with blocks (proposed) or with finished quests? What are the real four
structures, their stages and story lines? Should the structures grow one after another or together? Is about three
weeks to finish the placeholder village a good pace?

Answer (date and confirmed behavior): **Confirmed by Erin, 2026-10-28: the proposal above is accepted as written.** See "Answers recorded".

## Proposed Rook (M12): confirmed by Erin 2026-10-28 (proposal accepted as written)

Status: **proposed, not approved.** This builds the proposed default from the "Rook tap to talk" row above (preset lines read
aloud by the phone, no microphone, no AI). No real Rook dialogue or art has been supplied, so **every line is a clearly
labelled demo placeholder** ("Demo lines" appears on Rook's card). Rook pays nothing and changes nothing.

| # | Rule (proposed default) | Why / alternative |
| --- | --- | --- |
| 1 | **"Tap to talk" means tap to hear.** "Hear Rook" reads the line on screen with the phone's text-to-speech, and on Today "Another line" shows and says the next preset line. There is no microphone, no recording, no network and no AI. | PRD F8 does not say. Alternative: a real conversation, which would need a microphone and an AI service (not in the first release). |
| 2 | **Rook never speaks on his own.** He only talks when tapped. | The mission instruction already reads aloud by itself; a second voice would be confusing. |
| 3 | **Where Rook appears.** On Today: a greeting, or a reaction to anything new. On a mission: a welcome to the quest (only when nothing has been finished yet) and the mission's tip. The mission card sits **below** the controls, so the buttons stay in the same place on every mission. | Alternative: Rook above the controls, which pushes "Mission complete" down the screen. |
| 4 | **Reactions to milestones**: a level reached, new badges and village growth, in one line that says where to look ("You reached Level 2 and the village grew. You can see what changed on the Progress and Village tabs."). It shows until Progress or Village is opened. This **replaces** the separate "What's new" card on Today (see the M10 and M11 proposals). | One line so nothing is hidden behind a second tap. |
| 5 | **"Independent finish" is not built.** The PRD names it as a Rook reaction, but it means finishing a quest without tapping "I need help", and help taps are not recorded (an open decision in the audio and help proposal). | Say if you want help taps counted on the device. |
| 6 | **Wording.** Adult and warm: no baby talk, no exclamation marks, no pressure ("should", "must", "hurry"), nothing about failing, missing a day, streaks or other people. The same text is shown and spoken. With audio off, the words are still on screen and the button says "Audio is off". | CLAUDE.md. Tests enforce this on every line. |
| 7 | **The quest welcome is built from the quest's name and mission count; the tip is the mission's own tip.** There is no per-quest introduction yet. | A caregiver-written intro would come with the quest builder (P1, F12). |
| 8 | **Rook's picture is a system bird symbol**, a placeholder for original art. | Original art only. |

**Questions for you:** What is Rook like (voice, personality), and what should he really say? Is tap-to-hear enough, or
do you want conversation? Should "independent finish" be counted? Do you want Rook on every mission, or only on request?

Answer (date and confirmed behavior): **Confirmed by Erin, 2026-10-28: the proposal above is accepted as written.** See "Answers recorded".

## Proposed reward store (M13): confirmed by Erin 2026-10-28 (proposal accepted as written)

Status: **proposed, not approved, and real redemption stays OFF.** This builds the store and the *mechanism* for redeeming,
but nothing in the app can redeem anything: `REDEMPTION_ENABLED` is `false` and every screen says so. **It does not decide
the open "Emerald purchases" question.** The two demo rewards ("Demo: Pick a snack", 10 emeralds; "Demo: Extra game time",
20 emeralds) are samples.

| # | Rule (proposed default) | Why / alternative |
| --- | --- | --- |
| 1 | **Two separate numbers.** "Earned in total" is every emerald ever earned, from the ledger, and only ever grows. "Available" is earned minus what has been redeemed. Redeeming lowers only "Available". Both are shown, with "This number never goes down" beside the earned one. | CLAUDE.md and the PRD (points are never removed). Alternative if you decide purchases do not use emeralds up: only one number, and the log is just a record. |
| 2 | **Redeeming is OFF.** The player can see the rewards, their costs, and how many more emeralds are needed ("6 more emeralds to go."). The button says "Redeeming is turned off". The caregiver's panel says "Redeeming: Off" and why. | Until you confirm how emeralds are spent. |
| 3 | **The ledger never records a spend.** It stays earn-only (no negative amounts, no balance column). A redemption goes in its own permanent log. | So earned totals can never be reduced by any spending path. |
| 4 | **The redemption log is permanent.** Each entry copies the reward's title and cost when redeemed, so later edits never change history. Entries cannot be edited or deleted. A repeated request (double tap, retry) is recognised and charged once. Available emeralds can never go below zero. | Audit trail. **Open: how a mistaken redemption is corrected.** Proposed: a later "refund" entry, never a deletion. Not built. |
| 5 | **Redeeming is one immediate step** (when it is eventually on): choose a reward, the emeralds are used, it is logged. | Real-life rewards are handed over by a person, so an alternative is "ask for this reward", then the caregiver approves and marks it given. Not built. |
| 6 | **Caregiver controls.** Behind the PIN, the caregiver can change each reward's cost (whole emeralds, 1 to 1000; applies from now on) and show or hide it. Hidden rewards stay in the log. | Adding or removing rewards is the quest and reward builder (P1, F12). The Weekly Chest and bigger rewards are P1 (F14). |
| 7 | **Where the store lives.** The player sees it on the Progress tab, under the level. | Alternative: its own tab (that would make five). |

**Questions for you:** Do purchases use emeralds up (the "available" number goes down), or are emeralds only a score? If they do:
is redeeming one immediate step, or does the caregiver approve and hand it over? How should a mistake be undone? Which rewards
are real, and what should they cost?

Answer (date and confirmed behavior): **Confirmed by Erin, 2026-10-28: the proposal above is accepted as written.** See "Answers recorded".

## Proposed reminders (M14): confirmed by Erin 2026-10-28 (proposal accepted as written)

Status: **proposed, not approved.** This builds the PRD's local reminders (F11) and fills the gaps the earlier schedule proposal left
open (quiet hours, travel). **Delivery is best effort and is never promised.** Whether a reminder really arrives with the app closed,
after a restart, or after a time-zone change has **not** been tested on a phone; `docs/DEVICE_TESTING.md` lists how.

| # | Rule (proposed default) | Why / alternative |
| --- | --- | --- |
| 1 | **Per quest, behind the PIN:** a reminder can be switched on, given a time of day, and given its own short wording. It is sent on each day the quest is due (every day, every N days, or chosen weekdays, using the same rules as Today), at that same time. | PRD F11. Times are two number boxes (24-hour); a clock-face picker would need an extra dependency. |
| 2 | **Quiet hours** (one setting, default 9 PM to 7 AM, on). **Confirmed by Erin, 2026-10-28: a reminder set inside quiet hours moves to the morning**, when they end: 6:30 AM becomes 7:00 AM the same day, and 10:00 PM becomes 7:00 AM the next morning. Nothing is ever sent during quiet hours. *My reading of "move to the morning" for the overnight case: a reminder moved into the next morning is kept only if the quest is also due that morning (so a weekly or every-3-days quest set for 10 PM gets no reminder, because there would be nothing to start); say if you would rather it was sent anyway.* | Never disturb overnight. The 9 PM to 7 AM default itself is not yet confirmed. |
| 3 | **Planned two weeks ahead, in the phone's current time zone.** Each reminder is its own one-off notification (at most 48 pending, under iOS's limit of 64). The plan is rebuilt when the app opens or returns to the foreground, when a setting changes, when a quest is finished (today's reminder is dropped) and when the time zone changes. **So reminders stop if the app is not opened for about two weeks**, and the caregiver is told so. **Two weeks confirmed as fine by Erin, 2026-10-28.** | Expo's docs do not say how the platform's repeating triggers behave across time-zone changes or reboots, and they cannot express "every N days". Alternative: repeating triggers for daily and weekly quests, which keep going without the app being opened. |
| 4 | **No duplicates.** Each reminder has a stable id built from the quest, the day, the exact moment and the wording. The plan is compared with what is already scheduled: only what is missing is scheduled, and only our own stale reminders are cancelled. Other notifications are never touched. Overlapping runs are lined up. | A changed time or wording gives a new id, so the old one is cancelled; the docs do not say whether reusing an id replaces it, so this never relies on that. |
| 5 | **Permission is asked only when it is needed**: when a caregiver turns a reminder on, or presses "Allow notifications", never at launch. If notifications are off, the panel says so and offers "Open phone settings". Nothing is scheduled without permission, and our reminders are removed if permission is taken away. | |
| 6 | **Lock-screen safe wording.** The notification says "Quest Blocks" and "A quest is ready when you are." It never contains a quest's name or anything about it (care routines may be health-adjacent). A caregiver may write their own short wording (up to 80 characters, plain text) and is warned it can show on a locked phone. **Confirmed by Erin, 2026-10-28.** | CLAUDE.md privacy rule. |
| 7 | **Gentle.** One reminder per due day, at the set time, with the phone's normal notification sound (no alarm sound), no countdown, and **no follow-up nagging** if it is ignored or the quest is not done. No reminder for a quest already finished today. While the app is open, a reminder shows as a quiet banner with no sound. | PRD: gentle tone, no countdown or alarm sounds. Alternative: a single gentle follow-up (not built). |
| 8 | **What is not promised.** The phone must allow notifications; Focus and Do Not Disturb can hide them; on Android 12 and later, without the exact-alarm permission (denied by default on Android 14), reminders can arrive a few minutes late. The app does not ask for the exact-alarm permission. | Expo's docs. The PRD target of a median start within 15 minutes of a reminder cannot be measured yet. |
| 9 | **Not built:** a different time on different days, several reminders a day, snooze, and "you missed it" follow-ups (which would break the no-nagging rule). | |

**Answered 2026-10-28:** two weeks of planning is fine; a reminder inside quiet hours moves to the morning; a caregiver may write their own wording;
the phones are iOS and Android. **Still open:** whether 9 PM to 7 AM is the right default, the other rules above, and which phone models and Android
version (see `docs/DEVICE_TESTING.md`).

Answer (date and confirmed behavior): see "Answers recorded" below.

## Answers recorded

Answers Erin has given, with the date. The proposals above stay as written except where a row says "Confirmed".

| Date | Topic | Answer | Effect |
| --- | --- | --- | --- |
| 2026-10-28 | Reminders: how far ahead (M14, rule 3) | Two weeks is fine. | Kept as built. Reminders stop if the app is not opened for about two weeks, and the app says so. |
| 2026-10-28 | Reminders: quiet hours (M14, rule 2) | A reminder inside quiet hours moves to the morning. | Changed from "skip an evening reminder" to "move it to when quiet hours end". Kept for the next morning only if the quest is due then (my reading; open to change). |
| 2026-10-28 | Reminders: own wording (M14, rule 6) | Yes, a caregiver may write their own. | Kept as built (up to 80 characters, with a lock-screen warning). |
| 2026-10-28 | Target phones (original "Target phones" row) | iOS and Android. | Both platforms confirmed. **Phone models and the minimum OS version are still unknown.** |
| 2026-10-28 | Emerald purchases (original table row; M13) | Confirmed: the M13 proposal, as written. | Purchases lower only the spendable "Available" number; "Earned in total" never goes down; no punitive deduction. **`REDEMPTION_ENABLED` is still `false`**: M13 rules 4 and 5 leave two things open (how a mistaken redemption is undone, and whether redeeming is one step or caregiver-approved), the ledger is permanent so a wrong redemption could not be removed, and the only rewards are demo ones. Turning it on is a one-line change once those are settled. |
| 2026-10-28 | PIN evaluation (M7) | Confirmed: 6-digit PIN, 5 tries then 30 s doubling to 15 min, 5-minute idle relock, recovery code shown once, PBKDF2-HMAC-SHA256 at 10,000 iterations, no biometrics. | The design is approved. **Timing on real phones, Android Keystore and the iOS Keychain-after-reinstall behavior are still unmeasured**, so the PIN is not release-acceptable until `docs/DEVICE_TESTING.md` is done on hardware. The iteration count may need to change once measured. |
| 2026-10-28 | Proposals M2, M4, M5, M6, M8, M9, M10, M11, M12, M14 | Confirmed as written (including the 9 PM to 7 AM quiet-hours default). | Schedule, audio/help, payouts, pause, approvals, celebration, levels and badges, village, Rook (tap to hear preset lines, no microphone) and reminders are approved as built. **Badge, village and Rook content is still placeholder** until real content is supplied. |
| 2026-10-28 | Still open (not settled by accepting defaults) | | Bathroom fixture (95 XP, 38 emeralds, 1 block); prototype/content export; phone models and minimum OS; final app name, account holder and real bundle ids (Distribution); whether caregivers must be able to add chores in P0 (F12). |

## Development identifiers (2026-10-28)

Placeholder application ids were added to `app.json` only so development builds can be made: `com.anonymous.quest-blocks` (iOS) and
`com.anonymous.questblocks` (Android). They are **not** approved identifiers. The Distribution decision above is still open; changing an id
later makes a different app, so confirm account ownership and the final name before any store configuration or release build.
