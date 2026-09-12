# Montraq

Live expense-tracking web app. Both the frontend and backend live in this
one working directory (not separate checkouts), even though they deploy
to different platforms and are conceptually separate services.

## Frontend (`frontend/`)

Plain multi-page HTML + vanilla JS. **Not React, not Next.js, no build step,
no bundler.** Pages are static HTML files served as-is.

Pages: `index.html`, `login.html`, `signup.html`, `forgot-password.html`,
`reset-password.html`, `dashboard.html`, `expenses.html`, `categories.html`,
`projects.html`, `budgets.html`, `reports.html`, `receipts.html`, `settings.html`.

JS: `js/api.js` (API client + JWT handling), `js/auth.js`, `js/dashboard.js`,
`js/theme.js`. Styles in `css/style.css` (plus `css/dashboard.css` for the
app shell). Chart rendering uses Chart.js + chartjs-plugin-datalabels, loaded
from cdn.jsdelivr.net via script tags in dashboard.html.

Deployed static on Vercel at mon-traq.vercel.app.

## Backend (`backend/`)

Node/Express API, hosted on Render, backed by real Postgres via the `pg`
driver (`backend/db/schema.js`) — not SQLite/sql.js (a stray comment in
`server.js` says "sql.js" but is wrong and should eventually be corrected).
API base used by the frontend: `https://ledgr-api-hdhe.onrender.com/api`.

Calendar-date columns (`DATE` type, e.g. `expenses.date`) need care: `pg`'s
default parser turns them into a JS `Date` at local-server-midnight, which
then serializes to a UTC timestamp — this silently shifts the calendar day
for any server timezone ahead of UTC. Fix in progress: override the type
parser for OID 1082 so `DATE` columns come back as plain `"YYYY-MM-DD"`
strings, and never run a calendar-date string through `new Date()` on the
frontend (no time component means no timezone, so it should be parsed as
plain text, not local time).

Security middleware already in place — do not treat these as missing:
- `helmet()` for security headers (`backend/server.js`)
- `express-rate-limit` via `backend/middleware/rateLimiter.js`
  (`authLimiter` on `/api/auth`, `apiLimiter` on `/api` generally)
- CORS locked to `process.env.FRONTEND_URL`, not left open

## Auth

Hand-rolled JWT, access + refresh tokens. Both are currently stored in
localStorage (`js/api.js`). Moving the refresh token to an httpOnly + Secure
+ SameSite cookie is a known, pending task — not yet started, and it touches
both repos, so it needs a written migration plan before any code changes.

## Deploy

Push to `main` → Vercel auto-deploys the frontend, typically live in under a
minute. Render handles the backend separately. Both watch this same GitHub
repo (`DemonKing112/Montraq`, formerly `Ledgr` — the remote was renamed).

## Known gaps — do not assume these work

- Receipt scanning: `backend/routes/receipts.js` is a stub. It always
  returns amount/vendor/date null with confidence 0. There is no OCR.
  The landing page currently markets it as working; that copy is being
  corrected.
- PDF export: does not exist. Only CSV export is implemented, despite the
  pricing table selling "CSV & PDF export" on the Pro tier.
- `formatDate()` is duplicated in three files (dashboard.js, expenses.js,
  reports.js) rather than shared. If you change date handling, change all
  three or none.

## Working agreement

The owner directs but does not write code. Explain a change in plain language
before making it. Work in small, independently verifiable steps — one item,
verify, then the next. After each change, say exactly how to check it in the
browser. Never commit or push without being asked first.
