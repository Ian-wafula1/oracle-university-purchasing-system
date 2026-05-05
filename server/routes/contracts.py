from flask import Blueprint, request
from utils.db import get_db, rows_to_dict, row_to_dict
from utils.auth import login_required, roles_required
from utils.responses import success, created, error, not_found

contracts_bp = Blueprint("contracts", __name__, url_prefix="/api/contracts")

@contracts_bp.route("", methods=["GET"])
def list_contracts():
    status      = request.args.get("status")
    supplier_id = request.args.get("supplier_id")
    with get_db() as conn:
        cur = conn.cursor()
        query = """
            SELECT
                c.*,
                s.SupplierName,
                COUNT(ci.ContractItemID)                  AS TotalItems,
                TRUNC(c.EndDate) - TRUNC(SYSDATE)         AS DaysUntilExpiry
            FROM Contracts c
            JOIN Suppliers s        ON s.SupplierID  = c.SupplierID
            LEFT JOIN ContractItems ci ON ci.ContractID = c.ContractID
            WHERE 1 = 1
        """
        params = []
        if status:
            query += " AND c.ContractStatus = :status"
            params.append(status)
        if supplier_id:
            query += " AND c.SupplierID = :supplier_id"
            params.append(supplier_id)

        query += """
            GROUP BY c.ContractID, c.SupplierID, c.ContractNumber, c.StartDate,
                     c.EndDate, c.ContractStatus, c.SignedDate, c.Notes, s.SupplierName
            ORDER BY c.StartDate DESC
        """
        cur.execute(query, params)
        return success(rows_to_dict(cur))

@contracts_bp.route("", methods=["POST"])
@roles_required("approver", "admin")
def create_contract():
    data = request.get_json() or {}
    required = ("supplier_id", "contract_number", "start_date", "end_date")
    missing  = [f for f in required if not data.get(f)]
    if missing:
        return error(f"Missing required fields: {', '.join(missing)}")

    with get_db() as conn:
        cur = conn.cursor()

        cur.execute(
            "SELECT Status FROM Suppliers WHERE SupplierID = :1", [data["supplier_id"]]
        )
        supplier = cur.fetchone()
        if not supplier:
            return not_found("Supplier")
        if supplier[0] != "Approved":
            return error("Contracts can only be created for Approved suppliers", 422)

        if data["start_date"] >= data["end_date"]:
            return error("EndDate must be after StartDate")

        contract_id_var = cur.var(__import__("cx_Oracle").NUMBER)
        cur.execute(
            """
            INSERT INTO Contracts
                (SupplierID, ContractNumber, StartDate, EndDate, ContractStatus, SignedDate, Notes)
            VALUES (:1, :2, :3, :4, 'Active', :5, :6)
            RETURNING ContractID INTO :7
            """,
            [
                data["supplier_id"],
                data["contract_number"],
                data["start_date"],
                data["end_date"],
                data.get("signed_date"),
                data.get("notes"),
                contract_id_var,
            ],
        )
        contract_id = int(contract_id_var.getvalue())
        cur.execute("SELECT * FROM Contracts WHERE ContractID = :1", [contract_id])
        contract = row_to_dict(cur)

        items = data.get("items", [])
        for item in items:
            cur.execute(
                """
                INSERT INTO ContractItems (ContractID, ItemID, AgreedPrice, IsActive)
                VALUES (:1, :2, :3, 1)
                """,
                [contract["ContractID"], item["item_id"], item["agreed_price"]],
            )

    return created(contract, "Contract created")


# ── GET /api/contracts/<id> ──────────────────────────────────────────────────
@contracts_bp.route("/<int:contract_id>", methods=["GET"])
def get_contract(contract_id):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT c.*, s.SupplierName, s.Email AS SupplierEmail
            FROM Contracts c
            JOIN Suppliers s ON s.SupplierID = c.SupplierID
            WHERE c.ContractID = :1
            """,
            [contract_id],
        )
        contract = row_to_dict(cur)
        if not contract:
            return not_found("Contract")

        cur.execute(
            """
            SELECT ci.*, i.ItemName, i.Category, i.Unit
            FROM ContractItems ci
            JOIN Items i ON i.ItemID = ci.ItemID
            WHERE ci.ContractID = :1
            ORDER BY i.Category, i.ItemName
            """,
            [contract_id],
        )
        contract["items"] = rows_to_dict(cur)

    return success(contract)


# ── PUT /api/contracts/<id> ──────────────────────────────────────────────────
@contracts_bp.route("/<int:contract_id>", methods=["PUT"])
@roles_required("approver", "admin")
def update_contract(contract_id):
    data = request.get_json() or {}
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM Contracts WHERE ContractID = :1", [contract_id])
        if not cur.fetchone():
            return not_found("Contract")

        cur.execute(
            """
            UPDATE Contracts
            SET ContractNumber = NVL(:1, ContractNumber),
                StartDate      = NVL(:2, StartDate),
                EndDate        = NVL(:3, EndDate),
                ContractStatus = NVL(:4, ContractStatus),
                SignedDate     = NVL(:5, SignedDate),
                Notes          = NVL(:6, Notes)
            WHERE ContractID = :7
            """,
            [
                data.get("contract_number"),
                data.get("start_date"),
                data.get("end_date"),
                data.get("contract_status"),
                data.get("signed_date"),
                data.get("notes"),
                contract_id,
            ],
        )
        cur.execute("SELECT * FROM Contracts WHERE ContractID = :1", [contract_id])
        updated = row_to_dict(cur)

    return success(updated, "Contract updated")


# ── GET /api/contracts/<id>/items ────────────────────────────────────────────
@contracts_bp.route("/<int:contract_id>/items", methods=["GET"])
def list_contract_items(contract_id):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM Contracts WHERE ContractID = :1", [contract_id])
        if not cur.fetchone():
            return not_found("Contract")

        cur.execute(
            """
            SELECT ci.*, i.ItemName, i.Category, i.Unit, i.Description
            FROM ContractItems ci
            JOIN Items i ON i.ItemID = ci.ItemID
            WHERE ci.ContractID = :1
            ORDER BY i.Category, i.ItemName
            """,
            [contract_id],
        )
        return success(rows_to_dict(cur))


# ── POST /api/contracts/<id>/items ───────────────────────────────────────────
@contracts_bp.route("/<int:contract_id>/items", methods=["POST"])
@roles_required("approver", "admin")
def add_contract_item(contract_id):
    data = request.get_json() or {}
    required = ("item_id", "agreed_price")
    missing  = [f for f in required if data.get(f) is None]
    if missing:
        return error(f"Missing required fields: {', '.join(missing)}")

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM Contracts WHERE ContractID = :1", [contract_id])
        if not cur.fetchone():
            return not_found("Contract")

        cur.execute(
            "SELECT 1 FROM ContractItems WHERE ContractID = :1 AND ItemID = :2",
            [contract_id, data["item_id"]],
        )
        if cur.fetchone():
            return error("This item is already on this contract", 409)

        ci_id_var = cur.var(__import__("cx_Oracle").NUMBER)
        cur.execute(
            """
            INSERT INTO ContractItems (ContractID, ItemID, AgreedPrice, IsActive)
            VALUES (:1, :2, :3, 1)
            RETURNING ContractItemID INTO :4
            """,
            [contract_id, data["item_id"], data["agreed_price"], ci_id_var],
        )
        ci_id = int(ci_id_var.getvalue())
        cur.execute(
            "SELECT * FROM ContractItems WHERE ContractItemID = :1", [ci_id]
        )
        item = row_to_dict(cur)

    return created(item, "Item added to contract")


# ── DELETE /api/contract-items/<id> ─────────────────────────────────────────
@contracts_bp.route("/contract-items/<int:contract_item_id>", methods=["DELETE"])
@roles_required("approver", "admin")
def delete_contract_item(contract_item_id):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT 1 FROM ContractItems WHERE ContractItemID = :1", [contract_item_id]
        )
        if not cur.fetchone():
            return not_found("Contract item")

        cur.execute(
            "DELETE FROM ContractItems WHERE ContractItemID = :1", [contract_item_id]
        )

    return success(message="Contract item removed")
