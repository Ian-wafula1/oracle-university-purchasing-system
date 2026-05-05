from flask import Blueprint
from utils.db import get_db, row_to_dict, rows_to_dict
from utils.auth import login_required
from utils.responses import success

dashboard_bp = Blueprint("dashboard", __name__, url_prefix="/api/dashboard")


@dashboard_bp.route("", methods=["GET"])
def dashboard():
    with get_db() as conn:
        cur = conn.cursor()

        # ── KPI cards ────────────────────────────────────────────────────────

        cur.execute("""
            SELECT
                (SELECT COUNT(*) FROM Suppliers WHERE Status = 'Approved')          AS ApprovedSuppliers,
                (SELECT COUNT(*) FROM Suppliers WHERE Status = 'Applied')           AS PendingSuppliers,

                (SELECT COUNT(*) FROM Contracts WHERE ContractStatus = 'Active')    AS ActiveContracts,
                (SELECT COUNT(*) FROM Contracts
                 WHERE ContractStatus = 'Active'
                   AND TRUNC(EndDate) - TRUNC(SYSDATE) <= 30)                       AS ContractsExpiringSoon,

                (SELECT COUNT(*) FROM PurchaseOrders WHERE Status = 'Pending')      AS PendingOrders,
                (SELECT COUNT(*) FROM PurchaseOrders WHERE Status = 'Approved')     AS ApprovedOrders,
                (SELECT COUNT(*) FROM PurchaseOrders
                 WHERE Status IN ('Pending','Approved')
                   AND ExpectedDate < TRUNC(SYSDATE))                               AS OverdueOrders,

                (SELECT COUNT(*) FROM Invoices WHERE Status = 'Received')           AS UnprocessedInvoices,
                (SELECT COUNT(*) FROM Invoices WHERE Status = 'Disputed')           AS DisputedInvoices,

                (SELECT NVL(SUM(AmountPaid), 0)
                 FROM Payments
                 WHERE Status = 'Completed'
                   AND EXTRACT(MONTH FROM PaymentDate) = EXTRACT(MONTH FROM SYSDATE)
                   AND EXTRACT(YEAR  FROM PaymentDate) = EXTRACT(YEAR  FROM SYSDATE)) AS PaymentsThisMonth,

                (SELECT NVL(SUM(i.InvoiceAmount - NVL(p.Paid, 0)), 0)
                 FROM Invoices i
                 LEFT JOIN (
                     SELECT InvoiceID, SUM(AmountPaid) AS Paid
                     FROM Payments WHERE Status = 'Completed'
                     GROUP BY InvoiceID
                 ) p ON p.InvoiceID = i.InvoiceID
                 WHERE i.Status != 'Paid')                                           AS TotalOutstanding
            FROM DUAL
        """)
        kpis = row_to_dict(cur)

        # ── Contracts expiring in next 30 days ───────────────────────────────
        cur.execute("""
            SELECT *
            FROM (
                SELECT
                    c.ContractID, c.ContractNumber,
                    s.SupplierName,
                    c.EndDate,
                    TRUNC(c.EndDate) - TRUNC(SYSDATE) AS DaysUntilExpiry
                FROM Contracts c
                JOIN Suppliers s ON s.SupplierID = c.SupplierID
                WHERE c.ContractStatus = 'Active'
                  AND c.EndDate BETWEEN TRUNC(SYSDATE)
                                    AND TRUNC(SYSDATE) + 30
                ORDER BY c.EndDate ASC
            )
            WHERE ROWNUM <= 5
        """)
        expiring_contracts = rows_to_dict(cur)

        # ── Overdue purchase orders ──────────────────────────────────────────
        cur.execute("""
            SELECT *
            FROM (
                SELECT
                    po.POID, s.SupplierName, po.PODate, po.ExpectedDate, po.Status,
                    TRUNC(SYSDATE) - TRUNC(po.ExpectedDate) AS OverdueDays
                FROM PurchaseOrders po
                JOIN Suppliers s ON s.SupplierID = po.SupplierID
                WHERE po.Status IN ('Pending','Approved')
                  AND po.ExpectedDate < TRUNC(SYSDATE)
                ORDER BY OverdueDays DESC
            )
            WHERE ROWNUM <= 5
        """)
        overdue_orders = rows_to_dict(cur)

        # ── Unpaid / overdue invoices ────────────────────────────────────────
        cur.execute("""
            SELECT *
            FROM (
                SELECT
                    i.InvoiceID, i.InvoiceNumber, s.SupplierName,
                    i.InvoiceAmount, i.DueDate,
                    TRUNC(SYSDATE) - TRUNC(i.DueDate) AS DaysOverdue
                FROM Invoices i
                JOIN PurchaseOrders po ON po.POID      = i.POID
                JOIN Suppliers s       ON s.SupplierID = po.SupplierID
                WHERE i.Status != 'Paid'
                  AND i.DueDate < TRUNC(SYSDATE)
                ORDER BY DaysOverdue DESC
            )
            WHERE ROWNUM <= 5
        """)
        overdue_invoices = rows_to_dict(cur)

        # ── Monthly expenditure (last 6 months) ──────────────────────────────
        cur.execute("""
            SELECT *
            FROM (
                SELECT
                    EXTRACT(YEAR  FROM PaymentDate)          AS Year,
                    EXTRACT(MONTH FROM PaymentDate)          AS Month,
                    TO_CHAR(PaymentDate, 'Month')            AS MonthName,
                    SUM(AmountPaid)                          AS TotalPaid
                FROM Payments
                WHERE Status = 'Completed'
                GROUP BY EXTRACT(YEAR FROM PaymentDate),
                         EXTRACT(MONTH FROM PaymentDate),
                         TO_CHAR(PaymentDate, 'Month')
                ORDER BY EXTRACT(YEAR FROM PaymentDate)  DESC,
                         EXTRACT(MONTH FROM PaymentDate) DESC
            )
            WHERE ROWNUM <= 6
        """)
        monthly_trend = rows_to_dict(cur)

        # ── Top 5 suppliers by spend ─────────────────────────────────────────
        cur.execute("""
            SELECT *
            FROM (
                SELECT
                    s.SupplierID, s.SupplierName,
                    SUM(p.AmountPaid) AS TotalSpend
                FROM Payments p
                JOIN Invoices i        ON i.InvoiceID  = p.InvoiceID
                JOIN PurchaseOrders po ON po.POID       = i.POID
                JOIN Suppliers s       ON s.SupplierID  = po.SupplierID
                WHERE p.Status = 'Completed'
                GROUP BY s.SupplierID, s.SupplierName
                ORDER BY TotalSpend DESC
            )
            WHERE ROWNUM <= 5
        """)
        top_suppliers = rows_to_dict(cur)

        # ── Recent activity (last 10 events) ─────────────────────────────────
        cur.execute("""
            SELECT *
            FROM (
                SELECT * FROM (
                    SELECT 'Purchase Order'          AS EventType,
                           TO_CHAR(po.POID)          AS RefID,
                           s.SupplierName,
                           po.Status,
                           po.PODate                 AS EventDate
                    FROM PurchaseOrders po
                    JOIN Suppliers s ON s.SupplierID = po.SupplierID

                    UNION ALL

                    SELECT 'Invoice',
                           i.InvoiceNumber,
                           s.SupplierName,
                           i.Status,
                           i.InvoiceDate
                    FROM Invoices i
                    JOIN PurchaseOrders po ON po.POID = i.POID
                    JOIN Suppliers s ON s.SupplierID = po.SupplierID

                    UNION ALL

                    SELECT 'Payment',
                           p.ReferenceNumber,
                           s.SupplierName,
                           p.Status,
                           p.PaymentDate
                    FROM Payments p
                    JOIN Invoices i ON i.InvoiceID = p.InvoiceID
                    JOIN PurchaseOrders po ON po.POID = i.POID
                    JOIN Suppliers s ON s.SupplierID = po.SupplierID
                ) activity
                ORDER BY EventDate DESC
            )
            WHERE ROWNUM <= 10
        """)
        recent_activity = rows_to_dict(cur)

    return success({
        "kpis":               kpis,
        "expiring_contracts": expiring_contracts,
        "overdue_orders":     overdue_orders,
        "overdue_invoices":   overdue_invoices,
        "monthly_trend":      monthly_trend,
        "top_suppliers":      top_suppliers,
        "recent_activity":    recent_activity,
    })
