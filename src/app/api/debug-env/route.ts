import { NextResponse } from "next/server";
import { Resend } from "resend";
import { db } from "~/server/db";

export async function GET() {
  const checks: any = {
    environment: process.env.NODE_ENV,
    vercel: process.env.VERCEL === "1",
    hasAuthSecret: !!process.env.AUTH_SECRET,
    authSecretLength: process.env.AUTH_SECRET?.length || 0,
    hasResendKey: !!process.env.RESEND_API_KEY,
    resendKeyLength: process.env.RESEND_API_KEY?.length || 0,
    resendKeyPrefix: process.env.RESEND_API_KEY?.substring(0, 7) || "missing",
    emailFrom: process.env.EMAIL_FROM || "not set",
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    databaseUrlPrefix: process.env.DATABASE_URL?.substring(0, 30) || "missing",
    nextAuthUrl: process.env.NEXTAUTH_URL || "auto-detected",
  };

  // Test database connection
  let dbStatus = "not tested";
  try {
    await db.$queryRaw`SELECT 1`;
    dbStatus = "connected";
    
    // Check if tables exist
    const userCount = await db.user.count();
    checks.userCount = userCount;
  } catch (error: any) {
    dbStatus = `error: ${error.message}`;
  }
  checks.database = dbStatus;

  // Test Resend
  let resendStatus = "not tested";
  if (process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      
      // Try to send a test email
      const { data, error } = await resend.emails.send({
        from: process.env.EMAIL_FROM || "onboarding@resend.dev",
        to: "jeg5y7@gmail.com",
        subject: "Debug Test from Production",
        html: `<p>This is a debug test email from your production deployment.</p>
               <p>Timestamp: ${new Date().toISOString()}</p>`
      });
      
      if (error) {
        resendStatus = `error: ${JSON.stringify(error)}`;
      } else {
        resendStatus = `email sent: ${data?.id}`;
      }
    } catch (error: any) {
      resendStatus = `exception: ${error.message}`;
    }
  } else {
    resendStatus = "no API key";
  }
  checks.resend = resendStatus;

  return NextResponse.json(checks, { status: 200 });
}
