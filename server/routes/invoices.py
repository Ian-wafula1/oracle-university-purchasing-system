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
                i.InvoiceID,
                i.POID,
                i.InvoiceNumber,
                i.InvoiceDate,
                i.InvoiceAmount,
                i.Status,
                i.DueDate,
                TO_CHAR(i.Notes)                                 AS Notes,
                po.SupplierID,
                s.SupplierName,
                NVL(SUM(p.AmountPaid), 0)                        AS TotalPaid,
                i.InvoiceAmount - NVL(SUM(p.AmountPaid), 0)      AS BalanceOutstanding,
                CASE WHEN i.DueDate < TRUNC(SYSDATE) AND i.Status != 'Paid'
                    THEN TRUNC(SYSDATE) - i.DueDate ELSE 0
                END AS DaysOverdue
            FROM Invoices i
            JOIN (SELECT POID, SupplierID FROM PurchaseOrders) po ON po.POID = i.POID
            JOIN Suppliers s       ON s.SupplierID = po.SupplierID
            LEFT JOIN Payments p   ON p.InvoiceID  = i.InvoiceID AND p.Status = 'Completed'
            WHERE 1 = 1
        """
        params = []
        bind_idx = 1
        if status:
            query += f" AND i.Status = :{bind_idx}"
            params.append(status)
            bind_idx += 1
        if supplier_id:
            query += f" AND po.SupplierID = :{bind_idx}"
            params.append(supplier_id)
            bind_idx += 1
        if po_id:
            query += f" AND i.POID = :{bind_idx}"
            params.append(po_id)
            bind_idx += 1

        query += """
            GROUP BY i.InvoiceID, i.POID, i.InvoiceNumber, i.InvoiceDate,
                     i.InvoiceAmount, i.Status, i.DueDate, TO_CHAR(i.Notes),
                     po.SupplierID, s.SupplierName,
                     CASE WHEN i.DueDate < TRUNC(SYSDATE) AND i.Status != 'Paid'
                          THEN TRUNC(SYSDATE) - i.DueDate ELSE 0
                     END
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

    with get_db() as conn:
        cur = conn.cursor()

        invoice_id_var = cur.var(int)
        try:
            cur.callproc(
                "usp_RecordInvoice",
                [
                    data["po_id"],
                    data["invoice_number"],
                    data["invoice_date"],
                    data["invoice_amount"],
                    data["due_date"],
                    data.get("notes"),
                    invoice_id_var,
                ],
            )
            invoice_id = invoice_id_var.getvalue()
        except Exception:
            invoice_id = None

        if not invoice_id:
            # Fallback: insert directly
            invoice_id_var = cur.var(int)
            cur.execute(
                """
                INSERT INTO Invoices
                    (POID, InvoiceNumber, InvoiceDate, InvoiceAmount, Status, DueDate, Notes)
                VALUES (:1, :2, :3, :4, 'Received', :5, :6)
                RETURNING InvoiceID INTO :7
                """,
                [
                    data["po_id"],
                    data["invoice_number"],
                    data["invoice_date"],
                    data["invoice_amount"],
                    data["due_date"],
                    data.get("notes"),
                    invoice_id_var,
                ],
            )
            invoice_id = invoice_id_var.getvalue()

        cur.execute("SELECT * FROM Invoices WHERE InvoiceID = :1", [invoice_id])
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
                i.InvoiceID,
                i.POID,
                i.InvoiceNumber,
                i.InvoiceDate,
                i.InvoiceAmount,
                i.Status,
                i.DueDate,
                TO_CHAR(i.Notes)                                 AS Notes,
                po.SupplierID,
                s.SupplierName,
                s.Email                                          AS SupplierEmail,
                NVL(SUM(p.AmountPaid), 0)                        AS TotalPaid,
                i.InvoiceAmount - NVL(SUM(p.AmountPaid), 0)      AS BalanceOutstanding
            FROM Invoices i
            JOIN PurchaseOrders po ON po.POID      = i.POID
            JOIN Suppliers s       ON s.SupplierID = po.SupplierID
            LEFT JOIN Payments p   ON p.InvoiceID  = i.InvoiceID AND p.Status = 'Completed'
            WHERE i.InvoiceID = :1
            GROUP BY i.InvoiceID, i.POID, i.InvoiceNumber, i.InvoiceDate,
                     i.InvoiceAmount, i.Status, i.DueDate, TO_CHAR(i.Notes),
                     po.SupplierID, s.SupplierName, s.Email
            """,
            [invoice_id],
        )
        invoice = row_to_dict(cur)
        if not invoice:
            return not_found("Invoice")

        cur.execute(
            """
            SELECT pod.*, i2.ItemName, i2.Unit
            FROM PurchaseOrderDetails pod
            JOIN Items i2 ON i2.ItemID = pod.ItemID
            WHERE pod.POID = :1
            """,
            [invoice["POID"]],
        )
        invoice["po_items"] = rows_to_dict(cur)

        cur.execute(
            """
            SELECT p.*, r.ReceiptNumber, r.ReceiptDate
            FROM Payments p
            LEFT JOIN Receipts r ON r.PaymentID = p.PaymentID
            WHERE p.InvoiceID = :1
            ORDER BY p.PaymentDate
            """,
            [invoice_id],
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
        cur.execute(
            "SELECT Status FROM Invoices WHERE InvoiceID = :1", [invoice_id]
        )
        row = cur.fetchone()
        if not row:
            return not_found("Invoice")
        if row[0] == "Paid":
            return error("Paid invoices cannot be modified", 422)

        if data.get("action") == "dispute":
            reason = data.get("reason", "No reason provided")
            cur.callproc("usp_DisputeInvoice", [invoice_id, reason])
        else:
            cur.execute(
                """
                UPDATE Invoices
                SET DueDate       = NVL(:1, DueDate),
                    InvoiceAmount = NVL(:2, InvoiceAmount),
                    Notes         = CASE WHEN :3 IS NOT NULL THEN TO_CLOB(:3) ELSE Notes END
                WHERE InvoiceID   = :4
                """,
                [
                    data.get("due_date"),
                    data.get("invoice_amount"),
                    data.get("notes"),
                    invoice_id,
                ],
            )

        cur.execute(
            "SELECT * FROM Invoices WHERE InvoiceID = :1", [invoice_id]
        )
        updated = row_to_dict(cur)

    return success(updated, "Invoice updated")
