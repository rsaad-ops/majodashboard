import type { Config } from "@netlify/functions"
import { checkPassword } from "../lib/auth.mts"
import { windsorGetData } from "../lib/windsor.mts"

export default async (req: Request) => {
  const denied = checkPassword(req)
  if (denied) return denied
  let q: any
  try { q = await req.json() } catch { return Response.json({ error: "Request body must be JSON." }, { status: 400 }) }
  try {
    const data = await windsorGetData(q)
    return Response.json({ status: "done", data })
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 })
  }
}

export const config: Config = { path: "/api/data", method: "POST" }
