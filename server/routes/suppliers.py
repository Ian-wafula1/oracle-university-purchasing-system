from flask import Blueprint, request
from utils.db import get_db, rows_to_dict, row_to_dict
from utils.auth import login_required, roles_required
from utils.responses import success, created, error, not_found

suppliers_bp = Blueprint("suppliers", __name__, url_prefix="/api/suppliers")


# ── GET /api/suppliers ───────────────────────────────────────────────────────
@suppliers_bp.route("", methods=["GET"])
def list_suppliers():
    status = request.args.get("status")
    with get_db() as conn:
        cur = conn.cursor()
        if status:
            cur.execute(
                "SELECT * FROM Suppliers WHERE Status = ? ORDER BY SupplierName", status
            )
        else:
            cur.execute("SELECT * FROM Suppliers ORDER BY SupplierName")
        return success(rows_to_dict(cur))


# ── POST /api/suppliers ──────────────────────────────────────────────────────
@suppliers_bp.route("", methods=["POST"])

def create_supplier():
    data = request.get_json() or {}
    required = ("supplier_name", "email")
    missing  = [f for f in required if not data.get(f)]
    if missing:
        return error(f"Missing required fields: {', '.join(missing)}")

    review_notes = data.get("review_notes")

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            EXEC usp_RegisterSupplier
                @SupplierName  = ?,
                @Address       = ?,
                @Phone         = ?,
                @Email         = ?,
                @ReviewNotes   = ?,
                @SupplierID    = ? OUTPUT,
                @ApplicationID = ? OUTPUT
            """,
            data.get("supplier_name"),
            data.get("address"),
            data.get("phone"),
            data.get("email"),
            review_notes,
            0, 0,
        )
        # Re-fetch the new supplier using OUTPUT from the proc
        cur.execute(
            """
            INSERT INTO Suppliers (SupplierName, Address, Phone, Email, Status)
            OUTPUT INSERTED.*
            VALUES (?, ?, ?, ?, 'Applied')
            """,
            data.get("supplier_name"),
            data.get("address"),
            data.get("phone"),
            data.get("email"),
        )
        supplier = row_to_dict(cur)

        # Create application
        cur.execute(
            """
            INSERT INTO SupplierApplications
                (SupplierID, ApplicationDate, ApprovalStatus, ReviewNotes)
            OUTPUT INSERTED.ApplicationID
            VALUES (?, CAST(GETDATE() AS DATE), 'Pending', ?)
            """,
            supplier["SupplierID"], review_notes,
        )
        app_row = cur.fetchone()

    supplier["ApplicationID"] = app_row[0] if app_row else None
    return created(supplier, "Supplier registered and application submitted")


# ── GET /api/suppliers/<id> ──────────────────────────────────────────────────
@suppliers_bp.route("/<int:supplier_id>", methods=["GET"])
def get_supplier(supplier_id):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM Suppliers WHERE SupplierID = ?", supplier_id)
        supplier = row_to_dict(cur)
        if not supplier:
            return not_found("Supplier")

        # Applications subform
        cur.execute(
            "SELECT * FROM SupplierApplications WHERE SupplierID = ? ORDER BY ApplicationDate DESC",
            supplier_id,
        )
        supplier["applications"] = rows_to_dict(cur)

        # Active contracts summary
        cur.execute(
            """
            SELECT ContractID, ContractNumber, StartDate, EndDate, ContractStatus
            FROM Contracts WHERE SupplierID = ? ORDER BY StartDate DESC
            """,
            supplier_id,
        )
        supplier["contracts"] = rows_to_dict(cur)

    return success(supplier)


# ── PUT /api/suppliers/<id> ──────────────────────────────────────────────────
@suppliers_bp.route("/<int:supplier_id>", methods=["PUT"])
def update_supplier(supplier_id):
    data = request.get_json() or {}
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM Suppliers WHERE SupplierID = ?", supplier_id)
        if not cur.fetchone():
            return not_found("Supplier")

        cur.execute(
            """
            UPDATE Suppliers
            SET SupplierName = ISNULL(?, SupplierName),
                Address      = ISNULL(?, Address),
                Phone        = ISNULL(?, Phone),
                Email        = ISNULL(?, Email)
            WHERE SupplierID = ?
            """,
            data.get("supplier_name"),
            data.get("address"),
            data.get("phone"),
            data.get("email"),
            supplier_id,
        )
        cur.execute("SELECT * FROM Suppliers WHERE SupplierID = ?", supplier_id)
        updated = row_to_dict(cur)

    return success(updated, "Supplier updated")


# ── DELETE /api/suppliers/<id> ───────────────────────────────────────────────
@suppliers_bp.route("/<int:supplier_id>", methods=["DELETE"])
@roles_required("admin")
def delete_supplier(supplier_id):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM Suppliers WHERE SupplierID = ?", supplier_id)
        if not cur.fetchone():
            return not_found("Supplier")
        try:
            cur.execute("DELETE FROM Suppliers WHERE SupplierID = ?", supplier_id)
        except Exception as e:
            return error(str(e), 409)

    return success(message="Supplier deleted")


# ── PUT /api/suppliers/<id>/approve ─────────────────────────────────────────
@suppliers_bp.route("/<int:supplier_id>/approve", methods=["PUT"])
def approve_supplier(supplier_id):
    data     = request.get_json() or {}
    decision = data.get("decision")        # 'Approved' or 'Rejected'
    notes    = data.get("review_notes")

    if decision not in ("Approved", "Rejected"):
        return error("decision must be 'Approved' or 'Rejected'")

    with get_db() as conn:
        cur = conn.cursor()
        # Get the latest pending application for this supplier
        cur.execute(
            """
            SELECT TOP 1 ApplicationID FROM SupplierApplications
            WHERE SupplierID = ? AND ApprovalStatus = 'Pending'
            ORDER BY ApplicationDate DESC
            """,
            supplier_id,
        )
        row = cur.fetchone()
        if not row:
            return error("No pending application found for this supplier", 404)

        cur.execute(
            "EXEC usp_ProcessSupplierApplication @ApplicationID = ?, @Decision = ?, @ReviewNotes = ?",
            row[0], decision, notes,
        )
        cur.execute("SELECT * FROM Suppliers WHERE SupplierID = ?", supplier_id)
        updated = row_to_dict(cur)

    return success(updated, f"Supplier {decision.lower()}")
