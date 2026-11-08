from fastapi import FastAPI, HTTPException

from pydantic import BaseModel

from database import process_alert , get_incident , update_incident_status

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
            severity=severity ,
            ended_at=ends_at
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
            "endsAt": ends_at,
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

@app.get("/incidents/{incident_id}")
def read_incident(incident_id: int):
    incident = get_incident(incident_id)

    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")

    return {
        "id": incident[0],
        "status": incident[1],
        "severity": incident[2],
        "opened_at": incident[3],
        "closed_at": incident[4],
        "root_cause": incident[5],
    }

class IncidentStatusUpdate(BaseModel):
    status: str

ERROR_STATUS_CODES = {
    "incident_not_found": 404,
    "invalid_transition": 409,
    "status_changed": 409,
}

@app.patch("/incidents/{incident_id}/status")
def update_status(incident_id: int, payload: IncidentStatusUpdate):

    incident_update_status = update_incident_status(incident_id , payload.status)

    if incident_update_status["success"]:
        return incident_update_status


    status_code = ERROR_STATUS_CODES.get(incident_update_status["error"], 400)
    raise HTTPException(status_code=status_code, detail=incident_update_status)  