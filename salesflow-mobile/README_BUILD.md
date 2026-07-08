# SalesFlow CRM - Local Build Instructions

This project is configured using the **React Native Bare Workflow**. Unlike the standard Expo Managed workflow, the `android/` directory is a permanent part of the source code to support custom native features like **Call Recording**.

## Prerequisites
1. **Android Studio**: Installed and configured.
2. **JDK 17**: Standard for React Native 0.73+.
3. **Android SDK**: Ensure Build-Tools (version 34 or 35) are installed via Android Studio SDK Manager.

## Local Build Commands (Preferred)
These commands will compile the app on your local machine and generate an APK.

### 1. Build & Run (Debug)
Used for development and testing.
```bash
npm run android
```

### 2. Build Release APK (Testing)
This will generate a production-ready APK but signed with development keys for easy installation.
```bash
npm run build:apk
```
*The APK will be located at: `android/app/build/outputs/apk/release/app-release.apk`*

### 3. Build & Run (Release Variant)
Installs the release version directly to your connected device/emulator.
```bash
npm run android:release
```

## Critical Maintenance Rules
> [!WARNING]
> **Do NOT run `npx expo prebuild --clean`**: This will delete your custom native Kotlin code in the `android/` folder. Standard `npx expo prebuild` is generally safe as it tries to merge changes, but always verify your Git status after running it.

> [!IMPORTANT]
> **Adding New Native Packages**: If you install a new library with native dependencies (e.g. `npm install react-native-reanimated`), you should run `npx expo prebuild` to let Expo handle the autolinking, but then double-check [MainApplication.kt](file:///android/app/src/main/java/com/foxeditz/salesflow/MainApplication.kt) to ensure the `CallRecordingPackage()` is still registered.
