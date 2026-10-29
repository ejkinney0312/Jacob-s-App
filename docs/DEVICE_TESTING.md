# Device testing checklist

CLAUDE.md: Expo Go or a simulator is **not** release acceptance. Notifications, secure storage and accessibility must be tested on a
development build on a real iPhone and a real Android phone, and anything not tested must be reported as untested. This file lists
what has to be checked. Record each result (pass, fail, or not tested) in `docs/STATUS.md`.

## Getting a development build

`expo-dev-client` is installed. A development build is a version of the app with Expo's tools built in, so native features work.

- **iPhone (local):** needs Xcode (installed) and CocoaPods (**not installed on this machine**; `brew install cocoapods`), then
  `npx expo run:ios --device` for a connected iPhone (free Apple ID signing works for your own phone), or `npx expo run:ios` for the simulator.
- **Android (local):** needs Android Studio and its SDK (**not installed**), then `npx expo run:android --device`.
- **Cloud:** `npx eas-cli@latest build --profile development --platform ios` (or `android`). Needs an Expo account (and an Apple Developer
  account to install on an iPhone). Not set up yet; there is no `eas.json`.
- After building, start the server with `npx expo start --dev-client` and open the app on the phone. Plain `npx expo start --go` still opens Expo Go.

## Reminders (M14)

Use fictional demo data. For each, note the phone, OS version, and result.

1. **Permission.** Fresh install: the caregiver panel says "Not asked yet". Turn a quest's reminder on: the system prompt appears **once**.
   Choose Allow: the panel says "On" and shows a next-reminder time. Repeat with Don't Allow: the panel says "Off", shows the explanation, and
   "Open phone settings" opens the right place; turning notifications on there and returning to the app schedules reminders.
2. **App closed.** Set a reminder 3 minutes ahead. Close the app completely (swipe away). The reminder arrives at about the right time.
   The text is only "Quest Blocks / A quest is ready when you are." (or the caregiver's wording). Note how late it was on Android.
3. **Lock screen.** With the phone locked, the reminder shows no quest name or detail. Check with previews on and off.
4. **After a restart.** Set a reminder 5 minutes ahead, restart the phone, do not open the app. The reminder still arrives.
5. **Quiet hours.** Set a reminder inside quiet hours at 6:30 AM (it should arrive at 7:00 AM that day) and a daily quest's reminder at 10:00 PM (it should arrive at
   7:00 AM the next morning, not at night). A quest that is not due the next morning (a weekly or every-3-days quest) gets no 10:00 PM reminder at all.
   Change quiet hours and confirm the next-reminder time changes. Nothing should ever arrive during quiet hours.
6. **Finished quest.** Finish a quest before its reminder time (including one finished by a caregiver's approval). No reminder arrives for it that day; the next due day still does.
7. **Time zone.** Change the phone's time zone (or travel), open the app, and check that the next reminder time matches the new local time.
   Check the day the clocks change if you can.
8. **No duplicates.** Change a reminder's time several times, open and close the app several times: only one reminder arrives per due day.
9. **Foreground.** With the app open on Today when a reminder is due: a quiet banner, no sound.
10. **Focus / Do Not Disturb.** Confirm what happens, and that nothing is sent during quiet hours.
11. **Android only.** Android 13+: the permission prompt appears (the "Quest reminders" channel exists first). Android 14: confirm reminders still arrive without
    the exact-alarm permission, and note the delay.
12. **Two weeks.** Leave the app unopened for 14 days and note when reminders stop (expected: after the planned window).

## Other native features (M7, M9; still untested on any phone)

- **Caregiver PIN:** the PIN screen, the retry wait, relock on background and on leaving the tab, recovery code, and (iPhone) whether the Keychain entry survives an uninstall.
  Measure how long unlocking takes (target well under 2 seconds; the simulator took about 0.7 seconds). Android Keystore behavior.
- **Sound and haptics:** the quest chime plays, and is silenced by the iPhone's silent switch; volume buttons change it; "Read aloud and sounds" off silences it;
  the gentle vibration on Mission complete (and its switch).
- **Read-aloud:** speech works, and is silenced by the iPhone's silent switch.

## Accessibility (M15)

VoiceOver (iPhone) and TalkBack (Android) through Today, a mission, Pause, Help, the PIN screens, approvals, Progress, Village; text at 200 percent with nothing clipped;
Reduce Motion (the celebration should be a still picture); touch targets at least 48 (iPhone 44); contrast 4.5 to 1.
