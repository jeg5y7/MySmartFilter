#!/bin/bash

echo "Starting DNS propagation monitoring..."
echo "Checking every 5 minutes. Press Ctrl+C to stop."
echo ""

while true; do
    clear
    echo "================================================"
    echo "DNS Propagation Check - $(date)"
    echo "================================================"
    echo ""
    
    # Check SPF
    echo "Checking SPF record..."
    SPF=$(dig TXT mysmartfilter.com @8.8.8.8 +short | grep "spf1.*resend")
    if [[ ! -z "$SPF" ]]; then
        echo "✅ SPF: $SPF"
    else
        echo "⏳ SPF: Not yet propagated"
    fi
    
    # Check DKIM
    echo "Checking DKIM record..."
    DKIM=$(dig TXT resend._domainkey.mysmartfilter.com @8.8.8.8 +short)
    if [[ $DKIM == *"DKIM1"* ]]; then
        echo "✅ DKIM: Found (${#DKIM} chars)"
    else
        echo "⏳ DKIM: Not yet propagated"
    fi
    
    # Check CNAME
    echo "Checking CNAME record..."
    CNAME=$(dig CNAME resend.mysmartfilter.com @8.8.8.8 +short)
    if [[ $CNAME == *"feedback-smtp"* ]]; then
        echo "✅ CNAME: $CNAME"
    else
        echo "⏳ CNAME: Not yet propagated"
    fi
    
    echo ""
    echo "Next check in 5 minutes..."
    echo "Press Ctrl+C to stop monitoring"
    
    # If all records are found, alert the user
    if [[ ! -z "$SPF" ]] && [[ $DKIM == *"DKIM1"* ]] && [[ $CNAME == *"feedback-smtp"* ]]; then
        echo ""
        echo "🎉 ALL RECORDS HAVE PROPAGATED!"
        echo "You can now verify your domain at: https://resend.com/domains"
        break
    fi
    
    sleep 300  # Wait 5 minutes
done
