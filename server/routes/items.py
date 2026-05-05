from flask import Blueprint, request
from utils.db import get_db, rows_to_dict, row_to_dict
from utils.auth import login_required, roles_required
from utils.responses import success, created, error, not_found

items_bp = Blueprint("items", __name__, url_prefix="/api/items")


# ── GET /api/items ───────────────────────────────────────────────────────────
@items_bp.route("", methods=["GET"])
def list_items():
    category = request.args.get("category")
    with get_db() as conn:
        cur = conn.cursor()
        if category:
            cur.execute(
                "SELECT * FROM Items WHERE Category = :1 ORDER BY ItemName", [category]
            )
        else:
            cur.execute("SELECT * FROM Items ORDER BY Category, ItemName")
        items = rows_to_dict(cur)

        cur.execute(
            "SELECT DISTINCT Category FROM Items WHERE Category IS NOT NULL ORDER BY Category"
        )
        categories = [r[0] for r in cur.fetchall()]

    return success({"items": items, "categories": categories})


# ── POST /api/items ──────────────────────────────────────────────────────────
@items_bp.route("", methods=["POST"])
@roles_required("approver", "admin")
def create_item():
    data = request.get_json() or {}
    required = ("item_name", "unit")
    missing  = [f for f in required if not data.get(f)]
    if missing:
        return error(f"Missing required fields: {', '.join(missing)}")

    with get_db() as conn:
        cur = conn.cursor()
        item_id_var = cur.var(int)
        cur.execute(
            """
            INSERT INTO Items (ItemName, Description, Unit, Category)
            VALUES (:1, :2, :3, :4)
            RETURNING ItemID INTO :5
            """,
            [
                data["item_name"],
                data.get("description"),
                data["unit"],
                data.get("category"),
                item_id_var,
            ],
        )
        item_id = item_id_var.getvalue()
        cur.execute("SELECT * FROM Items WHERE ItemID = :1", [item_id])
        item = row_to_dict(cur)

    return created(item, "Item created")


# ── PUT /api/items/<id> ──────────────────────────────────────────────────────
@items_bp.route("/<int:item_id>", methods=["PUT"])
@roles_required("approver", "admin")
def update_item(item_id):
    data = request.get_json() or {}
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM Items WHERE ItemID = :1", [item_id])
        if not cur.fetchone():
            return not_found("Item")

        cur.execute(
            """
            UPDATE Items
            SET ItemName    = NVL(:1, ItemName),
                Description = NVL(:2, Description),
                Unit        = NVL(:3, Unit),
                Category    = NVL(:4, Category)
            WHERE ItemID    = :5
            """,
            [
                data.get("item_name"),
                data.get("description"),
                data.get("unit"),
                data.get("category"),
                item_id,
            ],
        )
        cur.execute("SELECT * FROM Items WHERE ItemID = :1", [item_id])
        updated = row_to_dict(cur)

    return success(updated, "Item updated")


# ── DELETE /api/items/<id> ───────────────────────────────────────────────────
@items_bp.route("/<int:item_id>", methods=["DELETE"])
@roles_required("admin")
def delete_item(item_id):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM Items WHERE ItemID = :1", [item_id])
        if not cur.fetchone():
            return not_found("Item")

        cur.execute(
            "SELECT 1 FROM PurchaseOrderDetails WHERE ItemID = :1", [item_id]
        )
        if cur.fetchone():
            return error(
                "Cannot delete an item that appears on existing Purchase Orders", 409
            )

        cur.execute("DELETE FROM Items WHERE ItemID = :1", [item_id])

    return success(message="Item deleted")
