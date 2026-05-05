from flask import jsonify
from datetime import date, datetime
from decimal import Decimal
import json


class _Encoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (date, datetime)):
            return obj.isoformat()
        if isinstance(obj, Decimal):
            return float(obj)
        return super().default(obj)


def success(data=None, message: str = "OK", status: int = 200):
    payload = {"success": True, "message": message}
    if data is not None:
        payload["data"] = data
    return jsonify(payload), status


def created(data=None, message: str = "Created"):
    return success(data, message, 201)


def error(message: str, status: int = 400, details=None):
    payload = {"success": False, "error": message}
    if details:
        payload["details"] = details
    return jsonify(payload), status


def not_found(resource: str = "Record"):
    return error(f"{resource} not found", 404)


def configure_json(app):
    """Tell Flask to use our custom encoder."""
    app.json_encoder = _Encoder
