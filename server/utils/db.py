import pyodbc
import os
from contextlib import contextmanager
from dotenv import load_dotenv

load_dotenv()

DB_CONFIG = {
    "server":   os.getenv("DB_SERVER", "localhost"),
    "database": os.getenv("DB_NAME",   "SupplierDB"),
    "username": os.getenv("DB_USER",   "appuser"),
    "password": os.getenv("DB_PASSWORD", "12345"),
    "driver":   os.getenv("DB_DRIVER", "ODBC Driver 18 for SQL Server"),
}

def get_connection():
    conn_str = (
        f"DRIVER={{{DB_CONFIG['driver']}}};"
        f"SERVER={DB_CONFIG['server']},1433;"
        f"DATABASE={DB_CONFIG['database']};"
        f"UID={DB_CONFIG['username']};"
        f"PWD={DB_CONFIG['password']};"
        "Encrypt=yes;"
        "TrustServerCertificate=yes;"
    )
    return pyodbc.connect(conn_str)


@contextmanager
def get_db():
    """Context manager — always closes the connection."""
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def rows_to_dict(cursor):
    """Convert pyodbc rows to a list of dicts."""
    columns = [col[0] for col in cursor.description]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]


def row_to_dict(cursor):
    """Convert a single pyodbc row to a dict, or None."""
    columns = [col[0] for col in cursor.description]
    row = cursor.fetchone()
    return dict(zip(columns, row)) if row else None
