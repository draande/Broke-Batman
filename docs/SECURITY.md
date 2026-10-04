# Security

This is a portfolio application, not a security certification. These protections describe the current code.

## Identity and isolation

Passwords use bcrypt cost 12 and a 72 UTF-8 byte limit to prevent truncation. Signed HS256 sessions have fixed issuer/audience and revocable seven-day database records. Cookies are HttpOnly, SameSite=Lax, and Secure in production. Logout deletes the session.

Private requests require authentication. Case/child mutations, inbox linking/review, notifications, exports, and privacy controls check ownership server-side. Unauthorized records return not-found. Browser filtering is not authorization; PostgreSQL row-level security is not enabled.

Mutations validate `Origin` against `APP_URL`. Database rate limits cover authentication, demo creation, extraction, and Gmail actions. Internet deployment still needs ingress limits and account lifecycle controls.

## Inputs and external fetching

Zod validates forms/provider responses. JSON bodies have a streamed 1 MB limit. Job fetching rejects URL credentials, nonstandard ports, private/reserved addresses, and internal hostnames; validates redirects; pins DNS; and bounds redirects, time, and size.

React escapes email text rather than rendering raw HTML. Meeting/posting links are validated. Headers deny framing, disable selected device permissions, and prevent MIME sniffing. The CSP permits inline scripts/styles used by this implementation; it is not a strict nonce-based policy.

## OAuth and email

Gmail requests read-only access, expiring single-use owner-bound state, and S256 PKCE. AES-256-GCM encrypts OAuth tokens/verifiers with an independent `GMAIL_TOKEN_KEY`. Changing/losing the key requires reconnecting accounts.

Bodies are transient, but sender/subject/excerpts/suggestions persist and remain private data. No email content is sent to an AI provider. Suggested changes require approval. Disconnect and deletion are separate controls. See [email privacy](EMAIL_INTELLIGENCE.md#privacy).

## Secrets, logging, and deployment

Private `.env` files are ignored; the example contains only development values/empty credential slots. CI credentials are test-only. Diagnostics log a fixed event/error class, not passwords, tokens, cookies, headers, request bodies, or emails. A targeted tracked-file scan found no real credential patterns during this cleanup; this heuristic is not proof that no secrets exist. Rotate/revoke any leaked credential and inspect history instead of only deleting its line.

Deploy with HTTPS, a dedicated database account, independent secrets, backups, restricted logs, and supervised workers. Set the exact public `APP_URL`. Public demo creation is opt-in and creates persistent users. Automatic demo cleanup, password reset, email verification, MFA, automatic retention, and backups are not implemented.

Report suspected vulnerabilities privately through an available owner contact. No private reporting channel has been configured here; do not post live credentials or mailbox content in public issues.
