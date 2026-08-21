# Vacancy Radar MCP

An MCP server for running a narrow, high-signal job search on LinkedIn.

LinkedIn's own search returns everything: open roles, people announcing they are
available, course ads, newsletter roundups, and the same staffing-agency repost
twenty times over. Vacancy Radar harvests posts for your search terms and then
**screens every one on the way into the database**, so what you browse is
employer vacancies in the markets you care about — and nothing else.

Everything runs locally. Posts live in a SQLite file on your machine, the browser
session is stored on disk, and no data leaves the computer.

---

## What it does

**Harvest** — Signs in to LinkedIn with Playwright, keeps the session, and
scrapes post results for a keyword query across as many pages as you ask for.

**Screen** — Each harvested post passes three gates before it is stored:

| Gate | Rejects |
| --- | --- |
| Relevance | Posts with no sign of an open role — commentary, roundups, course ads |
| Author | First-person job-seeker posts, and staffing-agency reposts |
| Market | Roles outside your allowed countries |

What survives arrives **unrated**, waiting for a verdict.

**Enrich** — Surviving posts get a **country** inferred from the post text and
any **pay** the post quotes, both normalised into their own columns.

**Triage** — A local React dashboard lists what got through. Rate each post
**Ok**, **Maybe** or **Not interested**; the rating colours the card's accent
rail, and a "Not interested" post dims until you hover it. Filter by verdict,
market, keyword, pay and application status, in light or dark theme.

---

## Screening rules

### Market allowlist

`src/intake/market-policy.ts` holds the list. Edit `ALLOWED_COUNTRIES` to change
which markets are accepted:

```ts
export const ALLOWED_COUNTRIES = [
  'France',
  'United Kingdom',
  'Remote (Europe)',
  'Remote (Worldwide)',
]
```

A post is accepted when it names **any** allowed market, and rejected when it
names countries and none of them is allowed. Posts whose location cannot be
inferred are accepted — plenty of real listings state no location, and treating
unknown as unwanted throws away real matches.

Naming an unwanted country is not on its own disqualifying. A Paris role that
mentions visa requirements for applicants from elsewhere is still a Paris role.

### Location detection

`src/intake/location.ts` recognises ~105 countries by name and by city, in
English, French, German, Spanish and Portuguese, plus bracketed ISO code lists
such as `Remote EU (CZ/EE/FI/PL/ES/SE)`.

An **explicit location line wins outright**. When a post says `📍 Location:
London, UK`, `Lieu : Paris`, or `Based in Lisbon`, that line decides the country
and the rest of the post is ignored. This matters: a post headed
`📍 Islamabad, Pakistan` that mentions London further down is an Islamabad role,
and taking the union of both would sneak it past a London-only filter.

Posts with no location line fall back to a scan of the whole text.

### Relevance and agency detection

`src/intake/relevance.ts`. Hiring intent is matched broadly, because plenty of
real listings never use the word "hiring" — `Lead Data Analyst opportunity at
HelloFresh in London` is a job post.

Agency detection uses two signals:

- **Wording** — `our client`, `on behalf of`, `confidential search`, `C2C`,
  `W2`, `Outside IR35`, `umbrella`, `cabinet de recrutement`
- **Author title** — Recruitment Consultant, Executive Recruiter, IT Recruiter,
  Headhunter, Talent Sourcer, Staffing

Titles that exist on both sides of the fence — plain "Recruiter", "Talent
Acquisition", "People Partner" — never trigger a rejection on their own, and
`Corporate Recruiter` is explicitly treated as in-house. An employer's own
recruiter is exactly who you want to hear from.

> **Contract roles are treated as agency.** `umbrella`, `Outside IR35` and `C2C`
> almost always mark a third-party contract. If you want contract work, remove
> those patterns from `AGENCY_BODY`.

### Compensation parsing

`src/intake/compensation.ts` classifies every currency figure by pay period and
keeps it only when the amount is plausible for that period. That is what
separates a `$2,000 welcome bonus` and `€12.50/day` meal vouchers from a real
salary, and what keeps `$100/hour` while rejecting a bare `$100`. Funding
rounds, ARR and follower counts are excluded by surrounding context.

Handles `$128,470 - $208,770`, `96k€`, `£75k-£115k`, `110000USD-135000USD`,
`USD 121125-163875/year`, `60,4K GBP/yr` (French decimal comma), `£830/day` and
`$7,000/month`, normalising each to a single readable string.

---

## Install

Requires Node 18+.

```bash
npm run setup     # installs server and viewer dependencies, plus Chromium
npm run build
```

Register the server with your MCP client:

```json
{
  "mcpServers": {
    "vacancy-radar": {
      "command": "node",
      "args": ["/absolute/path/to/vacancy-radar-mcp/build/main.js"],
      "cwd": "/absolute/path/to/vacancy-radar-mcp"
    }
  }
}
```

Restart the client, then ask it to authenticate. A browser window opens for you
to log in once; the session is saved locally after that.

---

## MCP tools

| Tool | Purpose |
| --- | --- |
| `linkedin_session` | Log in, check session status, clear stored credentials |
| `harvest_posts` | Harvest posts for a keyword query; reports how many were screened out and why |
| `vacancies` | Read, count or delete vacancies — filter by keyword, market, pay, verdict or application status |
| `dashboard_filters` | Drive the dashboard's filters from the conversation |
| `open_dashboard` / `close_dashboard` | Run the dashboard on `localhost:7391` |

`harvest_posts` reports its screening, so you can see what a query actually cost:

```
9 new posts added, 3 duplicates skipped, 12 rejected as outside allowed markets,
18 rejected as non-vacancy or agency posts
```

---

## Triage model

Each post carries one `verdict`: unrated, `yes` (Ok), `maybe`, or `no` (not
interested). Clicking the rating a post already holds clears it, so a mis-click
is undone with a second click rather than a fourth button.

`applied` is tracked separately — a verdict is what you think of the role, and
`applied` is whether you acted on it.

This replaced an earlier binary "saved" flag. The `saved` column is still in the
schema as the migration source — previously saved posts came through as `yes` —
but nothing reads or writes it now.

## Command line

```bash
npm run viewer      # dashboard on :7391, without going through MCP
npm run rederive    # recompute country and pay for stored posts
npm run seed        # import posts from a scraped JSON export
npm run typecheck
```

`npm run rederive -- --all` re-infers every row rather than only empty values —
use it after editing a detector.

The dashboard serves on port **7391**. Set `VACANCY_RADAR_PORT` to move it:

```bash
VACANCY_RADAR_PORT=9090 npm run viewer
```

When the MCP client launches the server, put it in that server's `env` block so
`open_dashboard` uses the same port.

---

## Layout

```
src/
  main.ts               MCP server: tool schemas and dispatch
  commands/             One module per MCP tool
  linkedin/
    session/            Playwright login and credential storage
    harvest/            Search crawler, URL building, post parsing
  intake/               The screening pipeline
    ingest.ts             Applies every gate, then writes
    relevance.ts          Vacancy vs commentary vs agency
    market-policy.ts      Country allowlist
    location.ts           Country inference
    compensation.ts       Pay parsing
  store/
    connection.ts       SQLite handle, schema, migrations
    posts-repository.ts Queries
  viewer/
    routes.ts           Dashboard HTTP API
    handlers.ts
    app/                React dashboard (separate Vite project)
  platform/             Paths and persisted view state
scripts/                Standalone maintenance scripts
```

Data lives in `~/.linkedin-mcp/`: `auth.json` for the session and
`resources/linkedin.db` for posts.

### A note on concurrency

The database is `sql.js`, which holds the whole file in memory and writes it back
wholesale. When two processes are running — the MCP server and the viewer — each
would otherwise serve a stale snapshot and overwrite the other's rows on its next
save. `store/connection.ts` fingerprints the file by size and mtime, reloads when
another process has written, and records its own saves so it does not reload
needlessly. Removing that check will silently lose data.

---

## Attribution

Derived from
[LinkedIn-Posts-Hunter-MCP-Server](https://github.com/kevin-weitgenant/LinkedIn-Posts-Hunter-MCP-Server)
by Kevin Weitgenant, used under the ISC licence.

This fork reorganises the codebase around the intake pipeline, adds the
relevance, agency and market screening described above, adds country and pay
inference, replaces the saved flag with a triage verdict, renames the MCP tools,
rebuilds the dashboard, and fixes the cross-process database clobbering.

Licensed ISC, as the original — see [LICENSE](LICENSE), which carries both
copyright lines.
