# Spec 003 (Draft Notes): Streaming + Observability

This folder is a lightweight placeholder for a future specification.

**Base**: `specs/001-headless-financial-api/` (current Cards-domain API + outbox + tests).

---

## Intended Scope (order matters)

1. **Stream to BigQuery** for analytics (prefer Firebase/Google-managed automation if viable).
2. **Provision Redpanda** and publish **domain events** to it.
3. **Add OpenTelemetry** instrumentation end-to-end and explore telemetry in:
   - Grafana LGTM (Loki/Grafana/Tempo/Mimir), or
   - Datadog.

---

## Design Constraints (keep it simple)

- Spec 001 remains the stable baseline (no “big refactors” for Spec 003).
- Prefer configuration + small adapters over new domain concepts.
- Preserve outbox semantics (at-least-once, replayable, idempotent consumers).

---

## Suggested Artifacts for Spec 003

- A clear “event contract” for downstream systems:
  - event names, required fields, payload schemas, ordering semantics.
- A minimal deployment plan (what is provisioned, where, and how it is tested).
- A verification suite that proves:
  - events reach the sink (BigQuery/Redpanda),
  - retries behave correctly,
  - tracing context can be correlated across API → publisher → sink.
