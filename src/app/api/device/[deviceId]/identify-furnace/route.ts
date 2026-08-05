import { NextResponse } from "next/server";
// zod/v4 — the Anthropic SDK's zodOutputFormat helper requires zod v4 schemas
import { z } from "zod/v4";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { rateLimit, tooManyRequests } from "~/lib/rate-limit";

/**
 * POST /api/device/[deviceId]/identify-furnace
 *
 * Customer snaps a photo of their furnace's rating plate (nameplate); Claude
 * reads it and returns make/model plus a blower-type and airflow suggestion
 * so the HVAC settings form can auto-populate. Nothing is written to the DB
 * here — the client shows the extracted values for the user to review & save.
 */

const ALLOWED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

const RequestSchema = z.object({
  image: z.string().min(100).max(7_500_000), // base64, ≈5.5 MB binary cap
  mediaType: z.enum(ALLOWED_MEDIA_TYPES),
});

const FurnaceIdSchema = z.object({
  isHvacNameplate: z
    .boolean()
    .describe(
      "True only if the photo shows an HVAC furnace/air-handler rating plate or data sticker"
    ),
  make: z
    .string()
    .nullable()
    .describe("Manufacturer brand, e.g. 'Carrier', 'Trane', 'Goodman'"),
  model: z
    .string()
    .nullable()
    .describe("Model number exactly as printed, e.g. '59TP6B080V17'"),
  blowerTypeGuess: z
    .enum(["ecm", "psc", "unknown"])
    .describe(
      "ecm = variable-speed/ECM/X13 blower motor, psc = fixed-speed PSC motor; infer from model line, motor data, or wording on the plate"
    ),
  tonnage: z
    .number()
    .nullable()
    .describe(
      "Cooling capacity in tons if determinable (e.g. 3 for 36,000 BTU/hr); null if not shown"
    ),
  airflowCfmEstimate: z
    .number()
    .nullable()
    .describe(
      "Suggested system airflow in CFM. Use printed CFM if present, else tonnage × 400, else null"
    ),
  confidence: z
    .enum(["high", "medium", "low"])
    .describe("Overall confidence in the make/model reading"),
  notes: z
    .string()
    .nullable()
    .describe(
      "One short plain-language sentence for the customer, e.g. what was hard to read or why a field is empty"
    ),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Vision calls cost real money — keep a per-user lid on it
    const rl = rateLimit(`identify-furnace:${session.user.id}`, 10, 60 * 60 * 1000);
    if (!rl.ok) return tooManyRequests(rl);

    const { deviceId } = await params;
    const device = await db.device.findFirst({
      where: { id: deviceId, userId: session.user.id },
      select: { id: true },
    });
    if (!device) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        {
          error:
            "Photo identification isn't configured yet — enter your furnace details manually for now.",
        },
        { status: 503 }
      );
    }

    const parsed = RequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Send a JPEG, PNG, or WebP photo under 5 MB." },
        { status: 400 }
      );
    }
    const { image, mediaType } = parsed.data;

    const client = new Anthropic();
    const response = await client.messages.parse({
      model: "claude-opus-5",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: image },
            },
            {
              type: "text",
              text:
                "This should be a photo of a residential furnace or air-handler " +
                "rating plate / data sticker (often inside the front panel or on " +
                "the cabinet). Extract the manufacturer and model number exactly " +
                "as printed, and infer blower motor type and airflow where the " +
                "plate supports it. If the photo is not an HVAC nameplate, say so " +
                "via isHvacNameplate and leave the fields null.",
            },
          ],
        },
      ],
      output_config: {
        format: zodOutputFormat(FurnaceIdSchema),
      },
    });

    const result = response.parsed_output;
    if (!result) {
      return NextResponse.json(
        { error: "Couldn't read the photo — try a closer, well-lit shot of the label." },
        { status: 422 }
      );
    }

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("[identify-furnace] failed:", error);
    return NextResponse.json(
      { error: "Photo identification failed — please try again." },
      { status: 500 }
    );
  }
}
