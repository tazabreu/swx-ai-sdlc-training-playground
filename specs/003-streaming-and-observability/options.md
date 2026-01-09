# Options (Draft): BigQuery + Redpanda + OTel

This is not a decision record yet—just a short menu for Spec 003.

---

## BigQuery ingestion

**Preferred (if automatable)**:
- Firebase/Google-managed ingestion (e.g., a Firebase Extension that exports Firestore changes to BigQuery).

**Alternatives** (if extension limits are unacceptable):
- Pub/Sub → Dataflow (more control, more ops)
- Custom publisher from outbox → BigQuery (simple, but “own the reliability”)

Key decision points:
- event schema evolution strategy
- late-arriving updates and deduplication (idempotency at the sink)

---

## Redpanda (domain events)

**Preferred**:
- Treat Redpanda as a sink for outbox events (publish from outbox processor).

Key decision points:
- topic naming convention (by domain vs by event type)
- ordering guarantees (per-entity ordering vs global ordering)
- dead-letter strategy and replay tooling

---

## OpenTelemetry (traces/logs/metrics)

**Preferred**:
- Add request + trace context at the API edge, propagate through handlers/outbox.

Key decision points:
- where to terminate/emit spans (API, publisher, sink)
- exporter target (Grafana LGTM vs Datadog)
- sampling strategy (cost vs fidelity)
