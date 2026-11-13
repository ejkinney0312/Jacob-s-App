# Mend: draft privacy policy and store privacy answers

**Status: DRAFT for Erin to review. Not legal advice and not published.** Nothing here has been submitted to Apple or Google. Fill in the `[PLACEHOLDERS]`, have it read by someone qualified if you want certainty, and re-check every answer against the final build before submitting (section 5).

Written 2026-11-12 from the code as it is today. The repo is public, so no personal contact details are kept in this file.

## 1. What the app actually does with data (checked in the code)

| Question | What I found |
|---|---|
| Does the app send anything over the internet? | **No.** There is no network code in `src/` (no `fetch`, sockets or API clients). Release builds also block the Android `INTERNET` permission (`app.config.ts`). |
| Analytics, ads, crash reporting, tracking SDKs? | **None** in `package.json` or the code. |
| Accounts or sign-in? | **None.** P0 has no backend and no player email (CLAUDE.md). |
| Where is data kept? | On the phone only: a local SQLite database (quests, progress, rewards, reminders, settings) and secure storage (the PIN and recovery-code verifiers, never the PIN itself). |
| Push notifications? | **No remote push** (`enableRemoteNotifications: false`). Reminders are scheduled **on the phone** and never leave it. |
| Microphone, camera, location, contacts, photos? | **None.** Microphone and recording are switched off in `app.json`. |
| Sound | The app plays bundled voice clips and the phone's own text-to-speech. Nothing is recorded. |
| Anything shown on a locked phone? | A reminder reads "Mend / A reminder is ready." unless a caregiver turns on "show the words" for that reminder. |
| Links out of the app | Only "Open phone settings" (to allow notifications). |

**What a caregiver can type in:** chore wording, reward names, and routine reminders (which could name a medicine or a care task). This is stored only on that phone. It is the household's own information, entered by them, and the developer never receives it.

## 2. Draft privacy policy (plain language)

> **Mend privacy policy**
> Last updated: [DATE]
>
> Mend is a chore and routine app. It is made by [DEVELOPER NAME] ("we").
>
> **What stays on your phone.** Everything you enter or earn in Mend stays on your phone. That includes quests and chores, progress, rewards, reminders, settings and the caregiver PIN. We do not have a server, and the app does not send this information to us or to anyone else.
>
> **What we collect.** We do not collect, receive, sell or share personal information. The app has no accounts, no advertising, no analytics and no tracking.
>
> **Care and routine reminders.** A caregiver can add reminders, for example to drink water or to take something at a set time. These are only reminders that a caregiver wrote. Mend does not give medical advice and does not record whether a reminder was done. Reminder text stays on the phone. By default a notification shows only "A reminder is ready." and not what it is for, so it does not reveal anything on a locked screen. A caregiver can choose to show the words.
>
> **Notifications.** Mend asks permission to send reminders. They are created and delivered by your phone. You can turn them off at any time in your phone's settings.
>
> **The caregiver PIN.** Only a scrambled check value of the PIN is kept, in your phone's secure storage. We cannot see or recover your PIN. A recovery code is shown once when you set it up; if you lose both, the only way back in is to remove and reinstall the app, which erases its data.
>
> **Your phone's backups.** Your phone's own backup (for example iCloud or Google's backup) may include the app's data, under your own account and your phone's own settings. We do not have access to it. [CONFIRM: see section 5, item 1]
>
> **Deleting your data.** Because the data lives only on your phone, removing the app deletes it.
>
> **Who it is for.** Mend is made for adults who are learning to read and the people who support them. It is not directed at children under 13, and we do not knowingly collect information from anyone.
>
> **Changes.** If we ever add something that handles information differently (for example syncing between phones), we will update this policy and the app first.
>
> **Contact.** [CONTACT EMAIL] [or a contact page]

## 3. Apple: App Privacy ("nutrition label") answers

Based on section 1. Enter these in App Store Connect under **App Privacy**.

| Question | Draft answer |
|---|---|
| Do you or your third-party partners collect data from this app? | **No.** Choose "Data Not Collected". |
| Used for tracking? | **No.** (Not needed: no data is collected.) No App Tracking Transparency prompt is required, and the app does not ask for one. |
| Privacy Policy URL (required) | **[YOUR HOSTED POLICY URL].** Apple needs a public web page; this repo's file is not one. |
| Age rating | Answer the rating questions as an ordinary app for adults: no violence, gambling, user-generated content, or unrestricted web access. Do **not** put it in the Kids category. |
| Export compliance | `ITSAppUsesNonExemptEncryption` is set to `false` in `app.json`. The app only hashes the PIN and uses the phone's own secure storage, with no encryption of its own. **Confirm this is right for your situation.** |
| Review notes | Give a demo caregiver PIN or tell the reviewer how to set one, and say the app is offline. |
| Health | The app does **not** use HealthKit or health data. Routine reminders are text a caregiver types. Do not describe it as medical advice or a medical device. |

## 4. Google Play: Data safety answers

| Question | Draft answer |
|---|---|
| Does your app collect or share any of the required user data types? | **No.** |
| Is all of the user data encrypted in transit? | Not applicable: no data is sent. |
| Do you provide a way for users to request that their data be deleted? | The data exists only on the phone; uninstalling the app deletes it. Say that, and it is the honest answer for an offline app. |
| Privacy policy URL | **[YOUR HOSTED POLICY URL]** (required). |
| Target audience and content | Adults (not children). Not a "family" app. |
| Permissions to expect | Notifications (`POST_NOTIFICATIONS`) and audio settings (`MODIFY_AUDIO_SETTINGS`). The notifications library normally also adds boot-time and vibration permissions so reminders survive a restart. **Check the real list in the release build's merged manifest** (section 5, item 2). |
| Health apps declaration | Google asks apps with health features to complete a **Health apps declaration**. Mend only shows caregiver-written reminders, but read the current form and answer it truthfully; do not skip it because the app is simple. |

## 5. What to check before you submit

1. **Android backup.** Android may copy app data (including the local database) to the user's Google account through automatic backup. The app does not turn that off today. Decide: leave it on (and keep the policy sentence about backups) or set the backup off in the build. I have not changed anything. Secure storage is set so its items stay on this device only.
2. **Permissions list.** After a release build, read the final permission list in the built manifest and make the Data safety and policy match it exactly.
3. **Hosted page.** Both stores need a public web address for the policy. Pick where it will live; I can turn section 2 into a page.
4. **Distribution decision.** Public listing, or unlisted or family-only distribution (`docs/PRODUCT_REQUIREMENTS.md`, `docs/DECISIONS.md`)? The forms are needed either way for a store build, but the review effort differs.
5. **Contact details and developer name.** Yours to supply. Do not put a personal email in this repo.
6. **Voice clips.** Confirm your ElevenLabs plan allows use in a public app (`docs/DECISIONS.md`, "Recorded voice").
7. **Name.** "Mend" availability has not been verified.

## 6. What would change these answers

If any of this is added, the privacy answers, the policy and the build permissions all need to change **before** it ships:

- Syncing between devices or push alerts (F13): needs accounts, a server, deletion, and a very different data-collection answer.
- Photos or video (F17): camera and photo access, and where they are stored.
- Recording a caregiver's voice in the app (F16): microphone permission.
- Any analytics or crash reporting, even for debugging.
- Any network call, including checking for updates.
- Sharing or exporting data.
