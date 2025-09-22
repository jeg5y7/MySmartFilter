# Resend DNS Setup for mysmartfilter.com (Squarespace)

## Required DNS Records

You need to add these DNS records in your Squarespace domain settings to verify your domain with Resend and enable email sending.

### Steps to Add DNS Records in Squarespace:

1. **Log in to Squarespace**
   - Go to your Squarespace account
   - Navigate to Settings → Domains → mysmartfilter.com
   - Click on "DNS Settings" or "Advanced Settings"

2. **Get Your DNS Records from Resend**
   - Go to https://resend.com/domains
   - Click on "Add Domain" if you haven't already
   - Enter: `mysmartfilter.com`
   - Resend will show you 3 records you need to add:

### The 3 DNS Records You Need:

#### 1. SPF Record (TXT)
- **Type:** TXT
- **Host/Name:** @ (or leave blank for root domain)
- **Value:** `v=spf1 include:_spf.resend.com ~all`
- **TTL:** 3600 (or default)

#### 2. DKIM Record (TXT)
- **Type:** TXT  
- **Host/Name:** `resend._domainkey`
- **Value:** (This will be a long string starting with `v=DKIM1; k=rsa; p=...` - copy from Resend dashboard)
- **TTL:** 3600 (or default)

#### 3. Return-Path Record (CNAME)
- **Type:** CNAME
- **Host/Name:** `resend`
- **Value:** `feedback-smtp.resend.com`
- **TTL:** 3600 (or default)

### Adding Records in Squarespace:

1. In Squarespace DNS settings, click "Add Record" for each record
2. Select the appropriate record type (TXT or CNAME)
3. Enter the host/name and value exactly as shown
4. Save each record

### Important Notes for Squarespace:

- **For TXT records**: Squarespace might automatically add quotes around the value - this is normal
- **For the @ symbol**: In Squarespace, use @ or leave the host field blank for the root domain
- **DKIM Host**: Enter exactly `resend._domainkey` (including the dot)
- **Propagation**: DNS changes can take 24-48 hours to fully propagate, but usually work within 1-4 hours

### Verify in Resend:

After adding all records:
1. Go back to https://resend.com/domains
2. Click "Verify DNS Records" for your domain
3. If verification fails, wait 30 minutes and try again (DNS propagation)

### Troubleshooting:

If verification still fails after a few hours:
- Double-check there are no extra spaces in the DNS values
- Ensure the DKIM record was copied completely (it's very long)
- Check if Squarespace added quotes automatically (this is fine)
- Try removing and re-adding the records

### Alternative for Testing:

While waiting for DNS propagation, you can temporarily use:
```
EMAIL_FROM="onboarding@resend.dev"
```
This is Resend's test domain that works immediately without DNS setup.

## Current Status:
- ❌ SPF Failed - Add the SPF TXT record
- ❌ DKIM Failed - Add the DKIM TXT record
- Domain: mysmartfilter.com
- Email: noreply@mysmartfilter.com
