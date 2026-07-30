import { type NextRequest } from "next/server";
import { db } from "~/server/db";
import { rateLimit, clientIp, tooManyRequests } from "~/lib/rate-limit";

/**
 * GET /api/alert/cancel?token=...
 * One-click auto-order cancel from alert emails. The token is the auth —
 * no session needed, so it works from any mail client.
 */
export async function GET(request: NextRequest) {
  const rl = rateLimit(`cancel:${clientIp(request)}`, 10, 5 * 60 * 1000);
  if (!rl.ok) return tooManyRequests(rl);

  const token = request.nextUrl.searchParams.get("token");

  const page = (title: string, body: string, ok: boolean) =>
    new Response(
      `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${title} — MySmartFilter</title>
</head>
<body style="margin:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;">
  <div style="max-width:420px;margin:24px;background:#1e293b;border:1px solid #334155;border-radius:12px;padding:36px 32px;text-align:center;">
    <div style="font-size:40px;margin-bottom:12px;">${ok ? "✅" : "⚠️"}</div>
    <h1 style="color:#f1f5f9;font-size:20px;margin:0 0 10px;">${title}</h1>
    <p style="color:#94a3b8;font-size:14px;margin:0 0 24px;">${body}</p>
    <a href="https://mysmartfilter.com/dashboard"
       style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;padding:11px 26px;border-radius:8px;font-weight:600;font-size:14px;">
      Go to Dashboard
    </a>
  </div>
</body>
</html>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    );

  if (!token) {
    return page("Invalid link", "This cancellation link is missing its token.", false);
  }

  const alert = await db.filterAlert.findUnique({ where: { cancelToken: token } });

  if (!alert) {
    return page("Link not found", "This cancellation link is invalid or has expired.", false);
  }

  if (!["pending", "notified"].includes(alert.status)) {
    const already =
      alert.status === "dismissed"
        ? "This auto-order was already cancelled."
        : "This alert has already been resolved — the order may have been placed.";
    return page("Nothing to cancel", already, false);
  }

  await db.filterAlert.update({
    where: { id: alert.id },
    data: { status: "dismissed", resolvedAt: new Date() },
  });

  return page(
    "Auto-order cancelled",
    "No filter will be ordered for this alert. If the pressure stays high, you'll be alerted again after replacing the filter or adjusting settings.",
    true
  );
}
