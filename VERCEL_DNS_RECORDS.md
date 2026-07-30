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
- **Value:** copy the FULL value from the Resend dashboard. It is ~218
  characters, starts with `p=MIGf`, and must end with `IDAQAB`.
- **TTL:** 60

> ⚠️ **Incident note (2026-07-30):** this record was once pasted truncated
> (108 of 218 chars), which silently broke ALL outbound email — magic links,
> alerts, order confirmations — until Resend's domain check was investigated.
> After adding/editing this record, always confirm at
> https://resend.com/domains that the domain status is **Verified**, and check
> the resolved value ends in `IDAQAB`:
> `https://dns.google/resolve?name=resend._domainkey.mysmartfilter.com&type=TXT`

### 3. Verify
- In Resend → Domains → mysmartfilter.com → click **Verify DNS Records**
- All three records must show green before any email will send.
