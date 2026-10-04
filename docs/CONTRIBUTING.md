# Contributing

Follow [README setup](../README.md#run-it-locally) with a development database. Never reset personal job-search data. This repository has no license grant; discuss reuse/contributions with the owner first.

Use focused branches such as `fix/inbox-pagination` or `feature/calendar-export`. Services are for coordinating records, not adding layers to a simple query. Keep changes reviewable and explain the behavior they fix.

```sh
npm run format
npm run typecheck
npm run lint
npm run test:unit
npm run test:integration
npm run build
npm run test:e2e
```

Integration tests need migrated PostgreSQL. Browser tests use a fictional worker and must not depend on real Gmail. Test behavior, ownership, transactions, and failure boundaries rather than restating implementation.

For UI changes, check mobile, both themes, keyboard navigation, dialog focus, and reduced motion. `npm run screenshots` deliberately updates the README gallery; ordinary tests write ignored `test-results`. Include a screenshot for visible changes.

Explain what changed, why, and what you tested in the PR. Update setup/privacy docs when behavior changes. Keep secrets and private emails out of fixtures/screenshots/logs/issues. Use original assets; no official DC artwork.
