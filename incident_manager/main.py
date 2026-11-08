
import sqlite3
from pathlib import Path
from fastapi import FastAPI, HTTPException



DB_PATH = Path(__file__).parent / "data" / "incidents.db"

connection = sqlite3.connect("data/incidents.db")

app = FastAPI(title="NetOps Sentinel - Incident Manager")

VALID_STATES = {"firing", "resolved"}

@app.post("/webhook/alerts")
def receive_alerts(data: dict):

    alerts = data.get("alerts")
    if not isinstance(alerts, list):
        raise HTTPException(status_code=400, detail="'alerts' must be a list")

    processed_alerts = []
    skipped = 0
    

    for alert in alerts:
        if not isinstance(alert, dict):
            skipped += 1
            continue

        labels = alert.get("labels")
        if not isinstance(labels, dict):
            labels = {}

        fingerprint = alert.get("fingerprint")
        alertname = labels.get("alertname")
        status = alert.get("status")
        starts_at = alert.get("startsAt")

        if not (fingerprint and alertname and starts_at) or status not in VALID_STATES:
            skipped += 1
            continue

        processed_alerts.append({
            "fingerprint": fingerprint,
            "alertname": alertname,
            "severity": labels.get("severity", "unknown"),
            "router": labels.get("router"),
            "instance": labels.get("instance"),
            "status": status,
            "startsAt": starts_at,
            "endsAt": alert.get("endsAt"),
        })

    return {
        "received": True,
        "count": len(processed_alerts),
        "skipped": skipped,
        "alerts": processed_alerts,
    }