from database import create_alert

create_alert(
    fingerprint="r2-node-down-test-001",
    alertname="NodeExporterDown",
    router="R2",
    status="firing",
    started_at="2026-11-08T00:00:00Z"
)