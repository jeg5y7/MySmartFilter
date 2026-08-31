import { resend, EMAIL_FROM } from "~/lib/resend";

/** Sent once when an account is created (NextAuth createUser event). */
export async function sendWelcomeEmail(to: string): Promise<void> {
  await resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject: "Welcome to MySmartFilter — let's get your sensor online",
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#faf8f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #eeebe4;">
    <div style="background:#faf8f5;padding:24px 32px;border-bottom:1px solid #eeebe4;">
      <p style="margin:0;color:#3e8a72;font-size:12px;text-transform:uppercase;letter-spacing:1px;">MySmartFilter</p>
      <h1 style="margin:8px 0 0;color:#1c1b18;font-size:22px;font-family:Georgia,'Times New Roman',serif;font-weight:400;">Welcome aboard 👋</h1>
    </div>
    <div style="padding:28px 32px;">
      <p style="color:#55524a;font-size:15px;margin-top:0;">
        Your account is ready. Here's the 3-step path to a filter that replaces itself:
      </p>
      <div style="background:#faf8f5;border:1px solid #eeebe4;border-radius:12px;padding:20px;margin:20px 0;">
        <p style="color:#55524a;font-size:14px;margin:0 0 12px;"><strong style="color:#3e8a72;">1.</strong> Pair your sensor — plug it in and follow the setup wizard.</p>
        <p style="color:#55524a;font-size:14px;margin:0 0 12px;"><strong style="color:#3e8a72;">2.</strong> Tell us about your system — blower type, size, and your electricity rate power the savings math.</p>
        <p style="color:#55524a;font-size:14px;margin:0;"><strong style="color:#3e8a72;">3.</strong> Pick your filter &amp; enable auto-order — we'll ship a replacement the moment a clogged filter starts costing you more than a new one.</p>
      </div>
      <div style="text-align:center;margin:28px 0;">
        <a href="https://mysmartfilter.com/setup"
           style="display:inline-block;background:#3e8a72;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:9999px;font-weight:600;font-size:15px;">
          Set Up My Device
        </a>
      </div>
      <p style="color:#8a867c;font-size:13px;margin-bottom:0;">
        Questions? Just reply to this email.
      </p>
    </div>
    <div style="background:#faf8f5;padding:20px 32px;border-top:1px solid #eeebe4;">
      <p style="margin:0;color:#8a867c;font-size:12px;text-align:center;">
        <a href="https://mysmartfilter.com/settings/notifications" style="color:#3e8a72;">Manage notification preferences</a>
      </p>
    </div>
  </div>
</body>
</html>`,
  });
}
