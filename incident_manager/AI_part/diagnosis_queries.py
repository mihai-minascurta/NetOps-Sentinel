import sqlite3 , json

from ..database import DB_PATH



def get_read_connection(): #Read-only connection through DB
    connection = sqlite3.connect(
        f"{DB_PATH.as_uri()}?mode=ro",
        uri=True
    )

    connection.row_factory = sqlite3.Row

    return connection

def get_investigation(investigation_id: int) -> dict | None:
    connection = get_read_connection()

    try:
        row = connection.execute(
            """
            SELECT id , incident_id , status , started_at , finished_at
            FROM investigations
            WHERE id = ?
            """,
            (investigation_id,),
        ).fetchone()

        if row is None:
            return None
        
        return dict(row) #Dictionary format,not tuple
    finally:
        connection.close()

def get_incident(incident_id: int) -> dict | None:

    connection = get_read_connection()

    try:
        row = connection.execute(
            """
            SELECT id , status , severity , opened_at , closed_at , root_cause
            FROM incidents
            WHERE id = ?
            """,
            (incident_id,),
        ).fetchone()

        if row is None:
            return None
        
        return dict(row)
    finally:
        connection.close()

def get_incident_alerts(incident_id: int) -> list[dict]:

    connection = get_read_connection()

    try:   
        rows = connection.execute(
            """
            SELECT a.id , a.fingerprint , a.alertname, a.router , a.state , a.started_at , a.ended_at
            FROM alerts AS a
                JOIN incident_alerts as ia
                ON ia.alert_id = a.id
            WHERE ia.incident_id = ?
            """,
            (incident_id,),

        ).fetchall() #fetchall because it returns a list of rows,not a tuple

        result = []
        for row in rows:
            result.append(dict(row))
        return result
    finally:
        connection.close()

def get_evidences(investigation_id: int) -> list[dict]:
    connection = get_read_connection()

    try:
        rows = connection.execute(
            """
            SELECT id, investigation_id, check_type, status, result, collected_at
            FROM evidences
            WHERE investigation_id = ?
            """,
            (investigation_id,),
        ).fetchall()

        result = []

        for row in rows:
            evidence = dict(row)

            if evidence["result"] is not None:
                evidence["result"] = json.loads(evidence["result"])

            result.append(evidence)

        return result

    finally:
        connection.close()

