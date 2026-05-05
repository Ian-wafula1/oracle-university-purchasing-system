from flask import Blueprint, request
from utils.db import get_db, rows_to_dict, row_to_dict
from utils.auth import login_required, roles_required
from utils.responses import success, created, error, not_found

invoices_bp = Blueprint("invoices", __name__, url_prefix="/api/invoices")


# ── GET /api/invoices ────────────────────────────────────────────────────────
@invoices_bp.route("", methods=["GET"])

def list_invoices():
    status      = request.args.get("status")
    supplier_id = request.args.get("supplier_id")
    po_id       = request.args.get("po_id")

    with get_db() as conn:
        cur = conn.cursor()
        query = """
            SELECT
                i.*,
                po.SupplierID,
                s.SupplierName,
                ISNULL(SUM(p.AmountPaid), 0)             AS TotalPaid,
                i.InvoiceAmount - ISNULL(SUM(p.AmountPaid), 0) AS BalanceOutstanding,
                CASE WHEN i.DueDate < CAST(GETDATE() AS DATE) AND i.Status != 'Paid'
                     THEN DATEDIFF(DAY, i.DueDate, GETDATE()) ELSE 0
                END AS DaysOverdue
            FROM Invoices i
            JOIN PurchaseOrders po ON po.POID      = i.POID
            JOIN Suppliers s       ON s.SupplierID = po.SupplierID
            LEFT JOIN Payments p   ON p.InvoiceID  = i.InvoiceID AND p.Status = 'Completed'
            WHERE 1 = 1
        """
        params = []
        if status:
            query += " AND i.Status = ?"
            params.append(status)
        if supplier_id:
            query += " AND po.SupplierID = ?"
            params.append(supplier_id)
        if po_id:
            query += " AND i.POID = ?"
            params.append(po_id)

        query += """
            GROUP BY i.InvoiceID, i.POID, i.InvoiceNumber, i.InvoiceDate,
                     i.InvoiceAmount, i.Status, i.DueDate, i.Notes,
                     po.SupplierID, s.SupplierName
            ORDER BY i.InvoiceDate DESC
        """
        cur.execute(query, params)
        return success(rows_to_dict(cur))


# ── GET /api/invoices/unpaid ─────────────────────────────────────────────────
@invoices_bp.route("/unpaid", methods=["GET"])

def list_unpaid_invoices():
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM Unpaid_Invoice_Report ORDER BY DaysOverdue DESC")
        return success(rows_to_dict(cur))


# ── POST /api/invoices ───────────────────────────────────────────────────────
@invoices_bp.route("", methods=["POST"])

def create_invoice():
    data = request.get_json() or {}
    required = ("po_id", "invoice_number", "invoice_date", "invoice_amount", "due_date")
    missing  = [f for f in required if not data.get(f)]
    if missing:
        return error(f"Missing required fields: {', '.join(missing)}")

    invoice_id = None
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            DECLARE @ID INT;
            EXEC usp_RecordInvoice
                @POID          = ?,
                @InvoiceNumber = ?,
                @InvoiceDate   = ?,
                @InvoiceAmount = ?,
                @DueDate       = ?,
                @Notes         = ?,
                @InvoiceID     = @ID OUTPUT;
            SELECT @ID;
            """,
            data["po_id"],
            data["invoice_number"],
            data["invoice_date"],
            data["invoice_amount"],
            data["due_date"],
            data.get("notes"),
        )
        row = cur.fetchone()

        # Fallback: insert directly if proc doesn't return cleanly via pyodbc
        if not row:
            cur.execute(
                """
                INSERT INTO Invoices
                    (POID, InvoiceNumber, InvoiceDate, InvoiceAmount, Status, DueDate, Notes)
                OUTPUT INSERTED.*
                VALUES (?, ?, ?, ?, 'Received', ?, ?)
                """,
                data["po_id"],
                data["invoice_number"],
                data["invoice_date"],
                data["invoice_amount"],
                data["due_date"],
                data.get("notes"),
            )
            invoice = row_to_dict(cur)
        else:
            invoice_id = row[0]
            cur.execute("SELECT * FROM Invoices WHERE InvoiceID = ?", invoice_id)
            invoice = row_to_dict(cur)

    return created(invoice, "Invoice recorded")


# ── GET /api/invoices/<id> ───────────────────────────────────────────────────
@invoices_bp.route("/<int:invoice_id>", methods=["GET"])

def get_invoice(invoice_id):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT
                i.*,
                po.SupplierID,
                s.SupplierName,
                s.Email AS SupplierEmail,
                ISNULL(SUM(p.AmountPaid), 0)                  AS TotalPaid,
                i.InvoiceAmount - ISNULL(SUM(p.AmountPaid), 0) AS BalanceOutstanding
            FROM Invoices i
            JOIN PurchaseOrders po ON po.POID      = i.POID
            JOIN Suppliers s       ON s.SupplierID = po.SupplierID
            LEFT JOIN Payments p   ON p.InvoiceID  = i.InvoiceID AND p.Status = 'Completed'
            WHERE i.InvoiceID = ?
            GROUP BY i.InvoiceID, i.POID, i.InvoiceNumber, i.InvoiceDate,
                     i.InvoiceAmount, i.Status, i.DueDate, i.Notes,
                     po.SupplierID, s.SupplierName, s.Email
            """,
            invoice_id,
        )
        invoice = row_to_dict(cur)
        if not invoice:
            return not_found("Invoice")

        # PO line items for reference / auto-fill
        cur.execute(
            """
            SELECT pod.*, i2.ItemName, i2.Unit
            FROM PurchaseOrderDetails pod
            JOIN Items i2 ON i2.ItemID = pod.ItemID
            WHERE pod.POID = ?
            """,
            invoice["POID"],
        )
        invoice["po_items"] = rows_to_dict(cur)

        # Payment history
        cur.execute(
            """
            SELECT p.*, r.ReceiptNumber, r.ReceiptDate
            FROM Payments p
            LEFT JOIN Receipts r ON r.PaymentID = p.PaymentID
            WHERE p.InvoiceID = ?
            ORDER BY p.PaymentDate
            """,
            invoice_id,
        )
        invoice["payments"] = rows_to_dict(cur)

    return success(invoice)


# ── PUT /api/invoices/<id> ───────────────────────────────────────────────────
@invoices_bp.route("/<int:invoice_id>", methods=["PUT"])
@roles_required("approver", "admin")
def update_invoice(invoice_id):
    data = request.get_json() or {}
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT Status FROM Invoices WHERE InvoiceID = ?", invoice_id)
        row = cur.fetchone()
        if not row:
            return not_found("Invoice")
        if row[0] == "Paid":
            return error("Paid invoices cannot be modified", 422)

        # Dispute action
        if data.get("action") == "dispute":
            reason = data.get("reason", "No reason provided")
            cur.execute(
                "EXEC usp_DisputeInvoice @InvoiceID = ?, @Reason = ?",
                invoice_id, reason,
            )
        else:
            cur.execute(
                """
                UPDATE Invoices
                SET DueDate       = ISNULL(?, DueDate),
                    InvoiceAmount = ISNULL(?, InvoiceAmount),
                    Notes         = ISNULL(?, Notes)
                WHERE InvoiceID = ?
                """,
                data.get("due_date"),
                data.get("invoice_amount"),
                data.get("notes"),
                invoice_id,
            )

        cur.execute("SELECT * FROM Invoices WHERE InvoiceID = ?", invoice_id)
        updated = row_to_dict(cur)

    return success(updated, "Invoice updated")
