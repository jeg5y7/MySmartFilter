import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "~/server/auth";
import { db } from "~/server/db";

/**
 * Admin firmware-release management.
 * GET   — list releases (newest first)
 * POST  — create a release { version, binaryUrl, releaseNotes?, rolloutPct? }
 * PATCH — update a release { id, isActive?, rolloutPct? }
 */

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const me = await db.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });
  return me?.isAdmin ? session.user.id : null;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const releases = await db.firmwareRelease.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ releases });
}

const CreateSchema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+(-[\w.]+)?$/, "semver like 1.4.0"),
  binaryUrl: z.string().url().startsWith("https://"),
  releaseNotes: z.string().max(2000).optional(),
  rolloutPct: z.number().int().min(0).max(100).optional(),
});

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const parsed = CreateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const release = await db.firmwareRelease.create({
    data: {
      version: parsed.data.version,
      binaryUrl: parsed.data.binaryUrl,
      releaseNotes: parsed.data.releaseNotes,
      rolloutPct: parsed.data.rolloutPct ?? 1, // default: canary
    },
  });
  return NextResponse.json({ release });
}

const PatchSchema = z.object({
  id: z.string(),
  isActive: z.boolean().optional(),
  rolloutPct: z.number().int().min(0).max(100).optional(),
});

export async function PATCH(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const parsed = PatchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { id, ...data } = parsed.data;
  const release = await db.firmwareRelease.update({ where: { id }, data });
  return NextResponse.json({ release });
}
