# Supplier Management System — Flask Backend

## Project Structure

```
server/
├── app.py                     # App factory & entry point
├── requirements.txt
├── .env.example               # Copy to .env and fill in values
├── create_users_table.sql     # Run once to create the Users auth table
│
├── utils/
│   ├── db.py                  # pyodbc connection + row helpers
│   ├── auth.py                # JWT encode/decode + decorators
│   └── responses.py           # Standardised success/error helpers
│
└── routes/
    ├── auth.py                # /api/auth/*
    ├── suppliers.py           # /api/suppliers/*
    ├── applications.py        # /api/applications/*
    ├── items.py               # /api/items/*
    ├── contracts.py           # /api/contracts/* + /api/contract-items/*
    ├── purchase_orders.py     # /api/purchase-orders/* + /api/order-details/*
    ├── invoices.py            # /api/invoices/*
    ├── payments.py            # /api/payments/*
    ├── receipts.py            # /api/receipts/*
    ├── reports.py             # /api/reports/*
    └── dashboard.py           # /api/dashboard
```

---

## Setup

### 1. Prerequisites
- Python 3.10+
- Microsoft SQL Server with ODBC Driver 17
- Database already created with all tables, views, triggers, and stored procedures

### 2. Install dependencies
```bash
cd server
pip install -r requirements.txt
```

### 3. Configure environment
```bash
cp .env.example .env
# Edit .env with your DB credentials and a strong JWT secret
```

### 4. Create the Users table
Run create_users_table.sql against your SQL Server database once:
```bash
sqlcmd -S localhost -d SupplierDB -i create_users_table.sql
```

### 5. Start the server
```bash
python app.py
```
The API will be available at http://localhost:5000.

---

## Authentication

All endpoints (except /api/health) require a valid JWT:
```
Authorization: Bearer <token>
```

Roles: viewer (GET only) | approver (GET + write) | admin (full access)

Auth endpoints: POST /api/auth/register, POST /api/auth/login,
GET /api/auth/me, POST /api/auth/change-password

---

## Response Format

All endpoints return a consistent envelope:
  Success: { "success": true, "message": "OK", "data": { ... } }
  Error:   { "success": false, "error": "Reason" }

Dates: ISO 8601 strings. Decimals: floats.

---

## Health Check

GET /api/health — no auth required, returns DB connectivity status.
