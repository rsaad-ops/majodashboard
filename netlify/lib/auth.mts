// Shared password check. The password lives in the DASHBOARD_PASSWORD env var.
import { timingSafeEqual } from "node:crypto"

export function checkPassword(req: Request): Response | null {
  const expected = Netlify.env.get("DASHBOARD_PASSWORD")
  if (!expected) return Response.json({ error: "DASHBOARD_PASSWORD is not set on Netlify." }, { status: 500 })
  const given = req.headers.get("x-dashboard-password") ?? ""
  const a = Buffer.from(given), b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return Response.json({ error: "unauthorized" }, { status: 401 })
  return null
}
