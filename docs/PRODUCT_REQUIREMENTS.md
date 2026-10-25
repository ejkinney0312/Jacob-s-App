# Quest Blocks product requirements source snapshot

Source: https://docs.google.com/document/d/1OS-izYxY3zXDh5KYFnDttuhOZgW3M8Mfbl4-boBJM0c/edit

Retrieved October 24 2026 America Chicago. This is a text snapshot; table cells appear in reading order. The original Google Doc remains authoritative. See DECISIONS.md for unresolved implementation questions.

Quest Blocks — Product Requirements (iOS & Android Apps)

Oct 24, 2026 · @Erin

Overview

Quest Blocks is a native iOS and Android app that turns an adult with a cognitive disability's daily chores into block-building quests, with a caregiver in control of content and rewards. It replaces the web prototype with apps installed from the App Store and Google Play.

Problem. Jacob has trouble remembering chores and finishing every step within each one. Reminders from family feel like nagging and checklists feel clinical.

Solution. Each chore is a Quest, each step a Mission. A calm, original block-world theme and a companion, Rook, give tips and encouragement. Missions earn XP, emeralds and building blocks that grow a village, and emeralds buy caregiver-approved real-life rewards.

Why native. The web prototype cannot send reliable scheduled reminders on iPhone, keeps data only in one browser, and cannot be installed from a store. Native apps add dependable local notifications, secure caregiver PIN storage, cloud backup and sync, and the store distribution the family wants.

Goals, non-goals and success metrics

The app succeeds if Jacob completes more chore steps with fewer prompts, and the caregiver spends less time reminding.

Goals

Jacob starts and finishes scheduled quests with reminders only, no verbal prompting.

Missed or skipped steps drop, especially the known problem steps (toilet, mirrors, tub, stovetop, fridge doors, Friday laundry, scheduled care routine).

The caregiver can add or change chores, rewards and point values in minutes, without a developer.

The app is published on both stores and stays reliable offline.

Non-goals (v1)

Multiple households, social features, leaderboards or in-app purchases.

Punishments, point removal or shaming messages of any kind.

Medical monitoring or health advice. The care-routine quest is a reminder only.

Success metrics (targets to confirm after a 4-week trial)

Metric

Target

Quests completed vs. scheduled (weekly)

80% or more

Missions completed without tapping "I need help"

Rising trend over 8 weeks

Reminder-to-start time

Under 15 minutes median

Skip rate on the 8 problem steps

Down 50% from week 1

Caregiver time to create a new quest

Under 10 minutes

Crash-free sessions

99.5% or more

Users and roles

Two roles share one device-first experience, with the caregiver area locked behind a PIN.

Role

Who

Needs

Player

Jacob, an adult, early reader, loves building, crafting and exploring games

One task at a time, icons plus audio, positive feedback, no childish tone

Caregiver

Erin and other trusted family

Build chores, approve key steps, set rewards, see what gets skipped

The schema supports more players and caregivers per household later, but v1 ships with one player and one or two caregivers.

Platform and distribution

One cross-platform codebase ships to both stores, supporting recent iOS and Android versions and phone-first layouts (tablet-friendly, not tablet-only).

Item

iOS (App Store)

Android (Google Play)

Developer account

Apple Developer Program, annual fee (about $99/yr, confirm on Apple's site)

Play Console, one-time fee (about $25, confirm on Google's site)

Pre-release testing

TestFlight

Internal and closed testing tracks

Key gate

App Review against the guidelines, including 4.2 minimum functionality

Closed test with 12 opted-in testers for 14 days if using a personal account created after Nov 13, 2023 (Google)

Required listing items

Privacy nutrition labels, screenshots, review notes, demo caregiver PIN

Data safety form, content rating, screenshots, target audience

Decisions

Register under an organization or a named personal account Erin controls, not a developer's. Organization accounts are exempt from Google's 12-tester rule, but need a D-U-N-S number.

Do not ship a thin web wrapper. Reviewers reject apps that only repackage a website under guideline 4.2 (overview), so v1 is built with native navigation, local notifications, offline storage and device audio.

Distribution choice to confirm: public listing, or unlisted/private distribution to family only (Apple custom or unlisted distribution, Google private or closed track). A public listing needs extra support, privacy and moderation readiness.

Functional requirements

P0 is required for first store release, P1 for the following release, P2 later.

ID

Requirement

Priority

F1

Today screen lists scheduled quests (daily, every N days, weekly by weekday) with progress

P0

F2

One mission per screen: icon, short text, replay-audio button, "I need help", "Mission complete"

P0

F3

Self-verify missions grant XP and emeralds instantly; key missions go to "waiting for approval"

P0

F4

Quest completion celebration (calm animation, one soft chime) with bonus XP, emeralds, building block

P0

F5

Quest checklist with pause and resume exactly where left off

P0

F6

Caregiver mode behind a PIN: approvals queue, edit rewards, point values, quests on/off

P0

F7

Reward store with caregiver-editable costs and redemption log; points never removed

P0

F8

Rook companion: quest intro, per-mission tip, tap-to-talk, milestone reactions (level up, badge, independent finish)

P0

F9

Village with four structures and story stages that grow with completed quests

P0

F10

Badges and levels (flat 100 XP per level)

P0

F11

Scheduled local reminders per quest, with caregiver-set times and a gentle tone

P0

F12

Full in-app quest builder: add, edit, reorder missions, icons, instructions, tips

P1

F13

Caregiver and player on separate devices with cloud sync and push approval alerts

P1

F14

Weekly Chest at 80% completion and bigger-quest rewards (game night, bowling, Pokemon GO outing, card store, extended game time)

P1

F15

Skip and insights report; reschedule missed quests without penalty

P1

F16

Recorded caregiver voice for instructions in place of device text-to-speech

P1

F17

Optional photo proof for chosen missions

P2

F18

Demo videos per mission, adaptive prompt reduction, rewards customization for Rook

P2

Native capabilities

These are what justify a native app over the web version, and what App Review will look for.

Local notifications. Scheduled reminders per quest, reliable when the app is closed. Caregiver sets time, wording and quiet hours. No countdown or alarm sounds.

Push notifications (P1). Alert the caregiver when a key mission needs approval.

Audio. Device text-to-speech at launch; recorded voice clips later. Respect the silent switch and volume.

Offline-first storage. All quests work without signal (garden and animal chores); sync when back online.

Secure storage. Caregiver PIN stored in the iOS Keychain and Android Keystore. Optional Face ID or fingerprint to enter caregiver mode.

Haptics. One gentle tap on mission complete, user-toggleable.

Camera (P2). Optional photo proof, stored privately.

Home-screen widget (P2). "Today's quests" at a glance.

Accessibility requirements

The app must meet WCAG 2.1 AA and both stores' accessibility guidance, and be tested with the real player.

Tap targets at least 48 dp (Android) and 44 pt (iOS); primary buttons at least 64 dp tall.

One task per screen, icon plus a short phrase, consistent layout and button positions.

Full support for VoiceOver and TalkBack, system text scaling up to 200%, and Reduce Motion.

No flashing, no autoplay motion; celebrations are a single short animation and one chime.

Color is never the only signal; contrast at least 4.5:1 for text.

Audio replay on every instruction and tip; setting to turn all audio off.

Pause and resume are lossless; no timeouts or countdowns that can be "lost".

Language is respectful and adult: no baby talk, no failure messages, no point removal.

Data, privacy, safety and compliance

The app holds sensitive information about an adult with a disability, so data minimization is a requirement, not a nice-to-have.

Data kept: first name or nickname, chore content, progress, rewards, caregiver PIN hash. No email or contact data for the player; no ads; no third-party analytics or tracking SDKs in v1.

Care-routine content (for example the every-3-days brewing quest) uses neutral in-app wording. Details live in caregiver-written instructions, stored only on the household's data, and are excluded from logs and crash reports.

Storage: on-device by default; optional encrypted cloud sync (P1) with caregiver sign-in. Data deleted on request and when the household is removed.

Store compliance: privacy policy URL, App Store privacy labels, Google Play data safety form, and account deletion flow if accounts exist.

Legal check before launch: privacy law applicability (HIPAA does not apply to a family tool, but state privacy laws and guardianship questions might) needs a review by counsel. Not legal advice.

Content: original art, names and sounds only. No Minecraft assets, characters or logos; the store listing must not use the word Minecraft.

Technical approach

Build once in React Native with Expo, so the existing data model, quest content and Rook dialogue carry over from the web prototype.

Layer

Choice

Why

App

React Native + Expo (EAS Build)

One codebase, both stores, over-the-air content fixes

Local data

SQLite, offline-first

Works without signal

Backend (P1)

Supabase or Firebase: auth, Postgres/Firestore, storage, push

Little server to maintain

Notifications

expo-notifications (local), FCM and APNs (push)

Reliable reminders

Audio

expo-speech now; bundled voice clips later

No network needed

Secrets

Keychain / Keystore via expo-secure-store

PIN storage

Builds and CI

EAS Build, TestFlight, Play internal track

Repeatable releases

The existing entities carry over: users, households, quests, missions, mission and quest instances, reward items, redemptions, badges, progress, reminders and encouraging messages.

Release plan and milestones

Times are estimates for one developer plus Erin as tester; dates are not committed until a developer is chosen.

Phase

Scope

Est. duration

Exit gate

0. Setup

Developer accounts, app name and bundle ID, privacy policy, art and icon

1-2 weeks

Both accounts active

1. Native MVP

F1-F11 on-device, local reminders, Rook, village, badges

6-8 weeks

Jacob completes a week of quests on a test build

2. Internal beta

TestFlight and Play internal track; Android closed test with 12 testers for 14 days if required

3-4 weeks

No crash blockers, accessibility pass

3. Store release

Listings, screenshots, review notes, submission

1-2 weeks

Approved on both stores

4. Version 1.1

Quest builder, cloud sync, push approvals, Weekly Chest, insights

6-8 weeks

Caregiver can run everything without a developer

One risk drives the schedule: the Google testing window and App Review rejections can each add weeks, so submit early.

Testing and acceptance criteria

A release is accepted when every item below passes on one recent iPhone and one recent Android phone.

Jacob completes a full quest unassisted and can find Pause, Help and Replay without being told.

A reminder fires on time with the app closed and after a device restart.

A key mission stays "waiting" until the caregiver approves, then pays out exactly once.

Emeralds, XP, blocks and badges never decrease, including after an app update.

All flows work in airplane mode; data survives app updates and reinstall via sync (P1).

VoiceOver, TalkBack, 200% text and Reduce Motion checks pass with no clipped content.

Reward math matches the spec: for example, a full Bathroom quest yields 95 XP, 38 emeralds and 1 building block.

Store checklists complete: privacy policy live, labels filled, review notes with a demo caregiver PIN.

Risks and open questions

Risk

Mitigation

App Review rejects the app as too thin or too web-like

Native notifications, offline storage and navigation from day one; clear review notes

Google's 12-tester, 14-day closed test delays launch

Recruit family testers early, or register as an organization

Reward fatigue or lost interest

Rotate rewards, village stages, rare bigger-quest rewards

False completion on important steps

Caregiver approval on key missions only; no constant surveillance

Sensitive health-adjacent content

Neutral wording, minimal data, no analytics, counsel review

Developer unavailable or costly

Keep the web prototype as fallback; scope P0 tightly

Open questions for Erin

☐ Public store listing, or private/unlisted for family only?

☐ Who is the legal account holder and who pays the store fees?

☐ Does Jacob use iPhone, Android or both? Does he have his own device?

☐ Should approvals work from a second phone at launch (cloud sync) or after v1?

☐ Final app name check: is "Quest Blocks" free to use in both stores?

☐ Who builds it: you, a freelancer or an agency?

