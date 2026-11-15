import sqlite3

from ..database import DB_PATH


def get_read_connection(): #Read-only connection through DB
    connection = sqlite3.connect(
        f"{DB_PATH.as_uri()}?mode=ro",
        uri=True
    )

    connection.row_factory = sqlite3.Row

    return connection

