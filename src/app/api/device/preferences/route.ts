import { NextResponse } from "next/server";
import { auth } from "~/server/auth";
import { db } from "~/server/db";

interface PreferenceRequest {
  deviceId: string;
  filterProductId: string;
  autoOrderEnabled: boolean;
}

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as PreferenceRequest;
    const { deviceId, filterProductId, autoOrderEnabled } = body;

    if (!deviceId || !filterProductId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Verify device belongs to user
    const device = await db.device.findFirst({
      where: {
        id: deviceId,
        userId: session.user.id,
      },
    });

    if (!device) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }

    // Verify filter product exists
    const filterProduct = await db.filterProduct.findUnique({
      where: { id: filterProductId },
    });

    if (!filterProduct) {
      return NextResponse.json(
        { error: "Filter product not found" },
        { status: 404 }
      );
    }

    // Upsert the preference
    const preference = await db.userFilterPreference.upsert({
      where: {
        userId_deviceId: {
          userId: session.user.id,
          deviceId: device.id,
        },
      },
      update: {
        filterProductId,
        autoOrderEnabled,
      },
      create: {
        userId: session.user.id,
        deviceId: device.id,
        filterProductId,
        autoOrderEnabled,
      },
    });

    return NextResponse.json({
      success: true,
      preference: {
        id: preference.id,
        filterProductId: preference.filterProductId,
        autoOrderEnabled: preference.autoOrderEnabled,
      },
    });
  } catch (error) {
    console.error("Preference update error:", error);
    return NextResponse.json(
      { error: "Failed to update preferences" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const deviceId = url.searchParams.get("deviceId");

    if (!deviceId) {
      return NextResponse.json(
        { error: "Missing deviceId parameter" },
        { status: 400 }
      );
    }

    const preference = await db.userFilterPreference.findFirst({
      where: {
        userId: session.user.id,
        deviceId,
      },
      include: {
        filterProduct: true,
      },
    });

    return NextResponse.json({ preference });
  } catch (error) {
    console.error("Preference fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch preferences" },
      { status: 500 }
    );
  }
}
