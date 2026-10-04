# Database

[schema.prisma](../prisma/schema.prisma) defines the models; checked-in SQL migrations create them. PostgreSQL provides transactions, row locks, and the atomic rate-limit upsert.

| Group                | Models                                                                                    |
| -------------------- | ----------------------------------------------------------------------------------------- |
| Identity             | `User`, `Session`, `UserPreference`                                                       |
| Cases                | `Application`, `Status`, `ApplicationStatusHistory`                                       |
| Case records         | `Interview`, `FollowUp`, `Contact`, `Note`, `Activity`                                    |
| Skills               | `Skill`, `ApplicationSkill`, `UserSkill`, `SearchProfile`                                 |
| Email                | `EmailConnection`, `OAuthAttempt`, `SyncState`, `EmailMessageMetadata`, `SuggestedAction` |
| Notifications/limits | `Notification`, `RateLimit`                                                               |

## Invariants

Cases have owners. Every case/child mutation checks ownership; email, notifications, skills, and queue state are user-scoped. There is no database row-level security; isolation is enforced in server queries and tested with a second user.

Status changes and history writes share a transaction. Suggestion approval claims only a pending decision and writes its result in the same transaction, preventing two approval clicks from both succeeding.

Email identity is unique on `(userId, externalId)`; suggestion kind is unique per message; notification keys are unique per user. Ingestion checks for existing messages and locks the connection row so disconnect/privacy deletion cannot race with a new metadata write. A uniqueness collision retries through the worker rather than creating a duplicate.

Deleting a case cascades through its children, history, skills links, and activity. Linked email metadata survives with a null case link. Deleting a user cascades through owned data. The privacy UI deletes email/application data, rather than the login account itself.

Owner/date/status indexes support case lists, histories, inbox pages, notifications, and upcoming events. Status IDs are application-defined strings; incoming changes are checked against the status table.

## Operation

`npm run db:generate` regenerates Prisma; `npm run db:migrate` deploys existing SQL migrations without resetting data. For new schema changes, use `npx prisma migrate dev --name descriptive_name` on a development database and inspect its SQL.

`db:local` starts persistent development PostgreSQL in ignored `.postgres/data`. `db:seed` requires `DEMO_PASSWORD`, creates fictional cases, and preserves existing cases. **`db:reset` deletes database contents** and is never needed for normal setup.

Use a development/disposable database for integration tests. They create/remove their own users, but an interrupted process may leave test records. Back up real data before destructive maintenance. Automatic backups and retention scheduling are not implemented.
