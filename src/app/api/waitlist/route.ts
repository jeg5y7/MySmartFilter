import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "~/server/db";
import { rateLimit, clientIp, tooManyRequests } from "~/lib/rate-limit";
import { resend, EMAIL_FROM, escapeHtml } from "~/lib/resend";

const SignupSchema = z.object({
  email: z.string().email().max(254),
  name: z.string().trim().max(80).optional(),
  zip: z.string().trim().max(12).optional(),
  source: z.string().trim().max(40).optional(),
});

/** The table creates itself — no hand-run SQL in a console, ever again. */
async function ensureWaitlistTable() {
  await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "Waitlist" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "zip" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Waitlist_pkey" PRIMARY KEY ("id")
  )`);
  await db.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "Waitlist_email_key" ON "Waitlist"("email")`
  );
}

export async function POST(request: NextRequest) {
  const rl = rateLimit(`waitlist:${clientIp(request)}`, 5, 60 * 60 * 1000);
  if (!rl.ok) return tooManyRequests(rl);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = SignupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });
  }
  const { email, name, zip, source } = parsed.data;
  const normalized = email.toLowerCase();

  const create = async () => {
    const existing = await db.waitlist.findUnique({
      where: { email: normalized },
    });
    if (existing) return false; // already on the list — still a success
    await db.waitlist.create({
      data: { email: normalized, name, zip, source: source ?? "site" },
    });
    return true;
  };

  let isNew: boolean;
  try {
    isNew = await create();
  } catch (err) {
    // First signup ever: the table may not exist yet — create and retry
    try {
      await ensureWaitlistTable();
      isNew = await create();
    } catch (err2) {
      console.error("[waitlist] signup failed:", err2);
      return NextResponse.json(
        { error: "Something went wrong — try again" },
        { status: 500 }
      );
    }
  }

  if (isNew) {
    void sendWaitlistWelcome(normalized, name);
  }
  return NextResponse.json({ ok: true, already: !isNew });
}

async function sendWaitlistWelcome(email: string, name?: string) {
  try {
    const hi = name ? `Hi ${escapeHtml(name)},` : "Hi,";
    await resend.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject: "You're on the MySmartFilter launch list ✅",
      html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#faf8f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #eeebe4;">
    <div style="background:#faf8f5;padding:24px 32px;border-bottom:1px solid #eeebe4;">
      <p style="margin:0;color:#3e8a72;font-size:12px;text-transform:uppercase;letter-spacing:1px;">MySmartFilter</p>
      <h1 style="margin:8px 0 0;color:#1c1b18;font-size:22px;font-family:Georgia,'Times New Roman',serif;font-weight:400;">You're on the list 🎉</h1>
    </div>
    <div style="padding:28px 32px;">
      <p style="color:#55524a;font-size:15px;margin-top:0;">${hi}</p>
      <p style="color:#55524a;font-size:15px;">
        Thanks for joining the MySmartFilter launch list. We turn the filter you
        already use into a smart filter — the monitor shows you in real time
        exactly how dirty it is, and a fresh one ships itself only when
        replacing actually saves you money.
      </p>
      <p style="color:#55524a;font-size:15px;">
        We'll email you the moment monitors are available — launch-list members
        hear first and get first dibs on the initial batch.
      </p>
      <p style="color:#8a867c;font-size:13px;margin-bottom:0;">
        Didn't sign up? You can safely ignore this email — we won't write again
        unless you do.
      </p>
    </div>
  </div>
</body>
</html>`,
    });
  } catch (err) {
    console.error("[waitlist] welcome email failed:", err);
  }
}
