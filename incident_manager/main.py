from fastapi import FastAPI, HTTPException
from database import save_alert

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

        if (
            not fingerprint
            or not alertname
            or not starts_at
            or status not in VALID_STATES
        ):
            skipped += 1
            continue

        router = labels.get("router") or ROUTERS.get(
            instance, "unknown"
        )

        processed_alert = {
            "fingerprint": fingerprint,
            "alertname": alertname,
            "severity": labels.get("severity", "unknown"),
            "router": router,
            "instance": instance,
            "status": status,
            "startsAt": starts_at,
            "endsAt": alert.get("endsAt")
        }

        #Here we will save alerts trough create_alert -> a function from database.py
        save_alert(
            fingerprint=fingerprint,
            alertname=alertname,
            router=router,
            status=status,
            started_at=starts_at
        )

        processed_alerts.append(processed_alert)

    return {
        "received": True,
        "count": len(processed_alerts),
        "skipped": skipped,
        "alerts": processed_alerts
    }