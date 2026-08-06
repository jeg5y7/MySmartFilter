# Smart-home bridge — founder setup guide

The software side of "Works with Google Home / Alexa / SmartThings" is live:
an OAuth2 account-linking server plus one connector endpoint per platform.
What remains is creating the (free) developer accounts on each platform and
pasting in URLs + credentials. Each platform takes roughly an evening; all
three can be done independently, in any order.

## How it fits together

```
Google/Alexa/SmartThings app ──"link account"──▶ mysmartfilter.com/oauth/authorize
        (user clicks Allow; platform receives an access token)
Google  ──POST /api/bridge/google       (SYNC/QUERY intents)
Alexa   ──AWS Lambda──▶ GET /api/bridge/devices
SmartThings ──POST /api/bridge/smartthings  (discovery/state)
```

Tier rules carry through automatically: everyone gets live temperature,
online status, and battery; Filter AutoShip members also get filter health
(life % + clean/dirty/replace states).

## Step 0 — mint one OAuth client per platform

Run once per platform (from the repo, with `DATABASE_URL` pointed at prod),
substituting the platform's redirect URI (each platform shows you theirs
during setup):

```bash
npx tsx scripts/create-oauth-client.ts "Google Home" <google-redirect-uri>
npx tsx scripts/create-oauth-client.ts "Alexa" <alexa-redirect-uri-1> <uri-2> <uri-3>
npx tsx scripts/create-oauth-client.ts "SmartThings" <smartthings-redirect-uri>
```

Copy the printed `client_id` / `client_secret` into the platform console.
The secret is shown once and only a hash is stored. Every platform gets the
same two URLs:

- **Authorization URL:** `https://www.mysmartfilter.com/oauth/authorize`
- **Token URL:** `https://www.mysmartfilter.com/api/oauth/token`

## Google Home (cloud-to-cloud)

1. [console.home.google.com](https://console.home.google.com) → create a
   project → "Cloud-to-cloud" integration.
2. Fulfillment URL: `https://www.mysmartfilter.com/api/bridge/google`
3. Account linking: OAuth authorization code; paste the URLs above + the
   client credentials from Step 0 (Google shows its redirect URI — use it
   when minting the client).
4. Test with your own Google account ("Test" in the console), then request
   certification when ready to launch publicly.

## Alexa (Smart Home Skill)

Alexa requires the skill logic to run in AWS Lambda (their rule, not ours) —
the function is already written at `integrations/alexa/lambda/index.mjs`.

1. [developer.amazon.com/alexa](https://developer.amazon.com/alexa) → create
   a **Smart Home** skill.
2. [AWS Lambda](https://console.aws.amazon.com/lambda) → create function,
   Node.js 20.x, paste `index.mjs` (no dependencies), add the "Alexa Smart
   Home" trigger with your skill ID.
3. Put the Lambda ARN into the skill's endpoint config.
4. Account linking: auth-code grant, the two URLs above + Step-0
   credentials (Alexa lists three redirect URLs — pass all three when
   minting the client).
5. Enable the skill on your own Alexa account to test discovery.

## SmartThings (ST Schema)

1. [smartthings.developer.samsung.com](https://smartthings.developer.samsung.com)
   → Developer Workspace → new project → "Device Integration" →
   **SmartThings Schema**.
2. Webhook endpoint: `https://www.mysmartfilter.com/api/bridge/smartthings`
3. Account linking: the two URLs + Step-0 credentials.
4. Device capabilities to declare in the device profile: Filter Status,
   Temperature Measurement, Battery, Health Check.
5. Test via the SmartThings app's "My Testing Devices".

## What's deferred (by design)

- **Proactive state push** (Google Report State / Alexa proactive events /
  ST callbacks): connectors currently answer when polled, which all three
  platforms support. Push needs per-platform service credentials — wire it
  up during certification if required.
- **"Works with" certification** for public listing — each platform's
  console has a submission flow; do this after pilot hardware exists.

## Troubleshooting

- "Can't link accounts" on the consent screen → redirect URI mismatch: the
  URI the platform sent isn't in the client's allowlist. Re-mint the client
  with the exact URI shown in the platform console.
- Token endpoint 401 → wrong client_id/secret pasted into the platform.
- Devices missing filter health → that account isn't a Filter AutoShip
  member; live sensors still work (this is the tier model working).
