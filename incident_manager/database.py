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
