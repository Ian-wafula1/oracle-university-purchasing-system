import oracledb
import os
from contextlib import contextmanager
from dotenv import load_dotenv

load_dotenv()

DB_CONFIG = {
    "host":     os.getenv("DB_HOST", "localhost"),
    "port":     int(os.getenv("DB_PORT", 1521)),
    "service":  os.getenv("DB_SERVICE", "ORCLPDB1"),
    "username": os.getenv("DB_USER", "appuser"),
    "password": os.getenv("DB_PASSWORD", "12345"),
}

def get_connection():
    dsn = oracledb.makedsn(
        DB_CONFIG["host"],
        DB_CONFIG["port"],
        service_name=DB_CONFIG["service"]
    )

    return oracledb.connect(
        user=DB_CONFIG["username"],
        password=DB_CONFIG["password"],
        dsn=dsn
    )

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


def _cast_value(val):
    if isinstance(val, oracledb.LOB):
        return val.read()
    return val

def rows_to_dict(cursor):
    cols = [col[0].lower() for col in cursor.description]
    return [dict(zip(cols, (_cast_value(v) for v in row))) for row in cursor]

def row_to_dict(cursor):
    row = cursor.fetchone()
    if not row:
        return None
    cols = [col[0].lower() for col in cursor.description]
    return dict(zip(cols, (_cast_value(v) for v in row)))
