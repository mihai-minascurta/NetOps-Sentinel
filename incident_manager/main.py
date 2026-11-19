
from fastapi import FastAPI, HTTPException , BackgroundTasks

from pydantic import BaseModel

from .database import process_alert, get_incident, update_incident_status, get_saved_ai_diagnosis

from .investigation.engine import run_investigation

from .AI_part.diagnosis import diagnose

from starlette.concurrency import run_in_threadpool

import logging

app = FastAPI(title="NetOps Sentinel - Incident Manager")

VALID_STATES = {"firing", "resolved"}

ROUTERS = {"192.168.122.247:9100": "R1", "192.168.122.195:9100": "R2"}

# --------------------------------------------------------------------------- Run investigation and diagnose in the same time with alerts / incidents
async def investigate_and_diagnose(incident_id: int):

    try:
        # M5: Investigate the incident
        result = await run_in_threadpool(
            run_investigation, incident_id
        )

        if not result["success"]:
            raise RuntimeError(f"Investigation failed: {result}")

        # M6: Diagnose and save the result
        await diagnose(result["investigation_id"])

    except Exception:
        logging.exception(
            "Automatic investigation failed for incident %s",
            incident_id
        )

# --------------------------------------------------------------------------- Webhook: receives alerts from AlertManager
@app.post("/webhook/alerts")
def receive_alerts(data: dict , background_tasks: BackgroundTasks):

    # Alertmanager groups alerts, so the body must contain a list under "alerts".
    alerts = data.get("alerts")

    if not isinstance(alerts, list):
        raise HTTPException(status_code=400, detail="'alerts' must be a list")

    processed_alerts = []
    counts = {
        "created": 0,
        "updated": 0,
        "duplicate": 0,
        "unmatched": 0
    }
    skipped = 0

    for alert in alerts:

        # Skip entries that are not JSON objects, or that have no usable labels.
        if not isinstance(alert, dict):
            skipped += 1
            continue

        labels = alert.get("labels")

        if not isinstance(labels, dict):
            skipped += 1
            continue

        # Extract the fields we need; .get() returns None instead of crashing on missing keys.
        fingerprint = alert.get("fingerprint")
        alertname = labels.get("alertname")
        status = alert.get("status")
        starts_at = alert.get("startsAt")
        instance = labels.get("instance")
        ends_at = alert.get("endsAt")

        if not isinstance(ends_at, str) or ends_at.startswith("0001-01-01"):
            ends_at = None

        # Skip alerts missing a required field or carrying an unknown state.
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
        )  # "unknown" when the address is not in ROUTERS

        severity = labels.get("severity", "unknown")

        # Hand the alert to the database layer, which saves it (and opens an incident if needed)
        result = process_alert(
            fingerprint=fingerprint,
            alertname=alertname,
            router=router,
            status=status,
            started_at=starts_at,
            severity=severity,
            ended_at=ends_at,
        )

        # Start automatic investigation for a new incident
        if (
            status == "firing"
            and result["action"] == "created"
            and result["incident_id"] is not None
        ):
            background_tasks.add_task(
                investigate_and_diagnose,
                result["incident_id"]
            )

        action = result["action"]
        counts[action] += 1

        # Remember what was processed so the response shows it.
        processed_alerts.append(
            {
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
                "incident_id": result[
                    "incident_id"
                ],  # None unless a new incident was opened for this alert
            }
        )

    # Summary of the whole request; **counts copies created/updated/duplicate into the response.
    return {"received": True, **counts, "skipped": skipped, "alerts": processed_alerts}


# --------------------------------------------------------------------------- Reading a single incident
@app.get("/incidents/{incident_id}")
def read_incident(incident_id: int):

    incident = get_incident(incident_id)

    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")

    # The database returns a tuple; turn it into a JSON object with named fields.
    return {
        "id": incident[0],
        "status": incident[1],
        "severity": incident[2],
        "opened_at": incident[3],
        "closed_at": incident[4],  # null until the incident is closed
        "root_cause": incident[5],
    }


# --------------------------------------------------------------------------- Changing the status of an incident

# Describes the request body: {"status": "investigating"}.
# Pydantic checks the shape of the JSON (422 if wrong);
class IncidentStatusUpdate(BaseModel):
    status: str

ERROR_STATUS_CODES = {
    "incident_not_found": 404,  # the incident does not exist
    "invalid_transition": 409,  # the request conflicts with the incident's current state
    "status_changed": 409,  # someone else changed the status in the meantime
}

@app.patch("/incidents/{incident_id}/status")  # PATCH: changes one field of an existing resource
def update_status(incident_id: int, payload: IncidentStatusUpdate):

    incident_update_status = update_incident_status(incident_id, payload.status)

    if incident_update_status["success"]:
        return incident_update_status

    status_code = ERROR_STATUS_CODES.get(incident_update_status["error"], 400)
    raise HTTPException(status_code=status_code, detail=incident_update_status)

# --------------------------------------------------------------------------- Starting an investigation for an incident and try to solve it...
@app.post("/incidents/{incident_id}/investigations", status_code=201)
def create_investigation_incident(incident_id: int , background_tasks: BackgroundTasks):

    result = run_investigation(incident_id)

    if result.get("error") == "incident_not_found":
        raise HTTPException(status_code=404, detail="Incident not found")

    if not result["success"]:
        raise HTTPException(status_code=422, detail=result["error"])

    investigation_id = result["investigation_id"]

    background_tasks.add_task(diagnose, investigation_id)

    return result

@app.get("/investigations/{investigation_id}/diagnosis")
def read_investigation_diagnosis(investigation_id: int):

    # Read the saved diagnosis from SQLite
    result = get_saved_ai_diagnosis(investigation_id)

    if result is None:
        raise HTTPException(
            status_code=404,
            detail="Investigation not found."
        )

    if result["diagnosis"] is None:
        raise HTTPException(
            status_code=404,
            detail="AI diagnosis not available yet."
        )

    return result
