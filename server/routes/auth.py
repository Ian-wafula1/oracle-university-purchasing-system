from flask import Blueprint, request
from utils.db import get_db, row_to_dict
from utils.auth import hash_password, check_password, generate_token, login_required
from utils.responses import success, created, error

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json() or {}
    required = ("username", "password", "email", "name")
    missing  = [f for f in required if not data.get(f)]
    if missing:
        return error(f"Missing fields: {', '.join(missing)}")

    role = data.get("role", "viewer")
    if role not in ("viewer", "approver", "admin"):
        return error("Invalid role. Must be viewer, approver, or admin.")

    with get_db() as conn:
        cur = conn.cursor()

        cur.execute("SELECT 1 FROM Users WHERE Username = :1", [data["username"]])
        if cur.fetchone():
            return error("Username already taken", 409)

        cur.execute("SELECT 1 FROM Users WHERE Email = :1", [data["email"]])
        if cur.fetchone():
            return error("Email already registered", 409)

        pwd_hash = hash_password(data["password"])

        user_id_var = cur.var(int)
        username_var = cur.var(str)
        role_var = cur.var(str)

        cur.execute(
            """
            INSERT INTO Users (Username, PasswordHash, Email, FullName, Role)
            VALUES (:1, :2, :3, :4, :5)
            RETURNING UserID, Username, Role INTO :6, :7, :8
            """,
            [data["username"], pwd_hash, data["email"], data["name"], role,
             user_id_var, username_var, role_var],
        )

        user_id  = user_id_var.getvalue()
        username = username_var.getvalue()
        role_out = role_var.getvalue()

    token = generate_token(user_id, username, role_out)
    return created(
        {"user_id": user_id, "username": username, "role": role_out, "token": token},
        "User registered successfully",
    )

@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    if not data.get("email") or not data.get("password"):
        return error("Email and password are required")

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT UserID, Username, PasswordHash, Role, IsActive FROM Users WHERE Email = :1",
            [data["email"]],
        )
        user = row_to_dict(cur)

    if not user:
        return error("Invalid email or password", 401)
    if not user["IsActive"]:
        return error("Account is deactivated. Contact an administrator.", 403)
    if not check_password(data["password"], user["PasswordHash"]):
        return error("Invalid email or password", 401)

    token = generate_token(user["UserID"], user["Username"], user["Role"])
    return success(
        {"user_id": user["UserID"], "username": user["Username"],
         "role": user["Role"], "token": token},
        "Login successful",
    )

@auth_bp.route("/me", methods=["GET"])
def me():
    uid = request.current_user["sub"]
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT UserID, Username, Email, FullName, Role, CreatedAt FROM Users WHERE UserID = :1",
            [uid],
        )
        user = row_to_dict(cur)
    if not user:
        return error("User not found", 404)
    return success(user)

@auth_bp.route("/change-password", methods=["POST"])
def change_password():
    data = request.get_json() or {}
    if not data.get("old_password") or not data.get("new_password"):
        return error("old_password and new_password are required")

    uid = request.current_user["sub"]
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT PasswordHash FROM Users WHERE UserID = :1", [uid])
        row = cur.fetchone()
        if not row or not check_password(data["old_password"], row[0]):
            return error("Current password is incorrect", 401)

        new_hash = hash_password(data["new_password"])
        cur.execute(
            "UPDATE Users SET PasswordHash = :1 WHERE UserID = :2", [new_hash, uid]
        )

    return success(message="Password changed successfully")
