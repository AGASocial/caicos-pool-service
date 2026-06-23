# Cadenza Technician App (Expo)

Mobile app for pool service technicians. Built with Expo SDK 54, Expo Router, and Supabase.

## Local development

```bash
cd technician-app
npm install
cp .env.example .env.local   # add your Supabase URL + anon key
npx expo start
```

## App Store deployment (iOS)

### One-time setup

1. **Apple Developer Program** — enroll at [developer.apple.com](https://developer.apple.com) ($99/year).
2. **App Store Connect** — create an app with bundle ID `social.aga.cadenza`.
3. **EAS login** — `npm install -g eas-cli && eas login`
4. **EAS secrets** (required for production builds):

```bash
cd technician-app
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "https://YOUR_REF.supabase.co"
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "YOUR_ANON_KEY"
eas secret:list   # verify
```

5. **Supabase Auth** — add redirect URLs in Supabase Dashboard → Authentication → URL Configuration:
   - `cadenza:///(auth)/login`
   - Your Expo dev URL if testing password reset locally

6. **App Store Connect metadata** — prepare before submit:
   - Privacy policy URL: `https://cadenzaops.com/privacy.html`
   - Support URL / email: `info@cadenzaops.com`
   - Screenshots (6.7" iPhone required; iPad if supporting tablets)
   - Demo account credentials for App Review (technician with assigned jobs)

### Build for TestFlight

**First-time only:** set up Apple credentials interactively (requires your Mac terminal):

```bash
eas build --platform ios --profile production
# EAS will prompt for Apple Developer login and create certificates
```

Subsequent builds can use `--non-interactive`:

```bash
eas build --platform ios --profile preview
```

Install via the link EAS prints, or submit to TestFlight:

```bash
eas submit --platform ios --profile production --latest
```

On first submit, EAS prompts for Apple ID, team, and App Store Connect app — or add to `eas.json`:

```json
"submit": {
  "production": {
    "ios": {
      "appleId": "you@example.com",
      "ascAppId": "1234567890",
      "appleTeamId": "XXXXXXXXXX"
    }
  }
}
```

### Production App Store build

```bash
eas build --platform ios --profile production
eas submit --platform ios --profile production --latest
```

Then complete export compliance and review in App Store Connect.

### Invite-based registration

Technicians cannot self-register without a company invite. Admins generate invite links from the admin portal; links open the app as `cadenza://register?code=INVITE_CODE`.

## Web export (optional)

```bash
npx expo export --platform web
eas deploy --prod
```

## Bundle ID

`social.aga.cadenza` — must match App Store Connect and Apple Developer portal.

## EAS project

Owner: `agasocial` · Expo slug: **`cadenzaops`** · [@agasocial/cadenzaops](https://expo.dev/accounts/agasocial/projects/cadenzaops) · Project ID: `2f01234f-e107-460e-b09b-9c954e36b185`

Production/preview Supabase env vars are configured on EAS (`eas env:list --environment production`).
