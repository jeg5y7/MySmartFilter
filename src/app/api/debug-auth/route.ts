import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Check environment variables
    const envCheck = {
      hasResendKey: !!process.env.RESEND_API_KEY,
      resendKeyPrefix: process.env.RESEND_API_KEY?.substring(0, 8) + '...',
      hasEmailFrom: !!process.env.EMAIL_FROM,
      emailFromValue: process.env.EMAIL_FROM,
      hasAuthSecret: !!process.env.AUTH_SECRET,
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      databaseUrlPrefix: process.env.DATABASE_URL?.substring(0, 20) + '...',
      nodeEnv: process.env.NODE_ENV,
    };

    // Try database connection separately
    let dbStatus = 'unknown';
    let userCount = 0;
    let verificationTokenCount = 0;
    
    try {
      // Only attempt database connection if we have a database URL
      if (process.env.DATABASE_URL) {
        const { db } = await import('~/server/db');
        await db.$queryRaw`SELECT 1 as test`;
        dbStatus = 'connected';
        
        userCount = await db.user.count();
        verificationTokenCount = await db.verificationToken.count();
      } else {
        dbStatus = 'no DATABASE_URL';
      }
    } catch (error) {
      dbStatus = `error: ${error instanceof Error ? error.message : 'unknown error'}`;
    }

    return NextResponse.json({
      environment: envCheck,
      database: {
        status: dbStatus,
        userCount,
        verificationTokenCount,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
