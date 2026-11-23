# Major Flexmat Marketing Dashboard

Password-protected marketing dashboard for majorflexmat.com, hosted on Netlify. It shows Google Search Console, Google Analytics 4, Google Ads, LinkedIn and YouTube data (through Windsor.ai) and has a chat panel for asking questions about the data.

## Structure

- `public/index.html`: the dashboard page (charts, tables, chat)
- `netlify/functions/data.mts`: `/api/data`, fetches rows from the Windsor.ai Connectors API
- `netlify/functions/chat.mts`: `/api/chat`, one Claude turn per request (the browser runs the tool loop)
- `netlify/lib/`: shared password check and Windsor.ai client

## Environment variables (Netlify → Project configuration → Environment variables, scope: Functions)

| Variable | Purpose |
|---|---|
| `WINDSOR_API_KEY` | Windsor.ai API key (required for data) |
| `DASHBOARD_PASSWORD` | Password visitors enter to open the dashboard |
| `ANTHROPIC_API_KEY` | Optional. Only needed if Netlify AI Gateway isn't available on your plan |
| `CHAT_MODEL` | Optional. Overrides the default Claude model |

No secrets are stored in this repository.
