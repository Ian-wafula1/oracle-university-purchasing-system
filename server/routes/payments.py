from flask import Blueprint, request
from utils.db import get_db, rows_to_dict, row_to_dict
from utils.auth import login_required, roles_required
from utils.responses import success, created, error, not_found

payments_bp = Blueprint("payments", __name__, url_prefix="/api/payments")

VALID_METHODS = ("Bank Transfer", "Cheque", "Cash", "Mobile Money", "EFT")


# ── GET /api/payments ────────────────────────────────────────────────────────
@payments_bp.route("", methods=["GET"])
def list_payments():
    invoice_id  = request.args.get("invoice_id")
    supplier_id = request.args.get("supplier_id")

    with get_db() as conn:
        cur = conn.cursor()
        query = """
            SELECT
                p.*,
                i.InvoiceNumber,
                i.InvoiceAmount,
                i.DueDate,
                po.SupplierID,
                s.SupplierName,
                r.ReceiptNumber,
                r.ReceiptDate
            FROM Payments p
            JOIN Invoices i        ON i.InvoiceID  = p.InvoiceID
            JOIN PurchaseOrders po ON po.POID       = i.POID
            JOIN Suppliers s       ON s.SupplierID  = po.SupplierID
            LEFT JOIN Receipts r   ON r.PaymentID   = p.PaymentID
            WHERE 1 = 1
        """
        params = []
        bind_idx = 1
        if invoice_id:
            query += f" AND p.InvoiceID = :{bind_idx}"
            params.append(invoice_id)
            bind_idx += 1
        if supplier_id:
            query += f" AND po.SupplierID = :{bind_idx}"
            params.append(supplier_id)
            bind_idx += 1

        query += " ORDER BY p.PaymentDate DESC"
        cur.execute(query, params)
        return success(rows_to_dict(cur))


# ── POST /api/payments ───────────────────────────────────────────────────────
@payments_bp.route("", methods=["POST"])
@roles_required("approver", "admin")
def create_payment():
    data = request.get_json() or {}
    required = ("invoice_id", "amount_paid", "payment_method", "reference_number", "received_by")
    missing  = [f for f in required if not data.get(f)]
    if missing:
        return error(f"Missing required fields: {', '.join(missing)}")

    if data["payment_method"] not in VALID_METHODS:
        return error(
            f"Invalid payment method. Must be one of: {', '.join(VALID_METHODS)}"
        )

    amount = float(data["amount_paid"])
    if amount <= 0:
        return error("amount_paid must be greater than zero")

    with get_db() as conn:
        cur = conn.cursor()

        cur.execute(
            "SELECT InvoiceAmount, Status FROM Invoices WHERE InvoiceID = :1",
            [data["invoice_id"]],
        )
        invoice = cur.fetchone()
        if not invoice:
            return not_found("Invoice")
        if invoice[1] == "Paid":
            return error("This invoice is already fully paid", 422)
        if invoice[1] == "Disputed":
            return error("Cannot pay a disputed invoice. Resolve the dispute first.", 422)

        cur.execute(
            """
            SELECT NVL(SUM(AmountPaid), 0)
            FROM Payments
            WHERE InvoiceID = :1 AND Status = 'Completed'
            """,
            [data["invoice_id"]],
        )
        already_paid = float(cur.fetchone()[0])
        outstanding  = float(invoice[0]) - already_paid

        if amount > outstanding + 0.01:
            return error(
                f"Payment of {amount:.2f} exceeds outstanding balance of {outstanding:.2f}",
                422,
            )

        # Insert payment
        payment_id_var = cur.var(int)
        cur.execute(
            """
            INSERT INTO Payments
                (InvoiceID, PaymentDate, AmountPaid, PaymentMethod, ReferenceNumber, Status)
            VALUES (:1, TRUNC(SYSDATE), :2, :3, :4, 'Completed')
            RETURNING PaymentID INTO :5
            """,
            [
                data["invoice_id"],
                amount,
                data["payment_method"],
                data["reference_number"],
                payment_id_var,
            ],
        )
        payment_id = payment_id_var.getvalue()
        cur.execute("SELECT * FROM Payments WHERE PaymentID = :1", [payment_id])
        payment = row_to_dict(cur)

        # Auto-generate receipt
        from datetime import datetime
        receipt_number = f"RCP-{datetime.now().year}-{str(payment_id).zfill(4)}"
        receipt_id_var = cur.var(int)
        cur.execute(
            """
            INSERT INTO Receipts (PaymentID, ReceiptNumber, ReceiptDate, ReceivedBy, Notes)
            VALUES (:1, :2, TRUNC(SYSDATE), :3, :4)
            RETURNING ReceiptID INTO :5
            """,
            [
                payment_id,
                receipt_number,
                data["received_by"],
                data.get("notes"),
                receipt_id_var,
            ],
        )
        receipt_id = receipt_id_var.getvalue()
        cur.execute("SELECT * FROM Receipts WHERE ReceiptID = :1", [receipt_id])
        payment["receipt"] = row_to_dict(cur)

    return created(payment, "Payment recorded and receipt generated")


# ── GET /api/payments/<id> ───────────────────────────────────────────────────
@payments_bp.route("/<int:payment_id>", methods=["GET"])
def get_payment(payment_id):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT
                p.*,
                i.InvoiceNumber, i.InvoiceAmount, i.DueDate,
                po.POID, po.SupplierID,
                s.SupplierName,
                r.ReceiptID, r.ReceiptNumber, r.ReceiptDate, r.ReceivedBy
            FROM Payments p
            JOIN Invoices i        ON i.InvoiceID  = p.InvoiceID
            JOIN PurchaseOrders po ON po.POID       = i.POID
            JOIN Suppliers s       ON s.SupplierID  = po.SupplierID
            LEFT JOIN Receipts r   ON r.PaymentID   = p.PaymentID
            WHERE p.PaymentID = :1
            """,
            [payment_id],
        )
        payment = row_to_dict(cur)
        if not payment:
            return not_found("Payment")

    return success(payment)


# ── GET /api/payments/methods  (helper for dropdowns) ────────────────────────
@payments_bp.route("/methods", methods=["GET"])
def payment_methods():
    return success(list(VALID_METHODS))
