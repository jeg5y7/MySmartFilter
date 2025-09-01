import { type NextRequest, NextResponse } from "next/server";
import { auth } from "~/server/auth";

export async function GET(_request: NextRequest) {
  try {
    const session = await auth();

    console.log('[API/USER DEBUG] Session data:', {
      hasSession: !!session,
      hasUser: !!session?.user,
      userEmail: session?.user?.email,
      userId: session?.user?.id,
      fullSession: JSON.stringify(session)
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
      },
    });

  } catch (error) {
    console.error("Error fetching user data:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
