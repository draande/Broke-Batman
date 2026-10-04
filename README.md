# Broke Batman

**Gotham isn't paying the bills.**

A private job-search command center with a dark, original vigilante-inspired identity. Track opportunities from saved posting to accepted offer, extract job information, schedule interviews and follow-ups, and measure your search using persisted history.

## Why I Built This

Even a masked vigilante needs an income. Broke Batman turns that premise into a practical product demonstrating full-stack engineering, relational data modeling, authorization, secure web extraction, historical analytics, and accessible product design. The humor stays in the margins; the workflow does the work. This independent project uses no official DC artwork, logos, or actor likenesses.

## Features

- Email/password registration, login, revocable sessions, logout, and isolated workspaces.
- Application CRUD with all 15 stages, salary ranges, job descriptions, dates, sources, skills, and contacts.
- Paginated cases table with sorting, search across descriptions/notes/contacts/skills, eight filters, bulk archive/restore/delete, and archived-case access.
- Persistent Kanban drag-and-drop, optimistic rollback, and a keyboard-accessible status selector on every card.
- Job analysis from copied text or public URLs: structured JobPosting JSON-LD first, normalized text second, editable review, explicit missing-field warnings.
- Duplicate warnings with existing-case links and an explicit save-anyway choice.
- Interviews with timezone display, meeting links, preparation notes, outcomes, editing, and removal.
- Follow-ups with overdue states and complete/reopen actions; application deadlines alongside upcoming missions.
- Editable personal notes, recruiter/contact records, and an append-only activity/status timeline.
- Dashboard, historical funnel, eight-week activity, source/company/status/work-mode breakdowns, response/interview/offer rates, response delay, and time between stages.
- Weekly targets, optional streaks, persistent Daylight Mode, Ctrl/Cmd+K command palette, and highlighted global search.
- CSV import with field mapping, validation, preview, per-row errors and duplicate handling; CSV export and complete JSON backup export.
- Private fictional demo workspaces, responsive mobile cards/navigation, accessible dialogs, reduced-motion support, skeletons, errors and notifications.

## Screenshots

Screenshots generated during local visual verification live in `docs/screenshots/`.

| View                   | Screenshot                       |
| ---------------------- | -------------------------------- |
| Desktop command center | `docs/screenshots/dashboard.png` |
| Cases                  | `docs/screenshots/cases.png`     |
| Intelligence           | `docs/screenshots/analytics.png` |
| Mobile dashboard       | `docs/screenshots/mobile.png`    |
| Daylight Mode          | `docs/screenshots/daylight.png`  |

## Stack and architecture

Next.js 16 App Router, React 19, TypeScript, PostgreSQL, Prisma 6, Zod, Radix accessible dialogs, Lucide icons, Recharts, bcrypt, and signed database-backed sessions. Custom CSS provides the visual system and responsive layouts without a large utility/component dependency. Vitest verifies domain logic and database integration; Playwright verifies full browser workflows. Charts load lazily. Public pages render on the server; the authenticated interactive workspace is hydrated after a server-side session check.

```text
src/app/                    Public pages, authenticated route, API dispatcher
src/components/             Feature UI and reusable accessible primitives
src/lib/                    Validation, analytics, duplicates, shared/client types
src/server/                 Authentication, repository, services, extraction, transfers
prisma/schema.prisma        Relational schema
prisma/migrations/          Committed PostgreSQL migration
prisma/seed.ts              Idempotent demo seeding
scripts/local-db.ts         Optional portable development PostgreSQL process
tests/                      Unit, PostgreSQL integration, browser flows
.github/workflows/ci.yml     Database-backed automated verification
Dockerfile / compose.yaml   Standalone production app and local PostgreSQL
```

### Database architecture

`User` owns `Application` and `Session`, with one `UserPreference`. `Status` is a lookup table with a label, ordering and funnel category, so the data model is extensible. Applications reference status and own `ApplicationStatusHistory`, `Activity`, `Interview`, `FollowUp`, `Contact`, and `Note`. Shared normalized `Skill` records connect through `ApplicationSkill` with required/preferred classification. `RateLimit` stores atomic rolling-window counters shared across app processes.

Indexes cover user/archive/creation, user/status, user/applied-date, and child ownership/time queries. User deletion cascades through private records. Application deletion intentionally removes its children; archive preserves them. Shared skills and statuses are retained. Status history and activity are appended on changes, never replaced by case edits.

## Local setup

Requires Node.js **22.12+** (Node 24 also works) and PostgreSQL. Use a UTF-8 database. The embedded runner is an optional development convenience, not a production database.

```sh
npm ci
cp .env.example .env
```

On PowerShell use `Copy-Item .env.example .env`. Set `SESSION_SECRET` to a random value of at least 32 characters. Generate one using `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Keep `.env` private.

Start PostgreSQL in a separate terminal:

```sh
# Option A: PostgreSQL container
docker compose up -d db

# Option B: workspace-local native PostgreSQL, no Docker required
npm run db:local
```

The embedded runner binds only `127.0.0.1:5432`, stores data under `.postgres/data`, and uses the development-only `batman` / `batman` credentials. Stop it with Ctrl+C. Do not run it if another database already occupies port 5432. It may need Windows process-launch permission. For this runner, use `127.0.0.1` in `DATABASE_URL` to avoid IPv6 localhost ambiguity.

```sh
npm run db:generate
npm run db:migrate
npm run dev
```

Visit **http://localhost:3000**, register, or choose **View Demo → Open a private demo workspace**. A demo creates an isolated user and 24 fictional cases; it is not shared fake frontend state. Existing data is never overwritten by demo creation.

### Environment variables

| Variable             | Purpose                                                                     |
| -------------------- | --------------------------------------------------------------------------- |
| `DATABASE_URL`       | PostgreSQL connection string; use TLS parameters required by your host      |
| `SESSION_SECRET`     | At least 32 random characters; server-only signing key                      |
| `APP_URL`            | Canonical browser origin used for mutation origin checks                    |
| `DEMO_ENABLED`       | Set `true` to explicitly allow public demo workspace creation in production |
| `DEMO_PASSWORD`      | Password of at least 12 characters used by the explicit seed command        |
| `EXTRACTION_API_URL` | Optional trusted OpenAI-compatible chat-completions endpoint                |
| `EXTRACTION_API_KEY` | Optional server-only provider key                                           |
| `EXTRACTION_MODEL`   | Optional provider model name                                                |
| `RUN_DB_TESTS`       | `true` to include integration tests against the configured database         |

The first three variables are validated server-side when authentication runs. Optional AI variables must all be supplied to enable the provider. The app works without them. Use a provider you trust; job-description text is transmitted only when you configure this integration. Google OAuth and password recovery are not included; authentication uses email/password.

### Demo seed and development reset

```sh
# Set a password in your shell first; do not commit it.
# PowerShell: $env:DEMO_PASSWORD='your-chosen-strong-password'
# Bash: export DEMO_PASSWORD='your-chosen-strong-password'
npm run db:seed
```

The seed command creates `bruce@demo.example` and 24 fictional applications across many stages. It preserves existing user data and does not change an existing demo password. The public demo button creates a separate account each time, so no password is needed to explore locally.

```sh
# DESTRUCTIVE: development database only. Prisma asks for confirmation.
npm run db:reset
# Set DEMO_PASSWORD before reset if you want its automatic seed to run.
```

For a new schema change, run `npx prisma migrate dev --name descriptive_change`, review the SQL, commit the migration, and use `npm run db:migrate` on deployments.

## Testing

```sh
npm run typecheck
npm run lint
npm test
# PowerShell: $env:RUN_DB_TESTS='true'; npm test
# Bash: RUN_DB_TESTS=true npm test
npx playwright install chromium
npm run test:e2e
npm run build
npm audit
```

Unit tests cover validation, analytics denominators/historical reach, extraction normalization and structured data, private-address rejection, duplicates, ownership predicates and CSV mapping. Integration tests create two temporary users, verify CRUD/status history/skill retention/interview persistence/ownership/cascades, then remove their test data. They skip unless `RUN_DB_TESTS=true`; a missing database fails rather than masquerading as a passing integration check.

The browser suite registers and logs in, analyzes pasted text, persists a case, changes status, schedules an interview and follow-up, tests cross-user object isolation and CSRF rejection, inspects analytics, exports CSV/JSON, searches via the command palette, toggles theme, imports a CSV, moves a Kanban case, checks blocked URL extraction, and verifies mobile width and logout. Browser accounts are fixture data; use a dedicated test database in CI. CI provisions PostgreSQL and executes all checks.

## API

All private routes derive user identity from the validated session cookie. Supplying a user ID in JSON never selects an owner. JSON mutations require an `Origin` header exactly matching `APP_URL`. Responses use 401 (session), 403 (origin), 404 (missing/other-owner object), 409 (duplicates), 422 (validation/extraction), 429 (rate limit), and 413 (payload limits).

| Routes                                             | Methods                                          |
| -------------------------------------------------- | ------------------------------------------------ |
| `/api/auth/register`, `/login`, `/demo`, `/logout` | POST (each under `/api/auth/`)                   |
| `/api/bootstrap`, `/api/analytics`                 | GET                                              |
| `/api/applications`                                | GET paginated/filterable, POST                   |
| `/api/applications/:id`                            | GET, PUT full case, PATCH status/archive, DELETE |
| `/api/applications/bulk`                           | POST archive/restore/delete up to 100 IDs        |
| `/api/applications/:id/interviews`                 | POST; `/:recordId` PUT/DELETE                    |
| `/api/applications/:id/follow-ups`                 | POST; `/:recordId` PUT complete/reopen, DELETE   |
| `/api/applications/:id/contacts`, `/notes`         | POST; `/:recordId` PUT/DELETE                    |
| `/api/extract`                                     | POST `{url}` or `{text}`                         |
| `/api/preferences`                                 | PUT                                              |
| `/api/import`                                      | POST `{csv,mapping,commit,allowDuplicate}`       |
| `/api/export?format=csv\|json`                     | GET attachment                                   |

Application list parameters: `q`, `page`, `pageSize` (maximum 100), `sort` (`company`, `position`, `createdAt`, `dateApplied`, `updatedAt`), `direction`, `statusId`, `company`, `location`, `workMode`, `employmentType`, `source`, `from`, `to`, `archived` (`false`, `true`, or `all`).

### Imports and backups

CSV requires company and position, with defaults for other fields. Column names can be mapped interactively; use an exported CSV as a template. Dates accept ISO timestamps or YYYY-MM-DD, skills use semicolons, and status fields use database IDs. All rows are validated before committing; rows then save independently. Duplicates and failed rows appear in the import report. Retry only failed rows to avoid repeated imports. Spreadsheet formula-like cells in exports receive a leading apostrophe, so exported text remains safe when opened in spreadsheets.

JSON is a **complete export**, including nested history and records. There is no JSON restore UI; CSV provides portable case import, while a database backup restores everything exactly. Preserve PostgreSQL backups in addition to exports.

### Extraction behavior

Public HTTP(S) URLs on ports 80/443 are allowed. Credentials in URLs, private/reserved IPv4 and IPv6 addresses, internal hostnames and redirects to private networks are rejected. Every connection pins a validated DNS address to prevent rebinding. Redirects, page bytes and request duration are bounded. JSON-LD is preferred; script/navigation/form boilerplate is removed. Content is rendered as escaped text, never injected HTML. Sites requiring JavaScript, cookies or anti-bot clearance may not be readable; the user receives a paste-text fallback. The heuristics are deliberately conservative: missing fields are identified, and every result requires review. Optional AI output is schema-validated, with transparent fallback on failure.

### Analytics definitions

Rates use cases with a `dateApplied`. Responses mean a recorded stage beyond Saved/Preparing/Applied, excluding Withdrawn and Ghosted. Interview and offer reach uses status history, so later rejection does not erase an interview. Response delay measures the first qualifying event after submission. Stage averages use time between preserved status events. “This week” and the target use a rolling seven-day window. Streak dates use the saved display timezone, with yesterday allowed as the current streak endpoint. Archived cases are excluded from dashboard analytics, retained in exports and searchable via archive filters.

## Docker and deployment

```sh
# Create .env with a strong SESSION_SECRET and APP_URL.
docker compose up -d db
# Run migrations from the host against the mapped database before starting web.
npm run db:generate
npm run db:migrate
docker compose up --build -d web
```

The multi-stage Dockerfile produces Next's standalone server, runs as a non-root user, and includes static assets. Docker is configured but was unavailable on the original Windows development machine, so its image build is not part of local verification. The optional native database runner is for development only.

For a managed deployment: provision PostgreSQL, set the environment variables, run `npm ci`, `npm run db:generate`, `npm run db:migrate`, and `npm run build`, then run `npm start` or deploy the standalone container. Use HTTPS in production (secure cookies require it), a strong database password, connection pooling appropriate to your host, database backups, and a reverse proxy request-size cap. Keep migrations in a release job using the same code version. Do not expose PostgreSQL to the public internet. Public demos are disabled by default; enable them intentionally and schedule demo cleanup.

## Security considerations and operational boundaries

- Bcrypt hashes passwords; signed sessions have random IDs, expire after seven days, and are checked in PostgreSQL on every authenticated request. Logout revokes the database session.
- Cookies are HttpOnly, SameSite=Lax, and Secure in production. Mutation origin validation prevents cross-site writes. No user-supplied owner ID is trusted.
- Prisma parameterizes queries. Resource and child mutations scope ownership on the server. Input schemas strip unrecognized fields. Case descriptions, notes and search highlights render through React text escaping.
- JSON bodies stream through a 1 MB bound; CSV is limited to 500 rows. URL fetching checks DNS, redirects and byte/time limits. No internal crawler bypass is provided for development.
- Security headers restrict framing, content types, origins and browser capabilities. Inline scripts/styles are permitted for framework hydration; a nonce-based CSP is a future hardening option. Unsafe eval is enabled only in development.
- Authentication, demo creation, extraction, and imports use database-backed rate limits. Configure additional edge/IP rate limiting for an internet deployment. Do not trust arbitrary forwarding headers as client identity.
- Database and provider credentials stay on the server. `.env`, native DB data, caches, and generated test output are ignored by source control.
- Schedule deletion of expired Session/RateLimit records and old anonymous demo users according to your retention policy. Deleting a demo User cascades its private records. Monitor database/storage growth and error rates.
- No outbound reminders/email, calendar sync, OAuth, or password-reset service is configured. Missions are visible in-app; meeting/mailto links open the user's chosen client.

## Future improvements

Optional OAuth and verified-email account recovery, calendar/notification integrations, user-defined stage editor, JSON restore with conflict handling, richer extraction fixtures for additional ATS providers, database aggregation for very large searches, full-text search indexes, narrower CSP with nonces, and user-controlled data retention.

See `docs/verification.md` for the checks performed on the local implementation.

## Batcomputer integrations and intelligence

This upgrade extends the existing case workflow. Gmail is optional and read-only. No code path sends mail or modifies messages. All detected status, interview, contact, and assessment changes remain pending until the owner approves them. Ambiguous matches require choosing a case. Approvals are atomic, ownership-scoped and recorded in the timeline with email evidence and confidence. Dismissals are retained as audit decisions.

### Google setup
1. Enable Gmail API in a Google Cloud project and create a Web Application OAuth client.
2. Register the exact redirect URI: `http://localhost:3000/api/gmail/oauth/callback` for local development (use your HTTPS APP_URL in production).
3. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GMAIL_TOKEN_KEY` in the private `.env`. Generate the encryption key with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Keep the key stable and back it up separately from the database.
4. Configure the Google consent screen/test users. The only requested scope is `https://www.googleapis.com/auth/gmail.readonly`; Google's publication requirements apply to that restricted scope.
5. Start the app and run `npm run mail:worker` in a separate terminal. Queue sync from Settings or Bat-Inbox. The database-backed queue processes 25 messages per page, checkpoints pagination, leases jobs, and retries temporary failures with bounded backoff. Production can run the same worker as a separate supervised process; the request handlers only enqueue jobs.

For credential-free testing: run `npm run mail:worker -- --demo-only`, then choose **Try fictional inbox demo** in Settings. This enforced mode cannot access Google. Five fictional messages demonstrate Google interviews, Stripe rejection, NVIDIA recruiting, Wayne Enterprises confirmation, and Cyberdyne assessments. Link messages to existing cases where automatic matching is uncertain. Demo messages are marked clearly and do not claim to be real mail.

The sync query examines job-search phrases from the last 90 days. The deterministic classifier discards unknown/unrelated messages. Stored data is limited to sender, subject, IDs, received/detected dates, a 240-character text excerpt, matching evidence and suggestions/decisions. Bodies are processed temporarily and HTML is converted to plain text; attachments are not imported. No email content is sent to an LLM. There is no mailbox mirror. Read the original in Gmail when reviewing a real message.

Tokens use AES-256-GCM authenticated encryption. OAuth attempts use random state, an encrypted PKCE verifier, a ten-minute expiry and one-time consumption bound to the signed-in owner. Redirect URLs are derived from configured APP_URL. Provider errors are mapped to safe messages without logging response bodies or tokens. Disconnect revokes the refresh token before clearing local credentials. Privacy controls can remove imported metadata and Gmail activity, or all job-search records, while retaining the login account. JSON export includes profile, preferences, inbox metadata, decisions and notifications, but excludes OAuth credentials and sessions.

Skills support canonical aliases and Learning/Familiar/Proficient/Strong proficiency. Case match scores show the 70/20/10 skill/experience/education breakdown and exclude unknown requirements. They describe a profile-to-posting comparison, never hiring probability. Health and attention ranking are derived from case age, recorded responses, upcoming interviews and pending reviews; stale days are configurable in Skills. Intelligence includes observed source conversion, censored response timings, a 365-day activity grid, historical stage reach, weekly comparisons and company records. Company response averages require three observed responses.

Protocol references: [Google OAuth web-server flow](https://developers.google.com/identity/protocols/oauth2/web-server), [Google OAuth security practices](https://developers.google.com/identity/protocols/oauth2/resources/best-practices), [Gmail message listing](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/list).

On this Windows machine the global npm launcher is missing a dependency. The running app uses direct Node entry points. If the npm launcher fails, start the worker with `node node_modules/tsx/dist/cli.mjs scripts/mail-worker.ts` (append `--demo-only` for fictional-only processing), and start the built app with `node scripts/start.mjs`. To invoke other package scripts, use `node "C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js" run <script>`.
