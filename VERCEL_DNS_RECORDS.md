# DNS Records to Add in Vercel Dashboard

## Go to: https://vercel.com/dashboard/domains/mysmartfilter.com

Click on your domain, then add these records:

### 1. SPF Record (TXT)
- **Name/Host:** @ (or blank for root domain)
- **Type:** TXT
- **Value:** `v=spf1 include:_spf.resend.com ~all`
- **TTL:** 3600 (or Auto)

### 2. DKIM Record (TXT) 
- **Name/Host:** `resend._domainkey`
- **Type:** TXT
- **Value:** Get from Resend dashboard - should look like:
  ```
  v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC1Bf1X1GaSaXog8C4kQm60umCGnmMoF3ehpV3PmfMnJlc8
