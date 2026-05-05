from flask import Blueprint, request
from utils.db import get_db, rows_to_dict, row_to_dict
from utils.auth import login_required, roles_required
from utils.responses import success, created, error, not_found

purchase_orders_bp = Blueprint("purchase_orders", __name__, url_prefix="/api/purchase-orders")


# ── GET /api/purchase-orders ─────────────────────────────────────────────────
@purchase_orders_bp.route("", methods=["GET"])
def list_purchase_orders():
    status      = request.args.get("status")
    supplier_id = request.args.get("supplier_id")

    with get_db() as conn:
        cur = conn.cursor()
        query = """
            SELECT
                po.*,
                s.SupplierName,
                COUNT(pod.PODetailID)       AS TotalLineItems,
                SUM(pod.TotalPrice)         AS OrderTotal,
                CASE
                    WHEN po.ExpectedDate < CAST(GETDATE() AS DATE)
                         AND po.Status IN ('Pending','Approved')
                    THEN DATEDIFF(DAY, po.ExpectedDate, GETDATE())
                    ELSE 0
                END AS OverdueDays
            FROM PurchaseOrders po
            JOIN Suppliers s                ON s.SupplierID = po.SupplierID
            LEFT JOIN PurchaseOrderDetails pod ON pod.POID  = po.POID
            WHERE 1 = 1
        """
        params = []
        if status:
            query += " AND po.Status = ?"
            params.append(status)
        if supplier_id:
            query += " AND po.SupplierID = ?"
            params.append(supplier_id)

        query += """
            GROUP BY po.POID, po.SupplierID, po.PODate, po.ExpectedDate,
                     po.Status, po.CreatedBy, po.ApprovedBy, po.Notes, s.SupplierName
            ORDER BY po.PODate DESC
        """
        cur.execute(query, params)
        return success(rows_to_dict(cur))


# ── POST /api/purchase-orders ─────────────────────────────────────────────────
@purchase_orders_bp.route("", methods=["POST"])

def create_purchase_order():
    data = request.get_json() or {}
    required = ("supplier_id", "expected_date")
    missing  = [f for f in required if not data.get(f)]
    if missing:
        return error(f"Missing required fields: {', '.join(missing)}")

    items = data.get("items", [])
    if not items:
        return error("At least one order item is required")

    username = request.current_user.get("username")

    with get_db() as conn:
        cur = conn.cursor()

        # Validate supplier
        cur.execute(
            "SELECT Status FROM Suppliers WHERE SupplierID = ?", data["supplier_id"]
        )
        supplier = cur.fetchone()
        if not supplier:
            return not_found("Supplier")
        if supplier[0] != "Approved":
            return error("Purchase Orders can only be raised for Approved suppliers", 422)

        cur.execute(
            """
            INSERT INTO PurchaseOrders
                (SupplierID, PODate, ExpectedDate, Status, CreatedBy, Notes)
            OUTPUT INSERTED.*
            VALUES (?, CAST(GETDATE() AS DATE), ?, 'Pending', ?, ?)
            """,
            data["supplier_id"],
            data["expected_date"],
            username,
            data.get("notes"),
        )
        po = row_to_dict(cur)
        po_id = po["POID"]

        # Insert line items
        for item in items:
            if not item.get("item_id") or not item.get("quantity"):
                return error("Each item requires item_id and quantity")

            # Default price from contract if not supplied
            unit_price = item.get("unit_price", 0)
            if not unit_price:
                cur.execute(
                    """
                    SELECT TOP 1 ci.AgreedPrice
                    FROM ContractItems ci
                    JOIN Contracts c ON c.ContractID = ci.ContractID
                    WHERE c.SupplierID = ? AND ci.ItemID = ?
                      AND ci.IsActive = 1 AND c.ContractStatus = 'Active'
                    """,
                    data["supplier_id"], item["item_id"],
                )
                price_row = cur.fetchone()
                unit_price = price_row[0] if price_row else 0

            cur.execute(
                """
                INSERT INTO PurchaseOrderDetails
                    (POID, ItemID, Quantity, UnitPrice, Discount)
                VALUES (?, ?, ?, ?, ?)
                """,
                po_id,
                item["item_id"],
                item["quantity"],
                unit_price,
                item.get("discount", 0),
            )

        # Return full PO with line items
        cur.execute(
            """
            SELECT pod.*, i.ItemName, i.Unit
            FROM PurchaseOrderDetails pod
            JOIN Items i ON i.ItemID = pod.ItemID
            WHERE pod.POID = ?
            """,
            po_id,
        )
        po["items"] = rows_to_dict(cur)

    return created(po, "Purchase Order created")


# ── GET /api/purchase-orders/<id> ────────────────────────────────────────────
@purchase_orders_bp.route("/<int:po_id>", methods=["GET"])

def get_purchase_order(po_id):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT po.*, s.SupplierName, s.Email AS SupplierEmail, s.Phone AS SupplierPhone
            FROM PurchaseOrders po
            JOIN Suppliers s ON s.SupplierID = po.SupplierID
            WHERE po.POID = ?
            """,
            po_id,
        )
        po = row_to_dict(cur)
        if not po:
            return not_found("Purchase Order")

        cur.execute(
            """
            SELECT pod.*, i.ItemName, i.Category, i.Unit
            FROM PurchaseOrderDetails pod
            JOIN Items i ON i.ItemID = pod.ItemID
            WHERE pod.POID = ?
            ORDER BY pod.PODetailID
            """,
            po_id,
        )
        po["items"] = rows_to_dict(cur)

        # Running total
        po["order_total"] = sum(
            (item.get("TotalPrice") or 0) for item in po["items"]
        )

    return success(po)


# ── PUT /api/purchase-orders/<id> ────────────────────────────────────────────
@purchase_orders_bp.route("/<int:po_id>", methods=["PUT"])

def update_purchase_order(po_id):
    data = request.get_json() or {}
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT Status FROM PurchaseOrders WHERE POID = ?", po_id
        )
        row = cur.fetchone()
        if not row:
            return not_found("Purchase Order")

        # Only allow edit on Pending orders
        if row[0] not in ("Pending",):
            return error("Only Pending Purchase Orders can be edited", 422)

        # Approve action
        if data.get("action") == "approve":
            username = request.current_user.get("username")
            cur.execute(
                "EXEC usp_ApprovePurchaseOrder @POID = ?, @ApprovedBy = ?",
                po_id, username,
            )
        else:
            cur.execute(
                """
                UPDATE PurchaseOrders
                SET ExpectedDate = ISNULL(?, ExpectedDate),
                    Notes        = ISNULL(?, Notes)
                WHERE POID = ?
                """,
                data.get("expected_date"),
                data.get("notes"),
                po_id,
            )

        cur.execute("SELECT * FROM PurchaseOrders WHERE POID = ?", po_id)
        updated = row_to_dict(cur)

    return success(updated, "Purchase Order updated")


# ── GET /api/purchase-orders/<id>/items ──────────────────────────────────────
@purchase_orders_bp.route("/<int:po_id>/items", methods=["GET"])

def list_po_items(po_id):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM PurchaseOrders WHERE POID = ?", po_id)
        if not cur.fetchone():
            return not_found("Purchase Order")

        cur.execute(
            """
            SELECT pod.*, i.ItemName, i.Category, i.Unit
            FROM PurchaseOrderDetails pod
            JOIN Items i ON i.ItemID = pod.ItemID
            WHERE pod.POID = ?
            """,
            po_id,
        )
        return success(rows_to_dict(cur))


# ── POST /api/purchase-orders/<id>/items ─────────────────────────────────────
@purchase_orders_bp.route("/<int:po_id>/items", methods=["POST"])

def add_po_item(po_id):
    data = request.get_json() or {}
    required = ("item_id", "quantity", "unit_price")
    missing  = [f for f in required if data.get(f) is None]
    if missing:
        return error(f"Missing required fields: {', '.join(missing)}")

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT Status FROM PurchaseOrders WHERE POID = ?", po_id
        )
        row = cur.fetchone()
        if not row:
            return not_found("Purchase Order")
        if row[0] != "Pending":
            return error("Items can only be added to Pending Purchase Orders", 422)

        cur.execute(
            """
            INSERT INTO PurchaseOrderDetails (POID, ItemID, Quantity, UnitPrice, Discount)
            OUTPUT INSERTED.*
            VALUES (?, ?, ?, ?, ?)
            """,
            po_id,
            data["item_id"],
            data["quantity"],
            data["unit_price"],
            data.get("discount", 0),
        )
        detail = row_to_dict(cur)

    return created(detail, "Item added to Purchase Order")


# ── PUT /api/order-details/<id> ───────────────────────────────────────────────
@purchase_orders_bp.route("/order-details/<int:detail_id>", methods=["PUT"])

def update_po_detail(detail_id):
    data = request.get_json() or {}
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT pod.PODetailID, po.Status
            FROM PurchaseOrderDetails pod
            JOIN PurchaseOrders po ON po.POID = pod.POID
            WHERE pod.PODetailID = ?
            """,
            detail_id,
        )
        row = cur.fetchone()
        if not row:
            return not_found("Order detail")
        if row[1] != "Pending":
            return error("Order details can only be edited on Pending Purchase Orders", 422)

        cur.execute(
            """
            UPDATE PurchaseOrderDetails
            SET Quantity  = ISNULL(?, Quantity),
                UnitPrice = ISNULL(?, UnitPrice),
                Discount  = ISNULL(?, Discount)
            WHERE PODetailID = ?
            """,
            data.get("quantity"),
            data.get("unit_price"),
            data.get("discount"),
            detail_id,
        )
        cur.execute("SELECT * FROM PurchaseOrderDetails WHERE PODetailID = ?", detail_id)
        updated = row_to_dict(cur)

    return success(updated, "Order detail updated")


# ── DELETE /api/order-details/<id> ───────────────────────────────────────────
@purchase_orders_bp.route("/order-details/<int:detail_id>", methods=["DELETE"])

def delete_po_detail(detail_id):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT po.Status FROM PurchaseOrderDetails pod
            JOIN PurchaseOrders po ON po.POID = pod.POID
            WHERE pod.PODetailID = ?
            """,
            detail_id,
        )
        row = cur.fetchone()
        if not row:
            return not_found("Order detail")
        if row[0] != "Pending":
            return error("Cannot remove items from a non-Pending Purchase Order", 422)

        cur.execute(
            "DELETE FROM PurchaseOrderDetails WHERE PODetailID = ?", detail_id
        )

    return success(message="Order detail removed")
