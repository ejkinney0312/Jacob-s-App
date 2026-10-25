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
