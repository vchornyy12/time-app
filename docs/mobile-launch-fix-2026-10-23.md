# Android startup crash — 2026-10-23

The user reported that APK 1.0.1 immediately closed on OnePlus Nord 5.
Reproduced with the exact distributed APK on an ARM64 Android 16 (API 36)
Google APIs emulator. Logcat reported a fatal JavaScript exception:

```
Incompatible React versions:
react: 19.1.10
react-native-renderer: 19.1.0
```

React Native 0.81.5 checks exact React versions at runtime. Its npm peer
range permits a patch difference, and the native build succeeds despite it.
Aligned React, React DOM and the test renderer to exactly 19.1.0, the version
required by this renderer and Expo SDK 54. Added a regression test that reads
the installed production renderer's version guard and checks the packages.

Built 1.0.2, versionCode 3, retaining the existing internal signing certificate
so the APK installs over 1.0.1. Native files were synchronized with Expo prebuild.
The internal APK remains debug-certificate signed, with release bytecode and
debuggable disabled, as was the previous distributed APK.

Validation:
- 42 tests across 6 mobile test files passed; TypeScript passed.
- Gradle release build and APK static checks passed.
- Installed the distributed 1.0.1 APK and reproduced its fatal startup crash.
- Updated that installation to the exact 1.0.2 artifact without uninstalling.
- Cold launch succeeded; UI Automator confirmed the GTD Companion email login
  screen and Send magic link button. Crash log remained empty after startup.
- Physical OnePlus testing and authenticated task flows were not performed.

Artifact: `mobile/dist/time24-1.0.2-internal.apk`, 34,839,350 bytes.
SHA-256: `b189bed5d045e9397d60fc0c4ad03cd94f699d43abde3347ce70262cf1e1996e`.

Source compatibility reference: https://docs.expo.dev/versions/v54.0.0/
