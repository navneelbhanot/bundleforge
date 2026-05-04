# ADR-0001 — Modular Monolith with One Microservice Carve-Out

- **Status:** accepted
- **Date:** 2026-05-04
- **Deciders:** Claude Code session 0000, user

---

## Context

BundleForge spans many domains: bundles, inventory, orders, analytics, billing,
integrations, AI. ARCHITECTURE.md §2.1 prescribes a modular monolith with one
microservice carve-out for the AI recommender. This ADR formalizes that choice
so subsequent sessions do not relitigate it.

The constraints are:

- The build is executed by a single agent in sequential sessions, not a team.
- Operational simplicity is critical: fewer deploy targets, fewer runtimes,
  fewer credentials.
- Latency-sensitive paths (Cart Transform, webhook handlers) cannot afford
  cross-service hops.
- The AI workload (training + inference) has different language, library, and
  resource profiles from the rest of the app.

## Decision

The Node.js/TypeScript app is a **modular monolith**. Each domain
(`bundles`, `inventory`, `orders`, `analytics`, `billing`, `integrations`,
`ai`) lives under `src/services/<domain>/` with its own service, repository,
and route layers. All share one Postgres database, one Redis instance, and
one deployment.

The single exception is the **AI recommender**, which runs as a separate
Python service (Flask + scikit-learn) and is called from the Node app over
HTTP. This isolates ML library footprint and training cycles from request-path
latency.

## Alternatives considered

- **Pure monolith including AI in Node.** Rejected because Node ML libraries
  are weaker than Python's, and training jobs would compete for the request-
  path event loop.
- **Multi-service from day one (bundles-service, inventory-service, …).**
  Rejected. Operational cost is too high for a single-engineer build, and
  cross-service contracts would multiply the number of synchronization points
  to maintain across sessions.
- **Serverless functions per route.** Rejected. Cold starts hurt webhook
  reliability, and the BullMQ + Redis worker model wants long-lived processes.

## Consequences

- Positive
  - One repo, one TS build, one deploy. Simple for sequential session work.
  - Refactors across domain boundaries are local, not cross-service migrations.
  - One database means transactions can span domains (e.g. inventory adjust +
    audit log + order status, all in one Prisma transaction).
- Negative
  - All domains share scale characteristics. A noisy domain affects others.
    Mitigated by BullMQ moving heavy work off the request path.
  - Coupling temptation. Mitigated by enforcing service-layer boundaries and
    keeping repositories private to their domain.
- Follow-ups
  - Service boundaries are enforced by directory structure + lint rules
    (added in M-012 if needed).
  - The AI service contract is defined by spec at M-124.
