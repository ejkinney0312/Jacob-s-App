# Private household content

A household's real quests, wording and rewards must not go in this repository (it is public) or in the public app.
They live in one file that git ignores and that only a **local** build includes.

## How it works

| Build | What the app starts with |
| --- | --- |
| Development build (`__DEV__`) | Fictional demo quests ("Demo: ..."). |
| Any other build | Neutral **starter** content (3 generic chores, 5 generic rewards; `src/domain/starter-content.ts`). |
| Either, if `content/private/household.json` exists when the build is made | That file's content is loaded on first launch, and the demo and starter quests and rewards it does not contain are **switched off** (not deleted). |

- `content/private/` is in `.gitignore`, and **EAS cloud builds skip ignored files**, so a build made with EAS never contains it.
  Checked on 2026-10-29: an iOS bundle made without the file contains none of its wording; one made with it does.
- Only `npx expo run:ios` (or `run:android`) on the machine that has the file bundles it. The text then sits in the app's code on your own phone.
- The file is checked before use. A bad file is reported by field name only (never its text) and the app carries on with the sample content.

## The file

`content/private/household.json`. Fields the app does not know yet (for example `badges`, `rookIntro`) are allowed and ignored.

```json
{
  "contentVersion": 1,
  "quests": [{
    "id": "kitchen", "title": "Kitchen Cleanup", "icon": "kitchen", "sortOrder": 2,
    "schedule": { "kind": "daily" },
    "completionBonus": { "xp": 20, "emeralds": 8, "blocks": 1 },
    "missions": [{
      "id": "kit_1", "title": "Clear dishes from the counter", "icon": "dishes",
      "instruction": "Text read aloud.", "tip": "Rook's tip.",
      "requiresApproval": false, "reward": { "xp": 5, "emeralds": 2, "blocks": 0 }
    }]
  }],
  "rewards": [{ "id": "movie", "title": "Choose the movie", "costEmeralds": 25 }],
  "village": [{
    "id": "village-kitchen", "questId": "kitchen", "name": "Bakehouse", "summary": "Grows as the kitchen quest is finished.",
    "blocksPerLevel": 3, "maxLevel": 5,
    "stories": ["Level 0 line.", "Level 1 line.", "Level 2 line.", "Level 3 line.", "Level 4 line.", "Level 5 line."]
  }]
}
```

- `schedule` is `{ "kind": "daily" }`, `{ "kind": "everyNDays", "intervalDays": 3, "anchorDate": "2026-08-04" }` or `{ "kind": "weekly", "weekdays": [5] }` (0 = Sunday).
- Ids: letters, numbers, `-` or `_`. Mission order is the order in the list. Reward costs are 1 to 1000 emeralds.
- `village` is optional. Each structure is tied to **one quest in the same file** (`questId`) and grows only from that quest's blocks: a level every `blocksPerLevel` blocks, up to `maxLevel`. `stories` needs one line for each level from 0 to `maxLevel` (so `maxLevel + 1` lines). A quest can have only one structure.
- Icon names the app does not draw yet fall back to a check mark; the names are kept for the original art to come.

## Changing it

The file is applied only when `contentVersion` is **higher** than the last one applied on that phone. This stops the app from overwriting a
caregiver's later edits (a reward cost, a quest switched off) on every launch. To apply a change: edit the file, raise `contentVersion`, rebuild.

On a higher version, wording, schedules, order and reward values are updated by id; whether a quest or reward is switched on is kept;
progress and earned totals are never touched. The importer **refuses** (and changes nothing) if a quest no longer lists a mission the app
already has, or a mission id already belongs to a different quest. Give new missions new ids. It also refuses a village structure that would move to a different quest or whose new size would take away a level already reached. Give new structures new ids.

## Not covered yet

Badges and Rook's quest intro lines in the household's data are kept in the file but the app does not use them yet
(the Weekly Chest badge needs a P1 feature). The village is used (see above). Reward tiers and the Weekly Chest are P1 (F14).

## Care routines

A quest that is a caregiver-authored care routine (for example one involving boiling or health) is the caregiver's own reminder,
never medical guidance. Notifications never contain a quest's name or wording (see M14).
