# Verification

Portfolio cleanup verified locally on **2026-10-03**, using Windows, Node 24, PostgreSQL 18, and Chromium. Existing data and migrations were preserved; no external deployment was performed.

| Check                                    | Result                                                                                                   |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Clean lockfile installation (`npm ci`)   | Passed; 457 packages installed                                                                           |
| Installation advisory audit              | Zero reported vulnerabilities at verification time                                                       |
| Prisma generation / migration deployment | Passed; both existing migrations present, no pending migrations                                          |
| Explicit TypeScript and ESLint           | Passed                                                                                                   |
| Prettier check                           | Passed                                                                                                   |
| Vitest unit + PostgreSQL integration     | 40 tests passed across six files (29 unit, 11 integration)                                               |
| Cross-platform integration command       | Passed against real PostgreSQL                                                                           |
| Production build                         | Passed; standalone app and original social image generated                                               |
| Production Chromium workflows            | Four suites passed                                                                                       |
| Mobile screens                           | Nine main routes tested at 390px in both themes, no document overflow                                    |
| Keyboard and accessibility checks        | Ctrl+K, dialog focus containment/Escape, typing-safe Easter egg, reduced motion, primary-button contrast |
| Intentional gallery                      | Nine refreshed screenshots; obsolete duplicates removed                                                  |
| Local documentation links/images         | Checked with `npm run docs:check`                                                                        |
| GitHub clone URL                         | Configured remote resolves through `git ls-remote origin HEAD`                                           |
| Credential-pattern scan                  | No findings in tracked/new source/config/docs; private `.env` is ignored                                 |

## Coverage

Browser workflows exercise authentication, manual/pasted-posting creation, persistence, editing, status history, interviews, contacts, notes, follow-ups, duplicates/save-anyway, archive/restore/delete, Kanban updates and failure rollback, CSV import/export, JSON backup, command search, theme persistence, and ownership/origin/SSRF rejection.

The fictional Gmail workflow tests connection, queued worker sync, matching evidence, explicit status approval, interview confirmation, dismissal, skills, company analytics, notifications, mobile/daylight rendering, and disconnect. Provider integration tests mock Google exchanges, refresh/revocation errors, pagination, and lease/idempotency behavior. Tests also cover privacy-deletion races and competing suggestion review.

New cleanup tests validate malformed provider JSON, damaged/null suggestion payloads, duplicate error details, field errors, offline and non-JSON failures, metadata/favicon/social image, keyboard behavior, mobile layout, and button contrast. Ordinary browser artifacts are ignored; only the deliberately captured portfolio gallery belongs in Git.

The final presentation check also covers mobile case details, horizontally scrolling Kanban, and edit-dialog bounds in both themes. The refreshed nine-image gallery totals about 1 MB.

## Local installation notes

The first clean-install attempts encountered Windows locks from the running embedded PostgreSQL/native helpers. After stopping those local processes, installation succeeded and PostgreSQL restarted with its existing data. Engine download on this machine required Node's system certificate trust (`NODE_USE_SYSTEM_CA=1`).

Browser tests use one worker for predictable local resource usage and a supervisor that starts production plus a demo-only mail worker. An initial parallel run stalled during static-resource loading; sequential runs passed. The tests caught and corrected a duplicate-error parsing regression. Visual review found insufficient daylight primary-button contrast; labels now use white and the browser test checks both themes.

## Limits

- Real Google consent, live mailbox access, and restricted-scope publication approval need deployment-specific credentials and are not claimed as verified. No private mailbox was accessed.
- The optional extraction provider is not tested live; local text/JSON-LD parsing and failure handling are tested.
- Docker is unavailable on this machine; image/compose execution remains unverified. Compose does not include a worker service.
- Arbitrary third-party job sites can block fetching or change markup. Live sites are not test dependencies; pasting a posting is the fallback.
- The credential scan is heuristic, not a guarantee. The repository currently has no license grant.
- CI configuration was exercised through its local production supervisor path; a hosted GitHub Actions run has not been observed during this cleanup.
