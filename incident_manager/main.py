from fastapi import FastAPI, HTTPException
from database import process_alert

app = FastAPI(title="NetOps Sentinel - Incident Manager")

VALID_STATES = {"firing", "resolved"}

ROUTERS = {
    "192.168.122.247:9100": "R1",
    "192.168.122.195:9100": "R2"
}


@app.post("/webhook/alerts")
def receive_alerts(data: dict):

    alerts = data.get("alerts")

    if not isinstance(alerts, list):
        raise HTTPException(
            status_code=400,
            detail="'alerts' must be a list"
        )

    processed_alerts = []
    counts = {"created": 0, "updated": 0, "duplicate": 0}
    skipped = 0

    for alert in alerts:

        if not isinstance(alert, dict):
            skipped += 1
            continue

        labels = alert.get("labels")

        if not isinstance(labels, dict):
            skipped += 1
            continue

        fingerprint = alert.get("fingerprint")
        alertname = labels.get("alertname")
        status = alert.get("status")
        starts_at = alert.get("startsAt")
        instance = labels.get("instance")
        ends_at = alert.get("endsAt")
        if not isinstance(ends_at, str) or ends_at.startswith("0001-01-01"):
            ends_at = None

        if (
            not fingerprint
            or not alertname
            or not starts_at
            or status not in VALID_STATES
        ):
            skipped += 1
            continue

        router = labels.get("router") or ROUTERS.get(instance, "unknown")

        severity = labels.get("severity", "unknown")

        result = process_alert(
            fingerprint=fingerprint,
            alertname=alertname,
            router=router,
            status=status,
            started_at=starts_at,
            severity=severity
        )
        action = result["action"]
        counts[action] += 1

        processed_alerts.append({
            "fingerprint": fingerprint,
            "alertname": alertname,
            "severity": severity,
            "router": router,
            "instance": instance,
            "status": status,
            "startsAt": starts_at,
            "endsAt": alert.get("endsAt"),
            "action": action,
            "alert_id": result["alert_id"],
            "incident_id": result["incident_id"]
        })
    return {
        "received": True,
        **counts,
        "skipped": skipped,
        "alerts": processed_alerts
    }