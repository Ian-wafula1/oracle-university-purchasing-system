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
                "SELECT * FROM Items WHERE Category = ? ORDER BY ItemName", category
            )
        else:
            cur.execute("SELECT * FROM Items ORDER BY Category, ItemName")
        items = rows_to_dict(cur)

        # Also return distinct categories for dropdown population
        cur.execute("SELECT DISTINCT Category FROM Items WHERE Category IS NOT NULL ORDER BY Category")
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
        cur.execute(
            """
            INSERT INTO Items (ItemName, Description, Unit, Category)
            OUTPUT INSERTED.*
            VALUES (?, ?, ?, ?)
            """,
            data["item_name"],
            data.get("description"),
            data["unit"],
            data.get("category"),
        )
        item = row_to_dict(cur)

    return created(item, "Item created")


# ── PUT /api/items/<id> ──────────────────────────────────────────────────────
@items_bp.route("/<int:item_id>", methods=["PUT"])
@roles_required("approver", "admin")
def update_item(item_id):
    data = request.get_json() or {}
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM Items WHERE ItemID = ?", item_id)
        if not cur.fetchone():
            return not_found("Item")

        cur.execute(
            """
            UPDATE Items
            SET ItemName    = ISNULL(?, ItemName),
                Description = ISNULL(?, Description),
                Unit        = ISNULL(?, Unit),
                Category    = ISNULL(?, Category)
            WHERE ItemID = ?
            """,
            data.get("item_name"),
            data.get("description"),
            data.get("unit"),
            data.get("category"),
            item_id,
        )
        cur.execute("SELECT * FROM Items WHERE ItemID = ?", item_id)
        updated = row_to_dict(cur)

    return success(updated, "Item updated")


# ── DELETE /api/items/<id> ───────────────────────────────────────────────────
@items_bp.route("/<int:item_id>", methods=["DELETE"])
@roles_required("admin")
def delete_item(item_id):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM Items WHERE ItemID = ?", item_id)
        if not cur.fetchone():
            return not_found("Item")

        # Guard: item must not have PO history
        cur.execute(
            "SELECT 1 FROM PurchaseOrderDetails WHERE ItemID = ?", item_id
        )
        if cur.fetchone():
            return error(
                "Cannot delete an item that appears on existing Purchase Orders", 409
            )

        cur.execute("DELETE FROM Items WHERE ItemID = ?", item_id)

    return success(message="Item deleted")
