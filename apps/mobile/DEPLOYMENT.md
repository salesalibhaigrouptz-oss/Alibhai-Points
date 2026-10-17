# Android production release

## EAS environment variables

Create separate values in **Expo dashboard → Project → Environment variables**
for each EAS environment named `development`, `preview`, and `production`.
Initially use the same backend and Supabase project in all three environments;
the separate entries let Preview move to staging later.

Required in all three environments:

- `EXPO_PUBLIC_API_URL` — HTTPS production Vercel API URL.
- `EXPO_PUBLIC_SUPABASE_URL` — HTTPS Supabase project URL.
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon/publishable key only.
- `EXPO_PUBLIC_AUTH_EMAIL_DOMAIN` — auth email domain used by the API.

Optional in each environment:

- `EXPO_PUBLIC_AUTH_MODE` — `pin` or `whatsapp_otp`; keep it aligned with the
  authentication flow enabled for the backend. It defaults to `pin`.
- `EXPO_PUBLIC_PRIVACY_POLICY_URL` — HTTPS policy URL. The Profile link stays
  hidden until set.
- `EXPO_PUBLIC_ACCOUNT_DELETION_URL` — HTTPS page explaining how to request
  account deletion. Its Profile link stays hidden until set.

All `EXPO_PUBLIC_` values are embedded in the app and are public. Never set a
service-role key, Supabase secret key, or other secret as an Expo public
variable. The app config rejects `sb_secret_` keys, legacy JWT keys with the
`service_role` claim, and non-HTTPS URLs.

The `development`, `preview`, and `production` build profiles select the
matching EAS environment in `eas.json`.

## Running locally

Start the API from `apps/api` after filling its ignored `.env` with the
required Supabase values, then start Expo from `apps/mobile`. For the mobile
`.env`, point `EXPO_PUBLIC_API_URL` at the local API:

- `http://localhost:5000` for web on the development computer or the iOS
  simulator.
- `http://10.0.2.2:5000` for the Android emulator.
- `http://<computer-LAN-IP>:5000` for a physical phone on the same network.

Local/private-network HTTP API URLs are accepted only in development. Keep
Supabase and production API URLs on HTTPS. A physical Android device using a
custom development build may require HTTPS (for example, a secure tunnel)
because Android cleartext traffic is disabled in the app configuration.

## Build commands

Install the EAS CLI once if it is not already installed:

```sh
npm install --global eas-cli
```

Then run these commands in order:

```sh
eas login
cd apps/mobile
eas build:configure
eas build --platform android --profile preview
eas build --platform android --profile production
```

The Preview profile builds an internal-install APK for testing. Production
builds an Android App Bundle (`.aab`).

Android is configured to compile and target API 36, with cleartext HTTP
disabled and only the Internet permission allowed.

## Uploading the production AAB

Download the Production `.aab` from the completed EAS build page. In Google
Play Console, create the app if necessary, open a testing or production track,
create a release, upload the `.aab`, complete the release checklist, and submit
it for review.

Google Play App Signing is required for Play distribution. Enroll in Play App
Signing when prompted. EAS creates and manages the upload key used to upload
the bundle; Google Play stores and uses the app-signing key for installs and
updates. Keep the EAS upload credentials backed up and do not replace the
upload key without following Play Console's key-reset process.

Alternatively, configure a Play service account in EAS Submit and run
`eas submit --platform android --latest` after the Production build. The first
submission still needs the Play Console app setup and Play App Signing
enrollment.

## Web app / iPhone Safari PWA

Deploy the same Expo app as a separate static Vercel project:

| Vercel setting | Value |
| --- | --- |
| Root Directory | `apps/mobile` |
| Framework Preset | Other |
| Build Command | `npx expo export --platform web` |
| Output Directory | `dist` |
| Install Command | `npm install` |

`web.output` is configured as `single`; `vercel.json` rewrites app routes to
`index.html`. The PWA manifest, service worker, and generated icons are in
`public/`. The service worker only caches the app shell and its static Expo
assets; it explicitly bypasses `/api/` and does not cache API responses.

Add these values to the Vercel project's Production (and Preview, if used)
environment:

- `EXPO_PUBLIC_API_URL` — the same HTTPS production Vercel API URL as mobile.
- `EXPO_PUBLIC_SUPABASE_URL` — the same HTTPS Supabase project URL as mobile.
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — the same public anon/publishable key as
  mobile.
- `EXPO_PUBLIC_AUTH_EMAIL_DOMAIN` — the same auth email domain as mobile.
- `EXPO_PUBLIC_AUTH_MODE` — optional; set to the same `pin` or `whatsapp_otp`
  mode as mobile.
- `EXPO_PUBLIC_PRIVACY_POLICY_URL` — optional HTTPS policy page URL.
- `EXPO_PUBLIC_ACCOUNT_DELETION_URL` — optional HTTPS account-deletion page URL.

These are public client variables only. Never add a service-role key, Supabase
secret key, or other backend secret to Vercel's Expo build environment.

After deployment, add the exact website origin (scheme and hostname, without
any path) to the API's `CORS_ORIGINS`, for example
`https://points.example.com`. Redeploy the API after changing it. The browser
calls the API directly, so the production API must allow the final web origin.

Web-specific behavior:

- Safari shows a dismissible Add to Home Screen hint only on iOS Safari when
  the site is not already installed. Android and installed web apps do not show
  it.
- Browser CSV exports download a file; native apps continue to use the share
  sheet and app cache.
- Browser authentication tokens and Supabase sessions use `localStorage`.
  Native Android/iOS use SecureStore (and existing native AsyncStorage session
  values are migrated into SecureStore on first read). Browser storage is less
  protected than a device keychain; use HTTPS and avoid injecting untrusted
  scripts.
- Haptic feedback is not available in iPhone Safari. API requests and customer
  data require an internet connection; the service worker does not cache
  private or live API data.

### iPhone Safari release checklist

- [ ] Open the HTTPS Vercel URL in Safari and confirm the install hint appears.
- [ ] Sign up with a new test customer account.
- [ ] Log in and check the Points screen.
- [ ] Check that the last five transactions appear.
- [ ] Submit a redemption request.
- [ ] Log out and confirm the signed-out screen appears.
- [ ] In Safari, tap Share, then Add to Home Screen.
- [ ] Open Alibhai Points from the Home Screen and confirm the install hint is
      hidden.
- [ ] Close and reopen the installed app; confirm the session is restored.
- [ ] Test sign-out in the installed app and confirm the session is removed.

## Manual release checklist

- Confirm `com.alibhai.points` is the final Android application ID before the
  first Play upload; it cannot be changed for subsequent updates.
- Confirm the app icon and adaptive icon artwork match the approved brand.
- Set the four required public environment variables separately in all three
  EAS environments.
- Add the Privacy Policy URL and account-deletion request information URL when
  those pages are published.
- Confirm the `eas build:configure` project link and account ownership.
- Finish Play Console store listing, content rating, Data safety, testing, and
  release declarations.
- Confirm the Supabase `account_deletion_requests` table uses the documented
  columns and pending/done/rejected statuses.
