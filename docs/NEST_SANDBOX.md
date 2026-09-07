# Google Nest sandbox setup (founder, one time, ~20 minutes)

The app side is fully built: OAuth connect/callback routes, encrypted token
storage, a 5-minute humidity poller that rides along with sensor ingestion,
and a "Google Nest" card on Settings → Integrations. It stays invisible until
the three environment variables at the bottom exist. Everything below happens
in the browser on Google's side.

Use your regular **personal Gmail account** for all of it (Google requires a
consumer account, not a Workspace one, and it can't be changed later).

## 1. Create a Google Cloud project (free)

1. Go to https://console.cloud.google.com/projectcreate — name it
   `mysmartfilter-nest`, click **Create**.
2. In the search bar at the top, type **Smart Device Management API**, open
   it, click **Enable**. (This just switches the API on for your project.)

## 2. Create the OAuth client (what our site uses to ask permission)

1. Go to https://console.cloud.google.com/apis/credentials/consent —
   choose **External**, fill in only the required fields (app name
   `MySmartFilter`, your email twice), **Save and continue** through the
   rest. Add yourself under **Test users**.
2. Go to https://console.cloud.google.com/apis/credentials → **Create
   credentials → OAuth client ID** → Application type **Web application**.
3. Name: `MySmartFilter web`. Under **Authorized redirect URIs** click
   **Add URI** and paste exactly:
   `https://www.mysmartfilter.com/api/nest/callback`
4. Click **Create**. A box shows a **Client ID** (ends in
   `.apps.googleusercontent.com`) and a **Client secret** — keep this tab
   open, you'll paste both into Vercel in step 4.

## 3. Register for Device Access ($5, one time)

1. Go to https://console.nest.google.com/device-access/ → **Get started** —
   accept the terms and pay the one-time $5 fee.
2. Click **Create project** — name it `MySmartFilter pilot`.
3. When it asks for an **OAuth client ID**, paste the Client ID from step 2.
4. Enable events can be skipped (we poll; no Pub/Sub needed).
5. The project page shows a **Project ID** (a UUID like
   `1e2f3a4b-…`). Copy it.

## 4. Add the three values in Vercel

1. Go to https://vercel.com → my-smart-filter project → **Settings →
   Environment Variables**, add these three (environment: Production):
   - `NEST_SDM_PROJECT_ID` — the Device Access Project ID from step 3
   - `NEST_OAUTH_CLIENT_ID` — the Client ID from step 2
   - `NEST_OAUTH_CLIENT_SECRET` — the Client secret from step 2
2. Redeploy (Deployments → ⋯ on the latest → Redeploy) so the app picks
   them up.

## 5. Connect your Nest

1. On mysmartfilter.com go to **Settings → Integrations** — a "Google Nest"
   card now appears. Click **Connect Google Nest**.
2. Google walks you through choosing your home and thermostat and granting
   access ("Allow MySmartFilter to see your thermostat"). Sign in with the
   same Google account your Nest lives on.
3. Back on the Integrations page you'll see live indoor humidity, indoor
   temp, and whether the system is heating/cooling. From then on a sample is
   stored about every 5 minutes whenever the monitor is reporting.

## Notes

- **Sandbox limits:** 25 users across 5 homes — pilot-only by design. The
  fleet answer is the Rev B humidity chip (see ROADMAP.md); commercial Nest
  certification is deliberately not a launch dependency.
- **Privacy/security:** read-only scope; we store the OAuth refresh token
  AES-256-GCM encrypted and never log it. Disconnect (Integrations page)
  deletes the token immediately.
- **Troubleshooting:** "Connection didn't complete" usually means the
  redirect URI in step 2.3 doesn't exactly match, or your Google account
  isn't listed as a Test user on the consent screen.
