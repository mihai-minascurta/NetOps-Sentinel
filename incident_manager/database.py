import sqlite3
from pathlib import Path
from datetime import datetime, timezone


DB_PATH = Path(__file__).resolve().parent / "data" / "incidents.db"


def get_db_connection():
    connection = sqlite3.connect(DB_PATH)
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def get_incidents():

    connection = get_db_connection()

    try:
        cursor = connection.execute("SELECT * FROM incidents")
        rows = cursor.fetchall()
        return rows
    finally:
        connection.close()


def save_alert(
    connection, fingerprint, alertname, router, status, started_at, ended_at=None
):

    cursor = connection.execute(
        """
        SELECT id, state, ended_at
        FROM alerts
        WHERE fingerprint = ? AND started_at = ?
        """,
        (fingerprint, started_at),
    )

    existing_alert = cursor.fetchone()

    if existing_alert is None:
        cursor = connection.execute(
            """
            INSERT INTO alerts
                (fingerprint, alertname, router, state, started_at, ended_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (fingerprint, alertname, router, status, started_at, ended_at),
        )
        return cursor.lastrowid, "created"

    alert_id, old_status, old_ended_at = existing_alert

    if old_status != status or old_ended_at != ended_at:
        connection.execute(
            "UPDATE alerts SET state = ?, ended_at = ? WHERE id = ?",
            (status, ended_at, alert_id),
        )
        return alert_id, "updated"

    return alert_id, "duplicate"


def create_incident_for_alert(connection, alert_id, severity, opened_at):

    cursor = connection.execute(
        """
        INSERT INTO incidents (status, severity, opened_at)
        VALUES (?, ?, ?)
        """,
        ("open", severity, opened_at),
    )

    incident_id = cursor.lastrowid

    connection.execute(
        """
        INSERT INTO incident_alerts (incident_id, alert_id)
        VALUES (?, ?)
        """,
        (incident_id, alert_id),
    )

    return incident_id


def process_alert(
    fingerprint, alertname, router, status, started_at, severity, ended_at=None
):

    connection = get_db_connection()

    try:
        alert_id, action = save_alert(
            connection, fingerprint, alertname, router, status, started_at, ended_at
        )

        incident_id = None

        if action == "created" and status == "firing":
            incident_id = create_incident_for_alert(
                connection, alert_id, severity, started_at
            )

        connection.commit()
        return {"alert_id": alert_id, "action": action, "incident_id": incident_id}

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()

def get_incident(incident_id):

    connection = get_db_connection()

    try:
        cursor = connection.execute(
            "SELECT * FROM incidents WHERE id = ?",
            (incident_id,)
        )
        return cursor.fetchone()
    finally:
        connection.close()

ALLOWED_TRANSITIONS = {
    "open": "investigating",
    "investigating": "resolved",
    "resolved": "closed",
}


def update_incident_status(incident_id, new_status):

    connection = get_db_connection()

    try:
        row = connection.execute(
            "SELECT status FROM incidents WHERE id = ?",
            (incident_id,)
        ).fetchone()

        if row is None:
            return {"success": False, "error": "incident_not_found"}

        current_status = row[0]
        allowed_status = ALLOWED_TRANSITIONS.get(current_status)

        if allowed_status is None or new_status != allowed_status:
            return {
                "success": False,
                "error": "invalid_transition",
                "current_status": current_status,
                "requested_status": new_status,
            }

        closed_at = None

        if new_status == "closed":

            closed_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            cursor = connection.execute(
                """
                UPDATE incidents
                SET status = ?, closed_at = ?
                WHERE id = ? AND status = ?
                """,
                (new_status, closed_at, incident_id, current_status)
            )
        else:

            cursor = connection.execute(
                """
                UPDATE incidents
                SET status = ?
                WHERE id = ? AND status = ?
                """,
                (new_status, incident_id, current_status)
            )

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

def create_investigation(incident_id: int):

    connection = get_db_connection()

    try:
        incident = connection.execute(
            "SELECT id FROM incidents WHERE id = ?" ,
            (incident_id,)

        ).fetchone()

        if incident is None:
            return None

        started_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

        cursor = connection.execute(
            """
            INSERT INTO investigations(incident_id , status , started_at)
            VALUES(? , ? , ?)
            """,
            (incident_id , "running" , started_at)

        )

        investigation_id = cursor.lastrowid

        connection.commit()
        return investigation_id
    except Exception:
        connection.rollback()
        raise
    
    finally:
        connection.close()

