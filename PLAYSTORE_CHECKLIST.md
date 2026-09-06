# Play Store Publishing Checklist

## App Configuration Added

- App name: `Veerraaj Foods`
- Android package ID: `com.veerrajfoods.mobileapp`
- Android version: `1.0.0`
- Android version code: `1`
- Production build format: Android App Bundle (`.aab`)
- EAS production builds auto-increment version code.
- Removed high-friction unused permissions:
  - `android.permission.RECORD_AUDIO`
  - `android.permission.SYSTEM_ALERT_WINDOW`
  - `android.permission.READ_EXTERNAL_STORAGE`
  - `android.permission.WRITE_EXTERNAL_STORAGE`

## Build Commands

```bash
npx eas build -p android --profile production
```

For a test APK before Play Store upload:

```bash
npx eas build -p android --profile preview
```

## Play Console Items Still Required

- Google Play Developer account.
- App signing setup in Play Console.
- Privacy policy URL. This app uses camera and foreground location, so Play Console will require clear disclosure.
- Store listing:
  - App icon
  - Feature graphic
  - Phone screenshots
  - Short description
  - Full description
  - Contact email
- Data Safety form:
  - Location is used for shop coordinates and staff attendance.
  - Camera is used to capture shop photos.
  - Confirm whether account, bill, staff, route, shop, and payment data is collected by your backend.
- Content rating questionnaire.
- Target audience and ads declaration.
- Internal testing release before production rollout.

## Suggested First Release Flow

1. Run lint and fix any errors.
2. Build production `.aab` with EAS.
3. Upload the `.aab` to Play Console internal testing.
4. Complete Play Console policy forms.
5. Test from the Play Store internal testing link.
6. Promote to production after testing.
