import sqlite3
from pathlib import Path
from datetime import datetime, timezone
import json

DB_PATH = Path(__file__).resolve().parent / "data" / "incidents.db"

def get_db_connection():
    connection = sqlite3.connect(DB_PATH)
    connection.execute("PRAGMA foreign_keys = ON")  # SQLite ignores foreign keys unless this runs on every connection
    return connection


# --------------------------------------------------------------------------- Reading incidents
def get_incidents():
    connection = get_db_connection()

    try:
        # Read every incident into memory.
        cursor = connection.execute("SELECT * FROM incidents")
        rows = cursor.fetchall()  # list of tuples, one per incident
        return rows
    finally:
        connection.close()


def get_incident(incident_id):
    connection = get_db_connection()

    try:
        # Look up a single incident by id.
        cursor = connection.execute(
            "SELECT * FROM incidents WHERE id = ?",  # ? placeholder: the value never becomes part of the SQL text
            (incident_id,),
        )
        return cursor.fetchone()  # a tuple if found, None if the id does not exist
    finally:
        connection.close()


# --------------------------------------------------------------------------- Alerts and automatic incident creation

# Insert or update ONE alert on a connection owned by the caller.
def save_alert(
    connection, fingerprint, alertname, router, status, started_at, ended_at=None
):

    # Check whether this alert episode is already stored.
    cursor = connection.execute(
        """
        SELECT id, state, ended_at
        FROM alerts
        WHERE fingerprint = ? AND started_at = ?
        """,
        (fingerprint, started_at), # (fingerprint, started_at) together identify one occurrence of an alert.
    )

    existing_alert = cursor.fetchone()

    # Case 1: the alert is new, so insert it.
    if existing_alert is None:
        cursor = connection.execute(
            """
            INSERT INTO alerts
                (fingerprint, alertname, router, state, started_at, ended_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (fingerprint, alertname, router, status, started_at, ended_at),
        )
        return cursor.lastrowid, "created"  # lastrowid = id that SQLite generated for the new row

    alert_id, old_status, old_ended_at = existing_alert

    # Case 2: the alert exists but its state or end time changed (e.g. firing -> resolved).
    if old_status != status or old_ended_at != ended_at:
        connection.execute(
            "UPDATE alerts SET state = ?, ended_at = ? WHERE id = ?",
            (status, ended_at, alert_id),  # WHERE id = ? so only this one row changes
        )
        return alert_id, "updated"

    # Case 3: same alert, same state, so this is a repeated notification and nothing is written.
    return alert_id, "duplicate"


# Create an incident and link it to an alert.
def create_incident_for_alert(connection, alert_id, severity, opened_at):

    # Insert the new incident, always starting in the "open" state.
    cursor = connection.execute(
        """
        INSERT INTO incidents (status, severity, opened_at)
        VALUES (?, ?, ?)
        """,
        ("open", severity, opened_at),
    )

    incident_id = cursor.lastrowid  # id of the incident we just created

    # Link the alert to the incident in the many-to-many table.
    connection.execute(
        """
        INSERT INTO incident_alerts (incident_id, alert_id)
        VALUES (?, ?)
        """,
        (incident_id, alert_id),
    )

    return incident_id


# Coordinator: saves the alert and, when needed, creates the incident,
# all inside ONE transaction (everything is saved together or nothing is).
def process_alert(
    fingerprint, alertname, router, status, started_at, severity, ended_at=None
):

    connection = get_db_connection()

    try:
        # Step 1: store or update the alert.
        alert_id, action = save_alert(
            connection, fingerprint, alertname, router, status, started_at, ended_at
        )

        incident_id = None

        # Step 2: open an incident only for a brand new alert that is firing.
        # Repeats ("duplicate") and resolutions ("updated") must not create a second incident.
        if action == "created" and status == "firing":
            incident_id = create_incident_for_alert(
                connection, alert_id, severity, started_at
            )

        # Step 3: single commit, so alert + incident + link become permanent together.
        connection.commit()
        return {"alert_id": alert_id, "action": action, "incident_id": incident_id}

    except Exception:
        connection.rollback()
        raise # re-raise so the caller (FastAPI) still sees the error

    finally:
        connection.close()


# --------------------------------------------------------------------------- Incident status workflow

# Each status maps to the ONLY status that may follow it.
ALLOWED_TRANSITIONS = {
    "open": "investigating",
    "investigating": "resolved",
    "resolved": "closed",
}


def update_incident_status(incident_id, new_status):

    connection = get_db_connection()

    try:
        # Read the current status of the incident.
        row = connection.execute(
            "SELECT status FROM incidents WHERE id = ?",
            (incident_id,),
        ).fetchone()
        if row is None:
            return {"success": False, "error": "incident_not_found"}

        current_status = row[0]
        allowed_status = ALLOWED_TRANSITIONS.get(current_status)

        # Reject transitions that are not the next step in the workflow.
        if allowed_status is None or new_status != allowed_status:
            return {
                "success": False,
                "error": "invalid_transition",
                "current_status": current_status,
                "requested_status": new_status,
            }

        closed_at = None

        # Closing needs a different UPDATE because it also records the closing time.
        if new_status == "closed":
            closed_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")  # UTC, same ISO format as opened_at
            cursor = connection.execute(
                """
                UPDATE incidents
                SET status = ?, closed_at = ?
                WHERE id = ? AND status = ?
                """,
                (new_status, closed_at, incident_id, current_status),
            )
        # Every other transition only changes the status.
        else:
            cursor = connection.execute(
                """
                UPDATE incidents
                SET status = ?
                WHERE id = ? AND status = ?
                """,
                (new_status, incident_id, current_status),  # AND status = ? applies the change only if nobody changed it meanwhile
            )

        # rowcount = how many rows were really modified.
        # 0 means another request changed the status between our SELECT and UPDATE.
        if cursor.rowcount == 0:
            return {"success": False, "error": "status_changed"}

        connection.commit()
        return {
            "success": True,
            "incident_id": incident_id,
            "old_status": current_status,
            "new_status": new_status,
            "closed_at": closed_at,
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# --------------------------------------------------------------------------- Investigations
def create_investigation(incident_id: int):

    connection = get_db_connection()

    try:
        incident = connection.execute(
            "SELECT id FROM incidents WHERE id = ?",
            (incident_id,),
        ).fetchone()

        if incident is None:
            return None

        started_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

        # Create the investigation
        cursor = connection.execute(
            """
            INSERT INTO investigations (incident_id, status, started_at)
            VALUES (?, ?, ?)
            """,
            (incident_id, "running", started_at),
        )

        investigation_id = cursor.lastrowid

        connection.commit()
        return investigation_id

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# --------------------------------------------------------------------------- Evidence
def save_evidence(investigation_id: int, check_type: str, status: str, result: dict):

    connection = get_db_connection()

    try:
        # SQLite cannot store a Python dict, so convert it to a JSON string first.
        json_result = json.dumps(result)
        collected_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

        cursor = connection.execute(
            """
            INSERT INTO evidences (investigation_id, check_type, status, result, collected_at)
            VALUES (?, ?, ?, ?, ?)
            """,  # 5 columns, so exactly 5 placeholders
            (investigation_id, check_type, status, json_result, collected_at),  # same order as the columns above
        )

        evidence_id = cursor.lastrowid

        connection.commit()
        return evidence_id

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()

# Final states an investigation can end in.
FINAL_INVESTIGATION_STATUSES = {"completed", "failed"}

def finish_investigation(investigation_id: int, status: str):

    # Reject any target status other than completed / failed.
    if status not in FINAL_INVESTIGATION_STATUSES:
        return {
            "success": False,
            "error": "invalid_status",
            "requested_status": status,
        }

    connection = get_db_connection()

    try:
        # Read the current status of the investigation.
        row = connection.execute(
            "SELECT status FROM investigations WHERE id = ?",
            (investigation_id,),
        ).fetchone()

        if row is None:
            return {"success": False, "error": "investigation_not_found"}

        current_status = row[0]

        # Only a "running" investigation can be finished.
        if current_status != "running":
            return {
                "success": False,
                "error": "invalid_transition",
                "current_status": current_status,
                "requested_status": status,
            }

        finished_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

        # Save the final status and the finish time in the same UPDATE.
        cursor = connection.execute(
            """
            UPDATE investigations
            SET status = ?, finished_at = ?
            WHERE id = ? AND status = 'running'
            """,  # AND status = 'running' is the safety net against concurrent changes
            (status, finished_at, investigation_id),
        )

        if cursor.rowcount == 0:
            return {"success": False, "error": "status_changed"}

        connection.commit()

        return {
            "success": True,
            "investigation_id": investigation_id,
            "status": status,
            "finished_at": finished_at,
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()

def get_incident_router(incident_id: int) -> str | None:
    connection = get_db_connection()

    try:
        row = connection.execute(
            """
            SELECT a.router
            FROM incidents AS i
            JOIN incident_alerts AS ia
                ON i.id = ia.incident_id
            JOIN alerts AS a
                ON ia.alert_id = a.id
            WHERE i.id = ?
            """,
            (incident_id,)
        ).fetchone()

        if row is None:
            return None

        return row[0]

    finally:
        connection.close()

#-------------------------------------------------------------------------------Ai Diagnosis
def save_ai_diagnosis(investigation_id: int, diagnosis: dict) -> bool:

    # Validate input
    if investigation_id <= 0:
        raise ValueError("Invalid investigation ID.")

    if not isinstance(diagnosis, dict):
        raise ValueError("Diagnosis must be a dictionary.")

    # Convert the diagnosis to JSON text
    diagnosis_json = json.dumps(
        diagnosis,
        ensure_ascii=False,
        allow_nan=False
    )

    connection = get_db_connection()

    try:
        # Save only for a completed investigation
        cursor = connection.execute(
            """
            UPDATE investigations
            SET ai_diagnosis = ?
            WHERE id = ?
              AND status = 'completed'
            """,
            (diagnosis_json, investigation_id)
        )

        if cursor.rowcount != 1:
            raise RuntimeError(
                "Investigation not found or not completed."
            )

        connection.commit()
        return True

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()
