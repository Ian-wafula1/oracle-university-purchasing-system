from flask import Blueprint, request
from utils.db import get_db, rows_to_dict, row_to_dict
from utils.auth import login_required
from utils.responses import success, error

reports_bp = Blueprint("reports", __name__, url_prefix="/api/reports")


# ── /api/reports/active-contracts ───────────────────────────────────────────
@reports_bp.route("/active-contracts", methods=["GET"])

def active_contracts():
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM Active_Contracts_Report ORDER BY DaysUntilExpiry ASC")
        return success(rows_to_dict(cur))


# ── /api/reports/invoice-totals ─────────────────────────────────────────────
@reports_bp.route("/invoice-totals", methods=["GET"])

def invoice_totals():
    supplier_id = request.args.get("supplier_id")
    year        = request.args.get("year")

    with get_db() as conn:
        cur = conn.cursor()
        query = "SELECT * FROM Invoice_Totals_Report WHERE 1 = 1"
        params = []
        if supplier_id:
            query += " AND SupplierID = ?"
            params.append(supplier_id)
        if year:
            query += " AND InvoiceYear = ?"
            params.append(year)

        query += " ORDER BY SupplierName, InvoiceYear, InvoiceMonth"
        cur.execute(query, params)
        return success(rows_to_dict(cur))


# ── /api/reports/item-usage ──────────────────────────────────────────────────
@reports_bp.route("/item-usage", methods=["GET"])

def item_usage():
    category = request.args.get("category")
    with get_db() as conn:
        cur = conn.cursor()
        if category:
            cur.execute(
                "SELECT * FROM Item_Usage_Report WHERE Category = ? ORDER BY TotalAmountSpent DESC",
                category,
            )
        else:
            cur.execute(
                "SELECT * FROM Item_Usage_Report ORDER BY TotalAmountSpent DESC"
            )
        return success(rows_to_dict(cur))


# ── /api/reports/monthly-expenditure ────────────────────────────────────────
@reports_bp.route("/monthly-expenditure", methods=["GET"])

def monthly_expenditure():
    year = request.args.get("year")
    with get_db() as conn:
        cur = conn.cursor()
        if year:
            cur.execute(
                """
                SELECT * FROM Monthly_Expenditure_Report
                
                ORDER BY PaymentYear, PaymentMonth
                """,
                
            )
        else:
            cur.execute(
                "SELECT * FROM Monthly_Expenditure_Report ORDER BY PaymentYear, PaymentMonth"
            )
        return success(rows_to_dict(cur))


# ── /api/reports/open-orders ─────────────────────────────────────────────────
@reports_bp.route("/open-orders", methods=["GET"])

def open_orders():
    overdue_only = request.args.get("overdue_only", "false").lower() == "true"
    with get_db() as conn:
        cur = conn.cursor()
        if overdue_only:
            cur.execute(
                "SELECT * FROM Open_Orders_Report WHERE OverdueDays > 0 ORDER BY OverdueDays DESC"
            )
        else:
            cur.execute(
                "SELECT * FROM Open_Orders_Report ORDER BY DueStatus, ExpectedDate ASC"
            )
        return success(rows_to_dict(cur))


# ── /api/reports/unpaid-invoices ─────────────────────────────────────────────
@reports_bp.route("/unpaid-invoices", methods=["GET"])

def unpaid_invoices():
    overdue_only = request.args.get("overdue_only", "false").lower() == "true"
    with get_db() as conn:
        cur = conn.cursor()
        if overdue_only:
            cur.execute(
                "SELECT * FROM Unpaid_Invoice_Report WHERE OverdueStatus = 'Overdue' ORDER BY DaysOverdue DESC"
            )
        else:
            cur.execute(
                "SELECT * FROM Unpaid_Invoice_Report ORDER BY DaysOverdue DESC"
            )
        return success(rows_to_dict(cur))


# ── /api/reports/supplier-performance ───────────────────────────────────────
@reports_bp.route("/supplier-performance", methods=["GET"])

def supplier_performance():
    rating = request.args.get("rating")
    with get_db() as conn:
        cur = conn.cursor()
        if rating:
            cur.execute(
                "SELECT * FROM Supplier_Performance_Report WHERE PerformanceRating = ? ORDER BY SupplierName",
                rating,
            )
        else:
            cur.execute(
                "SELECT * FROM Supplier_Performance_Report ORDER BY PerformanceRating, SupplierName"
            )
        return success(rows_to_dict(cur))


# ── /api/reports/payment-history ─────────────────────────────────────────────
@reports_bp.route("/payment-history", methods=["GET"])

def payment_history():
    supplier_id = request.args.get("supplier_id")
    year        = request.args.get("year")
    timeliness  = request.args.get("timeliness")   # 'On Time' | 'Late'

    with get_db() as conn:
        cur = conn.cursor()
        query = "SELECT * FROM Payment_History_Report WHERE 1 = 1"
        params = []
        if supplier_id:
            query += " AND SupplierID = ?"
            params.append(supplier_id)
        if year:
            query += " AND YEAR(PaymentDate) = ?"
            params.append(year)
        if timeliness:
            query += " AND PaymentTimeliness = ?"
            params.append(timeliness)

        query += " ORDER BY PaymentDate DESC"
        cur.execute(query, params)
        return success(rows_to_dict(cur))
