import type { Config } from "@netlify/functions"
import Anthropic from "@anthropic-ai/sdk"
import { checkPassword } from "../lib/auth.mts"

// One model turn per request. The browser runs the tool loop (calling /api/data),
// so no single function call comes near the 60-second limit.

const TOOLS = [
  {
    name: "query_data",
    description:
      "Pull rows from Windsor.ai. Rows are aggregated by the dimension fields you request. Returns at most `limit` rows (default 50, max 300) after sorting by `sort_by` (descending unless sort_dir is 'asc'), plus total_rows.",
    input_schema: {
      type: "object" as const,
      properties: {
        connector: { type: "string", enum: ["searchconsole", "googleanalytics4", "google_ads", "linkedin_organic", "youtube"] },
        fields: { type: "array", items: { type: "string" } },
        accounts: { type: "array", items: { type: "string" }, description: "Optional account ids, e.g. a GA4 property id" },
        date_from: { type: "string", description: "YYYY-MM-DD" },
        date_to: { type: "string", description: "YYYY-MM-DD" },
        date_preset: { type: "string", description: "e.g. last_7d, last_28d, this_month. Use instead of date_from/date_to." },
        filters: { type: "array", items: {}, description: 'e.g. [["clicks","gt",10]] or [["query","contains","mat"]]' },
        sort_by: { type: "string" },
        sort_dir: { type: "string", enum: ["asc", "desc"] },
        limit: { type: "number" },
      },
      required: ["connector", "fields"],
    },
  },
]

function system(today: string, earliest: string) {
  return `You are a marketing analyst for Major Flexmat (majorflexmat.com), answering questions in a dashboard chat. Today is ${today}.
Data comes from Windsor.ai through the query_data tool. Connectors:
- "searchconsole": site sc-domain:majorflexmat.com. Fields: date, query, page, pagepath, device, country, clicks, impressions, ctr, position, branded_vs_nonbranded, search_appearance.
- "googleanalytics4": two properties, account id "372353886" = Major Flexmat, "362931656" = Portail. Pass accounts to pick one; default to Major Flexmat unless the user asks about Portail or both. Fields: date, sessions, totalusers, newusers, conversions (key events), engagement_rate, engaged_sessions, bounce_rate, average_session_duration, session_default_channel_group, source_medium, landing_page, page_path, pagetitle, screen_page_views, devicecategory, country, city, event_name, event_count, totalrevenue, transactions.
- "google_ads": account 941-336-1927 (Les industries fil métallique Major Ltée). Fields: date, campaign, spend, clicks, impressions, conversions.
- "linkedin_organic": the MAJOR® FLEX-MAT® company page. Daily page fields: date, account_analytics_impression_count, account_analytics_click_count, account_analytics_like_count, account_analytics_comment_count, account_analytics_share_count, account_analytics_total_engagements, followers_gain_organic. Follower total: organization_follower_count. Per-post fields: share_text, share_title, share_published_time, share_post_type, share_url, share_impression_count, share_clicks_count, share_like_count, share_comment_count, share_total_engagements, share_engagement_rate, share_video_views. Follower breakdowns: country_follower_name + country_follower_counts, industry_follower_type + industry_follower_counts, seniority_follower_type + seniority_follower_counts, function_follower_type + function_follower_counts. Posts are often bilingual (English/French); quote only a short snippet.
- "youtube": channel "Majorwire Industries". Fields: date, video, video_title, views, estimated_minutes_watched, average_view_duration, likes, comments, shares, subscribers_gained_channel, subscribers_lost_channel (use with date, not with video), traffic_source, country, device_type, subscriber_count, video_count, view_count (channel snapshot). YouTube Analytics lags about 3 days.
Rules:
- Always query before answering; never invent numbers.
- The Windsor.ai account may be on a trial that only returns the last 30 days (from ${earliest}). If a query fails for that reason, explain the limit, offer what fits inside it (for example last 14 days vs the 14 days before), and mention upgrading Windsor.ai.
- Search Console data lags about 2 days. For comparisons, pull the two periods separately with explicit dates.
- Use sort_by and limit so results stay small. ctr and engagement_rate are fractions (0.025 = 2.5%).
- If a source reports an expired sign-in or no configured accounts, say that source needs reconnecting in Windsor.ai and answer with the other data.
- Answer in the user's language. Be concise: lead with the answer, then a short markdown table or bullets with the key numbers, then one practical recommendation when useful. State the date range you used.`
}

export default async (req: Request) => {
  const denied = checkPassword(req)
  if (denied) return denied
  let body: any
  try { body = await req.json() } catch { return Response.json({ error: "Request body must be JSON." }, { status: 400 }) }
  const messages = Array.isArray(body?.messages) ? body.messages : null
  if (!messages || !messages.length) return Response.json({ error: "messages is required" }, { status: 400 })
  if (!Netlify.env.get("ANTHROPIC_API_KEY") && !Netlify.env.get("ANTHROPIC_BASE_URL"))
    return Response.json({ error: "Chat isn't set up: Netlify AI Gateway isn't active on this site and no ANTHROPIC_API_KEY is set." }, { status: 500 })

  const today = body.today || new Date().toISOString().slice(0, 10)
  const earliest = new Date(Date.parse(today) - 30 * 864e5).toISOString().slice(0, 10)
  try {
    const anthropic = new Anthropic()
    const msg = await anthropic.messages.create({
      model: Netlify.env.get("CHAT_MODEL") || "claude-sonnet-5-5",
      max_tokens: 2000,
      system: system(today, earliest),
      tools: TOOLS,
      messages,
    })
    return Response.json({ content: msg.content, stop_reason: msg.stop_reason })
  } catch (e: any) {
    const status = e?.status && e.status >= 400 && e.status < 600 ? e.status : 500
    return Response.json({ error: e?.message || String(e) }, { status })
  }
}

export const config: Config = { path: "/api/chat", method: "POST" }
