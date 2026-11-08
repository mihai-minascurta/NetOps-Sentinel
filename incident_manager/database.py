import sqlite3
from pathlib import Path

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

def save_alert(connection, fingerprint, alertname, router, status, started_at):

    cursor = connection.execute(
        """
        SELECT id, state
        FROM alerts
        WHERE fingerprint = ? AND started_at = ?
        """,
        (fingerprint, started_at)
    )

    existing_alert = cursor.fetchone()

    if existing_alert is None:
        cursor = connection.execute(
            """
            INSERT INTO alerts
                (fingerprint, alertname, router, state, started_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (fingerprint, alertname, router, status, started_at)
        )

        return cursor.lastrowid, "created"

    alert_id, old_status = existing_alert

    if old_status != status:
        connection.execute(
            "UPDATE alerts SET state = ? WHERE id = ?",
            (status, alert_id)
        )
        return alert_id, "updated"

    return alert_id, "duplicate"

def create_incident_for_alert(connection, alert_id, severity, opened_at):
    
    cursor = connection.execute(
        """
        INSERT INTO incidents (status, severity, opened_at)
        VALUES (?, ?, ?)
        """,
        ("open", severity, opened_at)
    )

    incident_id = cursor.lastrowid

    connection.execute(
        """
        INSERT INTO incident_alerts (incident_id, alert_id)
        VALUES (?, ?)
        """,
        (incident_id, alert_id)
    )

    return incident_id

def process_alert(fingerprint, alertname, router, status, started_at, severity):

    connection = get_db_connection()

    try:
        alert_id, action = save_alert(
            connection,
            fingerprint,
            alertname,
            router,
            status,
            started_at
        )

        incident_id = None

        if action == "created" and status == "firing":
            incident_id = create_incident_for_alert(
                connection,
                alert_id,
                severity,
                started_at
            )

        connection.commit()
        return {
            "alert_id": alert_id,
            "action": action,
            "incident_id": incident_id
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()