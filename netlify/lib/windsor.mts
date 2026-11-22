// Calls the Windsor.ai Connectors API with the key stored in WINDSOR_API_KEY.
const ALLOWED = new Set(["searchconsole", "googleanalytics4", "google_ads"])

export type WindsorQuery = {
  connector: string
  fields: string[]
  date_from?: string
  date_to?: string
  date_preset?: string
  filters?: unknown[]
  accounts?: string[]
}

export async function windsorGetData(q: WindsorQuery): Promise<Record<string, unknown>[]> {
  const key = Netlify.env.get("WINDSOR_API_KEY")
  if (!key) throw new Error("WINDSOR_API_KEY is not set on Netlify.")
  if (!ALLOWED.has(q.connector)) throw new Error(`Unknown connector "${q.connector}"`)
  if (!Array.isArray(q.fields) || !q.fields.length) throw new Error("fields is required")
  const url = new URL(`https://connectors.windsor.ai/${q.connector}`)
  url.searchParams.set("api_key", key)
  url.searchParams.set("fields", q.fields.join(","))
  if (q.date_from) url.searchParams.set("date_from", q.date_from)
  if (q.date_to) url.searchParams.set("date_to", q.date_to)
  if (q.date_preset && !q.date_from) url.searchParams.set("date_preset", q.date_preset)
  if (q.filters && q.filters.length) url.searchParams.set("filter", JSON.stringify(q.filters))
  if (q.accounts && q.accounts.length) url.searchParams.set("select_accounts", q.accounts.join(","))

  const res = await fetch(url, { headers: { accept: "application/json" } })
  const text = await res.text()
  let body: any
  try { body = JSON.parse(text) } catch { body = text }
  if (!res.ok) {
    const msg = typeof body === "string" ? body : body?.error?.message || body?.error || body?.message || body?.detail || text
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg))
  }
  if (Array.isArray(body)) return body
  if (body && Array.isArray(body.data)) return body.data
  if (body && (body.error || body.message)) throw new Error(String(body.error?.message || body.error || body.message))
  throw new Error("Unexpected response from Windsor.ai: " + text.slice(0, 200))
}
