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
                (SELECT COUNT(*) FROM Suppliers WHERE Status = 'Approved') AS ApprovedSuppliers,
                (SELECT COUNT(*) FROM Suppliers WHERE Status = 'Applied') AS PendingSuppliers,

                (SELECT COUNT(*) FROM Contracts WHERE ContractStatus = 'Active') AS ActiveContracts,
                (SELECT COUNT(*) FROM Contracts
                 WHERE ContractStatus = 'Active'
                   AND DATEDIFF(DAY, GETDATE(), EndDate) <= 30) AS ContractsExpiringSoon,

                (SELECT COUNT(*) FROM PurchaseOrders WHERE Status = 'Pending')  AS PendingOrders,
                (SELECT COUNT(*) FROM PurchaseOrders WHERE Status = 'Approved') AS ApprovedOrders,
                (SELECT COUNT(*) FROM PurchaseOrders
                 WHERE Status IN ('Pending','Approved')
                   AND ExpectedDate < CAST(GETDATE() AS DATE)) AS OverdueOrders,

                (SELECT COUNT(*) FROM Invoices WHERE Status = 'Received') AS UnprocessedInvoices,
                (SELECT COUNT(*) FROM Invoices WHERE Status = 'Disputed') AS DisputedInvoices,

                (SELECT ISNULL(SUM(AmountPaid), 0)
                 FROM Payments
                 WHERE Status = 'Completed'
                   AND MONTH(PaymentDate) = MONTH(GETDATE())
                   AND YEAR(PaymentDate)  = YEAR(GETDATE())) AS PaymentsThisMonth,

                (SELECT ISNULL(SUM(i.InvoiceAmount - ISNULL(p.Paid,0)), 0)
                 FROM Invoices i
                 LEFT JOIN (
                     SELECT InvoiceID, SUM(AmountPaid) AS Paid
                     FROM Payments WHERE Status = 'Completed'
                     GROUP BY InvoiceID
                 ) p ON p.InvoiceID = i.InvoiceID
                 WHERE i.Status != 'Paid') AS TotalOutstanding
        """)
        kpis = row_to_dict(cur)

        # ── Contracts expiring in next 30 days ───────────────────────────────
        cur.execute("""
            SELECT TOP 5
                c.ContractID, c.ContractNumber,
                s.SupplierName,
                c.EndDate,
                DATEDIFF(DAY, GETDATE(), c.EndDate) AS DaysUntilExpiry
            FROM Contracts c
            JOIN Suppliers s ON s.SupplierID = c.SupplierID
            WHERE c.ContractStatus = 'Active'
              AND c.EndDate BETWEEN CAST(GETDATE() AS DATE)
                               AND DATEADD(DAY, 30, CAST(GETDATE() AS DATE))
            ORDER BY c.EndDate ASC
        """)
        expiring_contracts = rows_to_dict(cur)

        # ── Overdue purchase orders ──────────────────────────────────────────
        cur.execute("""
            SELECT TOP 5
                po.POID, s.SupplierName, po.PODate, po.ExpectedDate, po.Status,
                DATEDIFF(DAY, po.ExpectedDate, GETDATE()) AS OverdueDays
            FROM PurchaseOrders po
            JOIN Suppliers s ON s.SupplierID = po.SupplierID
            WHERE po.Status IN ('Pending','Approved')
              AND po.ExpectedDate < CAST(GETDATE() AS DATE)
            ORDER BY OverdueDays DESC
        """)
        overdue_orders = rows_to_dict(cur)

        # ── Unpaid / overdue invoices ────────────────────────────────────────
        cur.execute("""
            SELECT TOP 5
                i.InvoiceID, i.InvoiceNumber, s.SupplierName,
                i.InvoiceAmount, i.DueDate,
                DATEDIFF(DAY, i.DueDate, GETDATE()) AS DaysOverdue
            FROM Invoices i
            JOIN PurchaseOrders po ON po.POID      = i.POID
            JOIN Suppliers s       ON s.SupplierID = po.SupplierID
            WHERE i.Status != 'Paid'
              AND i.DueDate < CAST(GETDATE() AS DATE)
            ORDER BY DaysOverdue DESC
        """)
        overdue_invoices = rows_to_dict(cur)

        # ── Monthly expenditure (last 6 months) ──────────────────────────────
        cur.execute("""
            SELECT TOP 6
                YEAR(PaymentDate)              AS Year,
                MONTH(PaymentDate)             AS Month,
                DATENAME(MONTH, PaymentDate)   AS MonthName,
                SUM(AmountPaid)                AS TotalPaid
            FROM Payments
            WHERE Status = 'Completed'
            GROUP BY YEAR(PaymentDate), MONTH(PaymentDate), DATENAME(MONTH, PaymentDate)
            ORDER BY YEAR(PaymentDate) DESC, MONTH(PaymentDate) DESC
        """)
        monthly_trend = rows_to_dict(cur)

        # ── Top 5 suppliers by spend ─────────────────────────────────────────
        cur.execute("""
            SELECT TOP 5
                s.SupplierID, s.SupplierName,
                SUM(p.AmountPaid) AS TotalSpend
            FROM Payments p
            JOIN Invoices i        ON i.InvoiceID  = p.InvoiceID
            JOIN PurchaseOrders po ON po.POID       = i.POID
            JOIN Suppliers s       ON s.SupplierID  = po.SupplierID
            WHERE p.Status = 'Completed'
            GROUP BY s.SupplierID, s.SupplierName
            ORDER BY TotalSpend DESC
        """)
        top_suppliers = rows_to_dict(cur)

        # ── Recent activity (last 10 events) ─────────────────────────────────
        cur.execute("""
            SELECT TOP 10 * FROM (
                SELECT 'Purchase Order' AS EventType,
                       CAST(po.POID AS VARCHAR) AS RefID,
                       s.SupplierName,
                       po.Status,
                       po.PODate AS EventDate
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
