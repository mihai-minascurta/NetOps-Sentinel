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

def save_alert(fingerprint, alertname, router, status, started_at):
    connection = get_db_connection()

    try:
        cursor = connection.execute(
            """
            SELECT id, state
            FROM alerts
            WHERE fingerprint = ?
              AND started_at = ?
            """,
            (fingerprint, started_at)
        )

        existing_alert = cursor.fetchone()

        if existing_alert is None:
            connection.execute(
                """
                INSERT INTO alerts
                    (fingerprint, alertname, router, state, started_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (fingerprint, alertname, router, status, started_at)
            )
            action = "created"

        elif existing_alert[1] != status:
            connection.execute(
                "UPDATE alerts SET state = ? WHERE id = ?",
                (status, existing_alert[0])
            )
            action = "updated"

        else:
            action = "duplicate"

        connection.commit()
        return action

    finally:
        connection.close()