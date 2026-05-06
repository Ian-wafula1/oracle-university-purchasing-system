import oracledb

conn = oracledb.connect(
    user="system",
    password="12345",
    dsn="172.22.176.1:1521/XEPDB1"
)

cur = conn.cursor()
cur.execute("SELECT 1 FROM dual")

print(cur.fetchone())
