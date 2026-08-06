# Alexa Smart Home Skill

Alexa smart-home skills must run through an AWS Lambda function (Amazon's
requirement). The function in `lambda/index.mjs` is the complete skill
backend: it translates Alexa directives into calls to the MySmartFilter
bridge API (`GET /api/bridge/devices`) using the account-linking token
Alexa supplies.

Setup steps (developer account, Lambda creation, account linking): see
`docs/smart-home-bridge.md` at the repo root.
