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
                "SELECT * FROM Suppliers WHERE Status = :1 ORDER BY SupplierName", [status]
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

        # Oracle stored procedures are called via BEGIN/END anonymous blocks
        supplier_id_var  = cur.var(int)
        application_id_var = cur.var(int)
        cur.execute(
            """
            BEGIN
                usp_RegisterSupplier(
                    p_SupplierName  => :1,
                    p_Address       => :2,
                    p_Phone         => :3,
                    p_Email         => :4,
                    p_ReviewNotes   => :5,
                    p_SupplierID    => :6,
                    p_ApplicationID => :7
                );
            END;
            """,
            [
                data.get("supplier_name"),
                data.get("address"),
                data.get("phone"),
                data.get("email"),
                review_notes,
                supplier_id_var,
                application_id_var,
            ],
        )

        # Re-fetch the inserted supplier row using the OUT param ID
        cur.execute(
            "SELECT * FROM Suppliers WHERE SupplierID = :1",
            [supplier_id_var.getvalue()],
        )
        supplier = row_to_dict(cur)

        # Fetch the application ID returned by the proc
        supplier["ApplicationID"] = application_id_var.getvalue()

    conn.commit()
    return created(supplier, "Supplier registered and application submitted")


# ── GET /api/suppliers/<id> ──────────────────────────────────────────────────
@suppliers_bp.route("/<int:supplier_id>", methods=["GET"])
def get_supplier(supplier_id):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM Suppliers WHERE SupplierID = :1", [supplier_id])
        supplier = row_to_dict(cur)
        if not supplier:
            return not_found("Supplier")

        # Applications subform
        cur.execute(
            "SELECT * FROM SupplierApplications WHERE SupplierID = :1 ORDER BY ApplicationDate DESC",
            [supplier_id],
        )
        supplier["applications"] = rows_to_dict(cur)

        # Active contracts summary
        cur.execute(
            """
            SELECT ContractID, ContractNumber, StartDate, EndDate, ContractStatus
            FROM Contracts WHERE SupplierID = :1 ORDER BY StartDate DESC
            """,
            [supplier_id],
        )
        supplier["contracts"] = rows_to_dict(cur)

    return success(supplier)


# ── PUT /api/suppliers/<id> ──────────────────────────────────────────────────
@suppliers_bp.route("/<int:supplier_id>", methods=["PUT"])
def update_supplier(supplier_id):
    data = request.get_json() or {}
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM Suppliers WHERE SupplierID = :1", [supplier_id])
        if not cur.fetchone():
            return not_found("Supplier")

        # Oracle: COALESCE(:bind, column) preserves existing value when param is NULL
        cur.execute(
            """
            UPDATE Suppliers
            SET SupplierName = COALESCE(:1, SupplierName),
                Address      = COALESCE(:2, Address),
                Phone        = COALESCE(:3, Phone),
                Email        = COALESCE(:4, Email)
            WHERE SupplierID = :5
            """,
            [
                data.get("supplier_name"),
                data.get("address"),
                data.get("phone"),
                data.get("email"),
                supplier_id,
            ],
        )
        conn.commit()

        cur.execute("SELECT * FROM Suppliers WHERE SupplierID = :1", [supplier_id])
        updated = row_to_dict(cur)

    return success(updated, "Supplier updated")


# ── DELETE /api/suppliers/<id> ───────────────────────────────────────────────
@suppliers_bp.route("/<int:supplier_id>", methods=["DELETE"])
@roles_required("admin")
def delete_supplier(supplier_id):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM Suppliers WHERE SupplierID = :1", [supplier_id])
        if not cur.fetchone():
            return not_found("Supplier")
        try:
            cur.execute("DELETE FROM Suppliers WHERE SupplierID = :1", [supplier_id])
            conn.commit()
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

        # Oracle: FETCH FIRST 1 ROWS ONLY instead of TOP 1
        cur.execute(
            """
            SELECT ApplicationID FROM SupplierApplications
            WHERE SupplierID = :1 AND ApprovalStatus = 'Pending'
            ORDER BY ApplicationDate DESC
            FETCH FIRST 1 ROWS ONLY
            """,
            [supplier_id],
        )
        row = cur.fetchone()
        if not row:
            return error("No pending application found for this supplier", 404)

        # Oracle stored procedure call via anonymous BEGIN/END block
        cur.execute(
            """
            BEGIN
                usp_ProcessSupplierApplication(
                    p_ApplicationID => :1,
                    p_Decision      => :2,
                    p_ReviewNotes   => :3
                );
            END;
            """,
            [row[0], decision, notes],
        )
        conn.commit()

        cur.execute("SELECT * FROM Suppliers WHERE SupplierID = :1", [supplier_id])
        updated = row_to_dict(cur)

    return success(updated, f"Supplier {decision.lower()}")
