import { NextResponse } from "next/server";
import { auth } from "~/server/auth";
import { db } from "~/server/db";

// PATCH: Update alert status (dismiss or manual_ordered)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ alertId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { alertId } = await params;
    const body = (await request.json()) as { action?: string };
    const { action } = body;

    if (!action || !["dismiss", "manual_ordered"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be 'dismiss' or 'manual_ordered'" },
        { status: 400 }
      );
    }

    // Find alert and verify ownership
    const alert = await db.filterAlert.findFirst({
      where: {
        id: alertId,
        userId: session.user.id,
      },
      include: { device: true },
    });

    if (!alert) {
      return NextResponse.json(
        { error: "Alert not found" },
        { status: 404 }
      );
    }

    // Double-check device ownership
    if (alert.device.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    const newStatus = action === "dismiss" ? "dismissed" : "manual_ordered";

    const updated = await db.filterAlert.update({
      where: { id: alertId },
      data: {
        status: newStatus,
        resolvedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, alert: updated });
  } catch (error) {
    console.error("Error updating alert:", error);
    return NextResponse.json(
      { error: "Failed to update alert" },
      { status: 500 }
    );
  }
}
