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

    role = data.get("role", "viewer")   # viewer | approver | admin
    if role not in ("viewer", "approver", "admin"):
        return error("Invalid role. Must be viewer, approver, or admin.")

    with get_db() as conn:
        cur = conn.cursor()

        cur.execute("SELECT 1 FROM Users WHERE Username = ?", data["username"])
        if cur.fetchone():
            return error("Username already taken", 409)

        cur.execute("SELECT 1 FROM Users WHERE Email = ?", data["email"])
        if cur.fetchone():
            return error("Email already registered", 409)

        pwd_hash = hash_password(data["password"])
        cur.execute(
            """
            INSERT INTO Users (Username, PasswordHash, Email, FullName, Role)
            OUTPUT INSERTED.UserID, INSERTED.Username, INSERTED.Role
            VALUES (?, ?, ?, ?, ?)
            """,
            data["username"], pwd_hash, data["email"], data["name"], role,
        )
        row = cur.fetchone()

    token = generate_token(row[0], row[1], row[2])
    return created(
        {"user_id": row[0], "username": row[1], "role": row[2], "token": token},
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
            "SELECT UserID, Username, PasswordHash, Role, IsActive FROM Users WHERE Email = ?",
            data["email"],
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
            "SELECT UserID, Username, Email, FullName, Role, CreatedAt FROM Users WHERE UserID = ?",
            uid,
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
        cur.execute("SELECT PasswordHash FROM Users WHERE UserID = ?", uid)
        row = cur.fetchone()
        if not row or not check_password(data["old_password"], row[0]):
            return error("Current password is incorrect", 401)

        new_hash = hash_password(data["new_password"])
        cur.execute("UPDATE Users SET PasswordHash = ? WHERE UserID = ?", new_hash, uid)

    return success(message="Password changed successfully")
