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
