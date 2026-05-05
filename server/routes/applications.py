from flask import Blueprint, request
from utils.db import get_db, rows_to_dict, row_to_dict
from utils.auth import login_required, roles_required
from utils.responses import success, created, error, not_found

applications_bp = Blueprint("applications", __name__, url_prefix="/api/applications")

@applications_bp.route("", methods=["GET"])
def list_applications():
    status = request.args.get("status")
    with get_db() as conn:
        cur = conn.cursor()
        if status:
            cur.execute(
                """
                SELECT sa.*, s.SupplierName, s.Email, s.Phone
                FROM SupplierApplications sa
                JOIN Suppliers s ON s.SupplierID = sa.SupplierID
                WHERE sa.ApprovalStatus = ?
                ORDER BY sa.ApplicationDate DESC
                """,
                status,
            )
        else:
            cur.execute(
                """
                SELECT sa.*, s.SupplierName, s.Email, s.Phone
                FROM SupplierApplications sa
                JOIN Suppliers s ON s.SupplierID = sa.SupplierID
                ORDER BY sa.ApplicationDate DESC
                """
            )
        return success(rows_to_dict(cur))

@applications_bp.route("", methods=["POST"])
def create_application():
    data = request.get_json() or {}
    if not data.get("supplier_id"):
        return error("supplier_id is required")

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT Status FROM Suppliers WHERE SupplierID = ?", data["supplier_id"]
        )
        supplier = cur.fetchone()
        if not supplier:
            return not_found("Supplier")

        # Prevent duplicate pending applications
        cur.execute(
            """
            SELECT 1 FROM SupplierApplications
            WHERE SupplierID = ? AND ApprovalStatus = 'Pending'
            """,
            data["supplier_id"],
        )
        if cur.fetchone():
            return error("This supplier already has a pending application", 409)

        cur.execute(
            """
            INSERT INTO SupplierApplications
                (SupplierID, ApplicationDate, ApprovalStatus, ReviewNotes)
            OUTPUT INSERTED.*
            VALUES (?, CAST(GETDATE() AS DATE), 'Pending', ?)
            """,
            data["supplier_id"],
            data.get("review_notes"),
        )
        application = row_to_dict(cur)

    return created(application, "Application submitted")

@applications_bp.route("/<int:application_id>", methods=["PUT"])
@roles_required("approver", "admin")
def update_application(application_id):
    data     = request.get_json() or {}
    decision = data.get("approval_status")
    notes    = data.get("review_notes")

    if decision and decision not in ("Approved", "Rejected", "Pending"):
        return error("approval_status must be Approved, Rejected, or Pending")

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT * FROM SupplierApplications WHERE ApplicationID = ?", application_id
        )
        app = row_to_dict(cur)
        if not app:
            return not_found("Application")

        if decision in ("Approved", "Rejected"):
            cur.execute(
                "EXEC usp_ProcessSupplierApplication @ApplicationID = ?, @Decision = ?, @ReviewNotes = ?",
                application_id, decision, notes,
            )
        else:
            cur.execute(
                """
                UPDATE SupplierApplications
                SET ReviewNotes = ISNULL(?, ReviewNotes)
                WHERE ApplicationID = ?
                """,
                notes, application_id,
            )

        cur.execute(
            """
            SELECT sa.*, s.SupplierName
            FROM SupplierApplications sa
            JOIN Suppliers s ON s.SupplierID = sa.SupplierID
            WHERE sa.ApplicationID = ?
            """,
            application_id,
        )
        updated = row_to_dict(cur)

    return success(updated, "Application updated")
