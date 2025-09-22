#!/bin/bash

echo "================================================"
echo "Checking DNS Records for mysmartfilter.com"
echo "================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check SPF record
echo "1. Checking SPF Record (TXT @ root domain)..."
SPF=$(dig TXT mysmartfilter.com +short | grep "v=spf1")
if [[ $SPF == *"include:_spf.resend.com"* ]]; then
    echo -e "${GREEN}✓ SPF Record Found:${NC} $SPF"
else
    echo -e "${RED}✗ SPF Record NOT Found${NC}"
    echo "   Expected: v=spf1 include:_spf.resend.com ~all"
fi
echo ""

# Check DKIM record
echo "2. Checking DKIM Record (TXT at resend._domainkey)..."
DKIM=$(dig TXT resend._domainkey.mysmartfilter.com +short)
if [[ $DKIM == *"v=DKIM1"* ]]; then
    echo -e "${GREEN}✓ DKIM Record Found:${NC}"
    echo "   ${DKIM:0:60}..."
else
    echo -e "${RED}✗ DKIM Record NOT Found${NC}"
    echo "   Expected: v=DKIM1; k=rsa; p=... (long key from Resend)"
fi
echo ""

# Check CNAME record
echo "3. Checking Return-Path Record (CNAME at resend)..."
CNAME=$(dig CNAME resend.mysmartfilter.com +short)
if [[ $CNAME == *"feedback-smtp.resend.com"* ]]; then
    echo -e "${GREEN}✓ CNAME Record Found:${NC} $CNAME"
else
    echo -e "${RED}✗ CNAME Record NOT Found${NC}"
    echo "   Expected: feedback-smtp.resend.com"
fi
echo ""

# Check with Google DNS for propagation
echo "================================================"
echo "Checking DNS Propagation (via Google DNS)..."
echo "================================================"
echo ""

SPF_GOOGLE=$(dig TXT mysmartfilter.com @8.8.8.8 +short | grep "v=spf1")
DKIM_GOOGLE=$(dig TXT resend._domainkey.mysmartfilter.com @8.8.8.8 +short)
CNAME_GOOGLE=$(dig CNAME resend.mysmartfilter.com @8.8.8.8 +short)

if [[ $SPF_GOOGLE == *"include:_spf.resend.com"* ]] && [[ $DKIM_GOOGLE == *"v=DKIM1"* ]] && [[ $CNAME_GOOGLE == *"feedback-smtp.resend.com"* ]]; then
    echo -e "${GREEN}✓ All DNS records have propagated globally!${NC}"
    echo ""
    echo "You can now verify your domain in Resend:"
    echo "https://resend.com/domains"
else
    echo -e "${RED}⚠ DNS records are still propagating...${NC}"
    echo "This can take 1-4 hours (sometimes up to 24 hours)"
    echo "Run this script again in 30 minutes to check"
fi
echo ""

echo "================================================"
echo "Next Steps:"
echo "================================================"
echo "1. If all records show ✓, go to https://resend.com/domains"
echo "2. Click 'Verify DNS Records' for your domain"
echo "3. If verification fails, wait 30 more minutes and try again"
echo ""
