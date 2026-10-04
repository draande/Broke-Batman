# Local verification

Verified on Windows with Node 24, native PostgreSQL 18 (UTF-8, bound to IPv4 loopback), and Chromium. Database migrations and seed commands ran against real PostgreSQL. The database and application are available locally; no external deployment was performed.

| Check                                           | Result                                                      |
| ----------------------------------------------- | ----------------------------------------------------------- |
| Dependency installation                         | Passed; lockfile committed to the workspace                 |
| Dependency advisory audit                       | Zero known vulnerabilities after updating affected packages |
| Prisma client generation                        | Passed                                                      |
| Initial SQL migration generation and deployment | Passed                                                      |
| Fictional demo database seed                    | Passed                                                      |
| TypeScript checking                             | Passed                                                      |
| ESLint                                          | Passed                                                      |
| Unit + PostgreSQL integration tests             | 35 passed, including Gmail, OAuth, ownership and persistence              |
| Production build                                | Passed with Next.js 16.3.8 / webpack                        |
| Production browser tests                        | 3 suites passed on the final production build                                    |
| Standalone server smoke and visual verification | Passed                                                      |
| Desktop, mobile and Daylight Mode screenshots   | Captured and inspected                                      |
| Browser exceptions during visual verification   | None                                                        |
| Mobile document overflow at 390px               | None                                                        |
| Docker image / compose execution                | Not run; Docker is not installed on this machine            |
| Optional external AI extraction provider        | Not run; no provider credentials configured                 |

The browser suites verified registration/login/logout, manual creation, extraction of pasted descriptions, review/save, persistence after refresh, editing, status history, interviews, follow-ups, completion/reopening controls, notes, contacts, historical analytics, CSV import and exports, JSON backup contents, global search, keyboard command palette, theme persistence, Kanban status persistence and failure rollback, duplicates/save-anyway, archive/restore/delete, and mobile navigation. A second user was denied access to another user's case; a hostile Origin was rejected; private-network URL extraction returned a clear validation error.

Unit tests cover both raw-text and JSON-LD extraction, invalid input and malicious links, private/reserved addresses including mapped IPv6, duplicate normalization, CSV column mapping, historical analytics, zero-denominator rates and daylight-saving calendar-day streaks. Database tests verify transactional status history, preservation of skills and notes, interview persistence, owner constraints, and child deletion cascades.

Visual artifacts are in `docs/screenshots/`. URL extraction on arbitrary third-party career sites is inherently subject to their availability, markup and scraping restrictions. Public live sites were not used as test dependencies; the fetch pipeline and failure boundary are validated locally, and the user is directed to paste text when fetching fails.

Earlier development runs exposed and corrected preferred-skill extraction, malformed URL handling, status updates passing notes into the wrong schema, decorative link names, navigation remounting open forms, date/streak behavior, crowded chart labels, and independent Kanban rollback. The final browser runs used the optimized production server to eliminate development compiler/hot-reload timing from the tests.


## Gmail and intelligence upgrade verification

The additive `202610030002_intelligence` migration and updated Prisma client were generated and deployed successfully without resetting the database. The final production build, explicit TypeScript check, and ESLint passed.

All 35 unit and PostgreSQL tests passed. Added coverage includes deterministic classification, ambiguous/strong matching evidence, interview timestamps with milliseconds and conservative missing-date handling, aliases and match-score arithmetic, authenticated token encryption and tamper rejection, provider quota/revocation errors, one-time owner-bound OAuth state/PKCE and mocked callback exchange, invalid callback redirects, transactional approval/replay rejection, audit evidence, contact deduplication, dismissed decisions, queue leasing/idempotency, mocked Gmail pagination and checkpoints, unrelated-mail filtering, censored timings, persistent notification deduplication/ownership, and preventing ingestion after privacy deletion.

All three browser suites passed on the final production build. The two existing case-management/regression suites passed together; the new Gmail suite passed separately after correcting an assertion to match the existing Missions label. The Gmail suite verifies fictional connection and background sync, confidence display, explicit status approval, confirmed interview creation, dismissal, skills aliases and persistence, analytics, notification read controls, company intelligence, mobile layout, Daylight Mode and disconnect. It collected no browser exceptions and no document overflow at 390px.

Screenshots inspected: `bat-inbox.png`, `bat-inbox-mobile.png`, `bat-inbox-daylight.png`, `skills-profile.png`, and `intelligence-expanded.png`. Existing desktop/mobile/theme screenshots remain available alongside them.

The local background worker runs with enforced `--demo-only` filtering. Real OAuth and Gmail endpoints were exercised with mocked responses in tests; no real account was connected and no private mailbox was accessed. Live Google consent, restricted-scope publication approval, and end-to-end Gmail service access require deployment-specific credentials and are not claimed as verified. Docker remains untested because Docker is unavailable locally.

Browser testing exposed and corrected sidebar controls below the viewport, worker environment initialization, and fractional-second timestamp parsing. The sync ingestion transaction now locks the connection row so disconnect/deletion cannot race with an in-flight message and recreate removed metadata. Diagnostics log error classes rather than private request values. Duplicate review links preserve the unsaved form by opening the existing case separately.
